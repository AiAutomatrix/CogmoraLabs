# Real-Time Worker Engine: Architecture & Overview

This document provides a comprehensive overview of the `realtime-worker`, the persistent, 24/7 service that forms the reactive backbone of the Cogmora Labs paper trading engine. This version represents a significant architectural milestone, achieving high performance and stability.

## 1. Core Mission: The System's Reflexes

The worker's primary goal is to provide **instantaneous reaction** to live market data. It is the "always-on" component that executes trades and manages risk the moment a price condition is met, operating independently of any user's active session.

Its responsibilities include:
-   **Executing Stop-Loss/Take-Profit Orders**: Instantly marks open positions for closure when SL/TP levels are hit.
-   **Executing Conditional Trade Triggers**: Instantly fires triggers to create new positions when market prices cross their targets.
-   **Maintaining Live Data Connections**: Manages persistent WebSocket connections to KuCoin's spot and futures markets.

## 2. Key Architectural Principle: In-Memory Caching

The worker's high performance is achieved by minimizing slow database operations during the critical path of processing a price tick.

-   **The "Slow Path" (`collectAllSymbols`)**: On a recurring interval (e.g., every 30 seconds), this function performs the only major database read. It uses efficient `collectionGroup` queries to fetch all `openPositions` and `tradeTriggers` from every user in Firestore.
-   **In-Memory Maps**: The data from Firestore is loaded into two critical in-memory `Map` objects:
    -   `openPositionsBySymbol`: A map where each key is a trading symbol (e.g., "BTC-USDT") and the value is an array of all open positions for that symbol.
    -   `tradeTriggersBySymbol`: A similar map for all active trade triggers.
-   **The "Fast Path" (`processPriceUpdate`)**: This function is triggered for every incoming price tick from the WebSockets. It performs **zero database reads**. Instead, it does a near-instant lookup in the in-memory maps for the relevant symbol and checks all associated positions and triggers against the new price.

This separation of "slow" data collection from "fast" data processing is the key to the worker's ability to handle a high volume of real-time events without latency.

## 3. The `WebSocketManager` Class

This class is a robust, self-healing manager for a single WebSocket connection. The worker runs two instances of it: one for spot and one for futures.

### Core Features:
-   **Token Management**: Automatically fetches and caches connection tokens from the KuCoin API, with a retry mechanism for network failures.
-   **Connection Lifecycle**: The `ensureConnected()` method handles the entire connection process. It only attempts to connect if there are symbols to subscribe to, saving resources.
-   **Subscription Management**: The `updateDesired()` method intelligently adds or removes topic subscriptions without dropping the connection, ensuring the worker is always listening to the correct set of symbols identified by `collectAllSymbols`.
-   **Heartbeat & Health Checks**: The manager sends periodic `ping` messages and listens for `pong` responses to ensure the connection is alive. If no activity is detected within a certain threshold, it assumes the connection is stale and triggers a forced reconnection.
-   **Automatic Reconnect**: If the connection drops for any reason, the manager automatically attempts to reconnect using an exponential backoff strategy to avoid overwhelming the API.

## 4. Execution Flow

The worker operates in a continuous, orchestrated loop:

1.  **Startup**: The `startSession()` function is called, which initiates the main loops.
2.  **Data Collection**: `collectAllSymbols()` runs immediately and then every 30 seconds thereafter. It queries Firestore and populates the in-memory maps.
3.  **Subscription Update**: `collectAllSymbols()` calls `updateDesired()` on the `spot` and `futures` managers, which subscribe to the necessary WebSocket topics.
4.  **Receive Price Tick**: The `onMessage` handler in the `WebSocketManager` receives a price update.
5.  **Process Update**: `processPriceUpdate()` is called with the symbol and new price.
6.  **In-Memory Check**: The function looks up the symbol in the `openPositionsBySymbol` and `tradeTriggersBySymbol` maps.
7.  **Condition Evaluation**: It iterates through the cached positions and triggers, checking if any SL/TP or target price conditions are met.
8.  **Action via Transaction**: If a condition is met, the worker initiates a **Firestore Transaction** to guarantee atomicity.
    -   For a SL/TP, it updates the `openPosition` document's status to `'closing'`. This write automatically triggers the `closePositionHandler` Cloud Function to do the final accounting.
    -   For a trade trigger, it creates a new document in the `executedTriggers` subcollection and deletes the original `tradeTrigger` document. This, in turn, activates the `openPositionHandler` Cloud Function to create the new trade.

This architecture creates a powerful, scalable, and resilient real-time engine that forms the core of our autonomous trading system.