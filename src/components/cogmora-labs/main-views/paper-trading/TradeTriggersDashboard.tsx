
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
import { ArrowUp, ArrowDown, XCircle, Timer, Wand2, Settings, Info, ShieldCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { AiTriggerSettings } from '@/types';
import { AiTriggerSettingsPopup } from './AiTriggerSettingsPopup';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const CountdownTimer = ({ nextRunTime }: { nextRunTime: number | null | undefined }) => {
    const [timeLeft, setTimeLeft] = useState(nextRunTime ? nextRunTime - Date.now() : 0);

    useEffect(() => {
        if (!nextRunTime || nextRunTime <= 0) {
            setTimeLeft(0);
            return;
        };

        const updateTimer = () => {
            const newTimeLeft = nextRunTime - Date.now();
             if (newTimeLeft <= 0) {
                setTimeLeft(0);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }
        
        updateTimer(); // Initial update
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [nextRunTime]);

    if (!nextRunTime || timeLeft <= 0) {
        return <span className="font-mono text-xs md:text-sm">...</span>;
    }

    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    const parts = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(seconds.toString().padStart(2, '0'));

    return (
        <span className="font-mono text-xs md:text-sm">
            {parts.join(':')}
        </span>
    );
};

const AiCooldownTimer = ({ lastRunTimestamp }: { lastRunTimestamp: number | null }) => {
    const AI_COOLDOWN_MS = 300000; // 5 minutes
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!lastRunTimestamp) {
            setTimeLeft(0);
            return;
        }

        const calculateTimeLeft = () => {
            const now = Date.now();
            const timeSinceLastRun = now - lastRunTimestamp;
            const newTimeLeft = AI_COOLDOWN_MS - timeSinceLastRun;
            setTimeLeft(newTimeLeft > 0 ? newTimeLeft : 0);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [lastRunTimestamp]);
    
    if (timeLeft <= 0) {
        return null; // Don't render the timer if cooldown is over
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return (
        <span className="text-xs font-mono text-muted-foreground ml-2">
            ({minutes}:{seconds.toString().padStart(2, '0')})
        </span>
    );
}


export default function TradeTriggersDashboard({
    aiSettings,
    setAiSettings,
    handleAiTriggerAnalysis,
}: {
    aiSettings: AiTriggerSettings;
    setAiSettings: (settings: AiTriggerSettings) => void;
    handleAiTriggerAnalysis: () => void;
}) {
  const { tradeTriggers, removeTradeTrigger, automationConfig, lastManualAiRunTimestamp } = usePaperTrading();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isWatchlistAutomationActive = automationConfig.updateMode === 'auto-refresh';
  const isAiAutomationActive = !!aiSettings.scheduleInterval;
  
  const AI_COOLDOWN_MS = 300000;
  const isAiOnCooldown = lastManualAiRunTimestamp ? (Date.now() - lastManualAiRunTimestamp) < AI_COOLDOWN_MS : false;

  const formatPrice = (price?: number) => {
    if (price === undefined || isNaN(price)) return "N/A";
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
        <div className="flex-grow">
            <div className="flex items-center gap-2">
                <CardTitle className="text-lg md:text-xl">AI Automation Engine</CardTitle>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                       <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">AI Control Panel</h4>
                                <p className="text-sm text-muted-foreground">
                                    This is the command center for your AI trading agent. The agent analyzes your account metrics, open positions, and active triggers to generate a strategic plan.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Use the <Settings className="inline-block h-3 w-3" /> settings to configure its behavior, such as allowing it to manage open positions or auto-executing its plans.
                                </p>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <CardDescription className="text-xs md:text-sm">
                Manage conditional orders and configure your AI trading agent.
            </CardDescription>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <div className="flex items-center">
              <Button variant="outline" size="sm" onClick={handleAiTriggerAnalysis} disabled={isAiOnCooldown}>
                  <Wand2 className="mr-0 md:mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Run AI Now</span>
              </Button>
               {isAiOnCooldown && <AiCooldownTimer lastRunTimestamp={lastManualAiRunTimestamp} />}
            </div>
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
                <TableHead className="px-2">Symbol/Task</TableHead>
                <TableHead className="px-2">Condition</TableHead>
                <TableHead className="hidden md:table-cell px-2">Action</TableHead>
                <TableHead className="text-right px-2">Amount/Next Run</TableHead>
                <TableHead className="text-center px-2">Cancel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAiAutomationActive && (
                 <TableRow>
                    <TableCell className="font-medium px-2 py-3">
                        <div className="flex items-center">
                            <Wand2 className="h-4 w-4 mr-2 text-purple-400"/>
                            AI Trigger Analysis
                        </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                        <Badge variant="outline">Scheduled</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 py-3">
                        <Badge variant="secondary">Analyze</Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 py-3">
                        <div className="flex items-center justify-end">
                            <Timer className="h-4 w-4 mr-1 md:mr-2 text-muted-foreground"/>
                            <CountdownTimer nextRunTime={aiSettings.nextRun} />
                        </div>
                    </TableCell>
                    <TableCell className="text-center px-2 py-3">-</TableCell>
                </TableRow>
              )}
              {isWatchlistAutomationActive && (
                 <TableRow>
                    <TableCell className="font-medium px-2 py-3">
                        <div className="flex items-center">
                            <Wand2 className="h-4 w-4 mr-2 text-primary"/>
                            Watchlist Scraper
                        </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                        <Badge variant="outline">Auto-Refresh</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 py-3">
                        <Badge variant="secondary">Scrape</Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 py-3">
                        <div className="flex items-center justify-end">
                            <Timer className="h-4 w-4 mr-1 md:mr-2 text-muted-foreground"/>
                            <CountdownTimer nextRunTime={automationConfig.lastRun ? automationConfig.lastRun + automationConfig.refreshInterval : undefined} />
                        </div>
                    </TableCell>
                    <TableCell className="text-center px-2 py-3">-</TableCell>
                </TableRow>
              )}
              
              {tradeTriggers.length > 0 && (isWatchlistAutomationActive || isAiAutomationActive) && <TableRow><TableCell colSpan={5} className="p-0"><Separator /></TableCell></TableRow>}

              {tradeTriggers.map((trigger) => (
                  <TableRow key={trigger.id}>
                    <TableCell className="font-medium px-2 py-3">
                      <div className="flex items-center gap-2">
                        {trigger.symbolName}
                        {(trigger.stopLoss || trigger.takeProfit) && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6"><ShieldCheck className="h-4 w-4 text-primary" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 text-sm">
                              <div className="grid gap-2">
                                <h4 className="font-medium leading-none">Risk Management</h4>
                                {trigger.stopLoss && <p>Stop Loss: <span className="font-mono text-destructive">{formatPrice(trigger.stopLoss)}</span></p>}
                                {trigger.takeProfit && <p>Take Profit: <span className="font-mono text-green-500">{formatPrice(trigger.takeProfit)}</span></p>}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex items-center w-full">
                          <div className="flex items-center flex-shrink-0">
                            {trigger.condition === 'above' ? 
                              <ArrowUp className="h-4 w-4 text-green-500 mr-1"/> : 
                              <ArrowDown className="h-4 w-4 text-red-500 mr-1"/>}
                            <span className="hidden md:inline">{trigger.condition === 'above' ? 'Above' : 'Below'}:</span>
                          </div>
                           <div className="flex-grow text-right">
                             <span className="font-mono">{formatPrice(trigger.targetPrice)}</span>
                          </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-2 py-3">
                      <Badge variant={trigger.action === 'short' ? 'destructive' : 'default'} className="capitalize">
                        {trigger.action} {trigger.type === 'futures' ? `${trigger.leverage}x` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2 py-3">{formatPrice(trigger.amount)}</TableCell>
                    <TableCell className="text-center px-2 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTradeTrigger(trigger.id)}
                        className="text-destructive h-8 w-8"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
              ))}

              {tradeTriggers.length === 0 && !isWatchlistAutomationActive && !isAiAutomationActive && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
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

