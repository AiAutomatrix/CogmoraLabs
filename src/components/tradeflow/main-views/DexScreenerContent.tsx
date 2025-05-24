
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, 
  PackageSearch, TrendingUp, ListFilter, Layers, Search, Network, Users, Eye, ReceiptText, BarChartBig, CalendarClock, Zap
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns'; // For date formatting

type DexScreenerViewType = 
  | 'profiles' 
  | 'latestBoosts' 
  | 'topBoosts'
  | 'tokenOrders'
  | 'pairDetailsByPairAddress'
  | 'searchPairs'
  | 'tokenPairPools'
  | 'pairsByTokenAddresses';

// Update DexScreenerData to include new types
type DexScreenerData = TokenProfileItem[] | TokenBoostItem[] | OrderInfoItem[] | PairData | PairDetail[] | null;


const DexScreenerContent: React.FC = () => {
  // Existing state
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>([]); // Updated type
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // New input states for new views
  const [inputChainId, setInputChainId] = useState<string>('solana');
  const [inputTokenAddress, setInputTokenAddress] = useState<string>('');
  const [inputPairAddress, setInputPairAddress] = useState<string>('');
  const [inputSearchQuery, setInputSearchQuery] = useState<string>('');
  const [inputCommaSeparatedTokenAddresses, setInputCommaSeparatedTokenAddresses] = useState<string>('');

  // State for Pair Detail Dialog
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);
  const [isPairDetailDialogOpen, setIsPairDetailDialogOpen] = useState(false);


  const fetchDataForView = useCallback(async (view?: DexScreenerViewType) => {
    const currentView = view || selectedView;
    setIsLoading(true);
    setError(null);
    setData(null); // Clear previous data
    try {
      let result: DexScreenerData = [];
      if (currentView === 'profiles') {
        result = await fetchLatestTokenProfiles();
      } else if (currentView === 'latestBoosts') {
        result = await fetchLatestBoostedTokens();
      } else if (currentView === 'topBoosts') {
        result = await fetchTopBoostedTokens();
      } else if (currentView === 'tokenOrders') {
        if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchTokenOrders(inputChainId, inputTokenAddress);
      } else if (currentView === 'pairDetailsByPairAddress') {
        if (!inputChainId || !inputPairAddress) {
          toast({ title: "Input Required", description: "Chain ID and Pair Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchPairDetailsByPairAddress(inputChainId, inputPairAddress);
      } else if (currentView === 'searchPairs') {
        if (!inputSearchQuery) {
          toast({ title: "Input Required", description: "Search query is required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await searchPairs(inputSearchQuery);
      } else if (currentView === 'tokenPairPools') {
         if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchTokenPairPools(inputChainId, inputTokenAddress);
      } else if (currentView === 'pairsByTokenAddresses') {
         if (!inputChainId || !inputCommaSeparatedTokenAddresses) {
          toast({ title: "Input Required", description: "Chain ID and Token Addresses are required.", variant: "destructive" });
          setIsLoading(false); return;
        }
        result = await fetchPairsByTokenAddresses(inputChainId, inputCommaSeparatedTokenAddresses);
      }

      // Adjusting data setting logic based on expected response types
      if (['profiles', 'latestBoosts', 'topBoosts'].includes(currentView)) {
         setData(result as TokenProfileItem[] | TokenBoostItem[] || []);
      } else if (['tokenOrders', 'tokenPairPools', 'pairsByTokenAddresses'].includes(currentView)) {
        setData(result as OrderInfoItem[] | PairDetail[] || []);
      } else if (['pairDetailsByPairAddress', 'searchPairs'].includes(currentView)) {
        setData(result as PairData | null); // This is correct, it's an object possibly containing a 'pairs' array, or null
      } else {
        setData([]); 
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(`Failed to fetch ${currentView}:`, err);
      toast({
        title: "API Error",
        description: `Could not fetch data for ${currentView}. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedView, inputChainId, inputTokenAddress, inputPairAddress, inputSearchQuery, inputCommaSeparatedTokenAddresses]);

  useEffect(() => {
    if (['profiles', 'latestBoosts', 'topBoosts'].includes(selectedView)) {
        fetchDataForView(selectedView);
    }
    // For other views, fetch is triggered by button click after inputs are provided
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
          <TooltipContent side="top" align="center" className="max-w-xs z-50 bg-popover text-popover-foreground p-2 rounded shadow-md text-xs"><p>{truncatedDescription}</p></TooltipContent>
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
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8">Links <LinkIcon className="ml-2 h-3 w-3" /></Button></DropdownMenuTrigger>
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

  const formatCurrency = (value?: number | string | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    return format(new Date(timestamp * 1000), 'PP pp'); // Convert seconds to milliseconds
  };

  const getPairsArray = (rawData: DexScreenerData, viewType: DexScreenerViewType): PairDetail[] => {
    if (!rawData) return [];
    if (viewType === 'pairDetailsByPairAddress' || viewType === 'searchPairs') {
      // These views return PairData, which has a 'pairs' array
      return (rawData as PairData)?.pairs || [];
    }
    if (viewType === 'tokenPairPools' || viewType === 'pairsByTokenAddresses') {
      // These views return PairDetail[] directly
      return rawData as PairDetail[];
    }
    return []; // Default for other views if they somehow call this
  };
  
  const openPairDetailDialog = (pair: PairDetail) => {
    setSelectedPairForDialog(pair);
    setIsPairDetailDialogOpen(true);
  };

  const renderInputSection = () => {
    const needsChainAndToken = ['tokenOrders', 'tokenPairPools'].includes(selectedView);
    const needsChainAndPair = selectedView === 'pairDetailsByPairAddress';
    const needsSearchQuery = selectedView === 'searchPairs';
    const needsChainAndTokens = selectedView === 'pairsByTokenAddresses';

    if (!needsChainAndToken && !needsChainAndPair && !needsSearchQuery && !needsChainAndTokens) {
      return null;
    }

    return (
      <div className="p-4 border-t border-border bg-card space-y-3 mt-3">
        {(needsChainAndToken || needsChainAndPair || needsChainAndTokens) && (
          <Input
            placeholder="Chain ID (e.g., solana)"
            value={inputChainId}
            onChange={(e) => setInputChainId(e.target.value.toLowerCase())}
            className="h-9 text-sm"
          />
        )}
        {(needsChainAndToken) && (
          <Input
            placeholder="Token Address"
            value={inputTokenAddress}
            onChange={(e) => setInputTokenAddress(e.target.value)}
            className="h-9 text-sm"
          />
        )}
        {(needsChainAndPair) && (
          <Input
            placeholder="Pair Address"
            value={inputPairAddress}
            onChange={(e) => setInputPairAddress(e.target.value)}
            className="h-9 text-sm"
          />
        )}
        {needsSearchQuery && (
          <Input
            placeholder="Search Query (e.g., ETH/USDC)"
            value={inputSearchQuery}
            onChange={(e) => setInputSearchQuery(e.target.value)}
            className="h-9 text-sm"
          />
        )}
        {needsChainAndTokens && (
          <Input
            placeholder="Token Addresses (comma-separated)"
            value={inputCommaSeparatedTokenAddresses}
            onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)}
            className="h-9 text-sm"
          />
        )}
        <Button onClick={() => fetchDataForView()} className="w-full sm:w-auto h-9">Fetch View Data</Button>
      </div>
    );
  };
  
  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <PackageSearch className="mr-2 h-4 w-4" /> },
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Pools', icon: <Network className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <Users className="mr-2 h-4 w-4" /> },
  ];

  const isBoostView = selectedView === 'latestBoosts' || selectedView === 'topBoosts';

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl font-semibold">DEX Screener Deluxe</CardTitle>
        </div>
        <RadioGroup
          value={selectedView}
          onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
        >
          {viewOptions.map(opt => (
            <Label 
              key={opt.value} 
              htmlFor={opt.value} 
              className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors
                          ${selectedView === opt.value ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background' : 'bg-card hover:bg-muted'}`}
            >
              <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
              {opt.icon}
              <span className="text-xs sm:text-sm">{opt.label}</span>
            </Label>
          ))}
        </RadioGroup>
        {renderInputSection()}
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-1 sm:p-2 bg-muted/10">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-lg font-semibold text-destructive">Error Loading Data</p>
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-2">Retry</Button>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && data !== null && 'pairs' in data && (data as PairData).pairs && (data as PairData).pairs.length === 0 && (selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs'))) ? (
           <div className="flex items-center justify-center h-full p-4">
            <p className="text-muted-foreground text-lg">No data available for this view or parameters.</p>
          </div>
        ) : (
          <Table className="min-w-full text-xs">
            <TableCaption className="py-2 text-xs">
              {/* Table captions for ALL views */}
              {selectedView === 'profiles' && 'Latest token profiles from DEX Screener.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens from DEX Screener.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts from DEX Screener.'}
              {selectedView === 'tokenOrders' && `Token order history for ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairDetailsByPairAddress' && `Details for pair ${inputPairAddress} on ${inputChainId}.`}
              {selectedView === 'searchPairs' && `Search results for "${inputSearchQuery}".`}
              {selectedView === 'tokenPairPools' && `Pools for token ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairsByTokenAddresses' && `Pairs for tokens on ${inputChainId}.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {/* Conditional Headers based on selectedView */}
                {(selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (
                  <>
                    <TableHead className="w-[50px] px-2 py-2">Icon</TableHead>
                    <TableHead className="px-2 py-2">Name</TableHead>
                    <TableHead className="px-2 py-2">Chain</TableHead>
                    <TableHead className="min-w-[150px] px-2 py-2">Address</TableHead>
                    {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <TableHead className="text-right px-2 py-2">Boost Amt.</TableHead>}
                    {selectedView === 'latestBoosts' && <TableHead className="text-right px-2 py-2">Total Boost</TableHead>}
                    <TableHead className="w-[60px] text-center px-2 py-2">Info</TableHead>
                    <TableHead className="w-[100px] text-center px-2 py-2">Links</TableHead>
                  </>
                )}
                {selectedView === 'tokenOrders' && (
                  <>
                    <TableHead className="px-2 py-2">Type</TableHead>
                    <TableHead className="px-2 py-2">Status</TableHead>
                    <TableHead className="px-2 py-2">Payment Date</TableHead>
                  </>
                )}
                {(['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) && (
                  <>
                    <TableHead className="w-[40px] px-1 py-2">Icon</TableHead>
                    <TableHead className="px-2 py-2">Pair</TableHead>
                    <TableHead className="text-right px-2 py-2">Price (USD)</TableHead>
                    <TableHead className="text-right px-2 py-2">Volume (24h)</TableHead>
                    <TableHead className="text-right px-2 py-2">Liquidity (USD)</TableHead>
                    <TableHead className="px-2 py-2">Chain</TableHead>
                    <TableHead className="px-2 py-2">DEX</TableHead>
                    <TableHead className="w-[80px] text-center px-2 py-2">Actions</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Rows for Profiles and Boosts */}
              {(selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') && Array.isArray(data) && (data as (TokenProfileItem | TokenBoostItem)[]).map((item, index) => (
                <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`} className="text-xs">
                  <TableCell className="px-2 py-1.5">
                    <Avatar className="h-7 w-7">
                        <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.name || item.description || 'Token icon'} />
                        <AvatarFallback>{(item.name || item.description || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] min-w-0 px-2 py-1.5">
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="truncate" title={item.name || item.description || item.tokenAddress || "Unknown Token"}>
                                {item.name || item.description || item.tokenAddress || "Unknown Token"}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{item.name || item.description || item.tokenAddress || "Unknown Token"}</p></TooltipContent>
                     </Tooltip>
                  </TableCell>
                  <TableCell className="px-2 py-1.5">{item.chainId}</TableCell>
                  <TableCell className="font-mono text-xs px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button>
                    </div>
                  </TableCell>
                  {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (
                    <TableCell className="text-right px-2 py-1.5">
                      {(item as TokenBoostItem).amount?.toLocaleString() ?? '-'}
                    </TableCell>
                  )}
                  {selectedView === 'latestBoosts' && (
                    <TableCell className="text-right px-2 py-1.5">
                      {(item as TokenBoostItem).totalAmount?.toLocaleString() ?? '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-center px-2 py-1.5">{renderDescriptionInteraction(item.description)}</TableCell>
                  <TableCell className="text-center px-2 py-1.5">{renderLinksDropdown(item.links)}</TableCell>
                </TableRow>
              ))}
              {/* Rows for Token Orders */}
              {selectedView === 'tokenOrders' && Array.isArray(data) && (data as OrderInfoItem[]).map((order, index) => (
                <TableRow key={`${order.type}-${order.paymentTimestamp}-${index}`} className="text-xs">
                  <TableCell className="px-2 py-1.5">{order.type}</TableCell>
                  <TableCell className="px-2 py-1.5">{order.status}</TableCell>
                  <TableCell className="px-2 py-1.5">{formatDateFromTimestamp(order.paymentTimestamp)}</TableCell>
                </TableRow>
              ))}
              {/* Rows for Pair-related views */}
              {(['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) && getPairsArray(data, selectedView).map((pair) => (
                <TableRow key={pair.pairAddress} className="text-xs">
                  <TableCell className="px-1 py-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={pair.info?.imageUrl || pair.baseToken?.info?.imageUrl || `https://placehold.co/24x24.png`} alt={pair.baseToken?.name || 'Token'} />
                      <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium px-2 py-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="truncate max-w-[120px]">{pair.baseToken?.symbol || '?'}/{pair.quoteToken?.symbol || '?'}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>{pair.baseToken?.name || 'Unknown'} / {pair.quoteToken?.name || 'Unknown'}</p>
                           <p className="text-xs text-muted-foreground">{pair.pairAddress}</p>
                        </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right px-2 py-1.5">{formatCurrency(pair.priceUsd)}</TableCell>
                  <TableCell className="text-right px-2 py-1.5">{formatLargeNumber(pair.volume?.h24)}</TableCell>
                  <TableCell className="text-right px-2 py-1.5">{formatCurrency(pair.liquidity?.usd)}</TableCell>
                  <TableCell className="px-2 py-1.5">{pair.chainId}</TableCell>
                  <TableCell className="px-2 py-1.5">{pair.dexId}</TableCell>
                  <TableCell className="text-center px-2 py-1.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openPairDetailDialog(pair)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {selectedPairForDialog && (
        <Dialog open={isPairDetailDialogOpen} onOpenChange={setIsPairDetailDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                {(selectedPairForDialog.info?.imageUrl || selectedPairForDialog.baseToken?.info?.imageUrl) && (
                    <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={selectedPairForDialog.info?.imageUrl || selectedPairForDialog.baseToken?.info?.imageUrl || `https://placehold.co/32x32.png`} alt={selectedPairForDialog.baseToken?.name || ''} />
                        <AvatarFallback>{(selectedPairForDialog.baseToken?.symbol || 'P').substring(0,2)}</AvatarFallback>
                    </Avatar>
                )}
                {selectedPairForDialog.baseToken?.name || 'Base'} / {selectedPairForDialog.quoteToken?.name || 'Quote'}
              </DialogTitle>
              <DialogDescription>
                Pair: {selectedPairForDialog.pairAddress} on {selectedPairForDialog.chainId} ({selectedPairForDialog.dexId || 'N/A'})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Price USD:</strong> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                <div><strong>Price Native:</strong> {selectedPairForDialog.priceNative || '-'}</div>
                <div><strong>FDV:</strong> {formatCurrency(selectedPairForDialog.fdv)}</div>
                <div><strong>Market Cap:</strong> {formatCurrency(selectedPairForDialog.marketCap)}</div>
                <div><strong>Liquidity USD:</strong> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</div>
                 <div><strong>Created:</strong> {formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</div>
              </div>
              {selectedPairForDialog.info?.description && (
                <div><strong>Description:</strong> <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedPairForDialog.info.description}</p></div>
              )}
              <div className="grid grid-cols-2 gap-2">
                 <div>
                    <h4 className="font-semibold mb-1 text-xs flex items-center"><BarChartBig className="h-3 w-3 mr-1 text-muted-foreground"/>Volume</h4>
                    <p className="text-xs pl-4">5m: {formatLargeNumber(selectedPairForDialog.volume?.m5)}</p>
                    <p className="text-xs pl-4">1h: {formatLargeNumber(selectedPairForDialog.volume?.h1)}</p>
                    <p className="text-xs pl-4">6h: {formatLargeNumber(selectedPairForDialog.volume?.h6)}</p>
                    <p className="text-xs pl-4">24h: {formatLargeNumber(selectedPairForDialog.volume?.h24)}</p>
                 </div>
                 <div>
                    <h4 className="font-semibold mb-1 text-xs flex items-center"><TrendingUp className="h-3 w-3 mr-1 text-muted-foreground"/>Price Change</h4>
                    <p className="text-xs pl-4">5m: {selectedPairForDialog.priceChange?.m5?.toFixed(2) ?? '-'}%</p>
                    <p className="text-xs pl-4">1h: {selectedPairForDialog.priceChange?.h1?.toFixed(2) ?? '-'}%</p>
                    <p className="text-xs pl-4">6h: {selectedPairForDialog.priceChange?.h6?.toFixed(2) ?? '-'}%</p>
                    <p className="text-xs pl-4">24h: {selectedPairForDialog.priceChange?.h24?.toFixed(2) ?? '-'}%</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                    <h4 className="font-semibold mb-1 text-xs flex items-center"><ReceiptText className="h-3 w-3 mr-1 text-muted-foreground"/>Transactions</h4>
                    <p className="text-xs pl-4">5m (B/S): {selectedPairForDialog.txns?.m5?.buys ?? 0}/{selectedPairForDialog.txns?.m5?.sells ?? 0}</p>
                    <p className="text-xs pl-4">1h (B/S): {selectedPairForDialog.txns?.h1?.buys ?? 0}/{selectedPairForDialog.txns?.h1?.sells ?? 0}</p>
                    <p className="text-xs pl-4">6h (B/S): {selectedPairForDialog.txns?.h6?.buys ?? 0}/{selectedPairForDialog.txns?.h6?.sells ?? 0}</p>
                    <p className="text-xs pl-4">24h (B/S): {selectedPairForDialog.txns?.h24?.buys ?? 0}/{selectedPairForDialog.txns?.h24?.sells ?? 0}</p>
                </div>
                 <div>
                    <h4 className="font-semibold mb-1 text-xs flex items-center"><Zap className="h-3 w-3 mr-1 text-muted-foreground"/>Boosts</h4>
                    <p className="text-xs pl-4">Active: {selectedPairForDialog.boosts?.active ?? 0}</p>
                </div>
              </div>

              {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs flex items-center"><LinkIcon className="h-3 w-3 mr-1 text-muted-foreground"/>Websites</h4>
                  <ul className="list-disc list-inside text-xs pl-4">
                    {selectedPairForDialog.info.websites.map(site => (
                      <li key={site.url}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{site.label || site.url}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs flex items-center"><Users className="h-3 w-3 mr-1 text-muted-foreground"/>Socials</h4>
                  <ul className="list-disc list-inside text-xs pl-4">
                    {selectedPairForDialog.info.socials.map(social => (
                      <li key={social.url || social.handle || social.name}>
                        {social.url ? <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{social.name || social.platform || social.handle}</a> : <span>{social.name || social.platform || social.handle}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.labels && selectedPairForDialog.labels.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs flex items-center"><ListFilter className="h-3 w-3 mr-1 text-muted-foreground"/>Labels</h4>
                  <div className="flex flex-wrap gap-1 pl-4">
                    {selectedPairForDialog.labels.map(label => (
                        <span key={label} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm">{label}</span>
                    ))}
                  </div>
                </div>
              )}
               {selectedPairForDialog.pairCreatedAt && (
                 <div>
                    <h4 className="font-semibold mb-1 text-xs flex items-center"><CalendarClock className="h-3 w-3 mr-1 text-muted-foreground"/>Pair Created</h4>
                    <p className="text-xs pl-4">{formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</p>
                 </div>
               )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default DexScreenerContent;