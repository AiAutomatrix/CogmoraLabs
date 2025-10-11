
"use client";

import React from 'react';
import { usePaperTrading } from '@/context/PaperTradingContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbsUp, ThumbsDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ProposeTradeTriggersOutput, TradeTrigger } from '@/types';
import { Separator } from '@/components/ui/separator';

interface AiPaperTradingChatProps {
    agentState: ProposeTradeTriggersOutput & { isLoading: boolean };
    setAgentState: React.Dispatch<React.SetStateAction<ProposeTradeTriggersOutput & { isLoading: boolean }>>;
}

const AiPaperTradingChat: React.FC<AiPaperTradingChatProps> = ({ agentState, setAgentState }) => {
    const { addTradeTrigger } = usePaperTrading();
    const { analysis, proposedTriggers, isLoading } = agentState;

    const handleApprove = (trigger: Omit<TradeTrigger, 'id' | 'status'>) => {
        addTradeTrigger(trigger);
        // Remove the approved trigger from the proposed list
        setAgentState(prev => ({
            ...prev,
            proposedTriggers: prev.proposedTriggers.filter(t => t !== trigger)
        }));
    };

    const handleDecline = (trigger: Omit<TradeTrigger, 'id' | 'status'>) => {
        // Just remove the trigger from the proposed list
        setAgentState(prev => ({
            ...prev,
            proposedTriggers: prev.proposedTriggers.filter(t => t !== trigger)
        }));
    };

    const formatPrice = (price?: number) => {
        if (price === undefined || isNaN(price)) return "N/A";
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: price < 0.1 ? 8 : 4 }).format(price);
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
    
    if (!analysis && proposedTriggers.length === 0) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <CardTitle className="text-lg mb-2">Paper Trading AI Agent</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Click the "AI Trigger Analysis" button in the 'Triggers' tab on the main dashboard to get started. The agent will analyze your watchlist and propose trade triggers here.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-6">
                {analysis && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Market Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{analysis}</p>
                        </CardContent>
                    </Card>
                )}

                {proposedTriggers.length > 0 && (
                    <div>
                        <h3 className="text-base font-semibold mb-2">Proposed Triggers</h3>
                        <div className="space-y-3">
                            {proposedTriggers.map((trigger, index) => (
                                <Card key={index} className="bg-card/50">
                                    <CardContent className="p-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{trigger.symbolName}</p>
                                                <div className="flex items-center text-sm text-muted-foreground">
                                                    {trigger.condition === 'above' ? <ArrowUp className="h-4 w-4 text-green-500 mr-1" /> : <ArrowDown className="h-4 w-4 text-red-500 mr-1" />}
                                                    {trigger.condition} {formatPrice(trigger.targetPrice)}
                                                </div>
                                            </div>
                                            <Badge variant={trigger.action === 'short' ? 'destructive' : 'default'} className="capitalize">
                                                {trigger.action} {trigger.type === 'futures' ? `${trigger.leverage}x` : ''}
                                            </Badge>
                                        </div>
                                        <p className="text-sm mt-2">Amount: <span className="font-semibold">{formatPrice(trigger.amount)}</span></p>
                                        
                                        {(trigger.stopLoss || trigger.takeProfit) && (
                                            <>
                                                <Separator className="my-2" />
                                                <div className="text-xs space-y-1">
                                                    {trigger.stopLoss && <p>Stop Loss: <span className="font-mono text-destructive">{formatPrice(trigger.stopLoss)}</span></p>}
                                                    {trigger.takeProfit && <p>Take Profit: <span className="font-mono text-green-500">{formatPrice(trigger.takeProfit)}</span></p>}
                                                </div>
                                            </>
                                        )}

                                        <div className="flex justify-end gap-2 mt-3">
                                            <Button variant="outline" size="sm" onClick={() => handleDecline(trigger)}>
                                                <ThumbsDown className="h-4 w-4 mr-1" /> Decline
                                            </Button>
                                            <Button size="sm" onClick={() => handleApprove(trigger)}>
                                                <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
                 {proposedTriggers.length === 0 && analysis && (
                    <p className="text-sm text-muted-foreground text-center py-4">All proposed triggers have been actioned.</p>
                )}
            </div>
        </ScrollArea>
    );
};

export default AiPaperTradingChat;
