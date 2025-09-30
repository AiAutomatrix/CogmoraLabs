
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
import type { OpenPosition } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

interface PositionDetailsPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  position: OpenPosition | null;
}

export const PositionDetailsPopup: React.FC<PositionDetailsPopupProps> = ({ isOpen, onOpenChange, position }) => {
  const { updatePositionSlTp } = usePaperTrading();
  
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [slPercentage, setSlPercentage] = useState([5]);
  const [tpPercentage, setTpPercentage] = useState([10]);

  useEffect(() => {
    if (position?.details) {
      setStopLoss(position.details.stopLoss?.toString() || '');
      setTakeProfit(position.details.takeProfit?.toString() || '');
    } else {
        setStopLoss('');
        setTakeProfit('');
    }
  }, [position]);

  if (!position) return null;

  const handleUpdate = () => {
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    updatePositionSlTp(position.id, sl, tp);
    onOpenChange(false);
  };
  
  const calculatePriceFromPercentage = (percentage: number, isStopLoss: boolean) => {
    const price = position.currentPrice;
    let change;
    if (position.side === 'long') {
        change = isStopLoss ? -(price * (percentage / 100)) : (price * (percentage / 100));
    } else { // short
        change = isStopLoss ? (price * (percentage / 100)) : -(price * (percentage / 100));
    }
    return (price + change);
  }

  const handleSlSliderChange = (value: number[]) => {
      setSlPercentage(value);
      const newPrice = calculatePriceFromPercentage(value[0], true);
      setStopLoss(newPrice.toFixed(4));
  }
  
  const handleTpSliderChange = (value: number[]) => {
      setTpPercentage(value);
      const newPrice = calculatePriceFromPercentage(value[0], false);
      setTakeProfit(newPrice.toFixed(4));
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trade Details: {position.symbolName}</DialogTitle>
          <DialogDescription asChild>
            <div>
              Manage Stop Loss and Take Profit for this position.
              <br />
              Triggered via: <Badge variant="outline" className="capitalize">{position.details?.triggeredBy || 'Manual'}</Badge>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
            {/* Stop Loss Section */}
            <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                    <Label htmlFor="stop-loss" className="text-base">Stop Loss</Label>
                    <span className="text-xs text-muted-foreground">Current Price: {formatPrice(position.currentPrice)}</span>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Set by Percentage (-{slPercentage[0]}%)</Label>
                    <Slider value={slPercentage} onValueChange={handleSlSliderChange} max={50} step={0.5} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="stop-loss" className="text-xs text-muted-foreground">Set by Price</Label>
                    <Input
                        id="stop-loss"
                        type="number"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder={position.side === 'long' ? 'e.g., 60000' : 'e.g., 70000'}
                    />
                </div>
            </div>

            <Separator />
            
            {/* Take Profit Section */}
            <div className="space-y-3">
                 <Label htmlFor="take-profit" className="text-base">Take Profit</Label>
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Set by Percentage (+{tpPercentage[0]}%)</Label>
                    <Slider value={tpPercentage} onValueChange={handleTpSliderChange} max={100} step={1} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="take-profit" className="text-xs text-muted-foreground">Set by Price</Label>
                    <Input
                        id="take-profit"
                        type="number"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        placeholder={position.side === 'long' ? 'e.g., 80000' : 'e.g., 50000'}
                    />
                </div>
            </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleUpdate}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const formatPrice = (price?: number) => {
    if (price === undefined) return 'N/A';
    return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

    