# App Overview

This document provides a high-level overview of the Cogmora Labs application's architecture, functionality, and data flow.

## Architecture

Cogmora Labs is a Next.js application built with the App Router, React, and TypeScript. It leverages Server Components and Server Actions for efficient data fetching and mutations. The user interface is constructed using **ShadCN UI** components and styled with **Tailwind CSS**. For AI-powered features, the application integrates with **Genkit**.

The application is structured into two main sections:
- **Main View**: A larger section for displaying primary content like the paper trading dashboard, charts, heatmaps, and data screeners.
- **Mini View**: A sidebar section for auxiliary widgets like technical analysis and an AI-powered chat.

## Main View Structure

The main view is managed by the `src/components/cogmora-labs/main-views/MainViews.tsx` component. It uses a `Tabs` component to switch between different views:

- **Paper Trading**: A comprehensive dashboard (`PaperTradingDashboard.tsx`) for managing simulated trades, a watchlist with price alerts, and conditional trade triggers.
- **Chart View**: Displays one or more TradingView chart widgets. The layout can be dynamically changed to show 1, 2, 3, or 4 charts. Symbols can be loaded from the screeners or the watchlist.
- **Heatmap View**: Renders various TradingView heatmap widgets, including Crypto Coins, Stocks, ETFs, and Forex.
- **Options Screener**: An iframe embedding a TradingView options screener.
- **Crypto Screener**: This view can display multiple types of crypto screeners:
    - **Kucoin Spot**: A custom-built screener (`AllTickersScreener.tsx`) that fetches live data from the KuCoin API.
    - **Kucoin Futures**: Another custom screener (`AllFuturesScreener.tsx`) for perpetual futures contracts.
    - **TradingView**: The default TradingView crypto screener embedded in an iframe.
- **DEX Screener**: A feature-rich view (`DexScreenerContent.tsx`) for interacting with the DexScreener API.

## Mini View Structure

The mini view, or sidebar, is managed by `src/components/cogmora-labs/mini-widgets/MiniWidgets.tsx`. It also uses a `Tabs` component to switch between:

- **Technical Analysis**: Displays the `TradingViewTechAnalysisWidget`, providing technical indicators for the currently selected symbol.
- **AI Chat**: Embeds a **Botpress Webchat** instance, allowing users to interact with an AI assistant.

## State Management and Data Flow

- **Root State**: Primary state, including the `activeSymbol` and chart layout, is managed in the `HomePage` component (`src/app/dashboard/page.tsx`).
- **Paper Trading Engine**: All paper trading state (balance, positions, history, watchlist, triggers, alerts) is managed by the `PaperTradingContext`. This client-side system uses React Context and persists its state to the browser's `localStorage`.
- **Live Data via WebSockets**: The `PaperTradingContext` establishes and manages direct WebSocket connections to KuCoin's spot and futures feeds to provide real-time price updates for open positions and the watchlist. The screeners (`AllTickersScreener`, `AllFuturesScreener`) also use their own WebSocket hooks.
- **Symbol & View Propagation**: The `activeSymbol`, selected view, and chart layout states are passed down as props from `dashboard/page.tsx` to the `MainViews` and `MiniWidgets` components. Callbacks like `onSymbolSelect` allow child components (screeners, watchlist) to update the active symbol globally.
- **API Routes**: The KuCoin screeners use Next.js API Routes (`src/app/api/...`) as proxies to the external KuCoin APIs for fetching initial data and WebSocket connection tokens.
- **Server Actions**: The `DexScreenerContent` component uses Server Actions to fetch data from the DexScreener API.
