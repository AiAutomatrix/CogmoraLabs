"use client";

import React from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThumbsUp, ThumbsDown, ArrowUp, ArrowDown, Edit, FilePlus, Trash2, ShieldCheck, History, ListTodo } from 'lucide-react';
import type { AgentAction } from '@/types';
import { format } from 'date-fns';

const formatPrice = (price?: number) => {
    if (price === undefined || isNaN(price)) return "N/A";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: price < 0.1 ? 8 : 4 }).format(price);
};

const ActionCard: React.FC<{ action: AgentAction; onApprove: (action: AgentAction) => void; onDecline: (action: AgentAction) => void; }> = ({ action, onApprove, onDecline }) => {
    let title, Icon, badgeText, badgeVariant: "default" | "destructive" | "secondary";
    let triggerDetails: any = {}; // Use any to simplify access
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
            triggerDetails = action.updates; entityId = `Pos. ID ${action.positionId.slice(-6)}`;
            break;
    }

    return (
        <Card className="bg-card/50">
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
                
                 <div className="text-xs space-y-1">
                    {triggerDetails.condition && triggerDetails.targetPrice && (
                        <div className="flex items-center">
                            {triggerDetails.condition === 'above' ? <ArrowUp className="h-3 w-3 text-green-500 mr-1" /> : <ArrowDown className="h-3 w-3 text-red-500 mr-1" />}
                            {triggerDetails.condition} {formatPrice(triggerDetails.targetPrice)}
                        </div>
                    )}
                    {triggerDetails.action && (
                        <p>Action: <span className="font-mono">{triggerDetails.action} {triggerDetails.leverage ? `${triggerDetails.leverage}x` : ''}</span></p>
                    )}
                    {triggerDetails.amount && (
                       <p>Amount: <span className="font-mono">{formatPrice(triggerDetails.amount)}</span></p>
                    )}
                    {triggerDetails.stopLoss && (
                        <p>Stop Loss: <span className="font-mono text-destructive">{formatPrice(triggerDetails.stopLoss)}</span></p>
                    )}
                    {triggerDetails.takeProfit && (
                        <p>Take Profit: <span className="font-mono text-green-500">{formatPrice(triggerDetails.takeProfit)}</span></p>
                    )}
                </div>


                <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => onDecline(action)}>
                        <ThumbsDown className="h-4 w-4 mr-1" /> Decline
                    </Button>
                    <Button size="sm" onClick={() => onApprove(action)}>
                        <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};


const AiPaperTradingChat: React.FC = () => {
    const { 
        addTradeTrigger, 
        removeTradeTrigger, 
        updateTradeTrigger, 
        updatePositionSlTp, 
        logAiAction, 
        lastAiActionPlan,
        removeActionFromPlan,
        aiActionLogs,
        clearAiActionLogs,
        isAiLoading,
    } = usePaperTrading();

    const activePlan = lastAiActionPlan;

    const handleApprove = (action: AgentAction) => {
        logAiAction(action);
        if (action.type === 'CREATE') {
            addTradeTrigger(action.trigger);
        } else if (action.type === 'UPDATE') {
            updateTradeTrigger(action.triggerId, action.updates);
        } else if (action.type === 'CANCEL') {
            removeTradeTrigger(action.triggerId);
        } else if (action.type === 'UPDATE_OPEN_POSITION') {
            updatePositionSlTp(action.positionId, action.updates.stopLoss, action.updates.takeProfit);
        }
        removeActionFromPlan(action);
    };

    const handleDecline = (action: AgentAction) => {
        removeActionFromPlan(action);
    };

    const renderLogItem = (log: AgentAction & { executedAt: number }, index: number) => {
        let title, Icon, badgeText, badgeVariant: "default" | "destructive" | "secondary";
        let triggerDetails: any = {};
        let entityId = '';

        switch (log.type) {
            case 'CREATE':
                title = 'Create Trigger'; Icon = FilePlus; badgeText = 'New'; badgeVariant = 'default';
                triggerDetails = log.trigger; entityId = log.trigger.symbolName;
                break;
            case 'UPDATE':
                title = 'Update Trigger'; Icon = Edit; badgeText = 'Update'; badgeVariant = 'secondary';
                triggerDetails = log.updates; entityId = `ID ${log.triggerId.slice(-6)}`;
                break;
            case 'CANCEL':
                title = 'Cancel Trigger'; Icon = Trash2; badgeText = 'Cancel'; badgeVariant = 'destructive';
                entityId = `ID ${log.triggerId.slice(-6)}`;
                break;
            case 'UPDATE_OPEN_POSITION':
                title = 'Update Position'; Icon = ShieldCheck; badgeText = 'Risk Mgmt'; badgeVariant = 'secondary';
                triggerDetails = log.updates; entityId = `Pos. ID ${log.positionId.slice(-6)}`;
                break;
        }

        return (
             <div key={index} className="p-3 border-b">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{format(new Date(log.executedAt), 'MMM d, yyyy HH:mm:ss')}</p>
                    <p className="font-semibold flex items-center text-sm">
                      <Icon className="h-4 w-4 mr-2" />
                      {title}: { 'symbolName' in triggerDetails ? triggerDetails.symbolName : entityId }
                    </p>
                  </div>
                  <Badge variant={badgeVariant}>{badgeText}</Badge>
                </div>
                <p className="text-xs text-muted-foreground italic mb-2">"{log.reasoning}"</p>
            </div>
        );
    }
    
    const MainContent = () => {
         if (isAiLoading) {
            return (
                <div className="space-y-4 p-4 h-full">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
            );
        }
        if (!activePlan?.analysis && (!activePlan?.plan || activePlan.plan.length === 0)) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <CardTitle className="text-lg mb-2">Paper Trading AI Agent</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Click "Run AI Now" in the 'Triggers' tab. The agent will analyze your account and propose a plan here.
                    </p>
                </div>
           );
        }
        
        return (
             <div className="space-y-4">
                {activePlan.analysis && (
                    <Card className="flex-shrink-0">
                        <CardHeader className="p-3">
                            <CardTitle className="text-base">Agent Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activePlan.analysis}</p>
                        </CardContent>
                    </Card>
                )}

                {activePlan.plan && activePlan.plan.length > 0 ? (
                    <div>
                        <h3 className="text-base font-semibold mb-2">Proposed Plan of Action</h3>
                        <div className="space-y-3">
                            {activePlan.plan.map((action, index) => (
                                <ActionCard key={index} action={action} onApprove={handleApprove} onDecline={handleDecline} />
                            ))}
                        </div>
                    </div>
                ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">All proposed actions have been completed.</p>
                )}
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
        <Tabs defaultValue="plan" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="plan"><ListTodo className="mr-2 h-4 w-4" /> Action Plan</TabsTrigger>
                <TabsTrigger value="logs"><History className="mr-2 h-4 w-4" /> Execution Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="plan" className="flex-grow mt-0 overflow-hidden">
                <MainContent />
            </TabsContent>
            <TabsContent value="logs" className="flex-grow mt-0 overflow-hidden flex flex-col">
                <div className="p-2 border-b flex justify-end">
                    <Button variant="outline" size="sm" onClick={clearAiActionLogs} disabled={aiActionLogs.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Clear Logs
                    </Button>
                </div>
                <ScrollArea className="flex-grow">
                     {aiActionLogs.length > 0 ? (
                        [...aiActionLogs].reverse().map(renderLogItem)
                     ) : (
                        <p className="text-center text-muted-foreground py-10">No AI actions have been executed yet.</p>
                     )}
                </ScrollArea>
            </TabsContent>
        </Tabs>
        </div>
    );
};

export default AiPaperTradingChat;
