import { z } from 'zod';

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

// DEX Screener API Types - Original Three
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
  name: z.string().optional().nullable(), // Though not directly in sample, often used for display
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  links: z.array(DexLinkSchema).optional().nullable(),
  // symbol: z.string().optional().nullable(), // Removed as per last correction
});
export type TokenProfileItem = z.infer<typeof TokenProfileItemSchema>;

export const TokenBoostItemSchema = z.object({
  url: z.string().url().optional().nullable(),
  chainId: z.string(),
  tokenAddress: z.string(),
  name: z.string().optional().nullable(), // Though not directly in sample
  amount: z.number().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  links: z.array(DexLinkSchema).optional().nullable(),
  // symbol: z.string().optional().nullable(), // Removed as per last correction
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

// Using z.record for dynamic keys like "m5", "h1", etc.
export const TxnsSchema = z.record(z.string(), TxnsDetailSchema.optional()).optional().nullable();
export type PairTxns = z.infer<typeof TxnsSchema>;

export const VolumeSchema = z.record(z.string(), z.coerce.number().optional()).optional().nullable();
export type PairVolume = z.infer<typeof VolumeSchema>;

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
  type: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
});
export type PairSocial = z.infer<typeof PairInfoSocialSchema>;

export const PairInfoDetailsSchema = z.object({
  imageUrl: z.string().url().optional().nullable(),
  websites: z.array(PairInfoWebsiteSchema).optional().nullable(),
  socials: z.array(PairInfoSocialSchema).optional().nullable(),
  description: z.string().optional().nullable(), // Added description as per common API patterns
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
  pairs: z.array(PairDetailSchema),
});
export type PairData = z.infer<typeof PairDataSchema>;
