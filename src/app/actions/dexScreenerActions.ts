
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
    return await response.json() as T;
  } catch (error) {
    console.error(`Error in fetchApiData for ${url}:`, error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred during data fetching.');
  }
}

export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  try {
    const profile = await fetchApiData<TokenProfileItem>('/token-profiles/latest/v1');
    return profile ? [profile] : []; // API doc implies single object, UI prefers array
  } catch (error) {
    console.error("Error in fetchLatestTokenProfiles:", error);
    return [];
  }
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const boost = await fetchApiData<TokenBoostItem>('/token-boosts/latest/v1');
    return boost ? [boost] : []; // API doc implies single object, UI prefers array
  } catch (error) {
    console.error("Error in fetchLatestBoostedTokens:", error);
    return [];
  }
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  try {
    const boost = await fetchApiData<TokenBoostItem>('/token-boosts/top/v1');
    return boost ? [boost] : []; // API doc implies single object, UI prefers array
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
    const orders = await fetchApiData<OrderInfoItem[]>(`/orders/v1/${chainId}/${tokenAddress}`);
    return Array.isArray(orders) ? orders : [];
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
    const data = await fetchApiData<PairDataSchema>(`/latest/dex/pairs/${chainId}/${pairAddress}`);
    if (data && typeof data === 'object' && data.pairs && Array.isArray(data.pairs)) {
      return data;
    }
    console.warn(`fetchPairDetails: Unexpected data structure received or pairs array missing for ${chainId}/${pairAddress}`, data);
    return null;
  } catch (error) {
    console.error(`Error in fetchPairDetails for ${chainId}/${pairAddress}:`, error);
    return null;
  }
}
