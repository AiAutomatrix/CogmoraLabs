# Real-Time Paper Trading Engine Architecture (Cloud Run)

This document outlines the architecture for the persistent, real-time paper trading engine that runs as a 24/7 service on Google Cloud Run. Its primary responsibility is to execute stop-loss, take-profit, and conditional trade triggers instantly as market prices change.

---

## 1. Core Goal

To provide an "always-on" backend service that can react to live market data in milliseconds. This is the component responsible for the real-time "reflexes" of the trading system, which cannot be handled by event-driven Cloud Functions.

-   **Execute SL/TP**: Continuously monitor all open positions across all users and close them instantly if a stop-loss or take-profit price is hit.
-   **Execute Trade Triggers**: Continuously monitor all active trade triggers and execute the corresponding buy/long/short action the moment a price condition is met.
-   **Live Account Metrics**: While the frontend provides live updates, this backend ensures that the foundational trade execution happens reliably, 24/7, even when the user's app is closed.

---

## 2. Architecture & Components

The engine is a single, stateful Node.js application running inside a Docker container, managed by Google Cloud Run.

-   **Google Cloud Run Service**: The application is deployed as a Cloud Run service with the `--min-instances=1` flag. This is critical as it forces the container to run continuously, allowing it to maintain a persistent state (like a live WebSocket connection).
-   **Firestore Database**: The worker uses the **Firebase Admin SDK** to securely connect to the entire Firestore database with full admin privileges. It treats Firestore as its single source of truth.
-   **Persistent WebSocket Connection**: The core of the worker is a single, long-lived WebSocket connection to KuCoin's public API. It subscribes to the multiplexed `/market/ticker:all` topic, which streams real-time price updates for all symbols in a single feed.

---

## 3. Data Flow & Logic

The worker operates in a continuous loop:

1.  **Initialization**:
    -   On container startup, the Node.js application initializes the Firebase Admin SDK, giving it secure access to the Firestore database.
    -   It makes a `POST` request to KuCoin's API to get a public WebSocket connection token.
    -   It uses this token to establish a persistent WebSocket connection to the KuCoin feed and subscribes to the `/market/ticker:all` topic.

2.  **Receiving Price Ticks**:
    -   The worker's `onmessage` handler for the WebSocket receives a constant stream of price updates. Each message contains a symbol (e.g., `BTC-USDT`) and its new price.

3.  **Database Query & Condition Check**:
    -   For each incoming price tick, the worker performs **two parallel, highly-efficient queries** against the entire Firestore database:
        1.  **Query Open Positions**: It finds all `openPositions` across all users where the `symbol` matches the incoming tick and a stop-loss or take-profit level is set. It then checks if the new price breaches any of these levels.
        2.  **Query Trade Triggers**: It finds all `tradeTriggers` across all users where the `symbol` matches and the status is `active`. It then checks if the new price meets the trigger's condition (e.g., price is below the `targetPrice`).

4.  **Taking Action**:
    -   **If a Stop-Loss/Take-Profit is Hit**: The worker finds the corresponding `openPosition` document in Firestore and updates its `details.status` field to `'closing'`.
    -   **If a Trade Trigger is Hit**: The worker executes the trade by creating a new `openPosition` and `tradeHistory` record, updating the user's `balance`, and deleting the `tradeTrigger` document—all within a single atomic transaction to ensure data integrity.

5.  **Triggering the `closePositionHandler`**:
    -   When the worker updates a position's status to `'closing'`, this automatically invokes the `closePositionHandler` Cloud Function we've already built. That function then reliably handles the final P&L calculation and balance update, separating the real-time detection logic (in Cloud Run) from the financial settlement logic (in Cloud Functions).

This architecture creates a robust, scalable, and truly real-time system that complements our event-driven Cloud Functions perfectly.
