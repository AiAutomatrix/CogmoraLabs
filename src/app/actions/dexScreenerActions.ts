
'use server';

import type { TokenProfileItem, TokenBoostItem, OrderInfoItem, PairDataSchema } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Generic fetch helper
async function fetchApiData<T>(endpoint: string): Promise<T> {
  const url = `${DEX_API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      let errorBody = 'Unknown error';
      try {
        errorBody = await response.text();
      } catch (e) {
        // ignore if reading text fails
      }
      console.error(`API Error (${response.status}) for ${url}: ${errorBody}`);
      throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}, Message: ${errorBody}`);
    }
    // This will attempt to parse JSON. If the response is not JSON, it will throw.
    return await response.json() as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${url}:`, error);
    // Re-throw the error so the caller can handle it, e.g., by setting an error state in the UI
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred during data fetching.');
  }
}

export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  // API doc implies single object for /latest endpoints, but views might prefer an array.
  try {
    const profile = await fetchApiData<TokenProfileItem>('/token-profiles/latest/v1');
    return profile ? [profile] : [];
  } catch (error) {
    console.error("Error in fetchLatestTokenProfiles:", error);
    return []; // Return empty array on error
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const boost = await fetchApiData<TokenBoostItem>('/token-boosts/latest/v1');
    return boost ? [boost] : [];
  } catch (error) {
    console.error("Error in fetchLatestBoostedTokens:", error);
    return []; // Return empty array on error
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  // The API doc for /token-boosts/top/v1 says "Response: object", so we treat it like the "latest" endpoints.
  try {
    const boost = await fetchApiData<TokenBoostItem>('/token-boosts/top/v1');
    return boost ? [boost] : [];
  } catch (error) {
    console.error("Error in fetchTopBoostedTokens:", error);
    return [];
  }
}

export async function fetchTokenOrders(chainId: string, tokenAddress: string): Promise<OrderInfoItem[]> {
  if (!chainId || !tokenAddress) {
    console.error("fetchTokenOrders: chainId and tokenAddress are required.");
    return []; 
  }
  try {
    // This endpoint is documented to return an array.
    const orders = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
    return Array.isArray(orders) ? orders : []; // Ensure it's an array
  } catch (error) {
    console.error(`Error in fetchTokenOrders for ${chainId}/${tokenAddress}:`, error);
    return [];
  }
}

export async function fetchPairDetails(chainId: string, pairAddress: string): Promise<PairDataSchema | null> {
  if (!chainId || !pairAddress) {
    console.error("fetchPairDetails: chainId and pairAddress are required.");
    return null;
  }
  try {
    // This endpoint returns an object containing a 'pairs' array.
    const data = await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
    // Basic validation for the expected structure
    if (data && typeof data === 'object' && data.pairs && Array.isArray(data.pairs)) {
      return data;
    }
    console.warn(`fetchPairDetails: Unexpected data structure received or pairs array missing for ${chainId}/${pairAddress}`, data);
    return null; // Return null if structure is not as expected or data is missing
  } catch (error) {
    console.error(`Error in fetchPairDetails for ${chainId}/${pairAddress}:`, error);
    return null;
  }
}
