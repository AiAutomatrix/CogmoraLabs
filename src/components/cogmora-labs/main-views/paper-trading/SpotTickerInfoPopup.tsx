
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
import type { KucoinTicker } from '@/hooks/useKucoinAllTickersSocket';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface SpotTickerInfoPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ticker: KucoinTicker | null;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, className?: string }> = ({ label, value, className }) => (
  <div className={`flex justify-between items-center text-sm ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-right">{value}</span>
  </div>
);

const formatPrice = (priceStr?: string | null) => {
  if (!priceStr) return 'N/A';
  const price = parseFloat(priceStr);
  if (isNaN(price)) return 'N/A';
  
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

const formatPercent = (rateStr?: string | null) => {
    if (!rateStr) return 'N/A';
    const rate = parseFloat(rateStr);
    if (isNaN(rate)) return 'N/A';
    const isPositive = rate >= 0;
    const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
    return <span className={colorClass}>{`${isPositive ? '+' : ''}${(rate * 100).toFixed(2)}%`}</span>;
}

const formatVolume = (volStr?: string | null) => {
    if (!volStr) return 'N/A';
    const vol = parseFloat(volStr);
    if (isNaN(vol)) return 'N/A';
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toFixed(2);
}

export const SpotTickerInfoPopup: React.FC<SpotTickerInfoPopupProps> = ({ isOpen, onOpenChange, ticker }) => {

  if (!ticker) return null;

  const isPositiveChange = parseFloat(ticker.changeRate) >= 0;
  const changeColorClass = isPositiveChange ? 'text-green-500' : 'text-red-500';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ticker Info: {ticker.symbolName}</DialogTitle>
          <DialogDescription>
            A snapshot of the latest market data for this ticker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <InfoRow label="Last Price" value={formatPrice(ticker.last)} className="text-lg" />
                <InfoRow label="24h Change" value={<span className={changeColorClass}>{formatPrice(ticker.changePrice)} ({formatPercent(ticker.changeRate)})</span>} />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Market Details</h4>
                <InfoRow label="24h High" value={formatPrice(ticker.high)} />
                <InfoRow label="24h Low" value={formatPrice(ticker.low)} />
                <InfoRow label="24h Volume (Tokens)" value={formatVolume(ticker.vol)} />
                <InfoRow label="24h Volume (Value)" value={formatPrice(ticker.volValue)} />
            </div>

            <Separator />

            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Order Book</h4>
                <InfoRow label="Best Bid (Buy)" value={formatPrice(ticker.buy)} />
                <InfoRow label="Best Ask (Sell)" value={formatPrice(ticker.sell)} />
            </div>

            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Fees</h4>
                <InfoRow label="Taker Fee" value={`${(parseFloat(ticker.takerFeeRate) * 100).toFixed(3)}%`} />
                <InfoRow label="Maker Fee" value={`${(parseFloat(ticker.makerFeeRate) * 100).toFixed(3)}%`} />
            </div>

        </div>
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
