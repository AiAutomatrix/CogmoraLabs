
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
    // The API seems to return a single object for these "latest" endpoints based on user docs.
    // We will wrap it in an array if it's not already an array.
    // If the API actually returns { "data": [...] } or similar, this needs adjustment.
    // For now, assuming it might return a single item or an array directly.
    // Let's assume the API returns an object like { "profiles": [] } or { "boosts": [] }
    // OR directly an array. The user's schema was for single item.
    // If data.data is the array: return data.data as T[];
    // If data.profiles is the array: return data.profiles as T[];
    // If data is the array: return data as T[];

    // Let's assume the API returns an array of items directly for now.
    // If the actual API returns an object with a specific key containing the array,
    // this parsing logic will need to be updated.
    // e.g. if response is { "data": [...] }, then use `return data.data || [];`
    // For now, we'll trust the API directly returns an array or we handle it gracefully.
     if (Array.isArray(data)) {
      return data as T[];
    } else if (data && typeof data === 'object') {
      // Fallback for single item response as per user's doc snippet.
      // In a real scenario, if "latest" or "top" returns single item, it's unusual.
      // For now, we'll assume the response is an array. If it's consistently single, adjust.
      // This part handles if the API truly returns a single object for `/latest` or `/top`
      // The component expecting an array would just render one item.
      // However, typical APIs return arrays for "latest" or "top".
      // The problem description indicates "latest token profiles" (plural).
      // Let's assume the API returns an object with a key e.g. "pairs" or "tokens".
      // Since the user's doc shows a single object as the *response*, not as an item in an array,
      // this implies the "latest" endpoint returns ONE latest item.
      // This is unusual but we will code to it. Our components will just render one item.
      // To make components more general (displaying lists), we'll wrap it in an array.
      // This is a temporary assumption if the API always returns a single object.
      // If the API *can* return an array, then this is fine.
      // The provided schema `Response object` suggests the endpoint returns ONE object of that type.
      // To make it usable in a list display, we will wrap it.
      return [data as T]; // Wrap single object in an array
    }
    return []; // Fallback for unexpected structure
  } catch (error) {
    console.error(`Error in fetchData for ${endpoint}:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}


export async function fetchLatestTokenProfiles(): Promise<TokenProfileItem[]> {
  // The API doc shows the response as a single object. We'll wrap it in an array for consistency.
  const profile = await fetchData<TokenProfileItem>('/token-profiles/latest/v1');
  return profile; // fetchData already wraps if single
}

export async function fetchLatestBoostedTokens(): Promise<TokenBoostItem[]> {
  // The API doc shows the response as a single object. We'll wrap it in an array.
  const boosts = await fetchData<TokenBoostItem>('/token-boosts/latest/v1');
  return boosts; // fetchData already wraps if single
}

export async function fetchTopBoostedTokens(): Promise<TokenBoostItem[]> {
  // The API doc shows the response as a single object. We'll wrap it in an array.
  const boosts = await fetchData<TokenBoostItem>('/token-boosts/top/v1');
  return boosts; // fetchData already wraps if single
}

    