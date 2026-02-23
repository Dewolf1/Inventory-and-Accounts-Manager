const http = require('http');

function post(url, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

async function verifyFix() {
    const API_URL = 'http://localhost:3000/api';

    try {
        console.log('1. Fetching first order...');
        const orders = await get(`${API_URL}/orders`);

        if (orders.length === 0) {
            console.log('No orders found to test with.');
            return;
        }

        const order = orders[0];
        console.log(`Testing with Order #${order.id} for Client ID: ${order.clientId}`);

        console.log('2. Verifying payment for the order...');
        const verifyResult = await post(`${API_URL}/orders/${order.id}/verify`, {
            paymentMethod: 'Test Verification',
            paymentRef: 'REF-' + Date.now(),
            paymentDate: new Date().toISOString().split('T')[0]
        });

        console.log('Verification result:', verifyResult);

        console.log('3. Checking ledger for the new transaction...');
        const ledger = await get(`${API_URL}/ledger`);

        // Find the transaction we just created
        const latestTx = ledger.find(tx => tx.order_id == order.id);
        console.log('Found Ledger Transaction:', latestTx);

        if (latestTx && latestTx.client_id == order.clientId) {
            console.log('SUCCESS: client_id is correctly recorded in the ledger!');
        } else {
            console.log('FAILURE: client_id mismatch or missing in the ledger.', latestTx);
            process.exit(1);
        }

    } catch (e) {
        console.error('Verification failed:', e);
        process.exit(1);
    }
}

verifyFix();
