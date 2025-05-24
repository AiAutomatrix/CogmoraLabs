
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
import type { TokenProfileItem, TokenBoostItem, DexLink, OrderInfoItem, PairData, PairDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Info, Link as LinkIcon, Copy, ExternalLink, SearchCode, Eye, PackageSearch, ReceiptText, Layers, Search, GitFork, ListFilter, TrendingUp } from 'lucide-react';
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

type DexScreenerData = TokenProfileItem[] | TokenBoostItem[] | OrderInfoItem[] | PairData | PairDetail[] | null;

// Helper function to format currency
const formatCurrency = (value?: number | string | null, fractionDigits = 2) => {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const num = Number(value);
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
};

// Helper function to format large numbers
const formatLargeNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return '-';
  if (Math.abs(value) < 1000) return value.toString();
  const suffixes = ["", "K", "M", "B", "T"];
  const i = Math.floor(Math.log10(Math.abs(value))/3);
  const num = (value / Math.pow(1000, i));
  return `${num.toFixed(1)}${suffixes[i]}`;
};

const DexScreenerContent: React.FC = () => {
  const [selectedView, setSelectedView] = useState<DexScreenerViewType>('profiles');
  const [data, setData] = useState<DexScreenerData>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Input states
  const [inputChainId, setInputChainId] = useState<string>('solana'); // Default chain
  const [inputTokenAddress, setInputTokenAddress] = useState<string>('');
  const [inputPairAddress, setInputPairAddress] = useState<string>('');
  const [inputSearchQuery, setInputSearchQuery] = useState<string>('');
  const [inputCommaSeparatedTokenAddresses, setInputCommaSeparatedTokenAddresses] = useState<string>('');
  
  const [selectedPairForDialog, setSelectedPairForDialog] = useState<PairDetail | null>(null);

  const fetchDataForView = useCallback(async (view: DexScreenerViewType, forceFetch: boolean = false) => {
    if (!forceFetch && selectedView === view && data !== null && !['tokenOrders', 'pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(view)) {
      return; // Avoid re-fetch for static list views if data already exists
    }

    setIsLoading(true);
    setError(null);
    setData(null); // Clear previous data
    
    let result: DexScreenerData = null;
    try {
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
          if (!inputChainId.trim() || !inputTokenAddress.trim()) {
            toast({ title: "Missing Input", description: "Chain ID and Token Address are required for Token Orders.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchTokenOrders(inputChainId, inputTokenAddress);
          break;
        case 'pairDetailsByPairAddress':
          if (!inputChainId.trim() || !inputPairAddress.trim()) {
            toast({ title: "Missing Input", description: "Chain ID and Pair Address are required for Pair Details.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchPairDetailsByPairAddress(inputChainId, inputPairAddress);
          break;
        case 'searchPairs':
          if (!inputSearchQuery.trim()) {
            toast({ title: "Missing Input", description: "Search query is required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await searchPairs(inputSearchQuery);
          break;
        case 'tokenPairPools':
           if (!inputChainId.trim() || !inputTokenAddress.trim()) {
            toast({ title: "Missing Input", description: "Chain ID and Token Address are required for Token Pair Pools.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchTokenPairPools(inputChainId, inputTokenAddress);
          break;
        case 'pairsByTokenAddresses':
          if (!inputChainId.trim() || !inputCommaSeparatedTokenAddresses.trim()) {
            toast({ title: "Missing Input", description: "Chain ID and Token Addresses are required.", variant: "destructive" });
            setIsLoading(false); return;
          }
          result = await fetchPairsByTokenAddresses(inputChainId, inputCommaSeparatedTokenAddresses);
          break;
        default:
          console.warn("Unknown view selected:", view);
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
  }, [selectedView, data, toast, inputChainId, inputTokenAddress, inputPairAddress, inputSearchQuery, inputCommaSeparatedTokenAddresses]);

  useEffect(() => {
    // Fetch data automatically for views that don't require specific inputs
    if (!['tokenOrders', 'pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) {
      fetchDataForView(selectedView);
    } else {
      // For views requiring input, clear data if inputs are not met or view changes
      setData(null); 
      setIsLoading(false); // Ensure loading is false if we're not fetching
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
    return address.length <= startChars + endChars ? address : `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
  };

  const renderDescriptionInteraction = (description?: string | null) => {
    if (!description) return <span className="text-muted-foreground">-</span>;
    const truncated = description.length > 50 ? `${description.substring(0, 47)}...` : description;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"><Info className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm z-[51] bg-popover text-popover-foreground p-3 rounded shadow-lg" side="top" align="center">
              {description}
            </PopoverContent>
          </Popover>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-xs z-50 bg-popover text-popover-foreground p-2 rounded shadow-md text-xs"><p>{truncated}</p></TooltipContent>
      </Tooltip>
    );
  };

  const renderLinksDropdown = (links?: DexLink[] | null) => {
    if (!links || links.length === 0) return <span className="text-muted-foreground">-</span>;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">Links <LinkIcon className="ml-1 h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto z-50">
          {links.map((link, index) => (
            <DropdownMenuItem key={`${link.url}-${index}`} asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full text-xs">
                {link.label || link.type || 'Link'} <ExternalLink className="ml-2 h-3 w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  
  const renderPairInfoDialog = (pair: PairDetail) => (
    <Dialog open={selectedPairForDialog?.pairAddress === pair.pairAddress} onOpenChange={(isOpen) => { if(!isOpen) setSelectedPairForDialog(null); else setSelectedPairForDialog(pair);}}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPairForDialog(pair)}>
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      {selectedPairForDialog && selectedPairForDialog.pairAddress === pair.pairAddress && (
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pair: {selectedPairForDialog.baseToken?.symbol || 'N/A'}/{selectedPairForDialog.quoteToken?.symbol || 'N/A'}</DialogTitle>
            <DialogDescription className="text-xs break-all">{selectedPairForDialog.pairAddress}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 text-sm max-h-[60vh] overflow-y-auto pr-2">
            {selectedPairForDialog.info?.imageUrl && (
              <div className="relative h-40 w-full mb-2 rounded overflow-hidden">
                <Image src={selectedPairForDialog.info.imageUrl} alt="Pair image" layout="fill" style={{objectFit:"contain"}} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"/>
              </div>
            )}
            <p><strong>Price (USD):</strong> {formatCurrency(selectedPairForDialog.priceUsd, 8)}</p>
            <p><strong>Price (Native):</strong> {selectedPairForDialog.priceNative || '-'}</p>
            <p><strong>Market Cap:</strong> {formatCurrency(selectedPairForDialog.marketCap)}</p>
            <p><strong>FDV:</strong> {formatCurrency(selectedPairForDialog.fdv)}</p>
            <p><strong>Liquidity (USD):</strong> {formatCurrency(selectedPairForDialog.liquidity?.usd)}</p>
            <p><strong>Created:</strong> {selectedPairForDialog.pairCreatedAt ? format(fromUnixTime(selectedPairForDialog.pairCreatedAt), 'PPpp') : '-'}</p>
            
            {selectedPairForDialog.txns && (
              <div><strong>Transactions (Buys/Sells):</strong>
                <ul className="list-disc pl-5 text-xs">
                  {Object.entries(selectedPairForDialog.txns).map(([key, val]) => <li key={key}>{key.toUpperCase()}: {val.buys} / {val.sells}</li>)}
                </ul>
              </div>
            )}
             {selectedPairForDialog.volume && (
              <div><strong>Volume:</strong>
                <ul className="list-disc pl-5 text-xs">
                  {Object.entries(selectedPairForDialog.volume).map(([key, val]) => <li key={key}>{key.toUpperCase()}: {formatCurrency(val)}</li>)}
                </ul>
              </div>
            )}
            {selectedPairForDialog.priceChange && (
               <div><strong>Price Change (%):</strong>
                <ul className="list-disc pl-5 text-xs">
                  {Object.entries(selectedPairForDialog.priceChange).map(([key, val]) => <li key={key}>{key.toUpperCase()}: {val.toFixed(2)}%</li>)}
                </ul>
              </div>
            )}
            {selectedPairForDialog.info?.websites && selectedPairForDialog.info.websites.length > 0 && (
              <div><strong>Websites:</strong>
                <ul className="list-disc pl-5 text-xs">{selectedPairForDialog.info.websites.map(w => <li key={w.url}><a href={w.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{w.label || w.url}</a></li>)}</ul>
              </div>
            )}
            {selectedPairForDialog.info?.socials && selectedPairForDialog.info.socials.length > 0 && (
               <div><strong>Socials:</strong>
                <ul className="list-disc pl-5 text-xs">{selectedPairForDialog.info.socials.map(s => <li key={s.type || s.platform || s.url }><a href={s.url || '#'} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s.platform || s.type}: {s.handle || s.name || s.url}</a></li>)}</ul>
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );

  const renderInputSection = () => {
    const commonInputs = (
      <Input placeholder="Chain ID (e.g., solana)" value={inputChainId} onChange={e => setInputChainId(e.target.value)} className="h-9 text-xs" />
    );

    if (selectedView === 'tokenOrders' || selectedView === 'tokenPairPools') {
      return (
        <form onSubmit={(e) => { e.preventDefault(); fetchDataForView(selectedView, true);}} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end mb-3">
          {commonInputs}
          <Input placeholder="Token Address" value={inputTokenAddress} onChange={e => setInputTokenAddress(e.target.value)} className="h-9 text-xs"/>
          <Button type="submit" size="sm" className="h-9 text-xs md:col-start-3">Fetch</Button>
        </form>
      );
    } else if (selectedView === 'pairDetailsByPairAddress') {
       return (
        <form onSubmit={(e) => { e.preventDefault(); fetchDataForView(selectedView, true);}} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end mb-3">
          {commonInputs}
          <Input placeholder="Pair Address" value={inputPairAddress} onChange={e => setInputPairAddress(e.target.value)} className="h-9 text-xs"/>
          <Button type="submit" size="sm" className="h-9 text-xs md:col-start-3">Fetch</Button>
        </form>
      );
    } else if (selectedView === 'searchPairs') {
      return (
        <form onSubmit={(e) => { e.preventDefault(); fetchDataForView(selectedView, true);}} className="flex gap-2 items-center mb-3">
          <Input placeholder="Search pairs (e.g., WIF SOL)" value={inputSearchQuery} onChange={e => setInputSearchQuery(e.target.value)} className="h-9 text-xs flex-grow" />
          <Button type="submit" size="sm" className="h-9 text-xs">Fetch</Button>
        </form>
      );
    } else if (selectedView === 'pairsByTokenAddresses') {
      return (
        <form onSubmit={(e) => { e.preventDefault(); fetchDataForView(selectedView, true);}} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end mb-3">
          {commonInputs}
          <Input placeholder="Token Addresses (comma-separated)" value={inputCommaSeparatedTokenAddresses} onChange={e => setInputCommaSeparatedTokenAddresses(e.target.value)} className="h-9 text-xs"/>
          <Button type="submit" size="sm" className="h-9 text-xs md:col-start-3">Fetch</Button>
        </form>
      );
    }
    return null; // No inputs for profiles/boosts views
  };

  const renderTable = () => {
    if (isLoading) {
      return <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>;
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-destructive font-semibold">Error loading data</p>
          <p className="text-muted-foreground text-sm text-center">{error}</p>
          <Button onClick={() => fetchDataForView(selectedView, true)} className="mt-4">Retry</Button>
        </div>
      );
    }
    if (!data || (Array.isArray(data) && data.length === 0) || (data && typeof data === 'object' && 'pairs' in data && (data as PairData).pairs?.length === 0)) {
       return <div className="flex items-center justify-center h-full p-4"><p className="text-muted-foreground">No data available for this view or selection.</p></div>;
    }

    // Render Profiles or Boosts
    if (selectedView === 'profiles' || selectedView === 'latestBoosts' || selectedView === 'topBoosts') {
      const items = data as (TokenProfileItem[] | TokenBoostItem[]); // Safe cast after checks
      const isBoost = selectedView === 'latestBoosts' || selectedView === 'topBoosts';
      
      if (!Array.isArray(items) || items.length === 0) {
         return <div className="flex items-center justify-center h-full p-4"><p className="text-muted-foreground">No data available.</p></div>;
      }

      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead className="min-w-[120px]">Address</TableHead>
              {isBoost && <TableHead className="text-right">Boost Amt.</TableHead>}
              {isBoost && <TableHead className="text-right">Total Boost</TableHead>}
              <TableHead className="w-[50px] text-center">Info</TableHead>
              <TableHead className="w-[80px] text-center">Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.tokenAddress || 'item'}-${item.chainId || 'chain'}-${index}-${selectedView}`}>
                <TableCell><Avatar className="h-6 w-6"><AvatarImage src={item.icon ?? undefined} alt={item.name || item.symbol || 'Token icon'} /><AvatarFallback>{(item.symbol || item.name || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback></Avatar></TableCell>
                <TableCell className="font-medium max-w-[150px] min-w-0">
                  <Tooltip delayDuration={100}><TooltipTrigger asChild><div className="truncate" title={item.name || item.description || item.tokenAddress || "Unknown"}>{item.name || item.description || "Unknown Token"}</div></TooltipTrigger><TooltipContent><p>{item.name || item.description || item.tokenAddress}</p></TooltipContent></Tooltip>
                </TableCell>
                <TableCell className="text-xs">{item.symbol || '-'}</TableCell>
                <TableCell className="text-xs">{item.chainId}</TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-1"><span className="truncate" title={item.tokenAddress}>{truncateAddress(item.tokenAddress)}</span><Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => item.tokenAddress && handleCopyAddress(item.tokenAddress)}><Copy className="h-3 w-3"/></Button></div>
                </TableCell>
                {isBoost && 'amount' in item && <TableCell className="text-right text-xs">{formatLargeNumber((item as TokenBoostItem).amount)}</TableCell>}
                {isBoost && 'totalAmount' in item && <TableCell className="text-right text-xs">{formatLargeNumber((item as TokenBoostItem).totalAmount)}</TableCell>}
                <TableCell className="text-center">{renderDescriptionInteraction(item.description)}</TableCell>
                <TableCell className="text-center">{renderLinksDropdown(item.links)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Render Token Orders
    if (selectedView === 'tokenOrders') {
      const items = data as OrderInfoItem[];
      if (!Array.isArray(items) || items.length === 0) {
        return <div className="flex items-center justify-center h-full p-4"><p className="text-muted-foreground">No orders found for this token on the specified chain.</p></div>;
      }
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payment Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={`${item.type}-${item.paymentTimestamp}-${index}`}>
                <TableCell className="font-medium text-xs">{item.type}</TableCell>
                <TableCell className="text-xs">{item.status}</TableCell>
                <TableCell className="text-right text-xs">{format(fromUnixTime(item.paymentTimestamp), 'PPpp')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    
    // Render Pair Details (covers pairDetailsByPairAddress, searchPairs, tokenPairPools, pairsByTokenAddresses)
    if (['pairDetailsByPairAddress', 'searchPairs', 'tokenPairPools', 'pairsByTokenAddresses'].includes(selectedView)) {
        let pairsArray: PairDetail[] = [];
        // Handle both PairData (object with 'pairs' array) and PairDetail[] (direct array)
        if (data && 'pairs' in data && Array.isArray((data as PairData).pairs)) { 
            pairsArray = (data as PairData).pairs;
        } else if (data && Array.isArray(data)) { 
            pairsArray = data as PairDetail[];
        }

        if (pairsArray.length === 0) {
             return <div className="flex items-center justify-center h-full p-4"><p className="text-muted-foreground">No pairs found for this query.</p></div>;
        }

        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">Icon</TableHead>
                <TableHead>Pair</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>DEX</TableHead>
                <TableHead className="text-right">Price USD</TableHead>
                <TableHead className="text-right">Volume (24h)</TableHead>
                <TableHead className="text-right">Liquidity</TableHead>
                <TableHead className="text-right">Market Cap</TableHead>
                <TableHead className="w-[80px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairsArray.map((pair, index) => (
                <TableRow key={`${pair.pairAddress}-${index}`}>
                  <TableCell>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={pair.info?.imageUrl || undefined} alt={pair.baseToken?.name || 'Pair Image'} />
                      <AvatarFallback>{(pair.baseToken?.symbol || 'P').substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                     <Tooltip delayDuration={100}><TooltipTrigger asChild><div className="truncate" title={`${pair.baseToken?.name || 'N/A'} / ${pair.quoteToken?.name || 'N/A'}`}>{pair.baseToken?.symbol || 'N/A'}/{pair.quoteToken?.symbol || 'N/A'}</div></TooltipTrigger><TooltipContent><p>{pair.baseToken?.name || 'N/A'} / {pair.quoteToken?.name || 'N/A'}</p><p className="text-muted-foreground text-xs">{pair.pairAddress}</p></TooltipContent></Tooltip>
                  </TableCell>
                  <TableCell className="text-xs">{pair.chainId}</TableCell>
                  <TableCell className="text-xs">{pair.dexId}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(pair.priceUsd, 6)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(pair.volume?.h24)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(pair.liquidity?.usd)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(pair.marketCap)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                       {renderPairInfoDialog(pair)}
                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyAddress(pair.pairAddress)}><Copy className="h-3 w-3"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
    }

    return <div className="p-4 text-muted-foreground">Select a view to see data.</div>;
  };
  
  const viewOptions = [
    { value: 'profiles', label: 'Latest Profiles', icon: <PackageSearch className="mr-2 h-4 w-4" /> },
    { value: 'latestBoosts', label: 'Latest Boosts', icon: <TrendingUp className="mr-2 h-4 w-4" /> },
    { value: 'topBoosts', label: 'Top Boosts', icon: <ListFilter className="mr-2 h-4 w-4" /> },
    { value: 'tokenOrders', label: 'Token Orders', icon: <ReceiptText className="mr-2 h-4 w-4" /> },
    { value: 'pairDetailsByPairAddress', label: 'Pair by Address', icon: <Layers className="mr-2 h-4 w-4" /> },
    { value: 'searchPairs', label: 'Search Pairs', icon: <Search className="mr-2 h-4 w-4" /> },
    { value: 'tokenPairPools', label: 'Token Pools', icon: <GitFork className="mr-2 h-4 w-4" /> },
    { value: 'pairsByTokenAddresses', label: 'Pairs by Tokens', icon: <PackageSearch className="mr-2 h-4 w-4" /> }, // Re-used PackageSearch icon, consider a different one
  ];


  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SearchCode className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">DEX Screener API</CardTitle>
        </div>
        <CardDescription className="text-xs mt-1">Select a view and provide inputs if required.</CardDescription>
        <RadioGroup
          value={selectedView}
          onValueChange={(value) => setSelectedView(value as DexScreenerViewType)}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-2 pt-3"
        >
          {viewOptions.map(opt => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={opt.value} />
              <Label htmlFor={opt.value} className="cursor-pointer font-normal text-xs flex items-center">
                {opt.icon} {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
         <div className="pt-3">{renderInputSection()}</div>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-2 bg-muted/20">
        {renderTable()}
      </CardContent>
    </Card>
  );
};

export default DexScreenerContent;
