const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'spy_garments.db');
const db = new sqlite3.Database(dbPath);

console.log("Seeding Database...");

db.serialize(() => {
    // 1. Wholesalers
    const wholesalers = [
        ['Raymond Mills', '919876543210', 'sales@raymond.com', 'Mumbai'],
        ['Arvind Denim', '919876543211', 'denim@arvind.com', 'Ahmedabad'],
        ['Siyaram Fabrics', '919876543212', 'info@siyaram.com', 'Surat']
    ];
    const stmtW = db.prepare('INSERT INTO cloth_wholesalers (name, phone, email, address) VALUES (?, ?, ?, ?)');
    wholesalers.forEach(w => stmtW.run(w));
    stmtW.finalize();

    // 2. Clients
    const clients = [
        ['Zara Retail', '919876543215', 'zara@retail.com', 'Delhi'],
        ['H&M India', '919876543216', 'hm@india.com', 'Bangalore'],
        ['Local Boutique', '919876543217', 'local@boutique.com', 'Pune'],
        ['V-Mart', '919876543218', 'sales@vmart.com', 'Kolkata']
    ];
    const stmtC = db.prepare('INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)');
    clients.forEach(c => stmtC.run(c));
    stmtC.finalize();

    // 3. Products
    const products = [
        ['Spy Premium Denim', 'SPY-001', 'Regular Fit', 'Dark Wash', 'S, M, L, XL', 1500, 800.50, 1599.99],
        ['Spy Slim Fit', 'SPY-002', 'Slim Fit', 'Light Wash', 'M, L, XL', 850, 750.00, 1499.99],
        ['Spy Urban Stretch', 'SPY-003', 'Skinny Fit', 'Black', 'S, M, L', 200, 850.25, 1799.99],
        ['Spy Cargo Denim', 'SPY-004', 'Relaxed Fit', 'Grey', 'L, XL, XXL', 450, 900.00, 1899.99]
    ];
    const stmtP = db.prepare('INSERT INTO products (name, sku, category, fit, wash, sizes, stock, cost_price, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    products.forEach(p => stmtP.run(p));
    stmtP.finalize();

    // 4. Cloth Inventory
    const inventory = [
        [1, 'Premium Denim 12oz', 5000, 'meters', 150, 750000, '2023-10-01', 'Good quality'],
        [2, 'Stretch Denim 10oz', 3000, 'meters', 180, 540000, '2023-10-15', 'High stretch']
    ];
    const stmtI = db.prepare('INSERT INTO cloth_inventory (wholesaler_id, cloth_type, quantity, unit, price_per_unit, total_cost, date_received, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    inventory.forEach(i => stmtI.run(i));
    stmtI.finalize();

    // 5. Manufacturing Lots
    const lots = [
        ['LOT-2023-01', 1, 'Completed', 'Completed', 2000, 1950, 50, 380.00, '2023-10-05', '2023-10-20'],
        ['LOT-2023-02', 2, 'Stitching', 'Active', 1000, 980, 20, 210.00, '2023-10-18', null]
    ];
    const stmtL = db.prepare('INSERT INTO manufacturing_lots (lot_number, cloth_inventory_id, current_step, status, initial_pieces, current_pieces, total_wastage, unit_cost, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    lots.forEach(l => stmtL.run(l));
    stmtL.finalize();

    // 6. Orders
    const orders = [
        [1, 1, 500, 799995.00, '2023-10-25', 'Completed', 'Paid', 'Online', 'TXN-101', '2023-10-26'],
        [2, 2, 200, 299998.00, '2023-10-28', 'Pending', 'Unpaid', null, null, null],
        [3, 3, 100, 179999.00, '2023-11-01', 'Pending', 'Paid', 'Cash', 'RCPT-001', '2023-11-01'],
        [1, 4, 150, 284998.50, '2023-11-05', 'Pending', 'Unpaid', null, null, null]
    ];
    const stmtO = db.prepare('INSERT INTO orders (client_id, product_id, quantity, total, date, status, payment_status, payment_method, payment_ref, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    orders.forEach(o => stmtO.run(o));
    stmtO.finalize();

    // 7. Ledger Transactions
    const ledger = [
        ['expense', 'Cloth Purchase', 750000, 'Payment to Raymond Mills', '2023-10-01', null, 1, null, null],
        ['expense', 'Cloth Purchase', 540000, 'Payment to Arvind Denim', '2023-10-15', null, 2, null, null],
        ['income', 'Order Payment', 799995.00, 'Payment for Order #1', '2023-10-26', 1, null, null, 1],
        ['income', 'Order Payment', 179999.00, 'Payment for Order #3', '2023-11-01', 3, null, null, 3],
        ['income', 'Client Payment', 50000.00, 'Partial payment from Zara', '2023-11-06', null, null, null, 1] // Partial payment on unpaid order
    ];
    const stmtLedger = db.prepare('INSERT INTO ledger_transactions (type, category, amount, description, date, order_id, wholesaler_id, lot_id, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    ledger.forEach(l => stmtLedger.run(l));
    stmtLedger.finalize();

    console.log("Database Seeded Successfully.");
});
