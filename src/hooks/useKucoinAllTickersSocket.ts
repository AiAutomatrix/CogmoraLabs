

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
    setLoading(true);
    if (ws.current) {
      ws.current.close();
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    setWsStatus('fetching_token');

    try {
      const initialResponse = await fetch(KUCOIN_TICKERS_PROXY_URL);
      const initialData = await initialResponse.json();
      if (initialData && initialData.code === "200000" && initialData.data && initialData.data.ticker) {
        const usdtTickers = initialData.data.ticker.filter((t: KucoinTicker) => t.symbol.endsWith('-USDT'));
        setTickers(usdtTickers);
      }
      setLoading(false);

      const res = await fetch('/api/kucoin-ws-token', { method: 'POST' });
      const tokenData: KucoinTokenResponse = await res.json();
      if (tokenData.code !== "200000") throw new Error('Failed to fetch KuCoin Spot WebSocket token');

      const { token, instanceServers } = tokenData.data;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=cogmora-spot-all-${Date.now()}`;

      setWsStatus('connecting');
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setWsStatus('connected');
        if (ws.current?.readyState === WebSocket.OPEN) {
            pingIntervalRef.current = setInterval(() => {
                ws.current?.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
            }, instanceServers[0].pingInterval / 2);

            const topic = `/market/ticker:all`;
            ws.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
        }
      };

      ws.current.onmessage = (event) => {
        const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
        if (message.type === 'message' && message.subject === 'trade.ticker' && message.topic === '/market/ticker:all') {
            const updatedTickerData = message.data as KucoinTicker;
            
            setTickers(prevTickers => {
                const newTickers = [...prevTickers];
                const index = newTickers.findIndex(t => t.symbol === updatedTickerData.symbol);
                if (index !== -1) {
                    newTickers[index] = {
                        ...newTickers[index],
                        ...updatedTickerData,
                        last: updatedTickerData.price || newTickers[index].last,
                    };
                }
                return newTickers;
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

  return { tickers, loading, wsStatus };
}
