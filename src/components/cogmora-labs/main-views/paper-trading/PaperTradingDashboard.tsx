"use client";
import React, { useMemo, useState } from "react";
import { usePaperTrading } from "@/context/PaperTradingContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StopCircle, Settings2, Info, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Watchlist from "./Watchlist";
import TradeTriggersDashboard from "./TradeTriggersDashboard";
import { PositionDetailsPopup } from "./PositionDetailsPopup";
import type { OpenPosition, PaperTrade } from "@/types";
import { PositionInfoPopup } from "./PositionInfoPopup";
import AccountMetricsCarousel from "./AccountMetricsCarousel";

interface PaperTradingDashboardProps {
  onSymbolSelect: (symbol: string) => void;
  selectedChartLayout: number;
  setSelectedChartLayout: (num: number) => void;
  selectedSymbolsForHighlight: string[];
  handleAiTriggerAnalysis: () => void;
}

export default function PaperTradingDashboard({
  onSymbolSelect,
  selectedChartLayout,
  setSelectedChartLayout,
  selectedSymbolsForHighlight,
  handleAiTriggerAnalysis,
}: PaperTradingDashboardProps) {
  const {
    openPositions,
    tradeHistory,
    closePosition,
    closeAllPositions,
    clearHistory,
    aiSettings,
    setAiSettings,
  } = usePaperTrading();
  const [rowsToShow, setRowsToShow] = useState(10);
  const [isDetailsPopupOpen, setIsDetailsPopupOpen] = useState(false);
  const [isInfoPopupOpen, setIsInfoPopupOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);

  const handleOpenDetails = (position: OpenPosition) => {
    setSelectedPosition(position);
    setIsDetailsPopupOpen(true);
  };
  
  const handleOpenInfo = (position: OpenPosition) => {
    setSelectedPosition(position);
    setIsInfoPopupOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || isNaN(price)) return "$0.00";
    const options: Intl.NumberFormatOptions = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    };
    if (price < 0.1) {
      options.maximumFractionDigits = 8;
    } else {
      options.maximumFractionDigits = 4;
    }
    return new Intl.NumberFormat("en-US", options).format(price);
  };
    
  const formatSize = (size: number) => {
    if (size >= 1) return size.toFixed(2);
    // For sizes less than 1, show more precision using toPrecision
    return size.toPrecision(3);
  };
  
  const formatTimestamp = (timestamp?: number | any): string => {
    if (!timestamp) return 'N/A';
    
    // Check if it's a Firestore Timestamp object
    if (typeof timestamp === 'object' && timestamp.toDate) {
      return format(timestamp.toDate(), "yyyy-MM-dd HH:mm");
    }
    
    // Fallback for number timestamp (milliseconds)
    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      // Check if the date is valid
      if (!isNaN(date.getTime())) {
        return format(date, "yyyy-MM-dd HH:mm");
      }
    }
    
    return 'Invalid Date';
  };

  const PNLCell = ({ pnl }: { pnl: number | undefined | null }) => {
    if (pnl === undefined || pnl === null)
      return <TableCell className="text-right px-2 py-2">-</TableCell>;
    return (
      <TableCell
        className={`text-right px-2 py-2 ${
          pnl >= 0 ? "text-green-500" : "text-red-500"
        }`}
      >
        {formatCurrency(pnl)}
      </TableCell>
    );
  };

  const sortedTradeHistory = useMemo(() => {
    return [...tradeHistory].sort((a, b) => {
        const timeA = a.closeTimestamp?.toDate?.().getTime() || a.openTimestamp;
        const timeB = b.closeTimestamp?.toDate?.().getTime() || b.openTimestamp;
        return timeB - timeA;
    });
}, [tradeHistory]);


  return (
    <>
    <div className="flex flex-col h-full">
      <AccountMetricsCarousel />

      <div className="flex-grow min-h-0">
        <Tabs defaultValue="positions" className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="positions">Open Positions</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="history">Trade History</TabsTrigger>
          </TabsList>
          <TabsContent value="positions" className="flex-grow overflow-y-auto">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Open Positions</CardTitle>
                      <CardDescription>Your currently active paper trades.</CardDescription>
                  </div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                      <Button
                          variant="outline"
                          size="icon"
                          disabled={openPositions.length === 0}
                          className="h-9 w-9 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      >
                          <StopCircle className="h-5 w-5" />
                          <span className="sr-only">Close All Positions</span>
                      </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                          This will close all of your open positions and log them into
                          trade history. This action cannot be undone.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={closeAllPositions}>
                          Continue
                          </AlertDialogAction>
                      </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  </CardHeader>
                  <CardContent>
                  <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                          <TableRow>
                          <TableHead className="px-2 py-2">Symbol</TableHead>
                          <TableHead className="px-1 py-2 text-center">Type</TableHead>
                          <TableHead className="hidden sm:table-cell text-right px-1 py-2">Size</TableHead>
                          <TableHead className="hidden md:table-cell text-right px-2 py-2">
                              Value (USD)
                          </TableHead>
                          <TableHead className="hidden md:table-cell text-right px-2 py-2">
                              Entry Price
                          </TableHead>
                          <TableHead className="hidden md:table-cell text-right px-2 py-2">
                              Current Price
                          </TableHead>
                          <TableHead className="text-right px-2 py-2">Unrealized P&L</TableHead>
                          <TableHead className="text-center min-w-[120px] px-2 py-2">
                              Actions
                          </TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {openPositions.length > 0 ? (
                          openPositions.map((pos) => {
                              const value =
                              pos.positionType === "futures"
                                  ? pos.size * pos.averageEntryPrice
                                  : pos.size * pos.currentPrice;
                              
                              const hasSl = pos.details?.stopLoss !== undefined;
                              const hasTp = pos.details?.takeProfit !== undefined;

                              return (
                              <TableRow key={`${pos.id}-${pos.symbolName}`}>
                                  <TableCell className="font-medium px-2 py-2">
                                    <Button
                                      variant="link"
                                      className="p-0 h-auto text-left font-medium"
                                      onClick={() => onSymbolSelect(pos.symbol)}
                                    >
                                      {pos.symbolName}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="px-1 py-2 text-center">
                                  {pos.positionType === "futures" ? (
                                      <Badge
                                      variant={
                                          pos.side === "long" ? "default" : "destructive"
                                      }
                                      className="capitalize"
                                      >
                                      {pos.side} {pos.leverage}x
                                      </Badge>
                                  ) : (
                                      <Badge variant="secondary">Spot</Badge>
                                  )}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-right px-1 py-2">
                                  {formatSize(pos.size)}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-right px-2 py-2">
                                  {formatCurrency(value)}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-right px-2 py-2">
                                  {formatPrice(pos.averageEntryPrice)}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-right px-2 py-2">
                                  {formatPrice(pos.currentPrice)}
                                  </TableCell>
                                  <PNLCell pnl={pos.unrealizedPnl} />
                                  <TableCell className="text-center min-w-[120px] px-2 py-2">
                                    <div className="flex items-center justify-center gap-0">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenInfo(pos)}>
                                          <Info className="h-4 w-4 text-blue-400" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetails(pos)}>
                                          <Settings2 className={`h-4 w-4 ${hasSl || hasTp ? 'text-primary' : 'text-muted-foreground'}`} />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => closePosition(pos.id)}
                                      >
                                          <XCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                              </TableRow>
                              );
                          })
                          ) : (
                          <TableRow>
                              <TableCell colSpan={8} className="text-center">
                              No open positions.
                              </TableCell>
                          </TableRow>
                          )}
                      </TableBody>
                      </Table>
                  </div>
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="triggers" className="flex-grow overflow-y-auto">
              <TradeTriggersDashboard 
                aiSettings={aiSettings}
                setAiSettings={setAiSettings}
                handleAiTriggerAnalysis={handleAiTriggerAnalysis}
              />
          </TabsContent>
          <TabsContent value="watchlist" className="flex-grow overflow-y-auto">
              <Watchlist 
                onSymbolSelect={onSymbolSelect}
                selectedChartLayout={selectedChartLayout}
                setSelectedChartLayout={setSelectedChartLayout}
                selectedSymbolsForHighlight={selectedSymbolsForHighlight}
              />
          </TabsContent>
          <TabsContent value="history" className="flex-grow overflow-y-auto">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                      <CardTitle>Trade History</CardTitle>
                      <CardDescription>
                      A log of all your paper trades.
                      </CardDescription>
                  </div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                      <Button
                          variant="destructive"
                          size="sm"
                          disabled={tradeHistory.length === 0}
                      >
                          <StopCircle className="mr-2 h-4 w-4" />
                          Clear History
                      </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          entire trade history.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={clearHistory}>
                          Continue
                          </AlertDialogAction>
                      </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  </CardHeader>
                  <CardContent>
                  <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                          <TableRow>
                          <TableHead className="px-2 py-2">Symbol</TableHead>
                          <TableHead className="px-2 py-2">Side</TableHead>
                          <TableHead className="hidden sm:table-cell px-2 py-2">Type</TableHead>
                          <TableHead className="text-right px-2 py-2">Size</TableHead>
                          <TableHead className="hidden md:table-cell text-right px-2 py-2">
                              Entry Price
                          </TableHead>
                          <TableHead className="hidden md:table-cell text-right px-2 py-2">
                              Close Price
                          </TableHead>
                          <TableHead className="hidden md:table-cell px-2 py-2">
                              Date
                          </TableHead>
                          <TableHead className="text-right px-2 py-2">P&L</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {sortedTradeHistory.length > 0 ? (
                          sortedTradeHistory.slice(0, rowsToShow).map((trade) => (
                              <TableRow key={trade.id} className={trade.status === 'open' ? 'opacity-60' : ''}>
                              <TableCell className="px-2 py-2">{trade.symbolName}</TableCell>
                              <TableCell
                                  className={`capitalize px-2 py-2 ${
                                  trade.side === "buy" || trade.side === "long"
                                      ? "text-green-500"
                                      : "text-red-500"
                                  }`}
                              >
                                  {trade.side}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell px-2 py-2">
                                  {trade.positionType === "futures" ? (
                                  <Badge variant="outline">
                                      Futures {trade.leverage}x
                                  </Badge>
                                  ) : (
                                  <Badge variant="secondary">Spot</Badge>
                                  )}
                              </TableCell>
                              <TableCell className="text-right px-2 py-2">
                                  {formatSize(trade.size)}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-right px-2 py-2">
                                  {formatPrice(trade.entryPrice)}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-right px-2 py-2">
                                  {trade.closePrice ? formatPrice(trade.closePrice) : '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell px-2 py-2">
                                  {formatTimestamp(trade.closeTimestamp ?? trade.openTimestamp)}
                              </TableCell>
                              <PNLCell pnl={trade.pnl} />
                              </TableRow>
                          ))) : (
                          <TableRow>
                              <TableCell
                              colSpan={8}
                              className="text-center text-muted-foreground py-8"
                              >
                              No trade history yet.
                              </TableCell>
                          </TableRow>
                          )}
                      </TableBody>
                      </Table>
                  </div>
                  {tradeHistory.length > rowsToShow && (
                      <div className="text-center mt-4">
                      <Button
                          variant="outline"
                          onClick={() => setRowsToShow((prev) => prev + 10)}
                      >
                          Load More
                      </Button>
                      </div>
                  )}
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    {selectedPosition && (
        <PositionDetailsPopup 
            isOpen={isDetailsPopupOpen}
            onOpenChange={setIsDetailsPopupOpen}
            position={selectedPosition}
        />
    )}
     {selectedPosition && (
        <PositionInfoPopup
            isOpen={isInfoPopupOpen}
            onOpenChange={setIsInfoPopupOpen}
            position={selectedPosition}
        />
    )}
    </>
  );
}
