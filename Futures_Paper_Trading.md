# Futures Paper Trading System Documentation

This document details the architecture and functionality of the **futures paper trading** feature in the Cogmora Labs application. It allows users to simulate leveraged trading (long and short positions) on cryptocurrency futures contracts using live data from the KuCoin Futures API.

## Core Architecture

The futures trading system is an integral part of the main paper trading engine, which is managed by the `PaperTradingContext`.

- **`PaperTradingContext.tsx`**: This context is the heart of the futures engine. It has been extended to manage futures-specific logic:
  -   **Trade Functions**: Includes `futuresBuy` (for long positions) and `futuresSell` (for short positions).
  -   **Position Tracking**: The `OpenPosition` type differentiates between `spot` and `futures` positions, storing extra data for futures like `leverage`, `side` ('long' or 'short'), and `liquidationPrice`.
  -   **P&L Calculation**: The logic for calculating `unrealizedPnl` correctly accounts for the direction of the trade (long or short).
  -   **Collateral Management**: When a futures trade is opened, the collateral amount is subtracted from the user's main cash `balance`. When closed, the collateral +/- P&L is returned to the balance.
- **Local Storage Persistence**: All futures positions and trade history are saved in the browser's `localStorage`, ensuring data continuity across sessions.

## Futures Trade Flow

1.  **Initiate Trade**: The user navigates to the **Crypto Screener** and selects the **"Kucoin Futures"** view (`AllFuturesScreener.tsx`). They click the trade button (<BarChartHorizontal /> icon) for a perpetual contract.
2.  **Enter Trade Parameters**: A `FuturesTradePopup` modal appears. This dialog requires the user to input:
    -   **Collateral Allocation (USD)**: The amount of their virtual cash balance to use as margin.
    -   **Leverage**: A slider allows the user to select their desired leverage.
3.  **Calculation & Summary**: The popup displays a trade summary, including the total position value (`Collateral * Leverage`) and the approximate quantity of contracts.
4.  **Confirmation**: The user chooses to either **"Buy / Long"** or **"Sell / Short"**. This calls the corresponding function (`futuresBuy` or `futuresSell`) from the `PaperTradingContext`.
5.  **Execution**: A new `OpenPosition` object is created with `positionType: 'futures'`, the specified `side`, and `leverage`. A `PaperTrade` record is added to the history.
6.  **Dashboard Update**: The `PaperTradingDashboard` instantly shows the new leveraged position, with a badge indicating the side and leverage (e.g., "Long 10x").

## Real-Time Data for Futures

Futures contracts use a dedicated WebSocket connection for live price updates, managed entirely within the `PaperTradingContext`.

-   **Dedicated Futures WebSocket**: The context manages a WebSocket connection specifically for futures contracts.
-   **Subscription Logic**: When a futures position is opened or added to the watchlist, the context subscribes to the `/contractMarket/snapshot:{symbol}` topic for that contract.
-   **Live Price Updates**: The context's `onmessage` handler listens for snapshot updates and passes the new price to the `processUpdate` function.
-   **`processUpdate` Function**: This function identifies the open futures position by its symbol, updates its `currentPrice`, and recalculates its `unrealizedPnl` based on the position's side:
    -   **Long**: `(currentPrice - averageEntryPrice) * size`
    -   **Short**: `(averageEntryPrice - currentPrice) * size`
-   **Connection Management**: The context automatically unsubscribes from a symbol's topic when its position is closed or it's removed from the watchlist.

## Component Relationships

-   **`AllFuturesScreener.tsx`**: Displays live futures contract data and contains the button to open the trade popup.
-   **`FuturesTradePopup.tsx`**: A specialized dialog for entering collateral and leverage for futures trades. It executes the `futuresBuy` or `futuresSell` functions.
-   **`PaperTradingContext.tsx`**: The central engine that manages state, executes all trades, and handles the WebSocket connection for futures positions.
-   **`PaperTradingDashboard.tsx`**: The unified UI that displays all open positions (spot and futures) and their respective metrics, clearly differentiating between them.
