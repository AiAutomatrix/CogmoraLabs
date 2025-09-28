

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
  id: number;
  type: 'subscribe';
  topic: string;
  privateChannel?: boolean;
  response?: boolean;
};

export type KucoinUnsubscribeMessage = {
    id: number;
    type: 'unsubscribe';
    topic: string;
    privateChannel?: boolean;
    response?: boolean;
}

export type KucoinAckMessage = {
  id: string; // Should match the subscribe ID
  type: 'ack';
};

export type KucoinPingMessage = {
  id: string; 
  type: 'ping';
};

export type KucoinErrorMessage = {
  id?: string; 
  type: 'error';
  code: number; 
  data: string; 
};

// Based on the user provided example for /market/ticker:{symbol}
export type KucoinRawTickerData = {
    sequence: string;
    price: string;
    size: string;
    bestAsk: string;
    bestAskSize: string;
    bestBid: string;
    bestBidSize: string;
    time: number;
};

export type KucoinTickerMessage = {
  type: 'message';
  topic: string; // e.g., /market/ticker:BTC-USDT
  subject: 'trade.ticker';
  data: KucoinRawTickerData;
};

export type IncomingKucoinWebSocketMessage =
  | KucoinWelcomeMessage
  | KucoinPongMessage
  | KucoinAckMessage
  | KucoinTickerMessage
  | KucoinErrorMessage;

// WebSocket connection status
export type WebSocketStatus =
  | 'idle'
  | 'fetching_token'
  | 'connecting'
  | 'connected'
  | 'welcomed'
  | 'subscribed'
  | 'disconnected'
  | 'error';

    