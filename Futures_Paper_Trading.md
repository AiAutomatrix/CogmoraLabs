# Futures Paper Trading System Documentation

This document details the architecture and functionality of the **futures paper trading** feature in the Cogmora Labs application. It allows users to simulate leveraged trading (long and short positions) on cryptocurrency futures contracts using live data from the KuCoin Futures API.

## Core Architecture

The futures trading system is an extension of the main paper trading engine and shares the same core components. It is designed to handle the complexities of leveraged trading, including collateral management, leverage, and distinct long/short P&L calculations.

- **`PaperTradingContext.tsx`**: This context is the heart of the futures engine. It has been extended to manage futures-specific logic:
  -   **Trade Functions**: Includes `futuresBuy` (for long positions) and `futuresSell` (for short positions).
  -   **Position Tracking**: The `OpenPosition` type is designed to differentiate between `spot` and `futures` positions, storing extra data for futures like `leverage` and `side` ('long' or 'short').
  -   **P&L Calculation**: The logic for calculating `unrealizedPnl` correctly accounts for the direction of the trade (long or short).
- **Local Storage Persistence**: Like spot trades, all futures positions and trade history are saved in the browser's `localStorage`, ensuring data continuity across sessions.

## Futures Trade Flow

The process for executing a leveraged futures trade is as follows:

1.  **Initiate Trade**: The user navigates to the **Crypto Screener** and selects the **"Kucoin Futures"** view (`AllFuturesScreener.tsx`). They click the trade button (<BarChartHorizontal /> icon) for a perpetual contract (e.g., `XBTUSDTM`).
2.  **Enter Trade Parameters**: A `FuturesTradePopup` modal appears. This dialog is more advanced than the spot popup and requires the user to input:
    -   **Collateral Allocation (USD)**: The amount of their virtual cash balance they wish to use as margin for the position.
    -   **Leverage**: A slider allows the user to select their desired leverage, up to the maximum allowed by the contract.
3.  **Calculation & Summary**: The popup displays a trade summary, including:
    -   **Total Position Value**: `Collateral * Leverage`
    -   **Quantity (Approx)**: The approximate number of contracts this position value represents at the current mark price.
4.  **Confirmation**: The user chooses to either **"Buy / Long"** or **"Sell / Short"**. This calls the corresponding function (`futuresBuy` or `futuresSell`) from the `PaperTradingContext`.
5.  **Execution Logic**:
    - The collateral amount is subtracted from the user's available cash balance.
    - A new `OpenPosition` object is created with `positionType: 'futures'`, the specified `side` ('long' or 'short'), and the chosen `leverage`.
    - A `PaperTrade` record is added to the history, logging all futures-specific parameters.
6.  **Dashboard Update**: The `PaperTradingDashboard` instantly shows the new leveraged position, with a badge indicating the side and leverage (e.g., "Long 10x").

## Real-Time Data for Futures

Futures contracts require a separate WebSocket connection, as they use a different data feed from spot tickers.

-   **Dedicated Futures WebSocket**: The `PaperTradingContext` manages a second, independent WebSocket connection specifically for futures contracts.
-   **Subscription Logic**: When a futures position is opened (or added to the watchlist), the context subscribes to the `/contractMarket/snapshot:{symbol}` topic for that specific contract (e.g., `/contractMarket/snapshot:XBTUSDTM`).
-   **Live Price Updates**: The context's `onmessage` handler for the futures WebSocket listens for snapshot updates and passes the new data to the `processUpdate` function.
-   **`processUpdate`**: This function identifies the open futures position by its symbol and updates its `currentPrice`. It then calculates the `unrealizedPnl` based on the position's side:
    -   **Long**: `(currentPrice - averageEntryPrice) * size`
    -   **Short**: `(averageEntryPrice - currentPrice) * size`
-   **Connection Management**: When a futures position is closed (or removed from the watchlist), the context sends an `unsubscribe` message for that contract's topic to the WebSocket, ensuring the connection remains efficient.

## Component Relationships

-   **`AllFuturesScreener.tsx`**: Displays live futures contract data and contains the button to open the trade popup.
-   **`FuturesTradePopup.tsx`**: A specialized dialog for entering collateral and leverage for futures trades. It executes the `futuresBuy` or `futuresSell` functions.
-   **`PaperTradingContext.tsx`**: The central engine that manages state, executes all trades, and handles independent WebSocket connections for both spot and futures positions.
-   **`PaperTradingDashboard.tsx`**: The unified UI that displays all open positions (spot and futures) and their respective metrics, clearly differentiating between them using badges and correct P&L calculations.