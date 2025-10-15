
"use client";

import React from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Edit, FilePlus, Trash2, ShieldCheck } from 'lucide-react';
import type { AgentAction, OpenPosition, TradeTrigger } from '@/types';

interface AiExecutionLogsPopupProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const AiExecutionLogsPopup: React.FC<AiExecutionLogsPopupProps> = ({ isOpen, onOpenChange }) => {
  const { aiActionLogs } = usePaperTrading();

  const formatPrice = (price?: number) => {
    if (price === undefined || isNaN(price)) return "N/A";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: price < 0.1 ? 8 : 4 }).format(price);
  };

  const renderActionDetails = (action: AgentAction) => {
    let title, Icon, badgeText, badgeVariant: "default" | "destructive" | "secondary";
    let triggerDetails: Partial<TradeTrigger> | Partial<OpenPosition> = {};
    let positionDetails: Partial<OpenPosition> = {};
    let entityId = '';

    switch (action.type) {
      case 'CREATE':
        title = 'Create Trigger'; Icon = FilePlus; badgeText = 'New'; badgeVariant = 'default';
        triggerDetails = action.trigger; entityId = action.trigger.symbolName;
        break;
      case 'UPDATE':
        title = 'Update Trigger'; Icon = Edit; badgeText = 'Update'; badgeVariant = 'secondary';
        triggerDetails = action.updates; entityId = `ID ${action.triggerId.slice(-6)}`;
        break;
      case 'CANCEL':
        title = 'Cancel Trigger'; Icon = Trash2; badgeText = 'Cancel'; badgeVariant = 'destructive';
        entityId = `ID ${action.triggerId.slice(-6)}`;
        break;
      case 'UPDATE_OPEN_POSITION':
        title = 'Update Position'; Icon = ShieldCheck; badgeText = 'Risk Mgmt'; badgeVariant = 'secondary';
        positionDetails = action.updates; entityId = `Pos. ID ${action.positionId.slice(-6)}`;
        break;
    }

    return (
      <div className="p-3 border-b">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{format(new Date(action.executedAt), 'MMM d, yyyy HH:mm:ss')}</p>
            <p className="font-semibold flex items-center">
              <Icon className="h-4 w-4 mr-2" />
              {title}: { 'symbolName' in triggerDetails ? triggerDetails.symbolName : entityId }
            </p>
          </div>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
        <p className="text-xs text-muted-foreground italic mb-2">"{action.reasoning}"</p>
        
        { (action.type === 'CREATE' || action.type === 'UPDATE') && (
            <div className="text-xs space-y-1">
                {'condition' in triggerDetails && triggerDetails.condition && triggerDetails.targetPrice && (
                    <div className="flex items-center">
                        {triggerDetails.condition === 'above' ? <ArrowUp className="h-3 w-3 text-green-500 mr-1" /> : <ArrowDown className="h-3 w-3 text-red-500 mr-1" />}
                        {triggerDetails.condition} {formatPrice(triggerDetails.targetPrice)}
                    </div>
                )}
                {'action' in triggerDetails && triggerDetails.action && (
                    <p>Action: <span className="font-mono">{triggerDetails.action} {'leverage' in triggerDetails && triggerDetails.leverage ? `${triggerDetails.leverage}x` : ''}</span></p>
                )}
                {'amount' in triggerDetails && triggerDetails.amount && (
                   <p>Amount: <span className="font-mono">{formatPrice(triggerDetails.amount)}</span></p>
                )}
            </div>
        )}

        { (action.type === 'UPDATE_OPEN_POSITION' || (action.type === 'CREATE' || action.type === 'UPDATE')) && (
            <div className="text-xs space-y-1 mt-1">
                {( ('stopLoss' in triggerDetails && triggerDetails.stopLoss) || ('stopLoss' in positionDetails && positionDetails.stopLoss) ) && (
                    <p>Stop Loss: <span className="font-mono text-destructive">{formatPrice(triggerDetails.stopLoss || positionDetails.stopLoss)}</span></p>
                )}
                {( ('takeProfit' in triggerDetails && triggerDetails.takeProfit) || ('takeProfit' in positionDetails && positionDetails.takeProfit) ) && (
                    <p>Take Profit: <span className="font-mono text-green-500">{formatPrice(triggerDetails.takeProfit || positionDetails.takeProfit)}</span></p>
                )}
            </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Agent Execution Logs</DialogTitle>
          <DialogDescription>
            A history of all AI-driven actions that have been approved.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6">
          <div className="px-6">
            {aiActionLogs.length > 0 ? (
              [...aiActionLogs].reverse().map((log, index) => (
                <div key={index}>
                  {renderActionDetails(log)}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-10">No AI actions have been executed yet.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
