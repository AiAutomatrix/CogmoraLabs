

"use client";

import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface WatchlistTradeTriggerPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: WatchlistItem | null;
}

export const WatchlistTradeTriggerPopup: React.FC<WatchlistTradeTriggerPopupProps> = ({ isOpen, onOpenChange, item }) => {
  const { balance, buy, futuresBuy, futuresSell, addTradeTrigger } = usePaperTrading();
  
  const [tradeType, setTradeType] = useState<'instant' | 'trigger'>('trigger');
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot');
  
  // States for instant trade
  const [allocation, setAllocation] = useState('100'); // For both spot and futures collateral
  const [leverage, setLeverage] = useState([10]);

  // States for triggered trade
  const [triggerCondition, setTriggerCondition] = useState<'above' | 'below'>('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [triggerAction, setTriggerAction] = useState<'buy' | 'long' | 'short'>('buy');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [cancelOthers, setCancelOthers] = useState(false);
  
  useEffect(() => {
    if (item) {
        // Reset to trigger type and spot market whenever a new item is selected
        setTradeType('trigger');
        setMarketType('spot');
        // Set trigger action based on the default market type
        setTriggerAction('buy');
    }
  }, [item]);


  if (!item) return null;

  const maxLeverage = 100; // Assuming max 100 for futures, can be dynamic later

  const handleInstantTrade = (side?: 'long' | 'short') => {
    const amountUSD = parseFloat(allocation);
    if (isNaN(amountUSD) || amountUSD <= 0 || amountUSD > balance) return;
    
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    if (item.type === 'spot') {
      buy(item.symbol, item.symbolName, amountUSD, item.currentPrice, sl, tp);
    } else { // This is for items that are already futures type from the screener
      if (side === 'long') {
        futuresBuy(item.symbol, amountUSD, item.currentPrice, leverage[0], sl, tp);
      } else if (side === 'short') {
        futuresSell(item.symbol, amountUSD, item.currentPrice, leverage[0], sl, tp);
      }
    }
    onOpenChange(false);
  };
  
  const handleSetTrigger = () => {
    const price = parseFloat(targetPrice);
    const amount = parseFloat(allocation);

    if (isNaN(price) || price <= 0 || isNaN(amount) || amount <= 0 || amount > balance) {
        return;
    }
    
    const finalSymbol = marketType === 'futures' && item.futuresSymbol ? item.futuresSymbol : item.symbol;
    const finalSymbolName = marketType === 'futures' && item.futuresSymbol ? item.futuresSymbol.replace(/M$/, '') : item.symbolName;

    addTradeTrigger({
        symbol: finalSymbol,
        symbolName: finalSymbolName,
        type: marketType,
        condition: triggerCondition,
        targetPrice: price,
        action: triggerAction,
        amount: amount,
        leverage: leverage[0],
        cancelOthers,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });
    onOpenChange(false);
  };

  const amountUSD = parseFloat(allocation);
  const positionValue = amountUSD * (marketType === 'futures' ? leverage[0] : 1);
  const tokenAmount = !isNaN(positionValue) && item.currentPrice > 0 ? (positionValue / item.currentPrice).toFixed(4) : '0.00';
  
  const showFuturesOption = item.type === 'futures' || (item.type === 'spot' && item.hasFutures);
  const isFuturesMode = (item.type === 'futures' && tradeType === 'instant') || (tradeType === 'trigger' && marketType === 'futures');
  
  // Disable instant trading for spot items with a futures market to encourage using triggers
  const isInstantDisabled = item.type === 'spot' && showFuturesOption;

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
                <TabsTrigger value="instant" disabled={isInstantDisabled}>Instant Order</TabsTrigger>
                <TabsTrigger value="trigger">Trade Trigger</TabsTrigger>
            </TabsList>
            <TabsContent value="instant" className="space-y-4 pt-4">
                {isInstantDisabled ? (
                    <Alert>
                        <AlertDescription>
                            Instant spot trading is disabled for items with a futures market. Please use a Trade Trigger.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
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
                                <span>${(amountUSD * (item.type === 'futures' ? leverage[0] : 1)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
                                    <Button type="button" onClick={() => handleInstantTrade()} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="col-span-2">
                                        Buy
                                    </Button>
                                ) : (
                                    <>
                                    <Button type="button" onClick={() => handleInstantTrade('long')} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-green-600 hover:bg-green-700">
                                        Buy / Long
                                    </Button>
                                    <Button type="button" onClick={() => handleInstantTrade('short')} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-red-600 hover:bg-red-700">
                                        Sell / Short
                                    </Button>
                                    </>
                                )}
                            </div>
                        </DialogFooter>
                    </>
                )}
            </TabsContent>
            <TabsContent value="trigger" className="space-y-4 pt-4">
                <Alert>
                    <AlertDescription>
                        Create an order that will be executed automatically when your target price is met.
                    </AlertDescription>
                </Alert>

                {showFuturesOption && (
                    <div className="space-y-2">
                        <Label>Market Type</Label>
                        <RadioGroup value={marketType} onValueChange={(val: any) => {
                            setMarketType(val);
                            setTriggerAction(val === 'spot' ? 'buy' : 'long');
                        }}>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="spot" id="market-spot" /><Label htmlFor="market-spot">Spot</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="futures" id="market-futures" /><Label htmlFor="market-futures">Futures</Label></div>
                        </RadioGroup>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Condition</Label>
                         <RadioGroup defaultValue="below" value={triggerCondition} onValueChange={(val: 'above' | 'below') => setTriggerCondition(val)}>
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
                        {marketType === 'spot' ? (
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
                         {marketType === 'spot' ? 'Allocation (USD)' : 'Collateral (USD)'}
                    </Label>
                    <Input
                        id="allocation-trigger"
                        type="number"
                        placeholder="e.g., 100"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                    />
                </div>
                
                 {isFuturesMode && (
                    <div className="space-y-3">
                        <Label htmlFor="leverage-trigger">Leverage: {leverage[0]}x</Label>
                        <Slider
                            id="leverage-trigger"
                            min={1} max={maxLeverage} step={1}
                            value={leverage} onValueChange={setLeverage}
                        />
                    </div>
                )}

                <Separator />

                <div className="space-y-3">
                    <Label>Advanced Options</Label>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="stop-loss" className="text-xs">Stop Loss Price</Label>
                            <Input id="stop-loss" type="number" placeholder="Optional" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="take-profit" className="text-xs">Take Profit Price</Label>
                            <Input id="take-profit" type="number" placeholder="Optional" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="cancel-others" checked={cancelOthers} onCheckedChange={(checked) => setCancelOthers(Boolean(checked))} />
                        <Label htmlFor="cancel-others" className="text-sm font-normal">Cancel other triggers for this symbol on execution</Label>
                    </div>
                </div>
                
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
