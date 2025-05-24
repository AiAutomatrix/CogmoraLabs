
'use client';
import React, { useState, useEffect } from 'react';
import { fetchLatestBoostedTokens } from '@/app/actions/dexScreenerActions';
import type { TokenBoostItem } from '@/types';
import TokenBoostCard from './TokenBoostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

const LatestBoostedTokensView: React.FC = () => {
  const [boosts, setBoosts] = useState<TokenBoostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchLatestBoostedTokens();
        setBoosts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        console.error("Failed to fetch latest boosted tokens:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col space-y-3">
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[80%]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
     return (
        <Alert variant="destructive" className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Boosts</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
  }
  
  if (boosts.length === 0) {
    return <p className="text-center text-muted-foreground p-4">No latest boosted tokens found.</p>;
  }

  return (
    <div className="space-y-4 columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 p-1">
      {boosts.map((boost, index) => (
        <TokenBoostCard key={`${boost.tokenAddress}-${index}`} boost={boost} />
      ))}
    </div>
  );
};

export default LatestBoostedTokensView;
