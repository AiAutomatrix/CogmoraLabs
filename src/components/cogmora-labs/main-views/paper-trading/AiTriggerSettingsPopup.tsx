
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AiTriggerSettings } from '@/types';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AiTriggerSettingsPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  settings: AiTriggerSettings;
  onSave: (settings: AiTriggerSettings) => void;
}

export const AiTriggerSettingsPopup: React.FC<AiTriggerSettingsPopupProps> = ({
  isOpen,
  onOpenChange,
  settings,
  onSave,
}) => {
  const [currentInstructions, setCurrentInstructions] = useState(settings.instructions || '');
  const [currentSetSlTp, setCurrentSetSlTp] = useState(settings.setSlTp ?? true);
  const [currentScheduleInterval, setCurrentScheduleInterval] = useState<number | null>(settings.scheduleInterval ?? null);
  const [currentAutoExecute, setCurrentAutoExecute] = useState(settings.autoExecute ?? false);
  const [currentJustCreate, setCurrentJustCreate] = useState(settings.justCreate ?? false);
  const [currentJustUpdate, setCurrentJustUpdate] = useState(settings.justUpdate ?? false);

  useEffect(() => {
    if (isOpen) {
      setCurrentInstructions(settings.instructions || '');
      setCurrentSetSlTp(settings.setSlTp ?? true);
      setCurrentScheduleInterval(settings.scheduleInterval ?? null);
      setCurrentAutoExecute(settings.autoExecute ?? false);
      setCurrentJustCreate(settings.justCreate ?? false);
      setCurrentJustUpdate(settings.justUpdate ?? false);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    onSave({
      instructions: currentInstructions,
      setSlTp: currentSetSlTp,
      scheduleInterval: currentScheduleInterval,
      autoExecute: currentAutoExecute,
      justCreate: currentJustCreate,
      justUpdate: currentJustUpdate,
    });
    onOpenChange(false);
  };
  
  const handleJustCreateChange = (checked: boolean) => {
    setCurrentJustCreate(checked);
    if (checked) setCurrentJustUpdate(false);
  }

  const handleJustUpdateChange = (checked: boolean) => {
    setCurrentJustUpdate(checked);
    if (checked) setCurrentJustCreate(false);
  }
  
  const scheduleMode = currentScheduleInterval === null ? 'manual' : 'scheduled';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Trigger Analysis Settings</DialogTitle>
          <DialogDescription>
            Customize how the AI agent analyzes your watchlist and proposes triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="ai-instructions">Custom Instructions</Label>
            <Textarea
              id="ai-instructions"
              placeholder="e.g., 'Focus on short-term scalping opportunities' or 'Only suggest trades for coins that are up today'."
              value={currentInstructions}
              onChange={(e) => setCurrentInstructions(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Provide additional context or constraints for the AI agent.
            </p>
          </div>

          <Separator />
          
           <div className="space-y-4">
              <Label className="font-semibold">Scheduling</Label>
              <RadioGroup 
                value={scheduleMode} 
                onValueChange={(v) => setCurrentScheduleInterval(v === 'manual' ? null : 1800000)}
              >
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual">Manual Execution</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="scheduled" id="scheduled" />
                      <Label htmlFor="scheduled">Schedule every</Label>
                      <Select 
                        value={currentScheduleInterval?.toString() ?? '1800000'} 
                        onValueChange={(v) => setCurrentScheduleInterval(parseInt(v, 10))}
                        disabled={scheduleMode !== 'scheduled'}
                      >
                           <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="1800000">30 min</SelectItem>
                              <SelectItem value="3600000">1 hour</SelectItem>
                              <SelectItem value="14400000">4 hours</SelectItem>
                              <SelectItem value="21600000">6 hours</SelectItem>
                              <SelectItem value="43200000">12 hours</SelectItem>
                              <SelectItem value="86400000">24 hours</SelectItem>
                           </SelectContent>
                      </Select>
                  </div>
              </RadioGroup>
          </div>

          <Separator />

          <div className="space-y-4">
             <Label className="font-semibold">Agent Behavior</Label>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                <Label htmlFor="sl-tp-switch">Generate SL/TP Levels</Label>
                <p className="text-xs text-muted-foreground">
                    Allow the AI to suggest Stop Loss and Take Profit levels.
                </p>
                </div>
                <Switch
                id="sl-tp-switch"
                checked={currentSetSlTp}
                onCheckedChange={setCurrentSetSlTp}
                />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                <Label htmlFor="auto-execute-switch">Auto-Execute Plan</Label>
                <p className="text-xs text-muted-foreground">
                    Automatically approve and activate all actions in the AI's plan.
                </p>
                </div>
                <Switch
                id="auto-execute-switch"
                checked={currentAutoExecute}
                onCheckedChange={setCurrentAutoExecute}
                />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                <Label htmlFor="just-create-switch">Create New Triggers Only</Label>
                <p className="text-xs text-muted-foreground">
                    Agent will only propose new triggers from the watchlist.
                </p>
                </div>
                <Switch
                id="just-create-switch"
                checked={currentJustCreate}
                onCheckedChange={handleJustCreateChange}
                />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                <Label htmlFor="just-update-switch">Adjust Active Triggers Only</Label>
                <p className="text-xs text-muted-foreground">
                    Agent will only update or cancel existing triggers.
                </p>
                </div>
                <Switch
                id="just-update-switch"
                checked={currentJustUpdate}
                onCheckedChange={handleJustUpdateChange}
                />
            </div>
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
