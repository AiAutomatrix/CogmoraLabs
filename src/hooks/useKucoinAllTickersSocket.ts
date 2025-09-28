
import { useState, useEffect } from "react";
import { usePaperTrading } from "@/context/PaperTradingContext";

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
  const { updatePositionPrice } = usePaperTrading();

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        if (loading) { // Only show loader on initial fetch
             setLoading(true);
        }
        const response = await fetch(KUCOIN_TICKERS_PROXY_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch KuCoin tickers from proxy: ${response.statusText}`);
        }
        const data: KucoinAllTickersApiResponse = await response.json();
        if (data && data.code === "200000" && data.data && data.data.ticker) {
          const usdtTickers = data.data.ticker.filter(t => t.symbol.endsWith('-USDT'));
          setTickers(usdtTickers);

          // Update paper trading positions with the latest prices
          usdtTickers.forEach(ticker => {
            if (ticker.last) {
              updatePositionPrice(ticker.symbol, parseFloat(ticker.last));
            }
          });

        } else {
          console.error("Unexpected response structure:", data);
          setTickers([]);
        }
      } catch (error) {
        console.error("Error fetching tickers:", error);
        setTickers([]);
      } finally {
        if (loading) {
            setLoading(false);
        }
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 5000); // Fetch every 5 seconds for more real-time feel

    return () => clearInterval(interval);
  }, [updatePositionPrice]);

  return { tickers, loading };
}
