
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { KucoinTokenResponse, IncomingKucoinWebSocketMessage, SpotSnapshotData, KucoinSnapshotDataWrapper } from '@/types';

export function useSpotSnapshot(symbol: string | null) {
  const [snapshotData, setSnapshotData] = useState<SpotSnapshotData | null>(null);
  const [status, setStatus] = useState('idle');
  const ws = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectAndSubscribe = useCallback((sym: string) => {
    if (ws.current) {
      ws.current.close();
    }
    setSnapshotData(null);
    setStatus('fetching_token');

    fetch("/api/kucoin-ws-token")
      .then(res => res.json())
      .then((tokenData: KucoinTokenResponse) => {
        if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-snapshot-${Date.now()}`;
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;

        setStatus('connecting');
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          setStatus('connected');
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
            }
          }, instanceServers[0].pingInterval / 2);

          ws.current?.send(JSON.stringify({
            id: Date.now(),
            type: "subscribe",
            topic: `/market/snapshot:${sym}`,
            response: true
          }));
        };

        ws.current.onmessage = (event: MessageEvent) => {
          const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
          if (message.type === "message" && message.subject === "trade.snapshot" && message.topic.endsWith(sym)) {
            const wrapper = message.data as KucoinSnapshotDataWrapper;
            setSnapshotData(wrapper.data);
          }
        };

        ws.current.onclose = () => {
          setStatus('disconnected');
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        };

        ws.current.onerror = (e) => {
          console.error("Snapshot WS Error", e);
          setStatus('error');
          ws.current?.close();
        };

      }).catch(error => {
        console.error("Snapshot Connection failed", error);
        setStatus('error');
      });
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    setSnapshotData(null);
    setStatus('idle');
  }, []);
  
  useEffect(() => {
    return () => {
        disconnect();
    }
  }, [disconnect]);

  return { snapshotData, status, subscribe: connectAndSubscribe, unsubscribe: disconnect };
}
