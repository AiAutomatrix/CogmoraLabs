
'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairData, PairDetail } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Helper function to fetch and parse data that returns an array
// Handles cases where API returns a single object (for /latest endpoints) by wrapping it in an array.
async function fetchDataAsArray<T>(endpoint: string): Promise<T[]> {
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
      // API for /latest profiles and /latest boosts returns a single object
      return [data as T]; 
    }
    return []; // Fallback for unexpected structure
  } catch (error) {
    console.error(`Error in fetchDataAsArray for ${endpoint}:`, error);
    // throw error; // Re-throw to be caught by the caller, or return empty array
    return []; // Return empty array on error to prevent UI crashes
  }
}

// Helper function for endpoints returning a single object (or null) that contains a 'pairs' array
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
    // throw error; // Re-throw to be caught by the caller, or return null
    return null; // Return null on error
  }
}

// Helper function for endpoints that directly return an array of items (like PairDetail[])
async function fetchDirectArrayData<T>(endpoint: string): Promise<T[]> {
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
    }
    return []; // Fallback if it's not an array as expected
  } catch (error) {
    console.error(`Error in fetchDirectArrayData for ${endpoint}:`, error);
    return [];
  }
}


// Original three functions
export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  return fetchDataAsArray<TokenProfileItem>('/token-profiles/latest/v1');
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  return fetchDataAsArray<TokenBoostItem>('/token-boosts/latest/v1');
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  return fetchDataAsArray<TokenBoostItem>('/token-boosts/top/v1');
}

// New five functions
export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  if (!chainId || !tokenAddress) return [];
  return fetchDirectArrayData<OrderInfoItem>(`/orders/v1/${chainId}/${tokenAddress}`);
}

export async function fetchPairDetailsByPairAddress(chainId: string, pairAddress: string): Promise<PairData | null> {
  if (!chainId || !pairAddress) return null;
  return fetchDataAsObjectOrNull<PairData>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
}

export async function searchPairs(query: string): Promise<PairData | null> {
  if (!query) return null;
  return fetchDataAsObjectOrNull<PairData>(`/latest/dex/search?q=${encodeURIComponent(query)}`);
}

export async function fetchTokenPairPools(chainId: string, tokenAddress: string): Promise<PairDetail[]> {
  if (!chainId || !tokenAddress) return [];
  return fetchDirectArrayData<PairDetail>(`/token-pairs/v1/${chainId}/${tokenAddress}`);
}

export async function fetchPairsByTokenAddresses(chainId: string, tokenAddresses: string): Promise<PairDetail[]> {
  if (!chainId || !tokenAddresses) return [];
  return fetchDirectArrayData<PairDetail>(