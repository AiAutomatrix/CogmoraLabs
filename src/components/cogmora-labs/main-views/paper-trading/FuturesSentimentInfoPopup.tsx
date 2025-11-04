
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { KucoinFuturesContract } from '@/hooks/useKucoinFuturesTickers';

interface FuturesSentimentInfoPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  contract: KucoinFuturesContract | null;
}

const InfoRow: React.FC<{ label: string, value: React.ReactNode, valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono text-right ${valueClass}`}>{value}</span>
    </div>
);

export const FuturesSentimentInfoPopup: React.FC<FuturesSentimentInfoPopupProps> = ({ isOpen, onOpenChange, contract }) => {

  if (!contract) return null;

  const getSentiment = () => {
    const fundingRate = contract.fundingFeeRate;
    if (fundingRate > 0.0002) return { text: "Longs Paying Shorts (Strong Bullish Sentiment)", color: "text-green-500", badge: "default" };
    if (fundingRate > 0) return { text: "Longs Paying Shorts (Mild Bullish Sentiment)", color: "text-green-400", badge: "default" };
    if (fundingRate < -0.0002) return { text: "Shorts Paying Longs (Strong Bearish Sentiment)", color: "text-red-500", badge: "destructive" };
    if (fundingRate < 0) return { text: "Shorts Paying Longs (Mild Bearish Sentiment)", color: "text-red-400", badge: "destructive" };
    return { text: "Neutral Funding", color: "text-muted-foreground", badge: "secondary" };
  };

  const sentiment = getSentiment();
  
  const formatFundingRate = (rate: number) => {
    return `${(rate * 100).toFixed(4)}%`;
  }
  
  const formatVolume = (value: string | number) => {
    const num = Number(value);
    if (isNaN(num)) return "N/A";
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toString()}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Funding Rate Sentiment</DialogTitle>
          <DialogDescription>
            {contract.symbol.replace(/M$/, '')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className={`text-lg font-semibold ${sentiment.color}`}>{sentiment.text}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold">Key Indicators</h4>
            <InfoRow label="Current Funding Rate" value={formatFundingRate(contract.fundingFeeRate)} valueClass={sentiment.color} />
            <InfoRow label="Predicted Funding Rate" value={formatFundingRate(contract.predictedFundingFeeRate)} />
            <InfoRow label="Open Interest" value={formatVolume(contract.openInterest)} />
            <InfoRow label="24h Volume" value={formatVolume(contract.volumeOf24h)} />
          </div>

          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-semibold">What this means</h4>
            <p className="text-xs text-muted-foreground">
                The funding rate is a periodic payment made between traders to keep the futures contract price close to the spot price.
                A <span className="text-green-400">positive</span> rate means traders who are long are paying traders who are short, suggesting bullish sentiment.
                A <span className="text-red-400">negative</span> rate means shorts pay longs, suggesting bearish sentiment. High open interest can indicate strong conviction in the current trend.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

    