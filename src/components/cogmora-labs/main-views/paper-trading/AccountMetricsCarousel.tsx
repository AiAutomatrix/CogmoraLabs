"use client";
import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { usePaperTrading } from "@/context/PaperTradingContext";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const chartConfig = {
  equity: {
    label: "Equity",
    color: "hsl(var(--primary))",
  },
  pnl: {
    label: "P&L",
  },
} satisfies ChartConfig;

export default function AccountMetricsCarousel() {
  const {
    balance,
    equity,
    unrealizedPnl,
    realizedPnl,
    winRate,
    wonTrades,
    lostTrades,
    equityData,
    recentPnlData,
    allocationData,
  } = usePaperTrading();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground text-xs">
              Trade #{label + 1}
            </span>
            <span className="font-bold text-lg">
              {formatCurrency(payload[0].value)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const AllocationTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="flex flex-col space-y-1">
            <span className="font-bold text-base">{data.name}</span>
            <span className="text-muted-foreground text-xs">
              Value: {formatCurrency(data.value)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Carousel opts={{ align: "start" }} className="w-full">
      <CarouselContent className="-ml-2">

        {/* SLIDE 1 — ACCOUNT METRICS */}
        <CarouselItem className="basis-full md:basis-1/2 lg:basis-1/3 pl-2">
          <div className="p-1">
            <Card className="h-[460px] flex flex-col">
              <CardContent className="flex flex-col h-full flex-grow p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Account Equity</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(equity)}
                  </p>
                </div>

                <div className="flex-grow min-h-0 mt-2 -mx-4">
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <AreaChart
                      data={equityData}
                      margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorEquity"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <Tooltip
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelKey="name"
                          />
                        }
                        cursor={false}
                      />

                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="hsl(var(--primary))"
                        fill="url(#colorEquity)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Available Cash
                    </span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unrealized P&L</span>
                    <span
                      className={
                        unrealizedPnl >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {formatCurrency(unrealizedPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span>{formatPercent(winRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Realized P&L</span>
                    <span
                      className={
                        realizedPnl >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {formatCurrency(realizedPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">
                      Won / Lost Trades
                    </span>
                    <span>
                      <span className="text-green-500">{wonTrades}</span> /{" "}
                      <span className="text-red-500">{lostTrades}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CarouselItem>

        {/* SLIDE 2 — RECENT PNL */}
        <CarouselItem className="basis-full md:basis-1/2 lg:basis-1/3 pl-2">
          <div className="p-1">
            <Card className="h-[460px] flex flex-col">
              <CardContent className="flex flex-col h-full flex-grow p-4">
                <p className="text-sm font-semibold">Recent Trade P&L</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Profit &amp; Loss from the last 20 trades.
                </p>

                <div className="flex-grow min-h-0">
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <BarChart data={recentPnlData}>
                      <defs>
                        <linearGradient id="gradientWin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                         <linearGradient id="gradientLoss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#eab308" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(var(--muted), 0.5)' }}/>
                      <Bar dataKey="pnl">
                        {recentPnlData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.pnl >= 0 ? "url(#gradientWin)" : "url(#gradientLoss)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </CarouselItem>

        {/* SLIDE 3 — ALLOCATION */}
        <CarouselItem className="basis-full md:basis-1/2 lg:basis-1/3 pl-2">
          <div className="p-1">
            <Card className="h-[460px] flex flex-col">
              <CardContent className="flex flex-col h-full flex-grow p-4">
                <p className="text-sm font-semibold">Asset Allocation</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Distribution of your open positions.
                </p>

                <div className="flex-grow min-h-0">
                  <ChartContainer config={chartConfig} className="w-full h-full">
                    <PieChart>
                      <Tooltip content={<AllocationTooltip />} />
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        dataKey="value"
                        nameKey="name"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-3 overflow-y-auto">
                  {allocationData.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 truncate"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="truncate">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </CarouselItem>

      </CarouselContent>

      <CarouselPrevious className="hidden md:flex" />
      <CarouselNext className="hidden md:flex" />
    </Carousel>
  );
}