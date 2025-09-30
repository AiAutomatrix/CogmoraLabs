
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
import type { SpotSnapshotData, MarketChange } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpotSnapshotPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  symbolName: string;
  baseCurrency: string;
  quoteCurrency: string;
  data: SpotSnapshotData;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, className?: string, valueClassName?: string }> = ({ label, value, className, valueClassName }) => (
  <div className={`flex justify-between items-center text-sm ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono text-right ${valueClassName}`}>{value}</span>
  </div>
);

const formatPrice = (price?: number | null, quoteCurrency?: string) => {
  if (price === undefined || price === null || isNaN(price)) return 'N/A';
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: quoteCurrency || 'USD',
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
    if (rate === undefined || rate === null || isNaN(rate)) return 'N/A';
    const isPositive = rate >= 0;
    const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
    return <span className={colorClass}>{`${isPositive ? '+' : ''}${(rate * 100).toFixed(2)}%`}</span>;
}

const formatVolume = (vol?: number | null) => {
    if (vol === undefined || vol === null || isNaN(vol)) return 'N/A';
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
    return vol.toFixed(2);
}

const MarketChangeBlock: React.FC<{ title: string, data?: MarketChange | null, quoteCurrency?: string }> = ({ title, data, quoteCurrency }) => {
    if (!data) return null;
    return (
        <div className="space-y-1">
            <h4 className="font-semibold text-primary">{title}</h4>
            <InfoRow label="Change" value={<span>{formatPrice(data.changePrice, quoteCurrency)} ({formatPercent(data.changeRate)})</span>} />
            <InfoRow label="High" value={formatPrice(data.high, quoteCurrency)} />
            <InfoRow label="Low" value={formatPrice(data.low, quoteCurrency)} />
            <InfoRow label="Open" value={formatPrice(data.open, quoteCurrency)} />
            <InfoRow label="Volume" value={formatVolume(data.vol)} />
            <InfoRow label="Volume Value" value={formatPrice(data.volValue, quoteCurrency)} />
        </div>
    );
};


export const SpotSnapshotPopup: React.FC<SpotSnapshotPopupProps> = ({ isOpen, onOpenChange, symbolName, baseCurrency, quoteCurrency, data }) => {

  const isPositiveChange = data.changeRate !== null && data.changeRate !== undefined && data.changeRate >= 0;
  const changeColorClass = isPositiveChange ? 'text-green-500' : 'text-red-500';
  const quote = data.quoteCurrency || quoteCurrency;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Snapshot: {symbolName}</DialogTitle>
          <DialogDescription>
            Live data snapshot for {baseCurrency}/{quoteCurrency}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <InfoRow label="Last Price" value={formatPrice(data.lastTradedPrice, quote)} className="text-lg" />
                <InfoRow label="24h Change" value={<span className={changeColorClass}>{formatPrice(data.changePrice, quote)} ({formatPercent(data.changeRate)})</span>} />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Market Details</h4>
                <InfoRow label="Open" value={formatPrice(data.open, quote)} />
                <InfoRow label="Close" value={formatPrice(data.close, quote)} />
                <InfoRow label="Average Price" value={formatPrice(data.averagePrice, quote)} />
                <InfoRow label="Trading" value={data.trading ? 'Yes' : 'No'} />
                <InfoRow label="Margin Trade" value={data.marginTrade ? 'Yes' : 'No'} />
                <InfoRow label="Board" value={data.board === 1 ? 'KuCoin Plus' : 'Primary'} />
                <InfoRow label="Mark" value={data.mark === 1 ? 'ST' : data.mark === 2 ? 'NEW' : 'Default'} />
                 {data.markets && <InfoRow label="Markets" value={<div className="flex gap-1 flex-wrap justify-end">{data.markets.map(m => <Badge key={m} variant="outline">{m}</Badge>)}</div>} />}
            </div>

            <Separator />

            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Order Book</h4>
                <InfoRow label="Best Bid (Buy)" value={formatPrice(data.buy, quote)} />
                <InfoRow label="Bid Size" value={formatVolume(data.bidSize)} />
                <InfoRow label="Best Ask (Sell)" value={formatPrice(data.sell, quote)} />
                <InfoRow label="Ask Size" value={formatVolume(data.askSize)} />
            </div>

            <Separator />
            
            <MarketChangeBlock title="24h Market Change" data={data.marketChange24h} quoteCurrency={quote} />
            <Separator />
            <MarketChangeBlock title="4h Market Change" data={data.marketChange4h} quoteCurrency={quote} />
            <Separator />
            <MarketChangeBlock title="1h Market Change" data={data.marketChange1h} quoteCurrency={quote} />

            <Separator />
            
            <div className="space-y-2">
                <h4 className="font-semibold text-primary">Fees</h4>
                <InfoRow label="Taker Fee" value={data.takerFeeRate !== null && data.takerFeeRate !== undefined ? `${(data.takerFeeRate * 100).toFixed(3)}%` : 'N/A'} />
                <InfoRow label="Maker Fee" value={data.makerFeeRate !== null && data.makerFeeRate !== undefined ? `${(data.makerFeeRate * 100).toFixed(3)}%` : 'N/A'} />
            </div>
        </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
