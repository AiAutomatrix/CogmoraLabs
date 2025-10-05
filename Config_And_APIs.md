# Configuration and APIs

This document details the project's configuration files, environment variables, and external/internal API usage.

## Configuration Files

- **`next.config.ts`**:
  - Configures Next.js build options, including `images.remotePatterns` to allow images from `placehold.co` and `dexscreener.com`.
  - Sets up `allowedDevOrigins` for local development with Firebase Studio.

- **`tsconfig.json`**: Standard TypeScript configuration for a Next.js project, setting the module system, JSX behavior, and path aliases like `@/*`.

- **`tailwind.config.ts`**:
  - Configures Tailwind CSS, including dark mode support.
  - Defines the application's color palette using CSS variables declared in `src/app/globals.css`.

- **`components.json`**: The configuration file for `shadcn/ui`, defining style and component path aliases.

- **`package.json`**:
  - Lists all project dependencies and development scripts.
  - Defines scripts for running the development server (`dev`), building the project (`build`), and interacting with Genkit (`genkit:dev`).

## Environment Variables

The project uses a `.env` file for environment variables, which is loaded by `src/ai/dev.ts`.
- `GEMINI_API_KEY`: The API key for accessing Google's Gemini models through Genkit.

## API Calls

### External APIs

The application interacts with several external services:

1.  **TradingView**:
    - **Purpose**: Provides financial charts, heatmaps, and screener widgets.
    - **Usage**: Embedded as iframes using `srcDoc` for security and performance throughout the `MainViews` component and its sub-components. No API key is required for these public widgets.

2.  **DexScreener API (`https://api.dexscreener.com`)**:
    - **Purpose**: Fetches decentralized exchange (DEX) data.
    - **Usage**: Called from Server Actions in `src/app/actions/dexScreenerActions.ts`.

3.  **KuCoin API (`https://api.kucoin.com` and `https://api-futures.kucoin.com`)**:
    - **Purpose**: Provides real-time market data for spot and futures markets.
    - **Usage**: The app uses Next.js API Routes as a proxy to the external KuCoin APIs for security and to manage API credentials.
      - **`GET /api/kucoin-tickers`**: Fetches all spot tickers.
      - **`GET /api/kucoin-futures-tickers`**: Fetches all active futures contracts.
      - **`POST /api/kucoin-ws-token`**: Obtains a public WebSocket connection token for the spot market.
      - **`POST /api/kucoin-futures-ws-token`**: Obtains a public WebSocket connection token for the futures market.
    - These routes are consumed by custom hooks (`useKucoinTickers`, `PaperTradingContext`) to get initial data and establish live WebSocket connections.

4.  **Botpress**:
    - **Purpose**: Provides the AI webchat functionality.
    - **Usage**: A Botpress webchat script is injected and initialized within an `iframe` in the `AiWebchat.tsx` component.

### Internal API Routes

- **`GET /api/kucoin-tickers`**: Proxies a request to the KuCoin `/api/v1/market/allTickers` endpoint.
- **`GET /api/kucoin-futures-tickers`**: Proxies a request to the KuCoin Futures `/api/v1/contracts/active` endpoint.
- **`POST /api/kucoin-ws-token`**: Proxies a request to the KuCoin `/api/v1/bullet-public` endpoint to get a WebSocket token.
- **`POST /api/kucoin-futures-ws-token`**: Proxies a request to the KuCoin Futures `/api/v1/bullet-public` endpoint to get a WebSocket token.

### Genkit AI Flows

The application uses `genkit` to define server-side AI functions that interact with the Gemini Large Language Model.

- **`marketAnalysisQuery`**: Takes a cryptocurrency symbol and a user query to provide market analysis.
- **`tradingInsightsQuery`**: Provides trading insights based on a user query and provided chart data.
- **`customPromptQuery`**: A general-purpose flow that takes any user prompt and returns an AI response.

These flows are defined in `src/ai/flows/` and are designed to be called from the AI Chat widget.
