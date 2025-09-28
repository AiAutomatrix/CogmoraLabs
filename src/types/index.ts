

import { z } from 'zod';

export const PaperTradeSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  symbolName: z.string(),
  size: z.number(), // Amount of tokens
  entryPrice: z.number(),
  currentPrice: z.number(),
  side: z.enum(['buy', 'sell']),
  timestamp: z.number(),
  status: z.enum(['open', 'closed']),
  pnl: z.number().optional(), // Profit and Loss on close
});
export type PaperTrade = z.infer<typeof PaperTradeSchema>;

export const OpenPositionSchema = z.object({
  symbol: z.string(),
  symbolName: z.string(),
  size: z.number(),
  averageEntryPrice: z.number(),
  currentPrice: z.number(),
});
export type OpenPosition = z.infer<typeof OpenPositionSchema>;

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
  tokenAddress: z_string(),
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
