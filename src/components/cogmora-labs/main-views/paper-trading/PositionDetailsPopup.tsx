
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

interface PositionDetailsPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  position: OpenPosition | null;
}

export const PositionDetailsPopup: React.FC<PositionDetailsPopupProps> = ({ isOpen, onOpenChange, position }) => {
  const { updatePositionSlTp } = usePaperTrading();
  
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

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
  
  const formatPrice = (price?: number) => {
    if (price === undefined) return 'Not Set';
    return price.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stop-loss" className="text-right">
              Stop Loss
            </Label>
            <Input
              id="stop-loss"
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder={position.side === 'long' ? 'e.g., 60000' : 'e.g., 70000'}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="take-profit" className="text-right">
              Take Profit
            </Label>
            <Input
              id="take-profit"
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder={position.side === 'long' ? 'e.g., 80000' : 'e.g., 50000'}
              className="col-span-3"
            />
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
