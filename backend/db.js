const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'spy_garments.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the Spy Garments SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            category TEXT,
            fit TEXT,
            wash TEXT,
            sizes TEXT,
            stock INTEGER DEFAULT 0,
            cost_price REAL DEFAULT 0.0,
            price REAL DEFAULT 0.0
        )`);

        // Clients Table
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT
        )`);

        // Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            total REAL NOT NULL,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            payment_status TEXT DEFAULT 'Unpaid', -- Unpaid, Paid
            payment_method TEXT, -- Cash, Online
            payment_ref TEXT, -- Reference ID or notes
            payment_date TEXT,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        // Cloth Wholesalers Table
        db.run(`CREATE TABLE IF NOT EXISTS cloth_wholesalers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT
        )`);

        // Cloth Inventory Table
        db.run(`CREATE TABLE IF NOT EXISTS cloth_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wholesaler_id INTEGER,
            cloth_type TEXT NOT NULL,
            quantity REAL NOT NULL, -- in meters or pieces depending on unit
            unit TEXT DEFAULT 'meters',
            price_per_unit REAL NOT NULL,
            total_cost REAL NOT NULL,
            date_received TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (wholesaler_id) REFERENCES cloth_wholesalers(id)
        )`);

        // Manufacturing Lots Table
        db.run(`CREATE TABLE IF NOT EXISTS manufacturing_lots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_number TEXT UNIQUE NOT NULL,
            cloth_inventory_id INTEGER,
            current_step TEXT DEFAULT 'Cutting', -- Cutting, Stitching, Kaj, Washing, Packing, Completed
            status TEXT DEFAULT 'Active', -- Active, Completed, Cancelled
            initial_pieces INTEGER NOT NULL,
            current_pieces INTEGER NOT NULL,
            total_wastage INTEGER DEFAULT 0,
            unit_cost REAL,
            created_at TEXT NOT NULL,
            finished_at TEXT,
            FOREIGN KEY (cloth_inventory_id) REFERENCES cloth_inventory(id)
        )`);

        // Manufacturing History/Steps Table
        db.run(`CREATE TABLE IF NOT EXISTS manufacturing_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_id INTEGER,
            step_name TEXT NOT NULL,
            wastage INTEGER DEFAULT 0,
            comments TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (lot_id) REFERENCES manufacturing_lots(id)
        )`);

        // Ledger Transactions Table
        db.run(`CREATE TABLE IF NOT EXISTS ledger_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- income, expense (payment to wholesaler), wastage
            category TEXT,
            amount REAL NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            order_id INTEGER, -- Optional link to orders
            wholesaler_id INTEGER, -- Optional link to wholesaler payments
            lot_id INTEGER, -- Optional link to manufacturing wastage
            client_id INTEGER, -- Optional link to client payments
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (wholesaler_id) REFERENCES cloth_wholesalers(id),
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (lot_id) REFERENCES manufacturing_lots(id)
        )`);

        // Legacy Washing Batches Table (Keeping for compatibility for now)
        db.run(`CREATE TABLE IF NOT EXISTS washing_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            sent_date TEXT NOT NULL,
            status TEXT DEFAULT 'In Washing',
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        console.log('Database tables initialized.');
    });
}

module.exports = { db, initializeDatabase };
