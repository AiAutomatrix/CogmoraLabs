
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
  const tickersRef = useRef<Map<string, KucoinTicker>>(new Map());

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
        
        // Populate the ref map and initial state
        const initialMap = new Map<string, KucoinTicker>();
        usdtTickers.forEach((t: KucoinTicker) => initialMap.set(t.symbol, t));
        tickersRef.current = initialMap;
        setTickers(Array.from(initialMap.values()));
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
            
            const currentMap = tickersRef.current;
            const existingTicker = currentMap.get(updatedTickerData.symbol);

            if (existingTicker) {
                // Update the map with the new data
                currentMap.set(updatedTickerData.symbol, {
                    ...existingTicker,
                    ...updatedTickerData,
                    last: updatedTickerData.price || existingTicker.last,
                });
                
                // Set state from the map's values to trigger re-render
                setTickers(Array.from(currentMap.values()));
            }
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
