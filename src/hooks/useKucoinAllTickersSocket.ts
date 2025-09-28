
import { useState, useEffect, useCallback } from "react";
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

  const fetchTickers = useCallback(async (isInitialLoad: boolean) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      const response = await fetch(KUCOIN_TICKERS_PROXY_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch KuCoin tickers from proxy: ${response.statusText}`);
      }
      const data: KucoinAllTickersApiResponse = await response.json();
      if (data && data.code === "200000" && data.data && data.data.ticker) {
        const usdtTickers = data.data.ticker.filter(t => t.symbol.endsWith('-USDT'));
        
        setTickers(prevTickers => {
          if (isInitialLoad || prevTickers.length === 0) {
            return usdtTickers;
          }
          // Merge new data with old data for smoother updates
          const tickersMap = new Map(prevTickers.map(t => [t.symbol, t]));
          usdtTickers.forEach(newTicker => {
            tickersMap.set(newTicker.symbol, newTicker);
          });
          return Array.from(tickersMap.values());
        });

        // Update paper trading positions with the latest prices
        usdtTickers.forEach(ticker => {
          if (ticker.last) {
            updatePositionPrice(ticker.symbol, parseFloat(ticker.last));
          }
        });

      } else {
        console.error("Unexpected response structure:", data);
        if (isInitialLoad) setTickers([]);
      }
    } catch (error) {
      console.error("Error fetching tickers:", error);
      if (isInitialLoad) setTickers([]);
    } finally {
      if (isInitialLoad) {
          setLoading(false);
      }
    }
  }, [updatePositionPrice]);

  useEffect(() => {
    fetchTickers(true); // Initial fetch
    const interval = setInterval(() => fetchTickers(false), 5000); // Subsequent fetches

    return () => clearInterval(interval);
  }, [fetchTickers]);

  return { tickers, loading };
}
