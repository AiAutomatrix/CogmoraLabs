
"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useKucoinFuturesContracts,
  type KucoinFuturesContract,
} from "@/hooks/useKucoinFuturesTickers";
import { useKucoinFuturesSocket } from "@/hooks/useKucoinFuturesSocket";
import { ArrowUp, ArrowDown, Search, BarChartHorizontal, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FuturesTradePopup } from "../paper-trading/FuturesTradePopup";
import { usePaperTrading } from "@/context/PaperTradingContext";


export default function AllFuturesScreener() {
  type SortKey = "markPrice" | "priceChgPct" | "volumeOf24h" | "openInterest" | "maxLeverage";

  const { contracts, loading: httpLoading } = useKucoinFuturesContracts();
  const { liveData, loading: wsLoading } = useKucoinFuturesSocket(contracts.map(c => c.symbol));
  const { watchlist, toggleWatchlist } = usePaperTrading();
  
  const [filter, setFilter] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  } | null>({ key: "volumeOf24h", direction: "descending" });

  const [isTradePopupOpen, setIsTradePopupOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<KucoinFuturesContract | null>(null);

  const watchedSymbols = useMemo(() => new Set(watchlist.map(item => item.symbol)), [watchlist]);

  const mergedContracts = useMemo(() => {
    return contracts.map(contract => {
      const liveUpdate = liveData[contract.symbol];
      if (liveUpdate) {
        return {
          ...contract,
          markPrice: liveUpdate.lastPrice,
          highPrice: liveUpdate.highPrice,
          lowPrice: liveUpdate.lowPrice,
          priceChgPct: liveUpdate.priceChgPct,
          volumeOf24h: liveUpdate.volume,
          openInterest: liveUpdate.openInterest ? liveUpdate.openInterest.toString() : contract.openInterest,
        };
      }
      return contract;
    });
  }, [contracts, liveData]);

  const sortedMemo = useMemo(() => {
    let sortableItems = [...mergedContracts];

    if (filter) {
      sortableItems = sortableItems.filter(contract =>
        contract.symbol.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = parseFloat(a[sortConfig.key] as string);
        const bValue = parseFloat(b[sortConfig.key] as string);

        if (isNaN(aValue) || isNaN(bValue)) return 0;
        if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [mergedContracts, sortConfig, filter]);

  const requestSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "descending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
  };
  
  const handleTradeClick = (contract: KucoinFuturesContract) => {
    setSelectedContract(contract);
    setIsTradePopupOpen(true);
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  };

  const formatPrice = (price: number) => {
    if (!price || isNaN(price)) return '0.00';
    if (price < 10) {
      if (price < 0.0001) return price.toFixed(8);
      return price.toFixed(6);
    }
    return price.toFixed(2);
  };

  const formatVolume = (value: string | number) => {
    const num = Number(value);
    if (isNaN(num)) return "N/A";
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toString();
  };

  const skeletonRows = (
    <div className="space-y-4 px-6 py-3">
      {[...Array(10)].map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );

  return (
    <>
    <div className="w-full max-w-screen-xl mx-auto px-2 sm:px-6 lg:px-8 h-full flex flex-col">
      <CardHeader className="pb-2 space-y-4">
        <div>
          <CardTitle className="font-headline">KuCoin Futures Screener</CardTitle>
          <CardDescription>
            Live KuCoin futures data. Click headers to sort.
          </CardDescription>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search contracts..."
            className="pl-8"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </CardHeader>
      
      {/* Desktop Header */}
       <div role="heading" className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_minmax(0,_1fr)] items-center px-4 py-2 bg-card border-b border-border text-xs font-semibold text-muted-foreground gap-4">
        <div className="cursor-pointer" onClick={() => requestSort("volumeOf24h")}>Pair{getSortIcon("volumeOf24h")}</div>
        <div className="text-right cursor-pointer" onClick={() => requestSort("markPrice")}>Price{getSortIcon("markPrice")}</div>
        <div className="text-right cursor-pointer" onClick={() => requestSort("priceChgPct")}>24h %{getSortIcon("priceChgPct")}</div>
        <div className="text-right cursor-pointer" onClick={() => requestSort("volumeOf24h")}>24h Vol{getSortIcon("volumeOf24h")}</div>
        <div className="text-right cursor-pointer" onClick={() => requestSort("openInterest")}>Open Interest{getSortIcon("openInterest")}</div>
        <div className="text-right cursor-pointer" onClick={() => requestSort("maxLeverage")}>Max Lev{getSortIcon("maxLeverage")}</div>
        <div className="text-center">Actions</div>
      </div>

      <ScrollArea className="flex-grow rounded-md">
        <div role="table" className="w-full caption-bottom">
          <div role="rowgroup">
            { (httpLoading && !contracts.length) ? (
              skeletonRows
            ) : (
              sortedMemo.map((contract) => (
                <div key={contract.symbol} role="row" className="flex items-center justify-between px-4 py-3 text-xs lg:text-sm border-b transition-colors hover:bg-muted/50 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_minmax(0,_1fr)] lg:gap-4">
                  
                  {/* Mobile View Structure */}
                  <div className="flex items-center gap-3 lg:hidden">
                      <div className="flex flex-col text-left">
                          <span className="font-medium text-foreground">{contract.symbol.replace(/M$/, "")}</span>
                          <span className="text-white font-mono">${formatPrice(contract.markPrice)}</span>
                      </div>
                      <div className={`flex flex-col items-center ${contract.priceChgPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                          <span className="text-xs text-muted-foreground">24%</span>
                          <span className="font-mono">{(contract.priceChgPct * 100).toFixed(2)}%</span>
                      </div>
                       <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Vol</span>
                          <span className="font-mono text-white">{formatVolume(contract.volumeOf24h)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">OI</span>
                          <span className="font-mono text-white">{formatVolume(contract.openInterest)}</span>
                      </div>
                      <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground">Lev</span>
                          <span className="font-mono text-white">{contract.maxLeverage}x</span>
                      </div>
                  </div>
                      
                  {/* === DESKTOP VIEW === */}
                  <div role="cell" className="hidden lg:flex items-center text-left font-medium p-0 truncate">{contract.symbol.replace(/M$/, "")}</div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">${formatPrice(contract.markPrice)}</div>
                  <div role="cell" className={`hidden lg:flex items-center justify-end font-mono p-0 ${contract.priceChgPct >= 0 ? "text-green-500" : "text-red-500"}`}>{(contract.priceChgPct * 100).toFixed(2)}%</div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">{formatVolume(contract.volumeOf24h)}</div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">{formatVolume(contract.openInterest)}</div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">{contract.maxLeverage}x</div>

                  <div role="cell" className="flex items-center justify-center gap-0 p-0 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTradeClick(contract)}>
                        <BarChartHorizontal className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${watchedSymbols.has(contract.symbol) ? 'text-primary' : ''}`} onClick={() => toggleWatchlist(contract.symbol, contract.symbol.replace(/M$/, ""), 'futures', contract.highPrice, contract.lowPrice, contract.priceChgPct)}>
                          <Eye className="h-4 w-4" />
                      </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
     {selectedContract && (
        <FuturesTradePopup
          isOpen={isTradePopupOpen}
          onOpenChange={setIsTradePopupOpen}
          contract={selectedContract}
        />
      )}
    </>
  );
}
