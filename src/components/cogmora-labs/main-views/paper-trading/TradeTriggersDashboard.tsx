
"use client";

import React from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, XCircle } from 'lucide-react';

export default function TradeTriggersDashboard() {
  const { tradeTriggers, removeTradeTrigger } = usePaperTrading();

  const formatPrice = (price: number) => {
    if (!price || isNaN(price)) return "$0.00";
    const options: Intl.NumberFormatOptions = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 0.1 ? 8 : 4,
    };
    return new Intl.NumberFormat("en-US", options).format(price);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Trade Triggers</CardTitle>
        <CardDescription>
          These are conditional orders waiting to be executed when the target price is met.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Amount/Collateral</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tradeTriggers.length > 0 ? (
                tradeTriggers.map((trigger) => (
                  <TableRow key={trigger.id}>
                    <TableCell className="font-medium">{trigger.symbolName}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {trigger.condition === 'above' ? 
                          <ArrowUp className="h-4 w-4 text-green-500 mr-1"/> : 
                          <ArrowDown className="h-4 w-4 text-red-500 mr-1"/>}
                        {trigger.condition === 'above' ? 'Above' : 'Below'} {formatPrice(trigger.targetPrice)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trigger.action === 'short' ? 'destructive' : 'default'} className="capitalize">
                        {trigger.action} {trigger.type === 'futures' ? `${trigger.leverage}x` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(trigger.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTradeTrigger(trigger.id)}
                        className="text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No active trade triggers.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
