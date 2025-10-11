
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
import { ArrowUp, ArrowDown, XCircle, Timer, Wand2, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { AiTriggerSettings } from '@/types';
import { AiTriggerSettingsPopup } from './AiTriggerSettingsPopup';

const CountdownTimer = ({ nextScrapeTime }: { nextScrapeTime: number }) => {
    const [timeLeft, setTimeLeft] = useState(nextScrapeTime - Date.now());

    useEffect(() => {
        if (nextScrapeTime <= 0) {
            setTimeLeft(0);
            return;
        };

        const updateTimer = () => {
            const newTimeLeft = nextScrapeTime - Date.now();
             if (newTimeLeft <= 0) {
                setTimeLeft(0);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }
        
        updateTimer(); // Initial update
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [nextScrapeTime]);

    if (timeLeft <= 0) {
        return <span className="font-mono">...</span>;
    }

    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    const parts = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));

    return (
        <span className="font-mono">
            {parts.join(':')}
        </span>
    );
};


export default function TradeTriggersDashboard({
    aiSettings,
    setAiSettings,
    handleAiTriggerAnalysis,
    nextAiScrapeTime,
}: {
    aiSettings: AiTriggerSettings;
    setAiSettings: (settings: AiTriggerSettings) => void;
    handleAiTriggerAnalysis: (isScheduled?: boolean) => void;
    nextAiScrapeTime: number;
}) {
  const { tradeTriggers, removeTradeTrigger, automationConfig, nextScrapeTime: nextWatchlistScrapeTime } = usePaperTrading();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isWatchlistAutomationActive = automationConfig.updateMode === 'auto-refresh';
  const isAiAutomationActive = !!aiSettings.scheduleInterval;

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
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle>Active Triggers & Automations</CardTitle>
            <CardDescription>
            Conditional orders and scheduled automations.
            </CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAiTriggerAnalysis(false)}>
                <Wand2 className="mr-2 h-4 w-4" />
                Run AI Now
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
            </Button>
        </div>
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
              {isAiAutomationActive && (
                 <TableRow>
                    <TableCell className="font-medium">
                        <div className="flex items-center">
                            <Wand2 className="h-4 w-4 mr-2 text-purple-400"/>
                            AI Trigger Analysis
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline">Scheduled</Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary">Analyze</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                            <Timer className="h-4 w-4 mr-2 text-muted-foreground"/>
                            <CountdownTimer nextScrapeTime={nextAiScrapeTime} />
                        </div>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                </TableRow>
              )}
              {isWatchlistAutomationActive && (
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
                            <CountdownTimer nextScrapeTime={nextWatchlistScrapeTime} />
                        </div>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                </TableRow>
              )}
              
              {tradeTriggers.length > 0 && (isWatchlistAutomationActive || isAiAutomationActive) && <TableRow><TableCell colSpan={5} className="p-0"><Separator /></TableCell></TableRow>}

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

              {tradeTriggers.length === 0 && !isWatchlistAutomationActive && !isAiAutomationActive && (
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
    <AiTriggerSettingsPopup
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={aiSettings}
        onSave={setAiSettings}
    />
    </>
  );
}
