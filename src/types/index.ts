

import { z } from 'zod';

//==========================================================================
// CORE FIRESTORE SCHEMAS
//==========================================================================

export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  createdAt: z.any(), // Typically a Firestore Timestamp
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const FirestorePaperTradingContextSchema = z.object({
  balance: z.number().default(100000),
  equity: z.number().optional(),
  unrealizedPnl: z.number().optional(),
  realizedPnl: z.number().optional(),
  winRate: z.number().optional(),
  wonTrades: z.number().optional(),
  lostTrades: z.number().optional(),
  automationConfig: z.any(), // Keeping it simple for now
  aiSettings: z.any(),
  lastAiActionPlan: z.any().nullable(),
  aiActionLogs: z.array(z.any()),
  lastManualAiRunTimestamp: z.number().nullable().optional(),
});
export type FirestorePaperTradingContext = z.infer<typeof FirestorePaperTradingContextSchema>;


export const PaperTradeSchema = z.object({
  id: z.string().optional(),
  positionId: z.string(),
  positionType: z.enum(['spot', 'futures']),
  symbol: z.string(),
  symbolName: z.string(),
  side: z.enum(['buy', 'long', 'short', 'sell']),
  size: z.number(),
  entryPrice: z.number(),
  closePrice: z.number().optional().nullable(),
  leverage: z.number().nullable(),
  openTimestamp: z.any().optional(),
  closeTimestamp: z.any().optional().nullable(),
  pnl: z.number().optional().nullable(),
  status: z.enum(['open', 'closed']),
});
export type PaperTrade = z.infer<typeof PaperTradeSchema>;


export const OpenPositionDetailsSchema = z.object({
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  triggeredBy: z.string().optional(),
  status: z.enum(['open', 'closing']).optional(),
  closePrice: z.number().optional(), // Price at the moment of manual close
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
  leverage: z.number().optional().nullable(),
  unrealizedPnl: z.number().optional(),
  priceChgPct: z.number().optional(),
  liquidationPrice: z.number().optional(),
  details: OpenPositionDetailsSchema.optional(),
});
export type OpenPosition = z.infer<typeof OpenPositionSchema>;

export const MarketChangeSchema = z.object({
    changePrice: z.number().optional().nullable(),
    changeRate: z.number().optional().nullable(),
    high: z.number().optional().nullable(),
    low: z.number().optional().nullable(),
    open: z.number().optional().nullable(),
    vol: z.number().optional().nullable(),
    volValue: z.number().optional().nullable(),
});
export type MarketChange = z.infer<typeof MarketChangeSchema>;

export const SpotSnapshotDataSchema = z.object({
    askSize: z.number().optional().nullable(),
    averagePrice: z.number().optional().nullable(),
    baseCurrency: z.string().optional().nullable(),
    bidSize: z.number().optional().nullable(),
    board: z.number().optional().nullable(), //Trading pair partition： 0.primary partition 1.KuCoin Plus", example = "1"
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
    mark: z.number().optional().nullable(), //Trading Pair Mark： 0.default 1.ST. 2.NEW", example = "1"
    market: z.string().optional().nullable(),
    marketChange1h: MarketChangeSchema.optional().nullable(),
    marketChange24h: MarketChangeSchema.optional().nullable(),
    marketChange4h: MarketChangeSchema.optional().nullable(),
    markets: z.array(z.string()).optional().nullable(),
    open: z.number().optional().nullable(),
    quoteCurrency: z.string().optional().nullable(),
    sell: z.number().optional().nullable(),
    siteTypes: z.array(z.string()).optional().nullable(),
    sort: z.number().optional().nullable(), //sorting number(Pointless)
    symbol: z.string().optional().nullable(),
    symbolCode: z.string().optional().nullable(),
    takerCoefficient: z.number().optional().nullable(),
    takerFeeRate: z.number().optional().nullable(),
    trading: z.boolean().optional().nullable(),
    vol: z.number().optional().nullable(),
    volValue: z.number().optional().nullable(), //24-hour rolling transaction volume, refreshed every 2s
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
    futuresContractData: z.any().optional(), // To store full futures contract info
    baseCurrency: z.string().optional(),
    quoteCurrency: z.string().optional(),
    hasFutures: z.boolean().optional(),
    futuresSymbol: z.string().optional(),
    order: z.number().optional(), // Added for sorting
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const PriceAlertSchema = z.object({
    price: z.number(),
    condition: z.enum(['above', 'below']),
    triggered: z.boolean(),
    notified: z.boolean().optional(),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const TradeTriggerDetailsSchema = z.object({
  status: z.enum(['active', 'executed', 'canceled']),
});
export type TradeTriggerDetails = z.infer<typeof TradeTriggerDetailsSchema>;

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
  cancelOthers: z.boolean().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  details: TradeTriggerDetailsSchema,
});
export type TradeTrigger = z.infer<typeof TradeTriggerSchema>;

// This is the type for the AI output, omitting fields the AI should not generate
export const ProposedTradeTriggerSchema = TradeTriggerSchema.omit({ id: true, details: true });
export type ProposedTradeTrigger = z.infer<typeof ProposedTradeTriggerSchema>;


//==========================================================================
// AI AGENT SCHEMAS
//==========================================================================

export const AgentCreateActionSchema = z.object({
  type: z.literal('CREATE'),
  trigger: ProposedTradeTriggerSchema.describe("The full trigger object to be created."),
  reasoning: z.string().describe("A brief justification for why this new trigger is being proposed."),
});
export const AgentUpdateActionSchema = z.object({
  type: z.literal('UPDATE'),
  triggerId: z.string().describe("The ID of the active trigger to update."),
  updates: ProposedTradeTriggerSchema.partial().describe("The specific fields of the trigger to change."),
  reasoning: z.string().describe("A brief justification for why this update is being suggested."),
});
export const AgentCancelActionSchema = z.object({
  type: z.literal('CANCEL'),
  triggerId: z.string().describe("The ID of the active trigger to cancel."),
  reasoning: z.string().describe("A brief justification for why this cancellation is recommended."),
});
export const AgentUpdateOpenPositionActionSchema = z.object({
  type: z.literal('UPDATE_OPEN_POSITION'),
  positionId: z.string().describe("The ID of the open position to update."),
  updates: z.object({
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
  }).describe("The new Stop Loss and/or Take Profit levels."),
  reasoning: z.string().describe("A brief justification for why this position update is being suggested."),
});
export const AgentActionSchema = z.union([
  AgentCreateActionSchema, 
  AgentUpdateActionSchema, 
  AgentCancelActionSchema,
  AgentUpdateOpenPositionActionSchema,
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

// Correctly define the log schema as an object containing the action and the timestamp
export const AiActionExecutionLogSchema = z.intersection(
  AgentActionSchema,
  z.object({
    executedAt: z.number(),
  })
);
export type AiActionExecutionLog = z.infer<typeof AiActionExecutionLogSchema>;


export const AgentActionPlanSchema = z.object({
  analysis: z.string().describe("The AI's overall analysis of the market, watchlist, and active triggers, explaining the strategy behind its plan."),
  plan: z.array(AgentActionSchema).describe("An array of actions (CREATE, UPDATE, CANCEL) the AI wants to take."),
});
export type AgentActionPlan = z.infer<typeof AgentActionPlanSchema>;


export const AiTriggerSettingsSchema = z.object({
  instructions: z.string().optional(),
  setSlTp: z.boolean().optional(),
  scheduleInterval: z.number().nullable().optional(), // in ms, null for manual
  nextRun: z.number().nullable().optional(), // Timestamp for next scheduled run
  autoExecute: z.boolean().optional(),
  justCreate: z.boolean().optional(),
  justUpdate: z.boolean().optional(),
  manageOpenPositions: z.boolean().optional(),
});
export type AiTriggerSettings = z.infer<typeof AiTriggerSettingsSchema>;

const AccountMetricsSchema = z.object({
  balance: z.number().describe("The user's available cash balance."),
  equity: z.number().describe("The total value of the account (balance + positions value + unrealized P&L)."),
  realizedPnl: z.number().describe("The sum of all profit and loss from closed trades."),
  unrealizedPnl: z.number().describe("The current floating profit and loss from all open positions."),
  winRate: z.number().describe("The percentage of closed trades that were profitable."),
  wonTrades: z.number().describe("The total number of profitable closed trades."),
  lostTrades: z.number().describe("The total number of unprofitable or break-even closed trades."),
});

export const ProposeTradeTriggersInputSchema = z.object({
  watchlist: z.array(WatchlistItemSchema),
  activeTriggers: z.array(TradeTriggerSchema),
  openPositions: z.array(OpenPositionSchema), // New field
  accountMetrics: AccountMetricsSchema,
  settings: AiTriggerSettingsSchema,
});
export type ProposeTradeTriggersInput = z.infer<typeof ProposeTradeTriggersInputSchema>;

// This is the old output schema, which will now be replaced by AgentActionPlanSchema
export const ProposeTradeTriggersOutputSchema = z.object({
  analysis: z.string().describe("A brief, high-level summary of the overall market sentiment based on the provided symbols. Should be conversational and insightful."),
  proposedTriggers: z.array(ProposedTradeTriggerSchema).describe("An array of 3-5 diverse trade trigger objects based on the watchlist data."),
});
export type ProposeTradeTriggersOutput = z.infer<typeof ProposeTradeTriggersOutputSchema>;

//==========================================================================
// AUTOMATION SCHEMAS
//==========================================================================

export const AutomationRuleSchema = z.object({
    id: z.string(),
    source: z.enum(['spot', 'futures']),
    criteria: z.enum(['top_volume', 'bottom_volume', 'top_change', 'bottom_change']),
    count: z.number().min(1),
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export const AutomationConfigSchema = z.object({
    rules: z.array(AutomationRuleSchema),
    updateMode: z.enum(['one-time', 'auto-refresh']),
    refreshInterval: z.number(), // in milliseconds
    clearExisting: z.boolean(),
    lastRun: z.number().nullable().optional(), // Timestamp of the last run
});
export type AutomationConfig = z.infer<typeof AutomationConfigSchema>;


//==========================================================================
// MISC & LEGACY SCHEMAS
//==========================================================================

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
export type PairPriceChange = z.infer<typeof PriceChangeSchema>;

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

//==========================================================================
// KUCOIN API & WEBSOCKET SCHEMAS
//==========================================================================

export const KucoinFuturesContractSchema = z.object({
    symbol: z.string(),
    rootSymbol: z.string(),
    type: z.string(),
    firstOpenDate: z.number(),
    expireDate: z.number().nullable(),
    settleDate: z.number().nullable(),
    baseCurrency: z.string(),
    quoteCurrency: z.string(),
    settleCurrency: z.string(),
    maxOrderQty: z.number(),
    maxPrice: z.number(),
    lotSize: z.number(),
    tickSize: z.number(),
    indexPriceTickSize: z.number(),
    multiplier: z.number(),
    initialMargin: z.number(),
    maintainMargin: z.number(),
    maxRiskLimit: z.number(),
    minRiskLimit: z.number(),
    riskStep: z.number(),
    makerFeeRate: z.number(),
    takerFeeRate: z.number(),
    takerFixFee: z.number(),
    makerFixFee: z.number(),
    settlementFee: z.number().nullable(),
    isDeleverage: z.boolean(),
    isQuanto: z.boolean(),
    isInverse: z.boolean(),
    markMethod: z.string(),
    fairMethod: z.string(),
    fundingBaseSymbol: z.string(),
    fundingQuoteSymbol: z.string(),
    fundingRateSymbol: z.string(),
    indexSymbol: z.string(),
    settlementSymbol: z.string(),
    status: z.string(),
    fundingFeeRate: z.number(),
    predictedFundingFeeRate: z.number(),
    openInterest: z.string(),
    turnoverOf24h: z.number(),
    volumeOf24h: z.number(),
    markPrice: z.number(),
    indexPrice: z.number(),
    lastTradePrice: z.number(),
    nextFundingRateTime: z.number(),
    maxLeverage: z.number(),
    sourceExchanges: z.array(z.string()),
    premiumsSymbol1M: z.string(),
    premiumsSymbol8H: z.string(),
    fundingBaseSymbol1M: z.string(),
    fundingQuoteSymbol1M: z.string(),
    lowPrice: z.number(),
    highPrice: z.number(),
    priceChgPct: z.number(),
    priceChg: z.number(),
    k: z.number(),
    m: z.number(),
    f: z.number(),
    mmrLimit: z.number(),
    mmrLevConstant: z.number(),
    supportCross: z.boolean(),
    buyLimit: z.number(),
    sellLimit: z.number(),
});
export type KucoinFuturesContract = z.infer<typeof KucoinFuturesContractSchema>;


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

export const KucoinSnapshotDataWrapperSchema = z.object({
    data: SpotSnapshotDataSchema,
    sequence: z.string(),
});
export type KucoinSnapshotDataWrapper = z.infer<typeof KucoinSnapshotDataWrapperSchema>;


export type KucoinTickerMessage = {
  type: 'message';
  topic: string; // e.g., /market/ticker:BTC-USDT or /market/ticker:all
  subject: 'trade.ticker' | 'trade.snapshot';
  data: z.infer<typeof z.any>; // Was KucoinTicker which is not a Zod schema
};

export type IncomingKucoinWebSocketMessage =
  | KucoinWelcomeMessage
  | KucoinPongMessage
  | KucoinAckMessage
  | KucoinTickerMessage
  | KucoinErrorMessage;


// KuCoin FUTURES WebSocket Message Types
export const FuturesSnapshotDataSchema = z.object({
    highPrice: z.number(),
    lastPrice: z.number(),
    lowPrice: z.number(),
    price24HoursBefore: z.number(),
    priceChg: z.number(),
    priceChgPct: z.number(),
    symbol: z.string(),
    ts: z.number(),
    turnover: z.number(),
    volume: z.number(),
    openInterest: z.string().optional(),
    markPrice: z.number().optional(),
});
export type FuturesSnapshotData = z.infer<typeof FuturesSnapshotDataSchema>;

export type KucoinFuturesSnapshotMessage = {
    topic: string; // /contractMarket/snapshot:XBTUSDTM
    type: 'message';
    subject: 'snapshot';
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

    
