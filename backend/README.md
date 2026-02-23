# Spy Garments Backend

This is the Node.js backend for the Spy Garments Inventory System.

## How to Run the Application

To launch both the Backend and Frontend simultaneously, run the following command from the root directory:

```bash
npm start
```

- **Frontend**: Available at [http://localhost:5000](http://localhost:5000)
- **Backend API**: Running on [http://localhost:3000](http://localhost:3000)

> [!NOTE]
> The application will automatically serve the UI and start the SQLite database backend.

## Key Features
- **Manufacturing Workflow**: track pieces through Cutting, Stitching, Kaj, Washing, and Packing.
- **Wholesaler Management**: Maintain raw cloth inventory and track payments/debts.
- **Client Profiles**: Dedicated dashboards for client order history and ledgers.
- **Automated Accounts**: Real-time stats for Receivables and Payables.
- **Payment Verification**: Dedicated workflow for verifying order payments and recording income.
- **Financial Ledger**: Automatic tracking of revenue, expenses, and wastage.
- **Dedicated Database**: Uses SQLite for persistent storage of products, orders, clients, and ledger transactions.
- **Mock Authentication**: Simple admin login for local testing.
- **Persistent Storage**: Data is saved in `spy_garments.db`.

## Setup Instructions

1.  **Prerequisites**: Ensure you have Node.js and npm installed (see `requirements.txt`).
2.  **Installation**:
    ```bash
    cd backend
    npm install
    ```
3.  **Running the Server**:
    ```bash
    npm start
    ```
    The server will run at `http://localhost:3000`.

## API Endpoints

### Authentication
- `POST /api/login`: 
    - Body: `{ "username": "admin", "password": "admin123" }`
    - Response: `{ "token": "...", "user": { ... } }`

### Clients
- `GET /api/clients`: Retrieve all clients.
- `POST /api/clients`: Add a new client.
- `PUT /api/clients/:id`: Update a client.
- `DELETE /api/clients/:id`: Remove a client.

### Orders
- `GET /api/orders`: Retrieve all orders.
- `POST /api/orders`: Create a new order.
- `PUT /api/orders/:id`: Update order status.
- `DELETE /api/orders/:id`: Remove an order.
- `POST /api/orders/:id/verify`: Verify payment for an order and record in ledger.
    - Body: `{ "paymentMethod": "...", "paymentRef": "...", "paymentDate": "..." }`

### Washing
- `GET /api/washing`: Retrieve all washing batches.
- `POST /api/washing`: Create a new batch.
- `PUT /api/washing/:id`: Update batch status.
- `DELETE /api/washing/:id`: Remove a batch.

### Ledger
- `GET /api/ledger`: Retrieve all financial transactions.
- `POST /api/ledger`: Add a transaction (income/expense/wastage).
- `DELETE /api/ledger/:id`: Remove a transaction.

## Data Structure
The application uses **SQLite** with tables for `products`, `clients`, `orders`, `washing_batches`, and `ledger_transactions`.
