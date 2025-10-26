
"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import type {
  WatchlistItem,
  PriceAlert,
  TradeTrigger,
  IncomingKucoinWebSocketMessage,
  KucoinSnapshotDataWrapper,
  SpotSnapshotData,
  AutomationConfig,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getSpotWsToken } from "@/app/actions/kucoinActions";

interface LandingPageDemoContextType {
  watchlist: WatchlistItem[];
  priceAlerts: Record<string, PriceAlert>;
  tradeTriggers: TradeTrigger[];
  automationConfig: AutomationConfig;
  spotWsStatus: string;
  toggleWatchlist: (symbol: string, symbolName: string, type: 'spot' | 'futures') => void;
  addPriceAlert: (symbol: string, price: number, condition: 'above' | 'below') => void;
  removePriceAlert: (symbol: string) => void;
  addTradeTrigger: (trigger: Omit<TradeTrigger, 'id' | 'details'>) => void;
  removeTradeTrigger: (triggerId: string) => void;
  setAutomationConfig: (config: AutomationConfig) => void;
  applyWatchlistAutomation: () => void;
}

const LandingPageDemoContext = createContext<LandingPageDemoContextType | undefined>(undefined);

const defaultWatchlistItems: WatchlistItem[] = [
    { symbol: 'BTC-USDT', symbolName: 'Bitcoin', type: 'spot', currentPrice: 0, priceChgPct: 0, order: 1 },
    { symbol: 'ETH-USDT', symbolName: 'Ethereum', type: 'spot', currentPrice: 0, priceChgPct: 0, order: 2 },
    { symbol: 'SOL-USDT', symbolName: 'Solana', type: 'spot', currentPrice: 0, priceChgPct: 0, order: 3 },
];

const INITIAL_AUTOMATION_CONFIG: AutomationConfig = {
  rules: [{ id: 'default', source: 'spot', criteria: 'top_volume', count: 5 }],
  updateMode: 'one-time',
  refreshInterval: 900000,
  clearExisting: true,
};

export const LandingPageDemoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(defaultWatchlistItems);
  const [priceAlerts, setPriceAlerts] = useState<Record<string, PriceAlert>>({});
  const [tradeTriggers, setTradeTriggers] = useState<TradeTrigger[]>([]);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(INITIAL_AUTOMATION_CONFIG);
  
  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

    const alert = priceAlerts[symbol];
    if (alert && !alert.triggered) {
      const conditionMet = (alert.condition === 'above' && newPrice >= alert.price) || (alert.condition === 'below' && newPrice <= alert.price);
      if (conditionMet) {
        setPriceAlerts(prev => ({...prev, [symbol]: {...prev[symbol], triggered: true}}));
        toast({ title: "Demo Price Alert!", description: `${symbol} reached your alert price of ${alert.price}.` });
      }
    }
  }, [priceAlerts, toast]);

  const connectToSpot = useCallback(async () => {
    if (spotWs.current) return;
    setSpotWsStatus("fetching_token");

    try {
      const tokenData = await getSpotWsToken();
      if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

      const { token, instanceServers } = tokenData.data;
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=cogmora-landing-demo-${Date.now()}`;

      setSpotWsStatus("connecting");
      const ws = new WebSocket(wsUrl);
      spotWs.current = ws;

      ws.onopen = () => {
        setSpotWsStatus("connected");
        if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
        spotPingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
        }, instanceServers[0].pingInterval / 2);
        
        watchlist.forEach((item) => {
          ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/market/snapshot:${item.symbol}`, response: true }));
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
  }, [toast, processUpdate, watchlist]);

  useEffect(() => {
    connectToSpot();
    return () => {
      spotWs.current?.close();
      if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
    }
  }, [connectToSpot]);

  const toggleWatchlist = (symbol: string, symbolName: string, type: 'spot' | 'futures') => {
    setWatchlist(prev => {
        const existing = prev.find(item => item.symbol === symbol);
        if (existing) {
            spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/snapshot:${symbol}` }));
            return prev.filter(item => item.symbol !== symbol);
        } else {
            spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/snapshot:${symbol}` }));
            return [...prev, { symbol, symbolName, type, currentPrice: 0, priceChgPct: 0, order: prev.length + 1 }];
        }
    });
  };

  const addPriceAlert = (symbol: string, price: number, condition: 'above' | 'below') => {
    setPriceAlerts(prev => ({...prev, [symbol]: { price, condition, triggered: false }}));
    toast({ title: 'Demo Alert Set', description: `Alert set for ${symbol}.` });
  };
  
  const removePriceAlert = (symbol: string) => {
    setPriceAlerts(prev => {
      const newAlerts = {...prev};
      delete newAlerts[symbol];
      return newAlerts;
    });
    toast({ title: 'Demo Alert Removed' });
  };

  const addTradeTrigger = (trigger: Omit<TradeTrigger, 'id' | 'details'>) => {
    const newTrigger: TradeTrigger = { ...trigger, id: crypto.randomUUID(), details: { status: 'active' } };
    setTradeTriggers(prev => [...prev, newTrigger]);
    toast({ title: 'Demo Trigger Set!', description: `A trigger for ${trigger.symbolName} has been added.` });
  };
  
  const removeTradeTrigger = (triggerId: string) => {
    setTradeTriggers(prev => prev.filter(t => t.id !== triggerId));
    toast({ title: 'Demo Trigger Removed' });
  };
  
  const applyWatchlistAutomation = () => {
    toast({ title: 'Automation In Demo', description: 'This would scrape screeners and update your watchlist in the full app!' });
  };

  return (
    <LandingPageDemoContext.Provider
      value={{
        watchlist,
        priceAlerts,
        tradeTriggers,
        automationConfig,
        spotWsStatus,
        toggleWatchlist,
        addPriceAlert,
        removePriceAlert,
        addTradeTrigger,
        removeTradeTrigger,
        setAutomationConfig,
        applyWatchlistAutomation,
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
