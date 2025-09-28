
# Paper Trading System Documentation

This document outlines the architecture and functionality of the paper trading feature within the Cogmora Labs application. It enables users to simulate cryptocurrency trades using live data from KuCoin without risking real money.

## How the Paper Trading Engine Works

The paper trading engine is a client-side system built using React Context and browser local storage for persistence. It manages a virtual account, executes trades, and tracks performance.

- **`PaperTradingContext.tsx`**: This is the core of the engine. It creates a React context that provides the account balance, open positions, trade history, and functions to execute trades (`buy`, `sell`).
- **Local Storage**: The entire state of the paper trading account (balance, positions, history) is saved to the browser's `localStorage`. This ensures that the user's data persists across sessions.
- **Initial Balance**: New users start with a default virtual balance of **$100,000**.

## Trade Flow

The process of executing a paper trade is designed to be simple and intuitive:

1.  **Initiate Trade**: The user clicks the **"Buy"** button next to a coin in the **KuCoin Spot Screener**.
2.  **Enter Allocation**: A `TradePopup` modal appears, asking the user, "How much money do you want to allocate?"
3.  **Calculation**: The system uses the current price of the coin (fetched from the KuCoin Ticker data) to calculate the corresponding amount of tokens the user will receive.
4.  **Confirmation**: The user reviews the details and clicks "Confirm Buy".
5.  **Trade Execution**: The `buy` function in the `PaperTradingContext` is called.
    - The allocated amount is subtracted from the user's cash balance.
    - A new trade is added to the `tradeHistory`.
    - An `openPositions` entry is created or updated. If a position for that coin already exists, the new trade is averaged into the existing position (size and average entry price are updated).
6.  **Dashboard Update**: The **Paper Trading Dashboard** updates in real-time, reflecting the new position and updated account metrics.

## WebSocket and Real-Time Data

The system leverages the existing data fetching mechanism for KuCoin to get near real-time price updates.

- **`useKucoinTickers` Hook**: This hook, which powers the screener, is also used by the paper trading system. It fetches ticker data from the proxied KuCoin API every 5 seconds.
- **Live Price Updates**: Each time the `useKucoinTickers` hook fetches new data, it calls the `updatePositionPrice` function from the `PaperTradingContext`.
- **`updatePositionPrice`**: This function iterates through all open positions and updates their `currentPrice`. This change triggers a re-render of the dashboard, ensuring that **Unrealized P&L** and **Equity** are always up-to-date.

## Dashboard Metrics and Formulas

The `PaperTradingDashboard.tsx` component displays several key performance indicators:

-   **Total Balance**: The amount of cash available to trade.
    -   `balance`
-   **Equity**: The total value of the account if all positions were closed at the current market price.
    -   `Equity = balance + (sum of (position.size * position.currentPrice))`
-   **Unrealized P&L**: The current profit or loss on all open positions.
    -   `Unrealized P&L = sum of ((position.currentPrice - position.averageEntryPrice) * position.size)`
-   **Realized P&L**: The total profit or loss from all closed trades.
    -   `Realized P&L = sum of all closed_trade.pnl`
-   **Win Rate**: The percentage of closed trades that were profitable.
    -   `Win Rate = (Number of profitable closed trades / Total number of closed trades) * 100`

## Component Relationships

The paper trading feature is composed of several interconnected components:

-   **`AllTickersScreener.tsx`** (KuCoin Spot Screener)
    -   Contains the "Buy" button for each coin.
    -   Triggers the `TradePopup`.
-   **`TradePopup.tsx`**
    -   Gathers the trade allocation from the user.
    -   Calls the `buy` function from the `usePaperTrading` hook.
-   **`PaperTradingContext.tsx`** (The "Engine")
    -   Manages all state and logic for the paper trading account.
    -   Provides the `usePaperTrading` hook for components to interact with the engine.
-   **`PaperTradingDashboard.tsx`**
    -   Consumes data from the `usePaperTrading` hook.
    -   Displays account metrics, open positions, and trade history.
    -   Allows users to close positions.

This modular structure ensures that the trading logic is decoupled from the UI, making the system maintainable and easy to expand in the future.
