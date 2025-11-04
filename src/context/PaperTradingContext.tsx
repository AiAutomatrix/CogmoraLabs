
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
  collection,
  writeBatch,
  getDocs,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
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
import type { KucoinTicker } from "@/hooks/useKucoinAllTickersSocket";

// Custom hook to get previous value
function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}


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
  isAiLoading: boolean;
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
  handleAiTriggerAnalysis: () => Promise<void>;
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
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const dataLoadedRef = useRef(false);
  const [futuresContracts, setFuturesContracts] = useState<KucoinFuturesContract[]>([]);

  // Queues for processing side effects from price updates
  const triggeredAlerts = useRef(new Set<string>());

  const [spotWsStatus, setSpotWsStatus] = useState<string>("idle");
  const spotWs = useRef<WebSocket | null>(null);
  const spotPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const spotReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const spotReconnectAttempts = useRef(0);
  const spotSubscribedSymbols = useRef(new Set<string>());


  const [futuresWsStatus, setFuturesWsStatus] = useState<string>("idle");
  const futuresWs = useRef<WebSocket | null>(null);
  const futuresPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const futuresReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const futuresReconnectAttempts = useRef(0);
  const futuresSubscribedSymbols = useRef(new Set<string>());

  const userContextDocRef = useMemo(() => {
    if (user && firestore) {
      return doc(firestore, 'users', user.uid, 'paperTradingContext', 'main');
    }
    return null;
  }, [user, firestore]);

  // --- Start of Backend Action Detection Effects ---
  const prevPositions = usePrevious(openPositions);
  const prevTradeHistory = usePrevious(tradeHistory);

  useEffect(() => {
    if (!prevPositions || !isLoaded) return;

    if (openPositions.length > prevPositions.length) {
      const newPositionIds = new Set(openPositions.map(p => p.id));
      const oldPositionIds = new Set(prevPositions.map(p => p.id));
      const addedPositionId = [...newPositionIds].find(id => !oldPositionIds.has(id));

      if (addedPositionId) {
        const newPosition = openPositions.find(p => p.id === addedPositionId);
        if (newPosition && newPosition.details?.triggeredBy?.startsWith('trigger')) {
          toast({
            title: `Trade Executed by Trigger`,
            description: `${newPosition.side.toUpperCase()} ${newPosition.symbolName} @ ${formatPrice(newPosition.averageEntryPrice)}`
          });
        }
      }
    }
  }, [openPositions, prevPositions, isLoaded, toast]);
  
  useEffect(() => {
      if (!prevTradeHistory || !isLoaded) return;
  
      if (tradeHistory.length > prevTradeHistory.length) {
          const newHistoryIds = new Set(tradeHistory.map(t => t.id || ''));
          const oldHistoryIds = new Set(prevTradeHistory.map(t => t.id || ''));
          const addedTradeId = [...newHistoryIds].find(id => id && !oldHistoryIds.has(id));
  
          if (addedTradeId) {
              const newTrade = tradeHistory.find(t => t.id === addedTradeId);
              if (newTrade && newTrade.status === 'closed' && newTrade.pnl !== undefined && newTrade.pnl !== null) {
                  toast({
                      title: `Position Closed`,
                      description: `${newTrade.symbolName} | P&L: ${formatCurrency(newTrade.pnl)}`,
                      variant: newTrade.pnl >= 0 ? 'default' : 'destructive',
                  });
              }
          }
      }
  }, [tradeHistory, prevTradeHistory, isLoaded, toast]);

  const formatPrice = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: value < 0.1 ? 8 : 4 }).format(value);
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  // --- End of Backend Action Detection Effects ---


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
            const initialContext: Partial<FirestorePaperTradingContext> = {
                balance: INITIAL_BALANCE,
                equity: INITIAL_BALANCE,
                automationConfig: INITIAL_AUTOMATION_CONFIG,
                aiSettings: INITIAL_AI_SETTINGS,
                lastAiActionPlan: null,
                aiActionLogs: [],
            };
            setDocumentNonBlocking(userContextDocRef, initialContext, { merge: false });
        }
        if (!dataLoadedRef.current) {
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
          dataLoadedRef.current = true;
        }
      }
    );
    unsubscribers.push(unsubContext);

    const createSubcollectionListener = <T,>(collectionName: string, setState: React.Dispatch<React.SetStateAction<T[]>>, idKey: keyof T = 'id' as any) => {
      const collectionRef = collection(userContextDocRef, collectionName);
      const unsub = onSnapshot(collectionRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), [idKey]: doc.id } as T));
        setState(items);
      }, (error) => {
          console.error(`Error listening to ${collectionName}:`, error);
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'list',
          }));
      });
      unsubscribers.push(unsub);
    };

    const createRecordListener = <T,>(collectionName: string, setState: React.Dispatch<React.SetStateAction<Record<string, T>>>) => {
        const collectionRef = collection(userContextDocRef, collectionName);
        const unsub = onSnapshot(collectionRef, (snapshot) => {
            const items: Record<string, T> = {};
            snapshot.docs.forEach(doc => {
                items[doc.id] = doc.data() as T;
            });
            setState(items);
        }, (error) => {
            console.error(`Error listening to ${collectionName}:`, error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: collectionRef.path,
                operation: 'list',
            }));
        });
        unsubscribers.push(unsub);
    };

    createSubcollectionListener<OpenPosition>('openPositions', setOpenPositions, 'id');
    createSubcollectionListener<PaperTrade>('tradeHistory', setTradeHistory, 'id');
    createSubcollectionListener<WatchlistItem>('watchlist', setWatchlist, 'symbol');
    createSubcollectionListener<TradeTrigger>('tradeTriggers', setTradeTriggers, 'id');
    createRecordListener<PriceAlert>('priceAlerts', setPriceAlerts);


    return () => {
      unsubscribers.forEach(unsub => unsub());
      setIsLoaded(false);
      dataLoadedRef.current = false;
    };
  }, [userContextDocRef, firestore]);
  
  // New Effect to apply initial snapshot data to open positions
  useEffect(() => {
    // Only run if we have positions and haven't connected to websockets yet
    if (openPositions.length > 0 && !isWsConnected) {
        const applySnapshot = async () => {
            console.log("Applying initial price snapshot to open positions...");
            try {
                // Fetch both spot and futures tickers
                const spotRes = await fetch('/api/kucoin-tickers');
                const futuresRes = await fetch('/api/kucoin-futures-tickers');

                const spotTickerMap = new Map<string, KucoinTicker>();
                if (spotRes.ok) {
                    const spotData = await spotRes.json();
                    if (spotData?.data?.ticker) {
                        spotData.data.ticker.forEach((t: KucoinTicker) => spotTickerMap.set(t.symbol, t));
                    }
                }

                const futuresTickerMap = new Map<string, KucoinFuturesContract>();
                if (futuresRes.ok) {
                    const futuresData = await futuresRes.json();
                    if (futuresData?.data) {
                        futuresData.data.forEach((c: KucoinFuturesContract) => futuresTickerMap.set(c.symbol, c));
                    }
                }

                setOpenPositions(currentPositions => {
                    return currentPositions.map(pos => {
                        let newPrice: number | undefined;
                        if (pos.positionType === 'spot') {
                            const ticker = spotTickerMap.get(pos.symbol);
                            newPrice = ticker ? parseFloat(ticker.last) : undefined;
                        } else { // futures
                            const contract = futuresTickerMap.get(pos.symbol);
                            newPrice = contract ? contract.markPrice : undefined;
                        }

                        if (newPrice !== undefined && newPrice > 0) {
                            return {
                                ...pos,
                                currentPrice: newPrice,
                                unrealizedPnl: (newPrice - pos.averageEntryPrice) * pos.size * (pos.side === 'short' ? -1 : 1)
                            };
                        }
                        return pos; // Return original if no price found
                    });
                });
                console.log("Initial price snapshot applied successfully.");
            } catch (error) {
                console.error("Failed to fetch initial ticker snapshot:", error);
            }
        };

        applySnapshot();
    }
  }, [openPositions.length, isWsConnected]); // Reruns if positions appear, but stops after WebSocket connects.


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
        // Guard against running before user is authenticated
        if (!user) return;

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
  }, [user]); // Add user as a dependency

  const accountMetrics = useMemo(() => {
    const totalUnrealizedPNL = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    const equityValue = balance + totalUnrealizedPNL;
    const closedTrades = tradeHistory.filter((t) => t.status === "closed");
    const totalRealizedPNL = closedTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0), 0);

    const wonTrades = closedTrades.filter(t => t.pnl !== null && t.pnl !== undefined && t.pnl > 0).length;
    const lostTrades = closedTrades.filter(t => t.pnl !== null && t.pnl !== undefined && t.pnl <= 0).length;
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

  const equity = accountMetrics.equity;

  const updatePositionSlTp = useCallback((positionId: string, sl?: number, tp?: number) => {
    const pos = openPositions.find(p => p.id === positionId);
    if (!pos || !userContextDocRef) return;

    const detailsUpdate: Partial<OpenPositionDetails> = {};
    if (sl !== undefined) detailsUpdate.stopLoss = sl;
    if (tp !== undefined) detailsUpdate.takeProfit = tp;
    
    if (Object.keys(detailsUpdate).length > 0) {
        const positionRef = doc(userContextDocRef, 'openPositions', positionId);
        updateDocumentNonBlocking(positionRef, { details: { ...pos.details, ...detailsUpdate } });
        toast({ title: "Position Updated", description: `SL/TP updated for ${pos.symbolName}.` });
    }
  }, [openPositions, toast, userContextDocRef]);

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
          
          updateDocumentNonBlocking(doc(userContextDocRef, 'openPositions', positionId), { size: totalSize, averageEntryPrice: newAverageEntry, details });
      } else {
          positionId = crypto.randomUUID();
          
          const details: OpenPositionDetails = { triggeredBy, status: 'open' };
          if (stopLoss !== undefined) details.stopLoss = stopLoss;
          if (takeProfit !== undefined) details.takeProfit = takeProfit;
          
          const newPosition: OpenPosition = {
              id: positionId, positionType: 'spot', symbol, symbolName, size,
              averageEntryPrice: currentPrice, currentPrice: currentPrice, side: 'buy', details
          };
          setDocumentNonBlocking(doc(userContextDocRef, 'openPositions', positionId), newPosition, {});
      }
      
      const newTrade: Omit<PaperTrade, 'id'|'closePrice'|'closeTimestamp'> = {
        positionId: positionId!,
        positionType: 'spot', symbol, symbolName, size,
        entryPrice: currentPrice, side: 'buy', leverage: null,
        openTimestamp: Date.now(),
        status: 'open',
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);
      
      toast({ title: "Spot Trade Executed", description: `Bought ${size.toFixed(4)} ${symbolName}` });
    },
    [balance, openPositions, toast, saveDataToFirestore, userContextDocRef]
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
          id: crypto.randomUUID(), positionType: "futures", symbol, symbolName: symbol.replace(/M$/, ""),
          size, averageEntryPrice: entryPrice, currentPrice: entryPrice, side: "long",
          leverage, liquidationPrice, details
      };

      const newBalance = balance - collateral;
      saveDataToFirestore({ balance: newBalance });
      setDocumentNonBlocking(doc(userContextDocRef, 'openPositions', newPosition.id), newPosition, {});

      const newTrade: Omit<PaperTrade, 'id'|'closePrice'|'closeTimestamp'> = {
          positionId: newPosition.id, positionType: "futures", symbol, symbolName: newPosition.symbolName,
          size, entryPrice: entryPrice, side: "long", leverage, openTimestamp: Date.now(), status: "open",
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);

      toast({ title: "Futures Trade Executed", description: `LONG ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast, saveDataToFirestore, userContextDocRef]);

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
          id: crypto.randomUUID(), positionType: "futures", symbol, symbolName: symbol.replace(/M$/, ""),
          size, averageEntryPrice: entryPrice, currentPrice: entryPrice, side: "short",
          leverage, liquidationPrice, details
      };

      const newBalance = balance - collateral;
      saveDataToFirestore({ balance: newBalance });
      setDocumentNonBlocking(doc(userContextDocRef, 'openPositions', newPosition.id), newPosition, {});

      const newTrade: Omit<PaperTrade, 'id'|'closePrice'|'closeTimestamp'> = {
          positionId: newPosition.id, positionType: "futures", symbol, symbolName: newPosition.symbolName,
          size, entryPrice: entryPrice, side: "short", leverage, openTimestamp: Date.now(), status: "open",
      };
      addDocumentNonBlocking(collection(userContextDocRef, 'tradeHistory'), newTrade);

      toast({ title: "Futures Trade Executed", description: `SHORT ${size.toFixed(4)} ${newPosition.symbolName} @ ${entryPrice.toFixed(4)}` });
  }, [balance, toast, saveDataToFirestore, userContextDocRef]);
  
  const closePosition = useCallback(async (positionId: string) => {
    if (!firestore || !userContextDocRef) return;
    
    const pos = openPositions.find(p => p.id === positionId);
    if (!pos) {
      toast({ title: "Error", description: "Position not found.", variant: "destructive" });
      return;
    }
  
    const posDocRef = doc(userContextDocRef, 'openPositions', positionId);
    try {
      const detailsUpdate = {
        ...pos.details,
        status: 'closing',
        closePrice: pos.currentPrice,
      };
      await updateDocumentNonBlocking(posDocRef, { 'details': detailsUpdate });
      toast({
        title: 'Position Closing...',
        description: `${pos.symbolName} position is being processed for closure.`,
      });
    } catch (error) {
       console.error('Failed to mark position for closing:', error);
       toast({ title: "Error", description: "Could not initiate position closure.", variant: "destructive" });
       errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: posDocRef.path,
          operation: 'update',
       }));
    }
  }, [firestore, userContextDocRef, openPositions, toast]);

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
            newPrice = futuresData.markPrice ?? undefined;
            priceChgPct = futuresData.priceChgPct ?? undefined;
        }

        if (newPrice === undefined || isNaN(newPrice) || newPrice === 0) return;
        
        if (!isWsConnected) {
            setIsWsConnected(true);
        }

        setOpenPositions(prev =>
          prev.map(p => {
              if (p.symbol === symbol) {
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
            ? { ...item, currentPrice: newPrice!, priceChgPct: priceChgPct ?? item.priceChgPct, snapshotData: isSpot ? (data as SpotSnapshotData) : item.snapshotData }
            : item
        ));

        const alert = priceAlerts[symbol];
        if (alert && !alert.triggered) {
            const conditionMet = (alert.condition === 'above' && newPrice >= alert.price) || (alert.condition === 'below' && newPrice <= alert.price);
            if (conditionMet) {
                triggeredAlerts.current.add(symbol);
            }
        }
    };
  }, [priceAlerts, isWsConnected]);

  useEffect(() => {
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

  }, [openPositions, watchlist, priceAlerts, saveSubcollectionDoc, toast]);


  const addTradeTrigger = useCallback((trigger: Omit<TradeTrigger, 'id' | 'details'>) => {
    const newTrigger: TradeTrigger = {
      ...trigger,
      id: crypto.randomUUID(),
      details: { status: 'active' },
    };
    saveSubcollectionDoc('tradeTriggers', newTrigger.id, newTrigger);
    toast({ title: 'Trade Trigger Set', description: `Trigger set for ${trigger.symbolName}.` });
  }, [toast, saveSubcollectionDoc]);

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

  const handleAiTriggerAnalysis = useCallback(async (): Promise<void> => {
    toast({
        title: "AI Analysis Started...",
        description: "Check the AI Agent tab to see the plan.",
    });
    
    if (watchlist.length === 0) {
      toast({ title: "AI Analysis Skipped", description: "Please add items to your watchlist first.", variant: "destructive"});
      return;
    }
    setIsAiLoading(true);

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
      }

    } catch (error) {
      console.error("AI Trigger Analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ title: "AI Analysis Failed", description: errorMessage, variant: "destructive"});
      saveDataToFirestore({ lastAiActionPlan: { analysis: `An error occurred: ${errorMessage}`, plan: [] } });
    } finally {
        setIsAiLoading(false);
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
            let sourceData: (KucoinTicker | KucoinFuturesContract)[];
            let sortKey: 'volValue' | 'changeRate' | 'volumeOf24h' | 'priceChgPct';

            if (rule.source === 'spot') {
                sourceData = allSpotTickers;
                sortKey = rule.criteria.includes('volume') ? 'volValue' : 'changeRate';
            } else {
                sourceData = futuresContracts;
                sortKey = rule.criteria.includes('volume') ? 'volumeOf24h' : 'priceChgPct';
            }

            const sorted = [...sourceData].sort((a, b) => {
                const valA = parseFloat((a as any)[sortKey]) || 0;
                const valB = parseFloat((b as any)[sortKey]) || 0;
                return valB - valA;
            });

            let selected: (KucoinTicker | KucoinFuturesContract)[];
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
    const spot = new Set<string>();
    const futures = new Set<string>();
    openPositions.forEach(p => (p.positionType === 'spot' ? spot : futures).add(p.symbol));
    tradeTriggers.forEach(t => (t.type === 'spot' ? spot : futures).add(t.symbol));
    watchlist.forEach(w => (w.type === 'spot' ? spot : futures).add(w.symbol));
    return { spot: Array.from(spot), futures: Array.from(futures) };
  }, [openPositions, tradeTriggers, watchlist]);

   useEffect(() => {
    if (dataLoadedRef.current) {
        const needsSpot = symbolsToWatch.spot.length > 0;
        const needsFutures = symbolsToWatch.futures.length > 0;

        const spotReady = !needsSpot || isWsConnected;
        const futuresReady = !needsFutures || isWsConnected;

        if (spotReady && futuresReady) {
            setIsLoaded(true);
        }
    }
  }, [isWsConnected, symbolsToWatch, dataLoadedRef]);

  const setupWebSocket = useCallback(async (
      wsRef: React.MutableRefObject<WebSocket | null>,
      statusSetter: React.Dispatch<React.SetStateAction<string>>,
      pingRef: React.MutableRefObject<NodeJS.Timeout | null>,
      reconnectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
      reconnectAttemptsRef: React.MutableRefObject<number>,
      subscribedSymbolsRef: React.MutableRefObject<Set<string>>,
      tokenFetcher: () => Promise<any>,
      urlBuilder: (token: string, instance: any) => string,
      onMessageHandler: (event: MessageEvent) => void,
      subscriptions: string[],
      topicBuilder: (symbol: string) => string
  ) => {
      if (subscriptions.length === 0) {
          if (wsRef.current) {
              wsRef.current.onclose = null;
              wsRef.current.close();
              wsRef.current = null;
          }
          if (pingRef.current) clearInterval(pingRef.current);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          subscribedSymbolsRef.current.clear();
          statusSetter('disconnected');
          return;
      }
  
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const newSubs = new Set(subscriptions);
          const toAdd = [...newSubs].filter(s => !subscribedSymbolsRef.current.has(s));
          const toRemove = [...subscribedSymbolsRef.current].filter(s => !newSubs.has(s));
  
          toAdd.forEach(symbol => {
              wsRef.current?.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: topicBuilder(symbol), response: true }));
              subscribedSymbolsRef.current.add(symbol);
          });
          toRemove.forEach(symbol => {
              wsRef.current?.send(JSON.stringify({ id: Date.now(), type: "unsubscribe", topic: topicBuilder(symbol), response: true }));
              subscribedSymbolsRef.current.delete(symbol);
          });
          return;
      }
      
      if (wsRef.current) return;
  
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
          subscribedSymbolsRef.current.clear();
  
          ws.onopen = () => {
              statusSetter("connected");
              if (pingRef.current) clearInterval(pingRef.current);
              pingRef.current = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
              }, instanceServers[0].pingInterval / 2);
              
              subscriptions.forEach(symbol => {
                  ws.send(JSON.stringify({ id: Date.now(), type: "subscribe", topic: topicBuilder(symbol), response: true }));
                  subscribedSymbolsRef.current.add(symbol);
              });
          };
  
          ws.onmessage = onMessageHandler;
  
          const handleCloseOrError = (isError: boolean) => {
              wsRef.current = null;
              if (pingRef.current) clearInterval(pingRef.current);
              statusSetter(isError ? "error" : "disconnected");
  
              if (subscriptions.length > 0) {
                  reconnectAttemptsRef.current++;
                  const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000);
                  reconnectTimeoutRef.current = setTimeout(() => 
                    setupWebSocket(wsRef, statusSetter, pingRef, reconnectTimeoutRef, reconnectAttemptsRef, subscribedSymbolsRef, tokenFetcher, urlBuilder, onMessageHandler, subscriptions, topicBuilder), 
                  delay);
              }
          };
  
          ws.onclose = () => handleCloseOrError(false);
          ws.onerror = () => handleCloseOrError(true);
  
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
    if (message.type === 'message' && message.subject === "snapshot.24h") {
        const data = message.data as FuturesSnapshotData;
        const topicMatch = message.topic.match(/\/contractMarket\/snapshot:(.*)/);
        const symbol = topicMatch ? topicMatch[1] : data.symbol;
        if (symbol) {
           processUpdateRef.current(symbol, false, data);
        }
    }
  }, []);
  
  useEffect(() => {
    setupWebSocket(
        spotWs, setSpotWsStatus, spotPingIntervalRef, spotReconnectTimeoutRef, spotReconnectAttempts, spotSubscribedSymbols,
        getSpotWsToken,
        (token, s) => `${s.endpoint}?token=${token}`,
        handleSpotMessage,
        symbolsToWatch.spot,
        (s) => `/market/snapshot:${s}`
    );
  }, [symbolsToWatch.spot, setupWebSocket, handleSpotMessage]);

  useEffect(() => {
    setupWebSocket(
        futuresWs, setFuturesWsStatus, futuresPingIntervalRef, futuresReconnectTimeoutRef, futuresReconnectAttempts, futuresSubscribedSymbols,
        getFuturesWsToken,
        (token, s) => `${s.endpoint}?token=${token}`,
        handleFuturesMessage,
        symbolsToWatch.futures,
        (s) => `/contractMarket/snapshot:${s}`
    );
  }, [symbolsToWatch.futures, setupWebSocket, handleFuturesMessage]);

  const closeAllPositions = useCallback(async () => {
    if (!firestore || !userContextDocRef || openPositions.length === 0) return;
  
    try {
      for (const pos of openPositions) {
        const posDocRef = doc(userContextDocRef, 'openPositions', pos.id);
        const detailsUpdate = {
            ...pos.details,
            status: 'closing',
            closePrice: pos.currentPrice, // Provide close price for manual all-close
        };
        await updateDocumentNonBlocking(posDocRef, { 'details': detailsUpdate });
      }
      toast({ title: 'Closing All Positions', description: `Initiated closure for ${openPositions.length} positions.` });
    } catch (error) {
        console.error('Failed to close all positions:', error);
        toast({ title: "Error Closing All Positions", description: "Could not update Firestore.", variant: "destructive" });
    }
}, [firestore, userContextDocRef, openPositions, toast]);

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
        isAiLoading,
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

    
    