
'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import LatestTokenProfilesView from './dex-screener/LatestTokenProfilesView';
import LatestBoostedTokensView from './dex-screener/LatestBoostedTokensView';
import TopBoostedTokensView from './dex-screener/TopBoostedTokensView';

type DexScreenerViewType = 'profiles' | 'latestBoosts' | 'topBoosts';

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3"> {/* Reduced padding */}
        <CardTitle className="text-lg">DEX Screener Insights</CardTitle> {/* Slightly smaller title */}
        <div className="pt-2"> {/* Reduced top padding */}
          <RadioGroup
            defaultValue="profiles"
            onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
            className="flex flex-wrap gap-x-4 gap-y-2" // Allow wrapping for radio group
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="profiles" id="profiles" />
              <Label htmlFor="profiles" className="cursor-pointer font-normal text-sm">Latest Profiles</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="latestBoosts" id="latestBoosts" />
              <Label htmlFor="latestBoosts" className="cursor-pointer font-normal text-sm">Latest Boosts</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="topBoosts" id="topBoosts" />
              <Label htmlFor="topBoosts" className="cursor-pointer font-normal text-sm">Top Boosts</Label>
            </div>
          </RadioGroup>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20"> {/* Added slight bg and reduced padding */}
        {selectedView === 'profiles' && <LatestTokenProfilesView />}
        {selectedView === 'latestBoosts' && <LatestBoostedTokensView />}
        {selectedView === 'topBoosts' && <TopBoostedTokensView />}
      </CardContent>
    </Card>
  );
};

export default DexScreenerContent;
