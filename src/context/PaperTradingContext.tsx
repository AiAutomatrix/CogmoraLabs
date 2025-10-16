
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
  AgentActionPlan,
  AgentAction,
  AiActionExecutionLog,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { proposeTradeTriggers } from "@/ai/flows/propose-trade-triggers-flow";
import { getSpotWsToken, getFuturesWsToken } from "@/app/actions/kucoinActions";


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
  manageOpenPositions: false,
};

interface PaperTradingContextType {
  balance: number;
  openPositions: OpenPosition[];
  tradeHistory: PaperTrade[];
  watchlist: WatchlistItem[];
  priceAlerts: Record<string, PriceAlert>;
  tradeTriggers: TradeTrigger[];
  aiActionLogs: AiActionExecutionLog[];
  lastAiActionPlan: AgentActionPlan | null;
  equity: number; // Added for AI context
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
  clearAiActionLogs: () => void;
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
  logAiAction: (action: AgentAction) => void;
  removeActionFromPlan: (action: AgentAction) => void;
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
  const [pendingWatchlist, setPendingWatchlist] = useState<{items: WatchlistItem[], clearExisting: boolean} | null>(null);


  const [aiSettings, setAiSettingsInternal] = useState<AiTriggerSettings>(INITIAL_AI_SETTINGS);
  const [nextAiScrapeTime, setNextAiScrapeTime] = useState(0);
  const [lastAiActionPlan, setLastAiActionPlan] = useState<AgentActionPlan | null>(null);
  const [aiActionLogs, setAiActionLogs] = useState<AiActionExecutionLog[]>([]);


  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotSubscriptionsRef = useRef<Set<string>>(new Set());
  const spotReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spotReconnectAttempts = useRef(0);

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresSubscriptionsRef = useRef<Set<string>>(new Set());
  const futuresReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const futuresReconnectAttempts = useRef(0);

  const notifiedAlerts = useRef(new Set<string>());
  const automationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiAutomationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      const savedAiPlan = localStorage.getItem("paperTrading_lastAiActionPlan");
      const savedAiLogs = localStorage.getItem("paperTrading_aiActionLogs");

      if (savedBalance) setBalance(JSON.parse(savedBalance));
      if (savedPositions) {
        const parsedPositions = JSON.parse(savedPositions);
        setOpenPositions(parsedPositions);
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
      if (savedAiPlan) setLastAiActionPlan(JSON.parse(savedAiPlan));
      if (savedAiLogs) setAiActionLogs(JSON.parse(savedAiLogs));

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
      localStorage.setItem("paperTrading_lastAiActionPlan", JSON.stringify(lastAiActionPlan));
      localStorage.setItem("paperTrading_aiActionLogs", JSON.stringify(aiActionLogs));
    }
  }, [balance, openPositions, tradeHistory, isLoaded, watchlist, priceAlerts, tradeTriggers, automationConfig, aiSettings, lastAiActionPlan, aiActionLogs]);
  
  const accountMetrics = useMemo(() => {
    const totalUnrealizedPNL = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    const equity = balance + totalUnrealizedPNL;
    const totalRealizedPNL = tradeHistory
      .filter((t) => t.status === "closed")
      .reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);

    const wonTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl > 0).length;
    const lostTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl <= 0).length;
    const totalClosedTrades = wonTrades + lostTrades;
    const winRate = totalClosedTrades > 0 ? (wonTrades / totalClosedTrades) * 100 : 0;

    return {
      equity,
      realizedPnl: totalRealizedPNL,
      unrealizedPnl: totalUnrealizedPNL,
      winRate,
      wonTrades,
      lostTrades,
    };
  }, [openPositions, balance, tradeHistory]);

  const { equity, wonTrades, lostTrades } = accountMetrics;

  const removeTradeTrigger = useCallback((triggerId: string) => {
    setTradeTriggers(prev => prev.filter(t => t.id !== triggerId));
    setTimeout(() => {
      toast({ title: 'Trade Trigger Removed' });
    }, 0);
  }, [toast]);
  
  const clearHistory = useCallback(() => {
    setTradeHistory([]);
    setTimeout(() => {
      toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
    }, 0);
  }, [toast]);

  const clearAiActionLogs = useCallback(() => {
    setAiActionLogs([]);
    setTimeout(() => {
      toast({ title: "AI Logs Cleared", description: "Your AI agent execution logs have been cleared." });
    }, 0);
  }, [toast]);

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

  const checkPriceAlerts = useCallback((symbol: string, newPrice: number) => {
    setPriceAlerts(prev => {
      const alert = prev[symbol];
      if (!alert || alert.triggered) return prev;

      const conditionMet =
        (alert.condition === 'above' && newPrice >= alert.price) ||
        (alert.condition === 'below' && newPrice <= alert.price);

      if (conditionMet) {
        return { ...prev, [symbol]: { ...alert, triggered: true }};
      }
      return prev;
    });
  }, []);

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
  }, [buy, futuresBuy, futuresSell, toast, watchlist]);

  const checkTradeTriggers = useCallback((symbol: string, newPrice: number) => {
    let executedTriggerIds = new Set<string>();
    let cancelSymbols = new Set<string>();

    setTradeTriggers(prevTriggers => {
      const activeTriggersForSymbol = prevTriggers.filter(t => t.status === 'active' && t.symbol === symbol);

      activeTriggersForSymbol.forEach(trigger => {
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

  const processUpdateRef = useRef((symbol: string, isSpot: boolean, data: any) => {});
  
  useEffect(() => {
    processUpdateRef.current = (symbol: string, isSpot: boolean, data: Partial<SpotSnapshotData | FuturesSnapshotData>) => {
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
    }
  }, [checkPriceAlerts, checkTradeTriggers]);


  const closePosition = useCallback((positionId: string, reason: string = 'Manual Close', closePriceParam?: number) => {
    setOpenPositions(currentOpenPositions => {
        const positionToClose = currentOpenPositions.find(p => p.id === positionId);
        if (!positionToClose) {
            return currentOpenPositions;
        }

        const exitPrice = closePriceParam ?? positionToClose.currentPrice ?? 0;
        if(exitPrice === 0) return currentOpenPositions; 

        let pnl = 0;
        let returnedValue = 0;

        if (reason === 'Position Liquidated' && positionToClose.positionType === 'futures') {
            const collateral = (positionToClose.size * positionToClose.averageEntryPrice) / (positionToClose.leverage || 1);
            pnl = -collateral;
            returnedValue = 0; // Collateral is lost
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

    if (shouldExecuteImmediately && currentPrice) {
        executeTrigger(newTrigger, currentPrice);
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
  

  const logAiAction = useCallback((action: AgentAction) => {
    setAiActionLogs(prev => [...prev, { ...action, executedAt: Date.now() }]);
  }, []);
  
  const removeActionFromPlan = useCallback((actionToRemove: AgentAction) => {
    setLastAiActionPlan(prevPlan => {
      if (!prevPlan) return null;
      const newPlan = prevPlan.plan.filter(action => JSON.stringify(action) !== JSON.stringify(actionToRemove));
      return {
        ...prevPlan,
        plan: newPlan,
      };
    });
  }, []);

  const handleAiTriggerAnalysis = useCallback(async (isScheduled = false): Promise<AgentActionPlan & {isLoading: boolean}> => {
    if (watchlist.length === 0) {
      const msg = "Watchlist is empty, skipping analysis.";
      if (!isScheduled) {
        setTimeout(() => {
          toast({ title: "AI Analysis Skipped", description: "Please add items to your watchlist first.", variant: "destructive"});
        }, 0);
      }
      return { analysis: msg, plan: [], isLoading: false };
    }

    const { equity, realizedPnl, unrealizedPnl, winRate, wonTrades, lostTrades } = accountMetrics;
    const currentAccountMetrics = {
      balance,
      equity,
      realizedPnl,
      unrealizedPnl,
      winRate,
      wonTrades,
      lostTrades,
    };

    try {
      const response = await proposeTradeTriggers({ 
        watchlist, 
        settings: aiSettings, 
        activeTriggers: tradeTriggers, 
        openPositions: openPositions,
        accountMetrics: currentAccountMetrics
      });
      
      setLastAiActionPlan(response);

      if (aiSettings.autoExecute) {
        let executedCount = 0;
        response.plan.forEach(action => {
            logAiAction(action);
            if (action.type === 'CREATE') {
                addTradeTrigger(action.trigger);
                executedCount++;
            } else if (action.type === 'UPDATE') {
                updateTradeTrigger(action.triggerId, action.updates);
                executedCount++;
            } else if (action.type === 'CANCEL') {
                removeTradeTrigger(action.triggerId);
                executedCount++;
            } else if (action.type === 'UPDATE_OPEN_POSITION') {
                updatePositionSlTp(action.positionId, action.updates.stopLoss, action.updates.takeProfit);
                executedCount++;
            }
        });
        setTimeout(() => {
          toast({ 
            title: 'AI Auto-Execution Complete', 
            description: `${executedCount} action(s) were executed automatically. Analysis:\n${response.analysis}`
          });
        }, 0);
        setLastAiActionPlan(prev => prev ? { ...prev, plan: [] } : null);
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
  }, [watchlist, aiSettings, tradeTriggers, openPositions, balance, accountMetrics, toast, addTradeTrigger, updateTradeTrigger, removeTradeTrigger, logAiAction, updatePositionSlTp]);


  // Auto-close positions on SL/TP or Liquidation
  useEffect(() => {
    if (!isLoaded) return;

    openPositions.forEach(currentPos => {
      const { id, details, currentPrice, side, liquidationPrice, positionType } = currentPos;

      if (currentPrice === undefined) return;
      
      let shouldClose = false;
      let reason = '';
      let closePrice: number | undefined = undefined;
      
      if (positionType === 'futures' && typeof liquidationPrice === 'number' && liquidationPrice > 0) {
        if ((side === 'long' && currentPrice <= liquidationPrice) || (side === 'short' && currentPrice >= liquidationPrice)) {
          shouldClose = true;
          reason = 'Position Liquidated';
          closePrice = liquidationPrice;
        }
      }

      if (!shouldClose && details) {
        const { stopLoss, takeProfit } = details;
        if (typeof stopLoss === 'number' && stopLoss > 0) {
            if ( (side === 'buy' || side === 'long') && currentPrice <= stopLoss ) {
                shouldClose = true;
                reason = 'Stop Loss Hit';
                closePrice = stopLoss;
            } else if ( side === 'short' && currentPrice >= stopLoss ) {
                shouldClose = true;
                reason = 'Stop Loss Hit';
                closePrice = stopLoss;
            }
        }
        
        if (!shouldClose && typeof takeProfit === 'number' && takeProfit > 0) {
           if ( (side === 'buy' || side === 'long') && currentPrice >= takeProfit ) {
              shouldClose = true;
              reason = 'Take Profit Hit';
              closePrice = takeProfit;
          } else if ( side === 'short' && currentPrice <= takeProfit ) {
              shouldClose = true;
              reason = 'Take Profit Hit';
              closePrice = takeProfit;
          }
        }
      }
    
      if (shouldClose && closePrice !== undefined) {
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

  const applyWatchlistAutomation = useCallback(async (config: AutomationConfig, forceScrape: boolean = false) => {
    if (forceScrape) {
      setTimeout(() => {
        toast({ title: 'Automation Running', description: 'Fetching screener data to build watchlist...' });
      }, 0);
    }

    try {
        const spotResponse = await fetch('/api/kucoin-tickers');
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
                const valB = parseFloat(b[sortKey as keyof b] as string) || 0;
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
        
        setPendingWatchlist({ items: finalItems, clearExisting: config.clearExisting });

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
        automationIntervalRef.current = null;
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
      aiAutomationIntervalRef.current = null;
    }
    if (isLoaded && aiSettings.scheduleInterval && aiSettings.scheduleInterval > 0) {
      const runScheduledAnalysis = () => handleAiTriggerAnalysis(true);
      
      const lastScrape = localStorage.getItem('aiPaperTrading_lastScrapeTime');
      const lastScrapeTime = lastScrape ? parseInt(lastScrape, 10) : 0;
      const timeSinceLast = Date.now() - lastScrapeTime;
      const initialDelay = timeSinceLast > aiSettings.scheduleInterval ? 0 : aiSettings.scheduleInterval - timeSinceLast;

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

  
  const connectToSpot = useCallback(async () => {
    if (spotWs.current) {
      return;
    }
    setSpotWsStatus("fetching_token");
    try {
        const tokenData = await getSpotWsToken();
        if (tokenData.code !== "200000") throw new Error("Failed to fetch KuCoin Spot WebSocket token");

        spotReconnectAttempts.current = 0;
        if (spotReconnectTimeoutRef.current) clearTimeout(spotReconnectTimeoutRef.current);

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

            Array.from(spotSubscriptionsRef.current).forEach((symbol) => {
                ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/market/snapshot:${symbol}`, response: true }));
            });
        };

        ws.onmessage = (event: MessageEvent) => {
            const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
            if (message.type === "message" && message.subject === "trade.snapshot") {
                const wrapper = message.data as KucoinSnapshotDataWrapper;
                const symbol = message.topic.split(":")[1];
                processUpdateRef.current(symbol, true, wrapper.data);
            }
        };

        const handleCloseOrError = (event: Event | CloseEvent) => {
            spotWs.current = null;
            if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
            setSpotWsStatus("disconnected");
            console.error("Spot WS Error/Close:", event);

            if (spotSubscriptionsRef.current.size > 0) { // Only reconnect if there are subscriptions
              spotReconnectAttempts.current++;
              const delay = Math.min(1000 * (2 ** spotReconnectAttempts.current), 30000); 
              spotReconnectTimeoutRef.current = setTimeout(() => {
                  connectToSpot();
              }, delay);
            }
        };

        ws.onclose = handleCloseOrError;
        ws.onerror = handleCloseOrError;

    } catch (error) {
        setSpotWsStatus("error");
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        console.error("Spot WS Error", error);
        setTimeout(() => {
          toast({ title: "Spot WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
        }, 0);
    }
  }, [toast]);
  
  const connectToFutures = useCallback(async () => {
    if (futuresWs.current) {
        return;
    }
    setFuturesWsStatus("fetching_token");
    try {
        const tokenData = await getFuturesWsToken();
        if (tokenData.code !== "200000") throw new Error(`Failed to fetch KuCoin Futures WebSocket token: ${tokenData.data}`);

        futuresReconnectAttempts.current = 0;
        if (futuresReconnectTimeoutRef.current) clearTimeout(futuresReconnectTimeoutRef.current);

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

            Array.from(futuresSubscriptionsRef.current).forEach((symbol) => {
                ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `/contractMarket/snapshot:${symbol}`, response: true }));
            });
        };

        ws.onmessage = (event: MessageEvent) => {
            const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
            if (message.type === "message" && message.subject === 'snapshot.24h') {
                processUpdateRef.current(message.data.symbol, false, message.data as any);
            }
        };

        const handleCloseOrError = (event: Event | CloseEvent) => {
            futuresWs.current = null;
            if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
            setFuturesWsStatus("disconnected");
            console.error("Futures WS Error/Close:", event instanceof CloseEvent ? `Code: ${event.code}` : event);
            
            if (futuresSubscriptionsRef.current.size > 0) { // Only reconnect if there are subscriptions
              futuresReconnectAttempts.current++;
              const delay = Math.min(1000 * (2 ** futuresReconnectAttempts.current), 30000); // Exponential backoff up to 30s
              futuresReconnectTimeoutRef.current = setTimeout(() => {
                  connectToFutures();
              }, delay);
            }
        };

        ws.onclose = handleCloseOrError;
        ws.onerror = handleCloseOrError;

    } catch (error) {
        setFuturesWsStatus("error");
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        console.error("Futures WS Error", error);
        setTimeout(() => {
          toast({ title: "Futures WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
        }, 0);
    }
  }, [toast]);

  const allSpotSymbols = useMemo(() => {
    const symbols = new Set<string>();
    openPositions.forEach(p => p.positionType === 'spot' && symbols.add(p.symbol));
    watchlist.forEach(w => w.type === 'spot' && symbols.add(w.symbol));
    tradeTriggers.forEach(t => t.type === 'spot' && symbols.add(t.symbol));
    return Array.from(symbols);
  }, [openPositions, watchlist, tradeTriggers]);

  const allFuturesSymbols = useMemo(() => {
    const symbols = new Set<string>();
    openPositions.forEach(p => p.positionType === 'futures' && symbols.add(p.symbol));
    watchlist.forEach(w => w.type === 'futures' && symbols.add(w.symbol));
    tradeTriggers.forEach(t => t.type === 'futures' && symbols.add(t.symbol));
    return Array.from(symbols);
  }, [openPositions, watchlist, tradeTriggers]);
  
  useEffect(() => {
    if (!isLoaded) return;
  
    const manageSubscriptions = (
      wsRef: React.MutableRefObject<WebSocket | null>,
      allSymbols: string[],
      subscriptionsRef: React.MutableRefObject<Set<string>>,
      connectFn: () => void,
      type: 'spot' | 'futures'
    ) => {
      const desiredSubs = new Set(allSymbols);
  
      if (desiredSubs.size > 0 && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        connectFn();
      }
  
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const currentSubs = new Set(subscriptionsRef.current);
        const toAdd = [...desiredSubs].filter(s => !currentSubs.has(s));
        const toRemove = [...currentSubs].filter(s => !desiredSubs.has(s));
  
        const topicPrefix = type === 'spot' ? '/market/snapshot:' : '/contractMarket/snapshot:';
  
        toAdd.forEach(symbol => {
          wsRef.current!.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: `${topicPrefix}${symbol}`, response: true }));
          subscriptionsRef.current.add(symbol);
        });
  
        toRemove.forEach(symbol => {
          wsRef.current!.send(JSON.stringify({ id: Date.now(), type: "unsubscribe", topic: `${topicPrefix}${symbol}`, response: true }));
          subscriptionsRef.current.delete(symbol);
        });
      } else if (desiredSubs.size === 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  
    manageSubscriptions(spotWs, allSpotSymbols, spotSubscriptionsRef, connectToSpot, 'spot');
    manageSubscriptions(futuresWs, allFuturesSymbols, futuresSubscriptionsRef, connectToFutures, 'futures');
      
  }, [isLoaded, allSpotSymbols, allFuturesSymbols, connectToSpot, connectToFutures]);
  
  
  useEffect(() => {
    if (!pendingWatchlist) return;

    const { items: newItems, clearExisting } = pendingWatchlist;
    const newSymbols = new Set(newItems.map(item => item.symbol));
    
    // Determine symbols to unsubscribe from
    const symbolsToUnsubscribe = clearExisting 
        ? [...watchlist.map(item => item.symbol)] 
        : watchlist.filter(item => !newSymbols.has(item.symbol)).map(item => item.symbol);
    
    // Unsubscribe from symbols that are no longer needed
    symbolsToUnsubscribe.forEach(symbol => {
        const watchlistItem = watchlist.find(item => item.symbol === symbol);
        const wsRef = watchlistItem?.type === 'spot' ? spotWs : futuresWs;
        const topicPrefix = watchlistItem?.type === 'spot' ? '/market/snapshot:' : '/contractMarket/snapshot:';
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ id: Date.now(), type: "unsubscribe", topic: `${topicPrefix}${symbol}`, response: true }));
            (watchlistItem?.type === 'spot' ? spotSubscriptionsRef : futuresSubscriptionsRef).current.delete(symbol);
        }
    });

    // A short delay to allow unsubscribe messages to be sent before updating the state
    setTimeout(() => {
        setWatchlist(prev => clearExisting ? newItems : [...prev, ...newItems.filter(f => !prev.some(p => p.symbol === f.symbol))]);
        setPendingWatchlist(null);
    }, 200);

}, [pendingWatchlist, watchlist]);


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
        aiActionLogs,
        lastAiActionPlan,
        equity,
        buy,
        futuresBuy,
        futuresSell,
        closePosition,
        updatePositionSlTp,
        closeAllPositions,
        clearHistory,
        clearAiActionLogs,
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
        logAiAction,
        removeActionFromPlan,
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

    

    

    