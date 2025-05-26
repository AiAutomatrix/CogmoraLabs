
// KuCoin WebSocket Token Response Types (Simulated)
export type KucoinTokenResponseDataInstanceServer = {
  endpoint: string;
  protocol: string;
  encrypt: boolean;
  pingInterval: number;
  pingTimeout: number;
};

export type KucoinTokenResponseData = {
  token: string;
  instanceServers: KucoinTokenResponseDataInstanceServer[];
};

export type KucoinTokenResponse = {
  code: string;
  data: KucoinTokenResponseData;
};

// KuCoin WebSocket Message Types
export type KucoinWelcomeMessage = {
  id: string; // Echoes connectId
  type: 'welcome';
};

export type KucoinPongMessage = {
  id: string; // Echoes ping id
  type: 'pong';
};

export type KucoinSubscribeMessage = {
  id: number; // Client-generated ID for the subscription request
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
  id: number; // Client-generated ID for the ping
  type: 'ping';
};

export type KucoinErrorMessage = {
  id?: string; // Optional, may be present if related to a specific request
  type: 'error';
  code: string; // e.g., "401"
  data: string; // Error message description
};

// Represents the 'data' object within a ticker message for /market/ticker:all
export type KucoinRawTickerData = {
  sequence: string;
  price: string; // Last traded price
  size: string;  // Last traded amount
  bestAsk: string;
  bestAskSize: string;
  bestBid: string;
  bestBidSize: string;
  Time: number; // Timestamp of the latest transaction in milliseconds
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
  price: number;
  size: number;
  bestAsk: number;
  bestAskSize: number;
  bestBid: number;
  bestBidSize: number;
  sequence: string;
  lastUpdate: Date;
};

// WebSocket connection status
export type WebSocketStatus =
  | 'idle'
  | 'connecting_token' // Fetching token
  | 'connecting_ws'    // WebSocket connecting
  | 'welcomed'         // Received "welcome" from server, ready to subscribe
  | 'subscribing'      // Subscription message sent, awaiting ack
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
