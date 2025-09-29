
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { OpenPosition, PaperTrade, KucoinTokenResponse, IncomingKucoinFuturesWebSocketMessage } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useKucoinTickers } from '@/hooks/useKucoinAllTickersSocket'; // Import the spot ticker hook

const INITIAL_BALANCE = 100000;

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  buy: (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => void;
  futuresBuy: (symbol: string, collateral: number, entryPrice: number, leverage: number) => void;
  futuresSell: (symbol: string, collateral: number, entryPrice: number, leverage: number) => void;
  closePosition: (positionId: string) => void;
  updatePositionPrice: (symbol: string, newPrice: number) => void;
  futuresWsStatus: string;
}

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(undefined);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [futuresWsStatus, setFuturesWsStatus] = useState('idle');

  // Consume the spot tickers hook directly in the context
  const { tickers: spotTickers } = useKucoinTickers();

  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
    setOpenPositions(prevPositions =>
      prevPositions.map(p => {
        if (p.symbol === symbol) { // Match by symbol
            let unrealizedPnl = p.unrealizedPnl;
            if (p.positionType === 'spot') {
                unrealizedPnl = (newPrice - p.averageEntryPrice) * p.size;
            } else if (p.positionType === 'futures') {
                const pnlMultiplier = p.side === 'long' ? 1 : -1;
                unrealizedPnl = (newPrice - p.averageEntryPrice) * p.size * pnlMultiplier;
            }
          return { ...p, currentPrice: newPrice, unrealizedPnl };
        }
        return p;
      })
    );
  }, []);

  // Effect to update spot positions from the global spot tickers data
  useEffect(() => {
    if (spotTickers.length > 0 && openPositions.length > 0) {
        const openSpotPositions = openPositions.filter(p => p.positionType === 'spot');
        if (openSpotPositions.length > 0) {
            spotTickers.forEach(ticker => {
                if (ticker.last) {
                    // Check if there is an open position for this ticker
                    const positionExists = openSpotPositions.some(p => p.symbol === ticker.symbol);
                    if (positionExists) {
                        updatePositionPrice(ticker.symbol, parseFloat(ticker.last));
                    }
                }
            });
        }
    }
  }, [spotTickers, openPositions, updatePositionPrice]);


  const connectToFutures = useCallback(async (positionsToConnect: OpenPosition[]) => {
    const futuresSymbols = positionsToConnect.filter(p => p.positionType === 'futures').map(p => p.symbol);
    if (futuresSymbols.length === 0) return;

    if (futuresWs.current && futuresWs.current.readyState === WebSocket.OPEN) {
        futuresSymbols.forEach(symbol => {
             const topic = `/contractMarket/snapshot:${symbol}`;
             futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
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
        const wsUrl = `${instanceServers[0].endpoint}?token=${token}&connectId=cogmora-futures-${Date.now()}`;

        setFuturesWsStatus('connecting');
        futuresWs.current = new WebSocket(wsUrl);

        futuresWs.current.onopen = () => {
            setFuturesWsStatus('connected');
            if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
            futuresPingIntervalRef.current = setInterval(() => {
                futuresWs.current?.send(JSON.stringify({ id: Date.now().toString(), type: 'ping' }));
            }, instanceServers[0].pingInterval / 2);

            futuresSymbols.forEach(symbol => {
                const topic = `/contractMarket/snapshot:${symbol}`;
                futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic, response: true }));
            });
        };

        futuresWs.current.onmessage = (event) => {
            const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
            if (message.type === 'message' && message.topic.startsWith('/contractMarket/snapshot:')) {
                const symbol = message.data.symbol;
                const price = message.data.lastPrice;
                if (!isNaN(price)) {
                    updatePositionPrice(symbol, price);
                }
            }
        };

        futuresWs.current.onclose = () => setFuturesWsStatus('disconnected');
        futuresWs.current.onerror = () => setFuturesWsStatus('error');

    } catch (error) {
        console.error('Futures WebSocket setup failed:', error);
        setFuturesWsStatus('error');
    }
  }, [updatePositionPrice]);


  // --- DATA PERSISTENCE & Initial Connection ---
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

      // Only connect futures websocket for existing futures positions
      connectToFutures(initialPositions.filter(p => p.positionType === 'futures'));

    } catch (error) {
      console.error("Failed to load from local storage", error);
    } finally {
        setIsLoaded(true);
    }
    
    return () => {
        futuresWs.current?.close();
        if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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

  // --- TRADING LOGIC ---
  const buy = (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => {
    if (balance < amountUSD) {
      toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
      return;
    }

    const size = amountUSD / currentPrice;
    
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
    
    const newTrade: PaperTrade = {
      id: crypto.randomUUID(),
      positionId: newPosition.id,
      positionType: 'spot',
      symbol,
      symbolName,
      size,
      price: currentPrice,
      side: 'buy',
      timestamp: Date.now(),
      status: 'open',
    };
    
    setBalance(prev => prev - amountUSD);
    setOpenPositions(prev => [...prev, newPosition]);
    setTradeHistory(prev => [newTrade, ...prev]);

    toast({ title: "Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName} for $${amountUSD.toFixed(2)}.` });
  
  };

  const createFuturesTrade = (symbol: string, collateral: number, entryPrice: number, leverage: number, side: 'long' | 'short') => {
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

      toast({ title: "Futures Trade Executed", description: `Opened ${leverage}x ${side} position on ${newPosition.symbolName}.` });

      connectToFutures([newPosition]);
  };
  
  const futuresBuy = (symbol: string, collateral: number, entryPrice: number, leverage: number) => {
      createFuturesTrade(symbol, collateral, entryPrice, leverage, 'long');
  };

  const futuresSell = (symbol: string, collateral: number, entryPrice: number, leverage: number) => {
      createFuturesTrade(symbol, collateral, entryPrice, leverage, 'short');
  };

  const closePosition = (positionId: string) => {
    const position = openPositions.find(p => p.id === positionId);
    if (!position) {
      toast({ title: "Error", description: "Position not found.", variant: "destructive" });
      return;
    }
    
    const finalPnl = position.unrealizedPnl || 0;
    
    const valueToReturn = position.positionType === 'spot' 
        ? position.size * position.currentPrice
        : (position.size * position.averageEntryPrice) / position.leverage! + finalPnl;

    setBalance(prev => prev + valueToReturn);
    setOpenPositions(prev => prev.filter(p => p.id !== positionId));
    setTradeHistory(prev => prev.map(t => t.positionId === positionId ? { ...t, status: 'closed', pnl: finalPnl } : t));

    toast({
        title: "Position Closed",
        description: `Closed ${position.symbolName} position. Realized P&L: ${formatCurrency(finalPnl)}`,
        variant: finalPnl >= 0 ? "default" : "destructive"
      });

    if (position.positionType === 'futures' && futuresWs.current?.readyState === WebSocket.OPEN) {
        const topic = `/contractMarket/snapshot:${position.symbol}`;
        futuresWs.current.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic, response: true }));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const value = { balance, openPositions, tradeHistory, buy, futuresBuy, futuresSell, closePosition, updatePositionPrice, futuresWsStatus };

  return <PaperTradingContext.Provider value={value}>{children}</PaperTradingContext.Provider>;
};

export const usePaperTrading = (): PaperTradingContextType => {
  const context = useContext(PaperTradingContext);
  if (!context) {
    throw new Error('usePaperTrading must be used within a PaperTradingProvider');
  }
  return context;
};
