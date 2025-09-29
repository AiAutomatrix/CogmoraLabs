
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { KucoinTicker, KucoinTokenResponse, IncomingKucoinWebSocketMessage } from "@/types";

const KUCOIN_TICKERS_PROXY_URL = "/api/kucoin-tickers";

export function useKucoinTickers() {
  const [tickers, setTickers] = useState<KucoinTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('idle');

  const ws = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectToAllTickers = useCallback(async () => {
    if (ws.current) {
      ws.current.close();
    }
    setWsStatus('fetching_token');

    try {
      // 1. Initial HTTP fetch for the full list
      const initialResponse = await fetch(KUCOIN_TICKERS_PROXY_URL);
      const initialData = await initialResponse.json();
      if (initialData && initialData.code === "200000" && initialData.data && initialData.data.ticker) {
        const usdtTickers = initialData.data.ticker.filter((t: KucoinTicker) => t.symbol.endsWith('-USDT'));
        setTickers(usdtTickers);
      }
      setLoading(false);

      // 2. Fetch WebSocket token
      const res = await fetch('/api/kucoin-ws-token');
      const tokenData: KucoinTokenResponse = await res.json();
      if (tokenData.code !== "200000") throw new Error('Failed to fetch KuCoin Spot WebSocket token');

      const { token, instanceServers } = tokenData.data;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=cogmora-spot-all-${Date.now()}`;

      // 3. Establish WebSocket connection
      setWsStatus('connecting');
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setWsStatus('connected');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          ws.current?.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
        }, instanceServers[0].pingInterval / 2);

        // 4. Subscribe to the all-tickers topic
        const topic = `/market/ticker:all`;
        ws.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
      };

      ws.current.onmessage = (event) => {
        const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
        if (message.type === 'message' && message.subject === 'trade.ticker' && message.topic === '/market/ticker:all') {
            const updatedTickerData = message.data;
            
            setTickers(prevTickers => {
                const tickerExists = prevTickers.some(t => t.symbol === updatedTickerData.symbol);
                if (tickerExists) {
                    return prevTickers.map(t => {
                        if (t.symbol === updatedTickerData.symbol) {
                            return { ...t, ...updatedTickerData, last: updatedTickerData.price || t.last };
                        }
                        return t;
                    });
                }
                // This case is unlikely with "ticker:all" but good practice
                return [...prevTickers]; 
            });
        }
      };

      ws.current.onclose = () => setWsStatus('disconnected');
      ws.current.onerror = () => setWsStatus('error');

    } catch (error) {
      console.error('Spot All-Tickers WebSocket setup failed:', error);
      setWsStatus('error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    connectToAllTickers();
    return () => {
        ws.current?.close();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    }
  }, [connectToAllTickers]);

  return { tickers, loading };
}
