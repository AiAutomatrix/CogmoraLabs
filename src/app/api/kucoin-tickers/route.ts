import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.kucoin.com/api/v1/market/allTickers');
    if (!response.ok) {
      throw new Error(`Error fetching data from KuCoin API: ${response.statusText}`);
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
