
'use server';

import type { TokenProfileItem, TokenBoostItem } from '@/types';

const DEX_API_BASE_URL = 'https://api.dexscreener.com';

// Helper function to fetch and parse data
async function fetchData<T>(endpoint: string): Promise<T[]> {
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
    console.error(`Error in fetchData for ${endpoint}:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}


export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  const profile = await fetchData<TokenProfileItem>('/token-profiles/latest/v1');
  return profile; 
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  const boosts = await fetchData<TokenBoostItem>('/token-boosts/latest/v1');
  return boosts; 
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  const boosts = await fetchData<TokenBoostItem>('/token-boosts/top/v1');
  return boosts; 
}
