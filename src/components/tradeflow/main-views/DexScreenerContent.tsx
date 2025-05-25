
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchLatestTokenProfiles,
  fetchLatestBoostedTokens,
  fetchTopBoostedTokens,
  // Import new actions
  fetchTokenOrders,
  fetchPairDetailsByPairAddress,
  searchPairs,
  fetchTokenPairPools,
  fetchPairsByTokenAddresses,
} from '@/app/actions/dexScreenerActions';
import type { TokenProfileItem, TokenBoostItem, DexLink, OrderInfoItem, PairData, PairDetail } from '@/types'; // Ensure all types are imported
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Import Input
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode,
  PackageSearch, TrendingUp, ListFilter, // Icons for original views
  ReceiptText, Layers, Search, Network, ListCollapse, Eye // Icons for new views
} from 'lucide-react';
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

// Extend DexScreenerData to include new types
type DexScreenerData = 
  | TokenProfileItem[] 
  | TokenBoostItem[] 
  | OrderInfoItem[] 
  | PairData // Use PairData (which is object or null) instead of PairData[]
  | PairDetail[]
  | null; // Allow null for views like pairDetailsByPairAddress or searchPairs if no data

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>([]); // Default to empty array for initial views
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Input states for new views
  const [inputChainId, setInputChainId] = useState<string>('solana'); // Default to solana
  const [inputTokenAddress, setInputTokenAddress] = useState<string>('');
  const [inputPairAddress, setInputPairAddress] = useState<string>('');
  const [inputSearchQuery, setInputSearchQuery] = useState<string>('');
  const [inputCommaSeparatedTokenAddresses, setInputCommaSeparatedTokenAddresses] = useState<string>('');

  // State for Pair Detail Dialog
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);
  const [isPairDetailDialogOpen, setIsPairDetailDialogOpen] = useState(false);

  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    setData(null); // Reset data to null for all views initially

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
          toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchTokenOrders(inputChainId, inputTokenAddress);
      } else if (view === 'pairDetailsByPairAddress') {
        if (!inputChainId || !inputPairAddress) {
          toast({ title: "Input Required", description: "Chain ID and Pair Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchPairDetailsByPairAddress(inputChainId, inputPairAddress);
      } else if (view === 'searchPairs') {
        if (!inputSearchQuery) {
          toast({ title: "Input Required", description: "Search query is required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await searchPairs(inputSearchQuery);
      } else if (view === 'tokenPairPools') {
         if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchTokenPairPools(inputChainId, inputTokenAddress);
      } else if (view === 'pairsByTokenAddresses') {
        if (!inputChainId || !inputCommaSeparatedTokenAddresses) {
          toast({ title: "Input Required", description: "Chain ID and Token Addresses are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchPairsByTokenAddresses(inputChainId, inputCommaSeparatedTokenAddresses);
      }

      // For initial 3 views, they expect an array. Our actions wrap single objects.
      if (view === 'profiles' || view === 'latestBoosts' || view === 'topBoosts') {
        // The server actions for these already wrap the single object response in an array.
        setData(result as TokenProfileItem[] | TokenBoostItem[] || []);
      } else {
         setData(result); // For new views, data can be object or array
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
    if (['profiles', 'latestBoosts', 'topBoosts'].includes(selectedView)) {
      fetchDataForView(selectedView);
    } else {
      setData(null);
      setIsLoading(false); 
    }
  }, [selectedView, fetchDataForView]);

  const handleFetchNewViewData = () => {
    fetchDataForView(selectedView);
  };
  
  const handleOpenPairDetailDialog = (pair: PairDetail) => {
    setSelectedPairForDialog(pair);
    setIsPairDetailDialogOpen(true);
  };

  const handleCopyAddress = (address: string) => {
    if (!navigator.clipboard) {
      toast({ title: "Copy Failed", description: "Clipboard API not available in this browser.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(address).then(() => {
      toast({ title: "Copied!", description: "Address copied to clipboard." });
    }).catch(err => {
      console.error("Failed to copy address: ", err);
      toast({ title: "Copy Failed", description: "Could not copy address.", variant: "destructive"});
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
                {link.label || link.type} <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" />
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

  // Helper Functions for Pair Data
  const formatCurrency = (value?: number | string | null, maximumFractionDigits = 2) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits })}`;
  };

  const formatLargeNumber = (value?: number | string | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toLocaleString();
  };
  
  const formatDateFromTimestamp = (timestamp?: number | null) => {
    if (!timestamp) return '-';
    try {
      return format(new Date(timestamp * 1000), 'MMM d, yyyy HH:mm');
    } catch {
      return '-';
    }
  };

  const getPairsArray = (currentData: DexScreenerData, viewType: DexScreenerViewType): PairDetail[] => {
    if (!currentData) return [];
    if ( (viewType === 'pairDetailsByPairAddress' || viewType === 'searchPairs') && currentData && typeof currentData === 'object' && 'pairs' in (currentData as PairData) ) {
      return (currentData as PairData).pairs || [];
    }
    if ( (viewType === 'tokenPairPools' || viewType === 'pairsByTokenAddresses') && Array.isArray(currentData) ) {
      if (currentData.length > 0 && 'pairAddress' in currentData[0]) {
        return currentData as PairDetail[];
      }
    }
    return [];
  };

  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <PackageSearch className="mr-2 h-4 w-4" /> },
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Pair Pools', icon: <Network className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <ListCollapse className="mr-2 h-4 w-4" /> },
  ];

  const needsChainIdInput = ['tokenOrders', 'pairDetailsByPairAddress', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView);
  const needsTokenAddressInputForOrdersOrPools = ['tokenOrders', 'tokenPairPools'].includes(selectedView);
  const needsPairAddressInput = selectedView === 'pairDetailsByPairAddress';
  const needsSearchQueryInput = selectedView === 'searchPairs';
  const needsCommaSeparatedTokenAddressesInput = selectedView === 'pairsByTokenAddresses';
  
  const showFetchButton = needsChainIdInput || needsTokenAddressInputForOrdersOrPools || needsPairAddressInput || needsSearchQueryInput || needsCommaSeparatedTokenAddressesInput;

  const renderInputs = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 border-b mb-4 items-end">
      {needsChainIdInput && (
        <div className="space-y-1">
          <Label htmlFor="chainIdInput" className="text-xs">Chain ID (e.g., solana, eth)</Label>
          <Input id="chainIdInput" placeholder="solana" value={inputChainId} onChange={(e) => setInputChainId(e.target.value.toLowerCase())} className="h-9"/>
        </div>
      )}
      {needsTokenAddressInputForOrdersOrPools && (
         <div className="space-y-1">
          <Label htmlFor="tokenAddressInput" className="text-xs">Token Address</Label>
          <Input id="tokenAddressInput" placeholder="Token Address" value={inputTokenAddress} onChange={(e) => setInputTokenAddress(e.target.value)} className="h-9"/>
        </div>
      )}
      {needsPairAddressInput && (
         <div className="space-y-1">
          <Label htmlFor="pairAddressInput" className="text-xs">Pair Address</Label>
          <Input id="pairAddressInput" placeholder="Pair Address" value={inputPairAddress} onChange={(e) => setInputPairAddress(e.target.value)} className="h-9"/>
        </div>
      )}
      {needsSearchQueryInput && (
        <div className="space-y-1">
          <Label htmlFor="searchInput" className="text-xs">Search Query (e.g., BTC/USDC)</Label>
          <Input id="searchInput" placeholder="SOL/USDC or Token Address" value={inputSearchQuery} onChange={(e) => setInputSearchQuery(e.target.value)} className="h-9"/>
        </div>
      )}
      {needsCommaSeparatedTokenAddressesInput && (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="multiTokenAddressInput" className="text-xs">Token Addresses (comma-separated)</Label>
          <Input id="multiTokenAddressInput" placeholder="Addr1,Addr2,..." value={inputCommaSeparatedTokenAddresses} onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)} className="h-9"/>
        </div>
      )}
      {showFetchButton && (
        <Button onClick={handleFetchNewViewData} disabled={isLoading} className="h-9 self-end md:col-start-3">
          {isLoading ? 'Fetching...' : 'Fetch View Data'}
        </Button>
      )}
    </div>
  );
  
  const isOriginalThreeViews = ['profiles', 'latestBoosts', 'topBoosts'].includes(selectedView);

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
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {viewOptions.map(opt => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={opt.value} />
              <Label htmlFor={opt.value} className="cursor-pointer font-normal text-sm flex items-center">
                {opt.icon} {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardHeader>

      {showFetchButton && renderInputs()}

      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-semibold">Error loading data</p>
            <p className="text-muted-foreground text-sm text-center">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-4">Retry</Button>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0 && isOriginalThreeViews) || (typeof data === 'object' && data !== null && 'pairs' in data && !(data as PairData).pairs?.length && !isOriginalThreeViews) || (data === null && !isOriginalThreeViews) ) ? (
           <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No data available for this view or inputs.</p>
          </div>
        ) : (
          <>
            {/* Table for Original 3 Views (Profiles, Latest Boosts, Top Boosts) */}
            {isOriginalThreeViews && Array.isArray(data) && (
              <Table>
                <TableCaption>
                  {selectedView === 'profiles' && 'Latest token profiles from DEX Screener API.'}
                  {selectedView === 'latestBoosts' && 'Latest boosted tokens from DEX Screener API.'}
                  {selectedView === 'topBoosts' && 'Tokens with the most active boosts from DEX Screener API.'}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] px-2 py-2">Icon</TableHead>
                    <TableHead className="px-2 py-2">Name</TableHead>
                    <TableHead className="px-2 py-2">Chain</TableHead>
                    <TableHead className="min-w-[150px] px-2 py-2">Address</TableHead>
                    {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <TableHead className="text-right px-2 py-2">Boost Amt.</TableHead>}
                    {selectedView === 'latestBoosts' && <TableHead className="text-right px-2 py-2">Total Boost</TableHead>}
                    <TableHead className="w-[60px] text-center px-2 py-2">Info</TableHead>
                    <TableHead className="w-[100px] text-center px-2 py-2">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data as Array<TokenProfileItem | TokenBoostItem>).map((item, index) => (
                    <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`}>
                      <TableCell className="px-2 py-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.name || item.description || item.tokenAddress || 'Token icon'} />
                          <AvatarFallback>{(item.name || item.description || item.tokenAddress || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium max-w-[150px] min-w-0 px-2 py-2">
                         <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <div className="truncate" title={item.name || item.description || item.tokenAddress || "Unknown Token"}>
                                    {item.name || item.description || item.tokenAddress || "Unknown Token"}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs bg-popover text-popover-foreground p-2 rounded shadow-md text-xs">
                                <p>{item.name || item.description || item.tokenAddress || "Unknown Token"}</p>
                            </TooltipContent>
                         </Tooltip>
                      </TableCell>
                      <TableCell className="px-2 py-2">{item.chainId}</TableCell>
                      <TableCell className="font-mono text-xs px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button>
                        </div>
                      </TableCell>
                      {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (
                        <TableCell className="text-right px-2 py-2">{(item as TokenBoostItem).amount?.toLocaleString() ?? '-'}</TableCell>
                      )}
                      {selectedView === 'latestBoosts' && (
                         <TableCell className="text-right px-2 py-2">{(item as TokenBoostItem).totalAmount?.toLocaleString() ?? '-'}</TableCell>
                      )}
                      <TableCell className="text-center px-2 py-2">{renderDescriptionInteraction(item.description)}</TableCell>
                      <TableCell className="text-center px-2 py-2">{renderLinksDropdown(item.links)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Table for Token Orders */}
            {selectedView === 'tokenOrders' && Array.isArray(data) && (
              <Table>
                <TableCaption>Token order information.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-2 py-2">Type</TableHead>
                    <TableHead className="px-2 py-2">Status</TableHead>
                    <TableHead className="text-right px-2 py-2">Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data as OrderInfoItem[]).map((order, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-2 py-2">{order.type}</TableCell>
                      <TableCell className="px-2 py-2">{order.status}</TableCell>
                      <TableCell className="text-right px-2 py-2">{formatDateFromTimestamp(order.paymentTimestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {/* Table for Pair-Related Views */}
            {['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView) && (
              <Table>
                <TableCaption>Pair information from DEX Screener API.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] px-2 py-2">Icon</TableHead>
                    <TableHead className="px-2 py-2">Pair</TableHead>
                    <TableHead className="px-2 py-2">Chain</TableHead>
                    <TableHead className="px-2 py-2">DEX</TableHead>
                    <TableHead className="text-right px-2 py-2">Price USD</TableHead>
                    <TableHead className="text-right px-2 py-2">Volume (24h)</TableHead>
                    <TableHead className="text-right px-2 py-2">Liquidity</TableHead>
                    <TableHead className="text-center px-2 py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPairsArray(data, selectedView).map((pair) => (
                    <TableRow key={pair.pairAddress}>
                      <TableCell className="px-2 py-2">
                        <Avatar className="h-6 w-6">
                           <AvatarImage 
                            src={pair.info?.imageUrl || `https://placehold.co/24x24.png`} 
                            alt={pair.baseToken?.name || pair.pairAddress}
                          />
                          <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium px-2 py-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate max-w-[150px]">
                              {pair.baseToken?.name || pair.baseToken?.symbol} / {pair.quoteToken?.name || pair.quoteToken?.symbol}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{pair.baseToken?.name} ({pair.baseToken?.symbol}) / {pair.quoteToken?.name} ({pair.quoteToken?.symbol})</p>
                            <p className="text-xs text-muted-foreground">{pair.pairAddress}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-2 py-2">{pair.chainId}</TableCell>
                      <TableCell className="px-2 py-2">{pair.dexId}</TableCell>
                      <TableCell className="text-right px-2 py-2">{formatCurrency(pair.priceUsd)}</TableCell>
                      <TableCell className="text-right px-2 py-2">{formatLargeNumber(pair.volume?.h24)}</TableCell>
                      <TableCell className="text-right px-2 py-2">{formatCurrency(pair.liquidity?.usd)}</TableCell>
                      <TableCell className="text-center px-2 py-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenPairDetailDialog(pair)} className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>

      {selectedPairForDialog && (
        <Dialog open={isPairDetailDialogOpen} onOpenChange={setIsPairDetailDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {selectedPairForDialog.info?.imageUrl && (
                  <Image 
                    src={selectedPairForDialog.info.imageUrl} 
                    alt={`${selectedPairForDialog.baseToken?.name || 'Token'} Logo`} 
                    width={32} height={32} className="rounded-full mr-2" 
                    data-ai-hint="token logo"
                  />
                )}
                {selectedPairForDialog.baseToken?.name} ({selectedPairForDialog.baseToken?.symbol}) / {selectedPairForDialog.quoteToken?.name} ({selectedPairForDialog.quoteToken?.symbol})
              </DialogTitle>
              <DialogDescription>
                Pair Address: {truncateAddress(selectedPairForDialog.pairAddress, 10, 10)} 
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => selectedPairForDialog.pairAddress && handleCopyAddress(selectedPairForDialog.pairAddress)}>
                    <Copy className="h-3 w-3"/>
                </Button>
                 <br/>
                Chain: {selectedPairForDialog.chainId} | DEX: {selectedPairForDialog.dexId}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="font-semibold">Price USD:</span> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                <div><span className="font-semibold">Price Native:</span> {selectedPairForDialog.priceNative}</div>
                <div><span className="font-semibold">Market Cap:</span> {formatLargeNumber(selectedPairForDialog.marketCap)}</div>
                <div><span className="font-semibold">FDV:</span> {formatLargeNumber(selectedPairForDialog.fdv)}</div>
                <div><span className="font-semibold">Liquidity:</span> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</div>
                <div><span className="font-semibold">Created:</span> {formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</div>
              </div>

              {selectedPairForDialog.txns && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Transactions:</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {(['m5', 'h1', 'h6', 'h24'] as const).map(tf => selectedPairForDialog.txns?.[tf] && (
                      <div key={tf}>
                        <span className="font-medium uppercase">{tf}:</span> Buys: {selectedPairForDialog.txns[tf]?.buys ?? '-'}, Sells: {selectedPairForDialog.txns[tf]?.sells ?? '-'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPairForDialog.volume && (
                 <div>
                  <h4 className="font-semibold text-sm mb-1">Volume:</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                     {(['m5', 'h1', 'h6', 'h24'] as const).map(tf => selectedPairForDialog.volume?.[tf] !== undefined && (
                      <div key={tf}><span className="font-medium uppercase">{tf}:</span> {formatCurrency(selectedPairForDialog.volume[tf])}</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPairForDialog.priceChange && (
                 <div>
                  <h4 className="font-semibold text-sm mb-1">Price Change (%):</h4>
                   <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {(['m5', 'h1', 'h6', 'h24'] as const).map(tf => selectedPairForDialog.priceChange?.[tf] !== undefined && (
                      <div key={tf}><span className="font-medium uppercase">{tf}:</span> {selectedPairForDialog.priceChange[tf]?.toFixed(2)}%</div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPairForDialog.info?.description && (
                 <div>
                  <h4 className="font-semibold text-sm mb-1">Description:</h4>
                  <p className="text-xs text-muted-foreground">{selectedPairForDialog.info.description}</p>
                </div>
              )}
              
              {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Websites:</h4>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {selectedPairForDialog.info.websites.map((site, i) => (
                      <li key={i}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">{site.label || site.url} <ExternalLink className="h-3 w-3 ml-1"/></a></li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                 <div>
                  <h4 className="font-semibold text-sm mb-1">Socials:</h4>
                   <ul className="list-disc list-inside text-xs space-y-1">
                    {selectedPairForDialog.info.socials.map((social, i) => (
                      <li key={i}><a href={social.url || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">{social.platform || social.type || 'Link'} {social.handle && `(@${social.handle})`} <ExternalLink className="h-3 w-3 ml-1"/></a></li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
            <DialogFooter className="pt-2">
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