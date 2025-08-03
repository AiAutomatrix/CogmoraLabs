import { useState, useEffect } from "react";

const KUCOIN_TICKERS_PROXY_URL = "/api/kucoin-tickers";

export interface KucoinTicker {
  symbol: string;
  symbolName: string;
  buy: string;
  sell: string;
  bestBidSize: string;
  bestAskSize: string;
  changeRate: string;
  changePrice: string;
  high: string;
  low: string;
  vol: string;
  volValue: string;
  last: string;
  averagePrice: string;
  takerFeeRate: string;
  makerFeeRate: string;
  takerCoefficient: string;
  makerCoefficient: string;
}

interface KucoinAllTickersApiResponse {
  code: string;
  data: {
    time: number;
    ticker: KucoinTicker[];
  }
}

export function useKucoinTickers() {
  const [tickers, setTickers] = useState<KucoinTicker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        setLoading(true);
        const response = await fetch(KUCOIN_TICKERS_PROXY_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch KuCoin tickers from proxy: ${response.statusText}`);
        }
        const data: KucoinAllTickersApiResponse = await response.json();
        if (data && data.code === "200000" && data.data && data.data.ticker) {
          // Filter for USDT pairs as there are many
          const usdtTickers = data.data.ticker.filter(t => t.symbol.endsWith('-USDT'));
          setTickers(usdtTickers);
        } else {
          console.error("Unexpected response structure:", data);
          setTickers([]); // Clear tickers on unexpected data
        }
      } catch (error) {
        console.error("Error fetching tickers:", error);
        setTickers([]); // Clear tickers on error
      } finally {
        setLoading(false);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 60000); // Refetch every 60 seconds

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []); // Empty dependency array ensures this effect runs only once on mount

  return { tickers, loading };
}