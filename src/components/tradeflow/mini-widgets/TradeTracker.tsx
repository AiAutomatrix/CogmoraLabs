
'use client';
import type React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TradeSchema, type Trade } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Trash2, Edit3, PlusCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type TradeFormData = Omit<Trade, 'id' | 'createdAt' | 'status'>;

const TradeTracker: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<TradeFormData>({
    resolver: zodResolver(TradeSchema.omit({ id: true, createdAt: true, status: true })),
    defaultValues: {
      cryptocurrency: '',
      entryPrice: undefined,
      targetPrice: undefined,
      stopLoss: undefined,
    },
  });

  useEffect(() => {
    const storedTrades = localStorage.getItem('tradeflow_trades');
    if (storedTrades) {
      setTrades(JSON.parse(storedTrades).map((trade: any) => ({...trade, createdAt: new Date(trade.createdAt)})));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tradeflow_trades', JSON.stringify(trades));
  }, [trades]);

  const onSubmit: SubmitHandler<TradeFormData> = (data) => {
    if (isEditing) {
      setTrades(trades.map(t => t.id === isEditing ? { ...t, ...data, createdAt: t.createdAt } : t));
      toast({ title: "Trade Updated", description: `${data.cryptocurrency} trade details modified.` });
      setIsEditing(null);
    } else {
      const newTrade: Trade = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        status: 'active',
      };
      setTrades([...trades, newTrade]);
      toast({ title: "Trade Added", description: `${data.cryptocurrency} position tracked.` });
    }
    form.reset();
  };

  const handleEdit = (trade: Trade) => {
    setIsEditing(trade.id);
    form.reset({
        cryptocurrency: trade.cryptocurrency,
        entryPrice: trade.entryPrice,
        targetPrice: trade.targetPrice,
        stopLoss: trade.stopLoss,
    });
  };

  const handleDelete = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
    toast({ title: "Trade Deleted", description: "Trade removed from tracker.", variant: "destructive" });
    if (isEditing === id) {
        setIsEditing(null);
        form.reset();
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(null);
    form.reset();
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-4 pt-2 pb-2">
        <CardTitle>Trade Tracker</CardTitle>
        <CardDescription className="text-xs">Log and monitor your cryptocurrency trades.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-3 overflow-hidden min-h-0 p-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 px-1">
            <FormField
              control={form.control}
              name="cryptocurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol (e.g. BTCUSDT)</FormLabel>
                  <FormControl>
                    <Input placeholder="BTCUSDT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="50000" {...field} step="any" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="55000" {...field} step="any"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stopLoss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Loss</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="48000" {...field} step="any"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
                <Button type="submit" className="w-full">
                  {isEditing ? <Edit3 className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {isEditing ? 'Update Trade' : 'Add Trade'}
                </Button>
                {isEditing && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full">
                        Cancel Edit
                    </Button>
                )}
            </div>
          </form>
        </Form>

        <h3 className="text-md font-semibold mt-3 mb-1 px-1">Active Trades</h3>
        <ScrollArea className="flex-grow border rounded-md min-h-0">
          <Table>
            {trades.length === 0 && <TableCaption>No trades tracked yet.</TableCaption>}
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Stop</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="font-medium py-2 px-3">{trade.cryptocurrency}</TableCell>
                  <TableCell className="py-2 px-3">{trade.entryPrice.toLocaleString()}</TableCell>
                  <TableCell className="py-2 px-3">{trade.targetPrice.toLocaleString()}</TableCell>
                  <TableCell className="py-2 px-3">{trade.stopLoss.toLocaleString()}</TableCell>
                  <TableCell className="py-2 px-3">{trade.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1 py-2 px-3">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(trade)} aria-label="Edit trade">
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(trade.id)} aria-label="Delete trade">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TradeTracker;
