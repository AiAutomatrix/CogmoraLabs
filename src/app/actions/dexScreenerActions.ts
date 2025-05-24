'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairDataSchema, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Generic helper function to fetch and parse data
async function fetchApiData<T>(endpoint: string, isSingleObjectResponseToArray: boolean = false): Promise<T | null> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();

    if (isSingleObjectResponseToArray) {
      // For endpoints that return a single object, wrap it in an array as T (which would be T_Item[])
      // This is a bit of a hack due to the generic type T. It assumes T is desired as an array of the item.
      // A more type-safe way would be for the calling function to handle the array wrapping.
      // For now, if T is FooItem[], and API returns FooItem, we wrap it.
      return [data] as unknown as T; // Cast needed due to generic manipulation
    }
    return data as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${endpoint}:`, error);
    // throw error; // Re-throw to be caught by the specific action
    return null; // Return null on error to be handled by UI
  }
}

export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  try {
    const profile = await fetchApiData<TokenProfileItem>(`/token-profiles/latest/v1`, true);
    return profile ? (profile as unknown as TokenProfileItem[]) : []; // API returns single object
  } catch (error) {
    console.error("Error in fetchLatestTokenProfiles:", error);
    return [];
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
   try {
    const boosts = await fetchApiData<TokenBoostItem>(`/token-boosts/latest/v1`, true);
    return boosts ? (boosts as unknown as TokenBoostItem[]) : []; // API returns single object
  } catch (error) {
    console.error("Error in fetchLatestBoostedTokens:", error);
    return [];
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const boosts = await fetchApiData<TokenBoostItem>(`/token-boosts/top/v1`, true);
    return boosts ? (boosts as unknown as TokenBoostItem[]) : []; // API returns single object
  } catch (error) {
    console.error("Error in fetchTopBoostedTokens:", error);
    return [];
  }
}

export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  try {
    const orders = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
    return orders || []; // API returns array
  } catch (error) {
    console.error("Error in fetchTokenOrders:", error);
    return [];
  }
}

export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairDataSchema | null> {
  try {
    // Note: API doc uses {pairId} but example uses pairAddress. Assuming pairAddress is the ID.
    return await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`); // API returns PairDataSchema object
  } catch (error) {
    console.error("Error in fetchPairDetailsByPairAddress:", error);
    return null;
  }
}

export async function searchPairs(query: string): Promise<PairDataSchema | null> {
  try {
    return await fetchApiData<PairDataSchema>(`/latest/dex/search?q=${encodeURIComponent(query)}`); // API returns PairDataSchema object
  } catch (error) {
    console.error("Error in searchPairs:", error);
    return null;
  }
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
  try {
    const pools = await fetchApiData<PairDetail[]>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
    return pools || []; // API returns array of PairDetail
  } catch (error) {
    console.error("Error in fetchTokenPairPools:", error);
    return [];
  }
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
  try {
    const pairs = await fetchApiData<PairDetail[]>(`/tokens/v1/${chainId}/${tokenAddresses}`);
    return pairs || []; // API returns array of PairDetail
  } catch (error) {
    console.error("Error in fetchPairsByTokenAddresses:", error);
    return [];
  }
}