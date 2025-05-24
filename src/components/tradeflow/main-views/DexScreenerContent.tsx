
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchLatestTokenProfiles,
  fetchLatestBoostedTokens,
  fetchTopBoostedTokens,
  fetchTokenOrders,
  fetchPairDetailsByPairAddress,
  searchPairs,
  fetchTokenPairPools,
  fetchPairsByTokenAddresses,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, PackageSearch, TrendingUp, ListFilter, ReceiptText, Layers, Search, Network, ListCollapse, Eye, ExternalLinkIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { format } from 'date-fns';

type DexScreenerViewType = 
  | 'profiles' 
  | 'latestBoosts' 
  | 'topBoosts'
  | 'tokenOrders'
  | 'pairDetailsByPairAddress'
  | 'searchPairs'
  | 'tokenPairPools'
  | 'pairsByTokenAddresses';

type DexScreenerData = TokenProfileItem[] | TokenBoostItem[] | OrderInfoItem[] | PairDataSchema | PairDetail[] | null;


const formatCurrency = (value?: number | string | null, fractionDigits = 2) => {
  const num = Number(value);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(num);
};

const formatLargeNumber = (value?: number | string | null) => {
  const num = Number(value);
  if (isNaN(num)) return '-';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString(undefined, {maximumFractionDigits: 2});
};

const formatDateFromTimestamp = (timestamp?: number | null) => {
  if (!timestamp) return '-';
  try {
    return format(new Date(timestamp * 1000), 'PP pp'); // e.g., "Oct 26, 2023, 10:30:00 AM"
  } catch {
    return '-';
  }
};


const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Input states
  const [inputChainId, setInputChainId] = useState<string>('solana');
  const [inputTokenAddress, setInputTokenAddress] = useState<string>('');
  const [inputPairAddress, setInputPairAddress] = useState<string>('');
  const [inputSearchQuery, setInputSearchQuery] = useState<string>('');
  const [inputCommaSeparatedTokenAddresses, setInputCommaSeparatedTokenAddresses] = useState<string>('');

  // Pair Detail Dialog state
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);
  const [isPairDetailDialogOpen, setIsPairDetailDialogOpen] = useState(false);


  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    setData(null); // Clear previous data

    try {
      let result: DexScreenerData = null;
      switch (view) {
        case 'profiles':
          result = await fetchLatestTokenProfiles();
          break;
        case 'latestBoosts':
          result = await fetchLatestBoostedTokens();
          break;
        case 'topBoosts':
          result = await fetchTopBoostedTokens();
          break;
        case 'tokenOrders':
          if (!inputChainId || !inputTokenAddress) {
            toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchTokenOrders(inputChainId, inputTokenAddress);
          break;
        case 'pairDetailsByPairAddress':
          if (!inputChainId || !inputPairAddress) {
            toast({ title: "Input Required", description: "Chain ID and Pair Address are required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchPairDetailsByPairAddress(inputChainId, inputPairAddress);
          break;
        case 'searchPairs':
          if (!inputSearchQuery) {
            toast({ title: "Input Required", description: "Search query is required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await searchPairs(inputSearchQuery);
          break;
        case 'tokenPairPools':
          if (!inputChainId || !inputTokenAddress) {
            toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchTokenPairPools(inputChainId, inputTokenAddress);
          break;
        case 'pairsByTokenAddresses':
          if (!inputChainId || !inputCommaSeparatedTokenAddresses) {
            toast({ title: "Input Required", description: "Chain ID and Token Addresses are required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchPairsByTokenAddresses(inputChainId, inputCommaSeparatedTokenAddresses);
          break;
        default:
          throw new Error(`Unknown view type: ${view}`);
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
  }, [toast, inputChainId, inputTokenAddress, inputPairAddress, inputSearchQuery, inputCommaSeparatedTokenAddresses]);

  useEffect(() => {
    // Fetch data only for the initial three views automatically
    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
      fetchDataForView(selectedView);
    } else {
      // For other views, clear data and wait for manual fetch
      setData(null);
      setIsLoading(false); 
    }
  }, [selectedView, fetchDataForView]);

  const handleFetchViewData = () => {
    if (selectedView !== 'profiles' && selectedView !== 'latestBoosts' && selectedView !== 'topBoosts') {
      fetchDataForView(selectedView);
    }
  };

  const handleCopyAddress = (address: string) => {
    if (!navigator.clipboard) {
      toast({ title: "Copy Failed", description: "Clipboard API not available.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast({ title: "Copied!", description: "Address copied to clipboard." });
    }).catch(err => {
      console.error("Failed to copy address: ", err);
      toast({ title: "Copy Failed", description: "Could not copy address.", variant: "destructive" });
    });
  };

  const renderDescriptionInteraction = (description?: string | null) => {
    if (!description) return <span className="text-muted-foreground">-</span>;
    const truncatedDescription = description.length > 100 ? description.substring(0, 97) + "..." : description;
    return (
      <Popover>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-xs z-50 bg-popover text-popover-foreground p-2 rounded shadow-md text-xs">
            <p>{truncatedDescription}</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm z-[51] bg-popover text-popover-foreground p-3 rounded shadow-lg" side="top" align="center">
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
          <Button variant="outline" size="sm" className="h-8">Links <LinkIcon className="ml-2 h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto z-50">
          {links.map((link, index) => (
            <DropdownMenuItem key={index} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full">
                {link.label || link.type} <ExternalLinkIcon className="ml-2 h-3 w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  const truncateAddress = (address: string | null | undefined, startChars = 6, endChars = 4) => {
    if (!address) return '-';
    if (address.length <= startChars + endChars) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
  };

  const viewRequiresInputs = (view: DexScreenerViewType) => 
    ['tokenOrders', 'pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(view);

  const getPairsArray = (rawData: DexScreenerData, viewType: DexScreenerViewType): PairDetail[] => {
    if (!rawData) return [];
    if (viewType === 'pairDetailsByPairAddress' || viewType === 'searchPairs') {
      return (rawData as PairDataSchema)?.pairs || [];
    }
    if (viewType === 'tokenPairPools' || viewType === 'pairsByTokenAddresses') {
      return (rawData as PairDetail[]) || [];
    }
    return [];
  };
  
  const renderInputFields = () => {
    if (!viewRequiresInputs(selectedView)) return null;

    return (
      <div className="p-4 border-b bg-card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(selectedView === 'tokenOrders' || selectedView === 'pairDetailsByPairAddress' || selectedView === 'tokenPairPools' || selectedView === 'pairsByTokenAddresses') && (
            <Input
              placeholder="Chain ID (e.g., solana)"
              value={inputChainId}
              onChange={(e) => setInputChainId(e.target.value)}
            />
          )}
          {(selectedView === 'tokenOrders' || selectedView === 'tokenPairPools') && (
            <Input
              placeholder="Token Address"
              value={inputTokenAddress}
              onChange={(e) => setInputTokenAddress(e.target.value)}
            />
          )}
          {selectedView === 'pairDetailsByPairAddress' && (
            <Input
              placeholder="Pair Address"
              value={inputPairAddress}
              onChange={(e) => setInputPairAddress(e.target.value)}
            />
          )}
          {selectedView === 'searchPairs' && (
            <Input
              placeholder="Search Query (e.g., SOL/USDC)"
              value={inputSearchQuery}
              onChange={(e) => setInputSearchQuery(e.target.value)}
              className="md:col-span-2"
            />
          )}
           {selectedView === 'pairsByTokenAddresses' && (
            <Input
              placeholder="Token Addresses (comma-separated)"
              value={inputCommaSeparatedTokenAddresses}
              onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)}
            />
          )}
        </div>
        <Button onClick={handleFetchViewData} disabled={isLoading} className="w-full md:w-auto">
          {isLoading ? 'Fetching...' : 'Fetch View Data'}
        </Button>
      </div>
    );
  };

  const renderTableHeaders = () => {
    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
      const isBoost = selectedView === 'latestBoosts' || selectedView === 'topBoosts';
      return (
        <TableRow>
          <TableHead className="w-[50px]">Icon</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead className="min-w-[150px]">Address</TableHead>
          {isBoost && <TableHead className="text-right">Boost Amt.</TableHead>}
          {selectedView === 'latestBoosts' && <TableHead className="text-right">Total Boost</TableHead>}
          <TableHead className="w-[60px] text-center">Info</TableHead>
          <TableHead className="w-[100px] text-center">Links</TableHead>
        </TableRow>
      );
    }
    if (selectedView === 'tokenOrders') {
      return (
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment Date</TableHead>
        </TableRow>
      );
    }
    if (['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) {
       return (
        <TableRow>
          <TableHead className="w-[50px]">Icon</TableHead>
          <TableHead>Pair</TableHead>
          <TableHead className="text-right">Price (USD)</TableHead>
          <TableHead className="text-right">Volume (24h)</TableHead>
          <TableHead className="text-right">Liquidity (USD)</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead>DEX ID</TableHead>
          <TableHead className="text-center">Actions</TableHead>
        </TableRow>
      );
    }
    return null;
  };

  const renderTableRows = () => {
    if (!data || (Array.isArray(data) && data.length === 0 && (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts' || selectedView === 'tokenOrders' || selectedView === 'tokenPairPools' || selectedView === 'pairsByTokenAddresses')) ) {
        if (!data && (selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs') ) return null; // Handled by no data message
        if (Array.isArray(data) && data.length === 0) return <TableRow><TableCell colSpan={8} className="text-center">No data available for this view.</TableCell></TableRow>; // Should be caught by outer check too
    }


    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
      const items = data as (TokenProfileItem | TokenBoostItem)[];
      const isBoost = selectedView === 'latestBoosts' || selectedView === 'topBoosts';
      return items.map((item, index) => (
        <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`}>
          <TableCell>
            <Avatar className="h-8 w-8">
              <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.name || item.description || item.tokenAddress || 'Token icon'} />
              <AvatarFallback>{(item.name || item.description || item.tokenAddress || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </TableCell>
          <TableCell className="font-medium max-w-[200px] min-w-0">
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div className="truncate" title={item.name || item.description || "Unknown Token"}>
                  {item.name || item.description || "Unknown Token"}
                </div>
              </TooltipTrigger>
              <TooltipContent><p>{item.name || item.description || "Unknown Token"}</p></TooltipContent>
            </Tooltip>
          </TableCell>
          <TableCell>{item.chainId}</TableCell>
          <TableCell className="font-mono text-xs">
            <div className="flex items-center gap-1">
              <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button>
            </div>
          </TableCell>
          {isBoost && <TableCell className="text-right">{(item as TokenBoostItem).amount?.toLocaleString() ?? '-'}</TableCell>}
          {selectedView === 'latestBoosts' && <TableCell className="text-right">{(item as TokenBoostItem).totalAmount?.toLocaleString() ?? '-'}</TableCell>}
          <TableCell className="text-center">{renderDescriptionInteraction(item.description)}</TableCell>
          <TableCell className="text-center">{renderLinksDropdown(item.links)}</TableCell>
        </TableRow>
      ));
    }

    if (selectedView === 'tokenOrders') {
      const items = data as OrderInfoItem[];
      return items.map((item, index) => (
        <TableRow key={`${item.type}-${item.status}-${item.paymentTimestamp}-${index}`}>
          <TableCell>{item.type}</TableCell>
          <TableCell>{item.status}</TableCell>
          <TableCell>{formatDateFromTimestamp(item.paymentTimestamp)}</TableCell>
        </TableRow>
      ));
    }
    
    if (['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) {
      const pairs = getPairsArray(data, selectedView);
      if (pairs.length === 0) return <TableRow><TableCell colSpan={8} className="text-center">No pair data available.</TableCell></TableRow>;
      
      return pairs.map((pair, index) => (
        <TableRow key={`${pair.pairAddress}-${pair.chainId}-${index}`}>
          <TableCell>
            <Avatar className="h-8 w-8">
              <AvatarImage src={pair.info?.imageUrl || pair.baseToken?.symbol /* Quick fallback, improve if needed */} alt={pair.baseToken?.name || 'Token'} />
              <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </TableCell>
          <TableCell className="font-medium max-w-[180px] min-w-0">
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div className="truncate" title={`${pair.baseToken?.name} / ${pair.quoteToken?.name}`}>
                  {`${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`}
                </div>
              </TooltipTrigger>
               <TooltipContent><p>{`${pair.baseToken?.name || pair.baseToken?.symbol} / ${pair.quoteToken?.name || pair.quoteToken?.symbol}`}</p></TooltipContent>
            </Tooltip>
          </TableCell>
          <TableCell className="text-right">{formatCurrency(pair.priceUsd)}</TableCell>
          <TableCell className="text-right">{formatLargeNumber(pair.volume?.h24)}</TableCell>
          <TableCell className="text-right">{formatCurrency(pair.liquidity?.usd)}</TableCell>
          <TableCell>{pair.chainId}</TableCell>
          <TableCell>{pair.dexId || '-'}</TableCell>
          <TableCell className="text-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedPairForDialog(pair); setIsPairDetailDialogOpen(true); }}>
              <Eye className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      ));
    }
    return null;
  };
  
  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <PackageSearch className="mr-2 h-4 w-4" /> },
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Liquidity Pools', icon: <Network className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Token Addresses', icon: <ListCollapse className="mr-2 h-4 w-4" /> },
  ];

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <SearchCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">DEX Screener</CardTitle>
        </div>
        <RadioGroup
          value={selectedView}
          onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
        >
          {viewOptions.map(opt => (
            <div key={opt.value} className="flex items-center">
              <RadioGroupItem value={opt.value} id={opt.value} className="peer sr-only" />
              <Label 
                htmlFor={opt.value} 
                className="flex items-center justify-center text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground transition-colors cursor-pointer w-full p-2 text-center"
              >
                {opt.icon}{opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardHeader>

      {renderInputFields()}

      <CardContent className="flex-grow overflow-y-auto p-0 bg-muted/20">
        {isLoading && !viewRequiresInputs(selectedView) ? ( // Show skeleton only for auto-loading views
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
          </div>
        ) : isLoading && viewRequiresInputs(selectedView) && data !== null ? ( // Show skeleton if inputs were used and now loading
            <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-semibold">Error loading data</p>
            <p className="text-muted-foreground text-sm text-center">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-4">Retry</Button>
          </div>
        ) : !data && viewRequiresInputs(selectedView) ? (
           <div className="flex items-center justify-center h-full p-6 text-center">
            <p className="text-muted-foreground">Enter parameters above and click "Fetch View Data" to load this view.</p>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0) || ('pairs' in (data || {}) && (data as PairDataSchema).pairs.length === 0) ) ? (
           <div className="flex items-center justify-center h-full p-6">
            <p className="text-muted-foreground">No data available for this view or criteria.</p>
          </div>
        ) : (
          <Table>
            <TableCaption className="py-3">
              {selectedView === 'profiles' && 'Latest token profiles.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts.'}
              {selectedView === 'tokenOrders' && 'Paid orders for the specified token.'}
              {selectedView === 'pairDetailsByPairAddress' && 'Details for the specified pair address.'}
              {selectedView === 'searchPairs' && `Search results for "${inputSearchQuery}".`}
              {selectedView === 'tokenPairPools' && 'Liquidity pools for the specified token.'}
              {selectedView === 'pairsByTokenAddresses' && 'Pair data for the specified token addresses.'}
            </TableCaption>
            <TableHeader>{renderTableHeaders()}</TableHeader>
            <TableBody>{renderTableRows()}</TableBody>
          </Table>
        )}
      </CardContent>
      
      {selectedPairForDialog && (
        <Dialog open={isPairDetailDialogOpen} onOpenChange={setIsPairDetailDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {selectedPairForDialog.info?.imageUrl && (
                  <Avatar className="h-7 w-7 mr-2">
                    <AvatarImage src={selectedPairForDialog.info.imageUrl} alt={selectedPairForDialog.baseToken?.name || 'Token'}/>
                    <AvatarFallback>{(selectedPairForDialog.baseToken?.symbol || 'P').substring(0,1)}</AvatarFallback>
                  </Avatar>
                )}
                {selectedPairForDialog.baseToken?.name || selectedPairForDialog.baseToken?.symbol} / {selectedPairForDialog.quoteToken?.name || selectedPairForDialog.quoteToken?.symbol}
              </DialogTitle>
              <DialogDescription>
                Pair Address: {truncateAddress(selectedPairForDialog.pairAddress)} 
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleCopyAddress(selectedPairForDialog.pairAddress)}><Copy className="h-3 w-3"/></Button>
                <br/>
                DEX: {selectedPairForDialog.dexId || '-'} on {selectedPairForDialog.chainId}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                    <div><strong>Price USD:</strong> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                    <div><strong>Liquidity USD:</strong> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</div>
                    <div><strong>Volume (24h):</strong> {formatLargeNumber(selectedPairForDialog.volume?.h24)}</div>
                    <div><strong>Market Cap:</strong> {formatCurrency(selectedPairForDialog.marketCap, 0)}</div>
                    <div><strong>FDV:</strong> {formatCurrency(selectedPairForDialog.fdv, 0)}</div>
                    <div><strong>Created:</strong> {formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</div>
                </div>

                {selectedPairForDialog.priceChange && (
                    <div className="mt-2">
                        <h4 className="font-semibold mb-1">Price Change:</h4>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                            {Object.entries(selectedPairForDialog.priceChange).map(([key, value]) => value !== undefined && value !== null && (
                                <div key={key}><strong>{key}:</strong> <span className={value >= 0 ? 'text-green-500' : 'text-red-500'}>{value.toFixed(2)}%</span></div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedPairForDialog.txns && (
                     <div className="mt-2">
                        <h4 className="font-semibold mb-1">Transactions (Buys/Sells):</h4>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                            {Object.entries(selectedPairForDialog.txns).map(([key, value]) => value && (
                                <div key={key}><strong>{key}:</strong> B:{value.buys ?? '-'} / S:{value.sells ?? '-'}</div>
                            ))}
                        </div>
                    </div>
                )}
                
                {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                    <div className="mt-2">
                        <h4 className="font-semibold mb-1">Websites:</h4>
                        <ul className="list-disc list-inside pl-1 space-y-0.5">
                        {selectedPairForDialog.info.websites.map(site => (
                            <li key={site.url}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{site.label || site.url} <ExternalLinkIcon className="inline h-3 w-3 ml-0.5"/></a></li>
                        ))}
                        </ul>
                    </div>
                )}

                {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                     <div className="mt-2">
                        <h4 className="font-semibold mb-1">Socials:</h4>
                         <ul className="list-disc list-inside pl-1 space-y-0.5">
                        {selectedPairForDialog.info.socials.map(social => social.url && (
                            <li key={social.url}><a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{social.platform || social.type || social.name} <ExternalLinkIcon className="inline h-3 w-3 ml-0.5"/></a></li>
                        ))}
                        </ul>
                    </div>
                )}

                {selectedPairForDialog.info?.description && (
                     <div className="mt-2">
                        <h4 className="font-semibold mb-1">Description:</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">{selectedPairForDialog.info.description}</p>
                    </div>
                )}

            </div>
            <DialogFooter className="pt-3">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default DexScreenerContent;