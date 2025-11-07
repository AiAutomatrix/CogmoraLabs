
'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const images = [
    '/mobile/agentInput.jpg',
    '/mobile/agentPlan.jpg',
    '/mobile/agentSettings.jpg',
    '/mobile/dexCoinInfo.jpg',
    '/mobile/dexToken.jpg',
    '/mobile/dexTop.jpg',
    '/mobile/fundingRate.jpg',
    '/mobile/futureScreener.jpg',
    '/mobile/heatmap.jpg',
    '/mobile/tradeHistory.jpg',
    '/mobile/watchlist.jpg',
];

// We duplicate the array to create a seamless loop
const allImages = [...images, ...images];

const ImageCarousel: React.FC = () => {
    return (
        <section className="py-20 px-4 bg-background">
            <div className="container mx-auto text-center">
                <h2 className="text-4xl font-bold mb-4">Mobile Interface Showcase</h2>
                <p className="text-muted-foreground mb-12 max-w-3xl mx-auto">
                    A glimpse into the responsive and feature-rich mobile experience. The entire platform is designed to be fully functional on the go.
                </p>
                <div
                    className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]"
                >
                    <ul className="flex items-center justify-center md:justify-start [&_li]:mx-4 [&_img]:max-w-none animate-scroll">
                        {allImages.map((src, index) => (
                            <li key={index} className="flex-shrink-0">
                                <div className="relative w-[250px] h-[500px] rounded-2xl overflow-hidden border-4 border-muted/50 shadow-lg">
                                    <Image
                                        src={src}
                                        alt={`Mobile screenshot ${index + 1}`}
                                        layout="fill"
                                        objectFit="cover"
                                        className="rounded-xl"
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
};

export default ImageCarousel;
