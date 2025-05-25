
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import type { Trade } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2, DoorClosed } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

const TradeTracker: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [tradeToClose, setTradeToClose] = useState<Trade | null>(null);
  const [exitPriceInput, setExitPriceInput] = useState<string>('');
  const { toast } = useToast();

  const parseTradeItem = (trade: any): Trade => ({
    ...trade,
    entryPrice: parseFloat(String(trade.entryPrice || '0')),
    quantity: parseFloat(String(trade.quantity || '0')),
    leverage: trade.leverage != null ? parseInt(String(trade.leverage), 10) : null,
    exitPrice: trade.exitPrice != null ? parseFloat(String(trade.exitPrice)) : null,
    pnl: trade.pnl != null ? parseFloat(String(trade.pnl)) : null,
    roiPercent: trade.roiPercent != null ? parseFloat(String(trade.roiPercent)) : null,
    createdAt: new Date(trade.createdAt),
    closedAt: trade.closedAt ? new Date(trade.closedAt) : null,
  });

  const loadTradesFromStorage = useCallback(() => {
    const storedTrades = localStorage.getItem('tradeflow_trades');
    if (storedTrades) {
      try {
        const parsedTrades = JSON.parse(storedTrades);
        if (Array.isArray(parsedTrades)) {
          setTrades(parsedTrades.map(parseTradeItem));
        } else {
          setTrades([]);
        }
      } catch (e) {
        console.error("Error parsing trades from localStorage", e);
        setTrades([]);
      }
    } else {
      setTrades([]);
    }
  }, []);

  useEffect(() => {
    loadTradesFromStorage(); 

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tradeflow_trades' || event.type === 'storageUpdate') { // Listen to custom event too
        loadTradesFromStorage(); 
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storageUpdate', handleStorageChange as EventListener); // Custom event
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storageUpdate', handleStorageChange as EventListener);
    };
  }, [loadTradesFromStorage]);


  const handleDelete = (id: string) => {
    const updatedTrades = trades.filter(t => t.id !== id);
    setTrades(updatedTrades);
    localStorage.setItem('tradeflow_trades', JSON.stringify(updatedTrades));
    window.dispatchEvent(new StorageEvent('storage', { key: 'tradeflow_trades' }));
    toast({ title: "Trade Deleted", description: "Trade removed from log.", variant: "destructive", duration: 3000 });
  };
  
  const openCloseTradeDialog = (trade: Trade) => {
    setTradeToClose(trade);
    setExitPriceInput('');
    setIsCloseDialogOpen(true);
  };

  const handleCloseTradeSubmit = () => {
    if (!tradeToClose || !exitPriceInput) {
      toast({ title: "Error", description: "Please enter an exit price.", variant: "destructive", duration: 3000 });
      return;
    }
    const exitPrice = parseFloat(exitPriceInput);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      toast({ title: "Error", description: "Invalid exit price.", variant: "destructive", duration: 3000 });
      return;
    }

    let pnl = 0;
    const leverageMultiplier = tradeToClose.leverage || 1;
    if (tradeToClose.tradeType === 'buy') {
      pnl = (exitPrice - tradeToClose.entryPrice) * tradeToClose.quantity * leverageMultiplier;
    } else { 
      pnl = (tradeToClose.entryPrice - exitPrice) * tradeToClose.quantity * leverageMultiplier;
    }
    
    const initialInvestment = tradeToClose.entryPrice * tradeToClose.quantity;
    // Prevent division by zero if initialInvestment is 0
    const roiPercent = initialInvestment !== 0 ? (pnl / initialInvestment) * 100 : 0;

    const updatedTrades = trades.map(t => 
      t.id === tradeToClose.id 
        ? { ...parseTradeItem(t), status: 'closed', exitPrice, pnl, roiPercent, closedAt: new Date() } 
        : parseTradeItem(t)
    );
    setTrades(updatedTrades);
    localStorage.setItem('tradeflow_trades', JSON.stringify(updatedTrades));
    window.dispatchEvent(new StorageEvent('storage', { key: 'tradeflow_trades' }));

    toast({ title: "Trade Closed", description: `${tradeToClose.symbol} position closed. P&L: ${pnl.toFixed(2)}`, duration: 3000 });
    setIsCloseDialogOpen(false);
    setTradeToClose(null);
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 pt-1 pb-2 border-b">
        <CardTitle className="text-lg">Trade Log</CardTitle>
        <CardDescription className="text-xs">View and manage trades simulated from the exchange panels.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0 p-0 overflow-hidden">
        <ScrollArea className="flex-grow p-3 min-h-0">
          <h3 className="text-md font-semibold mb-1">Logged Trades</h3>
          <Table>
            {trades.length === 0 && <TableCaption>No trades logged yet. Place a simulated trade in the 'Trade' tab.</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-2 text-xs">Type</TableHead>
                <TableHead className="py-2 px-2 text-xs">Symbol</TableHead>
                <TableHead className="py-2 px-2 text-xs">Qty</TableHead>
                <TableHead className="py-2 px-2 text-xs text-right">Entry</TableHead>
                <TableHead className="py-2 px-2 text-xs text-center">Leverage</TableHead>
                <TableHead className="py-2 px-2 text-xs text-right">Exit</TableHead>
                <TableHead className="py-2 px-2 text-xs text-right">P&L</TableHead>
                <TableHead className="py-2 px-2 text-xs text-right">ROI %</TableHead>
                <TableHead className="py-2 px-2 text-xs">Status</TableHead>
                <TableHead className="py-2 px-2 text-xs">Date</TableHead>
                <TableHead className="text-right py-2 px-2 text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className={`text-xs ${trade.status === 'closed' ? 'opacity-60' : ''}`}>
                  <TableCell className={`font-medium py-1 px-2 ${trade.tradeType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.tradeType.toUpperCase()}
                  </TableCell>
                  <TableCell className="py-1 px-2 font-mono">{trade.symbol.length > 15 ? `${trade.symbol.substring(0,12)}...` : trade.symbol}</TableCell>
                  <TableCell className="py-1 px-2 text-right">{trade.quantity.toLocaleString()}</TableCell>
                  <TableCell className="py-1 px-2 text-right">{trade.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 5})}</TableCell>
                  <TableCell className="py-1 px-2 text-center">{trade.leverage ? `${trade.leverage}x` : '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-right">{trade.exitPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 5}) ?? '-'}</TableCell>
                  <TableCell className={`py-1 px-2 font-semibold text-right ${ (trade.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.pnl?.toFixed(2) ?? '-'}
                  </TableCell>
                  <TableCell className={`py-1 px-2 text-right ${ (trade.roiPercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.roiPercent?.toFixed(2) ?? '-'}%
                  </TableCell>
                  <TableCell className="py-1 px-2">{trade.status}</TableCell>
                  <TableCell className="py-1 px-2">{format(trade.createdAt, 'MM/dd HH:mm')}</TableCell>
                  <TableCell className="text-right space-x-1 py-1 px-2">
                    {trade.status === 'open' && (
                      <Button variant="outline" size="icon" onClick={() => openCloseTradeDialog(trade)} aria-label="Close trade" className="h-6 w-6">
                          <DoorClosed className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(trade.id)} aria-label="Delete trade" className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Close Trade: {tradeToClose?.symbol}</DialogTitle>
                    <DialogDescription>
                        Entry: {tradeToClose?.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 5})} | Qty: {tradeToClose?.quantity.toLocaleString()} {tradeToClose?.leverage ? `| Lev: ${tradeToClose.leverage}x` : ''}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="exitPrice" className="text-right">Exit Price</Label>
                        <Input 
                            id="exitPrice" 
                            type="number" 
                            value={exitPriceInput} 
                            onChange={(e) => setExitPriceInput(e.target.value)} 
                            className="col-span-3 h-9"
                            step="any"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleCloseTradeSubmit}>Confirm Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
};

export default TradeTracker;
