
'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairDataSchema, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Helper function to fetch and parse data
async function fetchApiData<T>(endpoint: string, isSingleObjectResponseToArray: boolean = false): Promise<T | T[] | null> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();

    if (isSingleObjectResponseToArray) {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return [data as T]; // Wrap single object in an array
      } else if (Array.isArray(data)) { // Should not happen if isSingleObjectResponseToArray is true, but good fallback
        return data as T[];
      }
      return [] as T[]; // Fallback for unexpected structure
    }
    
    // For endpoints that return arrays or specific object structures directly
    return data as T;

  } catch (error) {
    console.error(`Error in fetchApiData for ${endpoint}:`, error);
    // throw error; // Re-throw to be caught by the caller, or return null
    return null;
  }
}


export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  try {
    const result = await fetchApiData<TokenProfileItem>(`/token-profiles/latest/v1`, true);
    return (result as TokenProfileItem[] | null) || [];
  } catch (error) {
    console.error('Error in fetchLatestTokenProfiles:', error);
    return [];
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const result = await fetchApiData<TokenBoostItem>(`/token-boosts/latest/v1`, true);
    return (result as TokenBoostItem[] | null) || [];
  } catch (error) {
    console.error('Error in fetchLatestBoostedTokens:', error);
    return [];
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const result = await fetchApiData<TokenBoostItem>(`/token-boosts/top/v1`, true);
    return (result as TokenBoostItem[] | null) || [];
  } catch (error) {
    console.error('Error in fetchTopBoostedTokens:', error);
    return [];
  }
}

export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  try {
    const result = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
    return (result as OrderInfoItem[] | null) || [];
  } catch (error) {
    console.error(`Error in fetchTokenOrders for ${chainId}/${tokenAddress}:`, error);
    return [];
  }
}

export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairDataSchema | null> {
  // The API doc uses {pairId} in path, but example suggests pairAddress. Assuming pairAddress is the ID.
  try {
    const result = await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
    return result as PairDataSchema | null;
  } catch (error) {
    console.error(`Error in fetchPairDetailsByPairAddress for ${chainId}/${pairAddress}:`, error);
    return null;
  }
}

export async function searchPairs(query: string): Promise<PairDataSchema | null> {
  try {
    const result = await fetchApiData<PairDataSchema>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
    return result as PairDataSchema | null;
  } catch (error) {
    console.error(`Error in searchPairs for query "${query}":`, error);
    return null;
  }
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
  // This API endpoint returns an array of PairDetail-like objects directly.
  try {
    const result = await fetchApiData<PairDetail[]>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
    return (result as PairDetail[] | null) || [];
  } catch (error) {
    console.error(`Error in fetchTokenPairPools for ${chainId}/${tokenAddress}:`, error);
    return [];
  }
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
  // This API endpoint returns an array of PairDetail-like objects directly.
  // tokenAddresses should be comma-separated.
  try {
    const result = await fetchApiData<PairDetail[]>(`/tokens/v1/${chainId}/${tokenAddresses}`);
    return (result as PairDetail[] | null) || [];
  } catch (error) {
    console.error(`Error in fetchPairsByTokenAddresses for ${chainId} with addresses ${tokenAddresses}:`, error);
    return [];
  }
}
