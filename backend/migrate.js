const db = require('./db');

const migrate = () => {
    db.serialize(() => {
        // Add columns to orders
        db.run("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Unpaid'", (err) => {
            if (err) console.log('payment_status column might already exist.');
        });
        db.run("ALTER TABLE orders ADD COLUMN payment_method TEXT", (err) => {
            if (err) console.log('payment_method column might already exist.');
        });
        db.run("ALTER TABLE orders ADD COLUMN payment_ref TEXT", (err) => {
            if (err) console.log('payment_ref column might already exist.');
        });
        db.run("ALTER TABLE orders ADD COLUMN payment_date TEXT", (err) => {
            if (err) console.log('payment_date column might already exist.');
        });

        // Add order_id to ledger_transactions
        db.run("ALTER TABLE ledger_transactions ADD COLUMN order_id INTEGER", (err) => {
            if (err) console.log('order_id column might already exist.');
        });

        console.log('Database migration complete.');
    });
};

migrate();
