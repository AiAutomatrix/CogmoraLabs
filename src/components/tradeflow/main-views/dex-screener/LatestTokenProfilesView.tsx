// Placeholder for LatestTokenProfilesView.tsx
// Fetches and displays latest token profiles.
// We will implement this in the next step.
'use client';
import React, { useState, useEffect } from 'react';
import { fetchLatestTokenProfiles } from '@/app/actions/dexScreenerActions';
import type { TokenProfileItem } from '@/types';
import TokenProfileCard from './TokenProfileCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

const LatestTokenProfilesView: React.FC = () => {
  const [profiles, setProfiles] = useState<TokenProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchLatestTokenProfiles();
        setProfiles(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        console.error("Failed to fetch latest token profiles:", err);
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
            <AlertTitle>Error Fetching Profiles</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
    );
  }

  if (profiles.length === 0) {
    return <p className="text-center text-muted-foreground p-4">No latest token profiles found.</p>;
  }

  return (
    <div className="space-y-4 columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 p-1">
      {profiles.map((profile, index) => (
        // Using tokenAddress as key if unique, otherwise index is a fallback
        <TokenProfileCard key={profile.tokenAddress || index} profile={profile} />
      ))}
    </div>
  );
};

export default LatestTokenProfilesView;
