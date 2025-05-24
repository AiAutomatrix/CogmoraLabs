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

// DEX Screener API Types
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
  name: z.string().optional().nullable(), // Name is often the description or a separate field
  // symbol: z.string().optional().nullable(), // Removed: Not directly available in API for profiles/boosts
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(), // Will be used for name if name field is missing
  links: z.array(DexLinkSchema).optional().nullable(),
});
export type TokenProfileItem = z.infer<typeof TokenProfileItemSchema>;

export const TokenBoostItemSchema = z.object({
  url: z.string().url().optional().nullable(),
  chainId: z.string(),
  tokenAddress: z.string(),
  name: z.string().optional().nullable(), // Name is often the description or a separate field
  // symbol: z.string().optional().nullable(), // Removed: Not directly available in API for profiles/boosts
  amount: z.number().optional().nullable(),
  totalAmount: z.number().optional().nullable(),
  icon: z.string().url().optional().nullable(),
  header: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(), // Will be used for name if name field is missing
  links: z.array(DexLinkSchema).optional().nullable(),
});
export type TokenBoostItem = z.infer<typeof TokenBoostItemSchema>;

// Schema for /orders/v1/{chainId}/{tokenAddress}
export const OrderInfoItemSchema = z.object({
  type: z.string(),
  status: z.string(),
  paymentTimestamp: z.number(),
});
export type OrderInfoItem = z.infer<typeof OrderInfoItemSchema>;

// Schemas for pair data
export const TokenInfoSchema = z.object({
  address: z.string(),
  name: z.string(),
  symbol: z.string(),
});
export type TokenInfo = z.infer<typeof TokenInfoSchema>;

export const TxnsDetailSchema = z.object({
  buys: z.number(),
  sells: z.number(),
});
export type TxnsDetail = z.infer<typeof TxnsDetailSchema>;

// Using z.record for dynamic keys like "m5", "h1", etc.
export const TxnsSchema = z.record(z.string(), TxnsDetailSchema);
export type PairTxns = z.infer<typeof TxnsSchema>;

export const VolumeSchema = z.record(z.string(), z.coerce.number());
export type PairVolume = z.infer<typeof VolumeSchema>;

export const PriceChangeSchema = z.record(z.string(), z.coerce.number());
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
  type: z.string().optional().nullable(), // API docs show 'type' sometimes, platform is more common
  name: z.string().optional().nullable(), // 'name' can sometimes be used for social links
  handle: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
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
  dexId: z.string(),
  url: z.string().url(),
  pairAddress: z.string(),
  labels: z.array(z.string()).optional().nullable(),
  baseToken: TokenInfoSchema,
  quoteToken: TokenInfoSchema,
  priceNative: z.string().optional().nullable(),
  priceUsd: z.string().optional().nullable(),
  txns: TxnsSchema.optional().nullable(),
  volume: VolumeSchema.optional().nullable(),
  priceChange: PriceChangeSchema.optional().nullable(),
  liquidity: LiquiditySchema.optional().nullable(),
  fdv: z.number().optional().nullable(),
  marketCap: z.number().optional().nullable(),
  pairCreatedAt: z.number().optional().nullable(), // Timestamp
  info: PairInfoDetailsSchema.optional().nullable(),
  boosts: z.object({ active: z.number().optional().nullable() }).optional().nullable(),
});
export type PairDetail = z.infer<typeof PairDetailSchema>;

// Schema for responses that wrap an array of pairs
export const PairDataSchema = z.object({
  schemaVersion: z.string(),
  pairs: z.array(PairDetailSchema),
});
export type PairData = z.infer<typeof PairDataSchema>;