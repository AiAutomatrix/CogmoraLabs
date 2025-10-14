
"use client";

import React from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbsUp, ThumbsDown, ArrowUp, ArrowDown, Edit, FilePlus, Trash2, ShieldCheck } from 'lucide-react';
import type { AgentActionPlan, AgentAction, ProposedTradeTrigger, TradeTrigger, OpenPosition } from '@/types';
import { Separator } from '@/components/ui/separator';

interface AiPaperTradingChatProps {
    agentState: AgentActionPlan & { isLoading: boolean };
    setAgentState: React.Dispatch<React.SetStateAction<AgentActionPlan & { isLoading: boolean }>>;
}

const AiPaperTradingChat: React.FC<AiPaperTradingChatProps> = ({ agentState, setAgentState }) => {
    const { addTradeTrigger, removeTradeTrigger, updateTradeTrigger, updatePositionSlTp } = usePaperTrading();
    const { analysis, plan, isLoading } = agentState;

    const handleApprove = (action: AgentAction) => {
        if (action.type === 'CREATE') {
            addTradeTrigger(action.trigger);
        } else if (action.type === 'UPDATE') {
            updateTradeTrigger(action.triggerId, action.updates);
        } else if (action.type === 'CANCEL') {
            removeTradeTrigger(action.triggerId);
        } else if (action.type === 'UPDATE_OPEN_POSITION') {
            updatePositionSlTp(action.positionId, action.updates.stopLoss, action.updates.takeProfit);
        }
        
        // Remove the action from the plan
        setAgentState(prev => ({
            ...prev,
            plan: prev.plan.filter(a => a !== action)
        }));
    };

    const handleDecline = (action: AgentAction) => {
        // Just remove the action from the plan
        setAgentState(prev => ({
            ...prev,
            plan: prev.plan.filter(a => a !== action)
        }));
    };

    const formatPrice = (price?: number) => {
        if (price === undefined || isNaN(price)) return "N/A";
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: price < 0.1 ? 8 : 4 }).format(price);
    };

    const renderActionCard = (action: AgentAction, index: number) => {
        let title, Icon, badgeText, badgeVariant: "default" | "destructive" | "secondary";
        let triggerDetails: Partial<TradeTrigger> | Partial<OpenPosition> = {};
        let positionDetails: Partial<OpenPosition> = {};
        let entityId = '';

        switch (action.type) {
            case 'CREATE':
                title = 'Create Trigger';
                Icon = FilePlus;
                badgeText = 'New';
                badgeVariant = 'default';
                triggerDetails = action.trigger;
                entityId = action.trigger.symbolName;
                break;
            case 'UPDATE':
                title = 'Update Trigger';
                Icon = Edit;
                badgeText = 'Update';
                badgeVariant = 'secondary';
                triggerDetails = action.updates;
                entityId = `ID ${action.triggerId.slice(-6)}`;
                break;
            case 'CANCEL':
                title = 'Cancel Trigger';
                Icon = Trash2;
                badgeText = 'Cancel';
                badgeVariant = 'destructive';
                entityId = `ID ${action.triggerId.slice(-6)}`;
                break;
            case 'UPDATE_OPEN_POSITION':
                title = 'Update Position';
                Icon = ShieldCheck;
                badgeText = 'Risk Mgmt';
                badgeVariant = 'secondary';
                positionDetails = action.updates;
                entityId = `Pos. ID ${action.positionId.slice(-6)}`;
                break;
        }

        return (
            <Card key={index} className="bg-card/50">
                <CardHeader className="p-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-semibold flex items-center">
                            <Icon className="h-4 w-4 mr-2" />
                            {title}: { 'symbolName' in triggerDetails ? triggerDetails.symbolName : entityId }
                        </CardTitle>
                        <Badge variant={badgeVariant}>{badgeText}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
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


                    <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleDecline(action)}>
                            <ThumbsDown className="h-4 w-4 mr-1" /> Decline
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(action)}>
                            <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };


    if (isLoading) {
        return (
            <div className="space-y-4 p-4 h-full">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
            </div>
        );
    }
    
    if (!analysis && (!plan || plan.length === 0)) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <CardTitle className="text-lg mb-2">Paper Trading AI Agent</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Click the "Run AI Now" button in the 'Triggers' tab on the main dashboard. The agent will analyze your account and propose a plan here.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-6">
                {analysis && (
                    <Card>
                        <CardHeader className="p-3">
                            <CardTitle className="text-base">Agent Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysis}</p>
                        </CardContent>
                    </Card>
                )}

                {plan && plan.length > 0 && (
                    <div>
                        <h3 className="text-base font-semibold mb-2">Proposed Plan of Action</h3>
                        <div className="space-y-3">
                            {plan.map(renderActionCard)}
                        </div>
                    </div>
                )}
                 {plan && plan.length === 0 && analysis && (
                    <p className="text-sm text-muted-foreground text-center py-4">All proposed actions have been completed.</p>
                )}
            </div>
        </ScrollArea>
    );
};

export default AiPaperTradingChat;
