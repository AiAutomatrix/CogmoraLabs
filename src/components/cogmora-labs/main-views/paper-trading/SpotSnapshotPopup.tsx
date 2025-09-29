
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
  data: SpotSnapshotData | null;
}

const formatValue = (value: number | undefined | null, options: Intl.NumberFormatOptions = {}) => {
  if (value === undefined || value === null) return 'N/A';
  return new Intl.NumberFormat('en-US', options).format(value);
};

const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null) return 'N/A';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    };
    if (Math.abs(value) >= 10) {
        options.maximumFractionDigits = 2;
    } else if (Math.abs(value) >= 0.1) {
        options.maximumFractionDigits = 4;
    } else {
        options.maximumFractionDigits = 8;
    }
    return formatValue(value, options);
}

const formatVolume = (value?: number | null) => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(2);
};

const formatPercent = (value?: number | null) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
  <div className={`flex justify-between items-center text-sm ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

const MarketChangeBlock: React.FC<{ title: string; data?: { changePrice?: number | null; changeRate?: number | null; high?: number | null; low?: number | null; open?: number | null; volValue?: number | null; } | null }> = ({ title, data }) => (
    <div className="p-3 bg-muted/50 rounded-lg">
        <h4 className="font-semibold mb-2 text-primary">{title}</h4>
        {data ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <InfoRow label="Change" value={<span className={data.changeRate && data.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}>{formatCurrency(data.changePrice)}</span>} />
                <InfoRow label="Change %" value={<span className={data.changeRate && data.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}>{formatPercent(data.changeRate)}</span>} />
                <InfoRow label="High" value={formatCurrency(data.high)} />
                <InfoRow label="Low" value={formatCurrency(data.low)} />
                <InfoRow label="Open" value={formatCurrency(data.open)} />
                <InfoRow label="Volume" value={formatVolume(data.volValue)} />
            </div>
        ) : (
            <p className="text-muted-foreground text-sm">Data not available.</p>
        )}
    </div>
);

export const SpotSnapshotPopup: React.FC<SpotSnapshotPopupProps> = ({ isOpen, onOpenChange, symbolName, baseCurrency, quoteCurrency, data }) => {

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Snapshot: {symbolName}</DialogTitle>
          <DialogDescription>
            Detailed market data for {baseCurrency}/{quoteCurrency}.
          </DialogDescription>
        </DialogHeader>

        {data ? (
            <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                <div className="p-3 bg-card border rounded-lg grid grid-cols-2 gap-x-4 gap-y-2">
                    <InfoRow label="Last Price" value={formatCurrency(data.lastTradedPrice)} />
                    <InfoRow label="Avg. Price" value={formatCurrency(data.averagePrice)} />
                    <InfoRow label="Buy" value={formatCurrency(data.buy)} />
                    <InfoRow label="Sell" value={formatCurrency(data.sell)} />
                    <InfoRow label="24h Volume" value={formatVolume(data.volValue)} />
                    <InfoRow label="Trading" value={data.trading ? 'Yes' : 'No'} />
                </div>
                <Separator />
                <div className="space-y-3">
                    <MarketChangeBlock title="24-Hour Change" data={data.marketChange24h} />
                    <MarketChangeBlock title="4-Hour Change" data={data.marketChange4h} />
                    <MarketChangeBlock title="1-Hour Change" data={data.marketChange1h} />
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Waiting for snapshot data...</p>
            </div>
        )}
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
