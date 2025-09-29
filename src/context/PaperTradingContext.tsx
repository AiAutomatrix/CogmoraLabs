
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
  OpenPosition,
  PaperTrade,
  KucoinTokenResponse,
  IncomingKucoinWebSocketMessage,
  IncomingKucoinFuturesWebSocketMessage,
} from "@/types";
import { useToast } from "@/hooks/use-toast";

const INITIAL_BALANCE = 100000;

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
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

const PaperTradingContext = createContext<
  PaperTradingContextType | undefined
>(undefined);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const openPositionsRef = useRef(openPositions);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [spotTickers, setSpotTickers] = useState<any[]>([]);

  const [spotWsStatus, setSpotWsStatus] = useState("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [futuresWsStatus, setFuturesWsStatus] = useState("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    openPositionsRef.current = openPositions;
  }, [openPositions]);

  const updatePositionPrice = useCallback(
    (symbol: string, newPrice: number) => {
      setOpenPositions((prevPositions) =>
        prevPositions.map((p) => {
          if (p.symbol === symbol) {
            let unrealizedPnl = p.unrealizedPnl;
            if (p.positionType === "spot") {
              unrealizedPnl = (newPrice - p.averageEntryPrice) * p.size;
            } else if (p.positionType === "futures") {
              const pnlMultiplier = p.side === "long" ? 1 : -1;
              unrealizedPnl =
                (newPrice - p.averageEntryPrice) * p.size * pnlMultiplier;
            }
            return { ...p, currentPrice: newPrice, unrealizedPnl };
          }
          return p;
        })
      );
    },
    []
  );
  
  const connectToSpot = useCallback(async (positionSymbols: string[]) => {
      if (positionSymbols.length === 0) {
        if (spotWs.current) spotWs.current.close();
        return;
      }
  
      if (spotWs.current && spotWs.current.readyState === WebSocket.OPEN) {
          const topic = `/market/ticker:${positionSymbols.join(',')}`;
          spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
          return;
      }
  
      if (spotWs.current) spotWs.current.close();
  
      setSpotWsStatus('fetching_token');
      try {
        const res = await fetch('/api/kucoin-ws-token');
        const tokenData: KucoinTokenResponse = await res.json();
        if (tokenData.code !== "200000") throw new Error('Failed to fetch KuCoin Spot WebSocket token');
  
        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-spot-${Date.now()}`;
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;
  
        setSpotWsStatus('connecting');
        const ws = new WebSocket(wsUrl);
  
        ws.onopen = () => {
          setSpotWsStatus('connected');
          spotPingIntervalRef.current = setInterval(() => {
            ws.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
          }, instanceServers[0].pingInterval / 2);
  
          const topic = `/market/ticker:${positionSymbols.join(',')}`;
          ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
        };
  
        ws.onmessage = (event) => {
          const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
          if (message.type === 'message' && message.subject === 'trade.ticker') {
            const tickerData = message.data;
            if (tickerData.price) {
              const price = parseFloat(tickerData.price);
              const symbol = message.topic.split(':')[1];
              if (!isNaN(price)) {
                updatePositionPrice(symbol, price);
              }
            }
          }
        };
  
        ws.onclose = () => setSpotWsStatus('disconnected');
        ws.onerror = () => setSpotWsStatus('error');
  
        spotWs.current = ws;
      } catch (error) {
        console.error('Spot WebSocket setup failed:', error);
        setSpotWsStatus('error');
      }
    }, [updatePositionPrice]);


  const createFuturesTrade = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    side: 'long' | 'short'
  ) => {
    if (balance < collateral) {
      toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
      return;
    }
    const positionValue = collateral * leverage;
    const size = positionValue / entryPrice;

    const newPosition: OpenPosition = {
      id: crypto.randomUUID(),
      positionType: 'futures',
      symbol,
      symbolName: symbol.replace(/M$/, ''),
      size,
      averageEntryPrice: entryPrice,
      currentPrice: entryPrice,
      side,
      leverage,
      unrealizedPnl: 0,
    };

    const newTrade: PaperTrade = {
      id: crypto.randomUUID(),
      positionId: newPosition.id,
      positionType: 'futures',
      symbol,
      symbolName: newPosition.symbolName,
      size,
      price: entryPrice,
      side,
      leverage,
      timestamp: Date.now(),
      status: 'open',
    };

    setBalance(prev => prev - collateral);
    setOpenPositions(prev => [...prev, newPosition]);
    setTradeHistory(prev => [newTrade, ...prev]);
    toast({
      title: "Futures Trade Executed",
      description: `${side.toUpperCase()} ${size.toFixed(4)} ${newPosition.symbolName} at $${entryPrice.toFixed(2)} with ${leverage}x leverage.`,
    });

  }, [balance, toast]);


  const connectToFutures = useCallback(async (positionSymbols: string[]) => {
      if (positionSymbols.length === 0) {
        if(futuresWs.current) futuresWs.current.close();
        return;
      };
  
      if (futuresWs.current && futuresWs.current.readyState === WebSocket.OPEN) {
          const newSymbols = positionSymbols.filter(s => !openPositionsRef.current.some(p => p.symbol === s));
          newSymbols.forEach(symbol => {
              futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true }));
          });
          return;
      }
  
      if (futuresWs.current) futuresWs.current.close();
  
      setFuturesWsStatus('fetching_token');
      try {
        const res = await fetch('/api/kucoin-futures-ws-token', { method: 'POST' });
        const tokenData: KucoinTokenResponse = await res.json();
        if (tokenData.code !== "200000") throw new Error('Failed to fetch KuCoin Futures WebSocket token');
  
        const { token, instanceServers } = tokenData.data;
        const connectId = `cogmora-futures-${Date.now()}`;
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=${connectId}`;
  
        setFuturesWsStatus('connecting');
        const ws = new WebSocket(wsUrl);
  
        ws.onopen = () => {
          setFuturesWsStatus('connected');
          futuresPingIntervalRef.current = setInterval(() => {
            ws.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
          }, instanceServers[0].pingInterval / 2);
  
          positionSymbols.forEach(symbol => {
            ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true }));
          });
        };
  
        ws.onmessage = (event) => {
          const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
          if (message.type === 'message' && message.subject === 'snapshot.24h') {
            const { symbol, lastPrice } = message.data;
            if (lastPrice) {
              updatePositionPrice(symbol, lastPrice);
            }
          }
        };
  
        ws.onclose = () => setFuturesWsStatus('disconnected');
        ws.onerror = () => setFuturesWsStatus('error');
  
        futuresWs.current = ws;
      } catch (error) {
        console.error('Futures WebSocket setup failed:', error);
        setFuturesWsStatus('error');
      }
    }, [updatePositionPrice]);
  
  // --- DATA PERSISTENCE & Initial Connection ---
  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem("paperTrading_balance");
      const savedPositions = localStorage.getItem("paperTrading_positions");
      const savedHistory = localStorage.getItem("paperTrading_history");

      let initialPositions: OpenPosition[] = [];
      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        initialPositions = JSON.parse(savedPositions);
        setOpenPositions(initialPositions);
      }
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));

      const spotSymbols = initialPositions.filter(p => p.positionType === 'spot').map(p => p.symbol);
      if (spotSymbols.length > 0) {
        connectToSpot(spotSymbols);
      }

      const futuresSymbols = initialPositions.filter(p => p.positionType === 'futures').map(p => p.symbol);
      if (futuresSymbols.length > 0) {
        connectToFutures(futuresSymbols);
      }

    } catch (error) {
      console.error("Failed to load from local storage", error);
    } finally {
      setIsLoaded(true);
    }

    return () => {
      spotWs.current?.close();
      if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
      futuresWs.current?.close();
      if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
    };
  }, [connectToSpot, connectToFutures]);


  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem("paperTrading_balance", JSON.stringify(balance));
      localStorage.setItem(
        "paperTrading_positions",
        JSON.stringify(openPositions)
      );
      localStorage.setItem(
        "paperTrading_history",
        JSON.stringify(tradeHistory)
      );
    } catch (error) {
      console.error("Failed to save to local storage", error);
    }
  }, [balance, openPositions, tradeHistory, isLoaded]);

  // --- TRADING LOGIC ---
  const buy = useCallback((
    symbol: string,
    symbolName: string,
    amountUSD: number,
    currentPrice: number
  ) => {
    if (balance < amountUSD) {
      toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
      return;
    }

    let positionToConnect: OpenPosition | null = null;

    setOpenPositions(prev => {
        const existingPosition = prev.find(p => p.symbol === symbol && p.positionType === 'spot');
        const size = amountUSD / currentPrice;
        let newPositions;

        if (existingPosition) {
            const newTotalSize = existingPosition.size + size;
            const newAveragePrice = ((existingPosition.averageEntryPrice * existingPosition.size) + (currentPrice * size)) / newTotalSize;
            
            newPositions = prev.map(p => p.id === existingPosition.id ? { ...p, size: newTotalSize, averageEntryPrice: newAveragePrice } : p);

            const newTrade: PaperTrade = {
                id: crypto.randomUUID(),
                positionId: existingPosition.id,
                positionType: 'spot', symbol, symbolName, size,
                price: currentPrice, side: 'buy', timestamp: Date.now(), status: 'open'
            };
            setTradeHistory(th => [newTrade, ...th]);

        } else {
            const newPosition: OpenPosition = {
                id: crypto.randomUUID(), positionType: 'spot', symbol, symbolName,
                size, averageEntryPrice: currentPrice, currentPrice,
                side: 'buy', unrealizedPnl: 0,
            };
            positionToConnect = newPosition;
            newPositions = [...prev, newPosition];

            const newTrade: PaperTrade = {
                id: crypto.randomUUID(), positionId: newPosition.id,
                positionType: 'spot', symbol, symbolName, size,
                price: currentPrice, side: 'buy', timestamp: Date.now(), status: 'open'
            };
            setTradeHistory(th => [newTrade, ...th]);
        }
        return newPositions;
    });

    setBalance(prev => prev - amountUSD);
    
    if (positionToConnect) {
      connectToSpot([positionToConnect.symbol]);
    }

    toast({ title: "Trade Executed", description: `Bought ${symbolName} for $${amountUSD.toFixed(2)}.` });
  }, [balance, toast, connectToSpot]);

  const futuresBuy = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number
  ) => {
    createFuturesTrade(symbol, collateral, entryPrice, leverage, "long");
    connectToFutures([symbol]);
  }, [createFuturesTrade, connectToFutures]);

  const futuresSell = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number
  ) => {
    createFuturesTrade(symbol, collateral, entryPrice, leverage, "short");
    connectToFutures([symbol]);
  }, [createFuturesTrade, connectToFutures]);

  const closePosition = useCallback((positionId: string) => {
    const position = openPositionsRef.current.find((p) => p.id === positionId);
    if (!position) {
      toast({ title: "Error", description: "Position not found.", variant: "destructive" });
      return;
    }

    const finalPnl = position.unrealizedPnl || 0;
    
    let valueToReturn;
    if (position.positionType === 'spot') {
        valueToReturn = position.size * position.currentPrice;
    } else {
        // For futures, return collateral + PnL
        const collateral = (position.size * position.averageEntryPrice) / (position.leverage || 1);
        valueToReturn = collateral + finalPnl;
    }
    
    setBalance((prev) => prev + valueToReturn);
    setOpenPositions((prev) => prev.filter((p) => p.id !== positionId));

    const closingTrade: PaperTrade = {
        id: crypto.randomUUID(),
        positionId: position.id,
        positionType: position.positionType,
        symbol: position.symbol,
        symbolName: position.symbolName,
        size: position.size,
        price: position.currentPrice,
        side: position.side === 'buy' ? 'sell' : (position.side === 'long' ? 'sell' : 'buy'), // Invert side for close
        leverage: position.leverage,
        timestamp: Date.now(),
        status: 'closed',
        pnl: finalPnl
    };

    setTradeHistory(prev => {
        const newHistory: PaperTrade[] = prev.map(t => 
            t.positionId === positionId ? { ...t, status: 'closed' as 'closed' } : t
        );
        return [closingTrade, ...newHistory];
    });
    
    toast({
      title: "Position Closed",
      description: `Closed ${position.symbolName} position. Realized P&L: ${formatCurrency(finalPnl)}`,
      variant: finalPnl >= 0 ? "default" : "destructive",
    });

  }, [toast]);

  const closeAllPositions = useCallback(() => {
    if (openPositionsRef.current.length === 0) {
      toast({ title: "No Positions", description: "No open positions to close." });
      return;
    }

    let totalValueToReturn = 0;
    const closedTrades: PaperTrade[] = [];
    const closedPositionIds = new Set(openPositionsRef.current.map(p => p.id));

    openPositionsRef.current.forEach(pos => {
        const finalPnl = pos.unrealizedPnl || 0;
        
        let valueChange;
        if (pos.positionType === 'spot') {
            valueChange = pos.size * pos.currentPrice;
        } else {
            const collateral = (pos.size * pos.averageEntryPrice) / (pos.leverage || 1);
            valueChange = collateral + finalPnl;
        }
        totalValueToReturn += valueChange;
        
        closedTrades.push({
            id: crypto.randomUUID(),
            positionId: pos.id,
            positionType: pos.positionType,
            symbol: pos.symbol,
            symbolName: pos.symbolName,
            size: pos.size,
            price: pos.currentPrice,
            side: pos.side === 'buy' ? 'sell' : (pos.side === 'long' ? 'sell' : 'buy'),
            leverage: pos.leverage,
            timestamp: Date.now(),
            status: 'closed',
            pnl: finalPnl
        });
    });

    setBalance(prev => prev + totalValueToReturn);
    setOpenPositions([]);
    
    setTradeHistory(prev => {
      const updatedHistory = prev.map(t => 
        closedPositionIds.has(t.positionId) ? { ...t, status: 'closed' as 'closed' } : t
      );
      return [...closedTrades, ...updatedHistory];
    });

    if(spotWs.current) spotWs.current.close();
    if(futuresWs.current) futuresWs.current.close();

    toast({
      title: "All Positions Closed",
      description: `Closed all positions. Realized P&L logged in trade history.`,
    });
  }, [toast]);

  const clearHistory = () => {
    setTradeHistory([]);
    localStorage.removeItem("paperTrading_history");
    toast({
      title: "Trade History Cleared",
      description: "Your trade history has been successfully deleted.",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const value = {
    balance,
    openPositions,
    tradeHistory,
    buy,
    futuresBuy,
    futuresSell,
    closePosition,
    closeAllPositions,
    clearHistory,
    spotWsStatus,
    futuresWsStatus,
  };

  return (
    <PaperTradingContext.Provider value={value}>
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

    