
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchLatestTokenProfiles,
  fetchLatestBoostedTokens,
  fetchTopBoostedTokens,
  fetchTokenOrders,
  fetchPairDetails,
} from '@/app/actions/dexScreenerActions';
import type { TokenProfileItem, TokenBoostItem, DexLink, OrderInfoItem, PairDataSchema, PairDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { format, fromUnixTime } from 'date-fns';

type DexScreenerViewType = 'profiles' | 'latestBoosts' | 'topBoosts' | 'tokenOrders' | 'pairDetails';
type DexScreenerData = TokenProfileItem[] | TokenBoostItem[] | OrderInfoItem[] | PairDataSchema | null;

const formatCurrency = (value: number | string | null | undefined, decimals = 2) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const formatLargeNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
};

const formatDateString = (timestamp: number | Date | undefined | null, isUnixSeconds = false): string => {
    if (!timestamp) return '-';
    try {
        const date = isUnixSeconds ? fromUnixTime(Number(timestamp)) : new Date(Number(timestamp));
        return format(date, 'MMM d, yyyy HH:mm');
    } catch (e) {
        return 'Invalid Date';
    }
};

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [inputChainId, setInputChainId] = useState('');
  const [inputTokenAddress, setInputTokenAddress] = useState('');
  const [inputPairAddress, setInputPairAddress] = useState('');

  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      let result: DexScreenerData = null;
      if (view === 'profiles') {
        result = await fetchLatestTokenProfiles();
      } else if (view === 'latestBoosts') {
        result = await fetchLatestBoostedTokens();
      } else if (view === 'topBoosts') {
        result = await fetchTopBoostedTokens();
      } else if (view === 'tokenOrders') {
        if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Missing Info", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchTokenOrders(inputChainId, inputTokenAddress);
      } else if (view === 'pairDetails') {
         if (!inputChainId || !inputPairAddress) {
          toast({ title: "Missing Info", description: "Chain ID and Pair Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchPairDetails(inputChainId, inputPairAddress);
      }
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(`Failed to fetch ${view}:`, err);
      toast({ title: "API Error", description: `Could not fetch data for ${view}. ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, inputChainId, inputTokenAddress, inputPairAddress]);

  useEffect(() => {
    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
      fetchDataForView(selectedView);
    } else {
      setData(null); // Clear data if view requires input and input is not yet provided
    }
  }, [selectedView, fetchDataForView]);

  const handleCopyAddress = (address: string) => {
    if (!navigator.clipboard) {
      toast({ title: "Copy Failed", description: "Clipboard API not available.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast({ title: "Copied!", description: "Address copied to clipboard." });
    }).catch(err => {
      console.error("Failed to copy address: ", err);
      toast({ title: "Copy Failed", description: "Could not copy address.", variant: "destructive"});
    });
  };

  const truncateAddress = (address: string | null | undefined, startChars = 6, endChars = 4) => {
    if (!address) return '-';
    return address.length > startChars + endChars ? `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}` : address;
  };

  const renderDescriptionInteraction = (description?: string | null) => {
    if (!description) return <span className="text-muted-foreground">-</span>;
    const truncated = description.length > 50 ? description.substring(0, 47) + "..." : description;
    return (
      <Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="top" className="max-w-xs z-50"><p>{truncated}</p></TooltipContent>
          <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm z-[51]" side="top">{description}</PopoverContent>
        </Popover>
      </Tooltip>
    );
  };

  const renderLinksDropdown = (links?: DexLink[] | null, itemUrl?: string | null) => {
    const allLinks = links ? [...links] : [];
    if (itemUrl) {
        allLinks.unshift({type: "DexScreener", label: "DexScreener Page", url: itemUrl})
    }
    if (allLinks.length === 0) return <span className="text-muted-foreground">-</span>;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8">Links <LinkIcon className="ml-2 h-3 w-3" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto z-50">
          {allLinks.map((link, index) => (
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

  const renderPairInfoDialog = (pair: PairDetail) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4"/></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{pair.baseToken.symbol}/{pair.quoteToken.symbol} Details</DialogTitle>
                    <DialogDescription>Pair: {truncateAddress(pair.pairAddress)}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2 text-sm">
                    {pair.info?.imageUrl && (
                        <div className="relative h-40 w-full rounded-md overflow-hidden my-2">
                            <Image src={pair.info.imageUrl} alt={`${pair.baseToken.name} Image`} fill style={{objectFit: 'contain'}} data-ai-hint="token image" />
                        </div>
                    )}
                    <p><strong>Chain ID:</strong> {pair.chainId}</p>
                    <p><strong>DEX ID:</strong> {pair.dexId}</p>
                    {pair.url && <p><strong>DexScreener URL:</strong> <a href={pair.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{pair.url}</a></p>}
                    {pair.labels && pair.labels.length > 0 && <p><strong>Labels:</strong> {pair.labels.join(', ')}</p>}
                    
                    <h4 className="font-semibold pt-2 border-t mt-2">Base Token ({pair.baseToken.symbol})</h4>
                    <p>Name: {pair.baseToken.name}</p>
                    <p>Address: {pair.baseToken.address} <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleCopyAddress(pair.baseToken.address)}><Copy className="h-3 w-3"/></Button></p>

                    <h4 className="font-semibold pt-2 border-t mt-2">Quote Token ({pair.quoteToken.symbol})</h4>
                    <p>Name: {pair.quoteToken.name}</p>
                    <p>Address: {pair.quoteToken.address} <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleCopyAddress(pair.quoteToken.address)}><Copy className="h-3 w-3"/></Button></p>
                    
                    {pair.info?.websites && pair.info.websites.length > 0 && (
                        <>
                         <h4 className="font-semibold pt-2 border-t mt-2">Websites:</h4>
                         <ul className="list-disc list-inside">
                            {pair.info.websites.map((site, i) => <li key={`web-${i}`}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{site.url}</a></li>)}
                         </ul>
                        </>
                    )}
                     {pair.info?.socials && pair.info.socials.length > 0 && (
                        <>
                         <h4 className="font-semibold pt-2 border-t mt-2">Socials:</h4>
                         <ul className="list-disc list-inside">
                            {pair.info.socials.map((social, i) => <li key={`soc-${i}`}>{social.platform}: {social.handle}</li>)}
                         </ul>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
  }

  const isProfileOrBoostView = selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts';
  const needsInputs = selectedView === 'tokenOrders' || selectedView === 'pairDetails';

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SearchCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">DEX Screener</CardTitle>
        </div>
        <div className="pt-2 flex flex-col gap-3">
          <RadioGroup value={selectedView} onValueChange={(value) => setSelectedView(value as DexScreenerViewType)} className="flex flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center space-x-2"><RadioGroupItem value="profiles" id="profiles" /><Label htmlFor="profiles" className="cursor-pointer font-normal text-sm">Latest Profiles</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="latestBoosts" id="latestBoosts" /><Label htmlFor="latestBoosts" className="cursor-pointer font-normal text-sm">Latest Boosts</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="topBoosts" id="topBoosts" /><Label htmlFor="topBoosts" className="cursor-pointer font-normal text-sm">Top Boosts</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="tokenOrders" id="tokenOrders" /><Label htmlFor="tokenOrders" className="cursor-pointer font-normal text-sm">Token Orders</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="pairDetails" id="pairDetails" /><Label htmlFor="pairDetails" className="cursor-pointer font-normal text-sm">Pair Details</Label></div>
          </RadioGroup>

          {needsInputs && (
            <div className="flex flex-col sm:flex-row gap-2 p-2 border rounded-md bg-muted/50">
              <Input type="text" placeholder="Chain ID (e.g., solana)" value={inputChainId} onChange={(e) => setInputChainId(e.target.value)} className="h-9" />
              {selectedView === 'tokenOrders' && <Input type="text" placeholder="Token Address" value={inputTokenAddress} onChange={(e) => setInputTokenAddress(e.target.value)} className="h-9" />}
              {selectedView === 'pairDetails' && <Input type="text" placeholder="Pair Address" value={inputPairAddress} onChange={(e) => setInputPairAddress(e.target.value)} className="h-9" />}
              <Button onClick={() => fetchDataForView(selectedView)} disabled={isLoading} className="h-9 text-sm px-3">
                {isLoading ? 'Fetching...' : 'Fetch Data'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" /><p className="text-destructive font-semibold">Error loading data</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-4">Retry</Button>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0) || (selectedView === 'pairDetails' && data && !(data as PairDataSchema).pairs?.length)) ? (
          <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No data available for this view. {needsInputs && 'Enter parameters and click fetch.'}</p></div>
        ) : (
          <Table>
            <TableCaption>
              {selectedView === 'profiles' && 'Latest token profiles.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts.'}
              {selectedView === 'tokenOrders' && `Orders for token ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairDetails' && `Details for pair ${inputPairAddress} on ${inputChainId}.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {isProfileOrBoostView && <><TableHead className="w-[50px]">Icon</TableHead><TableHead>Name</TableHead><TableHead>Symbol</TableHead><TableHead>Chain</TableHead><TableHead className="min-w-[150px]">Address</TableHead></>}
                {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <><TableHead className="text-right">Boost Amt.</TableHead><TableHead className="text-right">Total Boost</TableHead></>}
                {isProfileOrBoostView && <><TableHead className="w-[60px] text-center">Info</TableHead><TableHead className="w-[100px] text-center">Links</TableHead></>}
                
                {selectedView === 'tokenOrders' && <><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Payment Date</TableHead></>}
                
                {selectedView === 'pairDetails' && <>
                  <TableHead>Pair Address</TableHead><TableHead>Base</TableHead><TableHead>Quote</TableHead>
                  <TableHead className="text-right">Price USD</TableHead><TableHead className="text-right">Volume (24h)</TableHead>
                  <TableHead className="text-right">Liquidity USD</TableHead><TableHead className="text-right">Created At</TableHead>
                  <TableHead>DEX ID</TableHead><TableHead className="text-center">Actions</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isProfileOrBoostView && Array.isArray(data) && (data as (TokenProfileItem & TokenBoostItem)[]).map((item, index) => (
                <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`}>
                  <TableCell><Avatar className="h-8 w-8"><AvatarImage src={item.icon ?? undefined} alt={item.name || 'Token icon'} /><AvatarFallback>{(item.name || item.symbol || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar></TableCell>
                  <TableCell className="font-medium max-w-[150px] min-w-0">
                    <Tooltip><TooltipTrigger asChild>
                        <div className="truncate" title={item.name || item.description || "Unknown Token"}>{item.name || item.description || "Unknown Token"}</div>
                    </TooltipTrigger><TooltipContent><p>{item.name || item.description || "Unknown Token"}</p></TooltipContent></Tooltip>
                  </TableCell>
                  <TableCell>{item.symbol || (item.description?.match(/\(([^)]+)\)$/)?.[1]) || 'N/A'}</TableCell>
                  <TableCell>{item.chainId}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button>
                    </div>
                  </TableCell>
                  {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (<TableCell className="text-right">{formatLargeNumber(item.amount)}</TableCell>)}
                  {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (<TableCell className="text-right">{formatLargeNumber(item.totalAmount)}</TableCell>)}
                  <TableCell className="text-center">{renderDescriptionInteraction(item.description)}</TableCell>
                  <TableCell className="text-center">{renderLinksDropdown(item.links, item.url)}</TableCell>
                </TableRow>
              ))}
              {selectedView === 'tokenOrders' && Array.isArray(data) && (data as OrderInfoItem[]).map((order, index) => (
                <TableRow key={`${order.type}-${order.status}-${index}`}>
                    <TableCell>{order.type}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell className="text-right">{formatDateString(order.paymentTimestamp, true)}</TableCell>
                </TableRow>
              ))}
              {selectedView === 'pairDetails' && data && (data as PairDataSchema).pairs?.map((pair) => (
                <TableRow key={pair.pairAddress}>
                    <TableCell className="font-mono text-xs">
                         <div className="flex items-center gap-1">
                            <span className="truncate" title={pair.pairAddress}>{truncateAddress(pair.pairAddress)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleCopyAddress(pair.pairAddress)}><Copy className="h-3 w-3"/></Button>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Tooltip><TooltipTrigger asChild><span className="truncate">{pair.baseToken.symbol}</span></TooltipTrigger>
                        <TooltipContent><p>{pair.baseToken.name} ({truncateAddress(pair.baseToken.address)})</p></TooltipContent></Tooltip>
                    </TableCell>
                    <TableCell>
                        <Tooltip><TooltipTrigger asChild><span className="truncate">{pair.quoteToken.symbol}</span></TooltipTrigger>
                        <TooltipContent><p>{pair.quoteToken.name} ({truncateAddress(pair.quoteToken.address)})</p></TooltipContent></Tooltip>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(pair.priceUsd)}</TableCell>
                    <TableCell className="text-right">{formatLargeNumber(pair.volume?.h24)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pair.liquidity?.usd)}</TableCell>
                    <TableCell className="text-right">{formatDateString(pair.pairCreatedAt)}</TableCell>
                    <TableCell>{pair.dexId}</TableCell>
                    <TableCell className="text-center">{renderPairInfoDialog(pair)}</TableCell>
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
