
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TradeSchema, type Trade } from '@/types';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit3, PlusCircle, DoorClosed } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

// Updated TradeFormData to reflect the enhanced Trade schema
type TradeFormData = Omit<Trade, 'id' | 'createdAt' | 'status' | 'exitPrice' | 'pnl' | 'roiPercent' | 'closedAt'>;

const TradeTracker: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [tradeToClose, setTradeToClose] = useState<Trade | null>(null);
  const [exitPriceInput, setExitPriceInput] = useState<string>('');
  const { toast } = useToast();

  const formHook = useForm<TradeFormData>({
    resolver: zodResolver(TradeSchema.omit({ 
      id: true, createdAt: true, status: true, 
      exitPrice: true, pnl: true, roiPercent: true, closedAt: true 
    })),
    defaultValues: {
      symbol: '',
      entryPrice: '', // Changed from undefined
      quantity: '',   // Changed from undefined
      tradeType: 'buy',
      leverage: 1,    // Default to 1
    },
  });

  const loadTradesFromStorage = useCallback(() => {
    const storedTrades = localStorage.getItem('tradeflow_trades');
    if (storedTrades) {
      try {
        setTrades(JSON.parse(storedTrades).map((trade: any) => ({
          ...trade,
          entryPrice: parseFloat(trade.entryPrice || '0'),
          quantity: parseFloat(trade.quantity || '0'),
          leverage: trade.leverage ? parseInt(trade.leverage, 10) : null,
          exitPrice: trade.exitPrice ? parseFloat(trade.exitPrice) : null,
          pnl: trade.pnl ? parseFloat(trade.pnl) : null,
          roiPercent: trade.roiPercent ? parseFloat(trade.roiPercent) : null,
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
    loadTradesFromStorage();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tradeflow_trades') {
        loadTradesFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadTradesFromStorage]);


  useEffect(() => {
    if (trades.length > 0 || localStorage.getItem('tradeflow_trades')) { // Only save if there's something to save or already saved
        localStorage.setItem('tradeflow_trades', JSON.stringify(trades));
    }
  }, [trades]);

  const onSubmit: SubmitHandler<TradeFormData> = (data) => {
    const newTradeEntry: Trade = {
      ...data,
      id: isEditing || crypto.randomUUID(),
      createdAt: isEditing ? trades.find(t => t.id === isEditing)!.createdAt : new Date(),
      status: 'open',
      exitPrice: null,
      pnl: null,
      roiPercent: null,
      closedAt: null,
      entryPrice: Number(data.entryPrice),
      quantity: Number(data.quantity),
      leverage: data.leverage ? Number(data.leverage) : null,
    };

    if (isEditing) {
      setTrades(trades.map(t => t.id === isEditing ? { ...t, ...newTradeEntry } : t));
      toast({ title: "Trade Updated", description: `${data.symbol} trade details modified.` });
      setIsEditing(null);
    } else {
      setTrades(prevTrades => [...prevTrades, newTradeEntry]);
      toast({ title: "Trade Logged", description: `${data.symbol} position tracked.` });
    }
    formHook.reset({
        symbol: '',
        entryPrice: '',
        quantity: '',
        tradeType: 'buy',
        leverage: 1,
    });
  };

  const handleEdit = (trade: Trade) => {
    setIsEditing(trade.id);
    formHook.reset({
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        tradeType: trade.tradeType,
        leverage: trade.leverage ?? 1,
    });
  };

  const handleDelete = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
    toast({ title: "Trade Deleted", description: "Trade removed from tracker.", variant: "destructive" });
    if (isEditing === id) {
        setIsEditing(null);
        formHook.reset();
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(null);
    formHook.reset();
  }

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
    
    const initialInvestment = tradeToClose.entryPrice * tradeToClose.quantity; // Simplified cost for ROI
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
        <CardDescription className="text-xs">Log, monitor, and manage your trades.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-3 min-h-0 p-0 overflow-hidden">
        <ScrollArea className="flex-grow p-3 min-h-0">
          <Form {...formHook}>
            <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-3 mb-4">
              <FormField
                control={formHook.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol (e.g. BTCUSDT)</FormLabel>
                    <FormControl>
                      <Input placeholder="BTCUSDT" {...field} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormField
                  control={formHook.control}
                  name="tradeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Buy/Sell" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="buy">Buy / Long</SelectItem>
                          <SelectItem value="sell">Sell / Short</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formHook.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.1" {...field} step="any" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formHook.control}
                  name="entryPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entry Price</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} step="any" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formHook.control}
                  name="leverage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leverage (1x)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1" {...field} step="1" min="1" className="h-9"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2">
                  <Button type="submit" className="w-full h-9">
                    {isEditing ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {isEditing ? 'Update Trade' : 'Add Trade Log'}
                  </Button>
                  {isEditing && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full h-9">
                          Cancel Edit
                      </Button>
                  )}
              </div>
            </form>
          </Form>

          <h3 className="text-md font-semibold mt-3 mb-1">Logged Trades</h3>
          <Table>
            {trades.length === 0 && <TableCaption>No trades logged yet.</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Leverage</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>P&L</TableHead>
                <TableHead>ROI %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className={trade.status === 'closed' ? 'opacity-60' : ''}>
                  <TableCell className={`font-medium py-2 px-3 ${trade.tradeType === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.tradeType.toUpperCase()}
                  </TableCell>
                  <TableCell className="py-2 px-3">{trade.symbol}</TableCell>
                  <TableCell className="py-2 px-3">{trade.quantity.toLocaleString()}</TableCell>
                  <TableCell className="py-2 px-3">{trade.entryPrice.toLocaleString()}</TableCell>
                  <TableCell className="py-2 px-3">{trade.leverage ? `${trade.leverage}x` : '-'}</TableCell>
                  <TableCell className="py-2 px-3">{trade.exitPrice?.toLocaleString() ?? '-'}</TableCell>
                  <TableCell className={`py-2 px-3 font-semibold ${ (trade.pnl ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.pnl?.toFixed(2) ?? '-'}
                  </TableCell>
                  <TableCell className={`py-2 px-3 ${ (trade.roiPercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.roiPercent?.toFixed(2) ?? '-'}%
                  </TableCell>
                  <TableCell className="py-2 px-3">{trade.status}</TableCell>
                  <TableCell className="py-2 px-3">{format(trade.createdAt, 'PPp')}</TableCell>
                  <TableCell className="text-right space-x-1 py-2 px-3">
                    {trade.status === 'open' && (
                      <Button variant="outline" size="icon" onClick={() => openCloseTradeDialog(trade)} aria-label="Close trade" className="h-7 w-7">
                          <DoorClosed className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(trade)} aria-label="Edit trade" className="h-7 w-7" disabled={trade.status === 'closed'}>
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(trade.id)} aria-label="Delete trade" className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
            <DialogContent>
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

    