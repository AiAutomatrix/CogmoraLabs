# Cogmora Labs Application Features

This document provides a comprehensive overview of all the features available in the Cogmora Labs application, a powerful platform for cryptocurrency trading analysis and simulation.

---

## 1. Core Interface & Layout

The application is built with a responsive, two-column layout that adapts for both desktop and mobile use.

-   **Desktop Layout**: A side-by-side view featuring a large **Main View** (2/3 of the screen) for primary content and a smaller **Mini View** sidebar (1/3 of the screen) for auxiliary widgets. This allows for simultaneous analysis and interaction with different tools.
-   **Mobile Layout**: On smaller screens, the layout stacks into a single, vertically scrolling column. The Main View appears first, followed by the Mini View content, ensuring a user-friendly experience on any device.

---

## 2. Main View Features

The Main View is the central workspace, managed by a tabbed interface on desktop and a dropdown menu on mobile.

### a. Paper Trading Dashboard

The heart of the application, this dashboard provides a complete, client-side paper trading experience with a default starting balance of **$100,000**.

-   **Account Metrics**: Live-updating cards show key performance indicators like **Equity**, **Available Cash**, **Unrealized P&L**, **Realized P&L**, and **Win Rate**.
-   **Open Positions**: A real-time table of all active spot and futures trades. It displays the symbol, type (spot or futures), side (long/short), leverage, size, entry price, current price, and live unrealized P&L.
-   **Trade Triggers**: A dashboard to view and manage conditional orders that are waiting to be executed when a target price is met.
-   **Trade History**: A comprehensive log of all closed trades, showing the symbol, side, size, price, and the final P&L for each trade.
-   **Watchlist**:
    -   Manually add or remove spot and futures symbols to track their real-time price movements.
    -   **Price Alerts**: Set "above" or "below" price alerts for any watched symbol, which trigger a notification.
    -   **Trade Trigger Creation**: Create complex conditional orders directly from the watchlist, including setting stop loss, take profit, and order chaining logic.
    -   **Auto Watchlist Generator**: An advanced feature to automatically populate the watchlist by scraping data from the KuCoin screeners based on user-defined rules (e.g., "Top 10 by Volume," "Top 5 Gainers"). This can be a one-time action or scheduled to auto-refresh.

### b. Advanced Charting

-   **Multi-Chart Layouts**: Dynamically switch between displaying 1, 2, 3, or 4 TradingView charts simultaneously.
-   **Direct Screener Integration**: Click any symbol in the KuCoin Spot Screener to instantly load it into the chart view.
-   **Multi-Symbol Loading**: Select a chart layout (e.g., "4 Charts") from the screener, click on multiple symbols to highlight them, and load all of them into the multi-chart view at once.

### c. Market Heatmaps

Visualize market performance at a glance with a variety of TradingView heatmap widgets.
-   Crypto Coins Heatmap
-   Stock Market Heatmap
-   ETFs Heatmap
-   Forex Cross Rates
-   Forex Heatmap

### d. Financial Screeners

-   **KuCoin Spot Screener**: A custom-built, real-time screener for all USDT spot tickers on KuCoin. Features live data updates, sortable columns (price, 24h change, volume), and one-click actions to trade, watch, or load a symbol into the chart.
-   **KuCoin Futures Screener**: A dedicated screener for KuCoin perpetual futures contracts, showing live data for mark price, open interest, 24h volume, and max leverage. It allows for direct entry into leveraged paper trades.
-   **DEX Screener**: A comprehensive tool for exploring decentralized exchanges. Users can search for pairs, view the latest token profiles, and see which tokens are currently being "boosted."
-   **Options & TradingView Crypto Screeners**: Embedded widgets from TradingView for broad market screening.

---

## 3. Mini View (Sidebar) Features

The sidebar provides access to auxiliary tools that complement the main view.

### a. Technical Analysis Widget

-   Displays a real-time TradingView Technical Analysis gauge for the currently active symbol. This provides a quick summary of market sentiment based on various technical indicators across different timeframes.

### b. AI Webchat

-   An integrated AI assistant powered by Botpress. Users can interact with the chatbot to ask questions or get information without leaving the application.

---

## 4. Paper Trading Engine (Behind the Scenes)

The paper trading system is a sophisticated, self-contained engine that operates entirely on the client-side.

-   **Spot & Futures Trading**: Simulates both simple spot trades (buy/sell) and complex leveraged futures trades (long/short) with collateral management.
-   **Real-Time Data**: Establishes direct WebSocket connections to KuCoin's spot and futures data feeds to update prices, P&L, and other metrics in real time.
-   **Dynamic Subscriptions**: The system intelligently subscribes and unsubscribes from symbol data feeds as positions are opened and closed, ensuring efficient data usage.
-   **Advanced Order Types**: Supports not only instant market orders but also complex **Trade Triggers** (conditional orders) and the ability to attach **Stop Loss** and **Take Profit** levels to any position.
-   **Local Storage Persistence**: The entire paper trading state—including balance, open positions, trade history, and watchlist—is saved in the browser's local storage, preserving the user's portfolio across sessions.
