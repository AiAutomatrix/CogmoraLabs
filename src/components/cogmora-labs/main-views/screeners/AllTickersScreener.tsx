
"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useKucoinTickers, type KucoinTicker } from "@/hooks/useKucoinAllTickersSocket";
import { ArrowUp, ArrowDown, ShoppingCart, Search, Eye, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TradePopup } from "../paper-trading/TradePopup";
import { Input } from "@/components/ui/input";
import { usePaperTrading } from "@/context/PaperTradingContext";
import { SpotTickerInfoPopup } from "../paper-trading/SpotTickerInfoPopup";

interface AllTickersScreenerProps {
  onSymbolSelect: (symbol: string) => void;
}

export default function AllTickersScreener({ onSymbolSelect }: AllTickersScreenerProps) {
  type SortKey = "last" | "changeRate" | "volValue";

  const { tickers, loading } = useKucoinTickers();
  const { watchlist, toggleWatchlist } = usePaperTrading();
  
  const [filter, setFilter] = useState("");
  
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  } | null>({ key: "volValue", direction: "descending" });

  const [isTradePopupOpen, setIsTradePopupOpen] = useState(false);
  const [selectedTickerForTrade, setSelectedTickerForTrade] = useState<KucoinTicker | null>(null);

  const [isInfoPopupOpen, setIsInfoPopupOpen] = useState(false);
  const [selectedTickerForInfo, setSelectedTickerForInfo] = useState<KucoinTicker | null>(null);

  const watchedSymbols = useMemo(() => new Set(watchlist.map(item => item.symbol)), [watchlist]);

  const sortedMemo = useMemo(() => {
    let sortableItems = [...tickers];
    
    if (filter) {
      sortableItems = sortableItems.filter(ticker =>
        ticker.symbolName.toLowerCase().includes(filter.toLowerCase()) ||
        ticker.symbol.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = parseFloat(a[sortConfig.key]);
        const bValue = parseFloat(b[sortConfig.key]);
        if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [tickers, sortConfig, filter]);

  const requestSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "descending";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  };

  const handleBuyClick = (ticker: KucoinTicker) => {
    setSelectedTickerForTrade(ticker);
    setIsTradePopupOpen(true);
  };
  
  const handleInfoClick = useCallback((ticker: KucoinTicker) => {
    setSelectedTickerForInfo(ticker);
    setIsInfoPopupOpen(true);
  }, []);

  const formatPrice = (priceStr: string) => {
    const price = parseFloat(priceStr);
    if (isNaN(price)) return "N/A";
    if (price < 10) {
      if (price < 0.0001) return price.toFixed(8);
      return price.toFixed(6);
    }
    return price.toFixed(2);
  };

  const formatChange = (changeRateStr: string) => {
    const changeRate = parseFloat(changeRateStr);
    if (isNaN(changeRate)) return "N/A";
    return `${changeRate >= 0 ? "+" : ""}${(changeRate * 100).toFixed(2)}%`;
  };

  const formatVolume = (volValueStr: string) => {
    const volValue = parseFloat(volValueStr);
    if (isNaN(volValue)) return "N/A";
    if (volValue >= 1_000_000_000) return `${(volValue / 1_000_000_000).toFixed(2)}B`;
    if (volValue >= 1_000_000) return `${(volValue / 1_000_000).toFixed(2)}M`;
    if (volValue >= 1_000) return `${(volValue / 1_000).toFixed(2)}K`;
    return volValue.toString();
  };

  const skeletonRows = (
    <div className="space-y-4 px-6 py-3">
      {[...Array(10)].map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );

  const tradePopup = useMemo(() => {
    return selectedTickerForTrade && (
      <TradePopup
        isOpen={isTradePopupOpen}
        onOpenChange={setIsTradePopupOpen}
        ticker={selectedTickerForTrade}
      />
    );
  }, [selectedTickerForTrade, isTradePopupOpen]);

  const infoPopup = useMemo(() => {
    return (
      <SpotTickerInfoPopup
        isOpen={isInfoPopupOpen}
        onOpenChange={setIsInfoPopupOpen}
        ticker={selectedTickerForInfo}
      />
    )
  }, [isInfoPopupOpen, selectedTickerForInfo]);

  return (
    <>
    <div className="w-full max-w-screen-xl mx-auto px-2 sm:px-6 lg:px-8">
      <CardHeader className="pb-2 space-y-4">
        <div>
          <CardTitle className="font-headline">KuCoin All Tickers Screener</CardTitle>
          <CardDescription>
            Real-time data feed from KuCoin. Click headers to sort.
          </CardDescription>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search coins..."
            className="pl-8"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </CardHeader>

      {/* Mobile Header */}
      <div className="flex lg:hidden justify-between items-center px-4 py-2 bg-card border-b border-border text-xs">
        <div className="flex items-center gap-x-2">
            <div className="text-left font-semibold text-muted-foreground w-20 cursor-pointer" onClick={() => requestSort("volValue")}>Pair{getSortIcon("volValue")}</div>
            <div className="text-right font-semibold text-muted-foreground w-16 cursor-pointer" onClick={() => requestSort("last")}>Price{getSortIcon("last")}</div>
            <div className="text-right font-semibold text-muted-foreground w-14 cursor-pointer" onClick={() => requestSort("changeRate")}>24h%{getSortIcon("changeRate")}</div>
            <div className="text-right font-semibold text-muted-foreground w-14 cursor-pointer" onClick={() => requestSort("volValue")}>Volume{getSortIcon("volValue")}</div>
        </div>
        <div className="text-center font-semibold text-muted-foreground w-24">Actions</div>
      </div>
      
      {/* Desktop Header */}
      <div className="hidden lg:grid grid-cols-5 gap-x-4 px-4 py-2 bg-card border-b border-border text-sm">
        <div className="text-left font-semibold text-muted-foreground cursor-pointer flex items-center" onClick={() => requestSort("volValue")}>Pair{getSortIcon("volValue")}</div>
        <div className="text-right font-semibold text-muted-foreground cursor-pointer flex items-center justify-end" onClick={() => requestSort("last")}>Price{getSortIcon("last")}</div>
        <div className="text-right font-semibold text-muted-foreground cursor-pointer flex items-center justify-end" onClick={() => requestSort("changeRate")}>24h Change{getSortIcon("changeRate")}</div>
        <div className="text-right font-semibold text-muted-foreground cursor-pointer flex items-center justify-end" onClick={() => requestSort("volValue")}>Volume (24h){getSortIcon("volValue")}</div>
        <div className="text-center font-semibold text-muted-foreground">Actions</div>
      </div>


      <ScrollArea className="max-h-[350px] lg:max-h-[800px] overflow-auto rounded-md">
        {loading && !tickers.length ? (
          skeletonRows
        ) : (
          <div role="table" className="w-full caption-bottom">
            <div role="rowgroup">
              {sortedMemo.map((token) => (
                <div
                  key={token.symbol}
                  role="row"
                  className="flex lg:grid lg:grid-cols-5 lg:gap-x-4 items-center justify-between px-4 py-2 text-xs lg:text-sm border-b transition-colors hover:bg-muted/50"
                >
                  {/* Mobile Layout Group (Flex) */}
                  <div className="flex lg:hidden items-center gap-x-2">
                      <div role="cell" className="text-left font-medium p-0 w-20 truncate">
                        <Button variant="link" className="p-0 h-auto text-xs font-medium text-left" onClick={() => onSymbolSelect(`KUCOIN:${token.symbol}`)}>
                          {token.symbolName}
                        </Button>
                      </div>
                      <div role="cell" className="text-right font-mono p-0 w-16">${formatPrice(token.last)}</div>
                      <div role="cell" className={`text-right font-mono p-0 w-14 ${parseFloat(token.changeRate) >= 0 ? "text-green-500" : "text-red-500"}`}>{formatChange(token.changeRate)}</div>
                      <div role="cell" className="text-right font-mono p-0 w-14">{formatVolume(token.volValue)}</div>
                  </div>

                  {/* Desktop Layout Cells (Grid) */}
                  <div role="cell" className="hidden lg:flex items-center text-left font-medium p-0 truncate">
                    <Button variant="link" className="p-0 h-auto text-sm font-medium" onClick={() => onSymbolSelect(`KUCOIN:${token.symbol}`)}>
                      {token.symbolName}
                    </Button>
                  </div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">${formatPrice(token.last)}</div>
                  <div role="cell" className={`hidden lg:flex items-center justify-end font-mono p-0 ${parseFloat(token.changeRate) >= 0 ? "text-green-500" : "text-red-500"}`}>{formatChange(token.changeRate)}</div>
                  <div role="cell" className="hidden lg:flex items-center justify-end font-mono p-0">{formatVolume(token.volValue)}</div>
                  
                  {/* Actions Column (Common) */}
                  <div role="cell" className="flex items-center justify-center gap-0 p-0 w-24 lg:w-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleInfoClick(token)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleBuyClick(token)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${watchedSymbols.has(token.symbol) ? 'text-primary' : ''}`}
                      onClick={() => toggleWatchlist(token.symbol, token.symbolName, 'spot')}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
    {tradePopup}
    {infoPopup}
    </>
  );
}
