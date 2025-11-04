
'use client';
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus, Edit, Trash2, Settings, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

const AiAgentShowcase = () => {
    
    const features = [
        {
            icon: <FilePlus className="h-5 w-5 text-primary" />,
            title: "Create New Triggers",
            description: "Identifies opportunities in your watchlist and proposes new conditional orders to capture potential gains."
        },
        {
            icon: <Edit className="h-5 w-5 text-primary" />,
            title: "Update Existing Triggers",
            description: "Adapts to market changes by suggesting modifications to your active triggers, like adjusting target prices."
        },
        {
            icon: <Trash2 className="h-5 w-5 text-primary" />,
            title: "Cancel Obsolete Triggers",
            description: "Keeps your strategy clean by recommending the removal of triggers that are no longer relevant."
        },
        {
            icon: <ShieldCheck className="h-5 w-5 text-primary" />,
            title: "Manage Open Positions",
            description: "Suggests Stop Loss and Take Profit levels for your active trades to help manage risk and secure profits."
        }
    ];

    return (
        <section className="py-20 px-4 bg-background">
            <div className="container mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet Your AI Trading Agent</h2>
                        <p className="text-muted-foreground mb-6 text-lg">
                            Go beyond manual trading. Our advanced AI agent acts as your personal analyst, constantly scanning your account, watchlist, and open trades to formulate a strategic plan. It's designed to assist, not replace, giving you the final say on every decision.
                        </p>
                        <div className="space-y-4 mb-6">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-start gap-4">
                                    <div className="flex-shrink-0 bg-primary/10 p-2 rounded-full">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{feature.title}</h3>
                                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                             <Settings className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                             <div>
                                <h4 className="font-semibold">You Are In Control</h4>
                                <p className="text-sm text-muted-foreground">Use the AI Settings panel to give the agent custom instructions, enable auto-execution, or tell it to focus only on creating new triggers. It works for you.</p>
                             </div>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <Card className="overflow-hidden shadow-2xl shadow-primary/20">
                            <CardContent className="p-0">
                                <Image
                                    src="https://picsum.photos/seed/ai-agent/800/1000"
                                    alt="AI Agent Interface Showcase"
                                    width={800}
                                    height={1000}
                                    className="w-full h-auto object-cover"
                                    data-ai-hint="ai interface"
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AiAgentShowcase;
