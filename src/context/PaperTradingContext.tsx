
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
  KucoinTicker,
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

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
    setOpenPositions((prevPositions: OpenPosition[]) =>
      prevPositions.map((p: OpenPosition) => {
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
  }, []);

  const connectToSpot = useCallback(
    async (symbolsToSubscribe: string[]) => {
      if (symbolsToSubscribe.length === 0) {
        if (spotWs.current) {
          spotWs.current.close();
          spotWs.current = null;
          if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
          setSpotWsStatus("disconnected");
        }
        return;
      }

      const connect = async () => {
        if (spotWs.current && spotWs.current.readyState === WebSocket.OPEN) {
          // Already connected, just handle subscriptions
          const topic = `/market/ticker:${symbolsToSubscribe.join(",")}`;
          spotWs.current.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, response: true }));
          symbolsToSubscribe.forEach(s => spotSubscriptions.current.add(s));
          return;
        }

        spotWs.current?.close();
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
            spotPingIntervalRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
              }
            }, instanceServers[0].pingInterval / 2);

            const topic = `/market/ticker:${symbolsToSubscribe.join(",")}`;
            ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic, response: true }));
            symbolsToSubscribe.forEach(s => spotSubscriptions.current.add(s));
          };

          ws.onmessage = (event: MessageEvent) => {
            const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
            if (message.type === "message" && message.subject === "trade.ticker") {
              const tickerData = message.data;
              if (tickerData.price) {
                const price = parseFloat(tickerData.price);
                const symbol = message.topic.split(":")[1];
                if (!isNaN(price)) {
                  updatePositionPrice(symbol, price);
                }
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
          console.error("Spot WebSocket setup failed:", error);
          setSpotWsStatus("error");
        }
      };

      connect();
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
        }
        return;
      }

      const connect = async () => {
        if (futuresWs.current && futuresWs.current.readyState === WebSocket.OPEN) {
           symbolsToSubscribe.forEach(symbol => {
             if(!futuresSubscriptions.current.has(symbol)) {
                futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true }));
                futuresSubscriptions.current.add(symbol);
             }
           });
           return;
        }

        futuresWs.current?.close();
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
            futuresPingIntervalRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                 ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
              }
            }, instanceServers[0].pingInterval / 2);

            symbolsToSubscribe.forEach((symbol) => {
              ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/contractMarket/snapshot:${symbol}`, response: true }));
              futuresSubscriptions.current.add(symbol);
            });
          };

          ws.onmessage = (event: MessageEvent) => {
            const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
            if (message.type === "message" && message.subject === "snapshot") {
              const { symbol, lastPrice } = message.data;
              if (lastPrice) {
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
          console.error("Futures WebSocket setup failed:", error);
          setFuturesWsStatus("error");
        }
      };
      
      connect();
    },
    [updatePositionPrice]
  );
  
  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem("paperTrading_balance");
      const savedPositions = localStorage.getItem("paperTrading_positions");
      const savedHistory = localStorage.getItem("paperTrading_history");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) setOpenPositions(JSON.parse(savedPositions));
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("paperTrading_balance", JSON.stringify(balance));
      localStorage.setItem("paperTrading_positions", JSON.stringify(openPositions));
      localStorage.setItem("paperTrading_history", JSON.stringify(tradeHistory));

      const spotSymbols = openPositions.filter(p => p.positionType === 'spot').map(p => p.symbol);
      connectToSpot(spotSymbols);
      
      const futuresSymbols = openPositions.filter(p => p.positionType === 'futures').map(p => p.symbol);
      connectToFutures(futuresSymbols);
    }
  }, [balance, openPositions, tradeHistory, isLoaded, connectToSpot, connectToFutures]);

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
                  unrealizedPnl: 0,
              };
              return [...prev, newPosition];
          }
      });
      
      setBalance(prev => prev - amountUSD);
      setTradeHistory(prev => [{
        id: crypto.randomUUID(),
        positionId: 'N/A', // Spot trades don't need to link to a single position like this
        positionType: 'spot',
        symbol,
        symbolName,
        size,
        price: currentPrice,
        side: 'buy',
        timestamp: Date.now(),
        status: 'open', // This is a buy to open/add
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
          const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / positionToClose.leverage;
          returnedValue = collateral + pnl;
      }
      
      setBalance(prev => prev + returnedValue);
      setOpenPositions(prev => prev.filter(p => p.id !== positionId));
      setTradeHistory(prev => {
          const newHistory = [...prev];
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
          return [closingTrade, ...newHistory];
      });

      toast({ title: `Position Closed`, description: `Closed ${positionToClose.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });
  }, [toast]);
  
  const closeAllPositions = useCallback(() => {
    openPositionsRef.current.forEach(p => closePosition(p.id));
  }, [closePosition]);

  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    localStorage.removeItem("paperTrading_history");
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

    