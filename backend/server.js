const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Authentication (Mock) ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        res.json({ token: 'spy-secret-token-' + Date.now(), user: { name: 'Admin', role: 'Spy Master' } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// --- Products Endpoints ---

app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const mapped = rows.map(r => ({
            id: r.id,
            name: r.name,
            sku: r.sku,
            category: r.category,
            fit: r.fit,
            wash: r.wash,
            sizes: r.sizes,
            stock: r.stock,
            costPrice: r.cost_price,
            price: r.price
        }));
        res.json(mapped);
    });
});

app.post('/api/products', (req, res) => {
    const { name, sku, category, fit, wash, sizes, stock, costPrice, price } = req.body;
    const sql = `INSERT INTO products (name, sku, category, fit, wash, sizes, stock, cost_price, price) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, sku, category, fit, wash, sizes, stock, costPrice, price];

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, ...req.body });
    });
});

app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, sku, category, fit, wash, sizes, stock, costPrice, price } = req.body;
    const sql = `UPDATE products SET name = ?, sku = ?, category = ?, fit = ?, wash = ?, sizes = ?, stock = ?, cost_price = ?, price = ? 
                 WHERE id = ?`;
    const params = [name, sku, category, fit, wash, sizes, stock, costPrice, price, id];

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product updated successfully' });
    });
});

app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM products WHERE id = ?', id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true });
    });
});

// --- Clients Endpoints ---

app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/clients', (req, res) => {
    const { name, phone, email, address } = req.body;
    db.run('INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)',
        [name, phone, email, address], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

app.put('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    db.run('UPDATE clients SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
        [name, phone, email, address, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Client updated successfully' });
        });
});

app.delete('/api/clients/:id', (req, res) => {
    db.run('DELETE FROM clients WHERE id = ?', req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Orders Endpoints ---

app.get('/api/orders', (req, res) => {
    // Join with clients and products to get names if needed, but for now just match app.js
    db.all('SELECT * FROM orders ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // app.js expects client (name) and productId. 
        // We'll need to fetch client names if we store by client_id.
        // For simplicity and matching current app logic, let's keep name mapping.
        res.json(rows.map(r => ({
            id: r.id,
            clientId: r.client_id,
            productId: r.product_id,
            quantity: r.quantity,
            total: r.total,
            date: r.date,
            status: r.status,
            paymentStatus: r.payment_status,
            paymentMethod: r.payment_method,
            paymentRef: r.payment_ref,
            paymentDate: r.payment_date
        })));
    });
});

app.post('/api/orders', (req, res) => {
    const { clientId, productId, quantity, total, date, status, paymentStatus } = req.body;
    db.run('INSERT INTO orders (client_id, product_id, quantity, total, date, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [clientId, productId, quantity, total, date, status || 'Pending', paymentStatus || 'Unpaid'], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

app.put('/api/orders/:id', (req, res) => {
    const { status, paymentStatus, paymentMethod, paymentRef, paymentDate } = req.body;

    // Dynamically build update query
    let fields = [];
    let params = [];
    if (status) { fields.push("status = ?"); params.push(status); }
    if (paymentStatus) { fields.push("payment_status = ?"); params.push(paymentStatus); }
    if (paymentMethod) { fields.push("payment_method = ?"); params.push(paymentMethod); }
    if (paymentRef) { fields.push("payment_ref = ?"); params.push(paymentRef); }
    if (paymentDate) { fields.push("payment_date = ?"); params.push(paymentDate); }

    if (fields.length === 0) return res.json({ message: 'No fields to update' });

    params.push(req.params.id);
    const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`;

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order updated' });
    });
});

// Verify Payment and Record in Ledger
app.post('/api/orders/:id/verify', (req, res) => {
    const { id } = req.params;
    const { paymentMethod, paymentRef, paymentDate } = req.body;

    db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        db.serialize(() => {
            // 1. Update order payment status
            db.run('UPDATE orders SET payment_status = "Paid", payment_method = ?, payment_ref = ?, payment_date = ? WHERE id = ?',
                [paymentMethod, paymentRef, paymentDate, id]);

            // 2. Fetch product and client for description
            db.get('SELECT name FROM products WHERE id = ?', [order.product_id], (err, product) => {
                db.get('SELECT name FROM clients WHERE id = ?', [order.client_id], (err, client) => {
                    const desc = `Payment received for Order #${id} - ${client ? client.name : 'Unknown Client'} (${product ? product.name : 'Unknown Product'}) [${paymentMethod}: ${paymentRef}]`;

                    // 3. Record in Ledger
                    db.run('INSERT INTO ledger_transactions (type, category, amount, description, date, order_id) VALUES (?, ?, ?, ?, ?, ?)',
                        ['income', 'Order Payment', order.total, desc, paymentDate, id], function (err) {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ success: true, message: 'Payment verified and profit recorded.' });
                        });
                });
            });
        });
    });
});

app.delete('/api/orders/:id', (req, res) => {
    db.run('DELETE FROM orders WHERE id = ?', req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Washing Endpoints ---

app.get('/api/washing', (req, res) => {
    db.all('SELECT * FROM washing_batches ORDER BY sent_date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({
            id: r.id,
            productId: r.product_id,
            quantity: r.quantity,
            sentDate: r.sent_date,
            status: r.status
        })));
    });
});

app.post('/api/washing', (req, res) => {
    const { productId, quantity, sentDate, status } = req.body;
    db.run('INSERT INTO washing_batches (product_id, quantity, sent_date, status) VALUES (?, ?, ?, ?)',
        [productId, quantity, sentDate, status || 'In Washing'], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

app.put('/api/washing/:id', (req, res) => {
    const { status } = req.body;
    db.run('UPDATE washing_batches SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Washing status updated' });
    });
});

app.delete('/api/washing/:id', (req, res) => {
    db.run('DELETE FROM washing_batches WHERE id = ?', req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Ledger Endpoints ---

app.get('/api/ledger', (req, res) => {
    db.all('SELECT * FROM ledger_transactions ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/ledger', (req, res) => {
    const { type, category, amount, description, date } = req.body;
    db.run('INSERT INTO ledger_transactions (type, category, amount, description, date) VALUES (?, ?, ?, ?, ?)',
        [type, category, amount, description, date], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

app.delete('/api/ledger/:id', (req, res) => {
    db.run('DELETE FROM ledger_transactions WHERE id = ?', req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Spy Garments Backend running on http://localhost:${PORT}`);
});
