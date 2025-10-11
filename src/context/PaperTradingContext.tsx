
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
  AiTriggerSettings,
  KucoinTicker,
  FuturesSnapshotData,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { proposeTradeTriggers } from "@/ai/flows/propose-trade-triggers-flow";


const INITIAL_BALANCE = 100000;
const INITIAL_AUTOMATION_CONFIG: AutomationConfig = {
  rules: [{ id: 'default', source: 'spot', criteria: 'top_volume', count: 10 }],
  updateMode: 'one-time',
  refreshInterval: 900000, // 15 minutes
  clearExisting: true,
};
const INITIAL_AI_SETTINGS: AiTriggerSettings = {
  instructions: '',
  setSlTp: true,
  scheduleInterval: null,
  autoExecute: false,
  justCreate: false,
  justUpdate: false,
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
  updateTradeTrigger: (triggerId: string, updates: Partial<TradeTrigger>) => void;
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
  aiSettings: AiTriggerSettings;
  setAiSettings: (settings: AiTriggerSettings) => void;
  handleAiTriggerAnalysis: (isScheduled?: boolean) => Promise<any>;
  nextAiScrapeTime: number;
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

  const [aiSettings, setAiSettingsInternal] = useState<AiTriggerSettings>(INITIAL_AI_SETTINGS);
  const [nextAiScrapeTime, setNextAiScrapeTime] = useState(0);

  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptionsRef = useRef<Set<string>>(new Set());

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresSubscriptionsRef = useRef<Set<string>>(new Set());

  const notifiedAlerts = useRef(new Set());
  const automationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiAutomationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [prevOpenPositions, setPrevOpenPositions] = useState<OpenPosition[]>([]);

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
      const savedAiSettings = localStorage.getItem("paperTrading_aiSettings");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        const parsedPositions = JSON.parse(savedPositions);
        setOpenPositions(parsedPositions);
        setPrevOpenPositions(parsedPositions);
      }
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
      if (savedWatchlist) {
        const parsedWatchlist = JSON.parse(savedWatchlist);
        setWatchlist(parsedWatchlist);
      }
      if (savedAlerts) setPriceAlerts(JSON.parse(savedAlerts));
      if (savedTriggers) setTradeTriggers(JSON.parse(savedTriggers));
      if (savedAutomation) {
          const config = JSON.parse(savedAutomation);
          setAutomationConfigInternal(config);
      }
      if (savedAiSettings) {
          const settings = JSON.parse(savedAiSettings);
          setAiSettingsInternal(settings);
      }

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
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
      localStorage.setItem("paperTrading_aiSettings", JSON.stringify(aiSettings));
    }
  }, [balance, openPositions, tradeHistory, isLoaded, watchlist, priceAlerts, tradeTriggers, automationConfig, aiSettings]);
  
  // Define core trading functions first
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
        setTimeout(() => {
          toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
        }, 0);
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
              if (existing.details) {
                  if (stopLoss) existing.details.stopLoss = stopLoss;
                  if (takeProfit) existing.details.takeProfit = takeProfit;
              } else {
                  existing.details = { stopLoss, takeProfit, triggeredBy };
              }
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
      
      setTimeout(() => {
        toast({ title: "Spot Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName}` });
      }, 0);
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
          setTimeout(() => {
            toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          }, 0);
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

      setTimeout(() => {
        toast({ title: "Futures Trade Executed", description: `LONG ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
      }, 0);
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
          setTimeout(() => {
            toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          }, 0);
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

      setTimeout(() => {
        toast({ title: "Futures Trade Executed", description: `SHORT ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
      }, 0);
  }, [balance, toast]);

  const executeTrigger = useCallback((trigger: TradeTrigger, currentPrice: number) => {
    setTimeout(() => {
      toast({
      title: 'Trade Trigger Executed!',
      description: `Executing ${trigger.action} for ${trigger.symbolName} at ${currentPrice.toFixed(4)}`
      });
    }, 0);

    const watchlistItem = watchlist.find(item => item.symbol === trigger.symbol);
    const priceChgPct = watchlistItem?.priceChgPct;
    const symbolName = trigger.type === 'spot' ? trigger.symbolName : trigger.symbolName.replace(/M$/, "");

    if (trigger.type === 'spot') {
      buy(trigger.symbol, symbolName, trigger.amount, currentPrice, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.condition}`, priceChgPct);
    } else if (trigger.type === 'futures') {
      if (trigger.action === 'long') {
        futuresBuy(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.condition}`, priceChgPct);
      } else {
        futuresSell(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.condition}`, priceChgPct);
      }
    }
  }, [toast, buy, futuresBuy, futuresSell, watchlist]);

  // Define functions that depend on the core trading functions
  const closePosition = useCallback((positionId: string, reason: string = 'Manual Close', closePriceParam?: number) => {
    setOpenPositions(currentOpenPositions => {
        const positionToClose = currentOpenPositions.find(p => p.id === positionId);
        if (!positionToClose) {
            return currentOpenPositions;
        }

        const exitPrice = closePriceParam !== undefined ? closePriceParam : positionToClose.currentPrice;
        if(exitPrice === undefined) return currentOpenPositions; 

        let pnl = 0;
        let returnedValue = 0;

        if (reason === 'Position Liquidated') {
            const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / (positionToClose.leverage || 1);
            pnl = -collateral;
            returnedValue = 0;
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
        
        setTimeout(() => {
          toast({ title: `${reason}: Position Closed`, description: `Closed ${positionToClose.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });
        }, 0);

        return currentOpenPositions.filter(p => p.id !== positionId);
    });

  }, [toast]);
  
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
  
  const checkTradeTriggers = useCallback((symbol: string, newPrice: number) => {
    let executedTriggerIds = new Set<string>();
    let cancelSymbols = new Set<string>();
  
    setTradeTriggers(prevTriggers => {
      const activeTriggers = prevTriggers.filter(t => t.status === 'active' && t.symbol === symbol);
  
      activeTriggers.forEach(trigger => {
        if (executedTriggerIds.has(trigger.id)) return;
        
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
        if (executedTriggerIds.has(t.id)) return false;
        if (cancelSymbols.has(t.symbol) && !executedTriggerIds.has(t.id)) return false;
        return true;
      });
    });
  }, [executeTrigger]);

  const processUpdate = useCallback((symbol: string, isSpot: boolean, data: Partial<SpotSnapshotData | FuturesSnapshotData>) => {
    let newPrice: number | undefined, high: number | undefined, low: number | undefined, priceChgPct: number | undefined;

    if (isSpot) {
      const spotData = data as SpotSnapshotData;
      newPrice = spotData.lastTradedPrice ?? undefined;
      high = spotData.high ?? undefined;
      low = spotData.low ?? undefined;
      priceChgPct = spotData.changeRate ?? undefined;
    } else { // Futures
      const futuresData = data as FuturesSnapshotData; 
      newPrice = futuresData.lastPrice ?? undefined;
      high = futuresData.highPrice ?? undefined;
      low = futuresData.lowPrice ?? undefined;
      priceChgPct = futuresData.priceChgPct ?? undefined;
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

  // Define higher-level functions last
  const removeTradeTrigger = useCallback((triggerId: string) => {
    setTradeTriggers(prev => prev.filter(t => t.id !== triggerId));
    setTimeout(() => {
      toast({ title: 'Trade Trigger Removed' });
    }, 0);
  }, [toast]);

  const updateTradeTrigger = useCallback((triggerId: string, updates: Partial<TradeTrigger>) => {
    let triggerSymbol = '';
    setTradeTriggers(prev => prev.map(t => {
      if (t.id === triggerId) {
        triggerSymbol = t.symbolName;
        return { ...t, ...updates };
      }
      return t;
    }));
    if (triggerSymbol) {
        setTimeout(() => {
            toast({ title: 'Trigger Updated', description: `Trigger for ${triggerSymbol} has been updated.` });
        }, 0);
    }
  }, [toast]);

  const addTradeTrigger = useCallback((trigger: Omit<TradeTrigger, 'id' | 'status'>) => {
    const newTrigger: TradeTrigger = {
      ...trigger,
      id: crypto.randomUUID(),
      status: 'active',
    };

    const watchlistItem = watchlist.find(item => item.symbol === trigger.symbol);
    const currentPrice = watchlistItem?.currentPrice;
    
    let shouldExecuteImmediately = false;
    if (currentPrice) {
        shouldExecuteImmediately =
            (newTrigger.condition === 'above' && currentPrice >= newTrigger.targetPrice) ||
            (newTrigger.condition === 'below' && currentPrice <= newTrigger.targetPrice);
    }

    if (shouldExecuteImmediately) {
        executeTrigger(newTrigger, currentPrice!);
        if (newTrigger.cancelOthers) {
            setTradeTriggers(prev => prev.filter(t => t.symbol !== newTrigger.symbol));
        }
    } else {
        setTradeTriggers(prev => [newTrigger, ...prev]);
        setTimeout(() => {
          toast({ title: 'Trade Trigger Set', description: `Trigger set for ${trigger.symbolName}.` });
        }, 0);
    }
  }, [toast, watchlist, executeTrigger]);
  
  const handleAiTriggerAnalysis = useCallback(async (isScheduled = false) => {
    if (watchlist.length === 0) {
      if (!isScheduled) {
        setTimeout(() => {
          toast({ title: "AI Analysis Skipped", description: "Please add items to your watchlist first.", variant: "destructive"});
        }, 0);
      }
      return { analysis: "Watchlist is empty, skipping analysis.", plan: [], isLoading: false };
    }

    try {
      const response = await proposeTradeTriggers({ watchlist, settings: aiSettings, activeTriggers: tradeTriggers, balance });

      if (aiSettings.autoExecute) {
        let executedCount = 0;
        response.plan.forEach(action => {
            if (action.type === 'CREATE') {
                addTradeTrigger(action.trigger);
                executedCount++;
            } else if (action.type === 'UPDATE') {
                updateTradeTrigger(action.triggerId, action.updates);
                executedCount++;
            } else if (action.type === 'CANCEL') {
                removeTradeTrigger(action.triggerId);
                executedCount++;
            }
        });
        setTimeout(() => {
          toast({ 
            title: 'AI Auto-Execution Complete', 
            description: `${executedCount} action(s) were executed automatically. Analysis:\n${response.analysis}`
          });
        }, 0);
        return { analysis: response.analysis, plan: [], isLoading: false };
      } else {
        return { ...response, isLoading: false };
      }

    } catch (error) {
      console.error("AI Trigger Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      if (!isScheduled) {
         setTimeout(() => {
          toast({ title: "AI Analysis Failed", description: errorMessage, variant: "destructive"});
        }, 0);
      }
      return { analysis: `An error occurred: ${errorMessage}`, plan: [], isLoading: false };
    }
  }, [watchlist, aiSettings, addTradeTrigger, removeTradeTrigger, updateTradeTrigger, toast, tradeTriggers, balance]);

  const setAiSettings = useCallback((settings: AiTriggerSettings) => {
      setAiSettingsInternal(settings);
      if (settings.scheduleInterval) {
          localStorage.setItem('aiPaperTrading_lastScrapeTime', Date.now().toString());
          setNextAiScrapeTime(Date.now() + settings.scheduleInterval);
           setTimeout(() => {
              toast({ title: 'AI Automation Saved', description: `AI agent will run every ${settings.scheduleInterval! / 60000} minutes.` });
          }, 0);
      } else {
          setNextAiScrapeTime(0);
          if (aiAutomationIntervalRef.current) {
            clearInterval(aiAutomationIntervalRef.current);
            aiAutomationIntervalRef.current = null;
          }
          setTimeout(() => {
            toast({ title: 'AI Automation Saved', description: `AI agent auto-run has been disabled.` });
          }, 0);
      }
  }, [toast]);
  
  useEffect(() => {
    setPrevOpenPositions(openPositions);
  }, [openPositions]);

  useEffect(() => {
      if (!isLoaded) return;
      
      openPositions.forEach(currentPos => {
        const { id, details, currentPrice, side, liquidationPrice, positionType } = currentPos;
        
        if (currentPrice === undefined) return;

        let shouldClose = false;
        let reason = '';
        let closePrice: number = currentPrice;
    
        if (positionType === 'futures' && typeof liquidationPrice === 'number') {
          if ((side === 'long' && currentPrice <= liquidationPrice) || (side === 'short' && currentPrice >= liquidationPrice)) {
            shouldClose = true;
            reason = 'Position Liquidated';
            closePrice = liquidationPrice;
          }
        }
    
        if (!shouldClose && details) {
            const { stopLoss, takeProfit } = details;
            if (typeof stopLoss === 'number' && ((side === 'buy' || side === 'long') && currentPrice <= stopLoss)) {
                shouldClose = true;
                reason = 'Stop Loss Hit';
                closePrice = stopLoss;
            } else if (typeof takeProfit === 'number' && (((side === 'buy' || side === 'long') && currentPrice >= takeProfit) || (side === 'short' && currentPrice <= takeProfit))) {
                shouldClose = true;
                reason = 'Take Profit Hit';
                closePrice = takeProfit;
            }
        }
    
        if (shouldClose) {
          closePosition(id, reason, closePrice);
        }
      });

  }, [openPositions, isLoaded, closePosition]);

  const setAutomationConfig = useCallback((config: AutomationConfig) => {
    setAutomationConfigInternal(config);
    if (config.updateMode === 'auto-refresh') {
        localStorage.setItem('paperTrading_lastScrapeTime', Date.now().toString());
        setNextScrapeTime(Date.now() + config.refreshInterval);
        setTimeout(() => {
          toast({ title: 'Automation Saved', description: `Watchlist will auto-refresh every ${config.refreshInterval / 60000} minutes.` });
        }, 0);
    } else {
        setNextScrapeTime(0);
        if (automationIntervalRef.current) {
          clearInterval(automationIntervalRef.current);
          automationIntervalRef.current = null;
        }
        setTimeout(() => {
          toast({ title: 'Automation Saved', description: `Watchlist auto-refresh has been disabled.` });
        }, 0);
    }
  }, [toast]);

  const applyWatchlistAutomation = useCallback(async (config: AutomationConfig, forceScrape: boolean = false) => {
    if (forceScrape) {
      setTimeout(() => {
        toast({ title: 'Automation Running', description: 'Fetching screener data to build watchlist...' });
      }, 0);
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
        
        if (forceScrape) {
          setTimeout(() => {
            toast({ title: 'Watchlist Updated', description: `Watchlist has been updated based on your automation rules.`});
          }, 0);
        }
    } catch(error) {
      console.error('Watchlist automation failed:', error);
      if (forceScrape) {
        setTimeout(() => {
          toast({ title: 'Automation Failed', description: 'Could not fetch screener data.', variant: 'destructive'});
        }, 0);
      }
    }
  }, [toast, futuresContracts]);
  
  useEffect(() => {
    if (automationIntervalRef.current) {
        clearInterval(automationIntervalRef.current);
    }
    if (isLoaded && automationConfig.updateMode === 'auto-refresh' && automationConfig.refreshInterval > 0) {
        const runAutomation = () => applyWatchlistAutomation(automationConfig, false);
        
        const lastScrapeTime = parseInt(localStorage.getItem('paperTrading_lastScrapeTime') || '0', 10);
        const timeSinceLast = Date.now() - lastScrapeTime;
        const initialDelay = Math.max(0, automationConfig.refreshInterval - timeSinceLast);

        const timeoutId = setTimeout(() => {
          runAutomation();
          localStorage.setItem('paperTrading_lastScrapeTime', Date.now().toString());
          setNextScrapeTime(Date.now() + automationConfig.refreshInterval);
          automationIntervalRef.current = setInterval(() => {
            runAutomation();
            localStorage.setItem('paperTrading_lastScrapeTime', Date.now().toString());
            setNextScrapeTime(Date.now() + automationConfig.refreshInterval);
          }, automationConfig.refreshInterval);
        }, initialDelay);
        
        setNextScrapeTime(Date.now() + initialDelay);

        return () => {
          clearTimeout(timeoutId);
          if (automationIntervalRef.current) {
            clearInterval(automationIntervalRef.current);
          }
        };
    } else {
        setNextScrapeTime(0);
    }
  }, [isLoaded, automationConfig, applyWatchlistAutomation]);

  useEffect(() => {
    if (aiAutomationIntervalRef.current) {
      clearInterval(aiAutomationIntervalRef.current);
    }
    if (isLoaded && aiSettings.scheduleInterval && aiSettings.scheduleInterval > 0) {
      const runScheduledAnalysis = () => handleAiTriggerAnalysis(true);
      
      const lastScrape = localStorage.getItem('aiPaperTrading_lastScrapeTime');
      const lastScrapeTime = lastScrape ? parseInt(lastScrape, 10) : Date.now();
      const timeSinceLast = Date.now() - lastScrapeTime;
      const initialDelay = Math.max(0, aiSettings.scheduleInterval - timeSinceLast);

      const timeoutId = setTimeout(() => {
        runScheduledAnalysis();
        localStorage.setItem('aiPaperTrading_lastScrapeTime', Date.now().toString());
        setNextAiScrapeTime(Date.now() + aiSettings.scheduleInterval!);

        aiAutomationIntervalRef.current = setInterval(() => {
          runScheduledAnalysis();
          localStorage.setItem('aiPaperTrading_lastScrapeTime', Date.now().toString());
          setNextAiScrapeTime(Date.now() + aiSettings.scheduleInterval!);
        }, aiSettings.scheduleInterval!);
      }, initialDelay);
      
      setNextAiScrapeTime(Date.now() + initialDelay);

      return () => {
        clearTimeout(timeoutId);
        if (aiAutomationIntervalRef.current) {
          clearInterval(aiAutomationIntervalRef.current);
        }
      };
    } else {
      setNextAiScrapeTime(0);
    }
  }, [isLoaded, aiSettings.scheduleInterval, handleAiTriggerAnalysis]);
  
  useEffect(() => {
    Object.entries(priceAlerts).forEach(([symbol, alert]) => {
      if (alert.triggered && !notifiedAlerts.current.has(symbol)) {
        const watchlistItem = watchlist.find(item => item.symbol === symbol);
        setTimeout(() => {
          toast({
            title: "Price Alert Triggered!",
            description: `${watchlistItem?.symbolName || symbol} has reached your alert price of ${alert.price}.`,
          });
        }, 0);
        notifiedAlerts.current.add(symbol);
      }
    });
  }, [priceAlerts, watchlist, toast]);

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
      setTimeout(() => {
        toast({
          title: "Position Updated",
          description: `SL/TP updated for ${symbolName}.`
        });
      }, 0);
    }
  }, [toast]);
  
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
          setTimeout(() => {
            toast({ title: "Spot WebSocket Error", description: "Connection failed. Watchlist prices may not update.", variant: "destructive" });
          }, 0);
          ws.close();
        };
      }).catch(error => {
        console.error("Spot Connection failed", error);
        setSpotWsStatus("error");
        setTimeout(() => {
          toast({ title: "Spot Connection Failed", description: "Could not get a connection token.", variant: "destructive" });
        }, 0);
      });
    },
    [processUpdate, toast]
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
    const positionsToClose = [...openPositions];
    positionsToClose.forEach(p => {
        const currentPositionState = openPositions.find(op => op.id === p.id);
        const closePrice = currentPositionState ? currentPositionState.currentPrice : p.currentPrice;
        if(closePrice !== undefined) {
          closePosition(p.id, 'Manual Close All', closePrice);
        }
    });
  }, [openPositions, closePosition]);

  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    setTimeout(() => {
      toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
    }, 0);
  }, [toast]);

  const addPriceAlert = useCallback((symbol: string, price: number, condition: 'above' | 'below') => {
    const newAlert: PriceAlert = { price, condition, triggered: false, notified: false };
    setPriceAlerts(prev => ({ ...prev, [symbol]: newAlert }));
    setTimeout(() => {
      toast({ title: 'Alert Set', description: `Alert set for ${symbol} when price is ${condition} ${price}.` });
    }, 0);
    notifiedAlerts.current.delete(symbol);
  }, [toast]);

  const removePriceAlert = useCallback((symbol: string) => {
    setPriceAlerts(prev => {
      const { [symbol]: _, ...rest } = prev;
      return rest;
    });
    notifiedAlerts.current.delete(symbol);
    setTimeout(() => {
      toast({ title: 'Alert Removed', description: `Alert for ${symbol} removed.` });
    }, 0);
  }, [toast]);

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number) => {
    setWatchlist(prev => {
        const existingIndex = prev.findIndex(item => item.symbol === symbol);
        if (existingIndex > -1) {
             setTimeout(() => {
                toast({ title: 'Watchlist', description: `${symbolName} removed from watchlist.` });
            }, 0);
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
             setTimeout(() => {
                toast({ title: 'Watchlist', description: `${symbolName} added to watchlist.` });
            }, 0);

            return [newItem, ...prev];
        }
    });
}, [futuresContracts, toast]);

  return (
    <PaperTradingContext.Provider
      value={{
        balance,
        openPositions,
        tradeHistory,
        watchlist,
        priceAlerts,
        tradeTriggers,
        buy,
        futuresBuy,
        futuresSell,
        closePosition,
        updatePositionSlTp,
        closeAllPositions,
        clearHistory,
        spotWsStatus,
        futuresWsStatus,
        toggleWatchlist,
        addPriceAlert,
        removePriceAlert,
        addTradeTrigger,
        updateTradeTrigger,
        removeTradeTrigger,
        automationConfig,
        setAutomationConfig,
        applyWatchlistAutomation,
        nextScrapeTime,
        aiSettings,
        setAiSettings,
        handleAiTriggerAnalysis,
        nextAiScrapeTime,
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
