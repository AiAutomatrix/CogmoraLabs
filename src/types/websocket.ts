
export type KucoinWelcomeMessage = {
  id: string;
  type: 'welcome';
};

export type KucoinPongMessage = {
  id: string; // Should match the ping ID
  type: 'pong';
};

export type KucoinSubscribeMessage = {
  id: number; // Client-generated ID
  type: 'subscribe';
  topic: string; // e.g., /market/ticker:all or /market/ticker:BTC-USDT
  privateChannel?: boolean; // false for public topics
  response?: boolean; // true to get an ack
};

export type KucoinAckMessage = {
  id: string; // Should match the subscribe ID
  type: 'ack';
};

export type KucoinPingMessage = {
  id: number; // Client-generated ID
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

// Old types - can be removed or kept if used elsewhere
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
