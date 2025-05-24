'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairDataSchema, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Generic helper function to fetch and parse data
async function fetchApiData<T>(endpoint: string, isSingleObjectResponseToArray: boolean = false): Promise<T> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    
    if (isSingleObjectResponseToArray) {
      // For endpoints that return a single object but we want to treat as an array of one
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return [data] as T;
      }
      // If it's unexpectedly an array already, or empty/null, return as is (or an empty array)
      return (Array.isArray(data) ? data : []) as T;
    }
    
    return data as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${endpoint}:`, error);
    // Re-throw or return a specific error structure / default value
    // For simplicity, re-throwing; UI components should handle this.
    throw error; 
  }
}

export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  try {
    return await fetchApiData<TokenProfileItem[]>('/token-profiles/latest/v1', true);
  } catch (error) {
    return []; // Return empty array on error
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
   try {
    return await fetchApiData<TokenBoostItem[]>('/token-boosts/latest/v1', true);
  } catch (error) {
    return [];
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
   try {
    return await fetchApiData<TokenBoostItem[]>('/token-boosts/top/v1', true);
  } catch (error) {
    return [];
  }
}

export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  if (!chainId || !tokenAddress) {
    console.warn('fetchTokenOrders: chainId and tokenAddress are required.');
    return [];
  }
  try {
    return await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
  } catch (error) {
    return [];
  }
}

export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairDataSchema | null> {
  if (!chainId || !pairAddress) {
    console.warn('fetchPairDetailsByPairAddress: chainId and pairAddress are required.');
    return null;
  }
  try {
    // This endpoint returns an object like { schemaVersion: "...", pairs: [...] }
    return await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
  } catch (error) {
    return null;
  }
}

export async function searchPairs(query: string): Promise<PairDataSchema | null> {
  if (!query) {
    console.warn('searchPairs: query is required.');
    return null;
  }
  try {
    // This endpoint returns an object like { schemaVersion: "...", pairs: [...] }
    return await fetchApiData<PairDataSchema>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
  } catch (error) {
    return null;
  }
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
   if (!chainId || !tokenAddress) {
    console.warn('fetchTokenPairPools: chainId and tokenAddress are required.');
    return [];
  }
  try {
    // API docs say this returns object[], which we've typed as PairDetail[]
    return await fetchApiData<PairDetail[]>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
  } catch (error) {
    return [];
  }
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
   if (!chainId || !tokenAddresses) {
    console.warn('fetchPairsByTokenAddresses: chainId and tokenAddresses are required.');
    return [];
  }
  try {
    // API docs say this returns object[], which we've typed as PairDetail[]
    return await fetchApiData<PairDetail[]>(`/tokens/v1/${chainId}/${tokenAddresses}`);
  } catch (error) {
    return [];
  }
}