
"use client";

import React, { useEffect, useState } from 'react';
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
import { ArrowUp, ArrowDown, XCircle, Timer, Wand2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { proposeTradeTriggers } from '@/ai/flows/propose-trade-triggers-flow';
import type { ProposeTradeTriggersOutput } from '@/types';

const CountdownTimer = ({ nextScrapeTime }: { nextScrapeTime: number }) => {
    const [timeLeft, setTimeLeft] = useState(nextScrapeTime - Date.now());

    useEffect(() => {
        if (nextScrapeTime <= 0) return;

        const interval = setInterval(() => {
            const newTimeLeft = nextScrapeTime - Date.now();
            if (newTimeLeft <= 0) {
                clearInterval(interval);
                setTimeLeft(0);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [nextScrapeTime]);

    if (timeLeft <= 0) {
        return <span className="font-mono">...</span>;
    }

    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <span className="font-mono">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
    );
};


export default function TradeTriggersDashboard({ setAiAgentState, setActiveMiniView }: {
    setAiAgentState: (state: ProposeTradeTriggersOutput & { isLoading: boolean }) => void;
    setActiveMiniView: (view: string) => void;
}) {
  const { tradeTriggers, removeTradeTrigger, automationConfig, nextScrapeTime, watchlist } = usePaperTrading();
  
  const isAutomationActive = automationConfig.updateMode === 'auto-refresh';

  const handleAiTriggerAnalysis = async () => {
    if (watchlist.length === 0) {
        alert("Please add items to your watchlist first.");
        return;
    }
    setActiveMiniView('ai_paper_trading');
    setAiAgentState({ analysis: '', proposedTriggers: [], isLoading: true });

    try {
        const response = await proposeTradeTriggers({ watchlist });
        setAiAgentState({ ...response, isLoading: false });
    } catch (error) {
        console.error("AI Trigger Analysis failed:", error);
        setAiAgentState({ analysis: 'An error occurred while analyzing the watchlist.', proposedTriggers: [], isLoading: false });
    }
  };

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
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle>Active Triggers</CardTitle>
            <CardDescription>
            Conditional orders and automations waiting to execute.
            </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleAiTriggerAnalysis}>
            <Wand2 className="mr-2 h-4 w-4" />
            AI Trigger Analysis
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol/Automation</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Amount/Next Run</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAutomationActive && (
                 <TableRow>
                    <TableCell className="font-medium">
                        <div className="flex items-center">
                            <Wand2 className="h-4 w-4 mr-2 text-primary"/>
                            Watchlist Automation
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline">Auto-Refresh</Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary">Scrape</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                            <Timer className="h-4 w-4 mr-2 text-muted-foreground"/>
                            <CountdownTimer nextScrapeTime={nextScrapeTime} />
                        </div>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                </TableRow>
              )}
              {tradeTriggers.length > 0 && isAutomationActive && <TableRow><TableCell colSpan={5} className="p-0"><Separator /></TableCell></TableRow>}

              {tradeTriggers.map((trigger) => (
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
              ))}

              {tradeTriggers.length === 0 && !isAutomationActive && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    No active triggers or automations.
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
