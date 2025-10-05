

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
  TradeTrigger,
  SpotSnapshotData,
  KucoinSnapshotDataWrapper,
  KucoinFuturesContract,
  AutomationConfig,
  KucoinTicker,
} from "@/types";
import { useToast } from "@/hooks/use-toast";

const INITIAL_BALANCE = 100000;
const INITIAL_AUTOMATION_CONFIG: AutomationConfig = {
  rules: [{ id: 'default', source: 'spot', criteria: 'top_volume', count: 10 }],
  updateMode: 'one-time',
  refreshInterval: 900000, // 15 minutes
  clearExisting: true,
};

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  watchlist: WatchlistItem[];
  priceAlerts: Record<string, PriceAlert>;
  tradeTriggers: TradeTrigger[];
  toggleWatchlist: (symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number) => void;
  addPriceAlert: (symbol: string, price: number, condition: 'above' | 'below') => void;
  removePriceAlert: (symbol: string) => void;
  addTradeTrigger: (trigger: Omit<TradeTrigger, 'id' | 'status'>) => void;
  removeTradeTrigger: (triggerId: string) => void;
  buy: (
    symbol: string,
    symbolName: string,
    amountUSD: number,
    currentPrice: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string,
    priceChgPct?: number,
  ) => void;
  futuresBuy: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string,
    priceChgPct?: number,
  ) => void;
  futuresSell: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string,
    priceChgPct?: number,
  ) => void;
  closePosition: (positionId: string, reason?: string, closePrice?: number) => void;
  updatePositionSlTp: (positionId: string, sl?: number, tp?: number) => void;
  closeAllPositions: () => void;
  clearHistory: () => void;
  spotWsStatus: string;
  futuresWsStatus: string;
  automationConfig: AutomationConfig;
  setAutomationConfig: (config: AutomationConfig) => void;
  applyWatchlistAutomation: (config: AutomationConfig, forceScrape?: boolean) => void;
  nextScrapeTime: number;
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
  const [tradeTriggers, setTradeTriggers] = useState<TradeTrigger[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [futuresContracts, setFuturesContracts] = useState<KucoinFuturesContract[]>([]);
  const [automationConfig, setAutomationConfigInternal] = useState<AutomationConfig>(INITIAL_AUTOMATION_CONFIG);
  const [nextScrapeTime, setNextScrapeTime] = useState<number>(0);


  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptionsRef = useRef<Set<string>>(new Set());

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresSubscriptionsRef = useRef<Set<string>>(new Set());

  const notifiedAlerts = useRef(new Set());
  const prevWatchlistRef = useRef<WatchlistItem[]>([]);
  const automationIntervalRef = useRef<NodeJS.Timeout | null>(null);


  // Load from local storage on mount
  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem("paperTrading_balance");
      const savedPositions = localStorage.getItem("paperTrading_positions");
      const savedHistory = localStorage.getItem("paperTrading_history");
      const savedWatchlist = localStorage.getItem("paperTrading_watchlist");
      const savedAlerts = localStorage.getItem("paperTrading_priceAlerts");
      const savedTriggers = localStorage.getItem("paperTrading_tradeTriggers");
      const savedAutomation = localStorage.getItem("paperTrading_automationConfig");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) setOpenPositions(JSON.parse(savedPositions));
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
      if (savedWatchlist) {
        const parsedWatchlist = JSON.parse(savedWatchlist);
        setWatchlist(parsedWatchlist);
        prevWatchlistRef.current = parsedWatchlist;
      }
      if (savedAlerts) setPriceAlerts(JSON.parse(savedAlerts));
      if (savedTriggers) setTradeTriggers(JSON.parse(savedTriggers));
      if (savedAutomation) {
          const config = JSON.parse(savedAutomation);
          setAutomationConfigInternal(config);
          // If it was auto-refreshing, re-initiate the timer logic
          if(config.updateMode === 'auto-refresh') {
            const lastScrape = localStorage.getItem('paperTrading_lastScrapeTime');
            const lastScrapeTime = lastScrape ? parseInt(lastScrape, 10) : Date.now();
            const timeSinceLast = Date.now() - lastScrapeTime;
            const remainingTime = config.refreshInterval - timeSinceLast;
            setNextScrapeTime(Date.now() + Math.max(0, remainingTime));
          }
      }

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      setBalance(INITIAL_BALANCE);
      setOpenPositions([]);
      setTradeHistory([]);
      setWatchlist([]);
      setPriceAlerts({});
      setTradeTriggers([]);
      setAutomationConfigInternal(INITIAL_AUTOMATION_CONFIG);
    }
    
    const fetchInitialData = async () => {
        try {
            const futuresResponse = await fetch("/api/kucoin-futures-tickers");
            if (futuresResponse.ok) {
                const futuresData = await futuresResponse.json();
                if (futuresData && futuresData.code === "200000" && futuresData.data) {
                    setFuturesContracts(futuresData.data);
                }
            }
        } catch (error) {
            console.error("Error fetching initial futures contracts data:", error);
        }
    };

    fetchInitialData();
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
      localStorage.setItem("paperTrading_tradeTriggers", JSON.stringify(tradeTriggers));
      localStorage.setItem("paperTrading_automationConfig", JSON.stringify(automationConfig));
    }
  }, [balance, openPositions, tradeHistory, isLoaded, watchlist, priceAlerts, tradeTriggers, automationConfig]);
  
    // Effect for showing price alert toasts
  useEffect(() => {
    Object.entries(priceAlerts).forEach(([symbol, alert]) => {
      if (alert.triggered && !notifiedAlerts.current.has(symbol)) {
        const watchlistItem = watchlist.find(item => item.symbol === symbol);
        toast({
          title: "Price Alert Triggered!",
          description: `${watchlistItem?.symbolName || symbol} has reached your alert price of ${alert.price}.`,
        });
        notifiedAlerts.current.add(symbol); // Mark as notified
      }
    });
  }, [priceAlerts, watchlist, toast]);

    // Effect for showing watchlist add/remove toasts
  useEffect(() => {
      if (!isLoaded) return;

      const prevSymbols = new Set(prevWatchlistRef.current.map(item => item.symbol));
      const currentSymbols = new Set(watchlist.map(item => item.symbol));

      // Check for added items
      watchlist.forEach(item => {
          if (!prevSymbols.has(item.symbol)) {
              toast({ title: 'Watchlist', description: `${item.symbolName} added to watchlist.` });
          }
      });

      // Check for removed items
      prevWatchlistRef.current.forEach(item => {
          if (!currentSymbols.has(item.symbol)) {
              toast({ title: 'Watchlist', description: `${item.symbolName} removed from watchlist.` });
          }
      });

      prevWatchlistRef.current = watchlist;
  }, [watchlist, isLoaded, toast]);
  
  const applyWatchlistAutomation = useCallback(async (config: AutomationConfig, forceScrape: boolean = false) => {
    if (forceScrape) {
      toast({ title: 'Automation Running', description: 'Fetching screener data to build watchlist...' });
    }

    try {
        const spotResponse = await fetch("/api/kucoin-tickers");
        const spotData = await spotResponse.json();
        const allSpotTickers: KucoinTicker[] = (spotData?.data?.ticker || []).filter((t: KucoinTicker) => t.symbol.endsWith('-USDT'));
        
        if (!allSpotTickers.length && !futuresContracts.length) {
            throw new Error('Could not fetch any screener data.');
        }

        let finalItems: WatchlistItem[] = [];
        const addedSymbols = new Set<string>();

        config.rules.forEach(rule => {
            let sourceData: (KucoinTicker | KucoinFuturesContract)[] = [];
            let sortKey: 'volValue' | 'changeRate' | 'volumeOf24h' | 'priceChgPct' = 'volValue';

            if (rule.source === 'spot') {
                sourceData = allSpotTickers;
                sortKey = rule.criteria.includes('volume') ? 'volValue' : 'changeRate';
            } else {
                sourceData = futuresContracts;
                sortKey = rule.criteria.includes('volume') ? 'volumeOf24h' : 'priceChgPct';
            }

            const sorted = [...sourceData].sort((a, b) => {
                const valA = parseFloat(a[sortKey as keyof typeof a] as string) || 0;
                const valB = parseFloat(b[sortKey as keyof typeof b] as string) || 0;
                return valB - valA;
            });

            let selected: (KucoinTicker | KucoinFuturesContract)[] = [];
            if (rule.criteria.startsWith('top')) {
                selected = sorted.slice(0, rule.count);
            } else { // bottom
                selected = sorted.slice(-rule.count);
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
                    });
                }
            });
        });

        setWatchlist(prev => config.clearExisting ? finalItems : [...prev, ...finalItems.filter(f => !prev.some(p => p.symbol === f.symbol))]);
        
        if (config.updateMode === 'auto-refresh') {
            localStorage.setItem('paperTrading_lastScrapeTime', Date.now().toString());
            setNextScrapeTime(Date.now() + config.refreshInterval);
        }
        
        if (forceScrape) {
          toast({ title: 'Watchlist Updated', description: `Watchlist has been updated based on your automation rules.`});
        }
    } catch(error) {
      console.error('Watchlist automation failed:', error);
      if (forceScrape) {
        toast({ title: 'Automation Failed', description: 'Could not fetch screener data.', variant: 'destructive'});
      }
    }
  }, [toast, futuresContracts]);

  const setAutomationConfig = useCallback((config: AutomationConfig) => {
    setAutomationConfigInternal(config);
    if (config.updateMode === 'auto-refresh') {
        localStorage.setItem('paperTrading_lastScrapeTime', Date.now().toString());
        setNextScrapeTime(Date.now() + config.refreshInterval);
        toast({ title: 'Automation Saved', description: `Watchlist will auto-refresh every ${config.refreshInterval / 60000} minutes.` });
    } else {
        setNextScrapeTime(0);
        if (automationIntervalRef.current) {
          clearInterval(automationIntervalRef.current);
        }
        toast({ title: 'Automation Saved', description: `Watchlist auto-refresh has been disabled.` });
    }
  }, [toast]);


  // Effect for Auto-Refresh Automation
  useEffect(() => {
    if (automationIntervalRef.current) {
        clearInterval(automationIntervalRef.current);
    }
    if (automationConfig.updateMode === 'auto-refresh' && automationConfig.refreshInterval > 0) {
        const runAutomation = () => applyWatchlistAutomation(automationConfig, true);
        
        const lastScrapeTime = parseInt(localStorage.getItem('paperTrading_lastScrapeTime') || '0', 10);
        const timeSinceLast = Date.now() - lastScrapeTime;
        const initialDelay = Math.max(0, automationConfig.refreshInterval - timeSinceLast);

        const timeoutId = setTimeout(() => {
          runAutomation(); // Run first scrape after initial delay
          automationIntervalRef.current = setInterval(runAutomation, automationConfig.refreshInterval);
        }, initialDelay);
        
        return () => {
          clearTimeout(timeoutId);
          if (automationIntervalRef.current) {
            clearInterval(automationIntervalRef.current);
          }
        };
    }
  }, [automationConfig, applyWatchlistAutomation]);


  const checkPriceAlerts = useCallback((symbol: string, newPrice: number) => {
    setPriceAlerts(prev => {
      const alert = prev[symbol];
      if (!alert || alert.triggered) return prev;

      const conditionMet = 
        (alert.condition === 'above' && newPrice >= alert.price) ||
        (alert.condition === 'below' && newPrice <= alert.price);
      
      if (conditionMet) {
        return { ...prev, [symbol]: { ...alert, triggered: true } };
      }
      
      return prev;
    });
  }, []);

  const buy = useCallback(
    (
      symbol: string,
      symbolName: string,
      amountUSD: number,
      currentPrice: number,
      stopLoss?: number,
      takeProfit?: number,
      triggeredBy = 'manual',
      priceChgPct?: number,
    ) => {
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
              if (stopLoss) existing.details.stopLoss = stopLoss;
              if (takeProfit) existing.details.takeProfit = takeProfit;
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
                  priceChgPct: priceChgPct,
                  details: { stopLoss, takeProfit, triggeredBy },
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

  const futuresBuy = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy = 'manual',
    priceChgPct?: number,
  ) => {
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 - (1 / leverage));


      const newPosition: OpenPosition = {
          id: crypto.randomUUID(),
          positionType: "futures",
          symbol,
          symbolName: symbol.replace(/M$/, ""),
          size,
          averageEntryPrice: entryPrice,
          currentPrice: entryPrice,
          side: "long",
          leverage,
          liquidationPrice,
          unrealizedPnl: 0,
          priceChgPct,
          details: { stopLoss, takeProfit, triggeredBy },
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
          side: "long",
          leverage,
          timestamp: Date.now(),
          status: "open",
      }, ...prev]);

      toast({ title: "Futures Trade Executed", description: `LONG ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast]);

  const futuresSell = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy = 'manual',
    priceChgPct?: number,
  ) => {
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 + (1 / leverage));

      const newPosition: OpenPosition = {
          id: crypto.randomUUID(),
          positionType: "futures",
          symbol,
          symbolName: symbol.replace(/M$/, ""),
          size,
          averageEntryPrice: entryPrice,
          currentPrice: entryPrice,
          side: "short",
          leverage,
          liquidationPrice,
          unrealizedPnl: 0,
          priceChgPct,
          details: { stopLoss, takeProfit, triggeredBy },
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
          side: "short",
          leverage,
          timestamp: Date.now(),
          status: "open",
      }, ...prev]);

      toast({ title: "Futures Trade Executed", description: `SHORT ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast]);
  
  const executeTrigger = useCallback((trigger: TradeTrigger, currentPrice: number) => {
    toast({
      title: 'Trade Trigger Executed!',
      description: `Executing ${trigger.action} for ${trigger.symbolName} at ${currentPrice.toFixed(4)}`
    });

    const triggeredBy = `trigger:${trigger.condition}`;
    const watchlistItem = watchlist.find(item => item.symbol === trigger.symbol);
    const priceChgPct = watchlistItem?.priceChgPct;
    const symbolName = trigger.type === 'spot' ? trigger.symbolName : trigger.symbolName.replace(/M$/, "");

    if (trigger.type === 'spot') {
      buy(trigger.symbol, symbolName, trigger.amount, currentPrice, trigger.stopLoss, trigger.takeProfit, triggeredBy, priceChgPct);
    } else if (trigger.type === 'futures') {
      if (trigger.action === 'long') {
        futuresBuy(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, triggeredBy, priceChgPct);
      } else {
        futuresSell(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, triggeredBy, priceChgPct);
      }
    }
  }, [toast, buy, futuresBuy, futuresSell, watchlist]);

  const checkTradeTriggers = useCallback((symbol: string, newPrice: number) => {
    let executedTriggerIds = new Set<string>();
    let cancelSymbols = new Set<string>();
  
    setTradeTriggers(prevTriggers => {
      const activeTriggers = prevTriggers.filter(t => t.status === 'active' && t.symbol === symbol);
  
      activeTriggers.forEach(trigger => {
        if (executedTriggerIds.has(trigger.id)) return; // Already processed
        
        const conditionMet =
          (trigger.condition === 'above' && newPrice >= trigger.targetPrice) ||
          (trigger.condition === 'below' && newPrice <= trigger.targetPrice);
  
        if (conditionMet) {
          executeTrigger(trigger, newPrice);
          executedTriggerIds.add(trigger.id);
          if (trigger.cancelOthers) {
            cancelSymbols.add(trigger.symbol);
          }
        }
      });
  
      if (executedTriggerIds.size === 0) return prevTriggers;
  
      return prevTriggers.filter(t => {
        if (executedTriggerIds.has(t.id)) return false; // Remove executed
        if (cancelSymbols.has(t.symbol) && !executedTriggerIds.has(t.id)) return false; // Remove other triggers for the same symbol
        return true;
      });
    });
  }, [executeTrigger]);
  
  const closePosition = useCallback((positionId: string, reason: string = 'Manual Close', closePrice?: number) => {
    setOpenPositions(prev => {
        const positionToClose = prev.find(p => p.id === positionId);
        if (!positionToClose) return prev;

        const exitPrice = closePrice !== undefined ? closePrice : positionToClose.currentPrice;
        let pnl = 0;
        let returnedValue = 0;

        if (reason === 'Position Liquidated') {
            const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / (positionToClose.leverage || 1);
            pnl = -collateral;
            returnedValue = 0; // The entire collateral is lost.
        } else if (positionToClose.positionType === 'spot') {
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
        
        toast({ title: `${reason}: Position Closed`, description: `Closed ${positionToClose.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });

        return prev.filter(p => p.id !== positionId);
    });
  }, [toast]);
  
  useEffect(() => {
    if (!isLoaded) return;
  
    const positionsToProcess: { id: string; reason: string; price: number }[] = [];
  
    openPositions.forEach(position => {
      const { id, details, currentPrice, side, liquidationPrice } = position;
  
      // Check for liquidation first
      if (position.positionType === 'futures' && liquidationPrice !== undefined) {
          if ((side === 'long' && currentPrice <= liquidationPrice) || (side === 'short' && currentPrice >= liquidationPrice)) {
              positionsToProcess.push({ id, reason: 'Position Liquidated', price: liquidationPrice });
              return; // Stop processing this position if it's liquidated
          }
      }

      if (!details) return;
      const { stopLoss, takeProfit } = details;
  
      if (stopLoss !== undefined) {
        if ((side === 'buy' && currentPrice <= stopLoss) || (side === 'long' && currentPrice <= stopLoss) || (side === 'short' && currentPrice >= stopLoss)) {
          positionsToProcess.push({ id, reason: 'Stop Loss Hit', price: stopLoss });
          return; // Stop checking this position if SL is hit
        }
      }
  
      if (takeProfit !== undefined) {
        if ((side === 'buy' && currentPrice >= takeProfit) || (side === 'long' && currentPrice >= takeProfit) || (side === 'short' && currentPrice <= takeProfit)) {
          positionsToProcess.push({ id, reason: 'Take Profit Hit', price: takeProfit });
        }
      }
    });
  
    if (positionsToProcess.length > 0) {
      // Use a timeout to ensure this runs after the current render cycle
      setTimeout(() => {
        positionsToProcess.forEach(p => closePosition(p.id, p.reason, p.price));
      }, 0);
    }
  }, [openPositions, isLoaded, closePosition]);


  const updatePositionSlTp = useCallback((positionId: string, sl?: number, tp?: number) => {
    let symbolName = '';
    setOpenPositions(prev =>
      prev.map(pos => {
        if (pos.id === positionId) {
          symbolName = pos.symbolName;
          return {
            ...pos,
            details: {
              ...pos.details,
              stopLoss: sl,
              takeProfit: tp,
            }
          };
        }
        return pos;
      })
    );
    if (symbolName) {
      toast({
        title: "Position Updated",
        description: `SL/TP updated for ${symbolName}.`
      });
    }
  }, [toast]);

  
  const processUpdate = useCallback((symbol: string, isSpot: boolean, data: Partial<SpotSnapshotData | FuturesSnapshotData>) => {
    let newPrice: number | undefined, high: number | undefined, low: number | undefined, priceChgPct: number | undefined;

    if (isSpot) {
      const spotData = data as SpotSnapshotData;
      newPrice = spotData.lastTradedPrice;
      high = spotData.high ?? undefined;
      low = spotData.low ?? undefined;
      priceChgPct = spotData.changeRate ?? undefined;
    } else { // Futures
      const futuresData = data as any; 
      newPrice = parseFloat(futuresData.lastPrice || '0');
      high = futuresData.highPrice ? parseFloat(futuresData.highPrice) : undefined;
      low = futuresData.lowPrice ? parseFloat(futuresData.lowPrice) : undefined;
      priceChgPct = futuresData.priceChgPct ? parseFloat(futuresData.priceChgPct) : undefined;
    }
    
    if (newPrice === undefined || isNaN(newPrice) || newPrice === 0) return;

    checkPriceAlerts(symbol, newPrice);
    checkTradeTriggers(symbol, newPrice);

    setWatchlist(prev => prev.map(item =>
        item.symbol === symbol ? {
          ...item,
          currentPrice: newPrice ?? item.currentPrice,
          high: high ?? item.high,
          low: low ?? item.low,
          priceChgPct: priceChgPct ?? item.priceChgPct,
          snapshotData: (isSpot && item.type === 'spot') ? (data as SpotSnapshotData) : item.snapshotData,
        } : item
    ));

    setOpenPositions((prevPositions) => 
      prevPositions.map((p) => {
        if (p.symbol === symbol) {
          let unrealizedPnl = 0;
          if (p.positionType === "spot") {
            unrealizedPnl = (newPrice! - p.averageEntryPrice) * p.size;
          } else if (p.positionType === "futures") {
            const pnlMultiplier = p.side === "long" ? 1 : -1;
            unrealizedPnl = (newPrice! - p.averageEntryPrice) * p.size * pnlMultiplier;
          }
          return { ...p, currentPrice: newPrice!, unrealizedPnl, priceChgPct: priceChgPct ?? p.priceChgPct };
        }
        return p;
      })
    );
  }, [checkPriceAlerts, checkTradeTriggers]);
  
  const connectToSpot = useCallback(
    (symbolsToSubscribe: string[]) => {
      setSpotWsStatus("fetching_token");
      fetch("/api/kucoin-ws-token", { method: 'POST' }).then(res => res.json()).then((tokenData: KucoinTokenResponse) => {
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

          symbolsToSubscribe.forEach((symbol) => {
             ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/market/snapshot:${symbol}`, response: true }));
          });
          spotSubscriptionsRef.current = new Set(symbolsToSubscribe);
        };

        ws.onmessage = (event: MessageEvent) => {
          const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
          if (message.type === "message" && message.subject === "trade.snapshot") {
            const wrapper = message.data as KucoinSnapshotDataWrapper;
            const symbol = message.topic.split(":")[1];
            processUpdate(symbol, true, wrapper.data);
          }
        };

        ws.onclose = () => {
          setSpotWsStatus("disconnected");
          if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
          spotWs.current = null;
          spotSubscriptionsRef.current.clear();
        };

        ws.onerror = (e) => {
          console.error("Spot WS Error", e);
          setSpotWsStatus("error");
          ws.close();
        };
      }).catch(error => {
        console.error("Spot Connection failed", error);
        setSpotWsStatus("error");
      });
    },
    [processUpdate]
  );
  
  const connectToFutures = useCallback(
    (symbolsToSubscribe: string[]) => {
      setFuturesWsStatus("fetching_token");
      fetch("/api/kucoin-futures-ws-token", { method: "POST" }).then(res => res.json()).then((tokenData: KucoinTokenResponse) => {
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
          futuresSubscriptionsRef.current = new Set(symbolsToSubscribe);
        };

        ws.onmessage = (event: MessageEvent) => {
          const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
          if (message.type === "message" && message.subject === 'snapshot.24h') {
            processUpdate(message.data.symbol, false, message.data as any);
          }
        };

        ws.onclose = () => {
          setFuturesWsStatus("disconnected");
          if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
          futuresWs.current = null;
          futuresSubscriptionsRef.current.clear();
        };

        ws.onerror = () => {
          setFuturesWsStatus("error");
          ws.close();
        };

      }).catch(error => {
        setFuturesWsStatus("error");
      });
    },
    [processUpdate]
  );

  const spotPositionSymbols = useMemo(() => openPositions.filter(p => p.positionType === 'spot').map(p => p.symbol), [openPositions]);
  const futuresPositionSymbols = useMemo(() => openPositions.filter(p => p.positionType === 'futures').map(p => p.symbol), [openPositions]);

  const spotWatchlistSymbols = useMemo(() => watchlist.filter(item => item.type === 'spot').map(item => item.symbol), [watchlist]);
  const futuresWatchlistSymbols = useMemo(() => watchlist.filter(item => item.type === 'futures').map(item => item.symbol), [watchlist]);
  
  const spotTriggerSymbols = useMemo(() => tradeTriggers.filter(t => t.type === 'spot').map(t => t.symbol), [tradeTriggers]);
  const futuresTriggerSymbols = useMemo(() => tradeTriggers.filter(t => t.type === 'futures').map(t => t.symbol), [tradeTriggers]);

  const allSpotSymbols = useMemo(() => Array.from(new Set([...spotPositionSymbols, ...spotWatchlistSymbols, ...spotTriggerSymbols])), [spotPositionSymbols, spotWatchlistSymbols, spotTriggerSymbols]);
  const allFuturesSymbols = useMemo(() => Array.from(new Set([...futuresPositionSymbols, ...futuresWatchlistSymbols, ...futuresTriggerSymbols])), [futuresPositionSymbols, futuresWatchlistSymbols, futuresTriggerSymbols]);
  
  
  // Effect to manage Spot WebSocket connection
  useEffect(() => {
    if (!isLoaded) return;
    const requiredSubs = new Set(allSpotSymbols);
    
    if (requiredSubs.size === 0) {
        if (spotWs.current) spotWs.current.close();
        return;
    }

    if (!spotWs.current || spotWs.current.readyState === WebSocket.CLOSED) {
        connectToSpot(Array.from(requiredSubs));
        return;
    }

    if (spotWs.current.readyState === WebSocket.OPEN) {
        const currentSubs = spotSubscriptionsRef.current;
        const symbolsToUnsub = [...currentSubs].filter(s => !requiredSubs.has(s));
        const symbolsToSub = [...requiredSubs].filter(s => !currentSubs.has(s));

        symbolsToUnsub.forEach(symbol => spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/market/snapshot:${symbol}`})));
        symbolsToSub.forEach(symbol => spotWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/snapshot:${symbol}`, response: true })));
        
        spotSubscriptionsRef.current = requiredSubs;
    }
  }, [isLoaded, allSpotSymbols, connectToSpot]);

  // Effect to manage Futures WebSocket connection
  useEffect(() => {
    if (!isLoaded) return;
    if (allFuturesSymbols.length === 0) {
        if (futuresWs.current) futuresWs.current.close();
        return;
    }

    if (!futuresWs.current || futuresWs.current.readyState === WebSocket.CLOSED) {
        connectToFutures(allFuturesSymbols);
        return;
    }

    if (futuresWs.current.readyState === WebSocket.OPEN) {
        const currentSubs = futuresSubscriptionsRef.current;
        const requiredSubs = new Set(allFuturesSymbols);
        const symbolsToUnsub = [...currentSubs].filter(s => !requiredSubs.has(s));
        const symbolsToSub = [...requiredSubs].filter(s => !currentSubs.has(s));

        symbolsToUnsub.forEach(symbol => futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'unsubscribe', topic: `/contractMarket/snapshot:${symbol}`})));
        symbolsToSub.forEach(symbol => futuresWs.current?.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/contractMarket/snapshot:${symbol}`, response: true })));

        futuresSubscriptionsRef.current = requiredSubs;
    }
  }, [isLoaded, allFuturesSymbols, connectToFutures]);
  
  
  const closeAllPositions = useCallback(() => {
    const positionsToClose = [...openPositions]; // Create a snapshot
    positionsToClose.forEach(p => {
        // Pass the most up-to-date price for accurate PNL
        const currentPositionState = openPositions.find(op => op.id === p.id);
        const closePrice = currentPositionState ? currentPositionState.currentPrice : p.currentPrice;
        closePosition(p.id, 'Manual Close All', closePrice);
    });
  }, [openPositions, closePosition]);

  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
  }, [toast]);

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number) => {
    setWatchlist(prev => {
        const existingIndex = prev.findIndex(item => item.symbol === symbol);
        if (existingIndex > -1) {
            return prev.filter(item => item.symbol !== symbol);
        } else {
            const newItem: WatchlistItem = { symbol, symbolName, type, currentPrice: 0, high, low, priceChgPct };
            
            if (type === 'spot' && futuresContracts.length > 0) {
                const baseCurrency = symbolName.split('-')[0]; 
                const futuresEquivalent = futuresContracts.find(c => c.baseCurrency === baseCurrency);
                if (futuresEquivalent) {
                    newItem.futuresSymbol = futuresEquivalent.symbol;
                    newItem.hasFutures = true;
                }
            }

            return [newItem, ...prev];
        }
    });
}, [futuresContracts]);

  const addPriceAlert = useCallback((symbol: string, price: number, condition: 'above' | 'below') => {
    const newAlert: PriceAlert = { price, condition, triggered: false, notified: false };
    setPriceAlerts(prev => ({ ...prev, [symbol]: newAlert }));
    toast({ title: 'Alert Set', description: `Alert set for ${symbol} when price is ${condition} ${price}.` });
    notifiedAlerts.current.delete(symbol);
  }, [toast]);

  const removePriceAlert = useCallback((symbol: string) => {
    setPriceAlerts(prev => {
      const { [symbol]: _, ...rest } = prev;
      return rest;
    });
    notifiedAlerts.current.delete(symbol);
    toast({ title: 'Alert Removed', description: `Alert for ${symbol} removed.` });
  }, [toast]);
  
  const addTradeTrigger = useCallback((trigger: Omit<TradeTrigger, 'id' | 'status'>) => {
    const newTrigger: TradeTrigger = {
      ...trigger,
      id: crypto.randomUUID(),
      status: 'active',
    };
    
    let executedInstantly = false;
    
    const watchlistItem = watchlist.find(item => item.symbol === newTrigger.symbol);
    const currentPrice = watchlistItem?.currentPrice;
    if (currentPrice) {
        const conditionMet =
            (newTrigger.condition === 'above' && currentPrice >= newTrigger.targetPrice) ||
            (newTrigger.condition === 'below' && currentPrice <= newTrigger.targetPrice);

        if (conditionMet) {
            executeTrigger(newTrigger, currentPrice);
            executedInstantly = true;
            if (newTrigger.cancelOthers) {
                setTradeTriggers(prev => prev.filter(t => t.symbol !== newTrigger.symbol));
            }
        }
    }

    if (!executedInstantly) {
        setTradeTriggers(prev => {
           const newTriggers = [newTrigger, ...prev];
           toast({ title: 'Trade Trigger Set', description: `Trigger set for ${trigger.symbolName}.` });
           return newTriggers;
        });
    }
  }, [watchlist, executeTrigger, toast]);

  const removeTradeTrigger = useCallback((triggerId: string) => {
    setTradeTriggers(prev => prev.filter(t => t.id !== triggerId));
    toast({ title: 'Trade Trigger Removed' });
  }, [toast]);
  

  return (
    <PaperTradingContext.Provider
      value={{
        balance,
        openPositions,
        tradeHistory,
        watchlist,
        priceAlerts,
        tradeTriggers,
        toggleWatchlist,
        addPriceAlert,
        removePriceAlert,
        addTradeTrigger,
        removeTradeTrigger,
        buy,
        futuresBuy,
        futuresSell,
        closePosition,
        updatePositionSlTp,
        closeAllPositions,
        clearHistory,
        spotWsStatus,
        futuresWsStatus,
        automationConfig,
        setAutomationConfig,
        applyWatchlistAutomation,
        nextScrapeTime,
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
