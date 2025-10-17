# Real-Time Paper Trading Engine Architecture (Cloud Run)

This document outlines the architecture for the persistent, real-time paper trading engine that runs as a 24/7 service on Google Cloud Run. Its primary responsibility is to execute stop-loss, take-profit, and conditional trade triggers instantly as market prices change for both **spot and futures** markets.

---

## 1. Core Goal

To provide an "always-on" backend service that can react to live market data in milliseconds. This is the component responsible for the real-time "reflexes" of the trading system, which cannot be handled by event-driven Cloud Functions.

-   **Execute SL/TP**: Continuously monitor all open positions (spot and futures) across all users and close them instantly if a stop-loss or take-profit price is hit.
-   **Execute Trade Triggers**: Continuously monitor all active trade triggers (spot and futures) and execute the corresponding buy/long/short action the moment a price condition is met.
-   **Live Data Monitoring**: The engine does not calculate account metrics itself; rather, it *causes* the updates that the frontend and other backend functions react to. Its sole job is to watch prices and write to the database when a condition is met.

---

## 2. Architecture & Components

The engine is a single, stateful Node.js application running inside a Docker container, managed by Google Cloud Run.

-   **Google Cloud Run Service**: Deployed with `--min-instances=1` to ensure it runs continuously.
-   **Firestore Database**: Uses the **Firebase Admin SDK** to securely connect to the entire Firestore database with full admin privileges.
-   **Dual Persistent WebSocket Connections**: The core of the worker is two long-lived WebSocket connections to KuCoin's public APIs:
    1.  **Spot WebSocket**: Connects to the KuCoin Spot feed.
    2.  **Futures WebSocket**: Connects to the KuCoin Futures feed.

---

## 3. Data Flow & Logic

The worker operates in a continuous loop, managing both WebSocket connections simultaneously.

1.  **Initialization**:
    -   On container startup, the worker initializes the Firebase Admin SDK.
    -   It fetches public WebSocket connection tokens for both the Spot and Futures APIs.
    -   It establishes and maintains two persistent WebSocket connections.

2.  **Dynamic Subscriptions (The Smart Part)**:
    -   On a recurring timer (e.g., every 30 seconds), the worker queries the entire Firestore database to get a fresh list of **all symbols** currently present in every user's `openPositions`, `tradeTriggers`, and `watchlist`.
    -   It builds two unique sets of symbols: one for spot and one for futures.
    -   It compares these sets to its currently active subscriptions and intelligently sends `subscribe` or `unsubscribe` messages over the appropriate WebSocket to ensure it's only listening to symbols that are actively being tracked by at least one user. This is highly efficient.

3.  **Receiving Price Ticks**:
    -   The `onmessage` handlers for both WebSockets receive a constant stream of price updates. Each message contains a symbol and its new price.

4.  **Database Query & Condition Check**:
    -   For each incoming price tick (from either WebSocket), the worker performs **two parallel, highly-efficient queries** against the entire Firestore database:
        1.  **Query Open Positions**: It finds all `openPositions` across all users where the `symbol` matches the incoming tick and a stop-loss or take-profit level is set. It then checks if the new price breaches any of these levels.
        2.  **Query Trade Triggers**: It finds all `tradeTriggers` across all users where the `symbol` matches and the status is `active`. It then checks if the new price meets the trigger's condition.

5.  **Taking Action**:
    -   **If a Stop-Loss/Take-Profit is Hit**: The worker updates the corresponding `openPosition` document's `details.status` field to `'closing'`.
    -   **If a Trade Trigger is Hit**: The worker executes the trade by creating a new `openPosition` and `tradeHistory` record, updating the user's `balance`, and deleting the `tradeTrigger` document—all within a single atomic transaction.

6.  **Activating the `closePositionHandler`**:
    -   When the worker updates a position's status to `'closing'`, this automatically invokes the `closePositionHandler` Cloud Function we've already designed. That separate function then reliably handles the final P&L calculation and balance update.

This architecture creates a robust, scalable, and truly real-time system that handles both spot and futures markets, complementing our event-driven Cloud Functions perfectly.
