
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useKucoinAllTickersSocket } from "@/hooks/useKucoinAllTickersSocket";
import type { DisplayTickerData, WebSocketStatus } from "@/types/websocket";
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
import { AlertTriangle, CheckCircle, Loader2, WifiOff, ServerCrash, Search } from 'lucide-react';
import { format } from 'date-fns';

export function AllTickersScreener() {
  const { processedTickers, websocketStatus } = useKucoinAllTickersSocket();
  const [filterTerm, setFilterTerm] = useState('');

  // Log when processedTickers update to see if data is flowing to UI
  // useEffect(() => {
  //    if (processedTickers.length > 0) {
  //     console.log("AllTickersScreener: Received new processedTickers, count:", processedTickers.length, processedTickers.slice(0,2));
  //   }
  // }, [processedTickers]);

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
    if (price === 0) return '0.00';
    if (Math.abs(price) < 0.000001) return price.toExponential(2);
    if (Math.abs(price) < 0.01) return price.toFixed(6);
    if (Math.abs(price) < 1) return price.toFixed(4);
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatChangeRate = (rate: number | null) => {
    if (rate === null) return '-';
    return `${(rate * 100).toFixed(2)}%`;
  };
  
  const formatVolume = (volume: number | null) => {
    if (volume === null) return '-';
    return volume.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const formatSize = (size: number | null) => {
    if (size === null) return '-';
    if (size === 0) return '0.00';
    if (Math.abs(size) < 0.001 && size !== 0) return size.toPrecision(3);
    return size.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  };


  const renderStatusIndicator = () => {
    switch (websocketStatus) {
      case 'idle':
        return <span className="text-xs text-muted-foreground flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Initializing...</span>;
      case 'fetching_token':
        return <span className="text-xs text-yellow-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Fetching token...</span>;
      case 'connecting_ws':
        return <span className="text-xs text-orange-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Connecting WS...</span>;
      case 'welcomed':
        return <span className="text-xs text-blue-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Connected! Waiting for subscription...</span>;
      case 'subscribing':
        return <span className="text-xs text-purple-500 flex items-center"><Loader2 className="animate-spin h-3 w-3 mr-1" /> Subscribing...</span>;
      case 'subscribed':
        return <span className="text-xs text-green-600 font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Live Data Streaming</span>;
      case 'disconnected':
        return <span className="text-xs text-red-500 flex items-center"><WifiOff className="h-3 w-3 mr-1" /> Disconnected. Reconnecting...</span>;
      case 'error':
        return <span className="text-xs text-red-700 font-semibold flex items-center"><ServerCrash className="h-3 w-3 mr-1" /> Connection Error</span>;
      default:
        return <span className="text-xs text-muted-foreground">{websocketStatus}</span>;
    }
  };

  const isLoadingOrConnecting = !['subscribed', 'error', 'disconnected'].includes(websocketStatus) || (websocketStatus === 'subscribed' && processedTickers.length === 0);


  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            <Search className="mr-2 h-5 w-5 text-primary" /> KuCoin All Tickers (Live)
          </CardTitle>
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
            <p className="py-2 text-xs text-muted-foreground text-center">
              {websocketStatus === 'fetching_token' && 'Requesting connection token...'}
              {websocketStatus === 'connecting_ws' && 'Establishing WebSocket connection...'}
              {websocketStatus === 'welcomed' && 'Connection established, preparing to subscribe...'}
              {websocketStatus === 'subscribing' && 'Subscribing to live ticker feed...'}
              {websocketStatus === 'subscribed' && processedTickers.length === 0 && 'Subscription active, waiting for initial data...'}
              {websocketStatus === 'idle' && 'Initializing connection...'}
            </p>
          </div>
        ) : websocketStatus === 'error' ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive p-4">
                <ServerCrash className="h-12 w-12 mb-2"/>
                <p className="font-semibold">WebSocket Connection Error</p>
                <p className="text-sm text-center text-muted-foreground">
                    Could not establish or maintain WebSocket connection. Check console for details. Retrying...
                </p>
            </div>
        ) : websocketStatus === 'disconnected' && filteredTickers.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-red-500 p-4">
                <WifiOff className="h-12 w-12 mb-2"/>
                <p className="font-semibold">WebSocket Disconnected</p>
                <p className="text-sm text-center text-muted-foreground">
                    Attempting to reconnect. Check console for details...
                </p>
            </div>
        ): !isLoadingOrConnecting && filteredTickers.length === 0 && filterTerm ? (
          <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            <p>No tickers matching your filter: "{filterTerm}"</p>
          </div>
        ): !isLoadingOrConnecting && filteredTickers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            <p>No ticker data received yet. Status: {websocketStatus}</p>
          </div>
        ) : (
          <Table className="min-w-full text-xs">
            <TableCaption className="py-2 text-xs">
              Live ticker data from KuCoin. {filterTerm && `(Filtered by "${filterTerm}")`}
            </TableCaption>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="py-2 px-3 font-medium">Symbol</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Last Price</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Size (Last)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Change Rate (24h)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Change Price (24h)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">High (24h)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Low (24h)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Volume (24h)</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Best Bid</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Best Bid Size</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Best Ask</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Best Ask Size</TableHead>
                <TableHead className="py-2 px-3 font-medium text-right">Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickers.map((ticker) => (
                <TableRow key={ticker.symbol} className="hover:bg-muted/50">
                  <TableCell className="py-1.5 px-3 font-mono font-medium">{ticker.symbol}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.lastPrice)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatSize(ticker.size)}</TableCell>
                  <TableCell className={`py-1.5 px-3 font-mono text-right ${ticker.changeRate24h === null ? '' : ticker.changeRate24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatChangeRate(ticker.changeRate24h)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.changePrice24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.high24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatPrice(ticker.low24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatVolume(ticker.volume24h)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-green-500">{formatPrice(ticker.bestBid)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatSize(ticker.bestBidSize)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-red-500">{formatPrice(ticker.bestAsk)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right">{formatSize(ticker.bestAskSize)}</TableCell>
                  <TableCell className="py-1.5 px-3 font-mono text-right text-muted-foreground">
                    {ticker.lastUpdate ? format(ticker.lastUpdate, 'HH:mm:ss.SSS') : '-'}
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
