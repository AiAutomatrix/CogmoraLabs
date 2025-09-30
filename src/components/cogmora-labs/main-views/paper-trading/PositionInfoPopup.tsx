
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { OpenPosition } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PositionInfoPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  position: OpenPosition | null;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono text-right ${valueClass}`}>{value}</span>
    </div>
);

export const PositionInfoPopup: React.FC<PositionInfoPopupProps> = ({ isOpen, onOpenChange, position }) => {

  if (!position) return null;

  const initialPositionValue = position.size * position.averageEntryPrice;
  const currentPositionValue = position.size * position.currentPrice;
  
  let roi, collateral;
  if (position.positionType === 'futures' && position.leverage) {
    collateral = initialPositionValue / position.leverage;
    roi = position.unrealizedPnl && collateral > 0 ? (position.unrealizedPnl / collateral) * 100 : 0;
  }
  
  const formatPrice = (price?: number) => {
    if (price === undefined) return 'N/A';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
    };
    // For values that need more precision (e.g., entry prices of cheap tokens)
    if (Math.abs(price) < 1 && Math.abs(price) > 0) {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 8;
    } else {
        options.minimumFractionDigits = 2;
        options.maximumFractionDigits = 2; 
    }
    return price.toLocaleString('en-US', options);
  };
  
  const formatCurrencyValue = (value?: number) => {
      if (value === undefined) return 'N/A';
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const formatPercent = (value?: number) => {
    if (value === undefined) return 'N/A';
    const className = value >= 0 ? 'text-green-500' : 'text-red-500';
    return <span className={className}>{value.toFixed(2)}%</span>;
  }

  const pnlClass = position.unrealizedPnl && position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Position Info: {position.symbolName}</DialogTitle>
           <DialogDescription asChild>
             <div>
              {position.positionType === 'futures' ? (
                  <Badge variant={position.side === 'long' ? 'default' : 'destructive'} className="capitalize">
                      {position.side} {position.leverage}x
                  </Badge>
              ) : (
                  <Badge variant="secondary">Spot Position</Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <h4 className="font-semibold">Financials</h4>
                <InfoRow label="Unrealized P&L" value={formatCurrencyValue(position.unrealizedPnl)} valueClass={pnlClass} />
                {roi !== undefined && <InfoRow label="ROI" value={formatPercent(roi)} />}
                <InfoRow label="Position Value" value={formatCurrencyValue(currentPositionValue)} />
                <InfoRow label="Initial Value" value={formatCurrencyValue(initialPositionValue)} />
            </div>

            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold">Trade Details</h4>
                <InfoRow label="Entry Price" value={formatPrice(position.averageEntryPrice)} />
                <InfoRow label="Current Price" value={formatPrice(position.currentPrice)} />
                <InfoRow label="Size" value={position.size.toPrecision(6)} />
            </div>
            
            {position.positionType === 'futures' && (
                <>
                <Separator />
                <div className="space-y-2">
                    <h4 className="font-semibold">Futures Details</h4>
                    {collateral !== undefined && <InfoRow label="Collateral" value={formatCurrencyValue(collateral)} />}
                    {position.liquidationPrice !== undefined && <InfoRow label="Est. Liq. Price" value={formatPrice(position.liquidationPrice)} valueClass="text-yellow-500" />}
                </div>
                </>
            )}

            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold">Risk Management</h4>
                <InfoRow label="Stop Loss" value={position.details?.stopLoss ? formatPrice(position.details.stopLoss) : 'Not Set'} />
                <InfoRow label="Take Profit" value={position.details?.takeProfit ? formatPrice(position.details.takeProfit) : 'Not Set'} />
            </div>

        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
