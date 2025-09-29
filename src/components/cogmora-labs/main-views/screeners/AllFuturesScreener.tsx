"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useKucoinFuturesContracts,
  type KucoinFuturesContract,
} from "@/hooks/useKucoinFuturesTickers";
import { useKucoinFuturesSocket } from "@/hooks/useKucoinFuturesSocket";
import { ArrowUp, ArrowDown, Search, BarChartHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FuturesTradePopup } from "../paper-trading/FuturesTradePopup";


export default function FuturesScreener() {
  type SortKey = "markPrice" | "priceChgPct" | "openInterest" | "volumeOf24h";

  const { contracts, loading: httpLoading } = useKucoinFuturesContracts();
  const { liveData, loading: wsLoading } = useKucoinFuturesSocket(contracts.map(c => c.symbol));
  
  const [filter, setFilter] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  } | null>({ key: "openInterest", direction: "descending" });

  const [isTradePopupOpen, setIsTradePopupOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<KucoinFuturesContract | null>(null);

  const mergedContracts = useMemo(() => {
    return contracts.map(contract => {
      const liveUpdate = liveData[contract.symbol];
      if (liveUpdate) {
        return {
          ...contract,
          markPrice: liveUpdate.lastPrice,
          priceChgPct: liveUpdate.priceChgPct,
          volumeOf24h: liveUpdate.volume,
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
    if (price < 10) {
      if (price < 0.0001) return price.toFixed(8);
      return price.toFixed(6);
    }
    return price.toFixed(2);
  };

  const formatVolume = (value: string | number) => {
    const num = Number(value);
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

  const tableHeaders = (
    <div className="grid grid-cols-6 sm:grid-cols-7 gap-x-2 sm:gap-x-4 px-4 py-2 bg-card border-b border-border text-xs sm:text-sm">
      <div className="text-left font-semibold text-muted-foreground col-span-2">Pair</div>
      {["markPrice", "priceChgPct", "openInterest", "volumeOf24h"].map((key) => (
        <div
          key={key}
          className="text-right font-semibold text-muted-foreground cursor-pointer flex items-center justify-end"
          onClick={() => requestSort(key as SortKey)}
        >
          {{
            markPrice: "Price",
            priceChgPct: "24h %",
            openInterest: "OI",
            volumeOf24h: "Volume",
          }[key]}
          {getSortIcon(key as SortKey)}
        </div>
      ))}
      <div className="text-center font-semibold text-muted-foreground">Trade</div>
    </div>
  );

  return (
    <>
    <div className="w-full max-w-screen-xl mx-auto px-2 sm:px-6 lg:px-8">
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

      {tableHeaders}

      <ScrollArea className="max-h-[350px] lg:max-h-[800px] overflow-auto rounded-md">
        {(httpLoading && !contracts.length) ? (
          skeletonRows
        ) : (
          <Table>
            <TableBody>
              {sortedMemo.map((contract) => (
                <TableRow
                  key={contract.symbol}
                  className="grid grid-cols-6 sm:grid-cols-7 gap-x-2 sm:gap-x-4 px-4 py-2 text-xs sm:text-sm"
                >
                  <TableCell className="text-left font-medium col-span-2">
                    {contract.symbol.replace(/M$/, "")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${formatPrice(contract.markPrice)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      contract.priceChgPct >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {contract.priceChgPct >= 0 ? "+" : ""}
                    {(contract.priceChgPct * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatVolume(contract.openInterest)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatVolume(contract.volumeOf24h)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTradeClick(contract)}
                    >
                      <BarChartHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
