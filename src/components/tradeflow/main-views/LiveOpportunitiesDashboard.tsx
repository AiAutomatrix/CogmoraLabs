
'use client';

import React from 'react'; // Added React import
import { useOpportunitySocket } from "@/hooks/useOpportunitySocket";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { AlertTriangle } from 'lucide-react'; // For error/empty state

export function LiveOpportunitiesDashboard() {
  const { opportunities } = useOpportunitySocket();
  const [isLoading, setIsLoading] = React.useState(true); // Simulate initial loading

  React.useEffect(() => {
    // Simulate initial data fetch delay or WebSocket connection establishment
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Adjust delay as needed
    return () => clearTimeout(timer);
  }, []);

  // Simulate receiving some data for initial display testing
  // In a real scenario, opportunities would populate from the WebSocket
  const sampleOpportunities = !isLoading && opportunities.length === 0 ? [
      { id: '1', name: 'Bitcoin Bull Run', symbol: 'BTC/USDT', entryPrice: 60000, currentPrice: 61200, percentChange: 2.00, updatedAt: new Date().toISOString() },
      { id: '2', name: 'Ethereum Surge', symbol: 'ETH/USDT', entryPrice: 3000, currentPrice: 2950, percentChange: -1.67, updatedAt: new Date().toISOString() },
      { id: '3', name: 'Solana Breakout', symbol: 'SOL/USDT', entryPrice: 150, currentPrice: 165, percentChange: 10.00, updatedAt: new Date().toISOString() },
  ] : opportunities;


  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 h-full overflow-y-auto">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="rounded-2xl shadow-md border">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-5 w-1/4 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (sampleOpportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <p className="text-xl">No active opportunities found.</p>
        <p className="text-sm">Waiting for data from the server...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 h-full overflow-y-auto">
      {sampleOpportunities.map((opp) => (
        <Card key={opp.id} className="rounded-2xl shadow-md border bg-card hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="text-lg font-semibold text-foreground truncate" title={`${opp.name} (${opp.symbol})`}>{opp.name} ({opp.symbol})</div>
            <div className="mt-2 text-sm text-muted-foreground">Entry: ${opp.entryPrice.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Current: ${opp.currentPrice.toFixed(2)}</div>
            <div
              className={`mt-2 text-base font-bold ${
                opp.percentChange >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {opp.percentChange >= 0 ? '+' : ''}{opp.percentChange.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground/70 mt-3">
              Updated: {new Date(opp.updatedAt).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default LiveOpportunitiesDashboard; // Ensure default export
