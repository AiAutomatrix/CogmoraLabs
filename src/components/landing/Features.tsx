'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bot, LayoutDashboard, CandlestickChart } from 'lucide-react';
import React from 'react';

const featuresData = [
  {
    icon: <LayoutDashboard className="h-10 w-10 text-primary" />,
    title: "Advanced Trading Terminal",
    description: "Utilize a powerful interface with multi-chart layouts, real-time screeners for spot and futures, and a comprehensive DEX explorer."
  },
  {
    icon: <CandlestickChart className="h-10 w-10 text-primary" />,
    title: "Live Paper Trading Engine",
    description: "Test your strategies risk-free with a live paper trading account for both spot and leveraged futures markets, complete with detailed performance analytics."
  },
  {
    icon: <Bot className="h-10 w-10 text-primary" />,
    title: "AI-Powered Insights",
    description: "Leverage an integrated AI chat assistant for market analysis and interact with a technical analysis widget that provides real-time indicators."
  }
];

const Features = () => (
  <section className="py-20 px-4 bg-background">
    <div className="container mx-auto text-center">
      <h2 className="text-4xl font-bold mb-4">Core Features</h2>
      <p className="text-muted-foreground mb-12 max-w-3xl mx-auto">
        Cogmora Labs provides a comprehensive suite of tools designed for the modern cryptocurrency trader.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {featuresData.map((feature, index) => (
          <Card key={index} className="bg-card border-border/40 text-center flex flex-col items-center p-6">
            <CardHeader className="p-0">
              <div className="mb-4">
                {feature.icon}
              </div>
              <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
