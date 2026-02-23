/**
 * Spy Garments Wholesale System
 * Premium Logic Controller
 */

const app = {
    API_URL: 'http://localhost:3000/api',
    data: {
        products: [],
        orders: [],
        ledgerTransactions: [],
        clients: [],
        wholesalers: [],
        clothInventory: [],
        manufacturingLots: [],
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
        // Load theme from local storage
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-mode');
        }

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
            const [products, orders, ledger, clients, wholesalers, cloth, manufacturing] = await Promise.all([
                fetch(`${this.API_URL}/products`).then(r => r.json()),
                fetch(`${this.API_URL}/orders`).then(r => r.json()),
                fetch(`${this.API_URL}/ledger`).then(r => r.json()),
                fetch(`${this.API_URL}/clients`).then(r => r.json()),
                fetch(`${this.API_URL}/wholesalers`).then(r => r.json()),
                fetch(`${this.API_URL}/cloth-inventory`).then(r => r.json()),
                fetch(`${this.API_URL}/manufacturing`).then(r => r.json())
            ]);

            this.data.products = products;
            this.data.orders = orders;
            this.data.ledgerTransactions = ledger;
            this.data.clients = clients;
            this.data.wholesalers = wholesalers;
            this.data.clothInventory = cloth;
            this.data.manufacturingLots = manufacturing;

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
    toggleTheme() {
        document.body.classList.toggle('light-mode');
        if (document.body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
        } else {
            localStorage.setItem('theme', 'dark');
        }
    },

    resetData() {
        this.showConfirm({
            title: 'Critical Warning: Reset System',
            message: 'Are you absolutely sure you want to delete ALL data? This will wipe Products, Orders, Clients, Ledger, and Washing records permanently. This action CANNOT be undone.',
            confirmText: 'YES, DELETE ALL DATA',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/reset`, { method: 'DELETE' });
                    if (resp.ok) {
                        await this.loadAllData();
                        alert('System data has been completely reset.');
                        this.navigate('dashboard');
                    } else {
                        alert('Failed to reset system data.');
                    }
                } catch (e) {
                    console.error('Reset error:', e);
                }
            }
        });
    },

    // --- UI Rendering ---

    updateUI() {
        if (!this.isAuthenticated) return;

        // Stats are always needed for dashboard metrics
        this.renderStats();

        // Re-render only the currently active view
        if (this.currentView === 'inventory') this.renderInventory();
        if (this.currentView === 'manufacturing') this.renderManufacturing();
        if (this.currentView === 'wholesalers') this.renderWholesalers();
        if (this.currentView === 'accounts') this.renderLedger();
        if (this.currentView === 'orders') this.renderOrders();
        if (this.currentView === 'clients') this.renderClients();
        if (this.currentView === 'client-details') this.openClientDetails(this.activeClientId);

        this.updateChart();
        this.renderActivityLog();
        this.checkNotifications();
    },

    renderStats() {
        const totalInventoryPieces = this.data.products.reduce((acc, curr) => acc + curr.stock, 0);
        const totalManufacturingPieces = this.data.manufacturingLots
            .filter(l => l.status === 'Active')
            .reduce((acc, curr) => acc + curr.current_pieces, 0);

        const lowStock = this.data.products.filter(p => p.stock < 10).length;
        const totalValue = this.data.products.reduce((acc, curr) => acc + (curr.stock * curr.price), 0);

        // Calculate Receivables (Sum of all client balances)
        let totalReceivables = 0;
        this.data.clients.forEach(client => {
            const billed = this.data.orders
                .filter(o => o.clientId == client.id)
                .reduce((sum, o) => sum + o.total, 0);
            const paid = this.data.ledgerTransactions
                .filter(l => l.clientId == client.id && l.type === 'income')
                .reduce((sum, l) => sum + l.amount, 0);
            totalReceivables += Math.max(0, billed - paid);
        });

        // Calculate Cloth Payables (Debt)
        const totalClothCost = this.data.clothInventory.reduce((sum, item) => sum + (item.total_cost || 0), 0);
        const totalWhPayments = this.data.ledgerTransactions
            .filter(l => l.wholesaler_id && l.type === 'expense')
            .reduce((sum, l) => sum + (l.amount || 0), 0);
        const clothPayables = totalClothCost - totalWhPayments;

        document.getElementById('dash-wip-pieces').innerText = totalManufacturingPieces;
        document.getElementById('dash-total-products').innerText = totalInventoryPieces;
        document.getElementById('dash-low-stock').innerText = lowStock;
        document.getElementById('dash-total-value').innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalValue);

        const recEl = document.getElementById('dash-receivables');
        if (recEl) recEl.innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalReceivables);

        const payEl = document.getElementById('dash-payables');
        if (payEl) payEl.innerText = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Math.max(0, clothPayables));
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
                <td>
                    <button class="action-btn" onclick="app.editProduct('${product.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn delete" onclick="app.deleteProduct('${product.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderManufacturing() {
        const tbody = document.getElementById('manufacturing-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.data.manufacturingLots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No manufacturing lots found.</td></tr>';
            return;
        }

        const steps = ['Cutting', 'Stitching', 'Kaj', 'Washing', 'Packing'];

        this.data.manufacturingLots.forEach(lot => {
            const tr = document.createElement('tr');
            const currentIdx = steps.indexOf(lot.current_step);

            // Calculate progress line fill
            // If completed, 100%. Otherwise, fill up to the active step.
            let fillWidth = 0;
            if (lot.status === 'Completed') {
                fillWidth = 100;
            } else if (currentIdx !== -1) {
                fillWidth = (currentIdx / (steps.length - 1)) * 100;
            }

            const pipelineHtml = `
                <div class="pipeline-container">
                    <div class="pipeline-line">
                        <div class="pipeline-line-fill" style="width: ${fillWidth}%"></div>
                    </div>
                    ${steps.map((s, idx) => {
                let statusClass = '';
                if (lot.status === 'Completed' || idx < currentIdx) statusClass = 'completed';
                else if (idx === currentIdx && lot.status === 'Active') statusClass = 'active';

                return `
                            <div class="pipeline-step ${statusClass}">
                                <div class="step-ring" title="${s}"></div>
                                <span class="step-label">${s}</span>
                            </div>
                        `;
            }).join('')}
                </div>
            `;

            tr.innerHTML = `
                <td style="font-weight: 500; color: white; font-family: monospace;">${lot.lot_number}</td>
                <td>${pipelineHtml}</td>
                <td>
                    <div style="font-weight: 600; color: var(--primary);">${lot.current_pieces}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">of ${lot.initial_pieces}</div>
                </td>
                <td><span style="color: var(--accent-red); font-weight: 600;">-${lot.total_wastage}</span></td>
                <td>
                    <button class="action-btn" onclick="app.viewLotHistory('${lot.id}')" title="View History"><i class="ph ph-clock-counter-clockwise"></i></button>
                    ${lot.status === 'Active' && lot.current_step !== 'Completed' ?
                    `<button class="action-btn" onclick="app.openStepModal('${lot.id}')" title="Next Step"><i class="ph ph-arrow-circle-right"></i></button>` : ''}
                    ${lot.current_step === 'Packing' && lot.status === 'Active' ?
                    `<button class="action-btn" style="color: var(--accent-green);" onclick="app.openFinishLotModal('${lot.id}')" title="Send to Inventory"><i class="ph ph-check-square"></i></button>` : ''}
                    <button class="action-btn delete" onclick="app.deleteLot('${lot.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderWholesalers() {
        const tbody = document.getElementById('wholesalers-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.data.wholesalers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No wholesalers recorded.</td></tr>';
            return;
        }

        this.data.wholesalers.forEach(wh => {
            const purchases = this.data.clothInventory.filter(c => c.wholesaler_id == wh.id);
            const totalValue = purchases.reduce((sum, p) => sum + p.total_cost, 0);

            const totalPaid = this.data.ledgerTransactions
                .filter(l => l.wholesaler_id == wh.id && l.type === 'expense')
                .reduce((sum, l) => sum + (l.amount || 0), 0);

            const balance = totalValue - totalPaid;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:500; color:white;">${wh.name}</td>
                <td>
                    <div>${wh.phone || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted)">${wh.email || '-'}</div>
                </td>
                <td style="max-width:200px; font-size:13px;">${wh.address || '-'}</td>
                <td>₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="color: ${balance > 0 ? '#ef4444' : '#4ade80'}; font-weight: 600;">₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>
                    <button class="action-btn" onclick="app.editWholesaler('${wh.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn" onclick="app.openWholesalerPaymentModal('${wh.id}')" title="Make Payment"><i class="ph ph-currency-inr"></i></button>
                    <button class="action-btn delete" onclick="app.deleteWholesaler('${wh.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderClothInventory() {
        const tbody = document.getElementById('cloth-inventory-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.data.clothInventory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No cloth receipts found.</td></tr>';
            return;
        }

        this.data.clothInventory.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.date_received).toLocaleDateString()}</td>
                <td style="font-weight: 500; color: white;">${item.cloth_type}</td>
                <td>${item.wholesaler_name || 'Unknown'}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>₹${Number(item.total_cost).toLocaleString('en-IN')}</td>
                <td>
                    <button class="action-btn delete" onclick="app.deleteClothItem('${item.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    switchSubTab(view, tab) {
        document.querySelectorAll(`#view-${view} .sub-view`).forEach(el => el.classList.add('hidden'));
        document.getElementById(`${view}-${tab}-tab`).classList.remove('hidden');
        document.querySelectorAll(`#view-${view} .tab-btn`).forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
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

            const totalPaid = this.data.ledgerTransactions
                .filter(l => l.client_id == client.id && l.type === 'income')
                .reduce((sum, l) => sum + l.amount, 0);

            const balance = totalValue - totalPaid;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:500; color:white;">
                    <a href="#" onclick="app.openClientDetails('${client.id}'); return false;" style="color: var(--primary); text-decoration: none; border-bottom: 1px dashed transparent; transition: all 0.2s;" onmouseover="this.style.borderBottomColor='var(--primary)'" onmouseout="this.style.borderBottomColor='transparent'">${client.name}</a>
                </td>
                <td>
                    <div>${client.phone || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted)">${client.email || '-'}</div>
                </td>
                <td style="max-width:200px; font-size:13px;">${client.address || '-'}</td>
                <td>${clientOrders.length}</td>
                <td>₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="color: ${balance > 0 ? '#ef4444' : '#4ade80'}; font-weight: 600;">₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>
                    <button class="action-btn" onclick="app.editClient('${client.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn delete" onclick="app.deleteClient('${client.id}')"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openClientDetails(clientId) {
        const client = this.data.clients.find(c => c.id == clientId);
        if (!client) return;

        this.navigate('client-details');
        document.getElementById('cd-client-name').innerText = client.name;
        // Store current client ID for helper functions
        this.activeClientId = clientId;

        const clientOrders = this.data.orders.filter(o => o.clientId == clientId);
        const totalBilled = clientOrders.reduce((sum, o) => sum + o.total, 0);

        const clientPayments = this.data.ledgerTransactions.filter(l => l.client_id == clientId && l.type === 'income');
        const totalPaid = clientPayments.reduce((sum, l) => sum + l.amount, 0);

        const balance = totalBilled - totalPaid;

        document.getElementById('cd-total-orders').innerText = clientOrders.length;
        document.getElementById('cd-total-billing').innerText = `₹${totalBilled.toLocaleString('en-IN')}`;
        document.getElementById('cd-balance').innerText = `₹${balance.toLocaleString('en-IN')}`;

        // Color coding for balance
        const balEl = document.getElementById('cd-balance');
        if (balance > 0) {
            balEl.style.color = '#ef4444'; // Red if owed
        } else if (balance < 0) {
            balEl.style.color = '#38bdf8'; // Blue if overpaid
        } else {
            balEl.style.color = '#4ade80'; // Green if clear
        }

        this.renderClientBills(clientOrders);
        this.renderClientLedger(clientPayments);
    },

    openOrderFromClient() {
        this.openOrderModal();
        const client = this.data.clients.find(c => c.id == this.activeClientId);
        if (client) {
            document.getElementById('o-client').value = client.name;
        }
    },

    openIncomeFromClient() {
        this.openTransactionModal('income');
        const client = this.data.clients.find(c => c.id == this.activeClientId);
        if (client) {
            document.getElementById('txn-description').value = `Payment from ${client.name}`;
            document.getElementById('txn-category').value = 'Order Payment';
            // We can add a hidden field or find a way to link it if needed,
            // but for now the handleTransactionSubmit needs to know about client_id
            this.incomeClientId = client.id;
        }
    },

    renderClientBills(orders) {
        const tbody = document.getElementById('cd-bills-table-body');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No orders found for this client.</td></tr>';
            return;
        }

        orders.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(o => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(o.date).toLocaleDateString()}</td>
                <td style="font-family: monospace;">#${o.id.toString().slice(-4)}</td>
                <td style="font-weight:600;">₹${o.total.toLocaleString('en-IN')}</td>
                <td>
                    ${o.paymentStatus === 'Paid' ?
                    '<span class="status-badge instock">Paid</span>' :
                    `<button class="action-btn" style="color: #4ade80;" onclick="app.openPaymentModal('${o.id}')" title="Pay Bill"><i class="ph ph-hand-coins"></i></button>`
                }
                    <button class="action-btn" onclick="app.viewInvoice('${o.id}')"><i class="ph ph-file-text"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderClientLedger(transactions) {
        const tbody = document.getElementById('cd-ledger-table-body');
        tbody.innerHTML = '';

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No payment history found.</td></tr>';
            return;
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td style="font-weight:600; color:#4ade80;">₹${t.amount.toLocaleString('en-IN')}</td>
                <td>${t.category}</td>
                <td style="font-size:12px;">${t.description || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderOrders() {
        const tbody = document.getElementById('orders-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No orders found.</td></tr>';
            return;
        }

        this.data.orders.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(o => {
            const client = this.data.clients.find(c => c.id == o.clientId);
            const clientName = client ? client.name : 'Deleted Client';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace; font-weight: 500; color: white;">#${o.id.toString().slice(-6)}</td>
                <td>${clientName}</td>
                <td>${o.quantity} piezas</td>
                <td style="font-weight: 600;">₹${o.total.toLocaleString('en-IN')}</td>
                <td>${new Date(o.date).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn" onclick="app.viewInvoice('${o.id}')" title="View Invoice"><i class="ph ph-file-text"></i></button>
                    <button class="action-btn delete" onclick="app.deleteOrder('${o.id}')" title="Delete Order"><i class="ph ph-trash"></i></button>
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
        document.getElementById('modal-title').innerText = 'Add New Product';
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

        document.getElementById('modal-title').innerText = 'Edit Product';
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
            title: 'Delete Product',
            message: 'Delete this product and all its stock?',
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
            alert('Not enough stock! Current stock: ' + product.stock + ' pieces.');
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
                if (this.currentView === 'client-details' && this.activeClientId) {
                    this.openClientDetails(this.activeClientId);
                } else {
                    this.navigate('clients');
                }
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
            `<option value="${p.id}" data-stock="${p.stock}">${p.name} (${p.sku}) - ${p.stock} pieces available</option>`
        ).join('');

        document.getElementById('washing-form').reset();
        this.openModal('washing-modal');
    },

    // --- Wholesaler Actions ---
    openWholesalerModal() {
        document.getElementById('wholesaler-form').reset();
        document.getElementById('wh-id').value = '';
        document.getElementById('wholesaler-modal-title').innerText = 'Add New Wholesaler';
        this.openModal('wholesaler-modal');
    },

    editWholesaler(id) {
        const wh = this.data.wholesalers.find(w => w.id == id);
        if (!wh) return;
        document.getElementById('wh-id').value = wh.id;
        document.getElementById('wh-name').value = wh.name;
        document.getElementById('wh-phone').value = wh.phone || '';
        document.getElementById('wh-email').value = wh.email || '';
        document.getElementById('wh-address').value = wh.address || '';
        document.getElementById('wholesaler-modal-title').innerText = 'Edit Wholesaler';
        this.openModal('wholesaler-modal');
    },

    async handleWholesalerSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('wh-id').value;
        const data = {
            name: document.getElementById('wh-name').value,
            phone: document.getElementById('wh-phone').value,
            email: document.getElementById('wh-email').value,
            address: document.getElementById('wh-address').value
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${this.API_URL}/wholesalers/${id}` : `${this.API_URL}/wholesalers`;
            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('wholesaler-modal');
            }
        } catch (e) { console.error(e); }
    },

    async deleteWholesaler(id) {
        this.showConfirm({
            title: 'Delete Wholesaler',
            message: 'Are you sure? This will not delete historical purchases.',
            confirmText: 'Delete',
            onConfirm: async () => {
                await fetch(`${this.API_URL}/wholesalers/${id}`, { method: 'DELETE' });
                this.loadAllData();
            }
        });
    },

    openWholesalerPaymentModal(id) {
        const wh = this.data.wholesalers.find(w => w.id == id);
        if (!wh) return;
        document.getElementById('wp-wholesaler-id').value = wh.id;
        document.getElementById('wp-wholesaler-name').value = wh.name;
        document.getElementById('wp-amount').value = '';
        document.getElementById('wp-date').valueAsDate = new Date();
        document.getElementById('wp-notes').value = '';
        this.openModal('wholesaler-payment-modal');
    },

    async handleWholesalerPaymentSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('wp-wholesaler-id').value;
        const data = {
            amount: parseFloat(document.getElementById('wp-amount').value),
            date: document.getElementById('wp-date').value,
            description: document.getElementById('wp-notes').value || 'Manual Payment'
        };

        try {
            const resp = await fetch(`${this.API_URL}/wholesalers/${id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('wholesaler-payment-modal');
                this.navigate('accounts');
            }
        } catch (e) { console.error(e); }
    },

    // --- Cloth Inventory Actions ---
    openClothInventoryModal() {
        const select = document.getElementById('ci-wholesaler');
        select.innerHTML = this.data.wholesalers.map(wh => `<option value="${wh.id}">${wh.name}</option>`).join('');
        document.getElementById('cloth-form').reset();
        document.getElementById('ci-date').valueAsDate = new Date();
        this.openModal('cloth-modal');
    },

    async handleClothSubmit(e) {
        e.preventDefault();
        const data = {
            wholesaler_id: document.getElementById('ci-wholesaler').value,
            cloth_type: document.getElementById('ci-type').value,
            quantity: parseFloat(document.getElementById('ci-quantity').value),
            unit: document.getElementById('ci-unit').value,
            price_per_unit: parseFloat(document.getElementById('ci-rate').value),
            total_cost: parseFloat(document.getElementById('ci-total').value),
            date_received: document.getElementById('ci-date').value,
            notes: ''
        };

        try {
            const resp = await fetch(`${this.API_URL}/cloth-inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                const result = await resp.json();
                // Also record in ledger
                await fetch(`${this.API_URL}/ledger`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'expense',
                        category: 'Raw Materials',
                        amount: data.total_cost,
                        description: `Cloth Purchase: ${data.cloth_type} (${data.quantity} ${data.unit}) from ${this.data.wholesalers.find(w => w.id == data.wholesaler_id)?.name || 'Wholesaler'}`,
                        date: data.date_received,
                        wholesalerId: data.wholesaler_id
                    })
                });

                await this.loadAllData();
                this.closeModal('cloth-modal');
            }
        } catch (e) { console.error(e); }
    },

    async deleteClothItem(id) {
        // Implementation for deleting cloth item if needed, for now just log or add endpoint
        alert('Delete cloth receipt functionality coming soon or delete manually in DB.');
    },

    // --- Manufacturing Actions ---
    openLotModal() {
        const select = document.getElementById('ml-source');
        if (this.data.clothInventory.length === 0) {
            alert('Please record cloth receipt first.');
            this.navigate('wholesalers');
            return;
        }
        select.innerHTML = this.data.clothInventory.map(item =>
            `<option value="${item.id}">${item.cloth_type} (From: ${item.wholesaler_name}) - ${item.quantity} ${item.unit} available</option>`
        ).join('');
        document.getElementById('lot-form').reset();
        this.openModal('lot-modal');
    },

    async handleLotSubmit(e) {
        e.preventDefault();
        const data = {
            lot_number: document.getElementById('ml-number').value,
            cloth_inventory_id: document.getElementById('ml-source').value,
            initial_pieces: parseInt(document.getElementById('ml-pieces').value),
            unit_cost: parseFloat(document.getElementById('ml-cost').value),
            created_at: new Date().toISOString()
        };

        try {
            const resp = await fetch(`${this.API_URL}/manufacturing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('lot-modal');
                this.navigate('manufacturing');
            } else {
                const err = await resp.json();
                alert('Error: ' + (err.error || 'Failed to start lot'));
            }
        } catch (e) { console.error(e); }
    },

    openStepModal(lotId) {
        const lot = this.data.manufacturingLots.find(l => l.id == lotId);
        if (!lot) return;

        const steps = ['Cutting', 'Stitching', 'Kaj', 'Washing', 'Packing'];
        const currentIdx = steps.indexOf(lot.current_step);
        const nextStep = steps[currentIdx + 1] || 'Completed';

        document.getElementById('ms-lot-id').value = lotId;
        document.getElementById('ms-next-step').value = nextStep;
        document.getElementById('step-modal-title').innerText = `Process to Next Step: ${nextStep}`;
        document.getElementById('ms-current-pieces').innerText = lot.current_pieces;
        document.getElementById('ms-wastage').value = 0;
        document.getElementById('ms-comments').value = '';

        this.openModal('step-modal');
    },

    async handleStepSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('ms-lot-id').value;
        const data = {
            next_step: document.getElementById('ms-next-step').value,
            wastage: parseInt(document.getElementById('ms-wastage').value),
            comments: document.getElementById('ms-comments').value,
            timestamp: new Date().toISOString()
        };

        try {
            const resp = await fetch(`${this.API_URL}/manufacturing/${id}/next-step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('step-modal');
            }
        } catch (e) { console.error(e); }
    },

    async viewLotHistory(lotId) {
        try {
            const lot = this.data.manufacturingLots.find(l => l.id == lotId);
            if (!lot) return;

            const resp = await fetch(`${this.API_URL}/manufacturing/${lotId}/history`);
            const history = await resp.json();

            const summary = document.getElementById('lot-info-summary');
            summary.innerHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div><span style="color:var(--text-muted)">Lot Number:</span> <span style="color:white; font-family:monospace;">${lot.lot_number}</span></div>
                    <div><span style="color:var(--text-muted)">Started On:</span> <span style="color:white;">${new Date(lot.created_at).toLocaleDateString()}</span></div>
                    <div><span style="color:var(--text-muted)">Current Pieces:</span> <span style="color:white;">${lot.current_pieces}</span></div>
                    <div><span style="color:var(--text-muted)">Total Wastage:</span> <span style="color:var(--accent-red);">${lot.total_wastage}</span></div>
                </div>
            `;

            const timeline = document.getElementById('lot-history-timeline');
            timeline.innerHTML = '';

            if (history.length === 0) {
                timeline.innerHTML = '<p style="text-align:center; padding:1rem;">No history found.</p>';
            } else {
                history.reverse().forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong style="color:var(--primary); text-transform:uppercase; letter-spacing:1px;">${item.step_name}</strong>
                            <span style="font-size:12px; color:var(--text-muted);">${new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <div style="color:white; margin-bottom:0.5rem; line-height:1.5;">${item.comments || 'No comments'}</div>
                        ${item.wastage > 0 ? `<div style="font-size:12px; color:var(--accent-red);">Wastage: ${item.wastage} pieces</div>` : ''}
                    `;
                    timeline.appendChild(div);
                });
            }

            this.openModal('lot-history-modal');
        } catch (e) {
            console.error('Error fetching lot history:', e);
        }
    },

    openFinishLotModal(lotId) {
        const lot = this.data.manufacturingLots.find(l => l.id == lotId);
        if (!lot) return;

        document.getElementById('fl-lot-id').value = lotId;
        document.getElementById('fl-sku').value = lot.lot_number;
        document.getElementById('fl-pieces').value = lot.current_pieces;
        document.getElementById('fl-name').value = '';
        document.getElementById('fl-price').value = '';

        this.openModal('finish-lot-modal');
    },

    async handleFinishLotSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('fl-lot-id').value;
        const data = {
            product_details: {
                name: document.getElementById('fl-name').value,
                sku: document.getElementById('fl-sku').value,
                category: document.getElementById('fl-category').value,
                fit: document.getElementById('fl-category').value, // Using category as fit for simplicity here
                wash: 'Standard',
                sizes: '28,30,32,34,36',
                price: parseFloat(document.getElementById('fl-price').value)
            },
            timestamp: new Date().toISOString()
        };

        try {
            const resp = await fetch(`${this.API_URL}/manufacturing/${id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('finish-lot-modal');
                this.navigate('inventory');
            }
        } catch (e) { console.error(e); }
    },

    async deleteLot(id) {
        this.showConfirm({
            title: 'Delete Lot',
            message: 'Delete this manufacturing lot and all its history?',
            confirmText: 'Delete',
            onConfirm: async () => {
                await fetch(`${this.API_URL}/manufacturing/${id}`, { method: 'DELETE' });
                this.loadAllData();
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
            // Include active client link if recording income from profile
            if (newTransaction.type === 'income' && this.incomeClientId) {
                newTransaction.clientId = this.incomeClientId;
                this.incomeClientId = null; // Reset
            }

            // --- Verification Step for Income ---
            if (newTransaction.type === 'income') {
                this.showConfirm({
                    title: 'Verify Payment',
                    message: `Please confirm the following payment details:\n\n` +
                        `Amount: ₹${newTransaction.amount.toFixed(2)}\n` +
                        `Method: ${newTransaction.category}\n` +
                        `Description: ${newTransaction.description || 'N/A'}\n` +
                        `Date: ${new Date(newTransaction.date).toLocaleDateString()}\n\n` +
                        `Is this correct?`,
                    confirmText: 'Verify & Save',
                    onConfirm: async () => {
                        const resp = await fetch(`${this.API_URL}/ledger`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newTransaction)
                        });

                        if (resp.ok) {
                            await this.loadAllData();
                            this.closeModal('transaction-modal');
                            if (this.currentView === 'client-details' && this.activeClientId) {
                                this.openClientDetails(this.activeClientId);
                            } else {
                                this.navigate('accounts');
                            }
                        }
                    }
                });
                return; // Wait for confirmation
            }

            const resp = await fetch(`${this.API_URL}/ledger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTransaction)
            });

            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('transaction-modal');
                // Stay on client details if we were there
                if (this.currentView === 'client-details' && this.activeClientId) {
                    this.openClientDetails(this.activeClientId);
                } else {
                    this.navigate('accounts');
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    exportToExcel() {
        const wb = XLSX.utils.book_new();

        // 1. Dashboard Summary
        const receivables = this.data.clients.reduce((sum, c) => {
            const billed = this.data.orders.filter(o => o.clientId == c.id).reduce((s, o) => s + o.total, 0);
            const paid = this.data.ledgerTransactions.filter(l => l.clientId == c.id && l.type === 'income').reduce((s, l) => s + l.amount, 0);
            return sum + (billed - paid);
        }, 0);

        const summary = [
            ["Spy Garments - Business Report", new Date().toLocaleDateString()],
            [],
            ["Metric", "Value"],
            ["Total Inventory Value", this.data.products.reduce((acc, curr) => acc + (curr.stock * curr.price), 0)],
            ["Total Pieces in Stock", this.data.products.reduce((acc, curr) => acc + curr.stock, 0)],
            ["Total Receivables (Clients)", receivables],
            ["Total WIP Pieces", this.data.manufacturingLots.filter(l => l.status === 'Active').reduce((acc, curr) => acc + curr.current_pieces, 0)],
            ["Low Stock Articles", this.data.products.filter(p => p.stock < 10).length]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Dashboard");

        // 2. Inventory Sheet
        const invData = this.data.products.map(p => ({
            "Product Name": p.name,
            "SKU": p.sku,
            "Category": p.category,
            "Fit": p.fit,
            "Wash": p.wash,
            "Stock (Pieces)": p.stock,
            "Price/Piece": p.price,
            "Total Value": p.stock * p.price
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), "Inventory");

        // 3. Client List & Balances
        const clientData = this.data.clients.map(c => {
            const billed = this.data.orders.filter(o => o.clientId == c.id).reduce((s, o) => s + o.total, 0);
            const paid = this.data.ledgerTransactions.filter(l => l.clientId == c.id && l.type === 'income').reduce((s, l) => s + l.amount, 0);
            return {
                "Client Name": c.name,
                "Phone": c.phone,
                "Email": c.email,
                "Total Billed": billed,
                "Total Paid": paid,
                "Balance Owed": billed - paid
            };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientData), "Clients");

        // 4. Full Ledger
        const ledgerData = this.data.ledgerTransactions.map(l => ({
            "Date": l.date,
            "Type": l.type,
            "Category": l.category,
            "Amount": l.amount,
            "Description": l.description
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ledgerData), "Ledger");

        // Save File
        XLSX.writeFile(wb, `Spy_Garments_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    },

    openWastageModal() {
        const select = document.getElementById('wastage-product-select');
        select.innerHTML = this.data.products.map(p =>
            `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">${p.name} (${p.sku}) - ${p.stock} pieces @ ₹${p.price}/piece</option>`
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
            alert('Not enough stock! Current stock: ' + product.stock + ' pieces.');
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
            'inventory': 'Inventory',
            'manufacturing': 'Manufacturing',
            'wholesalers': 'Wholesalers',
            'accounts': 'Accounts',
            'orders': 'Orders',
            'clients': 'Clients',
            'client-details': 'Client Profile',
            'settings': 'Settings'
        };
        document.getElementById('page-title').innerText = titleMap[viewName] || 'Overview';

        // Refresh data for the newly selected view
        this.updateUI();
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
                        <th>Qty (Pieces)</th>
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
