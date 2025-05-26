
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
  id: string; // Client-generated ID for the subscription request
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
  buy: string | null;          // Best bid price
  sell: string | null;         // Best ask price
  changeRate: string | null;   // 24-hour change rate (e.g., "0.01" for 1%)
  changePrice: string | null;  // 24-hour change in price
  high: string | null;         // 24-hour high price
  low: string | null;          // 24-hour low price
  vol: string | null;          // 24-hour trading volume (in base currency)
  last: string | null;         // Last traded price
  // Fields from the /market/ticker:SYMBOL example, might not all be in /market/ticker:all's data part
  sequence?: string;
  price?: string;        // Equivalent to 'last' in some contexts
  size?: string;         // Last traded amount (if available from this specific feed)
  bestAsk?: string;      // Can be different from 'sell' if structure varies
  bestAskSize?: string;
  bestBid?: string;       // Can be different from 'buy'
  bestBidSize?: string;
  Time?: number;         // Timestamp (ms) of the latest transaction or data update
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
  changeRate24h: number | null; 
  changePrice24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null; 
  bestBid: number | null;       // Added for specific BBO display
  bestBidSize: number | null;   // Added
  bestAsk: number | null;       // Added
  bestAskSize: number | null;   // Added
  size: number | null;          // Last trade size
  lastUpdate: Date | null; 
  sequence?: string;
};

// WebSocket connection status
export type WebSocketStatus =
  | 'idle'
  | 'fetching_token'
  | 'connecting_ws'
  | 'welcomed'         // Received "welcome" from server, ready to subscribe
  | 'subscribing'
  | 'subscribed'       // Subscription acknowledged, receiving data
  | 'disconnected'
  | 'error';
