

import { z } from 'zod';

export const PaperTradeSchema = z.object({
  id: z.string(),
  positionId: z.string(),
  positionType: z.enum(['spot', 'futures']),
  symbol: z.string(),
  symbolName: z.string(),
  size: z.number(),
  price: z.number(),
  side: z.enum(['buy', 'sell', 'long', 'short']),
  leverage: z.number().optional(),
  timestamp: z.number(),
  status: z.enum(['open', 'closed']),
  pnl: z.number().optional(),
});
export type PaperTrade = z.infer<typeof PaperTradeSchema>;

export const OpenPositionDetailsSchema = z.object({
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  triggeredBy: z.string().optional(), // e.g., 'manual', 'trigger:above', 'trigger:below'
});
export type OpenPositionDetails = z.infer<typeof OpenPositionDetailsSchema>;


export const OpenPositionSchema = z.object({
  id: z.string(),
  positionType: z.enum(['spot', 'futures']),
  symbol: z.string(),
  symbolName: z.string(),
  size: z.number(),
  averageEntryPrice: z.number(),
  currentPrice: z.number(),
  side: z.enum(['buy', 'long', 'short']),
  leverage: z.number().optional(),
  unrealizedPnl: z.number().optional(),
  details: OpenPositionDetailsSchema.optional(),
});
export type OpenPosition = z.infer<typeof OpenPositionSchema>;

export const MarketChangeSchema = z.object({
    changePrice: z.number().nullable(),
    changeRate: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    open: z.number().nullable(),
    vol: z.number().nullable(),
    volValue: z.number().nullable(),
});
export type MarketChange = z.infer<typeof MarketChangeSchema>;

export const SpotSnapshotDataSchema = z.object({
    askSize: z.number().optional().nullable(),
    averagePrice: z.number().optional().nullable(),
    baseCurrency: z.string().optional().nullable(),
    bidSize: z.number().optional().nullable(),
    board: z.number().optional().nullable(),
    buy: z.number().optional().nullable(),
    changePrice: z.number().optional().nullable(),
    changeRate: z.number().optional().nullable(),
    close: z.number().optional().nullable(),
    datetime: z.number().optional().nullable(),
    high: z.number().optional().nullable(),
    lastTradedPrice: z.number().optional().nullable(),
    low: z.number().optional().nullable(),
    makerCoefficient: z.number().optional().nullable(),
    makerFeeRate: z.number().optional().nullable(),
    marginTrade: z.boolean().optional().nullable(),
    mark: z.number().optional().nullable(),
    market: z.string().optional().nullable(),
    marketChange1h: MarketChangeSchema.optional().nullable(),
    marketChange24h: MarketChangeSchema.optional().nullable(),
    marketChange4h: MarketChangeSchema.optional().nullable(),
    markets: z.array(z.string()).optional().nullable(),
    open: z.number().optional().nullable(),
    quoteCurrency: z.string().optional().nullable(),
    sell: z.number().optional().nullable(),
    siteTypes: z.array(z.string()).optional().nullable(),
    sort: z.number().optional().nullable(),
    symbol: z.string().optional().nullable(),
    symbolCode: z.string().optional().nullable(),
    takerCoefficient: z.number().optional().nullable(),
    takerFeeRate: z.number().optional().nullable(),
    trading: z.boolean().optional().nullable(),
    vol: z.number().optional().nullable(),
    volValue: z.number().optional().nullable(),
});
export type SpotSnapshotData = z.infer<typeof SpotSnapshotDataSchema>;


export const WatchlistItemSchema = z.object({
    symbol: z.string(),
    symbolName: z.string(),
    type: z.enum(['spot', 'futures']),
    currentPrice: z.number(),
    high: z.number().optional(),
    low: z.number().optional(),
    priceChgPct: z.number().optional(),
    snapshotData: SpotSnapshotDataSchema.optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const PriceAlertSchema = z.object({
    price: z.number(),
    condition: z.enum(['above', 'below']),
    triggered: z.boolean(),
    notified: z.boolean().optional(),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const TradeTriggerSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  symbolName: z.string(),
  type: z.enum(['spot', 'futures']),
  condition: z.enum(['above', 'below']),
  targetPrice: z.number(),
  action: z.enum(['buy', 'long', 'short']),
  amount: z.number(), // For spot, this is USD amount. For futures, this is collateral.
  leverage: z.number(), // Only for futures
  status: z.enum(['active', 'executed', 'canceled']),
  cancelOthers: z.boolean().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});
export type TradeTrigger = z.infer<typeof TradeTriggerSchema>;

// Original TradeSchema, keeping if used elsewhere, but papertrade is more specific
export const TradeSchema = z.object({
  id: z.string(),
  cryptocurrency: z.string().min(1, "Cryptocurrency symbol is required (e.g., BTCUSDT)"),
  entryPrice: z.coerce.number().positive("Entry price must be a positive number"),
  targetPrice: z.coerce.number().positive("Target price must be a positive number"),
  stopLoss: z.coerce.number().positive("Stop loss must be a positive number"),
  status: z.enum(['active', 'closed']).default('active'),
  createdAt: z.date().default(() => new Date()),
});
export type Trade = z.infer<typeof TradeSchema>;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// DEX Screener API Types - Original
export const DexLinkSchema = z.object({
  type: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  url: z.string().url(),
});
export type DexLink = z.infer<typeof DexLinkSchema>;

export const TokenProfileItemSchema = z.object({
  url: z.string().url().optional().nullable(),
  chainId: z.string(),
  tokenAddress: z.string(),
  name: z.string().optional().nullable(),
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  links: z.array(DexLinkSchema).optional().nullable(),
});
export type TokenProfileItem = z.infer<typeof TokenProfileItemSchema>;

export const TokenBoostItemSchema = z.object({
  url: z.string().url().optional().nullable(),
  chainId: z.string(),
  tokenAddress: z.string(),
  name: z.string().optional().nullable(), // Added for consistency
  amount: z.number().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  links: z.array(DexLinkSchema).optional().nullable(),
});
export type TokenBoostItem = z.infer<typeof TokenBoostItemSchema>;

// DEX Screener API Types - New Additions
export const OrderInfoItemSchema = z.object({
  type: z.string(),
  status: z.string(),
  paymentTimestamp: z.number(), // Unix timestamp
});
export type OrderInfoItem = z.infer<typeof OrderInfoItemSchema>;

export const TokenInfoSchema = z.object({
  address: z.string(),
  name: z.string().optional().nullable(),
  symbol: z.string().optional().nullable(),
});
export type TokenInfo = z.infer<typeof TokenInfoSchema>;

export const TxnsDetailSchema = z.object({
  buys: z.number().optional().nullable(),
  sells: z.number().optional().nullable(),
});
export type TxnsDetail = z.infer<typeof TxnsDetailSchema>;

// Allows keys like "m5", "h1", "h6", "h24"
export const TxnsSchema = z.record(z.string(), TxnsDetailSchema.optional()).optional().nullable();
export type PairTxns = z.infer<typeof TxnsSchema>;

// Allows keys like "h24", "h6", "h1", "m5"
export const VolumeSchema = z.record(z.string(), z.coerce.number().optional()).optional().nullable();
export type PairVolume = z.infer<typeof VolumeSchema>;

// Allows keys like "m5", "h1", "h6", "h24"
export const PriceChangeSchema = z.record(z.string(), z.coerce.number().optional()).optional().nullable();
export type PairPriceChange = z.infer<typeof PairPriceChange>;

export const LiquiditySchema = z.object({
  usd: z.number().optional().nullable(),
  base: z.number().optional().nullable(),
  quote: z.number().optional().nullable(),
});
export type PairLiquidity = z.infer<typeof LiquiditySchema>;

export const PairInfoWebsiteSchema = z.object({
  label: z.string().optional().nullable(),
  url: z.string().url(),
});
export type PairWebsite = z.infer<typeof PairInfoWebsiteSchema>;

export const PairInfoSocialSchema = z.object({
  platform: z.string().optional().nullable(),
  type: z.string().optional().nullable(), // Added as some social objects might have type
  name: z.string().optional().nullable(), // Added as some social objects might have name
  handle: z.string().optional().nullable(), // For platforms like Twitter
  url: z.string().url().optional().nullable(), // URL might be directly available
});
export type PairSocial = z.infer<typeof PairInfoSocialSchema>;

export const PairInfoDetailsSchema = z.object({
  imageUrl: z.string().url().optional().nullable(),
  websites: z.array(PairInfoWebsiteSchema).optional().nullable(),
  socials: z.array(PairInfoSocialSchema).optional().nullable(),
  description: z.string().optional().nullable(),
});
export type PairInfo = z.infer<typeof PairInfoDetailsSchema>;

export const PairDetailSchema = z.object({
  chainId: z.string(),
  dexId: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  pairAddress: z.string(),
  labels: z.array(z.string()).optional().nullable(),
  baseToken: TokenInfoSchema,
  quoteToken: TokenInfoSchema,
  priceNative: z.string().optional().nullable(),
  priceUsd: z.string().optional().nullable(),
  txns: TxnsSchema,
  volume: VolumeSchema,
  priceChange: PriceChangeSchema,
  liquidity: LiquiditySchema.optional().nullable(),
  fdv: z.number().optional().nullable(),
  marketCap: z.number().optional().nullable(),
  pairCreatedAt: z.number().optional().nullable(), // Timestamp
  info: PairInfoDetailsSchema.optional().nullable(),
  boosts: z.object({ active: z.number().optional().nullable() }).optional().nullable(),
});
export type PairDetail = z.infer<typeof PairDetailSchema>;

export const PairDataSchema = z.object({
  schemaVersion: z.string(),
  pairs: z.array(PairDetailSchema).optional().nullable(), // Made optional and nullable based on potential API responses
});
export type PairData = z.infer<typeof PairDataSchema>;

// WebSocket types from websocket.ts are now here
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

// KuCoin SPOT WebSocket Message Types
export type KucoinWelcomeMessage = {
  id: string; // Echoes connectId used in WebSocket URL
  type: 'welcome';
};

export type KucoinPongMessage = {
  id: string; // Echoes ping id
  type: 'pong';
};

export type KucoinAckMessage = {
  id: string; // Should match the subscribe ID
  type: 'ack';
};

export type KucoinErrorMessage = {
  id?: string; 
  type: 'error';
  code: number; 
  data: string; 
};

// This interface is a bit of a union of the snapshot and ticker data
export interface KucoinTicker {
  symbol: string;
  symbolName: string;
  buy: string;
  sell: string;
  bestBidSize: string;
  bestAskSize: string;
  changeRate: string;
  changePrice: string;
  high: string;
  low: string;
  vol: string;
  volValue: string;
  last: string;
  averagePrice?: string;
  takerFeeRate?: string;
  makerFeeRate?: string;
  takerCoefficient?: string;
  makerCoefficient?: string;
  price?: string; // Add price to match ticker data structure
  lastTradedPrice?: string;
  datetime?: number;
}

export type KucoinSnapshotDataWrapper = {
    data: SpotSnapshotData;
    sequence: string;
}

export type KucoinTickerMessage = {
  type: 'message';
  topic: string; // e.g., /market/ticker:BTC-USDT or /market/ticker:all
  subject: 'trade.ticker' | 'trade.snapshot';
  data: KucoinTicker | KucoinSnapshotDataWrapper;
};

export type IncomingKucoinWebSocketMessage =
  | KucoinWelcomeMessage
  | KucoinPongMessage
  | KucoinAckMessage
  | KucoinTickerMessage
  | KucoinErrorMessage;


// KuCoin FUTURES WebSocket Message Types
export type FuturesSnapshotData = {
    highPrice: number;
    lastPrice: number;
    lowPrice: number;
    price24HoursBefore: number;
    priceChg: number;
    priceChgPct: number;
    symbol: string;
    ts: number;
    turnover: number;
    volume: number;
};

export type KucoinFuturesSnapshotMessage = {
    topic: string; // /contractMarket/snapshot:XBTUSDTM
    type: 'message';
    subject: 'snapshot.24h';
    id: string;
    data: FuturesSnapshotData;
};

export type IncomingKucoinFuturesWebSocketMessage =
  | KucoinWelcomeMessage
  | KucoinPongMessage
  | KucoinAckMessage
  | KucoinFuturesSnapshotMessage
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
