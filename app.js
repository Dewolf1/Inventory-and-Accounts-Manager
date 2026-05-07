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
    chartTitles: ['Category Distribution', 'Revenue vs Profit'],

    // Sequential IDs are now handled by the database

    // Toast notification system
    showToast(message, type = 'success', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = {
            success: 'ph-check-circle',
            error: 'ph-x-circle',
            warning: 'ph-warning',
            info: 'ph-info'
        };
        toast.innerHTML = `
            <i class="ph ${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()"><i class="ph ph-x"></i></button>
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast-visible'));
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    },

    // Initialize the Application
    async init() {
        // Load theme from local storage
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-mode');
            const icon = document.getElementById('theme-icon');
            if (icon) icon.className = 'ph ph-sun';
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
            this.showToast('Failed to connect to server. Check if backend is running.', 'error', 5000);
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
        this.navigate('dashboard');
        this.initChart(); // Initialize charts
        this.updateUI();
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
                this.showToast('Invalid credentials. Please try again.', 'error');
            }
        } catch (e) {
            this.showToast('Server error. Please try again.', 'error');
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
        const icon = document.getElementById('theme-icon');
        if (document.body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
            if (icon) { icon.className = 'ph ph-sun'; }
        } else {
            localStorage.setItem('theme', 'dark');
            if (icon) { icon.className = 'ph ph-moon'; }
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
                        this.showToast('System data has been completely reset.', 'warning');
                        this.navigate('dashboard');
                    } else {
                        this.showToast('Failed to reset system data.', 'error');
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
        if (this.currentView === 'wholesalers') {
            this.renderWholesalers();
            this.renderClothInventory();
        }
        if (this.currentView === 'accounts') this.renderLedger();
        if (this.currentView === 'orders') this.renderOrders();
        if (this.currentView === 'clients') this.renderClients();
        if (this.currentView === 'client-details') this.refreshClientDetails();

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
            .filter(l => l.wholesaler_id && l.type === 'supplier_payment')
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
                <td style="font-weight: 500; color: var(--text-strong);">${product.name}</td>
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
                <td style="font-weight: 500; color: var(--text-strong); font-family: monospace;">${lot.lot_number}</td>
                <td>${pipelineHtml}</td>
                <td>
                    <div style="font-weight: 600; color: var(--primary);">${lot.current_pieces}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">of ${lot.initial_pieces}</div>
                </td>
                <td><span style="color: var(--accent-red); font-weight: 600;">-${lot.total_wastage}</span></td>
                <td>
                    <button class="action-btn" onclick="app.viewLotHistory('${lot.id}')" title="View History"><i class="ph ph-clock-counter-clockwise"></i></button>
                    ${lot.status === 'Active' && lot.current_step !== 'Completed' && lot.current_step !== 'Packing' ?
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
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No suppliers recorded.</td></tr>';
            return;
        }

        this.data.wholesalers.forEach(wh => {
            const purchases = this.data.clothInventory.filter(c => c.wholesaler_id == wh.id);
            const totalValue = purchases.reduce((sum, p) => sum + p.total_cost, 0);

            const totalPaid = this.data.ledgerTransactions
                .filter(l => l.wholesaler_id == wh.id && l.type === 'supplier_payment')
                .reduce((sum, l) => sum + (l.amount || 0), 0);

            const balance = totalValue - totalPaid;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:500; color:var(--text-strong);">${wh.name}</td>
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No fabric receipts found.</td></tr>';
            return;
        }

        this.data.clothInventory.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.date_received).toLocaleDateString()}</td>
                <td style="font-weight: 500; color: var(--text-strong);">${item.cloth_type}</td>
                <td>${item.wholesaler_name || 'Unknown'}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>₹${Number(item.total_cost).toLocaleString('en-IN')}</td>
                <td>
                    <button class="action-btn" onclick="app.printFabricBill('${item.id}')" title="Print Receipt"><i class="ph ph-printer"></i></button>
                    <button class="action-btn delete" onclick="app.deleteClothItem('${item.id}')" title="Delete"><i class="ph ph-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    switchSubTab(view, tab, e) {
        document.querySelectorAll(`#view-${view} .sub-view`).forEach(el => el.classList.add('hidden'));
        document.getElementById(`${view}-${tab}-tab`).classList.remove('hidden');
        document.querySelectorAll(`#view-${view} .tab-btn`).forEach(btn => btn.classList.remove('active'));
        if (e && e.currentTarget) {
            e.currentTarget.classList.add('active');
        } else if (event && event.currentTarget) {
            event.currentTarget.classList.add('active');
        }
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
            .filter(t => t.type === 'expense' || t.type === 'supplier_payment')
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
            } else if (txn.type === 'supplier_payment') {
                typeClass = 'outstock';
                typeIcon = '↓';
                typeText = 'Supplier Pmt';
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No clients recorded.</td></tr>';
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
                <td style="font-weight:500; color:var(--text-strong);">
                    <a href="#" onclick="app.openClientDetails('${client.id}'); return false;" style="color: var(--primary); text-decoration: none; border-bottom: 1px dashed transparent; transition: all 0.2s;" onmouseover="this.style.borderBottomColor='var(--primary)'" onmouseout="this.style.borderBottomColor='transparent'">${client.name}</a>
                </td>
                <td>
                    <div>${client.phone || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted)">${client.email || '-'}</div>
                </td>
                <td style="max-width:200px; font-size:13px;">${client.address || '-'}</td>
                <td>${clientOrders.length}</td>
                <td>₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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

        // Only call navigate if we're not already on client-details
        // This prevents the infinite loop: navigate -> updateUI -> openClientDetails -> navigate
        if (this.currentView !== 'client-details') {
            this.navigate('client-details');
        }
        this.activeClientId = clientId;
        this.refreshClientDetails();
    },

    // Separated rendering logic to avoid recursion from updateUI -> navigate -> updateUI
    refreshClientDetails() {
        if (!this.activeClientId) return;
        const clientId = this.activeClientId;
        const client = this.data.clients.find(c => c.id == clientId);
        if (!client) return;

        document.getElementById('cd-client-name').innerText = client.name;

        const clientOrders = this.data.orders.filter(o => o.clientId == clientId);
        const totalBilled = clientOrders.reduce((sum, o) => sum + o.total, 0);

        const clientPayments = this.data.ledgerTransactions.filter(l => l.client_id == clientId && l.type === 'income');
        const totalPaid = clientPayments.reduce((sum, l) => sum + l.amount, 0);

        const balance = totalBilled - totalPaid;

        document.getElementById('cd-total-orders').innerText = clientOrders.length;
        document.getElementById('cd-total-billing').innerText = `₹${totalBilled.toLocaleString('en-IN')}`;
        document.getElementById('cd-balance').innerText = `₹${balance.toLocaleString('en-IN')}`;

        const balEl = document.getElementById('cd-balance');
        if (balance > 0) {
            balEl.style.color = '#ef4444';
        } else if (balance < 0) {
            balEl.style.color = '#38bdf8';
        } else {
            balEl.style.color = '#4ade80';
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
                <td style="font-family: monospace; font-weight: 500; color: var(--text-strong);">#${o.id.toString().slice(-6)}</td>
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

    openAddStockModal() {
        const select = document.getElementById('as-product');
        select.innerHTML = this.data.products.map(p => `<option value="${p.id}">${p.name} (${p.sku}) — Stock: ${p.stock}</option>`).join('');
        document.getElementById('add-stock-form').reset();
        this.openModal('add-stock-modal');
    },

    async handleAddStockSubmit(e) {
        e.preventDefault();
        const productId = document.getElementById('as-product').value;
        const quantity = parseInt(document.getElementById('as-quantity').value);

        if (!productId || !quantity || quantity < 1) {
            this.showToast('Please select a product and enter a valid quantity.', 'warning');
            return;
        }

        try {
            const resp = await fetch(`${this.API_URL}/products/${productId}/add-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity })
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('add-stock-modal');
                this.showToast(`Successfully added ${quantity} pieces to inventory.`, 'success');
            } else {
                this.showToast('Error adding stock.', 'error');
            }
        } catch (e) { console.error(e); }
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
                this.showToast('Error saving product.', 'error');
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
        const gstRate = parseFloat(document.getElementById('o-gst').value) || 0;
        
        const baseTotal = price * qty;
        const taxAmount = baseTotal * (gstRate / 100);
        const finalTotal = baseTotal + taxAmount;
        
        document.getElementById('o-tax-preview').value = '₹' + taxAmount.toFixed(2);
        document.getElementById('o-total-preview').value = '₹' + finalTotal.toFixed(2);
    },

    async handleOrderSubmit(e) {
        e.preventDefault();
        const productId = document.getElementById('o-product-select').value;
        const product = this.data.products.find(p => p.id == productId);
        const qty = parseInt(document.getElementById('o-quantity').value);

        if (product.stock < qty) {
            this.showToast('Not enough stock! Current stock: ' + product.stock + ' pieces.', 'warning');
            return;
        }

        const clientName = document.getElementById('o-client').value;
        let client = this.data.clients.find(c => c.name === clientName);

        if (!client) {
            this.showToast('Client not found. Please add the client first.', 'warning');
            return;
        }
        const clientId = client.id;

        const baseTotal = qty * product.price;
        const gstRate = parseFloat(document.getElementById('o-gst').value) || 0;
        const taxAmount = baseTotal * (gstRate / 100);
        const finalTotal = baseTotal + taxAmount;

        const orderData = {
            clientId: clientId,
            productId: productId,
            quantity: qty,
            total: finalTotal,
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
                this.showToast('Order created successfully!', 'success');
            } else {
                this.showToast('Failed to create order. Please try again.', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Server error while creating order.', 'error');
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
        document.getElementById('wholesaler-modal-title').innerText = 'Add New Supplier';
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
        document.getElementById('wholesaler-modal-title').innerText = 'Edit Supplier';
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
            title: 'Delete Supplier',
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

    calculateClothTotal() {
        const qty = parseFloat(document.getElementById('ci-quantity').value) || 0;
        const rate = parseFloat(document.getElementById('ci-rate').value) || 0;
        let baseCost = qty * rate;
        const gstRate = parseFloat(document.getElementById('ci-gst').value) || 0;
        if (gstRate > 0) {
            baseCost += baseCost * (gstRate / 100);
        }
        document.getElementById('ci-total').value = baseCost.toFixed(2);
    },

    async handleClothSubmit(e) {
        e.preventDefault();
        const billNo = document.getElementById('ci-bill').value.trim();
        const gstRate = parseFloat(document.getElementById('ci-gst').value) || 0;
        const notesStr = (billNo ? `Bill No: ${billNo}. ` : '') + (gstRate > 0 ? `Included ${gstRate}% GST. ` : '');

        const data = {
            wholesaler_id: document.getElementById('ci-wholesaler').value,
            cloth_type: document.getElementById('ci-type').value,
            quantity: parseFloat(document.getElementById('ci-quantity').value),
            unit: document.getElementById('ci-unit').value,
            price_per_unit: parseFloat(document.getElementById('ci-rate').value),
            total_cost: parseFloat(document.getElementById('ci-total').value),
            date_received: document.getElementById('ci-date').value,
            notes: notesStr
        };

        try {
            const resp = await fetch(`${this.API_URL}/cloth-inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                await this.loadAllData();
                this.closeModal('cloth-modal');
            }
        } catch (e) { console.error(e); }
    },

    async deleteClothItem(id) {
        this.showConfirm({
            title: 'Delete Fabric Receipt',
            message: 'Delete this fabric stock receipt? This cannot be undone.',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const resp = await fetch(`${this.API_URL}/cloth-inventory/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                        await this.loadAllData();
                        this.showToast('Fabric receipt deleted.', 'success');
                    } else {
                        this.showToast('Error deleting fabric receipt.', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    this.showToast('Server error while deleting.', 'error');
                }
            }
        });
    },

    // --- Manufacturing Actions ---
    openLotModal() {
        const select = document.getElementById('ml-source');
        if (this.data.clothInventory.length === 0) {
            this.showToast('Please add fabric stock first.', 'warning');
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
                this.showToast('Lot step updated successfully.', 'success');
            } else {
                this.showToast('Failed to update lot step.', 'error');
            }
        } catch (e) { 
            console.error(e); 
            this.showToast('Server error updating lot step.', 'error');
        }
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
        document.getElementById('fl-wastage').value = 0;
        document.getElementById('fl-comments').value = '';
        document.getElementById('fl-sizes').value = '';
        document.getElementById('fl-name').value = '';
        document.getElementById('fl-price').value = '';
        this._finishLotOriginalPieces = lot.current_pieces;

        this.openModal('finish-lot-modal');
    },

    updateFinishPieces() {
        const wastage = parseInt(document.getElementById('fl-wastage').value) || 0;
        const original = this._finishLotOriginalPieces || 0;
        document.getElementById('fl-pieces').value = Math.max(0, original - wastage);
    },

    async handleFinishLotSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('fl-lot-id').value;
        const wastage = parseInt(document.getElementById('fl-wastage').value) || 0;
        const data = {
            product_details: {
                name: document.getElementById('fl-name').value,
                sku: document.getElementById('fl-sku').value,
                category: document.getElementById('fl-category').value,
                fit: document.getElementById('fl-category').value,
                wash: 'Standard',
                sizes: document.getElementById('fl-sizes').value,
                price: parseFloat(document.getElementById('fl-price').value)
            },
            wastage: wastage,
            comments: document.getElementById('fl-comments').value,
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
                this.showToast('Lot finished and added to inventory!', 'success');
            } else {
                this.showToast('Failed to finish lot.', 'error');
            }
        } catch (e) { 
            console.error(e); 
            this.showToast('Server error finishing lot.', 'error');
        }
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

        // Reset first, then set defaults
        document.getElementById('transaction-form').reset();
        document.getElementById('txn-type').value = type;
        document.getElementById('txn-date').valueAsDate = new Date();

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
                        try {
                            const resp = await fetch(`${this.API_URL}/ledger`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(newTransaction)
                            });

                            if (resp.ok) {
                                await this.loadAllData();
                                this.closeModal('transaction-modal');
                                this.showToast('Payment recorded successfully!', 'success');
                                if (this.currentView === 'client-details' && this.activeClientId) {
                                    this.openClientDetails(this.activeClientId);
                                } else {
                                    this.navigate('accounts');
                                }
                            } else {
                                this.showToast('Failed to record payment.', 'error');
                            }
                        } catch (err) {
                            console.error(err);
                            this.showToast('Server error while recording payment.', 'error');
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
            this.showToast('Server error while saving transaction.', 'error');
        }
    },

    exportToExcel() {
        const wb = XLSX.utils.book_new();

        // 1. Dashboard Summary
        const receivables = this.data.clients.reduce((sum, c) => {
            const billed = this.data.orders.filter(o => o.clientId == c.id).reduce((s, o) => s + o.total, 0);
            const paid = this.data.ledgerTransactions.filter(l => l.client_id == c.id && l.type === 'income').reduce((s, l) => s + l.amount, 0);
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
            const paid = this.data.ledgerTransactions.filter(l => l.client_id == c.id && l.type === 'income').reduce((s, l) => s + l.amount, 0);
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
            this.showToast('Not enough stock! Current stock: ' + product.stock + ' pieces.', 'warning');
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
            const viewLabel = span ? span.innerText.toLowerCase() : '';
            const matchName = viewName === 'wholesalers' ? 'fabric' : (viewName === 'orders' ? 'order' : viewName);
            if (viewLabel.includes(matchName)) {
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
            'wholesalers': 'Fabric',
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

    initFinanceChart() {
        const ctx = document.getElementById('financeChart');
        if (!ctx) return;

        const data = this.getFinancialPerformanceData();

        if (this.financeChartInstance) this.financeChartInstance.destroy();

        this.financeChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.7)', // Revenue (Blue/Indigo)
                        'rgba(34, 197, 94, 0.7)'   // Profit (Green)
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

    getFinancialPerformanceData() {
        const revenue = this.data.ledgerTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = this.data.ledgerTransactions
            .filter(t => t.type === 'expense' || t.type === 'supplier_payment' || t.type === 'wastage')
            .reduce((sum, t) => sum + t.amount, 0);

        const profit = revenue - expenses;
        
        return {
            labels: ['Total Cost', 'Net Profit'],
            values: [expenses, Math.max(0, profit)]
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
            if (!this.financeChartInstance) {
                this.initFinanceChart();
            } else {
                this.financeChartInstance.update();
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
        
        let qty = order.quantity;
        let finalTotal = order.total;
        
        // Deduce base price and tax
        let baseRate = finalTotal / qty; // Default
        let gstAmount = 0;
        let gstLabel = '';
        let isGst = false;
        
        if (product && Math.abs(finalTotal - (product.price * qty * 1.05)) < 0.1) {
            baseRate = product.price;
            isGst = true;
            gstAmount = (baseRate * qty) * 0.05;
            gstLabel = '5%';
        } else if (product && Math.abs(finalTotal - (product.price * qty * 1.025)) < 0.1) {
            baseRate = product.price;
            isGst = true;
            gstAmount = (baseRate * qty) * 0.025;
            gstLabel = '2.5%';
        } else if (product && Math.abs(finalTotal - (product.price * qty)) < 0.1) {
            baseRate = product.price;
        } else {
            // Infer if it looks like a 105% or 102.5% multiple
            let approxBase5 = finalTotal / 1.05;
            let approxBase25 = finalTotal / 1.025;
            
            if (Math.abs(approxBase5 - Math.round(approxBase5)) < 0.01) {
                baseRate = approxBase5 / qty;
                isGst = true;
                gstAmount = approxBase5 * 0.05;
                gstLabel = '5%';
            } else if (Math.abs(approxBase25 - Math.round(approxBase25)) < 0.01) {
                baseRate = approxBase25 / qty;
                isGst = true;
                gstAmount = approxBase25 * 0.025;
                gstLabel = '2.5%';
            }
        }
        
        let baseTotal = baseRate * qty;
        
        const numberToWords = (num) => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            if ((num = num.toString()).length > 9) return 'overflow';
            let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return;
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
            return str.trim() === 'Only' ? 'Zero Only' : str;
        };

        const paper = document.getElementById('invoice-paper');
        paper.innerHTML = `
            <div class="indian-invoice">
                <div class="invoice-header">
                    <div style="text-align:center; width:100%;">
                        <h2 style="margin:0; font-size: 24px; text-transform: uppercase; color: #1e293b;">Tax Invoice</h2>
                    </div>
                </div>
                <div class="company-details" style="display:flex; justify-content:space-between; margin-top:1rem; border-bottom:2px solid #1e293b; padding-bottom:1rem;">
                    <div>
                        <h1 style="margin:0; font-size: 28px; color: #0f172a; font-family: sans-serif; letter-spacing: 1px;">SPY GARMENTS</h1>
                        <p style="margin:2px 0; color: #475569; font-weight: 500;">Premium Wholesale Jeans & Clothing</p>
                        <p style="margin:2px 0; font-size: 12px;">Industrial Estate, GIDC, Ahmedabad, Gujarat</p>
                        <p style="margin:2px 0; font-size: 12px;">Contact: +91 98765 43210</p>
                        <p style="margin:2px 0; font-size: 13px;"><strong>GSTIN:</strong> 24AAAAA0000A1Z5</p>
                    </div>
                    <div style="text-align: right; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:2px 0; font-size: 14px;"><strong>Invoice No:</strong> #INV-${order.id.toString().padStart(5, '0')}</p>
                        <p style="margin:2px 0; font-size: 14px;"><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p>
                        <p style="margin:2px 0; font-size: 14px;"><strong>Status:</strong> ${order.status}</p>
                    </div>
                </div>

                <div class="client-details" style="display:flex; justify-content:space-between; margin-top:1rem; margin-bottom:1rem;">
                    <div style="width: 48%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
                        <p style="margin:0; font-weight:bold; border-bottom:1px solid #e2e8f0; padding-bottom:5px; margin-bottom:5px; color:#1e293b;">Billed To:</p>
                        <p style="margin:2px 0; font-weight:700; font-size:16px; color:#0f172a;">${client ? client.name : 'Unknown Client'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;">${client ? (client.address || 'Address not specified') : 'Address not specified'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;"><strong>Phone:</strong> ${client ? (client.phone || 'N/A') : 'N/A'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;"><strong>GSTIN:</strong> URB (Unregistered)</p>
                    </div>
                    <div style="width: 48%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
                        <p style="margin:0; font-weight:bold; border-bottom:1px solid #e2e8f0; padding-bottom:5px; margin-bottom:5px; color:#1e293b;">Shipped To:</p>
                        <p style="margin:2px 0; font-weight:700; font-size:16px; color:#0f172a;">${client ? client.name : 'Unknown Client'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;">${client ? (client.address || 'Address not specified') : 'Address not specified'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;"><strong>Phone:</strong> ${client ? (client.phone || 'N/A') : 'N/A'}</p>
                    </div>
                </div>

                <table class="inv-table indian-table" style="width:100%; border-collapse: collapse; margin-bottom: 0;">
                    <thead style="background: #e2e8f0; border: 1px solid #cbd5e1;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">S.No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">Description of Goods</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">HSN/SAC</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">Qty</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">Rate (₹)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px; text-align: right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:center; color:#334155;">1</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px;">
                                <strong style="color:#0f172a;">${product ? product.name : 'Jeans Article'}</strong><br>
                                <span style="font-size: 11px; color: #64748b;">SKU: ${product ? product.sku : '-'} | Fit: ${product ? product.fit : '-'} | Size: ${product ? product.sizes : '-'}</span>
                            </td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:center; color:#334155;">6203</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:center; color:#334155;">${qty} Pcs</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:right; color:#334155;">${baseRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:right; color:#334155; font-weight:600;">${baseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="height: 60px;">
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                        </tr>
                    </tbody>
                </table>

                <div style="display:flex; border: 1px solid #cbd5e1; border-top: none;">
                    <div style="flex: 1; padding: 10px; border-right: 1px solid #cbd5e1;">
                        <p style="margin:0 0 5px 0; color:#1e293b; font-size:12px;"><strong>Declaration:</strong></p>
                        <p style="margin:0; font-size:11px; color:#475569;">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                        
                        <div style="margin-top:15px;">
                            <p style="margin:0 0 5px 0; color:#1e293b; font-size:12px;"><strong>Terms & Conditions:</strong></p>
                            <ul style="margin:0; padding-left:15px; font-size:10px; color:#475569;">
                                <li>Goods once sold will not be taken back.</li>
                                <li>Subject to Ahmedabad Jurisdiction only.</li>
                                <li>E.& O.E.</li>
                            </ul>
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #cbd5e1; padding: 8px 10px; color:#334155;">
                            <span>Total Taxable Value</span>
                            <strong>₹${baseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        ${isGst ? `
                        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #cbd5e1; padding: 6px 10px; color:#475569; font-size:13px;">
                            <span>GST @ ${gstLabel}</span>
                            <span>₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        ` : ''}
                        <div style="display:flex; justify-content:space-between; padding: 10px; background: #e2e8f0; font-size: 18px; color:#0f172a;">
                            <strong>Grand Total</strong>
                            <strong>₹${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                </div>
                
                <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px; background:#f8fafc;">
                    <p style="margin:0; font-size: 13px; color:#475569;"><strong>Amount in Words:</strong></p>
                    <p style="margin:5px 0 0 0; font-size: 15px; font-weight: 600; color:#1e293b; text-transform:capitalize;">${numberToWords(Math.round(finalTotal))} Rupees Only</p>
                </div>

                <div style="display:flex; border: 1px solid #cbd5e1; border-top:none;">
                    <div style="flex: 1.5; padding: 10px; border-right: 1px solid #cbd5e1; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:0; font-size:12px; color:#475569; border-top:1px dashed #cbd5e1; padding-top:5px; width:200px; text-align:center;">Receiver's Signature</p>
                    </div>
                    <div style="flex: 1; padding: 10px; text-align:center; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:0 0 40px 0; font-weight:bold; font-size:13px; color:#0f172a;">For SPY GARMENTS</p>
                        <p style="margin:0; font-size:12px; border-top:1px solid #cbd5e1; padding-top:5px; color:#475569;">Authorized Signatory</p>
                    </div>
                </div>
            </div>
        `;

        this.openModal('invoice-overlay');
    },

    printFabricBill(inventoryId) {
        const item = this.data.clothInventory.find(c => c.id == inventoryId);
        if (!item) return;

        let finalTotal = item.total_cost;
        let baseCost = item.quantity * item.price_per_unit;
        let taxAmount = finalTotal - baseCost;
        let hasGst = taxAmount > 0;
        let gstAmount = taxAmount;
        
        let wholesaler = this.data.wholesalers.find(w => w.id == item.wholesaler_id);

        const numberToWords = (num) => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            if ((num = num.toString()).length > 9) return 'overflow';
            let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return;
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
            return str.trim() === 'Only' ? 'Zero Only' : str;
        };

        const paper = document.getElementById('invoice-paper');
        paper.innerHTML = `
            <div class="indian-invoice">
                <div class="invoice-header">
                    <div style="text-align:center; width:100%;">
                        <h2 style="margin:0; font-size: 24px; text-transform: uppercase; color: #1e293b;">Fabric Stock Receipt</h2>
                    </div>
                </div>
                <div class="company-details" style="display:flex; justify-content:space-between; margin-top:1rem; border-bottom:2px solid #1e293b; padding-bottom:1rem;">
                    <div>
                        <h1 style="margin:0; font-size: 28px; color: #0f172a; font-family: sans-serif; letter-spacing: 1px;">SPY GARMENTS</h1>
                        <p style="margin:2px 0; color: #475569; font-weight: 500;">Premium Wholesale Jeans & Clothing</p>
                        <p style="margin:2px 0; font-size: 12px;">Industrial Estate, GIDC, Ahmedabad, Gujarat</p>
                        <p style="margin:2px 0; font-size: 12px;">Contact: +91 98765 43210</p>
                        <p style="margin:2px 0; font-size: 13px;"><strong>GSTIN:</strong> 24AAAAA0000A1Z5</p>
                    </div>
                    <div style="text-align: right; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:2px 0; font-size: 14px;"><strong>Receipt No:</strong> #FB-${item.id.toString().padStart(4, '0')}</p>
                        <p style="margin:2px 0; font-size: 14px;"><strong>Date:</strong> ${new Date(item.date_received).toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="client-details" style="display:flex; justify-content:space-between; margin-top:1rem; margin-bottom:1rem;">
                    <div style="width: 48%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
                        <p style="margin:0; font-weight:bold; border-bottom:1px solid #e2e8f0; padding-bottom:5px; margin-bottom:5px; color:#1e293b;">Supplier Information:</p>
                        <p style="margin:2px 0; font-weight:700; font-size:16px; color:#0f172a;">${item.wholesaler_name || 'Unknown'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;">${wholesaler ? (wholesaler.address || 'Address not specified') : 'Address not specified'}</p>
                        <p style="margin:2px 0; font-size: 13px; color:#334155;"><strong>Phone:</strong> ${wholesaler ? (wholesaler.phone || 'N/A') : 'N/A'}</p>
                    </div>
                    <div style="width: 48%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc; display:flex; flex-direction:column; justify-content:center;">
                        <p style="margin:0; text-align:center; color:#64748b; font-size:14px; font-style:italic;">Internal Stock Entry Record</p>
                        <p style="margin:5px 0 0 0; text-align:center; font-size:12px; color:#1e293b;">Ref Lot: ${item.bill_no || 'N/A'}</p>
                    </div>
                </div>

                <table class="inv-table indian-table" style="width:100%; border-collapse: collapse; margin-bottom: 0;">
                    <thead style="background: #e2e8f0; border: 1px solid #cbd5e1;">
                        <tr>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">S.No</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px;">Fabric Type / Description</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px; text-align:right;">Quantity</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px; text-align:right;">Rate (₹)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; color:#1e293b; font-size:13px; text-align: right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:center; color:#334155;">1</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px;">
                                <strong style="color:#0f172a;">${item.cloth_type}</strong>
                            </td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:right; color:#334155;">${item.quantity} ${item.unit}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:right; color:#334155;">${item.price_per_unit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align:right; color:#334155; font-weight:600;">${baseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr style="height: 60px;">
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                            <td style="border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;"></td>
                        </tr>
                    </tbody>
                </table>

                <div style="display:flex; border: 1px solid #cbd5e1; border-top: none;">
                    <div style="flex: 1; padding: 10px; border-right: 1px solid #cbd5e1;">
                        <p style="margin:0 0 5px 0; color:#1e293b; font-size:12px;"><strong>Internal Notes:</strong></p>
                        <p style="margin:0; font-size:11px; color:#475569;">${item.notes || 'No internal notes recorded for this stock entry.'}</p>
                    </div>
                    <div style="flex: 1;">
                        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #cbd5e1; padding: 8px 10px; color:#334155;">
                            <span>Base Value</span>
                            <strong>₹${baseCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        ${hasGst ? `
                        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #cbd5e1; padding: 6px 10px; color:#475569; font-size:13px;">
                            <span>GST</span>
                            <span>₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        ` : ''}
                        <div style="display:flex; justify-content:space-between; padding: 10px; background: #e2e8f0; font-size: 18px; color:#0f172a;">
                            <strong>Grand Total Cost</strong>
                            <strong>₹${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                </div>
                
                <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px; background:#f8fafc;">
                    <p style="margin:0; font-size: 13px; color:#475569;"><strong>Amount in Words:</strong></p>
                    <p style="margin:5px 0 0 0; font-size: 15px; font-weight: 600; color:#1e293b; text-transform:capitalize;">${numberToWords(Math.round(finalTotal))} Rupees Only</p>
                </div>

                <div style="display:flex; border: 1px solid #cbd5e1; border-top:none;">
                    <div style="flex: 1.5; padding: 10px; border-right: 1px solid #cbd5e1; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:0; font-size:12px; color:#475569; border-top:1px dashed #cbd5e1; padding-top:5px; width:200px; text-align:center;">Store Keeper Sign</p>
                    </div>
                    <div style="flex: 1; padding: 10px; text-align:center; display:flex; flex-direction:column; justify-content:flex-end;">
                        <p style="margin:0 0 40px 0; font-weight:bold; font-size:13px; color:#0f172a;">For SPY GARMENTS</p>
                        <p style="margin:0; font-size:12px; border-top:1px solid #cbd5e1; padding-top:5px; color:#475569;">Authorized Signatory</p>
                    </div>
                </div>
            </div>
        `;

        this.openModal('invoice-overlay');
        setTimeout(() => window.print(), 500);
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
                this.showToast('Payment verified and profit recorded in ledger.', 'success');
            } else {
                this.showToast('Error verifying payment.', 'error');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Server error while verifying payment.', 'error');
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
