
'use client';

import React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Coins, TrendingUp, TrendingDown, Zap, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Trade } from '@/types';

const kucoinTradeSchema = z.object({
  symbol: z.string().min(3, "Symbol must be at least 3 characters (e.g., BTC/USDT)").toUpperCase(),
  tradeType: z.enum(['spot', 'futures'], { required_error: "Please select a trade type." }),
  orderType: z.enum(['market', 'limit'], { required_error: "Please select an order type." }),
  side: z.enum(['buy', 'sell'], { required_error: "Please select a side (buy/sell)." }),
  price: z.coerce.number().optional(),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  leverage: z.coerce.number().min(1).max(100).optional(),
}).refine(data => data.orderType === 'limit' ? data.price !== undefined && data.price > 0 : true, {
  message: "Price is required for limit orders and must be positive.",
  path: ["price"],
}).refine(data => data.tradeType === 'futures' ? data.leverage !== undefined && data.leverage >= 1 : true, {
  message: "Leverage is required for futures trades (1x-100x).",
  path: ["leverage"],
});

type KucoinTradeFormData = z.infer<typeof kucoinTradeSchema>;

const KucoinTradePanel: React.FC = () => {
  const { toast } = useToast();
  const formHook = useForm<KucoinTradeFormData>({
    resolver: zodResolver(kucoinTradeSchema),
    defaultValues: {
      symbol: '',
      tradeType: undefined,
      orderType: undefined,
      side: undefined,
      amount: '',
      price: '',
      leverage: 1,
    },
  });

  const watchedTradeType = formHook.watch('tradeType');
  const watchedOrderType = formHook.watch('orderType');

  const onSubmit: SubmitHandler<KucoinTradeFormData> = (data) => {
    try {
      const existingTradesString = localStorage.getItem('tradeflow_trades');
      const existingTrades: Trade[] = existingTradesString ? JSON.parse(existingTradesString) : [];

      let entryPrice = 1; // Default for market orders
      if (data.orderType === 'limit') {
        if (data.price === undefined || data.price <= 0) {
          toast({ title: "Invalid Price", description: "Price must be a positive number for limit orders.", variant: "destructive", duration: 3000 });
          return;
        }
        entryPrice = data.price;
      }
      
      let leverageValue = null;
      if (data.tradeType === 'futures') {
        if (data.leverage === undefined || data.leverage < 1) {
          toast({ title: "Invalid Leverage", description: "Leverage must be at least 1 for futures.", variant: "destructive", duration: 3000 });
          return;
        }
        leverageValue = data.leverage;
      }


      const newTrade: Trade = {
        id: crypto.randomUUID(),
        symbol: data.symbol,
        entryPrice: entryPrice,
        quantity: data.amount,
        tradeType: data.side,
        leverage: leverageValue,
        status: 'open',
        createdAt: new Date(),
        exitPrice: null,
        pnl: null,
        roiPercent: null,
        closedAt: null,
      };

      const updatedTrades = [...existingTrades, newTrade];
      localStorage.setItem('tradeflow_trades', JSON.stringify(updatedTrades));

      // Dispatch a storage event manually for same-page updates if needed, though TradeTracker should listen
      window.dispatchEvent(new StorageEvent('storage', { key: 'tradeflow_trades' }));


      toast({
        title: "Kucoin Order Logged (Simulated)",
        description: (
          <pre className="mt-2 w-[340px] rounded-md bg-card-foreground/10 p-4">
            <code className="text-foreground">{JSON.stringify(newTrade, null, 2)}</code>
          </pre>
        ),
        duration: 3000,
      });
      console.log("Kucoin Trade Data Logged:", newTrade);
      // formHook.reset(); 
    } catch (error) {
      console.error("Error logging Kucoin trade:", error);
      toast({
        title: "Logging Error",
        description: "Could not log Kucoin trade. See console for details.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 pt-1 pb-2 border-b">
        <CardTitle className="flex items-center text-lg"><Coins className="mr-2 h-5 w-5 text-green-500" />Kucoin Trade</CardTitle>
        <CardDescription className="text-xs">Place spot & futures orders (simulated).</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0 p-0 overflow-hidden">
        <ScrollArea className="flex-grow p-3 min-h-0">
          <Form {...formHook}>
            <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={formHook.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol (e.g., BTC/USDT)</FormLabel>
                    <FormControl>
                      <Input placeholder="BTC/USDT" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={formHook.control}
                  name="tradeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="spot"><Zap className="mr-2 h-4 w-4 inline-block" />Spot</SelectItem>
                          <SelectItem value="futures"><Settings className="mr-2 h-4 w-4 inline-block" />Futures</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formHook.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select order type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="market">Market</SelectItem>
                          <SelectItem value="limit">Limit</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={formHook.control}
                name="side"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Side</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select side" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="buy"><TrendingUp className="mr-2 h-4 w-4 text-green-500 inline-block" />Buy / Long</SelectItem>
                        <SelectItem value="sell"><TrendingDown className="mr-2 h-4 w-4 text-red-500 inline-block" />Sell / Short</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedOrderType === 'limit' && (
                <FormField
                  control={formHook.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter price for limit order" {...field} step="any" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={formHook.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (e.g. in BTC or USDT)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter amount" {...field} step="any" className="h-9"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedTradeType === 'futures' && (
                <FormField
                  control={formHook.control}
                  name="leverage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leverage (1x-100x)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} min="1" max="100" step="1" className="h-9"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" className="w-full h-9" disabled={formHook.formState.isSubmitting}>
                {formHook.formState.isSubmitting ? "Placing Order..." : "Place Order"}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default KucoinTradePanel;
