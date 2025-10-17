

"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { EyeOff, Bell, ArrowUp, ArrowDown, BarChartHorizontal, FileText, Wand2, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { WatchlistTradeTriggerPopup } from './WatchlistTradeTriggerPopup';
import { SpotSnapshotPopup } from './SpotSnapshotPopup';
import type { SpotSnapshotData } from '@/types';
import { AutomateWatchlistPopup } from './AutomateWatchlistPopup';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";


const CountdownTimer = ({ nextScrapeTime }: { nextScrapeTime: number }) => {
    const [timeLeft, setTimeLeft] = useState(nextScrapeTime - Date.now());

    useEffect(() => {
        if (nextScrapeTime <= 0) {
            setTimeLeft(0);
            return;
        }

        const interval = setInterval(() => {
            const newTimeLeft = nextScrapeTime - Date.now();
            if (newTimeLeft <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [nextScrapeTime]);


    if (timeLeft <= 0) {
        return null;
    }

    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <span className="text-xs font-mono text-muted-foreground mr-2">
            ({minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')})
        </span>
    );
};

interface WatchlistProps {
  onSymbolSelect: (symbol: string) => void;
  selectedChartLayout: number;
  setSelectedChartLayout: (num: number) => void;
  selectedSymbolsForHighlight: string[];
}


export default function Watchlist({
  onSymbolSelect,
  selectedChartLayout,
  setSelectedChartLayout,
  selectedSymbolsForHighlight
}: WatchlistProps) {
  const {
    watchlist,
    priceAlerts,
    toggleWatchlist,
    addPriceAlert,
    removePriceAlert,
    automationConfig,
    nextScrapeTime,
  } = usePaperTrading();

  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  
  const [isTradePopupOpen, setIsTradePopupOpen] = useState(false);
  const [selectedWatchlistItem, setSelectedWatchlistItem] = useState<WatchlistItem | null>(null);

  const [isSnapshotPopupOpen, setIsSnapshotPopupOpen] = useState(false);
  const [selectedSnapshotData, setSelectedSnapshotData] = useState<{item: WatchlistItem, data: SpotSnapshotData} | null>(null);

  const [openAlertPopover, setOpenAlertPopover] = useState<string | null>(null);
  const [isAutomatePopupOpen, setIsAutomatePopupOpen] = useState(false);
  
  const isAutoRefreshEnabled = automationConfig.updateMode === 'auto-refresh';
  const chartOptions = [1, 2, 3, 4];

  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [watchlist]);

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
    const isPositive = changeRate >= 0;
    const colorClass = isPositive ? "text-green-500" : "text-red-500";
    return <span className={colorClass}>{`${isPositive ? "+" : ""}${(changeRate * 100).toFixed(2)}%`}</span>;
  };
  
  const getHighlightSymbol = (item: WatchlistItem) => {
    let symbolForHighlight = '';
    if (item.type === 'spot') {
      symbolForHighlight = `KUCOIN:${item.symbol.replace('-', '')}`;
    } else if (item.type === 'futures') {
      symbolForHighlight = item.symbol.endsWith('M') ? item.symbol.slice(0, -1) : item.symbol;
    }
    return symbolForHighlight;
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Watchlist</CardTitle>
            <CardDescription>
              Track symbols, set alerts, and load charts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isAutoRefreshEnabled && <CountdownTimer nextScrapeTime={nextScrapeTime} />}
            <Button variant="outline" size="sm" onClick={() => setIsAutomatePopupOpen(true)}>
                <Wand2 className="mr-2 h-4 w-4" />
                Automate
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Settings className="mr-2 h-4 w-4" />{selectedChartLayout}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {chartOptions.map(num => (
                  <DropdownMenuItem key={num} onSelect={() => setSelectedChartLayout(num)}>
                    Load {num} chart{num > 1 ? 's' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                <TableHead className="text-right px-2 py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWatchlist.length > 0 ? (
                sortedWatchlist.map((item) => {
                  const alert = priceAlerts[item.symbol];
                  const symbolForHighlight = getHighlightSymbol(item);
                  const isSelected = selectedSymbolsForHighlight.includes(symbolForHighlight);
                  
                  return (
                    <TableRow 
                      key={item.symbol}
                      onClick={() => onSymbolSelect(item.symbol)}
                      className={cn("cursor-pointer", isSelected && "bg-primary/20 hover:bg-primary/30")}
                    >
                      <TableCell className="font-medium px-2 py-2">{item.symbolName}</TableCell>
                      <TableCell className="px-2 py-2 hidden sm:table-cell"><Badge variant="secondary">{item.type}</Badge></TableCell>
                      <TableCell className="text-right px-2 py-2">{formatPrice(item.currentPrice)}</TableCell>
                      <TableCell
                        className={`text-right font-mono px-2 py-2`}
                      >
                        {formatChange(item.priceChgPct)}
                      </TableCell>
                      
                      <TableCell className="text-right px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0">
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
                  <TableCell colSpan={5} className="text-center h-24">
                    Your watchlist is empty.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <AutomateWatchlistPopup isOpen={isAutomatePopupOpen} onOpenChange={setIsAutomatePopupOpen} />
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

    

