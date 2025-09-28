# Configuration and APIs

This document details the project's configuration files, environment variables, and external/internal API usage.

## Configuration Files

- **`next.config.ts`**:
  - Configures Next.js build options, including disabling TypeScript and ESLint errors during builds.
  - Defines `remotePatterns` for the `next/image` component to allow images from `placehold.co` and `dexscreener.com`.
  - Sets up `allowedDevOrigins` for experimental features.

- **`tsconfig.json`**: Standard TypeScript configuration for a Next.js project, setting the module system, JSX behavior, and path aliases like `@/*`.

- **`tailwind.config.ts`**:
  - Configures Tailwind CSS, including dark mode support.
  - Defines the application's color palette using CSS variables that are declared in `src/app/globals.css`. It includes theme colors (primary, secondary, accent) and chart-specific colors.

- **`components.json`**: The configuration file for `shadcn/ui`. It defines the style, component library path aliases, and Tailwind CSS configuration paths.

- **`package.json`**:
  - Lists all project dependencies (`dependencies`) and development dependencies (`devDependencies`).
  - Defines `scripts` for running the development server (`dev`), building the project (`build`), and interacting with Genkit (`genkit:dev`).

## Environment Variables

The project uses a `.env` file for environment variables, which is loaded by `src/ai/dev.ts`. Based on the Genkit setup (`@genkit-ai/googleai`), the primary variable expected is:

- `GEMINI_API_KEY`: The API key for accessing Google's Gemini models through Genkit.

## API Calls

### External APIs

The application interacts with several external services:

1.  **TradingView**:
    - **Purpose**: Provides financial charts, heatmaps, and screener widgets.
    - **Usage**: Embedded as iframes or via a scripting library throughout the `MainViews` component (`src/components/tradeflow/main-views/MainViews.tsx`) and its sub-components. No explicit API key is required for these public widgets.

2.  **DexScreener API (`https://api.dexscreener.com`)**:
    - **Purpose**: Fetches decentralized exchange (DEX) data, including token profiles, boosts, and pair information.
    - **Usage**: Called from Server Actions in `src/app/actions/dexScreenerActions.ts`. These actions are then invoked by the `DexScreenerContent` component.

3.  **KuCoin API (`https://api.kucoin.com` and `https://api-futures.kucoin.com`)**:
    - **Purpose**: Fetches real-time market data for spot and futures markets.
    - **Usage**: The app does not call the KuCoin API directly from the client. Instead, it uses Next.js API Routes as a proxy:
      - `GET /api/kucoin-tickers`: Fetches all spot tickers.
      - `GET /api/kucoin-futures-tickers`: Fetches all active futures contracts.
    - These internal routes are consumed by the `useKucoinTickers` and `useKucoinFuturesContracts` hooks, respectively.

4.  **Botpress**:
    - **Purpose**: Provides the AI webchat functionality.
    - **Usage**: A Botpress webchat script is injected and initialized within an iframe in the `AiWebchat.tsx` component.

### Internal API Routes

- **`GET /api/kucoin-tickers`**: Proxies a request to the KuCoin `/api/v1/market/allTickers` endpoint.
- **`GET /api/kucoin-futures-tickers`**: Proxies a request to the KuCoin Futures `/api/v1/contracts/active` endpoint.

### Genkit AI Flows

The application uses `genkit` to define server-side AI functions that interact with the Gemini Large Language Model.

- **`marketAnalysisQuery`**: Takes a cryptocurrency symbol and a user query to provide market analysis.
- **`tradingInsightsQuery`**: Provides trading insights based on a user query and provided chart data.
- **`customPromptQuery`**: A general-purpose flow that takes any user prompt and returns an AI response.

These flows are defined in `src/ai/flows/` and can be invoked from any server component or server action.
