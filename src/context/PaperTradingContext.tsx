
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

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(
  undefined
);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const openPositionsRef = useRef<OpenPosition[]>(openPositions);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptions = useRef<Set<string>>(new Set());

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresSubscriptions = useRef<Set<string>>(new Set());

  useEffect(() => {
    openPositionsRef.current = openPositions;
  }, [openPositions]);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem("paperTrading_balance");
      const savedPositions = localStorage.getItem("paperTrading_positions");
      const savedHistory = localStorage.getItem("paperTrading_history");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        const parsedPositions = JSON.parse(savedPositions);
        // Ensure old positions have a side property for type safety
        const validatedPositions = parsedPositions.map((pos: any) => {
          if (pos.positionType === 'spot' && !pos.side) {
            return { ...pos, side: 'buy' };
          }
          return pos;
        });
        setOpenPositions(validatedPositions);
      }
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      // Reset to defaults if loading fails
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage and manage WebSocket connections when state changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("paperTrading_balance", JSON.stringify(balance));
      localStorage.setItem(
        "paperTrading_positions",
        JSON.stringify(openPositions)
      );
      localStorage.setItem("paperTrading_history", JSON.stringify(tradeHistory));

      const spotSymbols = openPositions
        .filter((p) => p.positionType === "spot")
        .map((p) => p.symbol);
      connectToSpot(spotSymbols);

      const futuresSymbols = openPositions
        .filter((p) => p.positionType === "futures")
        .map((p) => p.symbol);
      connectToFutures(futuresSymbols);
    }
  }, [balance, openPositions, tradeHistory, isLoaded]); // Dependencies will trigger this effect

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
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
  }, []);

  const connectToSpot = useCallback(
    async (symbolsToSubscribe: string[]) => {
      // Close connection if no symbols are needed
      if (symbolsToSubscribe.length === 0) {
        if (spotWs.current) {
          spotWs.current.close();
          spotWs.current = null;
          if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
          setSpotWsStatus("disconnected");
          spotSubscriptions.current.clear();
        }
        return;
      }
      
      const topic = `/market/ticker:${symbolsToSubscribe.join(",")}`;

      // If already connected, just subscribe/unsubscribe
      if (spotWs.current && spotWs.current.readyState === WebSocket.OPEN) {
        spotWs.current.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/ticker:${Array.from(spotSubscriptions.current).join(',')}`}));
        spotWs.current.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
        spotSubscriptions.current = new Set(symbolsToSubscribe);
        return;
      }

      if (spotWs.current) spotWs.current.close();
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

        ws.onopen = () => {
          setSpotWsStatus("connected");
          if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
          spotPingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
          }, instanceServers[0].pingInterval / 2);

          ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, response: true }));
          spotSubscriptions.current = new Set(symbolsToSubscribe);
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
          spotSubscriptions.current.clear();
        };

        ws.onerror = () => {
          setSpotWsStatus("error");
          ws.close();
        };
        spotWs.current = ws;
      } catch (error) {
        setSpotWsStatus("error");
      }
    },
    [updatePositionPrice]
  );
  
  const connectToFutures = useCallback(
    async (symbolsToSubscribe: string[]) => {
      if (symbolsToSubscribe.length === 0) {
        if (futuresWs.current) {
          futuresWs.current.close();
          futuresWs.current = null;
          if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
          setFuturesWsStatus("disconnected");
          futuresSubscriptions.current.clear();
        }
        return;
      }
      
      const symbolsToAdd = symbolsToSubscribe.filter(s => !futuresSubscriptions.current.has(s));
      
      if (futuresWs.current && futuresWs.current.readyState === WebSocket.OPEN) {
        symbolsToAdd.forEach(symbol => {
          futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true }));
          futuresSubscriptions.current.add(symbol);
        });
        return;
      }

      if (futuresWs.current) futuresWs.current.close();
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

        ws.onopen = () => {
          setFuturesWsStatus("connected");
          if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
          futuresPingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
          }, instanceServers[0].pingInterval / 2);

          symbolsToSubscribe.forEach((symbol) => {
            ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/contractMarket/snapshot:${symbol}`, response: true }));
            futuresSubscriptions.current.add(symbol);
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
          futuresSubscriptions.current.clear();
        };

        ws.onerror = () => {
          setFuturesWsStatus("error");
          ws.close();
        };

        futuresWs.current = ws;
      } catch (error) {
        setFuturesWsStatus("error");
      }
    },
    [updatePositionPrice]
  );
  
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
                  side: 'buy', // Fix: Added required 'side' property
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
    const positionToClose = openPositionsRef.current.find(p => p.id === positionId);
    if (!positionToClose) return;

    const exitPrice = positionToClose.currentPrice;
    let pnl = 0;
    let returnedValue = 0;

    if (positionToClose.positionType === 'spot') {
      pnl = (exitPrice - positionToClose.averageEntryPrice) * positionToClose.size;
      returnedValue = positionToClose.size * exitPrice;
    } else if (positionToClose.positionType === 'futures') {
      const pnlMultiplier = positionToClose.side === 'long' ? 1 : -1;
      pnl = (exitPrice - positionToClose.averageEntryPrice) * positionToClose.size * pnlMultiplier;
      // Fix: Safely access leverage, default to 1 for calculation if undefined
      const leverage = positionToClose.leverage ?? 1;
      const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / leverage;
      returnedValue = collateral + pnl;
    }

    setBalance(prev => prev + returnedValue);
    setOpenPositions(prev => prev.filter(p => p.id !== positionId));

    setTradeHistory(prev => {
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
            status: 'closed' as 'closed', // Explicitly type status
            pnl,
            // Fix: Safely access leverage
            leverage: positionToClose.leverage,
        };
        return [closingTrade, ...prev];
    });

    toast({ title: `Position Closed`, description: `Closed ${positionToClose.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });
  }, [toast]);
  
  const closeAllPositions = useCallback(() => {
    // Use the ref to get the most current list of positions
    openPositionsRef.current.forEach(p => closePosition(p.id));
  }, [closePosition]);

  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
  }, [toast]);

  return (
    <PaperTradingContext.Provider
      value={{
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

    