
'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairData, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Generic helper function to fetch and parse data from Dex Screener API
async function fetchApiData<T>(endpoint: string, isSingleObjectResponseToArray: boolean = false): Promise<T | null> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`DEX API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      // Consider throwing a more specific error or returning a structured error object
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();

    if (isSingleObjectResponseToArray && data && typeof data === 'object' && !Array.isArray(data)) {
      return [data] as unknown as T; // Wrap single object in an array
    }
    return data as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${endpoint}:`, error);
    // Depending on how you want to handle errors upstream, you might re-throw or return null/empty
    return null;
  }
}

export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  const data = await fetchApiData<TokenProfileItem[]>('/token-profiles/latest/v1', true);
  return data || [];
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  const data = await fetchApiData<TokenBoostItem[]>('/token-boosts/latest/v1', true);
  return data || [];
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  const data = await fetchApiData<TokenBoostItem[]>('/token-boosts/top/v1', true);
  return data || [];
}

export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  if (!chainId || !tokenAddress) {
    console.error("fetchTokenOrders: chainId and tokenAddress are required.");
    return [];
  }
  const data = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
  return data || [];
}

// Fetches one specific pair by its address
export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairData | null> {
   if (!chainId || !pairAddress) {
    console.error("fetchPairDetailsByPairAddress: chainId and pairAddress are required.");
    return null;
  }
  // The API path is /latest/dex/pairs/{chainId}/{pairId} - assuming pairAddress is used as pairId
  return fetchApiData<PairData>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
}

export async function searchPairs(query: string): Promise<PairData | null> {
  if (!query) {
    console.error("searchPairs: query is required.");
    return null;
  }
  return fetchApiData<PairData>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
   if (!chainId || !tokenAddress) {
    console.error("fetchTokenPairPools: chainId and tokenAddress are required.");
    return [];
  }
  // This endpoint directly returns an array of pair-like objects
  const data = await fetchApiData<PairDetail[]>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
  return data || [];
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
  if (!chainId || !tokenAddresses) {
    console.error("fetchPairsByTokenAddresses: chainId and tokenAddresses are required.");
    return [];
  }
  // This endpoint directly returns an array of pair-like objects
  const data = await fetchApiData<PairDetail[]>(`/tokens/v1/${chainId}/${tokenAddresses}`);
  return data || [];
}

