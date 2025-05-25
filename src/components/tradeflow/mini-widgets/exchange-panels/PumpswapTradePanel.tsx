
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
import { TrendingUp, TrendingDown, Rocket } from 'lucide-react'; // Using Rocket as a placeholder for Pumpswap icon
import { ScrollArea } from '@/components/ui/scroll-area';

// Simplified schema for Pumpswap (like pump.fun)
const pumpswapTradeSchema = z.object({
  tokenAddress: z.string().min(32, "Token address must be valid (e.g., Solana address)").max(44, "Token address too long"), // Typical Solana address length
  side: z.enum(['buy', 'sell'], { required_error: "Please select a side (buy/sell)." }),
  amountSol: z.coerce.number().positive("Amount (in SOL) must be a positive number."), // Assuming trades are in SOL
});

type PumpswapTradeFormData = z.infer<typeof pumpswapTradeSchema>;

const PumpswapTradePanel: React.FC = () => {
  const { toast } = useToast();
  const formHook = useForm<PumpswapTradeFormData>({ 
    resolver: zodResolver(pumpswapTradeSchema),
    defaultValues: {
      tokenAddress: '',
      side: undefined,
      amountSol: undefined,
    },
  });

  const onSubmit: SubmitHandler<PumpswapTradeFormData> = (data) => {
    toast({
      title: "Pumpswap Trade Placed (Simulated)",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-card-foreground/10 p-4">
          <code className="text-foreground">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
    console.log("Pumpswap Trade Data:", data);
  };

  return (
    <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
      <CardHeader className="px-3 pt-1 pb-2 border-b">
        <CardTitle className="flex items-center text-lg"><Rocket className="mr-2 h-5 w-5 text-orange-500" />Pumpswap Trade</CardTitle>
        <CardDescription className="text-xs">Trade new tokens on Pumpswap (simulated).</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col min-h-0 p-0 overflow-hidden">
        <ScrollArea className="flex-grow p-3 min-h-0"> 
          <Form {...formHook}>
            <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={formHook.control}
                name="tokenAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Address (Contract)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter token contract address" {...field} className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={formHook.control}
                name="side"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select action" />
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
              <FormField
                control={formHook.control}
                name="amountSol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (SOL)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 0.1 SOL" {...field} step="any" className="h-9"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full h-9" disabled={formHook.formState.isSubmitting}>
                {formHook.formState.isSubmitting ? "Processing..." : "Execute Trade"}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PumpswapTradePanel;
