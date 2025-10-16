
'use client';

import React from 'react';
import { useLandingPageDemo } from '@/context/LandingPageDemoContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

// This component is a wrapper to pre-populate the watchlist for the demo.
const LandingPageWatchlist: React.FC = () => {
  const { watchlist } = useLandingPageDemo();

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || isNaN(price)) return "$0.00";
    const options: Intl.NumberFormatOptions = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    };
    if (price < 0.1) {
      options.maximumFractionDigits = 8;
    } else {
      options.maximumFractionDigits = 4;
    }
    return new Intl.NumberFormat("en-US", options).format(price);
  };

  const formatChange = (changeRate: number | undefined | null) => {
    if (changeRate === undefined || changeRate === null) return "N/A";
    const isPositive = changeRate >= 0;
    const colorClass = isPositive ? "text-green-500" : "text-red-500";
    return <span className={colorClass}>{`${isPositive ? "+" : ""}${(changeRate * 100).toFixed(2)}%`}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Watchlist</CardTitle>
        <CardDescription>
          Real-time prices from the KuCoin WebSocket feed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 py-2">Symbol</TableHead>
                <TableHead className="px-2 py-2 hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right px-2 py-2">Current Price</TableHead>
                <TableHead className="text-right px-2 py-2">24h Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.length > 0 ? (
                watchlist.map((item) => (
                  <TableRow key={item.symbol}>
                    <TableCell className="font-medium px-2 py-2">{item.symbolName}</TableCell>
                    <TableCell className="px-2 py-2 hidden sm:table-cell"><Badge variant="secondary">{item.type}</Badge></TableCell>
                    <TableCell className="text-right px-2 py-2">{formatPrice(item.currentPrice)}</TableCell>
                    <TableCell className="text-right font-mono px-2 py-2">
                      {formatChange(item.priceChgPct)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    Loading live data...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default LandingPageWatchlist;
