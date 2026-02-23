const { db, initializeDatabase } = require('./db');

const seedData = async () => {
    console.log('Starting comprehensive data seeding...');
    initializeDatabase();

    const helper = {
        randomItem: (arr) => arr[Math.floor(Math.random() * arr.length)],
        randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        randomDate: (start, end) => {
            const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
            return date.toISOString();
        },
        randomShortDate: (start, end) => {
            const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
            return date.toISOString().split('T')[0];
        }
    };

    const startDate = new Date('2024-10-01');
    const endDate = new Date();

    db.serialize(() => {
        // Clear existing data
        const tables = ['ledger_transactions', 'manufacturing_history', 'manufacturing_lots', 'cloth_inventory', 'cloth_wholesalers', 'orders', 'clients', 'products', 'washing_batches'];
        tables.forEach(table => db.run(`DELETE FROM ${table}`));
        db.run('DELETE FROM sqlite_sequence'); // Reset IDs
        console.log('Existing data cleared.');

        // 1. Seed Wholesalers (10)
        const wholesalerNames = ['Arvind Mills', 'Raymond Luxury', 'Vardhman Textiles', 'Siyaram Soft', 'JSW Denim', 'Grasim Industries', 'Mafatlal Group', 'Nahar Spinning', 'Alok Industries', 'Sutlej Textiles'];
        const whStmt = db.prepare(`INSERT INTO cloth_wholesalers (name, phone, email, address) VALUES (?, ?, ?, ?)`);
        wholesalerNames.forEach(name => {
            whStmt.run(name, `98${helper.randomInt(10, 99)}456${helper.randomInt(10, 99)}`, `contact@${name.toLowerCase().replace(/ /g, '')}.com`, `${helper.randomInt(10, 999)}, Industrial Area, ${helper.randomItem(['Ahmedabad', 'Mumbai', 'Surat', 'Ludhiana'])}`);
        });
        whStmt.finalize();

        // 2. Seed Clients (15)
        const clientNames = ['Aman Garments', 'Style Hub', 'Urban Trends', 'Classic Wears', 'Fashion Point', 'Vogue Emporium', 'Metro Fashion', 'Royal Jeans', 'The Denim Co', 'Global Garments', 'Trendy Boutique', 'Mega Mart', 'Smart Choice', 'Elite Apparels', 'Signature Style'];
        const clientStmt = db.prepare(`INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)`);
        clientNames.forEach(name => {
            clientStmt.run(name, `8800${helper.randomInt(10, 99)}11${helper.randomInt(10, 99)}`, `${name.toLowerCase().replace(/ /g, '')}@example.com`, `${helper.randomInt(1, 100)}, Market Street, ${helper.randomItem(['Delhi', 'Bangalore', 'Chennai', 'Pune'])}`);
        });
        clientStmt.finalize();

        // 3. Seed Cloth Inventory (30)
        const clothTypes = ['Heavy Denim 14oz', 'Super Stretch Black', 'Light Blue Denim', 'Raw Selvedge', 'Grey Twill', 'Khaki Cotton', 'Indigo Knit', 'White Canvas', 'Distressed Wash Denim', 'Lycra Blend Denim'];
        const clothStmt = db.prepare(`INSERT INTO cloth_inventory (wholesaler_id, cloth_type, quantity, unit, price_per_unit, total_cost, date_received) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (let i = 0; i < 30; i++) {
            const qty = helper.randomInt(100, 500);
            const rate = helper.randomInt(150, 400);
            const date = helper.randomShortDate(startDate, endDate);
            clothStmt.run(helper.randomInt(1, 10), helper.randomItem(clothTypes), qty, 'meters', rate, qty * rate, date);
        }
        clothStmt.finalize();

        // 4. Seed Products (25)
        const fits = ['Slim Fit', 'Skinny Fit', 'Regular Fit', 'Straight Fit', 'Relaxed Fit'];
        const washes = ['Light Wash', 'Medium Indigo', 'Dark Indigo', 'Jet Black', 'Acid Wash', 'Raw Selvedge', 'Stone Wash'];
        const productStmt = db.prepare(`INSERT INTO products (name, sku, category, fit, wash, sizes, stock, cost_price, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (let i = 1; i <= 25; i++) {
            const fit = helper.randomItem(fits);
            const wash = helper.randomItem(waswashes = washes);
            const cp = helper.randomInt(500, 800);
            productStmt.run(`Article ${100 + i}`, `ART-${1000 + i}`, fit, fit.split(' ')[0], wash, '28,30,32,34,36', helper.randomInt(50, 200), cp, cp + helper.randomInt(400, 1000));
        }
        productStmt.finalize();

        // 5. Seed Manufacturing Lots & History (40)
        const steps = ['Cutting', 'Stitching', 'Kaj', 'Washing', 'Packing', 'Completed'];
        const lotStmt = db.prepare(`INSERT INTO manufacturing_lots (lot_number, cloth_inventory_id, initial_pieces, current_pieces, total_wastage, current_step, status, unit_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const histStmt = db.prepare(`INSERT INTO manufacturing_history (lot_id, step_name, wastage, comments, timestamp) VALUES (?, ?, ?, ?, ?)`);

        for (let i = 1; i <= 40; i++) {
            const initial = helper.randomInt(200, 600);
            const wastage = helper.randomInt(0, 15);
            const current = initial - wastage;
            const step = i > 30 ? 'Completed' : helper.randomItem(steps);
            const status = step === 'Completed' ? 'Completed' : 'Active';
            const date = helper.randomDate(startDate, endDate);

            lotStmt.run(`LOT-G-${2000 + i}`, helper.randomInt(1, 30), initial, current, wastage, step, status, helper.randomInt(140, 180), date);

            // Add some history for each lot
            const stepIdx = steps.indexOf(step);
            for (let j = 0; j <= (stepIdx === -1 ? 0 : stepIdx); j++) {
                histStmt.run(i, steps[j], j === stepIdx ? wastage : 0, `Processed ${steps[j]}`, date);
            }
        }
        lotStmt.finalize();
        histStmt.finalize();

        // 6. Seed Orders (80)
        const orderStmt = db.prepare(`INSERT INTO orders (client_id, product_id, quantity, total, date, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (let i = 1; i <= 80; i++) {
            const qty = helper.randomInt(20, 100);
            const price = helper.randomInt(1200, 1800);
            const date = helper.randomShortDate(startDate, endDate);
            const isPaid = Math.random() > 0.3;
            orderStmt.run(helper.randomInt(1, 15), helper.randomInt(1, 25), qty, qty * price, date, isPaid ? 'Completed' : 'Pending', isPaid ? 'Paid' : 'Unpaid');
        }
        orderStmt.finalize();

        // 7. Seed Ledger Transactions (150)
        // Expenses for Cloth, Labor, Rent, etc.
        // Incomes for Order Payments
        const ledgerStmt = db.prepare(`INSERT INTO ledger_transactions (type, category, amount, description, date, wholesaler_id, client_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);

        // Income from orders (Some recorded as payments)
        db.all('SELECT id, client_id, total, date, payment_status FROM orders', [], (err, rows) => {
            rows.forEach(order => {
                if (order.payment_status === 'Paid') {
                    ledgerStmt.run('income', 'Order Payment', order.total, `Payment for Order #${order.id}`, order.date, null, order.client_id);
                } else if (Math.random() > 0.5) {
                    // Part payment for some unpaid orders
                    const part = order.total * 0.5;
                    ledgerStmt.run('income', 'Order Payment', part, `Part payment for Order #${order.id}`, order.date, null, order.client_id);
                }
            });

            // Random extra expenses
            const expenseCategories = ['Labor Cost', 'Electricity', 'Rent', 'Maintenance', 'Transportation', 'Packaging'];
            for (let i = 0; i < 50; i++) {
                const amount = helper.randomInt(1000, 15000);
                const date = helper.randomShortDate(startDate, endDate);
                ledgerStmt.run('expense', helper.randomItem(expenseCategories), amount, `Monthly ${helper.randomItem(expenseCategories)}`, date, null, null);
            }

            // Wholesaler payments
            db.all('SELECT id, total_cost, date_received, wholesaler_id FROM cloth_inventory', [], (err, cinv) => {
                cinv.forEach(item => {
                    const isPaid = Math.random() > 0.2;
                    if (isPaid) {
                        ledgerStmt.run('expense', 'Cloth Purchase Payment', item.total_cost, `Payment for material receipt #${item.id}`, item.date_received, item.wholesaler_id, null);
                    }
                });
                ledgerStmt.finalize();
                console.log('Database seeded successfully with 400+ varied records!');
            });
        });
    });
};

seedData();
