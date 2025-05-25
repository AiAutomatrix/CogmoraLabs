
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
import { TrendingUp, TrendingDown, Zap, Settings, Replace } from 'lucide-react'; // Using Replace as a placeholder for Raydium icon
import { ScrollArea } from '@/components/ui/scroll-area';

// Using a simplified schema for Raydium, focusing on spot trades
const raydiumTradeSchema = z.object({
  symbol: z.string().min(3, "Symbol must be at least 3 characters (e.g., SOL/USDC)").toUpperCase(),
  // tradeType: z.literal('spot').default('spot'), // Raydium is primarily spot
  orderType: z.enum(['market', 'limit'], { required_error: "Please select an order type." }),
  side: z.enum(['buy', 'sell'], { required_error: "Please select a side (buy/sell)." }),
  price: z.coerce.number().optional(),
  amount: z.coerce.number().positive("Amount must be a positive number."),
}).refine(data => data.orderType === 'limit' ? data.price !== undefined && data.price > 0 : true, {
  message: "Price is required for limit orders and must be positive.",
  path: ["price"],
});

type RaydiumTradeFormData = z.infer<typeof raydiumTradeSchema>;

const RaydiumTradePanel: React.FC = () => {
  const { toast } = useToast();
  const formHook = useForm<RaydiumTradeFormData>({ 
    resolver: zodResolver(raydiumTradeSchema),
    defaultValues: {
      symbol: '',
      orderType: undefined,
      side: undefined,
      amount: undefined,
      price: undefined,
    },
  });

  const watchedOrderType = formHook.watch('orderType');

  const onSubmit: SubmitHandler<RaydiumTradeFormData> = (data) => {
    toast({
      title: "Raydium Order Placed (Simulated)",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-card-foreground/10 p-4">
          <code className="text-foreground">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
    console.log("Raydium Trade Data:", data);
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 pt-1 pb-2 border-b">
        <CardTitle className="flex items-center text-lg"><Replace className="mr-2 h-5 w-5 text-purple-500" />Raydium Trade</CardTitle>
        <CardDescription className="text-xs">Place spot orders on Raydium (simulated).</CardDescription>
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
                    <FormLabel>Symbol (e.g., SOL/USDC)</FormLabel>
                    <FormControl>
                      <Input placeholder="SOL/USDC" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} className="h-9" />
                    </FormControl>
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
                        <SelectItem value="buy"><TrendingUp className="mr-2 h-4 w-4 text-green-500 inline-block" />Buy</SelectItem>
                        <SelectItem value="sell"><TrendingDown className="mr-2 h-4 w-4 text-red-500 inline-block" />Sell</SelectItem>
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
                      <FormLabel>Price (in Quote Asset)</FormLabel>
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
                    <FormLabel>Amount (in Base Asset)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Enter amount" {...field} step="any" className="h-9"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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

export default RaydiumTradePanel;
