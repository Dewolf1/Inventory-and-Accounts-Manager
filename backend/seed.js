const db = require('./db');

const seedData = () => {
    db.serialize(() => {
        // 1. Seed Products
        const products = [
            ['Blue Distressed Slim', 'DS-001', 'Slim Fit', 'Slim', 'Distressed Light', '28,30,32,34', 45, 650, 1200],
            ['Jet Black Skinny', 'SK-002', 'Skinny Fit', 'Skinny', 'Jet Black', '30,32,34,36', 120, 700, 1500],
            ['Vintage Regular Denim', 'RG-003', 'Regular Fit', 'Regular', 'Vintage Stone', '32,34,36,38', 80, 550, 1100],
            ['Acid Wash Tapered', 'TP-004', 'Tapered Fit', 'Tapered', 'Acid Wash', '28,30,32', 30, 800, 1650],
            ['Raw Indigo Straight', 'ST-005', 'Straight Fit', 'Straight', 'Raw Indigo', '34,36,38,40', 60, 900, 1800]
        ];

        const productStmt = db.prepare(`INSERT INTO products (name, sku, category, fit, wash, sizes, stock, cost_price, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        products.forEach(p => productStmt.run(p));
        productStmt.finalize();

        // 2. Seed Clients
        const clients = [
            ['Aman Garments', '9876543210', 'aman@example.com', 'Gandhi Nagar, Delhi'],
            ['Style Hub', '8765432109', 'info@stylehub.com', 'Linking Road, Mumbai'],
            ['Denim World', '7654321098', 'contact@denimworld.in', 'Commercial Street, Bangalore'],
            ['Quality Traders', '6543210987', 'qt@gmail.com', 'Burrabazar, Kolkata'],
            ['Urban Fit', '5432109876', 'urbanfit@outlook.com', 'Mount Road, Chennai']
        ];

        const clientStmt = db.prepare(`INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)`);
        clients.forEach(c => clientStmt.run(c));
        clientStmt.finalize();

        // 3. Seed Orders (Assuming IDs 1-5 for products and clients)
        const orders = [
            [1, 1, 10, 12000, '2024-02-01', 'Completed'],
            [2, 2, 25, 37500, '2024-02-02', 'Pending'],
            [3, 3, 5, 5500, '2024-02-03', 'Completed'],
            [4, 4, 15, 24750, '2024-02-04', 'Completed'],
            [5, 5, 8, 14400, '2024-02-04', 'Pending']
        ];

        const orderStmt = db.prepare(`INSERT INTO orders (client_id, product_id, quantity, total, date, status) VALUES (?, ?, ?, ?, ?, ?)`);
        orders.forEach(o => orderStmt.run(o));
        orderStmt.finalize();

        // 4. Seed Washing Batches
        const washing = [
            [1, 20, '2024-02-01', 'Delivered'],
            [2, 50, '2024-02-02', 'In Washing'],
            [3, 15, '2024-02-03', 'In Washing'],
            [4, 10, '2024-02-03', 'Delivered'],
            [5, 25, '2024-02-04', 'In Washing']
        ];

        const washingStmt = db.prepare(`INSERT INTO washing_batches (product_id, quantity, sent_date, status) VALUES (?, ?, ?, ?)`);
        washing.forEach(w => washingStmt.run(w));
        washingStmt.finalize();

        // 5. Seed Ledger Transactions
        const ledger = [
            ['income', 'Order Payment', 12000, 'Payment for Order #1', '2024-02-01'],
            ['expense', 'Raw Materials', 50000, 'Purchase of denim rolls', '2024-02-02'],
            ['income', 'Order Payment', 5500, 'Payment for Order #3', '2024-02-03'],
            ['expense', 'Washing Charges', 3000, 'Batch #1 washing cost', '2024-02-03'],
            ['wastage', 'Damaged', 2400, '2 bundles of DS-001 found defective', '2024-02-04']
        ];

        const ledgerStmt = db.prepare(`INSERT INTO ledger_transactions (type, category, amount, description, date) VALUES (?, ?, ?, ?, ?)`);
        ledger.forEach(l => ledgerStmt.run(l));
        ledgerStmt.finalize();

        console.log('Database seeded with pseudo data successfully.');
    });
};

seedData();
