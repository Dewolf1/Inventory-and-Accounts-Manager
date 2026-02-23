# Spy Garments Wholesale System

A premium, all-in-one manufacturing and inventory management suite for garment businesses.

## Quick Start

To launch the entire application (Backend + Frontend), run:

```bash
npm start
```

- **Dashboard**: [http://localhost:5000](http://localhost:5000)
- **API Server**: [http://localhost:3000](http://localhost:3000)

## Core Modules

### 1. Manufacturing Pipeline
Track items through a multi-step production workflow:
`Cutting` → `Stitching` → `Kaj` → `Washing` → `Packing`

- **Visual Step-Pipeline**: Real-time horizontal progress tracking.
- **Wastage Management**: Record losses at each stage with direct ledger impact.
- **Auto-Inventory**: Completed lots are automatically converted into saleable articles.

### 2. Wholesaler & Debt Tracker
- **Cloth Management**: Log raw material receipts from wholesalers.
- **Total Payables**: Monitor exact money owed to suppliers directly from the dashboard.
- **Individual Balances**: Track detailed debt profiles for every wholesaler.

### 3. Client & Revenue Hub
- **Interactive Profiles**: Detailed transaction and invoice history for every client.
- **Receivables Tracking**: Monitor pending payments from sales.
- **Linked Accounts**: All sales and payments are automatically synced to the primary company ledger.

---

## Database Structure & Flow

The system uses a relational SQLite database (`spy_garments.db`) to manage the business lifecycle:

### Core Tables
- **Clients & Wholesalers**: Direct contact and balance management.
- **Cloth Inventory**: Raw materials tracking linked to wholesalers.
- **Manufacturing Lots**: Work-in-progress (WIP) pipeline from cutting to packing.
- **Products**: Finished goods ready for wholesale.
- **Orders**: Sales transactions linked to clients and products.
- **Ledger Transactions**: The central financial hub recording all income (sales), expenses (purchases), and wastage.

### Application Flow
1. **Raw Material**: Purchase cloth from **Wholesalers**.
2. **Production**: Start a **Manufacturing Lot** using cloth. Track pieces and wastage through the pipeline.
3. **Inventory**: Finished lots automatically move to **Products** stock.
4. **Sales**: Create **Orders** for **Clients**. This reduces stock and creates a pending bill.
5. **Accounting**: Verify payments for orders. This clears client balance and logs **Income** in the **Ledger**.

---
Built with Node.js, Express, and Vanilla JS.
