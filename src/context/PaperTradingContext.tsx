
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { OpenPosition, PaperTrade, IncomingKucoinWebSocketMessage, KucoinTokenResponse } from '@/types';
import { useToast } from "@/hooks/use-toast";

const INITIAL_BALANCE = 100000;

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  buy: (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => void;
  sell: (symbol: string, sizeToSell: number, currentPrice: number) => void;
  updatePositionPrice: (symbol: string, newPrice: number) => void;
  wsStatus: string;
}

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(undefined);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');

  const ws = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
    setOpenPositions(prevPositions =>
      prevPositions.map(p =>
        p.symbol === symbol ? { ...p, currentPrice: newPrice } : p
      )
    );
  }, []);

  const subscribeToTickers = (symbols: string[]) => {
    if (ws.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      const topic = `/market/ticker:${symbols.join(',')}`;
      console.log('Subscribing to:', topic);
      ws.current.send(JSON.stringify({
        id: Date.now(),
        type: 'subscribe',
        topic: topic,
        privateChannel: false,
        response: true
      }));
    }
  };

  const unsubscribeFromTickers = (symbols: string[]) => {
    if (ws.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
       const topic = `/market/ticker:${symbols.join(',')}`;
       console.log('Unsubscribing from:', topic);
       ws.current.send(JSON.stringify({
        id: Date.now(),
        type: 'unsubscribe',
        topic: topic,
        privateChannel: false,
        response: true
      }));
    }
  };

  const connectWebSocket = useCallback(async (existingPositions: OpenPosition[]) => {
    if (ws.current) {
      ws.current.close();
    }
    setWsStatus('fetching_token');

    try {
      const res = await fetch('/api/kucoin-ws-token');
      const tokenData: KucoinTokenResponse = await res.json();
      
      if (tokenData.code !== "200000") {
        throw new Error('Failed to fetch KuCoin WebSocket token');
      }

      const { token, instanceServers } = tokenData.data;
      const endpoint = instanceServers[0].endpoint;
      const connectId = `tradeflow-${Date.now()}`;
      
      const wsUrl = `${endpoint}?token=${token}&connectId=${connectId}`;

      setWsStatus('connecting');
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setWsStatus('connected');
        console.log('KuCoin WebSocket connected.');

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
          }
        }, instanceServers[0].pingInterval / 2);

        // Subscribe to existing positions on new connection
        const symbols = existingPositions.map(p => p.symbol);
        if (symbols.length > 0) {
            subscribeToTickers(symbols);
        }
      };

      ws.current.onmessage = (event) => {
        const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
        if (message.type === 'message' && message.topic.startsWith('/market/ticker:')) {
          const symbol = message.topic.split(':')[1];
          const price = parseFloat(message.data.price);
          if (!isNaN(price)) {
            updatePositionPrice(symbol, price);
          }
        } else if (message.type === 'welcome') {
             setWsStatus('welcomed');
        } else if (message.type === 'pong') {
            // console.log('Pong received');
        }
      };

      ws.current.onclose = () => {
        setWsStatus('disconnected');
        console.log('KuCoin WebSocket disconnected.');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      };

      ws.current.onerror = (error) => {
        setWsStatus('error');
        console.error('KuCoin WebSocket error:', error);
        ws.current?.close();
      };

    } catch (error) {
      console.error('WebSocket connection setup failed:', error);
      setWsStatus('error');
    }
  }, [updatePositionPrice]);


  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem('paperTrading_balance');
      const savedPositions = localStorage.getItem('paperTrading_positions');
      const savedHistory = localStorage.getItem('paperTrading_history');
      
      let initialPositions: OpenPosition[] = [];
      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        initialPositions = JSON.parse(savedPositions);
        setOpenPositions(initialPositions);
      }
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));

      if(initialPositions.length > 0) {
          connectWebSocket(initialPositions);
      }

    } catch (error) {
      console.error("Failed to load from local storage", error);
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
    } finally {
        setIsLoaded(true);
    }
    
    return () => {
        ws.current?.close();
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    }
  }, [connectWebSocket]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('paperTrading_balance', JSON.stringify(balance));
      localStorage.setItem('paperTrading_positions', JSON.stringify(openPositions));
      localStorage.setItem('paperTrading_history', JSON.stringify(tradeHistory));
    } catch (error) {
      console.error("Failed to save to local storage", error);
    }
  }, [balance, openPositions, tradeHistory, isLoaded]);

  const buy = (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => {
    if (balance < amountUSD) {
      toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
      return;
    }
    const size = amountUSD / currentPrice;

    setBalance(prev => prev - amountUSD);

    const isNewPosition = !openPositions.some(p => p.symbol === symbol);

    setOpenPositions(prev => {
      const existingPosition = prev.find(p => p.symbol === symbol);
      if (existingPosition) {
        const totalSize = existingPosition.size + size;
        const totalCost = (existingPosition.averageEntryPrice * existingPosition.size) + amountUSD;
        return prev.map(p => p.symbol === symbol ? {
          ...p,
          size: totalSize,
          averageEntryPrice: totalCost / totalSize,
          currentPrice: currentPrice,
        } : p);
      } else {
        return [...prev, { symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice }];
      }
    });

    const newTrade: PaperTrade = {
      id: crypto.randomUUID(),
      symbol,
      symbolName,
      size,
      entryPrice: currentPrice,
      currentPrice,
      side: 'buy',
      timestamp: Date.now(),
      status: 'open',
    };
    setTradeHistory(prev => [newTrade, ...prev]);
    toast({ title: "Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName} for $${amountUSD.toFixed(2)}.` });
  
    // If it's the first position ever, establish connection. Otherwise, just subscribe.
    if(openPositions.length === 0 && isNewPosition){
        connectWebSocket([{ symbol, symbolName, size, averageEntryPrice: currentPrice, currentPrice }]);
    } else if (isNewPosition) {
       subscribeToTickers([symbol]);
    }
  };

  const sell = (symbol: string, sizeToSell: number, currentPrice: number) => {
    const position = openPositions.find(p => p.symbol === symbol);
    if (!position || position.size < sizeToSell) {
      toast({ title: "Error", description: "Insufficient position size to sell.", variant: "destructive" });
      return;
    }

    const sellValue = sizeToSell * currentPrice;
    setBalance(prev => prev + sellValue);

    const pnl = (currentPrice - position.averageEntryPrice) * sizeToSell;

    const remainingSize = position.size - sizeToSell;
    const isClosingPosition = remainingSize <= 0.000001; // Float comparison threshold

    setOpenPositions(prev => {
      if (isClosingPosition) {
        return prev.filter(p => p.symbol !== symbol);
      } else {
        return prev.map(p => p.symbol === symbol ? { ...p, size: remainingSize } : p);
      }
    });
    
    if (isClosingPosition) {
        unsubscribeFromTickers([symbol]);
        if (openPositions.length === 1) { // Last position is being closed
            ws.current?.close();
        }
    }

    const newTrade: PaperTrade = {
      id: crypto.randomUUID(),
      symbol: position.symbol,
      symbolName: position.symbolName,
      size: sizeToSell,
      entryPrice: position.averageEntryPrice,
      currentPrice: currentPrice,
      side: 'sell',
      timestamp: Date.now(),
      status: 'closed',
      pnl: pnl,
    };
    setTradeHistory(prev => [newTrade, ...prev]);

    toast({
        title: "Trade Executed",
        description: `Sold ${sizeToSell.toFixed(4)} ${position.symbolName}. P&L: $${pnl.toFixed(2)}`,
        variant: pnl >= 0 ? "default" : "destructive"
      });
  };

  const value = { balance, openPositions, tradeHistory, buy, sell, updatePositionPrice, wsStatus };

  return <PaperTradingContext.Provider value={value}>{children}</PaperTradingContext.Provider>;
};

export const usePaperTrading = (): PaperTradingContextType => {
  const context = useContext(PaperTradingContext);
  if (!context) {
    throw new Error('usePaperTrading must be used within a PaperTradingProvider');
  }
  return context;
};

    