
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
  getDoc,
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
  
  const [nextScrapeTime, setNextScrapeTime] = useState<number>(0);
  const [nextAiScrapeTime, setNextAiScrapeTime] = useState(0);

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

  const automationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiAutomationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            // Document doesn't exist, create it with initial values
            const initialContext: FirestorePaperTradingContext = {
                balance: INITIAL_BALANCE,
                automationConfig: INITIAL_AUTOMATION_CONFIG,
                aiSettings: INITIAL_AI_SETTINGS,
                lastAiActionPlan: null,
                aiActionLogs: [],
            };
            setDocumentNonBlocking(userContextDocRef, initialContext);
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
    const createSubcollectionListener = <T extends {id: string}>(collectionName: string, setState: React.Dispatch<React.SetStateAction<T[]>>) => {
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

    // Cleanup on unmount or user change
    return () => {
      unsubscribers.forEach(unsub => unsub());
      setIsLoaded(false); // Reset loaded state for next user
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

          const details: OpenPositionDetails = { ...(existingPosition.details || {}), triggeredBy };
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
          const details: OpenPositionDetails = { triggeredBy };
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
      
      const newTrade: PaperTrade = {
        id: crypto.randomUUID(),
        positionId: positionId,
        positionType: 'spot',
        symbol,
        symbolName,
        size,
        price: currentPrice,
        side: 'buy',
        timestamp: Date.now(),
        status: 'open',
      };
      addDocumentNonBlocking(collection(userContextDocRef!, 'tradeHistory'), newTrade);
      
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
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 - (1 / leverage));

      const details: OpenPositionDetails = { triggeredBy };
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

      const newTrade: PaperTrade = {
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
      };
      addDocumentNonBlocking(collection(userContextDocRef!, 'tradeHistory'), newTrade);

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
      if (balance < collateral) {
          toast({ title: "Error", description: "Insufficient balance for collateral.", variant: "destructive" });
          return;
      }
      const positionValue = collateral * leverage;
      const size = positionValue / entryPrice;
      const liquidationPrice = entryPrice * (1 + (1 / leverage));

      const details: OpenPositionDetails = { triggeredBy };
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

      const newTrade: PaperTrade = {
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
      };
      addDocumentNonBlocking(collection(userContextDocRef!, 'tradeHistory'), newTrade);

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
    setTimeout(() => {
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
      
      // Delete the executed trigger and any others for the same symbol if 'cancelOthers' is true
      deleteSubcollectionDoc('tradeTriggers', trigger.id);
      if (trigger.cancelOthers) {
        tradeTriggers.forEach(t => {
          if (t.symbol === trigger.symbol && t.id !== trigger.id) {
            deleteSubcollectionDoc('tradeTriggers', t.id);
          }
        });
      }
    }, 0);
  }, [buy, futuresBuy, futuresSell, toast, deleteSubcollectionDoc, tradeTriggers]);
  
 const closePosition = useCallback((positionId: string, reason: string = 'Manual Close', closePriceParam?: number) => {
    setTimeout(() => {
        const pos = openPositions.find(p => p.id === positionId);
        if (!pos) return;

        const exitPrice = closePriceParam ?? pos.currentPrice ?? 0;
        if (exitPrice === 0) return;

        let pnl = 0;
        let returnedValue = 0;

        if (reason === 'Position Liquidated' && pos.positionType === 'futures') {
            const collateral = (pos.size * pos.averageEntryPrice) / (pos.leverage || 1);
            pnl = -collateral;
            returnedValue = 0;
        } else if (pos.positionType === 'spot') {
            pnl = (exitPrice - pos.averageEntryPrice) * pos.size;
            returnedValue = pos.size * exitPrice;
        } else if (pos.positionType === 'futures') {
            const pnlMultiplier = pos.side === 'long' ? 1 : -1;
            pnl = (exitPrice - pos.averageEntryPrice) * pos.size * pnlMultiplier;
            const leverage = pos.leverage ?? 1;
            const collateral = (pos.size * pos.averageEntryPrice) / leverage;
            returnedValue = collateral + pnl;
        }

        const newBalanceValue = balance + returnedValue;
        saveDataToFirestore({ balance: newBalanceValue });

        const closedTrade: PaperTrade = {
            id: crypto.randomUUID(),
            positionId: pos.id,
            positionType: pos.positionType,
            symbol: pos.symbol,
            symbolName: pos.symbolName,
            size: pos.size,
            price: exitPrice,
            side: pos.positionType === 'futures' ? (pos.side === 'long' ? 'sell' : 'buy') : 'sell',
            timestamp: Date.now(),
            status: 'closed',
            pnl,
            ...(pos.leverage && { leverage: pos.leverage }),
        };
        
        addDocumentNonBlocking(collection(userContextDocRef!, 'tradeHistory'), closedTrade);
        deleteSubcollectionDoc('openPositions', positionId);
        
        toast({ title: `${reason}: Position Closed`, description: `Closed ${pos.symbolName} for a PNL of ${pnl.toFixed(2)} USD` });
    }, 0);
  }, [balance, openPositions, saveDataToFirestore, deleteSubcollectionDoc, toast, userContextDocRef]);

  
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

        // Check and execute price alerts
        const alert = priceAlerts[symbol];
        if (alert && !alert.triggered) {
            const conditionMet = (alert.condition === 'above' && newPrice >= alert.price) || (alert.condition === 'below' && newPrice <= alert.price);
            if (conditionMet) {
                const updatedAlert = { ...alert, triggered: true, notified: true };
                saveSubcollectionDoc('priceAlerts', symbol, updatedAlert);
                toast({ title: "Price Alert Triggered!", description: `${symbol} has reached your alert price of ${alert.price}.` });
            }
        }
        
        // Check and execute trade triggers
        const executedTriggerIds = new Set<string>();
        tradeTriggers.forEach(trigger => {
            if (trigger.symbol === symbol && trigger.status === 'active') {
                const conditionMet = (trigger.condition === 'above' && newPrice! >= trigger.targetPrice) || (trigger.condition === 'below' && newPrice! <= trigger.targetPrice);
                if (conditionMet) {
                    executeTrigger(trigger, newPrice!);
                }
            }
        });
        
        // Update watchlist item with new price data, including snapshot for spot
        const updatedWatchlistItem: Partial<WatchlistItem> = {
            currentPrice: newPrice,
            priceChgPct: priceChgPct ?? undefined,
        };
        if (isSpot) {
            updatedWatchlistItem.snapshotData = data as SpotSnapshotData;
        }
        saveSubcollectionDoc('watchlist', symbol, updatedWatchlistItem);

        // Update open positions
        openPositions.forEach(p => {
            if (p.symbol === symbol) {
                const unrealizedPnl = (newPrice! - p.averageEntryPrice) * p.size * (p.side === 'short' ? -1 : 1);
                const updatedPosition = { ...p, currentPrice: newPrice!, unrealizedPnl, priceChgPct: priceChgPct ?? p.priceChgPct };
                
                const { details, liquidationPrice, side } = updatedPosition;
                if (liquidationPrice && ((side === 'long' && newPrice! <= liquidationPrice) || (side === 'short' && newPrice! >= liquidationPrice))) {
                    closePosition(updatedPosition.id, 'Position Liquidated', liquidationPrice);
                } else if (details?.stopLoss && ((side !== 'short' && newPrice! <= details.stopLoss) || (side === 'short' && newPrice! >= details.stopLoss))) {
                    closePosition(updatedPosition.id, 'Stop Loss Hit', details.stopLoss);
                } else if (details?.takeProfit && ((side !== 'short' && newPrice! >= details.takeProfit) || (side === 'short' && newPrice! <= details.takeProfit))) {
                    closePosition(updatedPosition.id, 'Take Profit Hit', details.takeProfit);
                } else {
                    // Only save to Firestore if the position is not being closed
                    saveSubcollectionDoc('openPositions', p.id, updatedPosition);
                }
            }
        });
    };
}, [toast, executeTrigger, closePosition, saveSubcollectionDoc, priceAlerts, tradeTriggers, openPositions]);

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
    saveDataToFirestore({ automationConfig: config });
    if (config.updateMode === 'auto-refresh') {
        toast({ title: 'Automation Saved', description: `Watchlist will auto-refresh every ${config.refreshInterval / 60000} minutes.` });
    } else {
        if (automationIntervalRef.current) {
          clearInterval(automationIntervalRef.current);
          automationIntervalRef.current = null;
        }
        toast({ title: 'Automation Saved', description: `Watchlist auto-refresh has been disabled.` });
    }
  }, [toast, saveDataToFirestore]);
  
  const setAiSettings = useCallback((settings: AiTriggerSettings) => {
      saveDataToFirestore({ aiSettings: settings });
      if (!settings.scheduleInterval) {
          toast({ title: 'AI Automation Saved', description: `AI agent auto-run has been disabled.` });
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
                        high: isSpot ? parseFloat((item as KucoinTicker).high) : (item as KucoinFuturesContract).highPrice,
                        low: isSpot ? parseFloat((item as KucoinTicker).low) : (item as KucoinFuturesContract).lowPrice,
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
  
  useEffect(() => {
    if (!isLoaded || automationConfig.updateMode !== 'auto-refresh' || !automationConfig.refreshInterval) {
        if (automationIntervalRef.current) clearInterval(automationIntervalRef.current);
        return;
    }

    const runAutomation = () => applyWatchlistAutomation(automationConfig);
    automationIntervalRef.current = setInterval(runAutomation, automationConfig.refreshInterval);
    setNextScrapeTime(Date.now() + automationConfig.refreshInterval);

    return () => {
        if (automationIntervalRef.current) clearInterval(automationIntervalRef.current);
    };
  }, [isLoaded, automationConfig, applyWatchlistAutomation]);


  useEffect(() => {
    if (!isLoaded || !aiSettings.scheduleInterval) {
      if (aiAutomationIntervalRef.current) clearInterval(aiAutomationIntervalRef.current);
      return;
    }

    const runScheduledAnalysis = () => handleAiTriggerAnalysis(true);
    aiAutomationIntervalRef.current = setInterval(runScheduledAnalysis, aiSettings.scheduleInterval);
    setNextAiScrapeTime(Date.now() + aiSettings.scheduleInterval);
    
    return () => {
      if (aiAutomationIntervalRef.current) clearInterval(aiAutomationIntervalRef.current);
    };
  }, [isLoaded, aiSettings.scheduleInterval, handleAiTriggerAnalysis]);

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

            if (spotSubscriptionsRef.current.size > 0) { 
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
        toast({ title: "Spot WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
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
            
            if (futuresSubscriptionsRef.current.size > 0) { 
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
        toast({ title: "Futures WebSocket Error", description: `Connection failed: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast]);

  const allSpotSymbols = useMemo(() => {
    if (!isLoaded) return [];
    const symbols = new Set<string>();
    openPositions.forEach(p => p.positionType === 'spot' && symbols.add(p.symbol));
    watchlist.forEach(w => w.type === 'spot' && symbols.add(w.symbol));
    tradeTriggers.forEach(t => t.type === 'spot' && symbols.add(t.symbol));
    return Array.from(symbols);
  }, [openPositions, watchlist, tradeTriggers, isLoaded]);

  const allFuturesSymbols = useMemo(() => {
    if (!isLoaded) return [];
    const symbols = new Set<string>();
    openPositions.forEach(p => p.positionType === 'futures' && symbols.add(p.symbol));
    watchlist.forEach(w => w.type === 'futures' && symbols.add(w.symbol));
    tradeTriggers.forEach(t => t.type === 'futures' && symbols.add(t.symbol));
    return Array.from(symbols);
  }, [openPositions, watchlist, tradeTriggers, isLoaded]);
  
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
  

  const closeAllPositions = useCallback(() => {
    openPositions.forEach(p => {
        setTimeout(() => closePosition(p.id, 'Close All'), 0);
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

  const toggleWatchlist = useCallback((symbol: string, symbolName: string, type: 'spot' | 'futures', high?: number, low?: number, priceChgPct?: number) => {
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
