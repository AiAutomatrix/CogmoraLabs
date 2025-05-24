
'use client';
import type React from 'react';
import type { TokenProfileItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Link2 } from 'lucide-react';

interface TokenProfileCardProps {
  profile: TokenProfileItem;
}

const TokenProfileCard: React.FC<TokenProfileCardProps> = ({ profile }) => {
  return (
    <Card className="w-full shadow-lg break-inside-avoid-column mb-4">
      {profile.header && (
        <div className="relative h-32 w-full">
          <Image
            src={profile.header}
            alt={`${profile.description || 'Token'} header`}
            fill // Changed from layout="fill" for Next.js v13+
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Optional: provide sizes for better optimization
            style={{ objectFit: 'cover' }} // Changed from objectFit="cover"
            className="rounded-t-lg"
            data-ai-hint="abstract background"
          />
        </div>
      )}
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pt-4">
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={profile.icon ?? `https://placehold.co/64.png`} alt={profile.description || 'Token icon'} data-ai-hint="token logo" />
          <AvatarFallback>{(profile.description || 'NA').substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0"> {/* Added min-w-0 for flex child to allow truncation/wrapping */}
          <CardTitle className="text-lg">
            <a href={profile.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
              {profile.description || 'Unnamed Profile'}
            </a>
          </CardTitle>
          {profile.tokenAddress && ( // Ensure tokenAddress exists before rendering
            <CardDescription className="text-xs text-muted-foreground truncate"> {/* Added truncate for long addresses */}
              {profile.chainId} - {profile.tokenAddress}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-3 pt-2"> {/* Added more space with space-y-3 and adjusted pt */}
        {profile.description && <p className="text-muted-foreground line-clamp-3">{profile.description}</p>}
        {profile.links && profile.links.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1.5 text-xs">Links:</h4> {/* Increased mb */}
            <div className="flex flex-wrap gap-2">
              {profile.links.map((link, index) => (
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

export default TokenProfileCard;
