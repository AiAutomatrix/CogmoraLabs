# Spot Paper Trading System Documentation

This document outlines the architecture and functionality of the **spot paper trading** feature within the Cogmora Labs application. It enables users to simulate buying and selling cryptocurrencies using a virtual account balance and live market data from KuCoin.

## Core Architecture

The spot trading engine is built entirely on the client-side, managed by the `PaperTradingContext`.

- **`PaperTradingContext.tsx`**: This is the central engine for all paper trading activities. It manages the account's cash balance, tracks open spot positions, maintains a complete history of trades, and houses the logic for executing trades (`buy`, `closePosition`).
- **Local Storage Persistence**: The entire state of the paper trading account—including the balance, open positions, and trade history—is automatically saved to the browser's `localStorage`, ensuring data persists across sessions.
- **Initial State**: New users begin with a default virtual balance of **$100,000 USD**.

## Spot Trade Flow

1.  **Initiate Trade**: The user navigates to the **Crypto Screener** and selects the **"Kucoin Spot"** view (`AllTickersScreener.tsx`). They click the **Buy** button (<ShoppingCart /> icon) next to any coin.
2.  **Enter Allocation**: A `TradePopup` modal appears. It displays the coin's current market price and asks the user, "How much money do you want to allocate?"
3.  **Calculation**: As the user types a USD amount, the system calculates the approximate quantity of tokens they will receive.
4.  **Confirmation**: The user clicks **"Confirm Buy"**. The `buy` function from the `PaperTradingContext` is invoked.
5.  **Execution Logic**:
    - The allocated USD amount is subtracted from the user's available cash balance.
    - If a position for that symbol already exists, the new purchase is averaged into the existing position (increasing the size and adjusting the average entry price).
    - If no position exists, a new `OpenPosition` object is created to track the spot trade.
    - A `PaperTrade` record is added to the `tradeHistory` to log the transaction.
6.  **Dashboard Update**: The `PaperTradingDashboard` immediately reflects the new/updated position and the adjusted account balance.

## Real-Time Data and WebSocket Connection

To ensure that Unrealized P&L and position values are always current, the system establishes a direct WebSocket connection to KuCoin's public ticker feed.

-   **Dedicated WebSocket in Context**: The `PaperTradingContext` is responsible for managing the WebSocket connection for spot prices.
-   **Subscription Logic**: When a new spot position is opened or added to the watchlist, the context adds the symbol (e.g., `BTC-USDT`) to a subscription list and subscribes to the `/market/snapshot:{symbol}` topic via the WebSocket.
-   **Live Price Updates**: As the WebSocket pushes new ticker data, the `onmessage` handler in the context calls the `processUpdate` function.
-   **`processUpdate`**: This function finds the matching open position or watchlist item, updates its `currentPrice`, and recalculates `unrealizedPnl`.
-   **Connection Management**: The context also handles automatically unsubscribing from a symbol's feed when its position is closed or it's removed from the watchlist.

## Component Relationships

-   **`AllTickersScreener.tsx`**: Displays live spot market data and contains the "Buy" button that initiates the trade flow.
-   **`TradePopup.tsx`**: A dialog component that collects the trade allocation from the user and executes the `buy` function from the context.
-   **`PaperTradingContext.tsx`**: The core engine. Manages state, executes trades, and handles the live WebSocket connection for all spot-related data.
-   **`PaperTradingDashboard.tsx`**: The main interface for viewing account performance, listing all open positions, and displaying the full trade history.
