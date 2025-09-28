# App Overview

This document provides a high-level overview of the TradeFlow application's architecture, functionality, and data flow.

## Architecture

TradeFlow is a Next.js application built with the App Router, React, and TypeScript. It leverages Server Components and Server Actions for efficient data fetching and mutations. The user interface is constructed using **ShadCN UI** components and styled with **Tailwind CSS**. For AI-powered features, the application integrates with **Genkit**.

The application is structured into two main sections:
- **Main View**: A larger section for displaying primary content like charts, heatmaps, and data screeners.
- **Mini View**: A sidebar section for auxiliary widgets like technical analysis and an AI-powered chat.

## Main View Structure

The main view is managed by the `src/components/tradeflow/main-views/MainViews.tsx` component. It uses a `Tabs` component to switch between different views:

- **Chart View**: Displays one or more TradingView chart widgets. The layout can be dynamically changed to show 1, 2, 3, or 4 charts. When the "3 Charts + Analysis" layout is selected, an additional analysis panel is shown.
- **Heatmap View**: Renders various TradingView heatmap widgets, including Crypto Coins, Stocks, ETFs, and Forex. The view is selected via a dropdown menu.
- **Options Screener**: An iframe embedding a TradingView options screener.
- **Crypto Screener**: This view can display multiple types of crypto screeners:
    - **Kucoin Spot**: A custom-built screener (`AllTickersScreener.tsx`) that fetches data from a KuCoin API endpoint.
    - **Kucoin Futures**: Another custom screener (`AllFuturesScreener.tsx`) for futures contracts.
    - **TradingView**: The default TradingView crypto screener embedded in an iframe.
- **DEX Screener**: A feature-rich view (`DexScreenerContent.tsx`) for interacting with the DexScreener API to find latest token profiles, boosts, and search for pairs.

## Mini View Structure

The mini view, or sidebar, is managed by `src/components/tradeflow/mini-widgets/MiniWidgets.tsx`. It also uses a `Tabs` component to switch between:

- **Technical Analysis**: Displays the `TradingViewTechAnalysisWidget`, which provides technical indicators for the currently selected symbol.
- **AI Chat**: Embeds a **Botpress Webchat** instance within an iframe (`AiWebchat.tsx`), allowing users to interact with an AI assistant.

## State Management and Data Flow

- **Root State**: The primary state, including the `activeSymbol` for the TradingView charts, is managed in the root `HomePage` component (`src/app/page.tsx`).
- **Symbol Propagation**: The `activeSymbol` is passed down as props from `HomePage` to both `MainViews` and `MiniWidgets`. The `onSymbolChange` callback allows child components (like the `TradeTracker` in the future) to update the active symbol globally.
- **Local State**: UI state, such as the active tab in `MainViews` or form data in `TradeTracker`, is handled locally within the respective components using the `useState` hook.
- **Data Fetching**:
  - **Server Actions**: The `DexScreenerContent` component uses Server Actions defined in `src/app/actions/dexScreenerActions.ts` to fetch data from the DexScreener API.
  - **API Routes**: The KuCoin screeners use custom hooks (`useKucoinTickers`, `useKucoinFuturesContracts`) that fetch data from Next.js API Routes (`src/app/api/kucoin-tickers/route.ts` and `src/app/api/kucoin-futures-tickers/route.ts`). These routes act as proxies to the external KuCoin APIs.
  - **Local Storage**: The `TradeTracker` component persists user-entered trades in the browser's local storage.
- **AI Flows**: AI interactions are handled by Genkit flows defined in `src/ai/flows/`. These are server-side functions that can be called from client components to interact with the Gemini LLM.
