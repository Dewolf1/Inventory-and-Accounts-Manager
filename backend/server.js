const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { db } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../')));

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
                    db.run('INSERT INTO ledger_transactions (type, category, amount, description, date, order_id, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        ['income', 'Order Payment', order.total, desc, paymentDate, id, order.client_id], function (err) {
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

// --- Wholesalers Endpoints ---

app.get('/api/wholesalers', (req, res) => {
    db.all('SELECT * FROM cloth_wholesalers ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/wholesalers', (req, res) => {
    const { name, phone, email, address } = req.body;
    db.run('INSERT INTO cloth_wholesalers (name, phone, email, address) VALUES (?, ?, ?, ?)',
        [name, phone, email, address], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

app.put('/api/wholesalers/:id', (req, res) => {
    const { name, phone, email, address } = req.body;
    db.run('UPDATE cloth_wholesalers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
        [name, phone, email, address, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Wholesaler updated' });
        });
});

app.delete('/api/wholesalers/:id', (req, res) => {
    db.run('DELETE FROM cloth_wholesalers WHERE id = ?', req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// wholesaler payment endpoint
app.post('/api/wholesalers/:id/pay', (req, res) => {
    const { id } = req.params;
    const { amount, date, description } = req.body;
    db.run('INSERT INTO ledger_transactions (type, category, amount, description, date, wholesaler_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['expense', 'Cloth Purchase Payment', amount, description, date, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// --- Cloth Inventory Endpoints ---

app.get('/api/cloth-inventory', (req, res) => {
    db.all(`SELECT ci.*, cw.name as wholesaler_name 
            FROM cloth_inventory ci 
            LEFT JOIN cloth_wholesalers cw ON ci.wholesaler_id = cw.id 
            ORDER BY ci.date_received DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/cloth-inventory', (req, res) => {
    const { wholesaler_id, cloth_type, quantity, unit, price_per_unit, total_cost, date_received, notes } = req.body;
    db.run(`INSERT INTO cloth_inventory (wholesaler_id, cloth_type, quantity, unit, price_per_unit, total_cost, date_received, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [wholesaler_id, cloth_type, quantity, unit, price_per_unit, total_cost, date_received, notes], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, ...req.body });
        });
});

// --- Manufacturing Endpoints ---

app.get('/api/manufacturing', (req, res) => {
    db.all('SELECT * FROM manufacturing_lots ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/manufacturing', (req, res) => {
    const { lot_number, cloth_inventory_id, initial_pieces, unit_cost, created_at } = req.body;
    db.run(`INSERT INTO manufacturing_lots (lot_number, cloth_inventory_id, initial_pieces, current_pieces, unit_cost, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        [lot_number, cloth_inventory_id, initial_pieces, initial_pieces, unit_cost, created_at], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const lotId = this.lastID;
            // Record initial step
            db.run('INSERT INTO manufacturing_history (lot_id, step_name, wastage, comments, timestamp) VALUES (?, ?, ?, ?, ?)',
                [lotId, 'Initialization', 0, 'Lot created', created_at], () => {
                    res.json({ id: lotId, ...req.body });
                });
        });
});

app.get('/api/manufacturing/:id/history', (req, res) => {
    db.all('SELECT * FROM manufacturing_history WHERE lot_id = ? ORDER BY timestamp ASC', [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Transition to next step
app.post('/api/manufacturing/:id/next-step', (req, res) => {
    const { id } = req.params;
    const { next_step, wastage, comments, timestamp } = req.body;

    db.get('SELECT * FROM manufacturing_lots WHERE id = ?', [id], (err, lot) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        const newPieces = lot.current_pieces - (parseInt(wastage) || 0);
        const newTotalWastage = lot.total_wastage + (parseInt(wastage) || 0);

        db.serialize(() => {
            // Update lot
            db.run('UPDATE manufacturing_lots SET current_step = ?, current_pieces = ?, total_wastage = ? WHERE id = ?',
                [next_step, newPieces, newTotalWastage, id]);

            // Record history
            db.run('INSERT INTO manufacturing_history (lot_id, step_name, wastage, comments, timestamp) VALUES (?, ?, ?, ?, ?)',
                [id, next_step, wastage, comments, timestamp]);

            // Record wastage in ledger if any
            if (wastage > 0) {
                const wastageCost = wastage * lot.unit_cost;
                db.run('INSERT INTO ledger_transactions (type, category, amount, description, date, lot_id) VALUES (?, ?, ?, ?, ?, ?)',
                    ['wastage', 'Manufacturing Wastage', wastageCost, `Wastage at step ${next_step} for Lot ${lot.lot_number} (${wastage} pieces)`, timestamp, id]);
            }

            res.json({ success: true, current_pieces: newPieces });
        });
    });
});

// Finish Lot and move to Inventory
app.post('/api/manufacturing/:id/finish', (req, res) => {
    const { id } = req.params;
    const { product_details, timestamp } = req.body; // { name, sku, category, fit, wash, sizes, price }

    db.get('SELECT * FROM manufacturing_lots WHERE id = ?', [id], (err, lot) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!lot) return res.status(404).json({ error: 'Lot not found' });

        db.serialize(() => {
            // 1. Mark lot as completed
            db.run('UPDATE manufacturing_lots SET status = "Completed", current_step = "Completed", finished_at = ? WHERE id = ?', [timestamp, id]);

            // 2. Add to products inventory
            const { name, sku, category, fit, wash, sizes, price } = product_details;
            // Unit cost and stock come from the lot
            db.run(`INSERT INTO products (name, sku, category, fit, wash, sizes, stock, cost_price, price) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, sku, category, fit, wash, sizes, lot.current_pieces, lot.unit_cost, price], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, productId: this.lastID });
                });
        });
    });
});

app.delete('/api/manufacturing/:id', (req, res) => {
    db.run('DELETE FROM manufacturing_lots WHERE id = ?', req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('DELETE FROM manufacturing_history WHERE lot_id = ?', req.params.id, () => {
            res.json({ success: true });
        });
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
    const { type, category, amount, description, date, clientId, wholesalerId } = req.body;
    db.run('INSERT INTO ledger_transactions (type, category, amount, description, date, client_id, wholesaler_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [type, category, amount, description, date, clientId || null, wholesalerId || null], function (err) {
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

// --- System Reset Endpoint ---
app.delete('/api/reset', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM products');
        db.run('DELETE FROM orders');
        db.run('DELETE FROM clients');
        db.run('DELETE FROM ledger_transactions');
        db.run('DELETE FROM manufacturing_lots');
        db.run('DELETE FROM manufacturing_history');
        db.run('DELETE FROM washing_batches');
        db.run('DELETE FROM cloth_inventory');
        db.run('DELETE FROM cloth_wholesalers', (err) => {
            if (err) console.error('Reset error:', err);
            res.json({ success: true, message: 'System data reset' });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Spy Garments Backend running on http://localhost:${PORT}`);
});
