
'use client';

import React, { useState, useMemo } from 'react';
import { useKucoinAllTickersSocket } from "@/hooks/useKucoinAllTickersSocket";
import type { DisplayTickerData } from "@/types/websocket"; // Ensure this is correct
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Loader2, WifiOff, ServerCrash } from 'lucide-react';
import { format } from 'date-fns';

export function AllTickersScreener() {
  const { processedTickers, websocketStatus } = useKucoinAllTickersSocket();
  const [filterTerm, setFilterTerm] = useState('');

  const filteredTickers = useMemo(() => {
    if (!filterTerm.trim()) {
      return processedTickers;
    }
    const lowerFilterTerm = filterTerm.toLowerCase();
    return processedTickers.filter(ticker =>
      ticker.symbol.toLowerCase().includes(lowerFilterTerm)
    );
  }, [processedTickers, filterTerm]);

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    if (price > 10) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price > 0.001) return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  };

  const formatPercentage = (rate: number | null) => {
    if (rate === null) return '-';
    return `${(rate * 100).toFixed(2)}%`;
  };

  const formatVolume = (volume: number | null) => {
    if (volume === null) return '-';
    return volume.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  const renderStatusIndicator = () => {
    switch (websocketStatus) {
      case 'idle':
        return <span className="text-xs text-muted-foreground">Idle</span>;
      case 'fetching_token':
        return <span className="text-xs text-yellow-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Fetching token...</span>;
      case 'connecting_ws':
        return <span className="text-xs text-orange-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Connecting WS...</span>;
      case 'welcomed':
        return <span className="text-xs text-blue-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Connection active! Subscribing...</span>;
      case 'subscribing':
        return <span className="text-xs text-purple-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Subscribing to tickers...</span>;
      case 'subscribed':
        return <span className="text-xs text-green-600 font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Subscribed & Live</span>;
      case 'disconnected':
        return <span className="text-xs text-red-500 flex items-center"><WifiOff className="h-3 w-3 mr-1" /> Disconnected</span>;
      case 'error':
        return <span className="text-xs text-red-700 font-semibold flex items-center"><ServerCrash className="h-3 w-3 mr-1" /> Connection Error</span>; // Changed icon
      default:
        return <span className="text-xs text-muted-foreground">{websocketStatus}</span>;
    }
  };

  const isLoadingOrConnecting = !['subscribed', 'error', 'disconnected'].includes(websocketStatus);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">All KuCoin Tickers (Live)</CardTitle>
          {renderStatusIndicator()}
        </div>
        <Input
          type="text"
          placeholder="Filter by symbol (e.g., BTC-USDT)..."
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          className="mt-2 h-9"
          disabled={isLoadingOrConnecting && filteredTickers.length === 0}
        />
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-0">
        {isLoadingOrConnecting && filteredTickers.length === 0 ? (
          <div className="space-y-1 p-2">
            {[...Array(15)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
            <TableCaption className="py-2 text-xs">Attempting to connect to KuCoin WebSocket...</TableCaption>
          </div>
        ) : websocketStatus === 'error' || websocketStatus === 'disconnected' ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive p-4">
                {websocketStatus === 'error' && <ServerCrash className="h-12 w-12 mb-2"/>}
                {websocketStatus === 'disconnected' && <WifiOff className="h-12 w-12 mb-2"/>}
                <p className="font-semibold">
                    {websocketStatus === 'error' ? 'WebSocket Connection Error' : 'WebSocket Disconnected'}
                </p>
                <p className="text-sm text-center text-muted-foreground">
                    {websocketStatus === 'disconnected' && "Attempting to reconnect. Check console for details..."}
                    {websocketStatus === 'error' && "Could not establish WebSocket connection. Check console for details."}
                </p>
            </div>
        ) : !isLoadingOrConnecting && filteredTickers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            <p>{filterTerm ? 'No tickers matching your filter.' : 'No ticker data received yet or all filtered out.'}</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableCaption className="py-2 text-xs">
              Live ticker data from KuCoin via WebSocket. Updates approximately every 100ms.
              {filterTerm && ` (Filtered by "${filterTerm}")`}
            </TableCaption>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="py-2 px-3 text-xs font-medium">Symbol</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Last Price</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Change Rate (24h)</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Change Price (24h)</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">High (24h)</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Low (24h)</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Volume (24h)</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Best Bid</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Best Ask</TableHead>
                <TableHead className="py-2 px-3 text-xs font-medium text-right">Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickers.map((ticker) => (
                <TableRow key={ticker.symbol} className="text-xs hover:bg-muted/50">
                  <TableCell className="py-1.5 px-3 font-mono font-medium">{ticker.symbol}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.lastPrice)}</TableCell>
                  <TableCell className={`py-1.5 px-3 font-mono text-right ${ticker.changeRate24h === null ? '' : ticker.changeRate24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPercentage(ticker.changeRate24h)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.changePrice24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.high24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.low24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatVolume(ticker.volume24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-green-500">{formatPrice(ticker.buyPrice)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-red-500">{formatPrice(ticker.sellPrice)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-muted-foreground">
                    {format(ticker.lastUpdate, 'HH:mm:ss.SSS')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default AllTickersScreener;
