
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
import type { KucoinTicker } from '@/hooks/useKucoinAllTickersSocket';

interface TradePopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ticker: KucoinTicker | null;
}

export const TradePopup: React.FC<TradePopupProps> = ({ isOpen, onOpenChange, ticker }) => {
  const { buy, balance } = usePaperTrading();
  const [allocation, setAllocation] = useState('');

  if (!ticker) return null;

  const handleBuy = () => {
    const amountUSD = parseFloat(allocation);
    const currentPrice = parseFloat(ticker.last);
    if (!isNaN(amountUSD) && amountUSD > 0 && !isNaN(currentPrice)) {
      buy(ticker.symbol, ticker.symbolName, amountUSD, currentPrice);
      onOpenChange(false);
      setAllocation('');
    }
  };

  const currentPrice = parseFloat(ticker.last);
  const amountUSD = parseFloat(allocation);
  const tokenAmount = !isNaN(amountUSD) && currentPrice > 0 ? (amountUSD / currentPrice).toFixed(6) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy {ticker.symbolName}</DialogTitle>
          <DialogDescription>
            Current Price: ${currentPrice.toFixed(4)} | Your Balance: ${balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="allocation">How much money do you want to allocate? (USD)</Label>
            <Input
              id="allocation"
              type="number"
              placeholder="e.g., 1000"
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            You will receive approximately <span className="font-bold text-primary">{tokenAmount}</span> tokens.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleBuy} disabled={!allocation || parseFloat(allocation) <= 0 || parseFloat(allocation) > balance}>
            Confirm Buy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
