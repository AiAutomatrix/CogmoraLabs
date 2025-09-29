

"use client";

import React, { useState, useCallback } from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import type { WatchlistItem } from '@/types';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EyeOff, Bell, ArrowUp, ArrowDown, BarChartHorizontal, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { WatchlistTradeTriggerPopup } from './WatchlistTradeTriggerPopup';
import { SpotSnapshotPopup } from './SpotSnapshotPopup';
import type { SpotSnapshotData } from '@/types';


export default function Watchlist() {
  const {
    watchlist,
    priceAlerts,
    toggleWatchlist,
    addPriceAlert,
    removePriceAlert,
  } = usePaperTrading();

  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  
  const [isTradePopupOpen, setIsTradePopupOpen] = useState(false);
  const [selectedWatchlistItem, setSelectedWatchlistItem] = useState<WatchlistItem | null>(null);

  const [isSnapshotPopupOpen, setIsSnapshotPopupOpen] = useState(false);
  const [selectedSnapshotData, setSelectedSnapshotData] = useState<{item: WatchlistItem, data: SpotSnapshotData} | null>(null);

  const [openAlertPopover, setOpenAlertPopover] = useState<string | null>(null);

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
  
  const handleSetAlert = (symbol: string) => {
    const price = parseFloat(alertPrice);
    if (!isNaN(price) && price > 0) {
      addPriceAlert(symbol, price, alertCondition);
      setAlertPrice('');
      setOpenAlertPopover(null); // Close the popover on save
    }
  };

  const handleTradeClick = (item: WatchlistItem) => {
    setSelectedWatchlistItem(item);
    setIsTradePopupOpen(true);
  };

  const handleSnapshotClick = useCallback((item: WatchlistItem) => {
    if (item.snapshotData) {
      const [base, quote] = item.symbolName.split('-');
      setSelectedSnapshotData({ 
          item: { ...item, baseCurrency: base, quoteCurrency: quote },
          data: item.snapshotData 
      });
      setIsSnapshotPopupOpen(true);
    }
  }, []);

  const handleCloseSnapshot = useCallback(() => {
    setIsSnapshotPopupOpen(false);
    setSelectedSnapshotData(null);
  }, []);

  const formatChange = (changeRate: number | undefined) => {
    if (changeRate === undefined) return "N/A";
    return `${changeRate >= 0 ? "+" : ""}${(changeRate * 100).toFixed(2)}%`;
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>My Watchlist</CardTitle>
        <CardDescription>
          Track symbols, set price alerts, and create trade triggers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right hidden sm:table-cell">24h Change</TableHead>
                <TableHead className="text-right hidden sm:table-cell">24h High</TableHead>
                <TableHead className="text-right hidden sm:table-cell">24h Low</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.length > 0 ? (
                watchlist.map((item) => {
                  const alert = priceAlerts[item.symbol];
                  
                  return (
                    <TableRow key={item.symbol}>
                      <TableCell className="font-medium">{item.symbolName}</TableCell>
                      <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
                      <TableCell className="text-right">{formatPrice(item.currentPrice)}</TableCell>
                      <TableCell
                        className={`text-right font-mono hidden sm:table-cell ${
                          item.priceChgPct === undefined ? '' : (item.priceChgPct >= 0 ? "text-green-500" : "text-red-500")
                        }`}
                      >
                        {formatChange(item.priceChgPct)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-green-500">{formatPrice(item.high)}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-red-500">{formatPrice(item.low)}</TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                           {item.type === 'spot' && (
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSnapshotClick(item)} disabled={!item.snapshotData}>
                                <FileText className="h-4 w-4" />
                            </Button>
                           )}
                           <Popover open={openAlertPopover === item.symbol} onOpenChange={(open) => {
                              if (open) {
                                if (item.currentPrice > 0) setAlertPrice(item.currentPrice.toFixed(4));
                                setOpenAlertPopover(item.symbol);
                              } else {
                                setOpenAlertPopover(null);
                                setAlertPrice('');
                              }
                            }}>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className={`h-8 w-8 ${alert ? 'text-primary' : ''}`}><Bell className="h-4 w-4"/></Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-60">
                                <div className="grid gap-4">
                                  <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Set Alert for {item.symbolName}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Notify when price is...
                                    </p>
                                  </div>
                                  <div className="grid gap-2">
                                    <div className="grid grid-cols-2 items-center gap-4">
                                      <RadioGroup defaultValue="above" onValueChange={(val: 'above' | 'below') => setAlertCondition(val)}>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="above" id={`above-${item.symbol}`} />
                                            <Label htmlFor={`above-${item.symbol}`}>Above</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="below" id={`below-${item.symbol}`} />
                                            <Label htmlFor={`below-${item.symbol}`}>Below</Label>
                                          </div>
                                      </RadioGroup>
                                      <Input
                                        id="price" type="number" placeholder="Price" value={alertPrice}
                                        onChange={(e) => setAlertPrice(e.target.value)} className="h-9"
                                      />
                                    </div>
                                    <Button size="sm" onClick={() => handleSetAlert(item.symbol)}>Save Alert</Button>
                                    {alert && (
                                       <Button size="sm" variant="destructive" onClick={() => removePriceAlert(item.symbol)}>Remove Alert</Button>
                                    )}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>

                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTradeClick(item)}>
                            <BarChartHorizontal className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleWatchlist(item.symbol, item.symbolName, item.type)}>
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </div>
                        {alert && (
                          <div className="flex justify-end mt-1">
                            <Badge variant={alert.triggered ? "default" : "outline"} className={`border-primary ${alert.triggered ? 'animate-pulse' : ''}`}>
                              {alert.condition === 'above' ? <ArrowUp className="h-3 w-3 mr-1"/> : <ArrowDown className="h-3 w-3 mr-1"/>}
                              {formatPrice(alert.price)}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Your watchlist is empty.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
     {selectedWatchlistItem && (
        <WatchlistTradeTriggerPopup
          isOpen={isTradePopupOpen}
          onOpenChange={setIsTradePopupOpen}
          item={selectedWatchlistItem}
        />
      )}
      {selectedSnapshotData && (
        <SpotSnapshotPopup
          isOpen={isSnapshotPopupOpen}
          onOpenChange={handleCloseSnapshot}
          symbolName={selectedSnapshotData.item.symbolName}
          baseCurrency={selectedSnapshotData.item.baseCurrency!}
          quoteCurrency={selectedSnapshotData.item.quoteCurrency!}
          data={selectedSnapshotData.data}
        />
      )}
    </>
  );
}
