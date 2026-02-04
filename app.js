/**
 * Spy Garments Wholesale System
 * Premium Logic Controller
 */

const app = {
    API_URL: 'http://localhost:3000/api',
    data: {
        products: [],
        orders: [],
        washingBatches: [],
        ledgerTransactions: [],
        clients: [],
        categories: ['Regular Fit', 'Slim Fit', 'Straight Fit', 'Skinny Fit', 'Relaxed Fit', 'Tapered Fit']
    },

    currentView: 'dashboard',
    chartInstance: null,
    categoryChartInstance: null,
    orderChartInstance: null,
    isAuthenticated: false,
    currentSlideIndex: 0,
    chartTitles: ['Category Distribution', 'Order Completion'],

    // Sequential IDs are now handled by the database

    // Initialize the Application
    async init() {
        // Loading Screen Animation
        setTimeout(() => {
            const loader = document.getElementById('loading-screen');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.classList.add('hidden');
                    this.checkAuth();
                }, 500);
            }
        }, 1500);

        // Fetch Data from Backend
        await this.loadAllData();
    },

    async loadAllData() {
        try {
            const [products, orders, washing, ledger, clients] = await Promise.all([
                fetch(`${this.API_URL}/products`).then(r => r.json()),
                fetch(`${this.API_URL}/orders`).then(r => r.json()),
                fetch(`${this.API_URL}/washing`).then(r => r.json()),
                fetch(`${this.API_URL}/ledger`).then(r => r.json()),
                fetch(`${this.API_URL}/clients`).then(r => r.json())
            ]);

            this.data.products = products;
            this.data.orders = orders;
            this.data.washingBatches = washing;
            this.data.ledgerTransactions = ledger;
            this.data.clients = clients;

            this.updateUI();
        } catch (e) {
            console.error('Error loading data from backend:', e);
        }
    },

    checkAuth() {
        const session = localStorage.getItem('spy_auth_token');
        if (session) {
            this.isAuthenticated = true;
            this.showApp();
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.initChart(); // Initialize charts
        this.updateUI();
        this.navigate('dashboard');
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const resp = await fetch(`${this.API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (resp.ok) {
                const result = await resp.json();
                localStorage.setItem('spy_auth_token', result.token);
                this.isAuthenticated = true;

                const loginScreen = document.getElementById('login-screen');
                loginScreen.style.opacity = '0';
                loginScreen.style.transition = 'opacity 0.5s ease';

                setTimeout(() => {
                    this.showApp();
                }, 500);
            } else {
                alert('Invalid credentials.');
            }
        } catch (e) {
            alert('Server error. Please try again.');
        }
    },

    logout() {
        this.showConfirm({
            title: 'Logout',
            message: 'Log out of Admin Dashboard?',
            onConfirm: () => {
                localStorage.removeItem('spy_auth_token');
                window.location.reload();
            }
        });
    },

    // --- Data Logic ---

    // --- Data Logic (Handled by Backend) ---
    seedData() { /* Handled by DB initialization */ },
    saveData() { this.updateUI(); },
    resetData() { /* Handled by clearing DB manually if needed */ },

    // --- UI Rendering ---

    updateUI() {
        if (!this.isAuthenticated) return;
        this.renderStats();
        this.renderInventory();
        this.renderWashing();
        this.renderOrders();
        this.renderLedger();
        this.renderClients();
        this.updateChart();
        this.renderActivityLog();
        this.checkNotifications();
    },

    renderStats() {
        const totalBundles = this.data.products.reduce((acc, curr) => acc + curr.stock, 0);
        const lowStock = this.data.products.filter(p => p.stock < 20).length;
        const totalValue = this.data.products.reduce((acc, curr) => acc + (curr.stock * curr.price), 0);

        // Calculate Receivables (Total unpaid order value)
        const receivables = this.data.orders
            .filter(o => o.paymentStatus === 'Unpaid')
            .reduce((sum, o) => sum + o.total, 0);

        document.getElementById('dash-total-products').innerText = totalBundles;
        document.getElementById('dash-low-stock').innerText = lowStock;
        document.getElementById('dash-total-value').innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalValue);

        // Inject receivables if element exists or just log
        const receivablesEl = document.getElementById('dash-receivables');
        if (receivablesEl) {
            receivablesEl.innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(receivables);
        }
    },

    renderInventory(filteredData = null) {
        const tbody = document.getElementById('inventory-table-body');
        tbody.innerHTML = '';

        const items = filteredData || this.data.products;

        items.forEach(product => {
            const tr = document.createElement('tr');

            let statusClass = 'instock';
            let statusText = 'Available';

            if (product.stock === 0) {
                statusClass = 'outstock';
                statusText = 'Sold Out';
            } else if (product.stock < 20) {
                statusClass = 'lowstock';
                statusText = 'Low Stock';
            }

            tr.innerHTML = `
                <td style="font-weight: 500; color: white;">${product.name}</td>
                <td style="font-family: monospace;">${product.sku}</td>
                <td>
                    <span style="display:block; font-size:12px; color:var(--text-muted)">${product.fit}</span>
                    <span>${product.wash}</span>
                </td>
                <td>${product.category}</td>
                <td>${product.stock}</td>
                <td>₹${Number(product.price).toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn" onclick="app.editProduct('${product.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn delete" onclick="app.deleteProduct('${product.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderOrders() {
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';

        if (this.data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No active orders found.</td></tr>';
            return;
        }

        const sortedOrders = [...this.data.orders].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedOrders.forEach(order => {
            const tr = document.createElement('tr');

            const product = this.data.products.find(p => p.id == order.productId);
            const productName = product ? product.name : 'Unknown Product';

            const client = this.data.clients.find(c => c.id == order.clientId);
            const clientName = client ? client.name : 'Unknown Client';

            tr.innerHTML = `
                <td style="font-family: monospace;">#${order.id.toString().slice(-4)}</td>
                <td style="font-weight:500; color:white;">${clientName}</td>
                <td>${order.quantity} x ${productName}</td>
                <td>₹${Number(order.total).toFixed(2)}</td>
                <td>${new Date(order.date).toLocaleDateString()}</td>
                <td><span class="status-badge ${this.getOrderStatusClass(order.status)}">${order.status}</span></td>
                <td>
                    <span class="status-badge ${order.paymentStatus === 'Paid' ? 'instock' : 'outstock'}">
                        ${order.paymentStatus}
                    </span>
                </td>
                <td>
                    <button class="action-btn" onclick="app.viewInvoice('${order.id}')" title="View Invoice"><i class="ph ph-file-text"></i></button>
                    ${order.status === 'Pending' ? `<button class="action-btn" onclick="app.completeOrder('${order.id}')" title="Mark Complete"><i class="ph ph-check"></i></button>` : ''}
                    ${order.paymentStatus === 'Unpaid' ? `<button class="action-btn" style="color:#fbbf24" onclick="app.openPaymentModal('${order.id}')" title="Verify Payment"><i class="ph ph-currency-inr"></i></button>` : ''}
                    <button class="action-btn delete" onclick="app.deleteOrder('${order.id}')" title="Delete Order"><i class="ph ph-trash"></i></button>
                </td>
             `;
            tbody.appendChild(tr);
        });
    },

    renderWashing() {
        const tbody = document.getElementById('washing-table-body');
        tbody.innerHTML = '';

        if (this.data.washingBatches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No bundles in washing.</td></tr>';
            return;
        }

        const sortedWashing = [...this.data.washingBatches].sort((a, b) => new Date(b.sentDate) - new Date(a.sentDate));

        sortedWashing.forEach(batch => {
            const tr = document.createElement('tr');

            const product = this.data.products.find(p => p.id === batch.productId);
            const productName = product ? product.name : 'Unknown Product';
            const productSku = product ? product.sku : 'N/A';

            tr.innerHTML = `
                <td style="font-family: monospace;">#W${batch.id.toString().slice(-4)}</td>
                <td style="font-weight:500; color:white;">${productName}</td>
                <td style="font-family: monospace;">${productSku}</td>
                <td>${batch.quantity}</td>
                <td>${new Date(batch.sentDate).toLocaleDateString()}</td>
                <td><span class="status-badge ${batch.status === 'In Washing' ? 'lowstock' : 'instock'}">${batch.status}</span></td>
                <td>
                    ${batch.status === 'In Washing' ? `<button class="action-btn" onclick="app.markWashingDelivered('${batch.id}')" title="Mark Delivered"><i class="ph ph-check-circle"></i></button>` : ''}
                    <button class="action-btn delete" onclick="app.deleteWashingBatch('${batch.id}')"><i class="ph ph-trash"></i></button>
                </td>
             `;
            tbody.appendChild(tr);
        });
    },

    getOrderStatusClass(status) {
        if (status === 'Completed') return 'instock';
        if (status === 'Pending') return 'lowstock';
        return 'outstock';
    },

    renderLedger() {
        // Update financial summary cards
        const revenue = this.data.ledgerTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = this.data.ledgerTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const wastage = this.data.ledgerTransactions
            .filter(t => t.type === 'wastage')
            .reduce((sum, t) => sum + t.amount, 0);

        const profit = revenue - expenses - wastage;

        document.getElementById('acc-revenue').innerText = '₹' + revenue.toFixed(2);
        document.getElementById('acc-expenses').innerText = '₹' + expenses.toFixed(2);
        document.getElementById('acc-wastage').innerText = '₹' + wastage.toFixed(2);

        const profitEl = document.getElementById('acc-profit');
        profitEl.innerText = '₹' + Math.abs(profit).toFixed(2);
        profitEl.style.color = profit >= 0 ? '#4ade80' : '#ef4444';

        // Render ledger table
        const tbody = document.getElementById('ledger-table-body');
        tbody.innerHTML = '';

        if (this.data.ledgerTransactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No transactions recorded.</td></tr>';
            return;
        }

        // Sort by date (newest first)
        const sorted = [...this.data.ledgerTransactions].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        let runningBalance = 0;

        // Calculate running balance from oldest to newest
        const withBalance = [...sorted].reverse().map(txn => {
            if (txn.type === 'income') {
                runningBalance += txn.amount;
            } else {
                runningBalance -= txn.amount;
            }
            return { ...txn, balance: runningBalance };
        }).reverse();

        withBalance.forEach(txn => {
            const tr = document.createElement('tr');

            let typeClass = '';
            let typeIcon = '';
            let typeText = '';

            if (txn.type === 'income') {
                typeClass = 'instock';
                typeIcon = '↑';
                typeText = 'Income';
            } else if (txn.type === 'expense') {
                typeClass = 'lowstock';
                typeIcon = '↓';
                typeText = 'Expense';
            } else {
                typeClass = 'outstock';
                typeIcon = '✕';
                typeText = 'Wastage';
            }

            tr.innerHTML = `
                <td>${new Date(txn.date).toLocaleDateString()}</td>
                <td><span class="status-badge ${typeClass}">${typeIcon} ${typeText}</span></td>
                <td>${txn.category}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${txn.description || '-'}</td>
                <td style="color: ${txn.type === 'income' ? '#4ade80' : '#ef4444'}; font-weight: 500;">
                    ${txn.type === 'income' ? '+' : '-'}₹${txn.amount.toFixed(2)}
                </td>
                <td style="font-weight: 500; color: ${txn.balance >= 0 ? '#4ade80' : '#ef4444'};">
                    ₹${txn.balance.toFixed(2)}
                </td>
                <td>
                    <button class="action-btn delete" onclick="app.deleteLedgerEntry('${txn.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderClients() {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.data.clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No clients recorded.</td></tr>';
            return;
        }

        this.data.clients.forEach(client => {
            const clientOrders = this.data.orders.filter(o => o.clientId == client.id);
            const totalValue = clientOrders.reduce((sum, o) => sum + o.total, 0);
            const owed = clientOrders
                .filter(o => o.paymentStatus === 'Unpaid')
                .reduce((sum, o) => sum + o.total, 0);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:500; color:white;">${client.name}</td>
                <td>
                    <div>${client.phone || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted)">${client.email || '-'}</div>
                </td>
                <td style="max-width:200px; font-size:13px;">${client.address || '-'}</td>
                <td>${clientOrders.length}</td>
                <td>₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="color: ${owed > 0 ? '#ef4444' : '#4ade80'}; font-weight: 600;">₹${owed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>
                    <button class="action-btn" onclick="app.editClient('${client.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn delete" onclick="app.deleteClient('${client.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderActivityLog() {
        const list = document.getElementById('activity-list');
        const recentOrders = this.data.orders.slice(-5).reverse();

        if (recentOrders.length === 0) {
            list.innerHTML = '<li class="activity-item">No recent activity.</li>';
            return;
        }

        list.innerHTML = recentOrders.map(o => {
            const client = this.data.clients.find(c => c.id == o.clientId);
            const clientName = client ? client.name : 'Unknown Client';
            return `
                <li class="activity-item">
                    <span class="time">Order #${o.id.toString().slice(-4)}</span>
                    <span>New order from <strong>${clientName}</strong> (${o.status})</span>
                </li>
            `;
        }).join('');
    },

    handleSearch(e) {
        const term = e.target.value.toLowerCase();

        const filteredInventory = this.data.products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term)
        );
        this.renderInventory(filteredInventory);
    },

    applyCategoryFilter() {
        const cat = document.getElementById('filter-category').value;
        let filtered = this.data.products;
        if (cat) {
            filtered = filtered.filter(p => p.category === cat);
        }
        this.renderInventory(filtered);
    },

    // --- Actions ---

    openProductModal() { this.openModal('product-modal'); },
    openAddModal() {
        document.getElementById('product-form').reset();
        document.getElementById('p-id').value = '';
        document.getElementById('modal-title').innerText = 'Add New Article';
        this.openModal('product-modal');
    },

    editProduct(id) {
        const product = this.data.products.find(p => p.id == id);
        if (!product) return;

        document.getElementById('p-id').value = product.id;
        document.getElementById('p-name').value = product.name;
        document.getElementById('p-sku').value = product.sku;
        document.getElementById('p-category').value = product.category;
        document.getElementById('p-fit').value = product.fit;
        document.getElementById('p-wash').value = product.wash;
        document.getElementById('p-sizes').value = product.sizes;
        document.getElementById('p-stock').value = product.stock;
        document.getElementById('p-cost').value = product.costPrice || product.price * 0.7; // Fallback
        document.getElementById('p-price').value = product.price;

        document.getElementById('modal-title').innerText = 'Edit Article';
        this.openModal('product-modal');
    },

    async handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('p-id').value;
        const productData = {
            name: document.getElementById('p-name').value,
            sku: document.getElementById('p-sku').value,
            category: document.getElementById('p-category').value,
            fit: document.getElementById('p-fit').value,
            wash: document.getElementById('p-wash').value,
            sizes: document.getElementById('p-sizes').value,
            stock: parseInt(document.getElementById('p-stock').value),
            costPrice: parseFloat(document.getElementById('p-cost').value),
            price: parseFloat(document.getElementById('p-price').value)
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${this.API_URL}/products/${id}` : `${this.API_URL}/products`;

            const resp = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });

            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('product-modal');
            } else {
                alert('Error saving product.');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteProduct(id) {
        this.showConfirm({
            title: 'Delete Article',
            message: 'Delete this article?',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/products/${id}`, { method: 'DELETE' });
                    if (resp.ok) await this.loadAllData();
                } catch (e) {
                    // console.error('delete error:', e); // Removed debug log
                }
            }
        });
    },

    openOrderModal() {
        const select = document.getElementById('o-product-select');
        select.innerHTML = this.data.products.map(p =>
            `<option value="${p.id}" data-price="${p.price}">${p.name} (${p.sku}) - ₹${p.price}</option>`
        ).join('');

        document.getElementById('order-form').reset();

        // Populate client select if you want, but for now let's use the input
        // o-client could be a datalist for easy management
        const clientDatalist = document.createElement('datalist');
        clientDatalist.id = 'client-suggestions';
        clientDatalist.innerHTML = this.data.clients.map(c => `<option value="${c.name}">`).join('');
        document.body.appendChild(clientDatalist);
        document.getElementById('o-client').setAttribute('list', 'client-suggestions');

        this.updateOrderPricePreview();
        this.openModal('order-modal');
    },

    updateOrderPricePreview() {
        const select = document.getElementById('o-product-select');
        const price = parseFloat(select.options[select.selectedIndex].getAttribute('data-price'));
        const qty = parseInt(document.getElementById('o-quantity').value) || 0;
        document.getElementById('o-total-preview').value = '₹' + (price * qty).toFixed(2);
    },

    async handleOrderSubmit(e) {
        e.preventDefault();
        const productId = document.getElementById('o-product-select').value;
        const product = this.data.products.find(p => p.id == productId);
        const qty = parseInt(document.getElementById('o-quantity').value);

        if (product.stock < qty) {
            alert('Not enough stock! Current stock: ' + product.stock + ' bundles.');
            return;
        }

        const clientName = document.getElementById('o-client').value;
        let client = this.data.clients.find(c => c.name === clientName);

        // Auto-create client if doesn't exist? (Or just use ID if provided)
        // For matching app logic, we'll assume they exist or we use a default ID
        const clientId = client ? client.id : null;

        const orderData = {
            clientId: clientId,
            productId: productId,
            quantity: qty,
            total: qty * product.price,
            date: new Date().toISOString(),
            status: 'Pending'
        };

        try {
            // 1. Create Order
            const resp = await fetch(`${this.API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            if (resp.ok) {
                // 2. Update stock
                await fetch(`${this.API_URL}/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...product, stock: product.stock - qty })
                });

                await this.loadAllData();
                this.closeModal('order-modal');
                this.navigate('orders');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async completeOrder(id) {
        try {
            // Update order status ONLY (Profit recorded on payment verification)
            await fetch(`${this.API_URL}/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Completed' })
            });
            await this.loadAllData();
        } catch (e) {
            console.error(e);
        }
    },

    async deleteOrder(id) {
        this.showConfirm({
            title: 'Delete Order',
            message: 'Delete this order record? (Stock will NOT be returned)',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/orders/${id}`, { method: 'DELETE' });
                    if (resp.ok) await this.loadAllData();
                } catch (e) {
                    // console.error('delete error:', e); // Removed debug log
                }
            }
        });
    },

    // --- Washing Actions ---

    openWashingModal() {
        const select = document.getElementById('w-product-select');
        select.innerHTML = this.data.products.map(p =>
            `<option value="${p.id}" data-stock="${p.stock}">${p.name} (${p.sku}) - ${p.stock} bundles available</option>`
        ).join('');

        document.getElementById('washing-form').reset();
        this.openModal('washing-modal');
    },

    async handleWashingSubmit(e) {
        e.preventDefault();
        const productId = document.getElementById('w-product-select').value;
        const product = this.data.products.find(p => p.id == productId);
        const qty = parseInt(document.getElementById('w-quantity').value);

        if (product.stock < qty) {
            alert('Not enough stock! Current stock: ' + product.stock + ' bundles.');
            return;
        }

        try {
            // 1. Create washing batch
            await fetch(`${this.API_URL}/washing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productId,
                    quantity: qty,
                    sentDate: new Date().toISOString(),
                    status: 'In Washing'
                })
            });

            // 2. Deduct from inventory
            await fetch(`${this.API_URL}/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...product, stock: product.stock - qty })
            });

            await this.loadAllData();
            this.closeModal('washing-modal');
            this.navigate('washing');
        } catch (e) {
            console.error(e);
        }
    },

    async markWashingDelivered(id) {
        const batch = this.data.washingBatches.find(b => b.id == id);
        if (!batch) return;

        try {
            // 1. Add back to inventory
            const product = this.data.products.find(p => p.id == batch.productId);
            if (product) {
                await fetch(`${this.API_URL}/products/${product.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...product, stock: product.stock + batch.quantity })
                });
            }

            // 2. Update status
            await fetch(`${this.API_URL}/washing/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Delivered' })
            });

            await this.loadAllData();
        } catch (e) {
            console.error(e);
        }
    },

    async deleteWashingBatch(id) {
        this.showConfirm({
            title: 'Delete Washing Record',
            message: 'Delete this washing record? (Stock will NOT be returned)',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/washing/${id}`, { method: 'DELETE' });
                    if (resp.ok) await this.loadAllData();
                } catch (e) {
                    console.error(e);
                }
            }
        });
    },

    // --- Accounting Actions ---

    openTransactionModal(type) {
        const title = type === 'income' ? 'Add Income' : 'Add Expense';
        document.getElementById('transaction-modal-title').innerText = title;
        document.getElementById('txn-type').value = type;

        // Populate categories based on type
        const categorySelect = document.getElementById('txn-category');

        if (type === 'income') {
            categorySelect.innerHTML = `
                <option value="Sales Revenue">Sales Revenue</option>
                <option value="Order Payment">Order Payment</option>
                <option value="Investment">Investment</option>
                <option value="Other Income">Other Income</option>
            `;
        } else {
            categorySelect.innerHTML = `
                <option value="Raw Materials">Raw Materials</option>
                <option value="Washing Charges">Washing Charges</option>
                <option value="Labor Cost">Labor Cost</option>
                <option value="Transportation">Transportation</option>
                <option value="Utilities">Utilities (Electricity, Water)</option>
                <option value="Rent">Rent</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Packaging">Packaging</option>
                <option value="Other Expense">Other Expense</option>
            `;
        }

        // Set today's date as default
        document.getElementById('txn-date').valueAsDate = new Date();
        document.getElementById('transaction-form').reset();
        document.getElementById('txn-type').value = type; // Reset clears it, so set again

        this.openModal('transaction-modal');
    },

    async handleTransactionSubmit(e) {
        e.preventDefault();

        const newTransaction = {
            type: document.getElementById('txn-type').value,
            category: document.getElementById('txn-category').value,
            amount: parseFloat(document.getElementById('txn-amount').value),
            description: document.getElementById('txn-description').value,
            date: document.getElementById('txn-date').value
        };

        try {
            const resp = await fetch(`${this.API_URL}/ledger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTransaction)
            });

            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('transaction-modal');
                this.navigate('accounts');
            }
        } catch (e) {
            console.error(e);
        }
    },

    openWastageModal() {
        const select = document.getElementById('wastage-product-select');
        select.innerHTML = this.data.products.map(p =>
            `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">${p.name} (${p.sku}) - ${p.stock} bundles @ ₹${p.price}/bundle</option>`
        ).join('');

        document.getElementById('wastage-form').reset();
        this.openModal('wastage-modal');
    },

    async handleWastageSubmit(e) {
        e.preventDefault();

        const productId = document.getElementById('wastage-product-select').value;
        const product = this.data.products.find(p => p.id == productId);
        const qty = parseInt(document.getElementById('wastage-quantity').value);
        const reason = document.getElementById('wastage-reason').value;
        const notes = document.getElementById('wastage-notes').value;

        if (product.stock < qty) {
            alert('Not enough stock! Current stock: ' + product.stock + ' bundles.');
            return;
        }

        const wastageCost = qty * (product.costPrice || product.price);

        const wastageTransaction = {
            type: 'wastage',
            category: reason,
            amount: wastageCost,
            description: `${qty} bundles of ${product.name} - ${notes || reason}`,
            date: new Date().toISOString().split('T')[0]
        };

        try {
            // 1. Post to ledger
            await fetch(`${this.API_URL}/ledger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wastageTransaction)
            });

            // 2. Deduct from inventory
            await fetch(`${this.API_URL}/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...product, stock: product.stock - qty })
            });

            await this.loadAllData();
            this.closeModal('wastage-modal');
            this.navigate('accounts');
        } catch (e) {
            console.error(e);
        }
    },

    async deleteLedgerEntry(id) {
        this.showConfirm({
            title: 'Delete Transaction',
            message: 'Delete this transaction? This cannot be undone.',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/ledger/${id}`, { method: 'DELETE' });
                    if (resp.ok) await this.loadAllData();
                } catch (e) {
                    console.error(e);
                }
            }
        });
    },

    navigate(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
            const span = btn.querySelector('span');
            if (span && span.innerText.toLowerCase().includes(viewName === 'orders' ? 'order' : viewName)) {
                btn.classList.add('active');
            }
        });
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
        const viewEl = document.getElementById(`view-${viewName}`);
        if (viewEl) viewEl.classList.add('active-view');

        const titleMap = {
            'dashboard': 'Dashboard',
            'inventory': 'Jeans Inventory',
            'washing': 'Washing Batches',
            'accounts': 'Ledger & Accounts',
            'orders': 'Orders',
            'clients': 'Our Clients',
            'settings': 'Settings'
        };
        document.getElementById('page-title').innerText = titleMap[viewName] || 'Overview';
    },

    openModal(id) {
        const m = document.getElementById(id);
        m.classList.remove('hidden');
        requestAnimationFrame(() => m.classList.add('open'));
    },

    closeModal(id) {
        const m = document.getElementById(id);
        m.classList.remove('open');
        setTimeout(() => m.classList.add('hidden'), 300);
    },

    showConfirm(options) {
        const { title, message, confirmText, onConfirm } = options;
        document.getElementById('confirm-title').innerText = title || 'Confirm Action';
        document.getElementById('confirm-message').innerText = message;
        const btn = document.getElementById('confirm-btn');
        btn.innerText = confirmText || 'Confirm';

        // Remove old listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.onclick = () => {
            this.closeModal('confirm-modal');
            if (onConfirm) onConfirm();
        };

        this.openModal('confirm-modal');
    },

    openActionMenu() {
        const menu = document.getElementById('action-menu');
        menu.classList.toggle('hidden');
    },

    checkNotifications() {
        const lowStockItems = this.data.products.filter(p => p.stock < 20);
        const badge = document.getElementById('notif-badge');
        const list = document.getElementById('notification-list');

        if (lowStockItems.length > 0) {
            badge.innerText = lowStockItems.length;
            badge.classList.remove('hidden');

            list.innerHTML = lowStockItems.map(p => `
                <li class="notif-item">
                    <span>Low Stock: <strong>${p.name}</strong></span>
                    <span style="color:var(--accent-red)">${p.stock} left</span>
                </li>
            `).join('');
        } else {
            badge.classList.add('hidden');
            list.innerHTML = '<li class="notif-item">All systems nominal.</li>';
        }
    },

    toggleNotifications() {
        document.getElementById('notification-dropdown').classList.toggle('hidden');
    },

    // --- Charts ---

    initChart() {
        this.initCategoryChart();
        // Lazy load second chart
    },

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Outfit', sans-serif";

        const data = this.getCategoryData();

        if (this.categoryChartInstance) this.categoryChartInstance.destroy();

        this.categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.7)',
                        'rgba(56, 189, 248, 0.7)',
                        'rgba(251, 146, 60, 0.7)',
                        'rgba(74, 222, 128, 0.7)'
                    ],
                    borderColor: '#1e293b',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    },

    initOrderChart() {
        const ctx = document.getElementById('orderChart');
        if (!ctx) return;

        const data = this.getOrderStatusData();

        if (this.orderChartInstance) this.orderChartInstance.destroy();

        this.orderChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        'rgba(168, 162, 158, 0.7)', // Pending
                        'rgba(99, 102, 241, 0.7)'  // Completed
                    ],
                    borderColor: '#1e293b',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    },

    updateChart() {
        if (this.categoryChartInstance) {
            const data = this.getCategoryData();
            this.categoryChartInstance.data.labels = data.labels;
            this.categoryChartInstance.data.datasets[0].data = data.values;
            this.categoryChartInstance.update();
        }

        if (this.orderChartInstance) {
            const data = this.getOrderStatusData();
            this.orderChartInstance.data.labels = data.labels;
            this.orderChartInstance.data.datasets[0].data = data.values;
            this.orderChartInstance.update();
        }
    },

    getCategoryData() {
        const counts = {};
        this.data.categories.forEach(c => counts[c] = 0);

        this.data.products.forEach(p => {
            if (counts[p.category] !== undefined) counts[p.category] += p.stock;
        });

        return {
            labels: Object.keys(counts),
            values: Object.values(counts)
        };
    },

    getOrderStatusData() {
        let pending = 0;
        let completed = 0;
        this.data.orders.forEach(o => {
            if (o.status === 'Completed') completed++;
            else pending++;
        });
        return {
            labels: ['Pending', 'Completed'],
            values: [pending, completed]
        };
    },

    slideChart(direction) {
        const slides = document.querySelectorAll('.chart-slide');
        const max = slides.length - 1;
        let newIndex = this.currentSlideIndex + direction;

        if (newIndex < 0) newIndex = max;
        if (newIndex > max) newIndex = 0;

        slides[this.currentSlideIndex].classList.remove('active-slide');

        this.currentSlideIndex = newIndex;
        slides[this.currentSlideIndex].classList.add('active-slide');

        document.getElementById('chart-title').innerText = this.chartTitles[this.currentSlideIndex];

        // Lazy Load or Resize
        if (this.currentSlideIndex === 1) {
            if (!this.orderChartInstance) {
                this.initOrderChart();
            } else {
                this.orderChartInstance.resize();
            }
        } else if (this.currentSlideIndex === 0 && this.categoryChartInstance) {
            this.categoryChartInstance.resize();
        }
    },

    // --- Client Actions ---
    openClientModal() {
        document.getElementById('client-form').reset();
        document.getElementById('c-id').value = '';
        document.getElementById('client-modal-title').innerText = 'Add New Client';
        this.openModal('client-modal');
    },

    editClient(id) {
        const client = this.data.clients.find(c => c.id == id);
        if (!client) return;

        document.getElementById('c-id').value = client.id;
        document.getElementById('c-name').value = client.name;
        document.getElementById('c-phone').value = client.phone || '';
        document.getElementById('c-email').value = client.email || '';
        document.getElementById('c-address').value = client.address || '';

        document.getElementById('client-modal-title').innerText = 'Edit Client';
        this.openModal('client-modal');
    },

    async handleClientSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('c-id').value;
        const clientData = {
            name: document.getElementById('c-name').value,
            phone: document.getElementById('c-phone').value,
            email: document.getElementById('c-email').value,
            address: document.getElementById('c-address').value
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${this.API_URL}/clients/${id}` : `${this.API_URL}/clients`;

            const resp = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientData)
            });

            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('client-modal');
            }
        } catch (e) {
            console.error(e);
        }
    },

    async deleteClient(id) {
        this.showConfirm({
            title: 'Delete Client',
            message: 'Delete this client? This won\'t delete their orders.',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/clients/${id}`, { method: 'DELETE' });
                    if (resp.ok) await this.loadAllData();
                } catch (e) {
                    console.error(e);
                }
            }
        });
    },

    // --- Invoicing ---
    viewInvoice(orderId) {
        const order = this.data.orders.find(o => o.id == orderId);
        if (!order) return;

        const product = this.data.products.find(p => p.id == order.productId);
        const client = this.data.clients.find(c => c.id == order.clientId);

        const paper = document.getElementById('invoice-paper');
        paper.innerHTML = `
            <div class="invoice-header">
                <div class="invoice-brand">
                    <img src="logo.png" style="width: 60px; margin-bottom: 10px;">
                    <h1>SPY GARMENTS</h1>
                    <p style="color: #64748b;">Premium Wholesale Jeans & Clothing</p>
                </div>
                <div class="invoice-meta">
                    <h2 style="font-size: 24px; color: #1e293b;">INVOICE</h2>
                    <p><strong>#${order.id}</strong></p>
                    <p>Date: ${new Date(order.date).toLocaleDateString()}</p>
                    <p>Status: ${order.status}</p>
                </div>
            </div>

            <div class="invoice-details">
                <div class="inv-from">
                    <div class="inv-label">From:</div>
                    <p><strong>Spy Garments Wholesale</strong></p>
                    <p>Industrial Estate, GIDC</p>
                    <p>Ahmedabad, Gujarat</p>
                    <p>Contact: +91 98765 43210</p>
                </div>
                <div class="inv-to">
                    <div class="inv-label">Bill To:</div>
                    <p><strong>${client ? client.name : 'Unknown Client'}</strong></p>
                    ${client ? `
                        <p>${client.address || 'Address not specified'}</p>
                        <p>Phone: ${client.phone || 'N/A'}</p>
                    ` : '<p>Address not specified</p>'}
                </div>
            </div>

            <table class="inv-table">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>Qty (Bundles)</th>
                        <th>Rate (₹)</th>
                        <th style="text-align: right;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>${product ? product.name : 'Jeans Article'}</strong><br>
                            <span style="font-size: 11px; color: #64748b;">SKU: ${product ? product.sku : '-'} | Fit: ${product ? product.fit : '-'}</span>
                        </td>
                        <td>${order.quantity}</td>
                        <td>${(order.total / order.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: right;">${order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>

            <div class="inv-total-section">
                <div class="inv-summary">
                    <div class="inv-total-row">
                        <span>Subtotal:</span>
                        <span>₹${order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="inv-total-row">
                        <span>Tax (0%):</span>
                        <span>₹0.00</span>
                    </div>
                    <div class="inv-total-row grand">
                        <span>Total:</span>
                        <span>₹${order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 4rem; border-top: 1px solid #f1f5f9; padding-top: 2rem;">
                <p style="font-size: 12px; color: #64748b; text-align: center;">
                    Thank you for your business! This is a computer generated invoice.
                </p>
            </div>
        `;

        this.openModal('invoice-overlay');
    },

    // --- Payment Verification ---

    openPaymentModal(orderId) {
        const order = this.data.orders.find(o => o.id == orderId);
        if (!order) return;

        const client = this.data.clients.find(c => c.id == order.clientId);
        const product = this.data.products.find(p => p.id == order.productId);

        document.getElementById('pay-order-id').value = orderId;
        document.getElementById('pay-order-summary').innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="color:var(--text-muted)">Order:</span>
                <span style="color:white; font-weight:500;">#${orderId.toString().slice(-4)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="color:var(--text-muted)">Client:</span>
                <span style="color:white; font-weight:500;">${client ? client.name : 'Unknown'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="color:var(--text-muted)">Item:</span>
                <span style="color:white; font-weight:500;">${product ? product.name : 'Unknown Product'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px; margin-top:5px;">
                <span style="color:var(--accent-indigo); font-weight:600;">Due Amount:</span>
                <span style="color:#4ade80; font-weight:700; font-size:1.1rem;">₹${Number(order.total).toFixed(2)}</span>
            </div>
        `;

        document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('pay-ref').value = '';
        this.openModal('payment-modal');
    },

    async handlePaymentVerification(e) {
        e.preventDefault();
        const id = document.getElementById('pay-order-id').value;
        const verificationData = {
            paymentMethod: document.getElementById('pay-method').value,
            paymentRef: document.getElementById('pay-ref').value,
            paymentDate: document.getElementById('pay-date').value
        };

        try {
            const resp = await fetch(`${this.API_URL}/orders/${id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verificationData)
            });

            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('payment-modal');
                alert('Payment verified and profit recorded in ledger.');
            } else {
                alert('Error verifying payment.');
            }
        } catch (e) {
            console.error(e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.actions')) {
            const am = document.getElementById('action-menu');
            const nd = document.getElementById('notification-dropdown');
            if (am) am.classList.add('hidden');
            if (nd) nd.classList.add('hidden');
        }
    });
});
