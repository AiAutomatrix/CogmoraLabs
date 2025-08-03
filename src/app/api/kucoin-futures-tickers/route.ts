import { NextResponse } from 'next/server';

const KUCOIN_FUTURES_API_URL = "https://api-futures.kucoin.com/api/v1/contracts/active";

export async function GET() {
try {
const response = await fetch(KUCOIN_FUTURES_API_URL);

if (!response.ok) {
throw new Error(`Failed to fetch KuCoin active futures contracts: ${response.statusText}`);
}

const data = await response.json();
return NextResponse.json(data);
} catch (error) {
console.error('Error fetching KuCoin futures contracts:', error);
if (error instanceof Error) {
return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
}
return new NextResponse(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 });
}
}

