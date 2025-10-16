
"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
  useMemo,
} from "react";
import type {
  IncomingKucoinWebSocketMessage,
  WatchlistItem,
  KucoinTokenResponse,
  KucoinSnapshotDataWrapper,
  SpotSnapshotData,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getSpotWsToken } from "@/app/actions/kucoinActions";

interface LandingPageDemoContextType {
  watchlist: WatchlistItem[];
  toggleWatchlist: (symbol: string, symbolName: string, type: 'spot' | 'futures') => void;
  spotWsStatus: string;
}

const LandingPageDemoContext = createContext<LandingPageDemoContextType | undefined>(
  undefined
);

const defaultWatchlistItems: WatchlistItem[] = [
    { symbol: 'BTC-USDT', symbolName: 'Bitcoin', type: 'spot', currentPrice: 0 },
    { symbol: 'ETH-USDT', symbolName: 'Ethereum', type: 'spot', currentPrice: 0 },
    { symbol: 'SOL-USDT', symbolName: 'Solana', type: 'spot', currentPrice: 0 },
];

export const LandingPageDemoProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { toast } = useToast();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(defaultWatchlistItems);
  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptionsRef = useRef<Set<string>>(new Set(defaultWatchlistItems.map(i => i.symbol)));

  const processUpdate = useCallback((symbol: string, data: Partial<SpotSnapshotData>) => {
    const newPrice = data.lastTradedPrice;
    if (newPrice === undefined || isNaN(newPrice) || newPrice === 0) return;

    setWatchlist(prev => prev.map(item =>
        item.symbol === symbol ? {
          ...item,
          currentPrice: newPrice,
          priceChgPct: data.changeRate ?? item.priceChgPct,
          snapshotData: data as SpotSnapshotData,
        } : item
    ));
  }, []);

  const connectToSpot = useCallback(async () => {
    if (spotWs.current) return;
    setSpotWsStatus("fetching_token");

    try {
      const tokenData = await getSpotWsToken();
      if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

      const { token, instanceServers } = tokenData.data;
      const connectId = `cogmora-demo-${Date.now()}`;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;

      setSpotWsStatus("connecting");
      const ws = new WebSocket(wsUrl);
      spotWs.current = ws;

      ws.onopen = () => {
        setSpotWsStatus("connected");
        if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
        spotPingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
        }, instanceServers[0].pingInterval / 2);

        Array.from(spotSubscriptionsRef.current).forEach((symbol) => {
          ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/market/snapshot:${symbol}`, response: true }));
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
        if (message.type === "message" && message.subject === "trade.snapshot") {
          const wrapper = message.data as KucoinSnapshotDataWrapper;
          const symbol = message.topic.split(":")[1];
          processUpdate(symbol, wrapper.data);
        }
      };

      ws.onclose = () => setSpotWsStatus("disconnected");
      ws.onerror = () => setSpotWsStatus("error");

    } catch (error) {
      setSpotWsStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      console.error("Demo Spot WS Error", error);
      toast({ title: "Demo WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast, processUpdate]);

  useEffect(() => {
    connectToSpot();
    return () => {
      spotWs.current?.close();
      if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
    }
  }, [connectToSpot]);

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures') => {
    setWatchlist(prev => {
        const existing = prev.find(item => item.symbol === symbol);
        if (existing) {
            return prev.filter(item => item.symbol !== symbol);
        } else {
            return [...prev, { symbol, symbolName, type, currentPrice: 0 }];
        }
    });
  }, []);

  return (
    <LandingPageDemoContext.Provider
      value={{
        watchlist,
        toggleWatchlist,
        spotWsStatus,
      }}
    >
      {children}
    </LandingPageDemoContext.Provider>
  );
};

export const useLandingPageDemo = (): LandingPageDemoContextType => {
  const context = useContext(LandingPageDemoContext);
  if (!context) {
    throw new Error("useLandingPageDemo must be used within a LandingPageDemoProvider");
  }
  return context;
};
