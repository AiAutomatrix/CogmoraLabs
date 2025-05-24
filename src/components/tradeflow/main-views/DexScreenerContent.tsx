
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
  AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, TrendingUp, ListFilter, 
  ReceiptText, Layers, Search, Network, Users, Eye, Coins, BarChartBig, Zap, CalendarClock
} from 'lucide-react'; // Added more icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
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

type DexScreenerData = TokenProfileItem[] | TokenBoostItem[] | OrderInfoItem[] | PairData | PairDetail[] | null;

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Input states for new views
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
      if (currentView === 'profiles' || currentView === 'latestBoosts' || currentView === 'topBoosts' || currentView === 'tokenOrders' || currentView === 'tokenPairPools' || currentView === 'pairsByTokenAddresses') {
        // These views expect an array, or a single object wrapped in an array by the action
        if (result && !Array.isArray(result) && typeof result === 'object' && result !== null) {
             // This case should ideally be handled by the actions for profiles/boosts if they always return one item
            setData([result as any]); // Fallback if action didn't wrap
        } else {
            setData(result as any[] || []);
        }
      } else if (currentView === 'pairDetailsByPairAddress' || currentView === 'searchPairs') {
        // These views expect PairData | null
        setData(result as PairData | null);
      } else {
        setData([]); // Default to empty array
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

  // Initial fetch for default view
  useEffect(() => {
    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
        fetchDataForView(selectedView);
    }
    // For other views, fetch is triggered by button click after inputs
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
      return (rawData as PairData)?.pairs || [];
    }
    if (viewType === 'tokenPairPools' || viewType === 'pairsByTokenAddresses') {
      return rawData as PairDetail[];
    }
    return [];
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
      <div className="p-4 border-b bg-card space-y-3">
        {(needsChainAndToken || needsChainAndPair || needsChainAndTokens) && (
          <Input
            placeholder="Chain ID (e.g., solana)"
            value={inputChainId}
            onChange={(e) => setInputChainId(e.target.value)}
          />
        )}
        {(needsChainAndToken) && (
          <Input
            placeholder="Token Address"
            value={inputTokenAddress}
            onChange={(e) => setInputTokenAddress(e.target.value)}
          />
        )}
        {(needsChainAndPair) && (
          <Input
            placeholder="Pair Address"
            value={inputPairAddress}
            onChange={(e) => setInputPairAddress(e.target.value)}
          />
        )}
        {needsSearchQuery && (
          <Input
            placeholder="Search Query (e.g., ETH/USDC)"
            value={inputSearchQuery}
            onChange={(e) => setInputSearchQuery(e.target.value)}
          />
        )}
        {needsChainAndTokens && (
          <Input
            placeholder="Token Addresses (comma-separated)"
            value={inputCommaSeparatedTokenAddresses}
            onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)}
          />
        )}
        <Button onClick={() => fetchDataForView()} className="w-full sm:w-auto">Fetch View Data</Button>
      </div>
    );
  };
  
  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <SearchCode className="mr-2 h-4 w-4" /> }, // PackageSearch was not defined, using SearchCode
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Pools', icon: <Network className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <Users className="mr-2 h-4 w-4" /> },
  ];

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-6 w-6 text-primary" /> {/* Main Icon for DEX Screener */}
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
        ) : (!data || (Array.isArray(data) && data.length === 0) || ('pairs' in data && data.pairs && data.pairs.length === 0)) ? (
           <div className="flex items-center justify-center h-full p-4">
            <p className="text-muted-foreground text-lg">No data available for this view or parameters.</p>
          </div>
        ) : (
          <Table className="min-w-full">
            <TableCaption className="py-2 text-xs">
              {selectedView === 'profiles' && 'Latest token profiles from DEX Screener.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens from DEX Screener.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts from DEX Screener.'}
              {selectedView === 'tokenOrders' && 'Token order history.'}
              {selectedView === 'pairDetailsByPairAddress' && 'Details for the specified pair address.'}
              {selectedView === 'searchPairs' && 'Search results for pairs.'}
              {selectedView === 'tokenPairPools' && 'Pools for the specified token.'}
              {selectedView === 'pairsByTokenAddresses' && 'Pairs associated with the specified token addresses.'}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {/* Conditional Headers based on selectedView */}
                {(selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (
                  <>
                    <TableHead className="w-[50px] px-2 py-2 text-xs">Icon</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Name/Symbol</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Chain</TableHead>
                    <TableHead className="min-w-[150px] px-2 py-2 text-xs">Address</TableHead>
                    {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <TableHead className="text-right px-2 py-2 text-xs">Boost Amt.</TableHead>}
                    {selectedView === 'latestBoosts' && <TableHead className="text-right px-2 py-2 text-xs">Total Boost</TableHead>}
                    <TableHead className="w-[60px] text-center px-2 py-2 text-xs">Info</TableHead>
                    <TableHead className="w-[100px] text-center px-2 py-2 text-xs">Links</TableHead>
                  </>
                )}
                {selectedView === 'tokenOrders' && (
                  <>
                    <TableHead className="px-2 py-2 text-xs">Type</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Status</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Payment Date</TableHead>
                  </>
                )}
                {(['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) && (
                  <>
                    <TableHead className="w-[40px] px-1 py-2 text-xs">Icon</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Pair</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs">Price (USD)</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs">Volume (24h)</TableHead>
                    <TableHead className="text-right px-2 py-2 text-xs">Liquidity (USD)</TableHead>
                    <TableHead className="px-2 py-2 text-xs">Chain</TableHead>
                    <TableHead className="px-2 py-2 text-xs">DEX</TableHead>
                    <TableHead className="w-[80px] text-center px-2 py-2 text-xs">Actions</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Rows for Profiles and Boosts */}
              {(selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (data as (TokenProfileItem | TokenBoostItem)[]).map((item, index) => (
                <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`} className="text-xs">
                  <TableCell className="px-2 py-1.5">
                    <Avatar className="h-7 w-7"><AvatarImage src={item.icon ?? undefined} alt={item.name || item.description || 'Token icon'} /><AvatarFallback>{(item.name || item.description || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] min-w-0 px-2 py-1.5">
                     <div className="truncate" title={item.name || item.description || item.tokenAddress || "Unknown Token"}>{item.name || item.description || item.tokenAddress || "Unknown Token"}</div>
                  </TableCell>
                  <TableCell className="px-2 py-1.5">{item.chainId}</TableCell>
                  <TableCell className="font-mono text-xs px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button>
                    </div>
                  </TableCell>
                  {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <TableCell className="text-right px-2 py-1.5">{(item as TokenBoostItem).amount?.toLocaleString() ?? '-'}</TableCell>}
                  {selectedView === 'latestBoosts' && <TableCell className="text-right px-2 py-1.5">{(item as TokenBoostItem).totalAmount?.toLocaleString() ?? '-'}</TableCell>}
                  <TableCell className="text-center px-2 py-1.5">{renderDescriptionInteraction(item.description)}</TableCell>
                  <TableCell className="text-center px-2 py-1.5">{renderLinksDropdown(item.links)}</TableCell>
                </TableRow>
              ))}
              {/* Rows for Token Orders */}
              {selectedView === 'tokenOrders' && (data as OrderInfoItem[]).map((order, index) => (
                <TableRow key={index} className="text-xs">
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
                      <AvatarImage src={pair.baseToken?.info?.imageUrl || pair.info?.imageUrl || undefined} alt={pair.baseToken?.name || 'Token'} />
                      <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium px-2 py-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="truncate max-w-[120px]">{pair.baseToken?.symbol}/{pair.quoteToken?.symbol}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>{pair.baseToken?.name} / {pair.quoteToken?.name}</p>
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
                {selectedPairForDialog.info?.imageUrl && (
                    <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={selectedPairForDialog.info.imageUrl} alt={selectedPairForDialog.baseToken.name} />
                        <AvatarFallback>{selectedPairForDialog.baseToken.symbol.substring(0,2)}</AvatarFallback>
                    </Avatar>
                )}
                {selectedPairForDialog.baseToken.name} / {selectedPairForDialog.quoteToken.name}
              </DialogTitle>
              <DialogDescription>
                Pair: {selectedPairForDialog.pairAddress} on {selectedPairForDialog.chainId} ({selectedPairForDialog.dexId})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Price USD:</strong> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                <div><strong>Price Native:</strong> {selectedPairForDialog.priceNative}</div>
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
                    <h4 className="font-semibold mb-1 text-xs">Volume</h4>
                    <p className="text-xs">5m: {formatLargeNumber(selectedPairForDialog.volume?.m5)}</p>
                    <p className="text-xs">1h: {formatLargeNumber(selectedPairForDialog.volume?.h1)}</p>
                    <p className="text-xs">6h: {formatLargeNumber(selectedPairForDialog.volume?.h6)}</p>
                    <p className="text-xs">24h: {formatLargeNumber(selectedPairForDialog.volume?.h24)}</p>
                 </div>
                 <div>
                    <h4 className="font-semibold mb-1 text-xs">Price Change</h4>
                    <p className="text-xs">5m: {selectedPairForDialog.priceChange?.m5?.toFixed(2)}%</p>
                    <p className="text-xs">1h: {selectedPairForDialog.priceChange?.h1?.toFixed(2)}%</p>
                    <p className="text-xs">6h: {selectedPairForDialog.priceChange?.h6?.toFixed(2)}%</p>
                    <p className="text-xs">24h: {selectedPairForDialog.priceChange?.h24?.toFixed(2)}%</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                    <h4 className="font-semibold mb-1 text-xs">Transactions (Buys/Sells)</h4>
                    <p className="text-xs">5m: {selectedPairForDialog.txns?.m5?.buys}/{selectedPairForDialog.txns?.m5?.sells}</p>
                    <p className="text-xs">1h: {selectedPairForDialog.txns?.h1?.buys}/{selectedPairForDialog.txns?.h1?.sells}</p>
                    <p className="text-xs">6h: {selectedPairForDialog.txns?.h6?.buys}/{selectedPairForDialog.txns?.h6?.sells}</p>
                    <p className="text-xs">24h: {selectedPairForDialog.txns?.h24?.buys}/{selectedPairForDialog.txns?.h24?.sells}</p>
                </div>
                 <div>
                    <h4 className="font-semibold mb-1 text-xs">Boosts</h4>
                    <p className="text-xs">Active: {selectedPairForDialog.boosts?.active ?? 0}</p>
                </div>
              </div>

              {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs">Websites</h4>
                  <ul className="list-disc list-inside text-xs">
                    {selectedPairForDialog.info.websites.map(site => (
                      <li key={site.url}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{site.label || site.url}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs">Socials</h4>
                  <ul className="list-disc list-inside text-xs">
                    {selectedPairForDialog.info.socials.map(social => (
                      <li key={social.url || social.handle}>
                        {social.url ? <a href={social.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{social.name || social.platform || social.handle}</a> : <span>{social.name || social.platform || social.handle}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedPairForDialog.labels && selectedPairForDialog.labels.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-1 text-xs">Labels</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedPairForDialog.labels.map(label => (
                        <span key={label} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm">{label}</span>
                    ))}
                  </div>
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