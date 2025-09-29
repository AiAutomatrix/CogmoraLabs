
"use client";

import React, { useState } from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
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
import { EyeOff, Bell, BellOff, ArrowUp, ArrowDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';


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

  const formatPrice = (price: number) => {
    if (!price || isNaN(price)) return "$0.00";
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
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Watchlist</CardTitle>
        <CardDescription>
          Track symbols and set price alerts. Symbols are added via the eye icon in the screeners.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-center">Price Alert</TableHead>
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
                    <TableCell className="text-center">
                      {alert ? (
                        <div className="flex items-center justify-center gap-2">
                          <Badge variant={alert.triggered ? "default" : "outline"} className="border-primary">
                            {alert.condition === 'above' ? <ArrowUp className="h-3 w-3 mr-1"/> : <ArrowDown className="h-3 w-3 mr-1"/>}
                            {formatPrice(alert.price)}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePriceAlert(item.symbol)}>
                            <BellOff className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Popover onOpenChange={() => setAlertPrice('')}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm"><Bell className="h-4 w-4 mr-1"/> Set Alert</Button>
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
                                        <RadioGroupItem value="above" id="above" />
                                        <Label htmlFor="above">Above</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="below" id="below" />
                                        <Label htmlFor="below">Below</Label>
                                      </div>
                                  </RadioGroup>
                                  <Input
                                    id="price"
                                    type="number"
                                    placeholder="Price"
                                    value={alertPrice}
                                    onChange={(e) => setAlertPrice(e.target.value)}
                                    className="h-9"
                                  />
                                </div>
                                <Button size="sm" onClick={() => handleSetAlert(item.symbol)}>Save Alert</Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleWatchlist(item.symbol, item.symbolName, item.type)}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
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
      </CardContent>
    </Card>
  );
}
