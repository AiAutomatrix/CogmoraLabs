# Paper Trading System Documentation

This document outlines the architecture and functionality of the comprehensive paper trading feature within the Cogmora Labs application. It enables users to simulate both spot and leveraged futures cryptocurrency trades using live market data from KuCoin without risking real money.

## Core Architecture: A Hybrid Client-Server Model

The paper trading engine is a sophisticated hybrid system that intelligently combines a real-time client-side interface with a powerful autonomous backend.

### 1. The Client-Side Engine: `PaperTradingContext.tsx`

This is the heart and brain of the user-facing application, providing an instant, responsive experience.

-   **State Management**: It manages the user's entire trading state (`balance`, `openPositions`, `tradeHistory`, `watchlist`, `priceAlerts`, `tradeTriggers`, and all automation settings) and syncs it with Firestore in real-time.
-   **Live UI Updates**: It establishes its own WebSocket connections to KuCoin's spot and futures feeds. This allows the UI to display live prices and P&L updates without waiting for a backend.
-   **Trade Initiation**: When a user manually initiates a trade, the `PaperTradingContext` executes the initial write to the database.

### 2. The Backend Engine (Cloud Functions & Cloud Run)

This is the autonomous, 24/7 part of the system that works even when the user's app is closed.

-   **Scheduled Automation (Cloud Functions)**:
    -   **AI Agent**: A scheduled function runs the AI analysis (`proposeTradeTriggers` flow) based on the user's `aiSettings` in Firestore.
    -   **Watchlist Scraper**: A scheduled function runs the watchlist automation based on the `automationConfig` in Firestore.
-   **Real-Time Trigger Execution (Cloud Run)**:
    -   A persistent, always-on service maintains its own WebSocket connections to KuCoin.
    -   It constantly monitors all users' `tradeTriggers` and open positions' SL/TP levels in Firestore.
    -   The moment a price condition is met, this service executes the trade or closes the position by writing directly to the database.
-   **Reliable Position Closing (Cloud Functions)**:
    -   A `closePositionHandler` function is automatically triggered whenever any position (closed either by the user or the real-time worker) is marked for closing. It securely calculates P&L and finalizes the database transaction.

## Real-Time Data Flow

1.  **Client-Side**: The `PaperTradingContext` connects to WebSockets to provide a live UI. It dynamically subscribes to symbols based on what the user is currently viewing or trading.
2.  **Server-Side**: The **Cloud Run worker** maintains its own WebSocket connections, dynamically subscribing to all symbols that *any* user has in an open position, trigger, or watchlist, ensuring nothing is missed.
3.  **Synchronization**: Both the client and the server write to and read from the same **Firestore database**. When the backend Cloud Run worker executes a trade, it writes to Firestore. The `onSnapshot` listeners in the user's client-side app immediately pick up this change and update the UI in real-time, making it appear as if the trade happened directly in the app.

## Advanced Features

-   **Price Alerts**: Users can set price targets on watchlist items. The client-side context checks these alerts on every price update and fires a toast notification.
-   **Trade Triggers**: Users create conditional orders. These are saved to Firestore, where they are monitored and executed 24/7 by the **Cloud Run worker**.
-   **Stop Loss / Take Profit**: SL/TP levels are saved to an open position's document in Firestore. They are also monitored and executed 24/7 by the **Cloud Run worker**.
-   **Watchlist Automation**: Users configure rules in the UI. The settings are saved to Firestore and executed on a schedule by a **Cloud Function**.
-   **AI Agent Automation**: Users configure the AI agent's schedule in the UI. The settings are saved to Firestore and executed on a schedule by a **Cloud Function**.
