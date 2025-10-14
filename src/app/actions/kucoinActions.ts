
'use server';

import type { KucoinTokenResponse } from '@/types';

const KUCOIN_SPOT_TOKEN_ENDPOINT = "https://api.kucoin.com/api/v1/bullet-public";
const KUCOIN_FUTURES_TOKEN_ENDPOINT = "https://api-futures.kucoin.com/api/v1/bullet-public";

async function fetchToken(endpoint: string): Promise<KucoinTokenResponse> {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Add a timeout and revalidation strategy for production robustness
            next: { revalidate: 300 } // Revalidate every 5 minutes
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`KuCoin Token API Error (${response.status}) from ${endpoint}: ${errorBody}`);
            throw new Error(`Failed to fetch WebSocket token from KuCoin: ${response.statusText}`);
        }

        const data = await response.json();
        return data as KucoinTokenResponse;

    } catch (error) {
        console.error(`Error fetching KuCoin WebSocket token from ${endpoint}:`, error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unknown error occurred while fetching the KuCoin token.');
    }
}

export async function getSpotWsToken(): Promise<KucoinTokenResponse> {
    return fetchToken(KUCOIN_SPOT_TOKEN_ENDPOINT);
}

export async function getFuturesWsToken(): Promise<KucoinTokenResponse> {
    return fetchToken(KUCOIN_FUTURES_TOKEN_ENDPOINT);
}
