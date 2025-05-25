
'use client';
import React, { useState, useEffect, useCallback } from 'react';
// Removed useForm and SubmitHandler as the form is being removed
// Removed zodResolver as the form is being removed
import { TradeSchema, type Trade } from '@/types'; // TradeSchema might still be useful for type validation if needed elsewhere, but not for form here
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Label might be used in Dialog
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
// Removed Form related imports as the form is being removed
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
// Select components are not needed if the form is removed
import { Trash2, Edit3, DoorClosed } from 'lucide-react'; // Edit3 might be removed if editing is gone
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

// TradeFormData is no longer needed as the form is removed.

const TradeTracker: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  // isEditing state is no longer needed
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [tradeToClose, setTradeToClose] = useState<Trade | null>(null);
  const [exitPriceInput, setExitPriceInput] = useState<string>('');
  const { toast } = useToast();

  // Form hook is no longer needed
  // const formHook = useForm<TradeFormData>({ ... });

  const loadTradesFromStorage = useCallback(() => {
    const storedTrades = localStorage.getItem('tradeflow_trades');
    if (storedTrades) {
      try {
        const parsedTrades = JSON.parse(storedTrades);
        setTrades(parsedTrades.map((trade: any) => ({
          ...trade,
          entryPrice: parseFloat(trade.entryPrice || '0'),
          quantity: parseFloat(trade.quantity || '0'),
          leverage: trade.leverage != null ? parseInt(String(trade.leverage), 10) : null,
          exitPrice: trade.exitPrice != null ? parseFloat(String(trade.exitPrice)) : null,
          pnl: trade.pnl != null ? parseFloat(String(trade.pnl)) : null,
          roiPercent: trade.roiPercent != null ? parseFloat(String(trade.roiPercent)) : null,
          createdAt: new Date(trade.createdAt),
          closedAt: trade.closedAt ? new Date(trade.closedAt) : null
        })));
      } catch (e) {
        console.error("Error parsing trades from localStorage", e);
        setTrades([]);
      }
    } else {
      setTrades([]);
    }
  }, []);

  useEffect(() => {
    loadTradesFromStorage(); // Load on initial mount

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tradeflow_trades') {
        loadTradesFromStorage(); // Reload when localStorage changes
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadTradesFromStorage]);

  useEffect(() => {
    // Only save to localStorage if trades array is not empty or if there was something already.
    // This prevents overwriting existing data with an empty array on initial load before hydration.
    if (trades.length > 0 || localStorage.getItem('tradeflow_trades') !== null) {
        localStorage.setItem('tradeflow_trades', JSON.stringify(trades));
    }
  }, [trades]);

  // onSubmit function is removed as the form is removed
  // handleEdit function is removed
  // handleCancelEdit function is removed

  const handleDelete = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
    toast({ title: "Trade Deleted", description: "Trade removed from log.", variant: "destructive" });
    // No need to reset form as it's removed
  };
  
  const openCloseTradeDialog = (trade: Trade) => {
    setTradeToClose(trade);
    setExitPriceInput('');
    setIsCloseDialogOpen(true);
  };

  const handleCloseTradeSubmit = () => {
    if (!tradeToClose || !exitPriceInput) {
      toast({ title: "Error", description: "Please enter an exit price.", variant: "destructive" });
      return;
    }
    const exitPrice = parseFloat(exitPriceInput);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      toast({ title: "Error", description: "Invalid exit price.", variant: "destructive" });
      return;
    }

    let pnl = 0;
    const leverageMultiplier = tradeToClose.leverage || 1;
    if (tradeToClose.tradeType === 'buy') {
      pnl = (exitPrice - tradeToClose.entryPrice) * tradeToClose.quantity * leverageMultiplier;
    } else { // 'sell'
      pnl = (tradeToClose.entryPrice - exitPrice) * tradeToClose.quantity * leverageMultiplier;
    }
    
    const initialInvestment = tradeToClose.entryPrice * tradeToClose.quantity;
    const roiPercent = initialInvestment !== 0 ? (pnl / initialInvestment) * 100 : 0;

    setTrades(trades.map(t => 
      t.id === tradeToClose.id 
        ? { ...t, status: 'closed', exitPrice, pnl, roiPercent, closedAt: new Date() } 
        : t
    ));
    toast({ title: "Trade Closed", description: `${tradeToClose.symbol} position closed. P&L: ${pnl.toFixed(2)}` });
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
        {/* Manual trade entry form removed */}
        <ScrollArea className="flex-grow p-3 min-h-0">
          <h3 className="text-md font-semibold mb-1">Logged Trades</h3>
          <Table>
            {trades.length === 0 && <TableCaption>No trades logged yet. Place a simulated trade in the 'Trade' tab.</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-2 text-xs">Type</TableHead>
                <TableHead className="py-2 px-2 text-xs">Symbol</TableHead>
                <TableHead className="py-2 px-2 text-xs">Qty</TableHead>
                <TableHead className="py-2 px-2 text-xs">Entry</TableHead>
                <TableHead className="py-2 px-2 text-xs">Leverage</TableHead>
                <TableHead className="py-2 px-2 text-xs">Exit</TableHead>
                <TableHead className="py-2 px-2 text-xs">P&L</TableHead>
                <TableHead className="py-2 px-2 text-xs">ROI %</TableHead>
                <TableHead className="py-2 px-2 text-xs">Status</TableHead>
                <TableHead className="py-2 px-2 text-xs">Date</TableHead>
                <TableHead className="text-right py-2 px-2 text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className={`text-xs ${trade.status === 'closed' ? 'opacity-60' : ''}`}>
                  <TableCell className={`font-medium py-1 px-2 ${trade.tradeType === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.tradeType.toUpperCase()}
                  </TableCell>
                  <TableCell className="py-1 px-2">{trade.symbol}</TableCell>
                  <TableCell className="py-1 px-2">{trade.quantity.toLocaleString()}</TableCell>
                  <TableCell className="py-1 px-2">{trade.entryPrice.toLocaleString()}</TableCell>
                  <TableCell className="py-1 px-2">{trade.leverage ? `${trade.leverage}x` : '-'}</TableCell>
                  <TableCell className="py-1 px-2">{trade.exitPrice?.toLocaleString() ?? '-'}</TableCell>
                  <TableCell className={`py-1 px-2 font-semibold ${ (trade.pnl ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.pnl?.toFixed(2) ?? '-'}
                  </TableCell>
                  <TableCell className={`py-1 px-2 ${ (trade.roiPercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                    {/* Edit button removed as per form removal. If re-needed, it would need to repopulate a form. */}
                    {/* 
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(trade)} aria-label="Edit trade" className="h-7 w-7" disabled={trade.status === 'closed'}>
                        <Edit3 className="h-4 w-4" />
                    </Button> 
                    */}
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
                        Enter the exit price for this trade. Current entry: {tradeToClose?.entryPrice.toLocaleString()}
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
