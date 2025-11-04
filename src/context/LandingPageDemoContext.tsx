
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
  applyWatchlistAutomation: (config: AutomationConfig) => void;
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
  const subscribedSpotSymbols = useRef(new Set<string>());
  
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
        if (spotWs.current.readyState !== WebSocket.OPEN) {
          return;
        }
        const newSubs = new Set(symbolsToSubscribe);
        const toAdd = [...newSubs].filter(s => !subscribedSpotSymbols.current.has(s));
        const toRemove = [...subscribedSpotSymbols.current].filter(s => !newSubs.has(s));

        toAdd.forEach(symbol => {
          spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/snapshot:${symbol}` }));
          subscribedSpotSymbols.current.add(symbol);
        });
        toRemove.forEach(symbol => {
          spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/snapshot:${symbol}` }));
          subscribedSpotSymbols.current.delete(symbol);
        });
        return;
    }
    if (symbolsToSubscribe.length === 0) return;

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
        
        const currentSymbols = Array.from(new Set(watchlist.map(item => item.symbol)));
        currentSymbols.forEach((symbol) => {
            if (spotWs.current?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/market/snapshot:${symbol}`, response: true }));
                subscribedSpotSymbols.current.add(symbol);
            }
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
      ws.onclose = () => { 
        setSpotWsStatus("disconnected"); 
        spotWs.current = null;
        subscribedSpotSymbols.current.clear();
      };
      ws.onerror = () => { 
        setSpotWsStatus("error"); 
        spotWs.current = null;
        subscribedSpotSymbols.current.clear();
      };
    } catch (error) {
      setSpotWsStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
      console.error("Demo Spot WS Error", error);
      toast({ title: "Demo WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast, processUpdate, watchlist]);

  useEffect(() => {
    const applyInitialSnapshot = async () => {
        try {
            const res = await fetch('/api/kucoin-tickers');
            if (res.ok) {
                const spotData = await res.json();
                if (spotData?.data?.ticker) {
                    const tickerMap = new Map<string, KucoinTicker>();
                    spotData.data.ticker.forEach((t: KucoinTicker) => tickerMap.set(t.symbol, t));
                    
                    setWatchlist(currentWatchlist => {
                        return currentWatchlist.map(item => {
                            const ticker = tickerMap.get(item.symbol);
                            if (ticker) {
                                return {
                                    ...item,
                                    currentPrice: parseFloat(ticker.last),
                                    priceChgPct: parseFloat(ticker.changeRate)
                                };
                            }
                            return item;
                        });
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch initial snapshot for landing page watchlist:", error);
        }
    };
    
    applyInitialSnapshot();
    applyWatchlistAutomation(INITIAL_AUTOMATION_CONFIG);

  }, []); // Intentionally empty to run only once on mount


  const applyWatchlistAutomation = useCallback(async (config: AutomationConfig) => {
    toast({ title: 'Automation Running', description: 'Fetching KuCoin screener data for demo...' });
    setAutomationConfig(config);

    try {
        const spotResponse = await fetch('/api/kucoin-tickers');
        const spotData = await spotResponse.json();
        const allSpotTickers: KucoinTicker[] = (spotData?.data?.ticker || []).filter((t: KucoinTicker) => t.symbol.endsWith('-USDT'));

        const futuresResponse = await fetch('/api/kucoin-futures-tickers');
        const futuresData = await futuresResponse.json();
        const allFuturesContracts: KucoinFuturesContract[] = futuresData?.data || [];

        if (!allSpotTickers.length && !allFuturesContracts.length) {
            throw new Error('Could not fetch any screener data.');
        }

        let finalItems: WatchlistItem[] = [];
        const addedSymbols = new Set<string>();

        let orderIndex = 0;
        config.rules.forEach(rule => {
            let sourceData: (KucoinTicker | KucoinFuturesContract)[];
            let sortKey: 'volValue' | 'changeRate' | 'volumeOf24h' | 'priceChgPct';
            
            if (rule.source === 'spot') {
                sourceData = allSpotTickers;
                sortKey = rule.criteria.includes('volume') ? 'volValue' : 'changeRate';
            } else {
                sourceData = allFuturesContracts;
                sortKey = rule.criteria.includes('volume') ? 'volumeOf24h' : 'priceChgPct';
            }
            
            const sorted = [...sourceData].sort((a, b) => {
                const valA = parseFloat((a as any)[sortKey]) || 0;
                const valB = parseFloat((b as any)[sortKey]) || 0;
                return valB - valA;
            });

            let selected: (KucoinTicker | KucoinFuturesContract)[];
            if (rule.criteria.startsWith('top')) {
                selected = sorted.slice(0, rule.count);
            } else { // bottom
                selected = sorted.slice(-rule.count).reverse();
            }

            selected.forEach(item => {
                if (!addedSymbols.has(item.symbol)) {
                    addedSymbols.add(item.symbol);
                    const isSpot = rule.source === 'spot';
                    finalItems.push({
                        symbol: item.symbol,
                        symbolName: isSpot ? (item as KucoinTicker).symbolName : (item as KucoinFuturesContract).symbol.replace(/M$/, ''),
                        type: rule.source,
                        currentPrice: isSpot ? parseFloat((item as KucoinTicker).last) : (item as KucoinFuturesContract).markPrice,
                        priceChgPct: isSpot ? parseFloat((item as KucoinTicker).changeRate) : (item as KucoinFuturesContract).priceChgPct,
                        high: isSpot ? parseFloat((item as KucoinTicker).high) : (item as KucoinFuturesContract).highPrice,
                        low: isSpot ? parseFloat((item as KucoinTicker).low) : (item as KucoinFuturesContract).lowPrice,
                        order: orderIndex++,
                    });
                }
            });
        });
        
        if (config.clearExisting) {
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
  }, [toast]);

  useEffect(() => {
    const symbols = watchlist.map(item => item.symbol);
    connectToSpot(symbols);
    
    return () => {
      if(spotWs.current?.readyState === WebSocket.OPEN) {
        spotWs.current.close();
      }
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
