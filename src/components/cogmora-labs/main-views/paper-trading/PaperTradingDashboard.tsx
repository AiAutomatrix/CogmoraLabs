
"use client";

import React, { useMemo, useState } from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

export default function PaperTradingDashboard() {
  const { balance, openPositions, tradeHistory, closePosition, clearHistory, clearAllPositions } = usePaperTrading();
  const [rowsToShow, setRowsToShow] = useState(10);

  const totalPositionValue = useMemo(() =>
    openPositions.reduce((acc, pos) => {
        if (pos.positionType === 'futures') {
            // For futures, the "value" tied up from your balance is the collateral
            return acc + (pos.size * pos.averageEntryPrice) / pos.leverage!;
        }
        // For spot, the value is the full market value of the assets
        return acc + (pos.size * pos.currentPrice);
    }, 0),
    [openPositions]
  );

  const totalUnrealizedPNL = useMemo(() =>
    openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0),
    [openPositions]
  );
  
  const totalRealizedPNL = useMemo(() =>
    tradeHistory.filter(t => t.status === 'closed').reduce((acc, trade) => acc + (trade.pnl ?? 0), 0),
    [tradeHistory]
  );

  const equity = balance + totalPositionValue + totalUnrealizedPNL;
  
  const winTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl > 0).length;
  const losingTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl <= 0).length;
  const totalClosedTrades = winTrades + losingTrades;
  const winRate = totalClosedTrades > 0 ? (winTrades / totalClosedTrades) * 100 : 0;


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  const formatPrice = (price: number) => {
    if (!price || isNaN(price)) return '$0.00';
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    };
    if (price < 0.1) {
      options.maximumFractionDigits = 8;
    } else {
      options.maximumFractionDigits = 4;
    }
    return new Intl.NumberFormat('en-US', options).format(price);
  }

  const PNLCell = ({ pnl }: { pnl: number | undefined }) => {
      if (pnl === undefined) return <TableCell className="text-right">-</TableCell>;
      return (
        <TableCell className={`text-right ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatCurrency(pnl)}
        </TableCell>
      );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Equity</p>
            <p className="text-xl lg:text-2xl font-bold">{formatCurrency(equity)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Available Cash</p>
            <p className="text-xl lg:text-2xl font-bold">{formatCurrency(balance)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
            <p className={`text-xl font-bold ${totalUnrealizedPNL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalUnrealizedPNL)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Realized P&L</p>
            <p className={`text-xl font-bold ${totalRealizedPNL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalRealizedPNL)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold">{winRate.toFixed(2)}%</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Open Positions</CardTitle>
              <CardDescription>Your currently active paper trades.</CardDescription>
            </div>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={openPositions.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all of your open positions. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllPositions}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Value (USD)</TableHead>
                  <TableHead className="text-right">Entry Price</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Unrealized P&L</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length > 0 ? openPositions.map(pos => {
                    const value = pos.positionType === 'futures' 
                        ? (pos.size * pos.averageEntryPrice)
                        : pos.size * pos.currentPrice;
                    return (
                        <TableRow key={`${pos.id}-${pos.symbolName}`}>
                            <TableCell className="font-medium">{pos.symbolName}</TableCell>
                            <TableCell>
                               {pos.positionType === 'futures' ? (
                                    <Badge variant={pos.side === 'long' ? 'default' : 'destructive'} className="capitalize">
                                        {pos.side} {pos.leverage}x
                                    </Badge>
                               ) : (
                                    <Badge variant="secondary">Spot</Badge>
                               )}
                            </TableCell>
                            <TableCell className="text-right">{pos.size.toFixed(6)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(value)}</TableCell>
                            <TableCell className="text-right">{formatPrice(pos.averageEntryPrice)}</TableCell>
                            <TableCell className="text-right">{formatPrice(pos.currentPrice)}</TableCell>
                            <PNLCell pnl={pos.unrealizedPnl} />
                            <TableCell className="text-center">
                                <Button size="sm" variant="destructive" onClick={() => closePosition(pos.id)}>Close</Button>
                            </TableCell>
                        </TableRow>
                    )
                }) : (
                    <TableRow key="no-open-positions"><TableCell colSpan={8} className="text-center">No open positions.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Trade History</CardTitle>
                <CardDescription>A log of all your executed paper trades.</CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={tradeHistory.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your entire trade history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearHistory}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full">
            <Table>
               <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value (USD)</TableHead>
                  <TableHead className="text-right">P&L at Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {tradeHistory.slice(0, rowsToShow).map(trade => {
                   const tradePrice = trade.price;
                   const tradeValue = trade.positionType === 'futures' 
                    ? (trade.size * tradePrice)
                    : trade.size * tradePrice;
                   return (
                     <TableRow key={trade.id}>
                       <TableCell>{format(new Date(trade.timestamp), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                       <TableCell>{trade.symbolName}</TableCell>
                       <TableCell className={`capitalize ${trade.side === 'buy' || trade.side === 'long' ? 'text-green-500' : 'text-red-500'}`}>{trade.side}</TableCell>
                       <TableCell>
                           {trade.positionType === 'futures' ? (
                                <Badge variant="outline">Futures {trade.leverage}x</Badge>
                            ) : (
                                <Badge variant="secondary">Spot</Badge>
                            )}
                       </TableCell>
                       <TableCell className="text-right">{trade.size.toFixed(6)}</TableCell>
                       <TableCell className="text-right">{formatPrice(tradePrice)}</TableCell>
                       <TableCell className="text-right">{formatCurrency(tradeValue)}</TableCell>
                       <PNLCell pnl={trade.pnl} />
                     </TableRow>
                   )
                 })}
                 {tradeHistory.length === 0 && (
                    <TableRow key="no-trade-history">
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No trade history yet.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
             {tradeHistory.length > rowsToShow && (
                <div className="text-center mt-4">
                    <Button variant="outline" onClick={() => setRowsToShow(prev => prev + 10)}>Load More</Button>
                </div>
            )}
            
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
