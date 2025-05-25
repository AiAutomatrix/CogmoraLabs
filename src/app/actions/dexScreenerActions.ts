
'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairData, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Helper function for endpoints that return a single object, which we wrap in an array
// This is used for the original 3 endpoints (profiles, latest boosts, top boosts)
async function fetchDataAsArray<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return [data as T]; // Wrap single object in an array
    }
    // If it's already an array (though docs suggest single object), return as is or empty
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.error(`Error in fetchDataAsArray for ${endpoint}:`, error);
    // throw error; // Re-throw to be caught by the caller, or return empty array
    return []; // Return empty array on error to prevent UI crashes
  }
}

// Helper function for endpoints that return an array of items directly
async function fetchDirectArrayData<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.error(`Error in fetchDirectArrayData for ${endpoint}:`, error);
    return [];
  }
}

// Helper function for endpoints returning a single object (or null) that might contain a 'pairs' array
async function fetchDataAsObjectOrNull<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${DEX_API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`API Error (${response.status}) for ${endpoint}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${endpoint}. Status: ${response.status}`);
    }
    const data = await response.json();
    // Check if it's an object and NOT an array (which PairData is)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as T;
    }
    return null; // Fallback for unexpected structure or if API returns array where object expected
  } catch (error) {
    console.error(`Error in fetchDataAsObjectOrNull for ${endpoint}:`, error);
    return null;
  }
}


// Original three functions - use fetchDataAsArray
export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  return fetchDataAsArray<TokenProfileItem>('/token-profiles/latest/v1');
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  return fetchDataAsArray<TokenBoostItem>('/token-boosts/latest/v1');
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  return fetchDataAsArray<TokenBoostItem>('/token-boosts/top/v1');
}

// Remaining new functions
export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  if (!chainId || !tokenAddress) return [];
  return fetchDirectArrayData<OrderInfoItem>(`/orders/v1/${chainId}/${tokenAddress}`);
}

export async function searchPairs(query: string): Promise<PairData | null> {
  if (!query) return null;
  return fetchDataAsObjectOrNull<PairData>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
  if (!chainId || !tokenAddress) return [];
  return fetchDirectArrayData<PairDetail>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
}
