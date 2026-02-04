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

        // Washing Batches Table
        db.run(`CREATE TABLE IF NOT EXISTS washing_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            quantity INTEGER NOT NULL,
            sent_date TEXT NOT NULL,
            status TEXT DEFAULT 'In Washing',
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`);

        // Ledger Transactions Table
        db.run(`CREATE TABLE IF NOT EXISTS ledger_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- income, expense, wastage
            category TEXT,
            amount REAL NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            order_id INTEGER, -- Optional link to orders
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )`);

        console.log('Database tables initialized.');
    });
}

module.exports = db;
