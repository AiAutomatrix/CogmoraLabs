
"use client";

import React, { useState } from 'react';
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
import { useLandingPageDemo } from '@/context/LandingPageDemoContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2 } from 'lucide-react';
import type { AutomationRule, AutomationConfig } from '@/types';
import { Separator } from '@/components/ui/separator';

interface LandingPageAutomateWatchlistPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const LandingPageAutomateWatchlistPopup: React.FC<LandingPageAutomateWatchlistPopupProps> = ({ isOpen, onOpenChange }) => {
  const { automationConfig, applyWatchlistAutomation, setAutomationConfig: saveAutomationConfig } = useLandingPageDemo();
  
  const [rules, setRules] = useState<AutomationRule[]>(automationConfig.rules);
  const [updateMode, setUpdateMode] = useState<'one-time' | 'auto-refresh'>(automationConfig.updateMode);
  const [refreshInterval, setRefreshInterval] = useState<number>(automationConfig.refreshInterval);
  const [clearExisting, setClearExisting] = useState<boolean>(automationConfig.clearExisting);

  const addRule = () => {
    setRules([...rules, { id: crypto.randomUUID(), source: 'spot', criteria: 'top_volume', count: 10 }]);
  };

  const updateRule = (id: string, newRule: Partial<AutomationRule>) => {
    setRules(rules.map(rule => (rule.id === id ? { ...rule, ...newRule } : rule)));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };
  
  const handleApply = () => {
    applyWatchlistAutomation();
    onOpenChange(false);
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
          <DialogTitle>Automate Watchlist (Demo)</DialogTitle>
          <DialogDescription>
            Configure rules to automatically populate your watchlist from KuCoin screeners.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-4">
                <Label className="font-semibold">Selection Criteria</Label>
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
                                    <SelectContent><SelectItem value="spot">KuCoin Spot</SelectItem><SelectItem value="futures" disabled>KuCoin Futures (Demo)</SelectItem></SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs">Criteria</Label>
                                <Select value={rule.criteria} onValueChange={(value) => updateRule(rule.id, { criteria: value as any })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="top_volume">Top Volume</SelectItem>
                                        <SelectItem value="top_change">Top 24h Change</SelectItem>
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
                    <div className="flex items-center space-x-2"><RadioGroupItem value="one-time" id="one-time-demo" /><Label htmlFor="one-time-demo">One-time Scrape</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="auto-refresh" id="auto-refresh-demo" /><Label htmlFor="auto-refresh-demo">Auto-refresh every</Label></div>
                 </RadioGroup>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
                <Label htmlFor="clear-existing-demo" className="font-semibold">Clear existing watchlist</Label>
                <Switch id="clear-existing-demo" checked={clearExisting} onCheckedChange={setClearExisting} />
            </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="outline" onClick={handleSave}>Save</Button>
          <Button type="button" onClick={handleApply}>Scrape Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
