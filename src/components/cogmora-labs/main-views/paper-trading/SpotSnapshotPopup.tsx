
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
import type { SpotSnapshotData } from '@/types';
import { Separator } from '@/components/ui/separator';

interface SpotSnapshotPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  symbolName: string;
  baseCurrency: string;
  quoteCurrency: string;
  data: SpotSnapshotData;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
  <div className={`flex justify-between items-center text-sm ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-right">{value}</span>
  </div>
);

const formatPrice = (price?: number | null) => {
  if (price === undefined || price === null) return 'N/A';
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  };
  if (Math.abs(price) < 1) {
    options.maximumFractionDigits = 8;
  } else {
    options.maximumFractionDigits = 4;
  }
  return price.toLocaleString('en-US', options);
};

const formatPercent = (rate?: number | null) => {
    if (rate === undefined || rate === null) return 'N/A';
    const isPositive = rate >= 0;
    const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
    return <span className={colorClass}>{`${isPositive ? '+' : ''}${(rate * 100).toFixed(2)}%`}</span>;
}

const formatVolume = (vol?: number | null) => {
    if (vol === undefined || vol === null) return 'N/A';
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toFixed(2);
}

export const SpotSnapshotPopup: React.FC<SpotSnapshotPopupProps> = ({ isOpen, onOpenChange, symbolName, baseCurrency, quoteCurrency, data }) => {

  const isPositiveChange = data.changeRate !== null && data.changeRate !== undefined && data.changeRate >= 0;
  const changeColorClass = isPositiveChange ? 'text-green-500' : 'text-red-500';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Snapshot: {symbolName}</DialogTitle>
          <DialogDescription>
            Live data snapshot for {baseCurrency}/{quoteCurrency}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <InfoRow label="Last Price" value={formatPrice(data.lastTradedPrice)} className="text-lg" />
                <InfoRow label="24h Change" value={<span className={changeColorClass}>{formatPrice(data.changePrice)} ({formatPercent(data.changeRate)})</span>} />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Market Details</h4>
                <InfoRow label="24h High" value={formatPrice(data.high)} />
                <InfoRow label="24h Low" value={formatPrice(data.low)} />
                <InfoRow label="24h Volume (Tokens)" value={formatVolume(data.vol)} />
                <InfoRow label="24h Volume (Value)" value={formatPrice(data.volValue)} />
            </div>

            <Separator />

            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Order Book</h4>
                <InfoRow label="Best Bid (Buy)" value={formatPrice(data.buy)} />
                <InfoRow label="Best Ask (Sell)" value={formatPrice(data.sell)} />
            </div>

            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Fees</h4>
                <InfoRow label="Taker Fee" value={data.takerFeeRate !== null && data.takerFeeRate !== undefined ? `${(data.takerFeeRate * 100).toFixed(3)}%` : 'N/A'} />
                <InfoRow label="Maker Fee" value={data.makerFeeRate !== null && data.makerFeeRate !== undefined ? `${(data.makerFeeRate * 100).toFixed(3)}%` : 'N/A'} />
            </div>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
