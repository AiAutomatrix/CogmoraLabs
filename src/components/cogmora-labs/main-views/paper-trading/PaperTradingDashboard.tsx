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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
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

export default function PaperTradingDashboard() {
  const {
    balance,
    openPositions,
    tradeHistory,
    closePosition,
    closeAllPositions,
    clearHistory,
  } = usePaperTrading();
  const [rowsToShow, setRowsToShow] = useState(10);

  const totalPositionValue = useMemo(
    () =>
      openPositions.reduce((acc, pos) => {
        if (pos.positionType === "futures") {
          // For futures, value is based on collateral, not current price * size
          return acc + (pos.size * pos.averageEntryPrice) / (pos.leverage || 1);
        }
        return acc + pos.size * pos.currentPrice;
      }, 0),
    [openPositions]
  );

  const totalUnrealizedPNL = useMemo(
    () => openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0),
    [openPositions]
  );

  const totalRealizedPNL = useMemo(
    () =>
      tradeHistory
        .filter((t) => t.status === "closed")
        .reduce((acc, trade) => acc + (trade.pnl ?? 0), 0),
    [tradeHistory]
  );

  const equity = balance + totalPositionValue + totalUnrealizedPNL;

  const winTrades = tradeHistory.filter(
    (t) => t.status === "closed" && t.pnl !== undefined && t.pnl > 0
  ).length;
  const losingTrades = tradeHistory.filter(
    (t) => t.status === "closed" && t.pnl !== undefined && t.pnl <= 0
  ).length;
  const totalClosedTrades = winTrades + losingTrades;
  const winRate =
    totalClosedTrades > 0 ? (winTrades / totalClosedTrades) * 100 : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPrice = (price: number) => {
    if (!price || isNaN(price)) return "$0.00";
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

  const PNLCell = ({ pnl }: { pnl: number | undefined }) => {
    if (pnl === undefined)
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

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Account Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Account Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Equity</p>
            <p className="text-lg md:text-xl font-bold">
              {formatCurrency(equity)}
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Available Cash</p>
            <p className="text-lg md:text-xl font-bold">
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
            <p
              className={`text-lg md:text-xl font-bold ${
                totalUnrealizedPNL >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatCurrency(totalUnrealizedPNL)}
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Realized P&L</p>
            <p
              className={`text-lg md:text-xl font-bold ${
                totalRealizedPNL >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatCurrency(totalRealizedPNL)}
            </p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-lg md:text-xl font-bold">
              {winRate.toFixed(2)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Open Positions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>Your currently active paper trades.</CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={openPositions.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Close All
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
                  <TableHead className="hidden sm:table-cell px-2 py-2">Type</TableHead>
                  <TableHead className="text-right px-2 py-2">Size</TableHead>
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
                  <TableHead className="text-center min-w-[100px] px-2 py-2">
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
                    return (
                      <TableRow key={`${pos.id}-${pos.symbolName}`}>
                        <TableCell className="font-medium px-2 py-2">
                          {pos.symbolName}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell px-2 py-2">
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
                        <TableCell className="text-right px-2 py-2">
                          {pos.size.toFixed(6)}
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
                        <TableCell className="text-center min-w-[100px] px-2 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closePosition(pos.id)}
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                          >
                            Close
                          </Button>
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

      {/* Trade History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Trade History</CardTitle>
            <CardDescription>
              A log of all your executed paper trades.
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={tradeHistory.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
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
                  <TableHead className="px-2 py-2">Timestamp</TableHead>
                  <TableHead className="px-2 py-2">Symbol</TableHead>
                  <TableHead className="px-2 py-2">Side</TableHead>
                  <TableHead className="hidden sm:table-cell px-2 py-2">Type</TableHead>
                  <TableHead className="text-right px-2 py-2">Size</TableHead>
                  <TableHead className="hidden md:table-cell text-right px-2 py-2">
                    Price
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right px-2 py-2">
                    Value (USD)
                  </TableHead>
                  <TableHead className="text-right px-2 py-2">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tradeHistory.length > 0 ? (
                  tradeHistory.slice(0, rowsToShow).map((trade) => {
                  const tradePrice = trade.price;
                  const tradeValue =
                    trade.positionType === "futures"
                      ? trade.size * tradePrice
                      : trade.size * tradePrice;
                  return (
                    <TableRow key={trade.id}>
                      <TableCell className="px-2 py-2">
                        {format(new Date(trade.timestamp), "yyyy-MM-dd HH:mm")}
                      </TableCell>
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
                        {trade.size.toFixed(6)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right px-2 py-2">
                        {formatPrice(tradePrice)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right px-2 py-2">
                        {formatCurrency(tradeValue)}
                      </TableCell>
                      <PNLCell pnl={trade.pnl} />
                    </TableRow>
                  );
                })) : (
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
    </div>
  );
}
