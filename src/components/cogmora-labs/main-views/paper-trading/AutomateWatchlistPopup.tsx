
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2 } from 'lucide-react';
import type { AutomationRule, AutomationConfig } from '@/types';
import { Separator } from '@/components/ui/separator';

interface AutomateWatchlistPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const AutomateWatchlistPopup: React.FC<AutomateWatchlistPopupProps> = ({ isOpen, onOpenChange }) => {
  const { automationConfig, setAutomationConfig: saveAutomationConfig } = usePaperTrading();
  
  const [rules, setRules] = useState<AutomationRule[]>(automationConfig.rules);
  const [updateMode, setUpdateMode] = useState<'one-time' | 'auto-refresh'>(automationConfig.updateMode);
  const [refreshInterval, setRefreshInterval] = useState<number>(automationConfig.refreshInterval);
  const [clearExisting, setClearExisting] = useState<boolean>(automationConfig.clearExisting);

  useEffect(() => {
    if (isOpen) {
        setRules(automationConfig.rules);
        setUpdateMode(automationConfig.updateMode);
        setRefreshInterval(automationConfig.refreshInterval);
        setClearExisting(automationConfig.clearExisting);
    }
  }, [isOpen, automationConfig]);

  const totalSymbolCount = useMemo(() => {
    return rules.reduce((acc, rule) => acc + (rule.count || 0), 0);
  }, [rules]);

  const addRule = () => {
    setRules([...rules, { id: crypto.randomUUID(), source: 'spot', criteria: 'top_volume', count: 10 }]);
  };

  const updateRule = (id: string, newRule: Partial<AutomationRule>) => {
    setRules(rules.map(rule => (rule.id === id ? { ...rule, ...newRule } : rule)));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };
  
  const handleSave = () => {
    const config: AutomationConfig = { rules, updateMode, refreshInterval, clearExisting };
    saveAutomationConfig(config);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Automate Watchlist Generator</DialogTitle>
          <DialogDescription>
            Configure rules to automatically populate your watchlist from KuCoin screeners.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold">Selection Criteria</Label>
                  <div className="text-sm font-medium">
                    Total Symbols: 
                    <span className={totalSymbolCount > 25 ? 'text-destructive' : 'text-primary'}>
                       {totalSymbolCount} / 25
                    </span>
                  </div>
                </div>
                {rules.map((rule) => (
                    <div key={rule.id} className="p-3 border rounded-md space-y-3 bg-muted/50 relative">
                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeRule(rule.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Source</Label>
                                <Select value={rule.source} onValueChange={(value) => updateRule(rule.id, { source: value as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="spot">KuCoin Spot</SelectItem><SelectItem value="futures">KuCoin Futures</SelectItem></SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Criteria</Label>
                                <Select value={rule.criteria} onValueChange={(value) => updateRule(rule.id, { criteria: value as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="top_volume">Top Volume</SelectItem>
                                        <SelectItem value="bottom_volume">Bottom Volume</SelectItem>
                                        <SelectItem value="top_change">Top 24h Change</SelectItem>
                                        <SelectItem value="bottom_change">Bottom 24h Change</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Count</Label>
                                <Input type="number" value={rule.count} onChange={(e) => updateRule(rule.id, { count: parseInt(e.target.value, 10) || 0 })} />
                            </div>
                        </div>
                    </div>
                ))}
                 <Button variant="outline" size="sm" onClick={addRule}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                </Button>
            </div>

            <Separator />
            
            <div className="space-y-4">
                 <Label className="font-semibold">Update Mode</Label>
                 <RadioGroup value={updateMode} onValueChange={(v) => setUpdateMode(v as any)}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="one-time" id="one-time" />
                        <Label htmlFor="one-time">One-time Scrape</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="auto-refresh" id="auto-refresh" />
                        <Label htmlFor="auto-refresh">Auto-refresh every</Label>
                        <Select value={refreshInterval.toString()} onValueChange={(v) => setRefreshInterval(parseInt(v, 10))} disabled={updateMode !== 'auto-refresh'}>
                             <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="900000">15 min</SelectItem>
                                <SelectItem value="1800000">30 min</SelectItem>
                                <SelectItem value="3600000">1 hour</SelectItem>
                                <SelectItem value="14400000">4 hours</SelectItem>
                             </SelectContent>
                        </Select>
                    </div>
                 </RadioGroup>
            </div>
            
            <Separator />

            <div className="flex items-center justify-between">
                <Label htmlFor="clear-existing" className="font-semibold">Clear existing watchlist before scrape</Label>
                <Switch id="clear-existing" checked={clearExisting} onCheckedChange={setClearExisting} />
            </div>

        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
