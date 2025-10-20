# Paper Trading System Documentation

This document outlines the architecture and functionality of the comprehensive paper trading feature within the Cogmora Labs application. It enables users to simulate both spot and leveraged futures cryptocurrency trades using live market data from KuCoin without risking real money.

## Core Architecture: A Hybrid Client-Server Model

The paper trading engine is a sophisticated hybrid system that intelligently combines a real-time client-side interface with a powerful autonomous backend. **Firestore** serves as the central "source of truth," synchronizing the state between the user's live session and the 24/7 backend workers.

### 1. The Client-Side Engine: `PaperTradingContext.tsx`

This is the heart and brain of the user-facing application, providing an instant, responsive experience. Its primary job is to make the app *feel* live for the active user.

-   **State Management & Hydration**: On initial load, it subscribes to the user's data in Firestore using real-time `onSnapshot` listeners. This "hydrates" the local React state with the latest account information (`balance`, `openPositions`, `watchlist`, etc.), ensuring the app starts with the most current data.
-   **Live UI Updates**: For the symbols the user is actively trading or watching, it establishes its *own* direct WebSocket connections to KuCoin's spot and futures feeds. This allows the UI to display live prices and P&L updates without waiting for a backend round-trip, creating a snappy, real-time feel. All price-tick updates happen directly in the client's state.
-   **Trade Initiation**: When a user manually initiates a trade or sets a trigger, the `PaperTradingContext` executes the initial write to the Firestore database.

### 2. The Backend Engine (Cloud Functions & Cloud Run)

This is the autonomous, 24/7 part of the system that operates even when the user's app is closed. Its job is to ensure that no trading opportunity or risk management action is ever missed.

-   **Scheduled Automation (Cloud Functions)**:
    -   **AI Agent**: A scheduled function runs the AI analysis (`proposeTradeTriggers` flow) based on the user's `aiSettings` in Firestore.
    -   **Watchlist Scraper**: A scheduled function runs the watchlist automation based on the `automationConfig` in Firestore.
-   **Real-Time Trigger Execution (Cloud Run)**:
    -   A persistent, always-on service maintains its own WebSocket connections to KuCoin.
    -   It constantly monitors all users' `tradeTriggers` and open positions' SL/TP levels in Firestore.
    -   The moment a price condition is met, this service executes the trade or closes the position by writing directly to the database.
-   **Reliable Position Closing (Cloud Functions)**:
    -   A `closePositionHandler` function is automatically triggered whenever any position (closed either by the user or the real-time worker) is marked for closing. It securely calculates P&L and finalizes the database transaction by updating the user's `balance` in the `/users/{userId}/paperTradingContext/main` document.

## The Synchronization Flow: How It All Works Together

This hybrid model creates a seamless and powerful user experience.

1.  **Initial Load**: The user opens the app. The `PaperTradingContext` reads the user's entire trading state from Firestore.
2.  **Live In-App Experience**: The context opens its own WebSocket connections for the user's specific open positions and watchlist. The user sees prices ticking and P&L changing in real-time, directly in their browser.
3.  **Backend Action**: Meanwhile, the backend **Cloud Run worker** is also watching the live market feeds. It detects that a Take Profit level for one of the user's open positions has been hit.
4.  **Firestore as the Bridge**: The worker writes to Firestore, updating the `openPosition` document's `details.status` to `'closing'`.
5.  **Real-Time UI Update**: The `onSnapshot` listener in the user's `PaperTradingContext` immediately detects the change in the Firestore document.
6.  **Seamless Experience**: The frontend reacts to the state change. The position might disappear from the "Open Positions" table and appear in "Trade History." To the user, it feels as if the action happened instantly within their app, even though the backend did all the work.

This architecture provides the best of both worlds: the instant, real-time feedback of a fully client-side application, combined with the 24/7 reliability and automation of a persistent server-side engine.
