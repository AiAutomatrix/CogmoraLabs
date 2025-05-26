
// KuCoin WebSocket Token Response Types
export type KucoinTokenResponseDataInstanceServer = {
  endpoint: string;
  protocol: string; // "websocket"
  encrypt: boolean;
  pingInterval: number; // e.g., 50000 (ms)
  pingTimeout: number;  // e.g., 10000 (ms)
};

export type KucoinTokenResponseData = {
  token: string;
  instanceServers: KucoinTokenResponseDataInstanceServer[];
};

export type KucoinTokenResponse = {
  code: string; // "200000" for success
  data: KucoinTokenResponseData;
};

// KuCoin WebSocket Message Types
export type KucoinWelcomeMessage = {
  id: string; // Echoes connectId used in WebSocket URL
  type: 'welcome';
};

export type KucoinPongMessage = {
  id: string; // Echoes ping id
  type: 'pong';
};

export type KucoinSubscribeMessage = {
  id: string; // Client-generated ID for the subscription request (matches connectId for initial topic per docs)
  type: 'subscribe';
  topic: string; // e.g., /market/ticker:all or /market/ticker:BTC-USDT
  privateChannel?: boolean; // false for public topics
  response?: boolean; // true to request an ack
};

export type KucoinAckMessage = {
  id: string; // Should match the subscribe ID
  type: 'ack';
};

export type KucoinPingMessage = {
  id: string; // Client-generated ID for the ping (e.g., timestamp)
  type: 'ping';
};

export type KucoinErrorMessage = {
  id?: string; // Optional, may be present if related to a specific request
  type: 'error';
  code: string; // e.g., "401"
  data: string; // Error message description
};

// Represents the 'data' object within a ticker message for /market/ticker:all
// Based on user's summary and "Get All Tickers" REST API common fields
export type KucoinRawTickerData = {
  last: string;         // Last traded price
  buy: string;          // Best bid price
  sell: string;         // Best ask price
  changeRate: string;   // 24-hour change rate (e.g., "0.01" for 1%)
  changePrice: string;  // 24-hour change in price
  high: string;         // 24-hour high price
  low: string;          // 24-hour low price
  vol: string;          // 24-hour trading volume (in base currency)
  volValue?: string;     // 24-hour trading volume (in quote currency, optional)
  time?: number;         // Optional: Timestamp of the data, if provided by this specific feed
  // Fields from the /market/ticker:SYMBOL example, might not all be in /market/ticker:all's data part
  sequence?: string;
  price?: string;        // Equivalent to 'last'
  size?: string;         // Last traded amount
  bestAsk?: string;      // Equivalent to 'sell'
  bestAskSize?: string;
  bestBid?: string;       // Equivalent to 'buy'
  bestBidSize?: string;
  Time?: number;         // Timestamp of the latest transaction in milliseconds
};

// Represents a message from the /market/ticker:all topic
export type KucoinTickerMessageAll = {
  type: 'message';
  topic: '/market/ticker:all';
  subject: string; // The trading symbol, e.g., "BTC-USDT"
  data: KucoinRawTickerData;
};

// Union type for all expected incoming messages from KuCoin WebSocket
export type IncomingKucoinWebSocketMessage =
  | KucoinWelcomeMessage
  | KucoinPongMessage
  | KucoinAckMessage
  | KucoinTickerMessageAll
  | KucoinErrorMessage;

// Processed ticker data for UI display
export type DisplayTickerData = {
  symbol: string;
  lastPrice: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  changeRate24h: number | null; // As a percentage, e.g., 1.0 for 1%
  changePrice24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null; // In base currency
  lastUpdate: Date; // Derived from message receipt or 'Time' field if present
};

// WebSocket connection status
export type WebSocketStatus =
  | 'idle'
  | 'fetching_token' // Changed from connecting_token
  | 'connecting_ws'
  | 'welcomed'         // Received "welcome" from server
  | 'subscribing'
  | 'subscribed'       // Subscription acknowledged, receiving data
  | 'disconnected'
  | 'error';

// Old opportunity types (can be removed if no longer used by this feature)
// export type OpportunityPayload = {
//   id: string;
//   name: string;
//   symbol: string;
//   entryPrice: number;
//   currentPrice: number;
//   percentChange: number;
//   updatedAt: string;
// };

// export type OpportunityMessage =
//   | {
//       type: "new_opportunity";
//       payload: OpportunityPayload;
//     }
//   | {
//       type: "opportunity_update";
//       payload: OpportunityPayload;
//     }
//   | {
//       type: "remove_opportunity";
//       payload: { id: string };
//     }
//   | {
//       type: "heartbeat";
//       timestamp: string;
//     }
//   | {
//       type: "error";
//       message: string;
//     };
