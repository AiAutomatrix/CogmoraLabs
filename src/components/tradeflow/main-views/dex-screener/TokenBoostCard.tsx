// Placeholder for TokenBoostCard.tsx
// This component will display a single token boost.
// We will implement this in the next step.
'use client';
import type React from 'react';
import type { TokenBoostItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Zap, Link2 } from 'lucide-react';

interface TokenBoostCardProps {
  boost: TokenBoostItem;
}

const TokenBoostCard: React.FC<TokenBoostCardProps> = ({ boost }) => {
  return (
    <Card className="w-full shadow-lg break-inside-avoid-column mb-4">
      {boost.header && (
        <div className="relative h-32 w-full">
          <Image
            src={boost.header}
            alt={`${boost.description || 'Token'} header`}
            layout="fill"
            objectFit="cover"
            className="rounded-t-lg"
            data-ai-hint="abstract background"
          />
        </div>
      )}
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pt-4">
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={boost.icon ?? `https://placehold.co/64.png`} alt={boost.description || 'Token icon'} data-ai-hint="token logo" />
          <AvatarFallback>{(boost.description || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-lg">
             <a href={boost.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {boost.description || 'Unnamed Boost'}
            </a>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {boost.chainId} - {boost.tokenAddress}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {boost.description && <p className="text-muted-foreground line-clamp-3">{boost.description}</p>}
        <div className="flex items-center space-x-2 text-xs">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span>Boost Amount: {boost.amount?.toLocaleString() ?? 'N/A'}</span>
            <span>Total Amount: {boost.totalAmount?.toLocaleString() ?? 'N/A'}</span>
        </div>
        {boost.links && boost.links.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1 text-xs">Links:</h4>
            <div className="flex flex-wrap gap-2">
              {boost.links.map((link, index) => (
                <Button key={index} variant="outline" size="sm" asChild>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <Link2 className="mr-1 h-3 w-3" /> {link.label || link.type}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenBoostCard;
