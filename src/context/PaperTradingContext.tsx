
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
  OpenPosition,
  PaperTrade,
  KucoinTokenResponse,
  IncomingKucoinWebSocketMessage,
  IncomingKucoinFuturesWebSocketMessage,
  WatchlistItem,
  PriceAlert,
} from "@/types";
import { useToast } from "@/hooks/use-toast";

const INITIAL_BALANCE = 100000;

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  watchlist: WatchlistItem[];
  priceAlerts: Record<string, PriceAlert>;
  toggleWatchlist: (symbol: string, symbolName: string, type: 'spot' | 'futures') => void;
  addPriceAlert: (symbol: string, price: number, condition: 'above' | 'below') => void;
  removePriceAlert: (symbol: string) => void;
  buy: (
    symbol: string,
    symbolName: string,
    amountUSD: number,
    currentPrice: number
  ) => void;
  futuresBuy: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number
  ) => void;
  futuresSell: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number
  ) => void;
  closePosition: (positionId: string) => void;
  closeAllPositions: () => void;
  clearHistory: () => void;
  spotWsStatus: string;
  futuresWsStatus: string;
}

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(
  undefined
);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<Record<string, PriceAlert>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptionsRef = useRef<Set<string>>(new Set());

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresSubscriptionsRef = useRef<Set<string>>(new Set());

  // Load from local storage on mount
  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem("paperTrading_balance");
      const savedPositions = localStorage.getItem("paperTrading_positions");
      const savedHistory = localStorage.getItem("paperTrading_history");
      const savedWatchlist = localStorage.getItem("paperTrading_watchlist");
      const savedAlerts = localStorage.getItem("paperTrading_priceAlerts");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        const parsedPositions = JSON.parse(savedPositions);
        const validatedPositions = parsedPositions.map((pos: any) => {
          if (pos.positionType === 'spot' && !pos.side) {
            return { ...pos, side: 'buy' };
          }
          return pos;
        });
        setOpenPositions(validatedPositions);
      }
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
      if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
      if (savedAlerts) setPriceAlerts(JSON.parse(savedAlerts));

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
      setWatchlist([]);
      setPriceAlerts({});
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage when state changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("paperTrading_balance", JSON.stringify(balance));
      localStorage.setItem("paperTrading_positions", JSON.stringify(openPositions));
      localStorage.setItem("paperTrading_history", JSON.stringify(tradeHistory));
      localStorage.setItem("paperTrading_watchlist", JSON.stringify(watchlist));
      localStorage.setItem("paperTrading_priceAlerts", JSON.stringify(priceAlerts));
    }
  }, [balance, openPositions, tradeHistory, isLoaded, watchlist, priceAlerts]);
  
  const checkPriceAlerts = useCallback((symbol: string, newPrice: number) => {
    const alert = priceAlerts[symbol];
    if (!alert || alert.triggered) return;

    const conditionMet = 
      (alert.condition === 'above' && newPrice >= alert.price) ||
      (alert.condition === 'below' && newPrice <= alert.price);
    
    if (conditionMet) {
        toast({
            title: "Price Alert Triggered!",
            description: `${symbol} has reached your alert price of ${alert.price}. Current price is ${newPrice}.`
        });
        // Mark as triggered to avoid repeated notifications
        setPriceAlerts(prev => ({
            ...prev,
            [symbol]: { ...alert, triggered: true }
        }));
    }
  }, [priceAlerts, toast]);

  const updateWatchlistPrice = useCallback((symbol: string, newPrice: number) => {
      setWatchlist(prev => prev.map(item => 
          item.symbol === symbol ? { ...item, currentPrice: newPrice } : item
      ));
  }, []);

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
    checkPriceAlerts(symbol, newPrice);
    updateWatchlistPrice(symbol, newPrice);

    setOpenPositions((prevPositions) =>
      prevPositions.map((p) => {
        if (p.symbol === symbol) {
          let unrealizedPnl = 0;
          if (p.positionType === "spot") {
            unrealizedPnl = (newPrice - p.averageEntryPrice) * p.size;
          } else if (p.positionType === "futures") {
            const pnlMultiplier = p.side === "long" ? 1 : -1;
            unrealizedPnl = (newPrice - p.averageEntryPrice) * p.size * pnlMultiplier;
          }
          return { ...p, currentPrice: newPrice, unrealizedPnl };
        }
        return p;
      })
    );
  }, [checkPriceAlerts, updateWatchlistPrice]);
  
  const connectToSpot = useCallback(
    async (topic: string) => {
      setSpotWsStatus("fetching_token");
      try {
        const res = await fetch("/api/kucoin-ws-token");
        const tokenData: KucoinTokenResponse = await res.json();
        if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-spot-${Date.now()}`;
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

          ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, response: true }));
        };

        ws.onmessage = (event: MessageEvent) => {
          const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
          if (message.type === "message" && message.subject === "trade.ticker") {
            const tickerData = message.data;
            if (tickerData.price) {
              const price = parseFloat(tickerData.price);
              const symbol = message.topic.split(":")[1];
              if (!isNaN(price)) updatePositionPrice(symbol, price);
            }
          }
        };

        ws.onclose = () => {
          setSpotWsStatus("disconnected");
          if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
          spotWs.current = null;
        };

        ws.onerror = () => {
          setSpotWsStatus("error");
          ws.close();
        };
      } catch (error) {
        setSpotWsStatus("error");
      }
    },
    [updatePositionPrice]
  );
  
  const connectToFutures = useCallback(
    async (symbolsToSubscribe: string[]) => {
      setFuturesWsStatus("fetching_token");
      try {
        const res = await fetch("/api/kucoin-futures-ws-token", { method: "POST" });
        const tokenData: KucoinTokenResponse = await res.json();
        if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Futures WebSocket token");

        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-futures-${Date.now()}`;
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;

        setFuturesWsStatus("connecting");
        const ws = new WebSocket(wsUrl);
        futuresWs.current = ws;

        ws.onopen = () => {
          setFuturesWsStatus("connected");
          if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
          futuresPingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
          }, instanceServers[0].pingInterval / 2);

          symbolsToSubscribe.forEach((symbol) => {
            ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/contractMarket/snapshot:${symbol}`, response: true }));
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
          if (message.type === "message" && message.subject === 'snapshot.24h') {
            const { symbol, lastPrice } = message.data;
            if (lastPrice !== undefined) {
              updatePositionPrice(symbol, lastPrice);
            }
          }
        };

        ws.onclose = () => {
          setFuturesWsStatus("disconnected");
          if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
          futuresWs.current = null;
        };

        ws.onerror = () => {
          setFuturesWsStatus("error");
          ws.close();
        };

      } catch (error) {
        setFuturesWsStatus("error");
      }
    },
    [updatePositionPrice]
  );

  const spotPositionSymbols = useMemo(() => openPositions.filter(p => p.positionType === 'spot').map(p => p.symbol), [openPositions]);
  const futuresPositionSymbols = useMemo(() => openPositions.filter(p => p.positionType === 'futures').map(p => p.symbol), [openPositions]);

  const spotWatchlistSymbols = useMemo(() => watchlist.filter(item => item.type === 'spot').map(item => item.symbol), [watchlist]);
  const futuresWatchlistSymbols = useMemo(() => watchlist.filter(item => item.type === 'futures').map(item => item.symbol), [watchlist]);

  const allSpotSymbols = useMemo(() => Array.from(new Set([...spotPositionSymbols, ...spotWatchlistSymbols])), [spotPositionSymbols, spotWatchlistSymbols]);
  const allFuturesSymbols = useMemo(() => Array.from(new Set([...futuresPositionSymbols, ...futuresWatchlistSymbols])), [futuresPositionSymbols, futuresWatchlistSymbols]);
  
  // Effect to manage Spot WebSocket connection
  useEffect(() => {
    if (!isLoaded) return;

    const currentSubs = spotSubscriptionsRef.current;
    const requiredSubs = new Set(allSpotSymbols);

    if (JSON.stringify(Array.from(currentSubs)) === JSON.stringify(Array.from(requiredSubs))) {
      return; // No change in subscriptions
    }

    spotSubscriptionsRef.current = requiredSubs;
    
    if (spotWs.current && spotWs.current.readyState === WebSocket.OPEN) {
      // Unsubscribe from all and resubscribe to new list
      if (currentSubs.size > 0) {
        spotWs.current.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/ticker:${Array.from(currentSubs).join(',')}`}));
      }
      if (requiredSubs.size > 0) {
        spotWs.current.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/ticker:${Array.from(requiredSubs).join(',')}`, response: true }));
      }
    } else if (requiredSubs.size > 0) {
      // Connect if not already connected
      connectToSpot(`/market/ticker:${Array.from(requiredSubs).join(',')}`);
    } else if (spotWs.current) {
      // Disconnect if no subscriptions are required
      spotWs.current.close();
    }
  }, [isLoaded, allSpotSymbols, connectToSpot]);

  // Effect to manage Futures WebSocket connection
  useEffect(() => {
    if (!isLoaded) return;
    
    const currentSubs = futuresSubscriptionsRef.current;
    const requiredSubs = new Set(allFuturesSymbols);

    if (JSON.stringify(Array.from(currentSubs)) === JSON.stringify(Array.from(requiredSubs))) {
      return; // No change
    }

    futuresSubscriptionsRef.current = requiredSubs;

    if (futuresWs.current && futuresWs.current.readyState === WebSocket.OPEN) {
        const symbolsToUnsub = [...currentSubs].filter(s => !requiredSubs.has(s));
        const symbolsToSub = [...requiredSubs].filter(s => !currentSubs.has(s));

        symbolsToUnsub.forEach(symbol => {
          futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/contractMarket/snapshot:${symbol}`}));
        });
        symbolsToSub.forEach(symbol => {
          futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true }));
        });

    } else if (requiredSubs.size > 0) {
      connectToFutures(Array.from(requiredSubs));
    } else if (futuresWs.current) {
      futuresWs.current.close();
    }
  }, [isLoaded, allFuturesSymbols, connectToFutures]);

  const buy = useCallback(
    (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => {
      if (balance < amountUSD) {
        toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
        return;
      }
      const size = amountUSD / currentPrice;

      setOpenPositions(prev => {
          const existingPositionIndex = prev.findIndex(p => p.symbol === symbol && p.positionType === 'spot');
          if (existingPositionIndex > -1) {
              const updatedPositions = [...prev];
              const existing = updatedPositions[existingPositionIndex];
              const totalSize = existing.size + size;
              const totalValue = (existing.size * existing.averageEntryPrice) + (size * currentPrice);
              existing.averageEntryPrice = totalValue / totalSize;
              existing.size = totalSize;
              return updatedPositions;
          } else {
              const newPosition: OpenPosition = {
                  id: crypto.randomUUID(),
                  positionType: 'spot',
                  symbol,
                  symbolName,
                  size,
                  averageEntryPrice: currentPrice,
                  currentPrice,
                  side: 'buy',
                  unrealizedPnl: 0,
              };
              return [...prev, newPosition];
          }
      });
      
      setBalance(prev => prev - amountUSD);
      setTradeHistory(prev => [{
        id: crypto.randomUUID(),
        positionId: 'N/A',
        positionType: 'spot',
        symbol,
        symbolName,
        size,
        price: currentPrice,
        side: 'buy',
        timestamp: Date.now(),
        status: 'open',
      }, ...prev]);

      toast({ title: "Spot Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName}` });
    },
    [balance, toast]
  );
  
  const createFuturesTrade = useCallback(
    (symbol: string, collateral: number, entryPrice: number, leverage: number, side: "long" | "short") => {
      if (balance < collateral) {
        toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
        return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;

      const newPosition: OpenPosition = {
        id: crypto.randomUUID(),
        positionType: "futures",
        symbol,
        symbolName: symbol.replace(/M$/, ""),
        size,
        averageEntryPrice: entryPrice,
        currentPrice: entryPrice,
        side,
        leverage,
        unrealizedPnl: 0,
      };

      setBalance((prev) => prev - collateral);
      setOpenPositions((prev) => [...prev, newPosition]);
      setTradeHistory((prev) => [{
        id: crypto.randomUUID(),
        positionId: newPosition.id,
        positionType: "futures",
        symbol,
        symbolName: newPosition.symbolName,
        size,
        price: entryPrice,
        side,
        leverage,
        timestamp: Date.now(),
        status: "open",
      }, ...prev]);

      toast({ title: "Futures Trade Executed", description: `${side.toUpperCase()} ${size.toFixed(4)} ${newPosition.symbolName} with ${leverage}x leverage.` });
    },
    [balance, toast]
  );

  const futuresBuy = useCallback((symbol: string, collateral: number, entryPrice: number, leverage: number) => createFuturesTrade(symbol, collateral, entryPrice, leverage, "long"), [createFuturesTrade]);
  const futuresSell = useCallback((symbol: string, collateral: number, entryPrice: number, leverage: number) => createFuturesTrade(symbol, collateral, entryPrice, leverage, "short"), [createFuturesTrade]);

  const closePosition = useCallback((positionId: string) => {
    setOpenPositions(prev => {
        const positionToClose = prev.find(p => p.id === positionId);
        if (!positionToClose) return prev;

        const exitPrice = positionToClose.currentPrice;
        let pnl = 0;
        let returnedValue = 0;

        if (positionToClose.positionType === 'spot') {
          pnl = (exitPrice - positionToClose.averageEntryPrice) * positionToClose.size;
          returnedValue = positionToClose.size * exitPrice;
        } else if (positionToClose.positionType === 'futures') {
          const pnlMultiplier = positionToClose.side === 'long' ? 1 : -1;
          pnl = (exitPrice - positionToClose.averageEntryPrice) * positionToClose.size * pnlMultiplier;
          const leverage = positionToClose.leverage ?? 1;
          const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / leverage;
          returnedValue = collateral + pnl;
        }

        setBalance(bal => bal + returnedValue);
        
        setTradeHistory(th => {
            const closingTrade: PaperTrade = {
                id: crypto.randomUUID(),
                positionId: positionToClose.id,
                positionType: positionToClose.positionType,
                symbol: positionToClose.symbol,
                symbolName: positionToClose.symbolName,
                size: positionToClose.size,
                price: exitPrice,
                side: positionToClose.positionType === 'futures' ? (positionToClose.side === 'long' ? 'sell' : 'buy') : 'sell',
                timestamp: Date.now(),
                status: 'closed',
                pnl,
                leverage: positionToClose.leverage,
            };
            return [closingTrade, ...th];
        });
        
        toast({ title: `Position Closed`, description: `Closed ${positionToClose.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });
        
        return prev.filter(p => p.id !== positionId);
    });
  }, [toast]);
  
  const closeAllPositions = useCallback(() => {
    // This now safely gets the latest positions state for iteration
    setOpenPositions(currentPositions => {
        currentPositions.forEach(p => closePosition(p.id));
        return []; // Clear all positions
    });
  }, [closePosition]);

  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
  }, [toast]);

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures') => {
    setWatchlist(prev => {
      const existingIndex = prev.findIndex(item => item.symbol === symbol);
      if (existingIndex > -1) {
        toast({ title: 'Watchlist', description: `${symbolName} removed from watchlist.` });
        return prev.filter(item => item.symbol !== symbol);
      } else {
        toast({ title: 'Watchlist', description: `${symbolName} added to watchlist.` });
        const newItem: WatchlistItem = { symbol, symbolName, type, currentPrice: 0 };
        return [newItem, ...prev];
      }
    });
  }, [toast]);

  const addPriceAlert = useCallback((symbol: string, price: number, condition: 'above' | 'below') => {
    const newAlert: PriceAlert = { price, condition, triggered: false };
    setPriceAlerts(prev => ({ ...prev, [symbol]: newAlert }));
    toast({ title: 'Alert Set', description: `Alert set for ${symbol} when price is ${condition} ${price}.` });
  }, [toast]);

  const removePriceAlert = useCallback((symbol: string) => {
    setPriceAlerts(prev => {
      const { [symbol]: _, ...rest } = prev;
      return rest;
    });
    toast({ title: 'Alert Removed', description: `Alert for ${symbol} removed.` });
  }, [toast]);

  return (
    <PaperTradingContext.Provider
      value={{
        balance,
        openPositions,
        tradeHistory,
        watchlist,
        priceAlerts,
        toggleWatchlist,
        addPriceAlert,
        removePriceAlert,
        buy,
        futuresBuy,
        futuresSell,
        closePosition,
        closeAllPositions,
        clearHistory,
        spotWsStatus,
        futuresWsStatus,
      }}
    >
      {children}
    </PaperTradingContext.Provider>
  );
};

export const usePaperTrading = (): PaperTradingContextType => {
  const context = useContext(PaperTradingContext);
  if (!context) {
    throw new Error("usePaperTrading must be used within a PaperTradingProvider");
  }
  return context;
};

    