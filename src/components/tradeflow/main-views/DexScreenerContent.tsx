
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, PackageSearch, TrendingUp, ListFilter, ReceiptText, Layers, Search, Blocks, Users, Eye, Wallet, BarChartHorizontalBig } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { format, fromUnixTime } from 'date-fns';

type DexScreenerViewType = 
  | 'profiles' 
  | 'latestBoosts' 
  | 'topBoosts'
  | 'tokenOrders'
  | 'pairDetailsByPairAddress'
  | 'searchPairs'
  | 'tokenPairPools'
  | 'pairsByTokenAddresses';

type DexScreenerData = 
  | TokenProfileItem[] 
  | TokenBoostItem[] 
  | OrderInfoItem[] 
  | PairDataSchema 
  | PairDetail[] // For endpoints that return PairDetail[] directly
  | null; // For views that might return null on error/no input

// Helper function to format currency
const formatCurrency = (value?: number | string | null, precision = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}`;
};

// Helper function to format large numbers
const formatLargeNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
};

// Helper function to format date from Unix timestamp
const formatDateFromTimestamp = (timestamp?: number | null) => {
  if (timestamp === null || timestamp === undefined) return '-';
  try {
    return format(fromUnixTime(timestamp), 'MMM d, yyyy HH:mm');
  } catch (e) {
    console.error("Error formatting date from timestamp:", timestamp, e);
    return 'Invalid Date';
  }
};


const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Input states for new views
  const [inputChainId, setInputChainId] = useState<string>('solana');
  const [inputTokenAddress, setInputTokenAddress] = useState<string>('');
  const [inputPairAddress, setInputPairAddress] = useState<string>('');
  const [inputSearchQuery, setInputSearchQuery] = useState<string>('');
  const [inputCommaSeparatedTokenAddresses, setInputCommaSeparatedTokenAddresses] = useState<string>('');
  
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);
  const [isPairDetailDialogOpen, setIsPairDetailDialogOpen] = useState(false);


  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    setData(null); 

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
            toast({ title: "Input Required", description: "Chain ID and Token Address are required for Token Orders.", variant: "destructive" });
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
          setIsLoading(false); return;
      }

      if (view === 'profiles' || view === 'latestBoosts' || view === 'topBoosts') {
         if (result && !Array.isArray(result)) {
            setData([result as any] as TokenProfileItem[] | TokenBoostItem[]);
         } else {
            setData(result as TokenProfileItem[] | TokenBoostItem[] || []);
         }
      } else {
        setData(result);
      }

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
    // Fetch data only for views that don't require specific user input on initial load or view change
    if (['profiles', 'latestBoosts', 'topBoosts'].includes(selectedView)) {
      fetchDataForView(selectedView);
    } else {
      setData(null); // Clear data when switching to input-based views initially
      setIsLoading(false); // Stop loading for input-based views until fetch is triggered
    }
  }, [selectedView, fetchDataForView]);

  const handleCopy = (text: string, type: string = "Address") => {
    if (!navigator.clipboard) {
      toast({ title: "Copy Failed", description: "Clipboard API not available.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: `${type} copied to clipboard.` });
    }).catch(err => {
      console.error(`Failed to copy ${type}: `, err);
      toast({ title: "Copy Failed", description: `Could not copy ${type}.`, variant: "destructive"});
    });
  };

  const renderDescriptionInteraction = (description?: string | null) => {
    if (!description) return <span className="text-muted-foreground">-</span>;
    const truncatedDescription = description.length > 100 ? description.substring(0, 97) + "..." : description;
    return (
      <Popover>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button></PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-xs z-50 bg-popover text-popover-foreground p-2 rounded shadow-md text-xs"><p>{truncatedDescription}</p></TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm z-[51] bg-popover text-popover-foreground p-3 rounded shadow-lg" side="top" align="center">{description}</PopoverContent>
      </Popover>
    );
  };

  const renderLinksDropdown = (links?: DexLink[] | null) => {
    if (!links || links.length === 0) return <span className="text-muted-foreground">-</span>;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8">Links <LinkIcon className="ml-2 h-3 w-3" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto z-50">
          {links.map((link, index) => (
            <DropdownMenuItem key={index} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full">{link.label || link.type} <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" /></a>
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

  const handleFetchInputBasedView = () => {
    fetchDataForView(selectedView);
  };
  
  const openPairDetailDialog = (pair: PairDetail) => {
    setSelectedPairForDialog(pair);
    setIsPairDetailDialogOpen(true);
  };

  const renderTableHeaders = () => {
    switch (selectedView) {
      case 'profiles':
      case 'latestBoosts':
      case 'topBoosts':
        const isBoost = selectedView === 'latestBoosts' || selectedView === 'topBoosts';
        return (
          <TableRow>
            <TableHead className="w-[50px]">Icon</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead className="min-w-[150px]">Address</TableHead>
            {isBoost && <TableHead className="text-right">Boost Amt.</TableHead>}
            {isBoost && <TableHead className="text-right">Total Boost</TableHead>}
            <TableHead className="w-[60px] text-center">Info</TableHead>
            <TableHead className="w-[100px] text-center">Links</TableHead>
          </TableRow>
        );
      case 'tokenOrders':
        return (
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment Date</TableHead>
          </TableRow>
        );
      case 'pairDetailsByPairAddress':
      case 'searchPairs':
      case 'tokenPairPools':
      case 'pairsByTokenAddresses':
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
      default:
        return null;
    }
  };

  const renderTableRows = () => {
    if (!data) return null;

    switch (selectedView) {
      case 'profiles':
      case 'latestBoosts':
      case 'topBoosts':
        const items = data as (TokenProfileItem[] | TokenBoostItem[]);
        const isBoost = selectedView === 'latestBoosts' || selectedView === 'topBoosts';
        return items.map((item, index) => (
          <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`}>
            <TableCell>
              <Avatar className="h-8 w-8">
                <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.name || item.tokenAddress || 'Token icon'} />
                <AvatarFallback>{(item.name || item.symbol || item.tokenAddress || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </TableCell>
            <TableCell className="font-medium max-w-[150px] min-w-0">
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild><div className="truncate">{item.name || item.description || "Unknown Token"}</div></TooltipTrigger>
                <TooltipContent><p>{item.name || item.description || item.tokenAddress}</p></TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell>{item.symbol || 'N/A'}</TableCell>
            <TableCell>{item.chainId}</TableCell>
            <TableCell className="font-mono text-xs">
              <div className="flex items-center gap-1">
                <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => item.tokenAddress && handleCopy(item.tokenAddress, "Token Address")}>
                  <Copy className="h-3 w-3"/>
                </Button>
              </div>
            </TableCell>
            {isBoost && <TableCell className="text-right">{formatLargeNumber((item as TokenBoostItem).amount)}</TableCell>}
            {isBoost && <TableCell className="text-right">{formatLargeNumber((item as TokenBoostItem).totalAmount)}</TableCell>}
            <TableCell className="text-center">{renderDescriptionInteraction(item.description)}</TableCell>
            <TableCell className="text-center">{renderLinksDropdown(item.links)}</TableCell>
          </TableRow>
        ));

      case 'tokenOrders':
        const orders = data as OrderInfoItem[];
        return orders.map((order, index) => (
          <TableRow key={`${order.type}-${order.paymentTimestamp}-${index}`}>
            <TableCell>{order.type}</TableCell>
            <TableCell>{order.status}</TableCell>
            <TableCell>{formatDateFromTimestamp(order.paymentTimestamp)}</TableCell>
          </TableRow>
        ));

      case 'pairDetailsByPairAddress':
      case 'searchPairs':
      case 'tokenPairPools':
      case 'pairsByTokenAddresses':
        let pairsToRender: PairDetail[] = [];
        if (selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs') {
          pairsToRender = (data as PairDataSchema)?.pairs || [];
        } else if (selectedView === 'tokenPairPools' || selectedView === 'pairsByTokenAddresses') {
          pairsToRender = data as PairDetail[] || [];
        }
        
        return pairsToRender.map((pair) => (
          <TableRow key={pair.pairAddress}>
            <TableCell>
              <Avatar className="h-6 w-6">
                <AvatarImage src={pair.info?.imageUrl || pair.baseToken?.symbol /* fallback needed */} alt={pair.baseToken?.name || 'Pair icon'} />
                <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </TableCell>
            <TableCell>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                    <div className="truncate font-medium">{`${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`}</div>
                </TooltipTrigger>
                <TooltipContent><p>{`${pair.baseToken?.name}/${pair.quoteToken?.name}`}</p></TooltipContent>
              </Tooltip>
              <div className="text-xs text-muted-foreground truncate" title={pair.pairAddress}>{truncateAddress(pair.pairAddress)}</div>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(pair.priceUsd)}</TableCell>
            <TableCell className="text-right">{formatLargeNumber(pair.volume?.h24)}</TableCell>
            <TableCell className="text-right">{formatCurrency(pair.liquidity?.usd)}</TableCell>
            <TableCell>{pair.chainId}</TableCell>
            <TableCell>{pair.dexId}</TableCell>
            <TableCell className="text-center">
              <Button variant="outline" size="sm" onClick={() => openPairDetailDialog(pair)}>
                <Eye className="mr-2 h-4 w-4" /> View
              </Button>
            </TableCell>
          </TableRow>
        ));
      default:
        return null;
    }
  };

  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <PackageSearch className="mr-2 h-4 w-4" /> },
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Pools', icon: <Blocks className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <Wallet className="mr-2 h-4 w-4" /> },
  ];
  
  const needsChainIdInput = ['tokenOrders', 'pairDetailsByPairAddress', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView);
  const needsTokenAddressInput = ['tokenOrders', 'tokenPairPools'].includes(selectedView);
  const needsPairAddressInput = selectedView === 'pairDetailsByPairAddress';
  const needsSearchQueryInput = selectedView === 'searchPairs';
  const needsCommaSeparatedTokenAddressesInput = selectedView === 'pairsByTokenAddresses';
  const isInputBasedView = needsChainIdInput || needsPairAddressInput || needsSearchQueryInput || needsCommaSeparatedTokenAddressesInput;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChartHorizontalBig className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">DEX Screener Tools</CardTitle>
        </div>
        <RadioGroup
            value={selectedView}
            onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3"
          >
            {viewOptions.map(opt => (
              <Label key={opt.value} htmlFor={opt.value} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground cursor-pointer transition-colors text-sm">
                <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                {opt.icon}
                <span>{opt.label}</span>
              </Label>
            ))}
        </RadioGroup>

        {isInputBasedView && (
          <div className="pt-3 mt-3 border-t space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              {needsChainIdInput && (
                <div className="space-y-1">
                  <Label htmlFor="chainIdInput" className="text-xs">Chain ID</Label>
                  <Input id="chainIdInput" placeholder="e.g., solana, eth" value={inputChainId} onChange={(e) => setInputChainId(e.target.value)} />
                </div>
              )}
              {needsTokenAddressInput && (
                <div className="space-y-1">
                  <Label htmlFor="tokenAddressInput" className="text-xs">Token Address</Label>
                  <Input id="tokenAddressInput" placeholder="Token address" value={inputTokenAddress} onChange={(e) => setInputTokenAddress(e.target.value)} />
                </div>
              )}
              {needsPairAddressInput && (
                <div className="space-y-1">
                  <Label htmlFor="pairAddressInput" className="text-xs">Pair Address</Label>
                  <Input id="pairAddressInput" placeholder="Pair address" value={inputPairAddress} onChange={(e) => setInputPairAddress(e.target.value)} />
                </div>
              )}
              {needsSearchQueryInput && (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="searchQueryInput" className="text-xs">Search Query</Label>
                  <Input id="searchQueryInput" placeholder="e.g., SOL/USDC, WIF" value={inputSearchQuery} onChange={(e) => setInputSearchQuery(e.target.value)} />
                </div>
              )}
              {needsCommaSeparatedTokenAddressesInput && (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="multiTokenAddressInput" className="text-xs">Token Addresses (comma-separated)</Label>
                  <Input id="multiTokenAddressInput" placeholder="Addr1,Addr2,..." value={inputCommaSeparatedTokenAddresses} onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)} />
                </div>
              )}
              <Button onClick={handleFetchInputBasedView} className="w-full lg:w-auto" disabled={isLoading}>
                {isLoading ? 'Fetching...' : 'Fetch View Data'}
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/10">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-semibold">Error Loading Data</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-4">Retry</Button>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && data && 'pairs' in data && (data as PairDataSchema).pairs.length === 0) ) ? (
           <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No data available for this view. {isInputBasedView ? 'Try fetching with valid inputs.' : ''}</p>
          </div>
        ) : (
          <Table>
            <TableCaption>
              {selectedView === 'profiles' && 'Latest token profiles.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens.'}
              {selectedView === 'topBoosts' && 'Tokens with most active boosts.'}
              {selectedView === 'tokenOrders' && `Orders for token ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairDetailsByPairAddress' && `Details for pair ${inputPairAddress} on ${inputChainId}.`}
              {selectedView === 'searchPairs' && `Search results for "${inputSearchQuery}".`}
              {selectedView === 'tokenPairPools' && `Pools for token ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairsByTokenAddresses' && `Pairs for token(s) on ${inputChainId}.`}
            </TableCaption>
            <TableHeader>{renderTableHeaders()}</TableHeader>
            <TableBody>{renderTableRows()}</TableBody>
          </Table>
        )}
      </CardContent>

      {selectedPairForDialog && (
        <Dialog open={isPairDetailDialogOpen} onOpenChange={setIsPairDetailDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {selectedPairForDialog.info?.imageUrl && (
                  <Avatar className="h-7 w-7 mr-2">
                    <AvatarImage src={selectedPairForDialog.info.imageUrl} alt={`${selectedPairForDialog.baseToken.name} icon`} />
                    <AvatarFallback>{selectedPairForDialog.baseToken.symbol.substring(0,1)}</AvatarFallback>
                  </Avatar>
                )}
                Pair Details: {selectedPairForDialog.baseToken.symbol}/{selectedPairForDialog.quoteToken.symbol}
              </DialogTitle>
              <DialogDescription>
                {selectedPairForDialog.pairAddress} on {selectedPairForDialog.chainId} (DEX: {selectedPairForDialog.dexId})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4 overflow-y-auto px-1 flex-grow">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><strong>Price (USD):</strong> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                <div><strong>Price (Native):</strong> {selectedPairForDialog.priceNative}</div>
                <div><strong>FDV:</strong> {formatCurrency(selectedPairForDialog.fdv)}</div>
                <div><strong>Market Cap:</strong> {formatCurrency(selectedPairForDialog.marketCap)}</div>
                <div><strong>Liquidity (USD):</strong> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</div>
                <div><strong>Created:</strong> {formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</div>
              </div>

              {selectedPairForDialog.txns && (
                <div>
                  <h4 className="font-semibold mt-2 mb-1 text-md">Transactions:</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(selectedPairForDialog.txns).map(([period, details]) => (
                      <div key={period}><strong>{period}:</strong> Buys: {details.buys}, Sells: {details.sells}</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPairForDialog.volume && (
                 <div>
                  <h4 className="font-semibold mt-2 mb-1 text-md">Volume:</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(selectedPairForDialog.volume).map(([period, vol]) => (
                      <div key={period}><strong>{period}:</strong> {formatCurrency(vol)}</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPairForDialog.priceChange && (
                <div>
                  <h4 className="font-semibold mt-2 mb-1 text-md">Price Change (%):</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(selectedPairForDialog.priceChange).map(([period, change]) => (
                      <div key={period}><strong>{period}:</strong> {change.toFixed(2)}%</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                <div>
                  <h4 className="font-semibold mt-2 mb-1 text-md">Websites:</h4>
                  <ul className="list-disc list-inside text-xs">
                    {selectedPairForDialog.info.websites.map(site => <li key={site.url}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{site.url}</a></li>)}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                <div>
                  <h4 className="font-semibold mt-2 mb-1 text-md">Socials:</h4>
                   <ul className="list-disc list-inside text-xs">
                    {selectedPairForDialog.info.socials.map(social => <li key={social.url || social.handle}>{social.name || social.platform}: {social.url ? <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{social.handle || social.url}</a> : social.handle}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter className="pt-2 border-t">
              <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default DexScreenerContent;