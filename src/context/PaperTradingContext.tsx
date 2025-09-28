
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { OpenPosition, PaperTrade } from '@/types';
import { useToast } from "@/hooks/use-toast";

const INITIAL_BALANCE = 100000;

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  buy: (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => void;
  sell: (symbol: string, sizeToSell: number, currentPrice: number) => void;
  updatePositionPrice: (symbol: string, newPrice: number) => void;
}

const PaperTradingContext = createContext<PaperTradingContextType | undefined>(undefined);

export const PaperTradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem('paperTrading_balance');
      const savedPositions = localStorage.getItem('paperTrading_positions');
      const savedHistory = localStorage.getItem('paperTrading_history');

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) setOpenPositions(JSON.parse(savedPositions));
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
    } catch (error) {
      console.error("Failed to load from local storage", error);
      // Reset to defaults if localStorage is corrupt
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
    } finally {
        setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial data is loaded
    try {
      localStorage.setItem('paperTrading_balance', JSON.stringify(balance));
      localStorage.setItem('paperTrading_positions', JSON.stringify(openPositions));
      localStorage.setItem('paperTrading_history', JSON.stringify(tradeHistory));
    } catch (error) {
      console.error("Failed to save to local storage", error);
    }
  }, [balance, openPositions, tradeHistory, isLoaded]);

  const updatePositionPrice = useCallback((symbol: string, newPrice: number) => {
    setOpenPositions(prevPositions =>
      prevPositions.map(p =>
        p.symbol === symbol ? { ...p, currentPrice: newPrice } : p
      )
    );
  }, []);

  const buy = (symbol: string, symbolName: string, amountUSD: number, currentPrice: number) => {
    if (balance < amountUSD) {
      toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
      return;
    }
    const size = amountUSD / currentPrice;

    setBalance(prev => prev - amountUSD);

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

    setOpenPositions(prev => {
      const remainingSize = position.size - sizeToSell;
      if (remainingSize <= 0.000001) { // Use a small threshold for float comparison
        return prev.filter(p => p.symbol !== symbol);
      } else {
        return prev.map(p => p.symbol === symbol ? { ...p, size: remainingSize } : p);
      }
    });

    const newTrade: PaperTrade = {
      id: crypto.randomUUID(),
      symbol: position.symbol,
      symbolName: position.symbolName,
      size: sizeToSell,
      entryPrice: position.averageEntryPrice, // Historical entry for this portion
      currentPrice: currentPrice, // Exit price
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

  const value = { balance, openPositions, tradeHistory, buy, sell, updatePositionPrice };

  return <PaperTradingContext.Provider value={value}>{children}</PaperTradingContext.Provider>;
};

export const usePaperTrading = (): PaperTradingContextType => {
  const context = useContext(PaperTradingContext);
  if (!context) {
    throw new Error('usePaperTrading must be used within a PaperTradingProvider');
  }
  return context;
};
