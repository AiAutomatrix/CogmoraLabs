
'use client';

import type React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Coins, TrendingUp, TrendingDown, Zap, Settings } from 'lucide-react';

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
  const form = useForm<KucoinTradeFormData>({
    resolver: zodResolver(kucoinTradeSchema),
    defaultValues: {
      symbol: '',
      tradeType: undefined,
      orderType: undefined,
      side: undefined,
      amount: undefined,
      price: undefined,
      leverage: 1,
    },
  });

  const watchedTradeType = form.watch('tradeType');
  const watchedOrderType = form.watch('orderType');

  const onSubmit: SubmitHandler<KucoinTradeFormData> = (data) => {
    toast({
      title: "Order Placed (Simulated)",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-card-foreground/10 p-4">
          <code className="text-foreground">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
    console.log("Kucoin Trade Data:", data);
    // form.reset(); // Optionally reset form
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center"><Coins className="mr-2 h-6 w-6 text-green-500" /> Kucoin Trade Panel</CardTitle>
        <CardDescription>Place spot and futures orders (simulation).</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol (e.g., BTC/USDT)</FormLabel>
                  <FormControl>
                    <Input placeholder="BTC/USDT" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tradeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                control={form.control}
                name="orderType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
              control={form.control}
              name="side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Side</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter price for limit order" {...field} step="any" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (e.g. in BTC or USDT)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter amount" {...field} step="any"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedTradeType === 'futures' && (
              <FormField
                control={form.control}
                name="leverage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leverage (1x-100x)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 10" {...field} min="1" max="100" step="1"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Placing Order..." : "Place Order"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default KucoinTradePanel;
