import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

const BlogContent: React.FC = () => {
  return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <CardTitle>Blog</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">Insights, articles, and updates from the TradeFlow team.</p>
        <div className="border p-4 rounded-lg bg-card-foreground/5">
            <h3 className="text-xl font-semibold mb-2">Market Trends Q3 2024</h3>
            <Image src="https://placehold.co/600x300.png" alt="Market Trends" data-ai-hint="finance charts" width={600} height={300} className="rounded-md mb-2" />
            <p>An in-depth look at the prevailing cryptocurrency market trends for the third quarter of 2024. We cover major movers, regulatory news, and technological advancements...</p>
            <p className="text-sm text-muted-foreground mt-2">Posted on: October 26, 2023</p>
        </div>
        <div className="border p-4 rounded-lg bg-card-foreground/5">
            <h3 className="text-xl font-semibold mb-2">Understanding DeFi Staking</h3>
            <Image src="https://placehold.co/600x300.png" alt="DeFi Staking" data-ai-hint="blockchain technology" width={600} height={300} className="rounded-md mb-2" />
            <p>A beginner's guide to decentralized finance (DeFi) staking. Learn how to earn passive income with your crypto assets, understand the risks, and choose the right platforms...</p>
            <p className="text-sm text-muted-foreground mt-2">Posted on: October 15, 2023</p>
        </div>
        <p className="text-center text-lg font-semibold py-8">More content coming soon!</p>
      </CardContent>
    </Card>
  );
};

export default BlogContent;
