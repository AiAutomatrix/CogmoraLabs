import { NextResponse } from 'next/server';

// This is a POST request as per KuCoin documentation for public websocket tokens
const KUCOIN_FUTURES_TOKEN_ENDPOINT = "https://api-futures.kucoin.com/api/v1/bullet-public";

export async function POST() {
  try {
    const response = await fetch(KUCOIN_FUTURES_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`KuCoin Futures Token API Error (${response.status}): ${errorBody}`);
      throw new Error(`Failed to fetch WebSocket token from KuCoin Futures: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching KuCoin Futures WebSocket token:', error);
    if (error instanceof Error) {
      return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new NextResponse(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 });
  }
}
