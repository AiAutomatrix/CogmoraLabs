
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AiTriggerSettings } from '@/types';

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

  const handleSave = () => {
    onSave({
      instructions: currentInstructions,
      setSlTp: currentSetSlTp,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Trigger Analysis Settings</DialogTitle>
          <DialogDescription>
            Customize how the AI agent analyzes your watchlist and proposes triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="ai-instructions">Custom Instructions</Label>
            <Textarea
              id="ai-instructions"
              placeholder="e.g., 'Focus on short-term scalping opportunities' or 'Only suggest trades for coins that are up today'."
              value={currentInstructions}
              onChange={(e) => setCurrentInstructions(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide additional context or constraints for the AI agent.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sl-tp-switch">Generate SL/TP Levels</Label>
              <p className="text-xs text-muted-foreground">
                Allow the AI to automatically suggest Stop Loss and Take Profit levels.
              </p>
            </div>
            <Switch
              id="sl-tp-switch"
              checked={currentSetSlTp}
              onCheckedChange={setCurrentSetSlTp}
            />
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
