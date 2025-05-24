
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchLatestTokenProfiles,
  fetchLatestBoostedTokens,
  fetchTopBoostedTokens,
} from '@/app/actions/dexScreenerActions';
import type { TokenProfileItem, TokenBoostItem, DexLink } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink } from 'lucide-react'; // Added Copy icon
import { useToast } from "@/hooks/use-toast"; // Added useToast

type DexScreenerViewType = 'profiles' | 'latestBoosts' | 'topBoosts';
type DexScreenerData = TokenProfileItem[] | TokenBoostItem[];

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Initialize toast

  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    setData([]); // Clear previous data
    try {
      let result: DexScreenerData = [];
      if (view === 'profiles') {
        result = await fetchLatestTokenProfiles();
      } else if (view === 'latestBoosts') {
        result = await fetchLatestBoostedTokens();
      } else if (view === 'topBoosts') {
        result = await fetchTopBoostedTokens();
      }
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(`Failed to fetch ${view}:`, err);
      toast({
        title: "API Error",
        description: `Could not fetch data for ${view}. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Added toast to dependencies, though not strictly necessary if its identity is stable

  useEffect(() => {
    fetchDataForView(selectedView);
  }, [selectedView, fetchDataForView]);

  const handleCopyAddress = (address: string) => {
    if (!navigator.clipboard) {
      toast({
        title: "Copy Failed",
        description: "Clipboard API not available in this browser.",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast({ title: "Copied!", description: "Token address copied to clipboard." });
    }).catch(err => {
      console.error("Failed to copy address: ", err);
      toast({ title: "Copy Failed", description: "Could not copy address.", variant: "destructive"});
    });
  };

  const renderDescriptionPopover = (description?: string | null) => {
    if (!description) return <span className="text-muted-foreground">-</span>;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Info className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm">
          {description}
        </PopoverContent>
      </Popover>
    );
  };

  const renderLinksDropdown = (links?: DexLink[] | null) => {
    if (!links || links.length === 0) return <span className="text-muted-foreground">-</span>;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Links <LinkIcon className="ml-2 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
          {links.map((link, index) => (
            <DropdownMenuItem key={index} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full">
                {link.label || link.type} <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const isBoostView = selectedView === 'latestBoosts' || selectedView === 'topBoosts';

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="text-lg">DEX Screener Insights</CardTitle>
        <div className="pt-2">
          <RadioGroup
            defaultValue="profiles"
            onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
            className="flex flex-wrap gap-x-4 gap-y-2"
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
      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-semibold">Error loading data</p>
            <p className="text-muted-foreground text-sm text-center">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-4">Retry</Button>
          </div>
        ) : data.length === 0 ? (
           <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No data available for this view.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>
              {selectedView === 'profiles' && 'Latest token profiles.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts.'}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Icon</TableHead>
                <TableHead>Name/Symbol</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Address</TableHead>
                {isBoostView && <TableHead className="text-right">Boost Amt.</TableHead>}
                {isBoostView && <TableHead className="text-right">Total Boost</TableHead>}
                <TableHead className="w-[80px] text-center">Info</TableHead>
                <TableHead className="w-[100px] text-center">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}`}> {/* Ensure key uniqueness */}
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.description || 'Token icon'} data-ai-hint="token logo" />
                      <AvatarFallback>{(item.description || item.tokenAddress || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] min-w-0 truncate" title={item.description || item.tokenAddress}>
                    {item.description || item.tokenAddress}
                  </TableCell>
                  <TableCell>{item.chainId}</TableCell>
                  <TableCell className="max-w-[150px] min-w-0 font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.tokenAddress}>{item.tokenAddress}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleCopyAddress(item.tokenAddress)}>
                          <Copy className="h-3 w-3"/>
                      </Button>
                    </div>
                  </TableCell>
                  {isBoostView && 'amount' in item && (
                    <TableCell className="text-right">{(item as TokenBoostItem).amount?.toLocaleString() ?? '-'}</TableCell>
                  )}
                  {isBoostView && 'totalAmount' in item && (
                     <TableCell className="text-right">{(item as TokenBoostItem).totalAmount?.toLocaleString() ?? '-'}</TableCell>
                  )}
                  <TableCell className="text-center">{renderDescriptionPopover(item.description)}</TableCell>
                  <TableCell className="text-center">{renderLinksDropdown(item.links)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default DexScreenerContent;

    