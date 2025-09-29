"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePaperTrading } from '@/context/PaperTradingContext';
import type { KucoinFuturesContract } from '@/hooks/useKucoinFuturesTickers';
import { Slider } from '@/components/ui/slider';

interface FuturesTradePopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  contract: KucoinFuturesContract | null;
}

export const FuturesTradePopup: React.FC<FuturesTradePopupProps> = ({ isOpen, onOpenChange, contract }) => {
  const { futuresBuy, futuresSell, balance } = usePaperTrading();
  const [allocation, setAllocation] = useState('100');
  const [leverage, setLeverage] = useState([10]);

  if (!contract) return null;

  const handleTrade = (side: 'long' | 'short') => {
    const amountUSD = parseFloat(allocation);
    const currentPrice = contract.markPrice;
    if (!isNaN(amountUSD) && amountUSD > 0 && !isNaN(currentPrice)) {
      if (side === 'long') {
        futuresBuy(contract.symbol, amountUSD, currentPrice, leverage[0]);
      } else {
        futuresSell(contract.symbol, amountUSD, currentPrice, leverage[0]);
      }
      onOpenChange(false);
      setAllocation('100');
      setLeverage([10]);
    }
  };

  const currentPrice = contract.markPrice;
  const amountUSD = parseFloat(allocation);
  const positionValue = amountUSD * leverage[0];
  const tokenAmount = !isNaN(positionValue) && currentPrice > 0 ? (positionValue / currentPrice).toFixed(4) : '0.00';
  
  const maxLeverage = contract.maxLeverage;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trade {contract.symbol.replace(/M$/, '')}</DialogTitle>
          <DialogDescription>
            Current Price: ${currentPrice.toFixed(4)} | Your Balance: {balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="allocation">Collateral Allocation (USD)</Label>
            <Input
              id="allocation"
              type="number"
              placeholder="e.g., 100"
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
            />
             <p className="text-xs text-muted-foreground">This is the amount of your balance to use as margin.</p>
          </div>
           <div className="space-y-3">
            <Label htmlFor="leverage">Leverage: {leverage[0]}x</Label>
             <Slider
              id="leverage"
              min={1}
              max={maxLeverage}
              step={1}
              value={leverage}
              onValueChange={setLeverage}
            />
            <p className="text-xs text-muted-foreground">Max leverage for this contract is {maxLeverage}x.</p>
          </div>
          <div className="p-4 bg-muted rounded-md space-y-2">
            <h3 className="font-semibold">Trade Summary</h3>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Position Value:</span>
                <span>${positionValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity (Approx):</span>
                <span>{tokenAmount} {contract.baseCurrency}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DialogClose asChild className="sm:col-start-2">
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2">
                <Button type="button" onClick={() => handleTrade('long')} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-green-600 hover:bg-green-700">
                    Buy / Long
                </Button>
                <Button type="button" onClick={() => handleTrade('short')} disabled={!allocation || amountUSD <= 0 || amountUSD > balance} className="bg-red-600 hover:bg-red-700">
                    Sell / Short
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
