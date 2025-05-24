// Placeholder for TokenProfileCard.tsx
// This component will display a single token profile.
// We will implement this in the next step.
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
            layout="fill"
            objectFit="cover"
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
        <div className="flex-1">
          <CardTitle className="text-lg">
            <a href={profile.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {profile.description || 'Unnamed Profile'}
            </a>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {profile.chainId} - {profile.tokenAddress}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {profile.description && <p className="text-muted-foreground line-clamp-3">{profile.description}</p>}
        {profile.links && profile.links.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1 text-xs">Links:</h4>
            <div className="flex flex-wrap gap-2">
              {profile.links.map((link, index) => (
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

export default TokenProfileCard;
