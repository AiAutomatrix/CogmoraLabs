
"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePaperTrading } from '@/context/PaperTradingContext';
import type { WatchlistItem } from '@/types';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WatchlistTradeTriggerPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: WatchlistItem | null;
}

export const WatchlistTradeTriggerPopup: React.FC<WatchlistTradeTriggerPopupProps> = ({ isOpen, onOpenChange, item }) => {
  const { balance, buy, futuresBuy, futuresSell, addTradeTrigger } = usePaperTrading();
  
  const [tradeType, setTradeType] = useState<'instant' | 'trigger'>('instant');
  
  // States for instant trade
  const [allocation, setAllocation] = useState('100'); // For both spot and futures collateral
  const [leverage, setLeverage] = useState([10]);

  // States for triggered trade
  const [triggerCondition, setTriggerCondition] = useState<'above' | 'below'>('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [triggerAction, setTriggerAction] = useState<'buy' | 'long' | 'short'>('buy');

  if (!item) return null;

  const maxLeverage = item.type === 'futures' ? 100 : 1; // Assuming max 100 for futures, can be dynamic later

  const handleInstantTrade = () => {
    const amountUSD = parseFloat(allocation);
    if (isNaN(amountUSD) || amountUSD <= 0 || amountUSD > balance) return;

    if (item.type === 'spot') {
      buy(item.symbol, item.symbolName, amountUSD, item.currentPrice);
    } else {
      if (triggerAction === 'long') {
        futuresBuy(item.symbol, amountUSD, item.currentPrice, leverage[0]);
      } else if (triggerAction === 'short') {
        futuresSell(item.symbol, amountUSD, item.currentPrice, leverage[0]);
      }
    }
    onOpenChange(false);
  };
  
  const handleSetTrigger = () => {
    const price = parseFloat(targetPrice);
    const amount = parseFloat(allocation);

    if (isNaN(price) || price <= 0 || isNaN(amount) || amount <= 0 || amount > balance) {
        // Basic validation feedback
        return;
    }

    addTradeTrigger({
        symbol: item.symbol,
        symbolName: item.symbolName,
        type: item.type,
        condition: triggerCondition,
        targetPrice: price,
        action: triggerAction,
        amount: amount,
        leverage: leverage[0],
    });
    onOpenChange(false);
  };

  const amountUSD = parseFloat(allocation);
  const positionValue = amountUSD * leverage[0];
  const tokenAmount = !isNaN(positionValue) && item.currentPrice > 0 ? (positionValue / item.currentPrice).toFixed(4) : '0.00';


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Trade {item.symbolName}</DialogTitle>
          <DialogDescription>
            Current Price: ${item.currentPrice.toFixed(4)} | Your Balance: {balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={tradeType} onValueChange={(val) => setTradeType(val as 'instant' | 'trigger')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instant">Instant Order</TabsTrigger>
                <TabsTrigger value="trigger">Trade Trigger</TabsTrigger>
            </TabsList>
            <TabsContent value="instant" className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="allocation-instant">
                        {item.type === 'spot' ? 'Allocation (USD)' : 'Collateral (USD)'}
                    </Label>
                    <Input
                        id="allocation-instant"
                        type="number"
                        placeholder="e.g., 100"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                    />
                </div>
                
                {item.type === 'futures' && (
                    <div className="space-y-3">
                        <Label htmlFor="leverage-instant">Leverage: {leverage[0]}x</Label>
                        <Slider
                            id="leverage-instant"
                            min={1} max={maxLeverage} step={1}
                            value={leverage} onValueChange={setLeverage}
                        />
                    </div>
                )}

                 <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                    <h3 className="font-semibold text-base">Trade Summary</h3>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Position Value:</span>
                        <span>${positionValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity (Approx):</span>
                        <span>{tokenAmount} {item.symbolName.split('-')[0]}</span>
                    </div>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <div className="grid grid-cols-2 gap-2">
                        {item.type === 'spot' ? (
                            <Button type="button" onClick={handleInstantTrade} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="col-span-2">
                                Buy
                            </Button>
                        ) : (
                            <>
                            <Button type="button" onClick={() => { setTriggerAction('long'); handleInstantTrade(); }} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-green-600 hover:bg-green-700">
                                Buy / Long
                            </Button>
                            <Button type="button" onClick={() => { setTriggerAction('short'); handleInstantTrade(); }} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-red-600 hover:bg-red-700">
                                Sell / Short
                            </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>
            </TabsContent>
            <TabsContent value="trigger" className="space-y-4 pt-4">
                <Alert>
                    <AlertDescription>
                        Create an order that will be executed automatically when your target price is met.
                    </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Condition</Label>
                         <RadioGroup defaultValue="below" onValueChange={(val: 'above' | 'below') => setTriggerCondition(val)}>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="above" id="above-trigger" /><Label htmlFor="above-trigger">Price is Above</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="below" id="below-trigger" /><Label htmlFor="below-trigger">Price is Below</Label></div>
                        </RadioGroup>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="target-price">Target Price (USD)</Label>
                        <Input
                            id="target-price"
                            type="number"
                            placeholder={item.currentPrice.toFixed(4)}
                            value={targetPrice}
                            onChange={e => setTargetPrice(e.target.value)}
                        />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Action to Trigger</Label>
                     <RadioGroup value={triggerAction} onValueChange={(val) => setTriggerAction(val as any)}>
                        {item.type === 'spot' ? (
                            <div className="flex items-center space-x-2"><RadioGroupItem value="buy" id="action-buy" /><Label htmlFor="action-buy">Buy (Spot)</Label></div>
                        ) : (
                            <>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="long" id="action-long" /><Label htmlFor="action-long">Go Long (Futures)</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="short" id="action-short" /><Label htmlFor="action-short">Go Short (Futures)</Label></div>
                            </>
                        )}
                    </RadioGroup>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="allocation-trigger">
                         {item.type === 'spot' ? 'Allocation (USD)' : 'Collateral (USD)'}
                    </Label>
                    <Input
                        id="allocation-trigger"
                        type="number"
                        placeholder="e.g., 100"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                    />
                </div>
                
                 {item.type === 'futures' && (
                    <div className="space-y-3">
                        <Label htmlFor="leverage-trigger">Leverage: {leverage[0]}x</Label>
                        <Slider
                            id="leverage-trigger"
                            min={1} max={maxLeverage} step={1}
                            value={leverage} onValueChange={setLeverage}
                        />
                    </div>
                )}
                
                <DialogFooter className="grid grid-cols-2 gap-2 pt-4">
                     <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                     <Button type="button" onClick={handleSetTrigger} disabled={!targetPrice || !allocation || amountUSD <= 0 || amountUSD > balance}>
                        Set Trade Trigger
                    </Button>
                </DialogFooter>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
