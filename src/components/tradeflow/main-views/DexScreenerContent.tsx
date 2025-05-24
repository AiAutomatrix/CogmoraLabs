
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
import type { TokenProfileItem, TokenBoostItem, DexLink, OrderInfoItem, PairDataSchema, PairDetail } from '@/types'; // Ensure all types are imported
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'; // Import Dialog components
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink as ExternalLinkIcon, SearchCode, TrendingUp, ListFilter, ReceiptText, Layers, Search, Network, ListCollapse, Eye, PackageSearch } from 'lucide-react';
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

type DexScreenerData = 
  | TokenProfileItem[] 
  | TokenBoostItem[] 
  | OrderInfoItem[]
  | PairDataSchema // For single pair details by address and search results
  | PairDetail[]   // For token pair pools and pairs by token addresses
  | null; 


// Helper functions for formatting
const formatCurrency = (value?: number | string | null, currency = 'USD') => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
};

const formatLargeNumber = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) < 1000) return value.toLocaleString();
  const suffixes = ["", "K", "M", "B", "T"];
  const suffixNum = Math.floor(Math.log10(Math.abs(value)) / 3);
  const shortValue = (value / Math.pow(1000, suffixNum)).toFixed(2);
  return `${shortValue}${suffixes[suffixNum]}`;
};

const formatDateFromTimestamp = (timestamp?: number | null) => {
  if (timestamp === null || timestamp === undefined) return '-';
  try {
    return format(new Date(timestamp * 1000), 'MMM d, yyyy, HH:mm');
  } catch (e) {
    return 'Invalid Date';
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

  // State for Pair Detail Dialog
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);
  const [isPairDetailDialogOpen, setIsPairDetailDialogOpen] = useState(false);


  const fetchDataForView = useCallback(async (view: DexScreenerViewType) => {
    setIsLoading(true);
    setError(null);
    
    let initialDataState: DexScreenerData = [];
    if (view === 'pairDetailsByPairAddress' || view === 'searchPairs') {
        initialDataState = null; 
    }
    setData(initialDataState);

    try {
      let result: DexScreenerData = null; 
      
      const initialViewsRequireArray = ['profiles', 'latestBoosts', 'topBoosts', 'tokenOrders', 'tokenPairPools', 'pairsByTokenAddresses'].includes(view);
      if (initialViewsRequireArray) {
        result = [];
      }


      if (view === 'profiles') {
        result = await fetchLatestTokenProfiles();
      } else if (view === 'latestBoosts') {
        result = await fetchLatestBoostedTokens();
      } else if (view === 'topBoosts') {
        result = await fetchTopBoostedTokens();
      } else if (view === 'tokenOrders') {
        if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Input Required", description: "Chain ID and Token Address are required for Token Orders.", variant: "destructive" });
          setIsLoading(false);
          setData([]); // Reset data to empty array
          return;
        }
        result = await fetchTokenOrders(inputChainId, inputTokenAddress);
      } else if (view === 'pairDetailsByPairAddress') {
        if (!inputChainId || !inputPairAddress) {
          toast({ title: "Input Required", description: "Chain ID and Pair Address are required.", variant: "destructive" });
          setIsLoading(false);
          setData(null); // Reset data to null
          return;
        }
        result = await fetchPairDetailsByPairAddress(inputChainId, inputPairAddress);
      } else if (view === 'searchPairs') {
        if (!inputSearchQuery) {
          toast({ title: "Input Required", description: "Search query is required.", variant: "destructive" });
          setIsLoading(false);
          setData(null); // Reset data to null
          return;
        }
        result = await searchPairs(inputSearchQuery);
      } else if (view === 'tokenPairPools') {
         if (!inputChainId || !inputTokenAddress) {
          toast({ title: "Input Required", description: "Chain ID and Token Address are required.", variant: "destructive" });
          setIsLoading(false);
          setData([]); // Reset data to empty array
          return;
        }
        result = await fetchTokenPairPools(inputChainId, inputTokenAddress);
      } else if (view === 'pairsByTokenAddresses') {
         if (!inputChainId || !inputCommaSeparatedTokenAddresses) {
          toast({ title: "Input Required", description: "Chain ID and Token Addresses are required.", variant: "destructive" });
          setIsLoading(false);
          setData([]); // Reset data to empty array
          return;
        }
        result = await fetchPairsByTokenAddresses(inputChainId, inputCommaSeparatedTokenAddresses);
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
      if (view === 'pairDetailsByPairAddress' || view === 'searchPairs') {
        setData(null);
      } else {
        setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, inputChainId, inputTokenAddress, inputPairAddress, inputSearchQuery, inputCommaSeparatedTokenAddresses]);

  useEffect(() => {
    if (['profiles', 'latestBoosts', 'topBoosts'].includes(selectedView)) {
      fetchDataForView(selectedView);
    } else {
      const isObjectView = selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs';
      setData(isObjectView ? null : []);
      setIsLoading(false);
      setError(null);
    }
  }, [selectedView, fetchDataForView]);


  const handleManualFetch = () => {
    fetchDataForView(selectedView);
  };

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
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Info className="h-4 w-4" />
              </Button>
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
          <Button variant="outline" size="sm" className="h-8">
            Links <LinkIcon className="ml-2 h-3 w-3" />
          </Button>
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

  // Helper to get pairs array safely
  const getPairsArray = (rawData: DexScreenerData, viewType: DexScreenerViewType): PairDetail[] => {
    if (!rawData) return [];
    if (viewType === 'pairDetailsByPairAddress' || viewType === 'searchPairs') {
      return (rawData as PairDataSchema).pairs || [];
    }
    if (viewType === 'tokenPairPools' || viewType === 'pairsByTokenAddresses') {
      return rawData as PairDetail[];
    }
    return [];
  };


  const renderInputSection = () => {
    const needsChainId = ['tokenOrders', 'pairDetailsByPairAddress', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView);
    const needsTokenAddressForOrdersOrPools = ['tokenOrders', 'tokenPairPools'].includes(selectedView);
    const needsPairAddress = selectedView === 'pairDetailsByPairAddress';
    const needsSearchQuery = selectedView === 'searchPairs';
    const needsCommaTokenAddresses = selectedView === 'pairsByTokenAddresses';

    if (!needsChainId && !needsTokenAddressForOrdersOrPools && !needsPairAddress && !needsSearchQuery && !needsCommaTokenAddresses) {
      return null;
    }

    return (
      <div className="p-4 border-b bg-card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          {needsChainId && (
            <div>
              <Label htmlFor="chainIdInput" className="text-xs">Chain ID</Label>
              <Input id="chainIdInput" placeholder="e.g., solana" value={inputChainId} onChange={(e) => setInputChainId(e.target.value)} />
            </div>
          )}
          {needsTokenAddressForOrdersOrPools && (
            <div>
              <Label htmlFor="tokenAddressInput" className="text-xs">Token Address</Label>
              <Input id="tokenAddressInput" placeholder="Token Address" value={inputTokenAddress} onChange={(e) => setInputTokenAddress(e.target.value)} />
            </div>
          )}
          {needsPairAddress && (
            <div>
              <Label htmlFor="pairAddressInput" className="text-xs">Pair Address</Label>
              <Input id="pairAddressInput" placeholder="Pair Address" value={inputPairAddress} onChange={(e) => setInputPairAddress(e.target.value)} />
            </div>
          )}
          {needsSearchQuery && (
             <div className="md:col-span-2 lg:col-span-3">
              <Label htmlFor="searchQueryInput" className="text-xs">Search Query</Label>
              <Input id="searchQueryInput" placeholder="e.g., SOL/USDC or token address" value={inputSearchQuery} onChange={(e) => setInputSearchQuery(e.target.value)} />
            </div>
          )}
          {needsCommaTokenAddresses && (
            <div className="md:col-span-2 lg:col-span-3">
              <Label htmlFor="commaTokenAddressesInput" className="text-xs">Token Addresses (comma-separated)</Label>
              <Input id="commaTokenAddressesInput" placeholder="e.g., addr1,addr2" value={inputCommaSeparatedTokenAddresses} onChange={(e) => setInputCommaSeparatedTokenAddresses(e.target.value)} />
            </div>
          )}
        </div>
        <Button onClick={handleManualFetch} disabled={isLoading} size="sm">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Fetch View Data'}
        </Button>
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
    { value: 'tokenPairPools', label: 'Token Pair Pools', icon: <Network className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <ListCollapse className="mr-2 h-4 w-4" /> },
  ];

  const isProfilesOrBoostsView = selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts';

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SearchCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">DEX Screener</CardTitle>
        </div>
        <RadioGroup
          value={selectedView}
          onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3"
        >
          {viewOptions.map(opt => (
            <Label
              key={opt.value}
              htmlFor={opt.value}
              className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground text-xs sm:text-sm ${selectedView === opt.value ? 'bg-accent text-accent-foreground ring-2 ring-primary' : 'bg-background'}`}
            >
              <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
              {opt.icon}
              <span>{opt.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </CardHeader>

      {renderInputSection()}

      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-destructive font-semibold text-lg">Error Loading Data</p>
            <p className="text-muted-foreground text-sm mb-3">{error}</p>
            <Button onClick={() => fetchDataForView(selectedView)} className="mt-2">Retry</Button>
          </div>
        ) : (!data || (Array.isArray(data) && data.length === 0) || ((selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs') && (!data || !(data as PairDataSchema).pairs || (data as PairDataSchema).pairs.length === 0))) ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No data available for this view or criteria.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>
              {selectedView === 'profiles' && 'Latest token profiles from DEX Screener API.'}
              {selectedView === 'latestBoosts' && 'Latest boosted tokens from DEX Screener API.'}
              {selectedView === 'topBoosts' && 'Tokens with the most active boosts from DEX Screener API.'}
              {selectedView === 'tokenOrders' && `Token orders for ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairDetailsByPairAddress' && `Pair details for ${inputPairAddress} on ${inputChainId}.`}
              {selectedView === 'searchPairs' && `Search results for "${inputSearchQuery}".`}
              {selectedView === 'tokenPairPools' && `Token pair pools for ${inputTokenAddress} on ${inputChainId}.`}
              {selectedView === 'pairsByTokenAddresses' && `Pairs for token addresses on ${inputChainId}.`}
            </TableCaption>
            <TableHeader>
              <TableRow>
                {/* Conditional Headers for Profiles/Boosts */}
                {isProfilesOrBoostsView && (
                  <>
                    <TableHead className="w-[50px]">Icon</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead className="min-w-[150px]">Address</TableHead>
                    {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && <TableHead className="text-right">Boost Amt.</TableHead>}
                    <TableHead className="w-[60px] text-center">Info</TableHead>
                    <TableHead className="w-[100px] text-center">Links</TableHead>
                  </>
                )}
                {/* Headers for Token Orders */}
                {selectedView === 'tokenOrders' && (
                  <>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Date</TableHead>
                  </>
                )}
                {/* Headers for Pair-related data */}
                {(selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs' || selectedView === 'tokenPairPools' || selectedView === 'pairsByTokenAddresses') && (
                   <>
                    <TableHead className="w-[50px]">Icon</TableHead>
                    <TableHead>Pair</TableHead>
                    <TableHead className="text-right">Price (USD)</TableHead>
                    <TableHead className="text-right">Volume (24h)</TableHead>
                    <TableHead className="text-right">Liquidity (USD)</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>DEX ID</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Rows for Profiles/Boosts */}
              {isProfilesOrBoostsView && Array.isArray(data) &&
                (data as (TokenProfileItem | TokenBoostItem)[]).map((item, index) => (
                <TableRow key={`${item.tokenAddress}-${item.chainId}-${index}-${selectedView}`}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.icon ?? `https://placehold.co/32x32.png`} alt={item.name || item.description || item.tokenAddress || 'Token icon'} />
                      <AvatarFallback>{(item.name || item.description || item.tokenAddress || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] min-w-0">
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="truncate" title={item.name || item.description || "Unknown Token"}>
                              {item.name || item.description || "Unknown Token"}
                           </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{item.name || item.description || item.tokenAddress}</p></TooltipContent>
                     </Tooltip>
                  </TableCell>
                  <TableCell>{item.chainId}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={item.tokenAddress}>
                        {truncateAddress(item.tokenAddress)}
                      </span>
                      {item.tokenAddress && <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}>
                          <Copy className="h-3 w-3"/>
                      </Button>}
                    </div>
                  </TableCell>
                  {(selectedView === 'latestBoosts' || selectedView === 'topBoosts') && (
                    <TableCell className="text-right">
                      {'amount' in item ? ((item as TokenBoostItem).amount?.toLocaleString() ?? '-') : '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-center">{renderDescriptionInteraction(item.description)}</TableCell>
                  <TableCell className="text-center">{renderLinksDropdown(item.links)}</TableCell>
                </TableRow>
              ))}
              {/* Rows for Token Orders */}
              {selectedView === 'tokenOrders' && Array.isArray(data) && (data as OrderInfoItem[]).map((order, index) => (
                <TableRow key={`${order.type}-${order.paymentTimestamp}-${index}`}>
                  <TableCell>{order.type}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell>{formatDateFromTimestamp(order.paymentTimestamp)}</TableCell>
                </TableRow>
              ))}
              {/* Rows for Pair-related data */}
              {(selectedView === 'pairDetailsByPairAddress' || selectedView === 'searchPairs' || selectedView === 'tokenPairPools' || selectedView === 'pairsByTokenAddresses') && getPairsArray(data, selectedView).map((pair) => (
                <TableRow key={pair.pairAddress}>
                  <TableCell>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={pair.info?.imageUrl || pair.baseToken?.symbol } alt={pair.baseToken?.name || 'Token'} />
                      <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium max-w-[150px] truncate">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="truncate block">{`${pair.baseToken?.symbol || 'N/A'}/${pair.quoteToken?.symbol || 'N/A'}`}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{pair.baseToken?.name || 'Base'} / {pair.quoteToken?.name || 'Quote'}</p>
                        </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(pair.priceUsd)}</TableCell>
                  <TableCell className="text-right">{formatLargeNumber(pair.volume?.h24)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(pair.liquidity?.usd)}</TableCell>
                  <TableCell>{pair.chainId}</TableCell>
                  <TableCell className="truncate max-w-[100px]">{pair.dexId}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedPairForDialog(pair); setIsPairDetailDialogOpen(true); }}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
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
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center">
                {selectedPairForDialog.info?.imageUrl && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={selectedPairForDialog.info.imageUrl} alt={`${selectedPairForDialog.baseToken?.name || 'Token'} icon`} />
                    <AvatarFallback>{(selectedPairForDialog.baseToken?.symbol || 'P').substring(0,1)}</AvatarFallback>
                  </Avatar>
                )}
                {selectedPairForDialog.baseToken?.name || 'N/A'} / {selectedPairForDialog.quoteToken?.name || 'N/A'}
                <span className="ml-2 text-sm text-muted-foreground">({selectedPairForDialog.baseToken?.symbol}/{selectedPairForDialog.quoteToken?.symbol})</span>
              </DialogTitle>
              <DialogDescription>
                Pair Address: {truncateAddress(selectedPairForDialog.pairAddress)} 
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => selectedPairForDialog.pairAddress && handleCopyAddress(selectedPairForDialog.pairAddress)}>
                    <Copy className="h-3 w-3" />
                </Button>
                 | Chain: {selectedPairForDialog.chainId} | DEX: {selectedPairForDialog.dexId}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-grow overflow-y-auto pr-2 space-y-4 text-sm py-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-2 border rounded-md bg-muted/50"><strong>Price USD:</strong> {formatCurrency(selectedPairForDialog.priceUsd)}</div>
                    <div className="p-2 border rounded-md bg-muted/50"><strong>Price Native:</strong> {selectedPairForDialog.priceNative}</div>
                    <div className="p-2 border rounded-md bg-muted/50"><strong>Liquidity:</strong> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</div>
                    <div className="p-2 border rounded-md bg-muted/50"><strong>FDV:</strong> {formatCurrency(selectedPairForDialog.fdv)}</div>
                    <div className="p-2 border rounded-md bg-muted/50"><strong>Market Cap:</strong> {formatCurrency(selectedPairForDialog.marketCap)}</div>
                    <div className="p-2 border rounded-md bg-muted/50"><strong>Created:</strong> {formatDateFromTimestamp(selectedPairForDialog.pairCreatedAt)}</div>
                </div>

                {selectedPairForDialog.txns && (
                    <div>
                        <h4 className="font-semibold mb-1 text-sm">Transactions:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedPairForDialog.txns).map(([period, {buys, sells}]) => (
                                <div key={period} className="p-2 border rounded bg-muted/50">
                                    <strong>{period.toUpperCase()}:</strong> Buys: {buys}, Sells: {sells}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedPairForDialog.volume && (
                     <div>
                        <h4 className="font-semibold mb-1 text-sm">Volume:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedPairForDialog.volume).map(([period, vol]) => (
                                <div key={period} className="p-2 border rounded bg-muted/50">
                                    <strong>{period.toUpperCase()}:</strong> {formatCurrency(vol)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {selectedPairForDialog.priceChange && (
                     <div>
                        <h4 className="font-semibold mb-1 text-sm">Price Change (%):</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(selectedPairForDialog.priceChange).map(([period, change]) => (
                                <div key={period} className={`p-2 border rounded bg-muted/50 ${change && change > 0 ? 'text-green-500' : change && change < 0 ? 'text-red-500' : ''}`}>
                                    <strong>{period.toUpperCase()}:</strong> {change?.toFixed(2) ?? '-'}%
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-1 text-sm">Websites:</h4>
                        <ul className="list-disc list-inside text-xs space-y-1">
                            {selectedPairForDialog.info.websites.map((site, idx) => (
                                <li key={idx}><a href={site.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{site.label || site.url} <ExternalLinkIcon className="inline h-3 w-3"/></a></li>
                            ))}
                        </ul>
                    </div>
                )}

                {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-1 text-sm">Socials:</h4>
                         <ul className="list-disc list-inside text-xs space-y-1">
                            {selectedPairForDialog.info.socials.map((social, idx) => (
                                <li key={idx}>
                                    <a href={social.url || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                        {social.name || social.platform || social.handle}{social.handle && social.platform && ` (${social.platform})`} <ExternalLinkIcon className="inline h-3 w-3"/>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 {selectedPairForDialog.info?.description && (
                    <div>
                        <h4 className="font-semibold mb-1 text-sm">Description:</h4>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedPairForDialog.info.description}</p>
                    </div>
                )}
            </div>
            <DialogFooter className="mt-auto pt-4 border-t">
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