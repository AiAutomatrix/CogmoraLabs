
"use client";

import React, { useMemo, useState } from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

export default function PaperTradingDashboard() {
  const { balance, openPositions, tradeHistory, sell } = usePaperTrading();
  const [rowsToShow, setRowsToShow] = useState(10);

  const totalPositionValue = useMemo(() =>
    openPositions.reduce((acc, pos) => acc + (pos.size * pos.currentPrice), 0),
    [openPositions]
  );

  const totalUnrealizedPNL = useMemo(() =>
    openPositions.reduce((acc, pos) => acc + ((pos.currentPrice - pos.averageEntryPrice) * pos.size), 0),
    [openPositions]
  );
  
  const totalRealizedPNL = useMemo(() =>
    tradeHistory.filter(t => t.status === 'closed' && t.side === 'sell').reduce((acc, trade) => acc + (trade.pnl ?? 0), 0),
    [tradeHistory]
  );

  const equity = balance + totalPositionValue;
  
  const winTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl > 0).length;
  const losingTrades = tradeHistory.filter(t => t.status === 'closed' && t.pnl !== undefined && t.pnl <= 0).length;
  const totalClosedTrades = winTrades + losingTrades;
  const winRate = totalClosedTrades > 0 ? (winTrades / totalClosedTrades) * 100 : 0;


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };
  
  const formatPrice = (price: number) => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    };
    if (price < 0.1) {
      options.maximumFractionDigits = 6;
    } else {
      options.maximumFractionDigits = 2;
    }
    return new Intl.NumberFormat('en-US', options).format(price);
  }

  const PNLCell = ({ pnl }: { pnl: number }) => (
    <TableCell className={`text-right ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
      {formatCurrency(pnl)}
    </TableCell>
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Equity</p>
            <p className="text-xl md:text-2xl font-bold">{formatCurrency(equity)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Available Cash</p>
            <p className="text-xl md:text-2xl font-bold">{formatCurrency(balance)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
            <p className={`text-xl md:text-2xl font-bold ${totalUnrealizedPNL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalUnrealizedPNL)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Realized P&L</p>
            <p className={`text-xl md:text-2xl font-bold ${totalRealizedPNL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(totalRealizedPNL)}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-xl md:text-2xl font-bold">{winRate.toFixed(2)}%</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Your currently active paper trades.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Value (USD)</TableHead>
                  <TableHead className="text-right">Entry Price (Avg)</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Unrealized P&L</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openPositions.length > 0 ? openPositions.map(pos => {
                    const pnl = (pos.currentPrice - pos.averageEntryPrice) * pos.size;
                    const value = pos.size * pos.averageEntryPrice;
                    return (
                        <TableRow key={pos.symbol}>
                            <TableCell>{pos.symbolName}</TableCell>
                            <TableCell className="text-right">{pos.size.toFixed(6)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(value)}</TableCell>
                            <TableCell className="text-right">{formatPrice(pos.averageEntryPrice)}</TableCell>
                            <TableCell className="text-right">{formatPrice(pos.currentPrice)}</TableCell>
                            <PNLCell pnl={pnl} />
                            <TableCell className="text-center">
                                <Button size="sm" variant="destructive" onClick={() => sell(pos.symbol, pos.size, pos.currentPrice)}>Close</Button>
                            </TableCell>
                        </TableRow>
                    )
                }) : (
                    <TableRow><TableCell colSpan={7} className="text-center">No open positions.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
           <CardDescription>A log of all your executed paper trades.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] w-full">
            <Table>
               <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value (USD)</TableHead>
                  <TableHead className="text-right">P&L at Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {tradeHistory.slice(0, rowsToShow).map(trade => {
                   const tradePrice = trade.side === 'buy' ? trade.entryPrice : trade.currentPrice;
                   const tradeValue = trade.size * tradePrice;
                   return (
                     <TableRow key={trade.id}>
                       <TableCell>{format(new Date(trade.timestamp), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                       <TableCell>{trade.symbolName}</TableCell>
                       <TableCell className={`capitalize ${trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{trade.side}</TableCell>
                       <TableCell className="text-right">{trade.size.toFixed(6)}</TableCell>
                       <TableCell className="text-right">{formatPrice(tradePrice)}</TableCell>
                       <TableCell className="text-right">{formatCurrency(tradeValue)}</TableCell>
                       {trade.status === 'closed' && trade.pnl !== undefined ? (
                          <PNLCell pnl={trade.pnl} />
                       ) : (
                          <TableCell className="text-right">-</TableCell>
                       )}
                     </TableRow>
                   )
                 })}
              </TableBody>
            </Table>
             {tradeHistory.length > rowsToShow && (
                <div className="text-center mt-4">
                    <Button variant="outline" onClick={() => setRowsToShow(prev => prev + 10)}>Load More</Button>
                </div>
            )}
            {tradeHistory.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No trade history yet.</div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

    