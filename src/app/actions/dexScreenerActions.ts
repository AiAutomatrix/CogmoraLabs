'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairDataSchema, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Helper function to fetch and parse data that always returns an array
// Used for endpoints that might return a single object but we want to treat as an array.
async function fetchDataAndWrapInArrayIfSingleObject<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data as T[];
    } else if (data && typeof data === 'object') {
      return [data as T]; // Wrap single object in an array
    }
    return []; // Fallback for unexpected structure
  } catch (error) {
    console.error(`Error in fetchDataAndWrapInArrayIfSingleObject for ${endpoint}:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

// Generic helper function to fetch and parse data, returning T or null
// Used for endpoints that return a specific object structure (like PairDataSchema) or an array directly.
async function fetchApiData<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${endpoint}:`, error);
    return null; 
  }
}


// Original three working functions
export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  try {
    return await fetchDataAndWrapInArrayIfSingleObject<TokenProfileItem>('/token-profiles/latest/v1');
  } catch (error) {
    console.error("Error in fetchLatestTokenProfiles:", error);
    return [];
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    return await fetchDataAndWrapInArrayIfSingleObject<TokenBoostItem>('/token-boosts/latest/v1');
  } catch (error) {
    console.error("Error in fetchLatestBoostedTokens:", error);
    return [];
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    return await fetchDataAndWrapInArrayIfSingleObject<TokenBoostItem>('/token-boosts/top/v1');
  } catch (error) {
    console.error("Error in fetchTopBoostedTokens:", error);
    return [];
  }
}

// New functions
export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  try {
    const orders = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
    return orders || [];
  } catch (error) {
    console.error("Error in fetchTokenOrders:", error);
    return [];
  }
}

export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairDataSchema | null> {
  try {
    return await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
  } catch (error) {
    console.error("Error in fetchPairDetailsByPairAddress:", error);
    return null;
  }
}

export async function searchPairs(query: string): Promise<PairDataSchema | null> {
  try {
    return await fetchApiData<PairDataSchema>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
  } catch (error) {
    console.error("Error in searchPairs:", error);
    return null;
  }
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
  try {
    const pools = await fetchApiData<PairDetail[]>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
    return pools || [];
  } catch (error) {
    console.error("Error in fetchTokenPairPools:", error);
    return [];
  }
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
  try {
    // DexScreener API uses comma-separated token addresses in the path directly
    const pairs = await fetchApiData<PairDetail[]>(`/tokens/v1/${chainId}/${tokenAddresses}`);
    return pairs || [];
  } catch (error) {
    console.error("Error in fetchPairsByTokenAddresses:", error);
    return [];
  }
}