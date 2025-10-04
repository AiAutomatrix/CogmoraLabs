# Spot Paper Trading System Documentation

This document outlines the architecture and functionality of the **spot paper trading** feature within the Cogmora Labs application. It enables users to simulate buying and selling cryptocurrencies using a virtual account balance and live market data from KuCoin.

## Core Architecture

The spot trading engine is built entirely on the client-side, leveraging React Context for state management and browser local storage for data persistence. This creates a responsive and self-contained paper trading experience.

- **`PaperTradingContext.tsx`**: This is the central engine for all paper trading activities. It manages the account's cash balance, tracks all open spot positions, maintains a complete history of trades, and houses the logic for executing trades (`buy`, `closePosition`).
- **Local Storage Persistence**: The entire state of the paper trading account—including the balance, open positions, and trade history—is automatically saved to the browser's `localStorage`. This ensures that a user's data and simulated portfolio persist across sessions.
- **Initial State**: New users begin with a default virtual balance of **$100,000 USD**.

## Spot Trade Flow

The process for initiating and executing a spot trade is designed to be straightforward:

1.  **Initiate Trade**: The user navigates to the **Crypto Screener** and selects the **"Kucoin Spot"** view (`AllTickersScreener.tsx`). They then click the **Buy** button (<ShoppingCart /> icon) next to any coin in the list.
2.  **Enter Allocation**: A `TradePopup` modal appears. It displays the coin's current market price and asks the user, "How much money do you want to allocate?"
3.  **Calculation**: As the user types a USD amount, the system calculates the approximate quantity of tokens they will receive based on the current price.
4.  **Confirmation**: The user clicks **"Confirm Buy"**. The `buy` function from the `PaperTradingContext` is invoked.
5.  **Execution Logic**:
    - The allocated USD amount is subtracted from the user's available cash balance.
    - A new `OpenPosition` object is created to track the spot trade.
    - A `PaperTrade` record is added to the `tradeHistory` to log the transaction.
6.  **Dashboard Update**: The `PaperTradingDashboard` immediately reflects the new open position and the updated account balance.

## Real-Time Data and WebSocket Connection

To ensure that Unrealized P&L and position values are always current, the system establishes a direct WebSocket connection to KuCoin's public ticker feed.

-   **Dedicated WebSocket in Context**: The `PaperTradingContext` itself is responsible for managing the WebSocket connection for spot prices.
-   **Subscription Logic**: When a new spot position is opened (or added to the watchlist), the context adds the symbol (e.g., `BTC-USDT`) to a subscription list. It establishes a connection to the KuCoin WebSocket and subscribes to the `/market/snapshot:{symbol}` topic for a full data snapshot for all relevant symbols.
-   **Live Price Updates**: As the WebSocket pushes new ticker data, the `onmessage` handler in the context calls the `processUpdate` function.
-   **`processUpdate`**: This function iterates through the `openPositions` and `watchlist` state, finds the matching item, and updates its `currentPrice`, `unrealizedPnl`, `high`, `low`, and `priceChgPct`. This state update triggers a re-render in the `PaperTradingDashboard`, ensuring all financial metrics are live.
-   **Connection Management**: The context also handles automatically unsubscribing from a symbol's feed when its position is closed, keeping the connection efficient.

## Component Relationships

-   **`AllTickersScreener.tsx`**: Displays live spot market data and contains the "Buy" button that initiates the trade flow.
-   **`TradePopup.tsx`**: A dialog component that collects the trade allocation from the user and executes the `buy` function from the context.
-   **`PaperTradingContext.tsx`**: The core engine. Manages state, executes trades, and handles the live WebSocket connection for open spot positions.
-   **`PaperTradingDashboard.tsx`**: The main interface for viewing account performance, listing all open positions (both spot and futures), and displaying the full trade history.
