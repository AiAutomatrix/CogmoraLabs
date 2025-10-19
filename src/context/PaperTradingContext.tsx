
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
import {
  doc,
  setDoc,
  collection,
  writeBatch,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
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
  FirestorePaperTradingContext,
  OpenPositionDetails,
  TradeTriggerDetails,
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
  isLoaded: boolean;
  equity: number; 
  toggleWatchlist: (symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number, order?: number) => void;
  addPriceAlert: (symbol: string, price: number, condition: 'above' | 'below') => void;
  removePriceAlert: (symbol: string) => void;
  addTradeTrigger: (trigger: Omit<TradeTrigger, 'id' | 'details'>) => void;
  updateTradeTrigger: (triggerId: string, updates: Partial<TradeTrigger>) => void;
  removeTradeTrigger: (triggerId: string) => void;
  buy: (
    symbol: string,
    symbolName: string,
    amountUSD: number,
    currentPrice: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string
  ) => void;
  futuresBuy: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string
  ) => void;
  futuresSell: (
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy?: string
  ) => void;
  closePosition: (positionId: string) => void;
  updatePositionSlTp: (positionId: string, sl?: number, tp?: number) => void;
  closeAllPositions: () => void;
  clearHistory: () => void;
  clearAiActionLogs: () => void;
  spotWsStatus: string;
  futuresWsStatus: string;
  automationConfig: AutomationConfig;
  setAutomationConfig: (config: AutomationConfig) => void;
  applyWatchlistAutomation: (config: AutomationConfig, forceScrape?: boolean) => void;
  aiSettings: AiTriggerSettings;
  setAiSettings: (settings: AiTriggerSettings) => void;
  handleAiTriggerAnalysis: (isScheduled?: boolean) => Promise<any>;
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
  const firestore = useFirestore();
  const { user } = useUser();

  // State for core context data (not subcollections)
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [automationConfig, setAutomationConfigInternal] = useState<AutomationConfig>(INITIAL_AUTOMATION_CONFIG);
  const [aiSettings, setAiSettingsInternal] = useState<AiTriggerSettings>(INITIAL_AI_SETTINGS);
  const [lastAiActionPlan, setLastAiActionPlan] = useState<AgentActionPlan | null>(null);
  
  // State for subcollections, managed by real-time listeners
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<PaperTrade[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<Record<string, PriceAlert>>({});
  const [tradeTriggers, setTradeTriggers] = useState<TradeTrigger[]>([]);
  const [aiActionLogs, setAiActionLogs] = useState<AiActionExecutionLog[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const dataLoadedRef = useRef(false);
  const [futuresContracts, setFuturesContracts] = useState<KucoinFuturesContract[]>([]);

  // Queues for processing side effects from price updates
  const executedTriggerIds = useRef(new Set<string>());
  const positionsToCloseIds = useRef(new Set<string>());
  const triggeredAlerts = useRef(new Set<string>());

  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spotReconnectAttempts = useRef(0);

  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const futuresReconnectAttempts = useRef(0);

  const userContextDocRef = useMemo(() => {
    if (user && firestore) {
      return doc(firestore, 'users', user.uid, 'paperTradingContext', 'main');
    }
    return null;
  }, [user, firestore]);

  // Combined listener setup
  useEffect(() => {
    if (!userContextDocRef || !firestore) {
      setIsLoaded(false);
      dataLoadedRef.current = false;
      return;
    }

    const unsubscribers: (() => void)[] = [];
    
    // Listener for the main context document
    const unsubContext = onSnapshot(userContextDocRef, 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as FirestorePaperTradingContext;
          setBalance(data.balance ?? INITIAL_BALANCE);
          setAutomationConfigInternal(data.automationConfig ?? INITIAL_AUTOMATION_CONFIG);
          setAiSettingsInternal(data.aiSettings ?? INITIAL_AI_SETTINGS);
          setLastAiActionPlan(data.lastAiActionPlan ?? null);
          setAiActionLogs(data.aiActionLogs ?? []);
        } else {
            const initialContext: FirestorePaperTradingContext = {
                balance: INITIAL_BALANCE,
                automationConfig: INITIAL_AUTOMATION_CONFIG,
                aiSettings: INITIAL_AI_SETTINGS,
                lastAiActionPlan: null,
                aiActionLogs: [],
            };
            setDocumentNonBlocking(userContextDocRef, initialContext, { merge: false });
        }
        if (!dataLoadedRef.current) {
            setIsLoaded(true);
            dataLoadedRef.current = true;
        }
      },
      (error) => {
        console.error("Error listening to main context:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userContextDocRef.path,
            operation: 'get',
        }));
        if (!dataLoadedRef.current) {
          setIsLoaded(true); // Still mark as loaded to unblock UI
          dataLoadedRef.current = true;
        }
      }
    );
    unsubscribers.push(unsubContext);

    // Generic function to create listeners for subcollections
    const createSubcollectionListener = <T extends {id?: string}>(collectionName: string, setState: React.Dispatch<React.SetStateAction<T[]>>) => {
      const collectionRef = collection(userContextDocRef, collectionName);
      const unsub = onSnapshot(collectionRef, 
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
          setState(items);
        }, 
        (error) => {
          console.error(`Error listening to ${collectionName}:`, error);
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: collectionRef.path,
            operation: 'list',
          }));
        }
      );
      unsubscribers.push(unsub);
    };

    const createRecordListener = <T>(collectionName: string, setState: React.Dispatch<React.SetStateAction<Record<string, T>>>) => {
        const collectionRef = collection(userContextDocRef, collectionName);
        const unsub = onSnapshot(collectionRef, 
          (snapshot) => {
            const items: Record<string, T> = {};
            snapshot.docs.forEach(doc => {
              items[doc.id] = doc.data() as T;
            });
            setState(items);
          }, 
          (error) => {
            console.error(`Error listening to ${collectionName}:`, error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'list',
            }));
          }
        );
        unsubscribers.push(unsub);
    };

    createSubcollectionListener('openPositions', setOpenPositions);
    createSubcollectionListener('tradeHistory', setTradeHistory);
    createSubcollectionListener('watchlist', setWatchlist);
    createSubcollectionListener('tradeTriggers', setTradeTriggers);
    createRecordListener('priceAlerts', setPriceAlerts);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      setIsLoaded(false);
      dataLoadedRef.current = false;
    };
  }, [userContextDocRef, firestore]);

  const saveDataToFirestore = useCallback((data: Partial<FirestorePaperTradingContext>) => {
    if (userContextDocRef) {
      setDocumentNonBlocking(userContextDocRef, data, { merge: true });
    }
  }, [userContextDocRef]);
  
  const saveSubcollectionDoc = useCallback((collectionName: string, docId: string, data: any) => {
    if (userContextDocRef) {
      const docRef = doc(userContextDocRef, collectionName, docId);
      setDocumentNonBlocking(docRef, data, { merge: true });
    }
  }, [userContextDocRef]);

  const deleteSubcollectionDoc = useCallback((collectionName: string, docId: string) => {
    if (userContextDocRef) {
      const docRef = doc(userContextDocRef, collectionName, docId);
      deleteDocumentNonBlocking(docRef);
    }
  }, [userContextDocRef]);

  useEffect(() => {
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
  }, []);

  const equity = useMemo(() => {
    const unrealizedPnl = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    return balance + unrealizedPnl;
  }, [balance, openPositions]);
  
  const accountMetrics = useMemo(() => {
    const totalUnrealizedPNL = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    const equityValue = balance + totalUnrealizedPNL;
    const totalRealizedPNL = tradeHistory
      .filter((t) => t.status === "closed")
      .reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);

    const wonTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl > 0).length;
    const lostTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl <= 0).length;
    const totalClosedTrades = wonTrades + lostTrades;
    const winRate = totalClosedTrades > 0 ? (wonTrades / totalClosedTrades) * 100 : 0;

    return {
      equity: equityValue,
      realizedPnl: totalRealizedPNL,
      unrealizedPnl: totalUnrealizedPNL,
      winRate,
      wonTrades,
      lostTrades,
    };
  }, [openPositions, balance, tradeHistory]);

  const updatePositionSlTp = useCallback((positionId: string, sl?: number, tp?: number) => {
    const pos = openPositions.find(p => p.id === positionId);
    if (!pos) return;
    
    const newDetails: OpenPositionDetails = { ...pos.details };
    if (sl !== undefined) newDetails.stopLoss = sl;
    if (tp !== undefined) newDetails.takeProfit = tp;

    const updatedPosition = { ...pos, details: newDetails };

    saveSubcollectionDoc('openPositions', positionId, updatedPosition);
    toast({
        title: "Position Updated",
        description: `SL/TP updated for ${pos.symbolName}.`
    });
  }, [openPositions, toast, saveSubcollectionDoc]);

  const removeTradeTrigger = useCallback((triggerId: string) => {
    deleteSubcollectionDoc('tradeTriggers', triggerId);
    toast({ title: 'Trade Trigger Removed' });
  }, [toast, deleteSubcollectionDoc]);
  
  const clearHistory = useCallback(async () => {
    if (!userContextDocRef || !firestore) return;
    const batch = writeBatch(firestore);
    const historyCol = collection(userContextDocRef, 'tradeHistory');
    try {
        const historySnapshot = await getDocs(historyCol);
        historySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        toast({ title: "Trade History Cleared", description: "Your trade history has been permanently deleted." });
    } catch (error) {
        console.error("Error clearing trade history:", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: collection(userContextDocRef, 'tradeHistory').path,
            operation: 'delete',
        }));
        toast({ title: "Error", description: "Could not clear trade history due to permissions.", variant: "destructive" });
    }
  }, [userContextDocRef, firestore, toast]);

  const clearAiActionLogs = useCallback(() => {
    saveDataToFirestore({ aiActionLogs: [] });
    toast({ title: "AI Logs Cleared", description: "Your AI agent execution logs have been cleared." });
  }, [toast, saveDataToFirestore]);

  const buy = useCallback(
    (
      symbol: string,
      symbolName: string,
      amountUSD: number,
      currentPrice: number,
      stopLoss?: number,
      takeProfit?: number,
      triggeredBy = 'manual'
    ) => {
      if (!userContextDocRef) return;
      if (balance < amountUSD) {
        toast({ title: "Error", description: "Insufficient balance.", variant: "destructive" });
        return;
      }
      const size = amountUSD / currentPrice;
      const existingPosition = openPositions.find(p => p.symbol === symbol && p.positionType === 'spot');
      
      const newBalance = balance - amountUSD;
      saveDataToFirestore({ balance: newBalance });

      let positionId = existingPosition?.id;
      if (existingPosition) {
          positionId = existingPosition.id;
          const totalSize = existingPosition.size + size;
          const totalValue = (existingPosition.size * existingPosition.averageEntryPrice) + (size * currentPrice);
          const newAverageEntry = totalValue / totalSize;

          const details: OpenPositionDetails = { ...(existingPosition.details || {}), triggeredBy, status: 'open' };
          if (stopLoss !== undefined) details.stopLoss = stopLoss;
          if (takeProfit !== undefined) details.takeProfit = takeProfit;
          
          const updatedPosition: Partial<OpenPosition> = {
            averageEntryPrice: newAverageEntry,
            size: totalSize,
            details,
          };
          saveSubcollectionDoc('openPositions', existingPosition.id, updatedPosition);
      } else {
          positionId = crypto.randomUUID();
          
          const details: OpenPositionDetails = { triggeredBy, status: 'open' };
          if (stopLoss !== undefined) details.stopLoss = stopLoss;
          if (takeProfit !== undefined) details.takeProfit = takeProfit;

          const newPosition: OpenPosition = {
              id: positionId,
              positionType: 'spot',
              symbol,
              symbolName,
              size,
              averageEntryPrice: currentPrice,
              currentPrice,
              side: 'buy',
              unrealizedPnl: 0,
              priceChgPct: 0,
              details,
          };
          saveSubcollectionDoc('openPositions', newPosition.id, newPosition);
      }
      
      const newTrade: Omit<PaperTrade, 'id'> = {
        positionId: positionId!,
        positionType: 'spot',
        symbol,
        symbolName,
        size,
        price: currentPrice,
        side: 'buy',
        leverage: null, 
        timestamp: Date.now(),
        status: 'open',
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);
      
      toast({ title: "Spot Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName}` });
    },
    [balance, openPositions, toast, saveSubcollectionDoc, saveDataToFirestore, userContextDocRef]
  );

  const futuresBuy = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy = 'manual'
  ) => {
      if (!userContextDocRef) return;
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 - (1 / leverage));

      const details: OpenPositionDetails = { triggeredBy, status: 'open' };
      if (stopLoss !== undefined) details.stopLoss = stopLoss;
      if (takeProfit !== undefined) details.takeProfit = takeProfit;

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
          priceChgPct: 0,
          details,
      };

      const newBalance = balance - collateral;
      saveDataToFirestore({ balance: newBalance });
      saveSubcollectionDoc('openPositions', newPosition.id, newPosition);

      const newTrade: Omit<PaperTrade, 'id'> = {
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
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);

      toast({ title: "Futures Trade Executed", description: `LONG ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast, saveDataToFirestore, saveSubcollectionDoc, userContextDocRef]);

  const futuresSell = useCallback((
    symbol: string,
    collateral: number,
    entryPrice: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number,
    triggeredBy = 'manual'
  ) => {
      if (!userContextDocRef) return;
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 + (1 / leverage));

      const details: OpenPositionDetails = { triggeredBy, status: 'open' };
      if (stopLoss !== undefined) details.stopLoss = stopLoss;
      if (takeProfit !== undefined) details.takeProfit = takeProfit;

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
          priceChgPct: 0,
          details,
      };

      const newBalance = balance - collateral;
      saveDataToFirestore({ balance: newBalance });
      saveSubcollectionDoc('openPositions', newPosition.id, newPosition);

      const newTrade: Omit<PaperTrade, 'id'> = {
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
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);

      toast({ title: "Futures Trade Executed", description: `SHORT ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast, saveDataToFirestore, saveSubcollectionDoc, userContextDocRef]);
  
  const formatPrice = (price?: number) => {
    if (price === undefined || isNaN(price)) return "N/A";
    const options: Intl.NumberFormatOptions = {
        style: "currency",
        currency: "USD",
    };
    if (Math.abs(price) < 1) {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 8;
    } else {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 4;
    }
    return price.toLocaleString('en-US', options);
  };
  
  const executeTrigger = useCallback((trigger: TradeTrigger, currentPrice: number) => {
    
    toast({
        title: 'Trade Trigger Executed!',
        description: `Executing ${trigger.action} for ${trigger.symbolName} at ${formatPrice(currentPrice)}`
    });

    const symbolName = trigger.type === 'spot' ? trigger.symbolName : trigger.symbolName.replace(/M$/, "");

    if (trigger.type === 'spot') {
        buy(trigger.symbol, symbolName, trigger.amount, currentPrice, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.id}`);
    } else if (trigger.type === 'futures') {
        if (trigger.action === 'long') {
            futuresBuy(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.id}`);
        } else {
            futuresSell(trigger.symbol, trigger.amount, currentPrice, trigger.leverage, trigger.stopLoss, trigger.takeProfit, `trigger:${trigger.id}`);
        }
    }
    
    deleteSubcollectionDoc('tradeTriggers', trigger.id);

    if (trigger.cancelOthers) {
        tradeTriggers.forEach(t => {
            if (t.symbol === trigger.symbol && t.id !== trigger.id) {
                deleteSubcollectionDoc('tradeTriggers', t.id);
            }
        });
    }
  }, [buy, futuresBuy, futuresSell, toast, deleteSubcollectionDoc, tradeTriggers]);
  
  const closePosition = useCallback((positionId: string) => {
    const pos = openPositions.find(p => p.id === positionId);
    if (!pos) return;
  
    saveSubcollectionDoc('openPositions', positionId, { details: { ...pos.details, status: 'closing' } });
    
    toast({
        title: "Position Closing",
        description: `${pos.symbolName} position is being processed for closure.`
    });
  }, [openPositions, toast, saveSubcollectionDoc]);


  const processUpdateRef = useRef((symbol: string, isSpot: boolean, data: any) => {});
  useEffect(() => {
    processUpdateRef.current = (symbol: string, isSpot: boolean, data: Partial<SpotSnapshotData | FuturesSnapshotData>) => {
        let newPrice: number | undefined, priceChgPct: number | undefined;

        if (isSpot) {
            const spotData = data as SpotSnapshotData;
            newPrice = spotData.lastTradedPrice ?? undefined;
            priceChgPct = spotData.changeRate ?? undefined;
        } else {
            const futuresData = data as FuturesSnapshotData;
            newPrice = futuresData.lastPrice ?? undefined;
            priceChgPct = futuresData.priceChgPct ?? undefined;
        }

        if (newPrice === undefined || isNaN(newPrice) || newPrice === 0) return;
        
        setOpenPositions(prev =>
          prev.map(p => {
              if (p.symbol === symbol) {
                  if (p.details?.status !== 'closing') {
                      if (p.details?.stopLoss && ((p.side === 'long' || p.side === 'buy') ? newPrice! <= p.details.stopLoss : newPrice! >= p.details.stopLoss)) {
                          positionsToCloseIds.current.add(p.id);
                      } else if (p.details?.takeProfit && ((p.side === 'long' || p.side === 'buy') ? newPrice! >= p.details.takeProfit : newPrice! <= p.details.takeProfit)) {
                          positionsToCloseIds.current.add(p.id);
                      }
                  }

                  return { 
                      ...p, 
                      currentPrice: newPrice!,
                      unrealizedPnl: (newPrice! - p.averageEntryPrice) * p.size * (p.side === 'short' ? -1 : 1),
                      priceChgPct: priceChgPct ?? p.priceChgPct
                  };
              }
              return p;
          })
        );
        
        setWatchlist(prev => prev.map(item =>
          item.symbol === symbol
            ? { ...item, currentPrice: newPrice!, priceChgPct: priceChgPct ?? item.priceChgPct }
            : item
        ));

        const alert = priceAlerts[symbol];
        if (alert && !alert.triggered) {
            const conditionMet = (alert.condition === 'above' && newPrice >= alert.price) || (alert.condition === 'below' && newPrice <= alert.price);
            if (conditionMet) {
                triggeredAlerts.current.add(symbol);
            }
        }
        
        tradeTriggers.forEach(trigger => {
            if (trigger.symbol === symbol) {
                const conditionMet = (trigger.condition === 'above' && newPrice! >= trigger.targetPrice) || (trigger.condition === 'below' && newPrice! <= trigger.targetPrice);
                if (conditionMet) {
                    executedTriggerIds.current.add(trigger.id);
                }
            }
        });
    };
  }, [priceAlerts, tradeTriggers]);

  useEffect(() => {
    if (executedTriggerIds.current.size > 0) {
      const triggersToExecute = Array.from(executedTriggerIds.current);
      executedTriggerIds.current.clear();
      
      triggersToExecute.forEach(triggerId => {
        const trigger = tradeTriggers.find(t => t.id === triggerId);
        const watchlistItem = watchlist.find(w => w.symbol === trigger?.symbol);
        if (trigger && watchlistItem?.currentPrice) {
          executeTrigger(trigger, watchlistItem.currentPrice);
        }
      });
    }

    if (positionsToCloseIds.current.size > 0) {
      const positionsToActOn = Array.from(positionsToCloseIds.current);
      positionsToCloseIds.current.clear();

      positionsToActOn.forEach(positionId => {
        closePosition(positionId);
      });
    }
    
    if (triggeredAlerts.current.size > 0) {
        const alertsToFire = Array.from(triggeredAlerts.current);
        triggeredAlerts.current.clear();

        alertsToFire.forEach(symbol => {
            const alert = priceAlerts[symbol];
            if (alert) {
                const updatedAlert = { ...alert, triggered: true, notified: true };
                saveSubcollectionDoc('priceAlerts', symbol, updatedAlert);
                toast({ title: "Price Alert Triggered!", description: `${symbol} has reached your alert price of ${alert.price}.` });
            }
        });
    }

  }, [openPositions, tradeTriggers, watchlist, priceAlerts, executeTrigger, closePosition, saveSubcollectionDoc, toast]);


  const addTradeTrigger = useCallback((trigger: Omit<TradeTrigger, 'id'>) => {
    const newTrigger: TradeTrigger = {
      ...trigger,
      id: crypto.randomUUID(),
      details: { status: 'active' },
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
        executeTrigger(newTrigger as TradeTrigger, currentPrice);
    } else {
        saveSubcollectionDoc('tradeTriggers', newTrigger.id, newTrigger);
        toast({ title: 'Trade Trigger Set', description: `Trigger set for ${trigger.symbolName}.` });
    }
  }, [toast, watchlist, executeTrigger, saveSubcollectionDoc]);

  const updateTradeTrigger = useCallback((triggerId: string, updates: Partial<TradeTrigger>) => {
    const triggerToUpdate = tradeTriggers.find(t => t.id === triggerId);
    if (triggerToUpdate) {
        const updatedTrigger = { ...triggerToUpdate, ...updates };
        saveSubcollectionDoc('tradeTriggers', triggerId, updatedTrigger);
        toast({ title: 'Trigger Updated', description: `Trigger for ${updatedTrigger.symbolName} has been updated.` });
    }
  }, [toast, saveSubcollectionDoc, tradeTriggers]);
  

  const logAiAction = useCallback((action: AgentAction) => {
    const logEntry = { ...action, executedAt: Date.now() };
    saveDataToFirestore({ aiActionLogs: [...aiActionLogs, logEntry] });
  }, [aiActionLogs, saveDataToFirestore]);
  
  const removeActionFromPlan = useCallback((actionToRemove: AgentAction) => {
    if (!lastAiActionPlan) return;
    const newPlan = lastAiActionPlan.plan.filter(action => JSON.stringify(action) !== JSON.stringify(actionToRemove));
    const updatedPlan = { ...lastAiActionPlan, plan: newPlan };
    saveDataToFirestore({ lastAiActionPlan: updatedPlan });
  }, [lastAiActionPlan, saveDataToFirestore]);

  const handleAiTriggerAnalysis = useCallback(async (isScheduled = false): Promise<AgentActionPlan & {isLoading: boolean}> => {
    if (watchlist.length === 0) {
      const msg = "Watchlist is empty, skipping analysis.";
      if (!isScheduled) {
        toast({ title: "AI Analysis Skipped", description: "Please add items to your watchlist first.", variant: "destructive"});
      }
      return { analysis: msg, plan: [], isLoading: false };
    }

    const { equity, realizedPnl, unrealizedPnl, winRate, wonTrades, lostTrades } = accountMetrics;
    const currentAccountMetrics = {
      balance,
      equity,
      realizedPnl: realizedPnl,
      unrealizedPnl: unrealizedPnl,
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
      
      saveDataToFirestore({ lastAiActionPlan: response });

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
        toast({ 
            title: 'AI Auto-Execution Complete', 
            description: `${executedCount} action(s) were executed automatically. Analysis:\n${response.analysis}`
        });
        const clearedPlan = { ...response, plan: [] };
        saveDataToFirestore({ lastAiActionPlan: clearedPlan });
        return { analysis: response.analysis, plan: [], isLoading: false };
      } else {
        return { ...response, isLoading: false };
      }

    } catch (error) {
      console.error("AI Trigger Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      if (!isScheduled) {
         toast({ title: "AI Analysis Failed", description: errorMessage, variant: "destructive"});
      }
      return { analysis: `An error occurred: ${errorMessage}`, plan: [], isLoading: false };
    }
  }, [watchlist, aiSettings, tradeTriggers, openPositions, balance, accountMetrics, toast, addTradeTrigger, updateTradeTrigger, removeTradeTrigger, logAiAction, updatePositionSlTp, saveDataToFirestore]);
  
  const setAutomationConfig = useCallback((config: AutomationConfig) => {
    const newConfig: AutomationConfig = { ...config };
    if (config.updateMode === 'auto-refresh') {
        newConfig.lastRun = Date.now();
    } else {
        newConfig.lastRun = null;
    }
    saveDataToFirestore({ automationConfig: newConfig });
    if (config.updateMode === 'auto-refresh') {
        toast({ title: 'Automation Saved', description: `Watchlist will auto-refresh every ${config.refreshInterval / 60000} minutes.` });
    } else {
        toast({ title: 'Automation Saved', description: `Watchlist auto-refresh has been disabled.` });
    }
  }, [toast, saveDataToFirestore]);

  
  const setAiSettings = useCallback((settings: AiTriggerSettings) => {
      const newSettings: AiTriggerSettings = { ...settings };
      if (settings.scheduleInterval) {
          newSettings.nextRun = Date.now() + settings.scheduleInterval;
      } else {
          newSettings.nextRun = null;
      }
      saveDataToFirestore({ aiSettings: newSettings });
      if (!settings.scheduleInterval) {
          toast({ title: 'AI Automation Saved', description: `AI agent auto-run has been disabled.` });
      } else {
          toast({ title: 'AI Automation Saved', description: `AI agent will run every ${settings.scheduleInterval / 60000} minutes.` });
      }
  }, [toast, saveDataToFirestore]);

  const applyWatchlistAutomation = useCallback(async (config: AutomationConfig, isManualScrape: boolean = false) => {
    if (isManualScrape) {
      toast({ title: 'Automation Running', description: 'Fetching screener data to build watchlist...' });
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

        let orderIndex = 0;
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
                selected = sorted.slice(-rule.count).reverse();
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
                        high: isSpot ? parseFloat((item as KucoinTicker).high) : (item as KucoinFuturesContract).highPrice,
                        low: isSpot ? parseFloat((item as KucoinTicker).low) : (item as KucoinFuturesContract).lowPrice,
                        order: orderIndex++,
                    });
                }
            });
        });
        
        if (userContextDocRef && firestore) {
            const batch = writeBatch(firestore);
            
            if (config.clearExisting) {
                watchlist.forEach(item => {
                  batch.delete(doc(userContextDocRef, 'watchlist', item.symbol));
                });
            }
            
            finalItems.forEach(item => {
                batch.set(doc(userContextDocRef, 'watchlist', item.symbol), item);
            });
    
            await batch.commit().catch(error => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userContextDocRef.path,
                operation: 'write',
                }));
            });
        }
        
        if (isManualScrape) {
          toast({ title: 'Watchlist Updated', description: `Watchlist has been updated based on your automation rules.`});
        }
    } catch(error) {
      console.error('Watchlist automation failed:', error);
      if (isManualScrape) {
        toast({ title: 'Automation Failed', description: 'Could not fetch screener data.', variant: 'destructive'});
      }
    }
  }, [toast, futuresContracts, userContextDocRef, firestore, watchlist]);

  const symbolsToWatch = useMemo(() => {
    if (!isLoaded) return { spot: [], futures: [] };
    const spot = new Set<string>();
    const futures = new Set<string>();
    openPositions.forEach(p => (p.positionType === 'spot' ? spot : futures).add(p.symbol));
    tradeTriggers.forEach(t => (t.type === 'spot' ? spot : futures).add(t.symbol));
    watchlist.forEach(w => (w.type === 'spot' ? spot : futures).add(w.symbol));
    return { spot: Array.from(spot), futures: Array.from(futures) };
  }, [isLoaded, openPositions, tradeTriggers, watchlist]);

  const setupWebSocket = useCallback(async (
      wsRef: React.MutableRefObject<WebSocket | null>,
      statusSetter: React.Dispatch<React.SetStateAction<string>>,
      pingRef: React.MutableRefObject<NodeJS.Timeout | null>,
      reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
      reconnectAttemptsRef: React.MutableRefObject<number>,
      tokenFetcher: () => Promise<any>,
      urlBuilder: (token: string, instance: any) => string,
      onMessageHandler: (event: MessageEvent) => void,
      subscriptions: string[],
      topicBuilder: (symbol: string) => string
  ) => {
      if (wsRef.current || subscriptions.length === 0) {
          return;
      }
      statusSetter("fetching_token");
      try {
          const tokenData = await tokenFetcher();
          if (tokenData.code !== "200000") throw new Error("Failed to fetch WebSocket token");

          reconnectAttemptsRef.current = 0;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

          const { token, instanceServers } = tokenData.data;
          const wsUrl = urlBuilder(token, instanceServers[0]);

          statusSetter("connecting");
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
              statusSetter("connected");
              if (pingRef.current) clearInterval(pingRef.current);
              pingRef.current = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
              }, instanceServers[0].pingInterval / 2);
              subscriptions.forEach(symbol => {
                  ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: topicBuilder(symbol), response: true }));
              });
          };

          ws.onmessage = onMessageHandler;

          const handleCloseOrError = () => {
              wsRef.current = null;
              if (pingRef.current) clearInterval(pingRef.current);
              statusSetter("disconnected");
              if (subscriptions.length > 0) {
                  reconnectAttemptsRef.current++;
                  const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000);
                  reconnectTimeoutRef.current = setTimeout(() => setupWebSocket(wsRef, statusSetter, pingRef, reconnectTimeoutRef, reconnectAttemptsRef, tokenFetcher, urlBuilder, onMessageHandler, subscriptions, topicBuilder), delay);
              }
          };

          ws.onclose = handleCloseOrError;
          ws.onerror = handleCloseOrError;

      } catch (error) {
          statusSetter("error");
          console.error("WebSocket setup error:", error);
      }
  }, []);

  const handleSpotMessage = useCallback((event: MessageEvent) => {
    const message: IncomingKucoinWebSocketMessage = JSON.parse(event.data);
    if (message.type === "message" && message.subject === "trade.snapshot") {
      const wrapper = message.data as KucoinSnapshotDataWrapper;
      const symbol = message.topic.split(":")[1];
      processUpdateRef.current(symbol, true, wrapper.data);
    }
  }, []);

  const handleFuturesMessage = useCallback((event: MessageEvent) => {
      const message: IncomingKucoinFuturesWebSocketMessage = JSON.parse(event.data);
      if (message.type === 'message' && message.subject === 'snapshot') {
          processUpdateRef.current(message.data.symbol, false, message.data as any);
      }
  }, []);

  useEffect(() => {
    if (symbolsToWatch.spot.length > 0) {
        setupWebSocket(spotWs, setSpotWsStatus, spotPingIntervalRef, spotReconnectTimeoutRef, spotReconnectAttempts, getSpotWsToken, (token, s) => `${s.endpoint}?token=${token}`, handleSpotMessage, symbolsToWatch.spot, (s) => `/market/snapshot:${s}`);
    }
    return () => {
        spotWs.current?.close();
        if (spotPingIntervalRef.current) clearInterval(spotPingIntervalRef.current);
        if (spotReconnectTimeoutRef.current) clearTimeout(spotReconnectTimeoutRef.current);
    }
  }, [symbolsToWatch.spot, setupWebSocket, handleSpotMessage]);

  useEffect(() => {
    if (symbolsToWatch.futures.length > 0) {
        setupWebSocket(futuresWs, setFuturesWsStatus, futuresPingIntervalRef, futuresReconnectTimeoutRef, futuresReconnectAttempts, getFuturesWsToken, (token, s) => `${s.endpoint}?token=${token}`, handleFuturesMessage, symbolsToWatch.futures, (s) => `/contractMarket/snapshot:${s}`);
    }
     return () => {
        futuresWs.current?.close();
        if (futuresPingIntervalRef.current) clearInterval(futuresPingIntervalRef.current);
        if (futuresReconnectTimeoutRef.current) clearTimeout(futuresReconnectTimeoutRef.current);
    }
  }, [symbolsToWatch.futures, setupWebSocket, handleFuturesMessage]);


  const closeAllPositions = useCallback(() => {
    openPositions.forEach(p => {
        closePosition(p.id);
    });
  }, [openPositions, closePosition]);


  const addPriceAlert = useCallback((symbol: string, price: number, condition: 'above' | 'below') => {
    const newAlert: PriceAlert = { price, condition, triggered: false, notified: false };
    saveSubcollectionDoc('priceAlerts', symbol, newAlert);
    toast({ title: 'Alert Set', description: `Alert set for ${symbol} when price is ${condition} ${price}.` });
  }, [toast, saveSubcollectionDoc]);

  const removePriceAlert = useCallback((symbol: string) => {
    deleteSubcollectionDoc('priceAlerts', symbol);
    toast({ title: 'Alert Removed', description: `Alert for ${symbol} removed.` });
  }, [toast, deleteSubcollectionDoc]);

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number, order?: number) => {
    const existingIndex = watchlist.findIndex(item => item.symbol === symbol);
    
    if (existingIndex > -1) {
      deleteSubcollectionDoc('watchlist', symbol);
      toast({ title: 'Watchlist', description: `${symbolName} removed from watchlist.` });
    } else {
        const newItem: WatchlistItem = { 
            symbol, 
            symbolName, 
            type, 
            currentPrice: 0, 
            high: high ?? undefined, 
            low: low ?? undefined,
            priceChgPct: priceChgPct ?? 0,
            order: order ?? 0,
        };
        if (type === 'spot' && futuresContracts.length > 0) {
            const baseCurrency = symbolName.split('-')[0]; 
            const futuresEquivalent = futuresContracts.find(c => c.baseCurrency === baseCurrency);
            if (futuresEquivalent) {
                newItem.futuresSymbol = futuresEquivalent.symbol;
                newItem.hasFutures = true;
            }
        }
        saveSubcollectionDoc('watchlist', newItem.symbol, newItem);
        toast({ title: 'Watchlist', description: `${symbolName} added to watchlist.` });
    }
  }, [futuresContracts, toast, saveSubcollectionDoc, deleteSubcollectionDoc, watchlist]);

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
        isLoaded,
        equity: equity,
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
        aiSettings,
        setAiSettings,
        handleAiTriggerAnalysis,
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
