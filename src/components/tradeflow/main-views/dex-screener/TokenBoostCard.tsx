
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
            fill // Changed from layout="fill" for Next.js v13+
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Optional: provide sizes
            style={{ objectFit: 'cover' }} // Changed from objectFit="cover"
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
        <div className="flex-1 min-w-0"> {/* Added min-w-0 for flex child to allow truncation/wrapping */}
          <CardTitle className="text-lg">
             <a href={boost.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
              {boost.description || 'Unnamed Boost'}
            </a>
          </CardTitle>
          {boost.tokenAddress && ( // Ensure tokenAddress exists
            <CardDescription className="text-xs text-muted-foreground truncate"> {/* Added truncate for long addresses */}
              {boost.chainId} - {boost.tokenAddress}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-3 pt-2"> {/* Added more space with space-y-3 and adjusted pt */}
        {boost.description && <p className="text-muted-foreground line-clamp-3">{boost.description}</p>}
        {(boost.amount !== null && boost.amount !== undefined) && ( // Check for null/undefined before displaying
          <div className="flex items-center space-x-2 text-xs pt-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">Boost:</span>
              <span>{boost.amount?.toLocaleString() ?? 'N/A'}</span>
              { (boost.totalAmount !== null && boost.totalAmount !== undefined) && (<> {/* Check for null/undefined */}
                <span className="font-medium ml-2">Total:</span>
                <span>{boost.totalAmount?.toLocaleString() ?? 'N/A'}</span>
              </>)}
          </div>
        )}
        {boost.links && boost.links.length > 0 && (
          <div className="pt-1"> {/* Added pt-1 for spacing */}
            <h4 className="font-semibold mb-1.5 text-xs">Links:</h4> {/* Increased mb */}
            <div className="flex flex-wrap gap-2">
              {boost.links.map((link, index) => (
                <Button key={index} variant="outline" size="sm" asChild className="overflow-hidden">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center w-full px-1">
                    <Link2 className="mr-1 h-3 w-3 flex-shrink-0" />
                    <span className="truncate text-left">{link.label || link.type}</span>
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
