
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
import { useLandingPageDemo } from '@/context/LandingPageDemoContext';
import type { WatchlistItem } from '@/types';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface LandingPageWatchlistTradeTriggerPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: WatchlistItem | null;
}

export const LandingPageWatchlistTradeTriggerPopup: React.FC<LandingPageWatchlistTradeTriggerPopupProps> = ({ isOpen, onOpenChange, item }) => {
  const { addTradeTrigger } = useLandingPageDemo();
  
  const [tradeType, setTradeType] = useState<'instant' | 'trigger'>('trigger');
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot');
  
  const [allocation, setAllocation] = useState('100');
  const [leverage, setLeverage] = useState([10]);

  const [triggerCondition, setTriggerCondition] = useState<'above' | 'below'>('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [triggerAction, setTriggerAction] = useState<'buy' | 'long' | 'short'>('buy');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [cancelOthers, setCancelOthers] = useState(false);
  
  useEffect(() => {
    if (item) {
        setTradeType('trigger');
        setMarketType('spot');
        setTriggerAction('buy');
    }
  }, [item]);


  if (!item) return null;

  const maxLeverage = 100;

  const handleInstantTrade = () => {
    toast({ title: 'Demo Action', description: 'This would execute an instant trade in the full application.'});
    onOpenChange(false);
  };
  
  const handleSetTrigger = () => {
    const price = parseFloat(targetPrice);
    const amount = parseFloat(allocation);

    if (isNaN(price) || price <= 0 || isNaN(amount) || amount <= 0) {
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
  
  const { toast } = useToast();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Trade {item.symbolName} (Demo)</DialogTitle>
          <DialogDescription>
            Current Price: ${item.currentPrice.toFixed(4)}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={tradeType} onValueChange={(val) => setTradeType(val as 'instant' | 'trigger')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instant">Instant Order</TabsTrigger>
                <TabsTrigger value="trigger">Trade Trigger</TabsTrigger>
            </TabsList>
            <TabsContent value="instant" className="space-y-4 pt-4">
                 <Alert>
                    <AlertDescription>
                        This is a demo. Instant trades are disabled. Use the "Trade Trigger" tab to see how conditional orders work.
                    </AlertDescription>
                </Alert>
                <DialogFooter className="pt-4">
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </TabsContent>
            <TabsContent value="trigger" className="space-y-4 pt-4">
                <Alert>
                    <AlertDescription>
                        Create an order that will be added to the demo watchlist below.
                    </AlertDescription>
                </Alert>

                {showFuturesOption && (
                    <div className="space-y-2">
                        <Label>Market Type</Label>
                        <RadioGroup value={marketType} onValueChange={(val: any) => {
                            setMarketType(val);
                            setTriggerAction(val === 'spot' ? 'buy' : 'long');
                        }}>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="spot" id="market-spot-demo" /><Label htmlFor="market-spot-demo">Spot</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="futures" id="market-futures-demo" /><Label htmlFor="market-futures-demo">Futures</Label></div>
                        </RadioGroup>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Condition</Label>
                         <RadioGroup defaultValue="below" value={triggerCondition} onValueChange={(val: 'above' | 'below') => setTriggerCondition(val)}>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="above" id="above-trigger-demo" /><Label htmlFor="above-trigger-demo">Price is Above</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="below" id="below-trigger-demo" /><Label htmlFor="below-trigger-demo">Price is Below</Label></div>
                        </RadioGroup>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="target-price-demo">Target Price (USD)</Label>
                        <Input
                            id="target-price-demo"
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
                            <div className="flex items-center space-x-2"><RadioGroupItem value="buy" id="action-buy-demo" /><Label htmlFor="action-buy-demo">Buy (Spot)</Label></div>
                        ) : (
                            <>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="long" id="action-long-demo" /><Label htmlFor="action-long-demo">Go Long (Futures)</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="short" id="action-short-demo" /><Label htmlFor="action-short-demo">Go Short (Futures)</Label></div>
                            </>
                        )}
                    </RadioGroup>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="allocation-trigger-demo">
                         {marketType === 'spot' ? 'Allocation (USD)' : 'Collateral (USD)'}
                    </Label>
                    <Input
                        id="allocation-trigger-demo"
                        type="number"
                        placeholder="e.g., 100"
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                    />
                </div>
                
                 {isFuturesMode && (
                    <div className="space-y-3">
                        <Label htmlFor="leverage-trigger-demo">Leverage: {leverage[0]}x</Label>
                        <Slider
                            id="leverage-trigger-demo"
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
                            <Label htmlFor="stop-loss-demo" className="text-xs">Stop Loss Price</Label>
                            <Input id="stop-loss-demo" type="number" placeholder="Optional" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="take-profit-demo" className="text-xs">Take Profit Price</Label>
                            <Input id="take-profit-demo" type="number" placeholder="Optional" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="cancel-others-demo" checked={cancelOthers} onCheckedChange={(checked) => setCancelOthers(Boolean(checked))} />
                        <Label htmlFor="cancel-others-demo" className="text-sm font-normal">Cancel other triggers for this symbol on execution</Label>
                    </div>
                </div>
                
                <DialogFooter className="grid grid-cols-2 gap-2 pt-4">
                     <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                     <Button type="button" onClick={handleSetTrigger} disabled={!targetPrice || !allocation}>
                        Set Demo Trigger
                    </Button>
                </DialogFooter>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
