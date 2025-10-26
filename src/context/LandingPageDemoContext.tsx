
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
  AutomationRule,
  KucoinFuturesContract,
  KucoinTicker,
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

  const connectToSpot = useCallback(async (symbolsToSubscribe: string[]) => {
    if (spotWs.current) {
        // Handle changes in subscription list
        const currentSubs = new Set(JSON.parse(spotWs.current.url.split('subs=')[1] || '[]'));
        const newSubs = new Set(symbolsToSubscribe);

        const toAdd = [...newSubs].filter(s => !currentSubs.has(s));
        const toRemove = [...currentSubs].filter(s => !newSubs.has(s));

        toAdd.forEach(symbol => spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/snapshot:${symbol}` })));
        toRemove.forEach(symbol => spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/snapshot:${symbol}` })));
        
        // Update URL for reference
        spotWs.current.url = spotWs.current.url.split('subs=')[0] + 'subs=' + JSON.stringify(symbolsToSubscribe);
        return;
    }
    if (symbolsToSubscribe.length === 0) return;

    setSpotWsStatus("fetching_token");
    try {
      const tokenData = await getSpotWsToken();
      if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

      const { token, instanceServers } = tokenData.data;
      // Stash subscriptions in URL to help manage re-subscriptions if needed
      const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=cogmora-landing-demo-${Date.now()}&subs=${JSON.stringify(symbolsToSubscribe)}`;

      setSpotWsStatus("connecting");
      const ws = new WebSocket(wsUrl);
      spotWs.current = ws;

      ws.onopen = () => {
        setSpotWsStatus("connected");
        if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
        spotPingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
        }, instanceServers[0].pingInterval / 2);
        
        symbolsToSubscribe.forEach((symbol) => {
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
      ws.onclose = () => { setSpotWsStatus("disconnected"); spotWs.current = null; };
      ws.onerror = () => { setSpotWsStatus("error"); spotWs.current = null; };
    } catch (error) {
      setSpotWsStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      console.error("Demo Spot WS Error", error);
      toast({ title: "Demo WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast, processUpdate]);

  useEffect(() => {
    const symbols = watchlist.map(item => item.symbol);
    if (symbols.length > 0) {
      connectToSpot(symbols);
    } else if (spotWs.current) {
        spotWs.current.close();
    }
  }, [watchlist, connectToSpot]);

  const toggleWatchlist = (symbol: string, symbolName: string, type: 'spot' | 'futures') => {
    setWatchlist(prev => {
        const existing = prev.find(item => item.symbol === symbol);
        if (existing) {
            return prev.filter(item => item.symbol !== symbol);
        } else {
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
  
  const applyWatchlistAutomation = async () => {
    toast({ title: 'Automation Running', description: 'Fetching KuCoin screener data...' });

    try {
        const spotResponse = await fetch('/api/kucoin-tickers');
        const spotData = await spotResponse.json();
        const allSpotTickers: KucoinTicker[] = (spotData?.data?.ticker || []).filter((t: KucoinTicker) => t.symbol.endsWith('-USDT'));

        if (!allSpotTickers.length) {
            throw new Error('Could not fetch any screener data.');
        }

        let finalItems: WatchlistItem[] = [];
        const addedSymbols = new Set<string>();

        let orderIndex = 0;
        automationConfig.rules.forEach(rule => {
            if (rule.source !== 'spot') return; // Demo only supports spot

            const sortKey = rule.criteria.includes('volume') ? 'volValue' : 'changeRate';
            
            const sorted = [...allSpotTickers].sort((a, b) => {
                const valA = parseFloat((a as any)[sortKey]) || 0;
                const valB = parseFloat((b as any)[sortKey]) || 0;
                return valB - valA;
            });

            let selected: KucoinTicker[];
            if (rule.criteria.startsWith('top')) {
                selected = sorted.slice(0, rule.count);
            } else { // bottom
                selected = sorted.slice(-rule.count).reverse();
            }

            selected.forEach(item => {
                if (!addedSymbols.has(item.symbol)) {
                    addedSymbols.add(item.symbol);
                    finalItems.push({
                        symbol: item.symbol,
                        symbolName: item.symbolName,
                        type: 'spot',
                        currentPrice: parseFloat(item.last),
                        priceChgPct: parseFloat(item.changeRate),
                        high: parseFloat(item.high),
                        low: parseFloat(item.low),
                        order: orderIndex++,
                    });
                }
            });
        });
        
        if (automationConfig.clearExisting) {
            setWatchlist(finalItems);
        } else {
            setWatchlist(prev => {
                const existingSymbols = new Set(prev.map(i => i.symbol));
                const newItems = finalItems.filter(i => !existingSymbols.has(i.symbol));
                return [...prev, ...newItems];
            });
        }
        
        toast({ title: 'Watchlist Updated', description: `Demo watchlist has been updated based on your rules.`});
    } catch(error) {
      console.error('Demo watchlist automation failed:', error);
      toast({ title: 'Automation Failed', description: 'Could not fetch screener data.', variant: 'destructive'});
    }
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

    