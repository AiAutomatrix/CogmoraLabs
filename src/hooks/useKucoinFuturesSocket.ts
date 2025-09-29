import { useState, useEffect, useRef, useCallback } from 'react';
import type { KucoinTokenResponse, IncomingKucoinFuturesWebSocketMessage, FuturesSnapshotData } from '@/types';

type LiveData = {
  [symbol: string]: FuturesSnapshotData;
}

export function useKucoinFuturesSocket(symbols: string[]) {
  const [liveData, setLiveData] = useState<LiveData>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('idle');
  const ws = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbols = useRef(new Set<string>());

  const connect = useCallback(async () => {
    if (ws.current) {
        ws.current.close();
    }
    setStatus('fetching_token');

    try {
        const res = await fetch('/api/kucoin-futures-ws-token', { method: 'POST' });
        const tokenData: KucoinTokenResponse = await res.json();
        
        if (tokenData.code !== "200000") {
            throw new Error('Failed to fetch KuCoin Futures WebSocket token');
        }

        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-screener-${Date.now()}`;
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;

        setStatus('connecting');
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            setStatus('connected');
            console.log('KuCoin Futures Screener WebSocket connected.');

            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = setInterval(() => {
                ws.current?.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
            }, instanceServers[0].pingInterval / 2);

            // Subscribe to all provided symbols
            symbols.forEach(symbol => {
                if (!subscribedSymbols.current.has(symbol)) {
                    ws.current?.send(JSON.stringify({
                        id: Date.now(),
                        type: 'subscribe',
                        topic: `/contractMarket/snapshot:${symbol}`,
                        privateChannel: false,
                        response: true
                    }));
                    subscribedSymbols.current.add(symbol);
                }
            });
        };

        ws.current.onmessage = (event) => {
            const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
            if (message.type === 'message' && message.subject === 'snapshot.24h') {
                const { symbol, ...rest } = message.data;
                setLiveData(prevData => ({
                    ...prevData,
                    [symbol]: rest
                }));
            }
        };

        ws.current.onclose = () => {
            setStatus('disconnected');
            console.log('KuCoin Futures Screener WebSocket disconnected.');
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            subscribedSymbols.current.clear();
        };

        ws.current.onerror = (error) => {
            setStatus('error');
            console.error('KuCoin Futures Screener WebSocket error:', error);
            ws.current?.close();
        };

    } catch (error) {
        console.error('Futures Screener WebSocket connection setup failed:', error);
        setStatus('error');
    } finally {
        setLoading(false);
    }
  }, []); // Removed symbols from dependencies to avoid reconnecting on every render

  useEffect(() => {
      if (symbols.length > 0) {
        connect();
      }
      return () => {
          ws.current?.close();
      }
  }, [connect]);


  useEffect(() => {
      // Logic to subscribe to new symbols if the list changes
      if (ws.current?.readyState === WebSocket.OPEN) {
          symbols.forEach(symbol => {
              if (!subscribedSymbols.current.has(symbol)) {
                  ws.current?.send(JSON.stringify({
                      id: Date.now(),
                      type: 'subscribe',
                      topic: `/contractMarket/snapshot:${symbol}`,
                      response: true
                  }));
                  subscribedSymbols.current.add(symbol);
              }
          });
      }
  }, [symbols]);

  return { liveData, loading: loading && Object.keys(liveData).length === 0, status };
}
