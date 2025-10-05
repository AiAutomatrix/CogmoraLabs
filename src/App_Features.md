# Cogmora Labs Application Features

This document provides a comprehensive overview of all the features available in the Cogmora Labs application, a powerful platform for cryptocurrency trading analysis and simulation.

---

## 1. Core Interface & Layout

The application is built with a responsive, two-column layout that adapts for both desktop and mobile use.

-   **Desktop Layout**: A side-by-side view featuring a large **Main View** (2/3 of the screen) for primary content and a smaller **Mini View** sidebar (1/3 of the screen) for auxiliary widgets.
-   **Mobile Layout**: On smaller screens, the layout stacks into a single, vertically scrolling column. Navigation is handled by a slide-out menu.

---

## 2. Main View Features

The Main View is the central workspace, managed by a tabbed interface on desktop and a slide-out navigation menu on mobile.

### a. Paper Trading Dashboard

The heart of the application, this dashboard provides a complete, client-side paper trading experience with a default starting balance of **$100,000**.

-   **Account Metrics**: Live-updating cards show key performance indicators like **Equity**, **Available Cash**, **Unrealized P&L**, **Realized P&L**, and **Win Rate**.
-   **Open Positions**: A real-time table of all active spot and futures trades. It displays the symbol, type, side, leverage, size, entry price, current price, and live unrealized P&L. Actions include closing a position or configuring Stop Loss/Take Profit.
-   **Triggers**: A dashboard to view and manage conditional orders (e.g., "buy when price is below X"). It also displays active **Watchlist Automations** with a countdown to the next scrape.
-   **Trade History**: A comprehensive log of all closed trades.
-   **Watchlist**:
    -   Manually add or remove spot and futures symbols to track their real-time price movements.
    -   **Price Alerts**: Set "above" or "below" price alerts for any watched symbol, which trigger a notification.
    -   **Trade Trigger Creation**: Create complex conditional orders directly from the watchlist, including setting stop loss and take profit.
    -   **Chart Integration**: Click any symbol to instantly load it into the chart view. Chart layout settings (1, 2, 3, or 4 charts) are available directly within the watchlist header.
    -   **Watchlist Automation**: An advanced feature (`AutomateWatchlistPopup`) to automatically populate the watchlist by scraping the KuCoin screeners based on user-defined rules (e.g., "Top 10 by Volume," "Top 5 Gainers"). This can be a one-time action or a scheduled auto-refresh.

### b. Advanced Charting

-   **Multi-Chart Layouts**: Dynamically switch between displaying 1, 2, 3, or 4 TradingView charts simultaneously.
-   **Direct Screener & Watchlist Integration**: Click any symbol in the KuCoin Spot Screener or the Watchlist to instantly load it into the chart view.
-   **Multi-Symbol Loading**: Select a multi-chart layout from the screener/watchlist, click on multiple symbols, and load all of them into the chart view at once.

### c. Market Heatmaps

Visualize market performance at a glance with a variety of TradingView heatmap widgets for Crypto, Stocks, ETFs, and Forex.

### d. Financial Screeners

-   **KuCoin Spot Screener**: A custom-built, real-time screener for all USDT spot tickers on KuCoin. Features live data, sortable columns, and one-click actions to trade, watch, or load a symbol into a chart.
-   **KuCoin Futures Screener**: A dedicated screener for KuCoin perpetual futures contracts, allowing for direct entry into leveraged paper trades.
-   **DEX Screener**: A tool for exploring decentralized exchanges by searching for pairs, viewing token profiles, and seeing "boosted" tokens.
-   **Options & TradingView Crypto Screeners**: Embedded widgets from TradingView for broad market screening.

---

## 3. Mini View (Sidebar) Features

The sidebar provides access to auxiliary tools that complement the main view.

### a. Technical Analysis Widget

-   Displays a real-time TradingView Technical Analysis gauge for the currently active symbol, providing a quick summary of market sentiment.

### b. AI Webchat

-   An integrated AI assistant powered by Botpress and Genkit. Users can interact with the chatbot to ask questions or get information without leaving the application.

---

## 4. Paper Trading Engine (Behind the Scenes)

The paper trading system is a sophisticated, self-contained engine that operates entirely on the client-side.

-   **Spot & Futures Trading**: Simulates both simple spot trades and complex leveraged futures trades with collateral management.
-   **Real-Time Data**: Establishes direct WebSocket connections to KuCoin's spot and futures data feeds to update prices and P&L in real time.
-   **Dynamic Subscriptions**: The system intelligently subscribes and unsubscribes from symbol data feeds as positions are opened and closed, ensuring efficient data usage.
-   **Advanced Order Types**: Supports not only instant market orders but also complex **Trade Triggers** (conditional orders) and the ability to attach **Stop Loss** and **Take Profit** levels to any position.
-   **Local Storage Persistence**: The entire paper trading state—including balance, positions, history, watchlist, and automation settings—is saved in the browser's local storage.
