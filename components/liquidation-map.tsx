"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, RefreshCw } from "lucide-react";
import type { LiquidationMapResponse, LiquidationHeatmapEntry } from "@/lib/types";

interface LiquidationMapProps {
  data: LiquidationMapResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

export function LiquidationMap({ data, loading, refreshing, error, fetchData }: LiquidationMapProps) {
  const [hoveredBin, setHoveredBin] = useState<LiquidationHeatmapEntry | null>(null);

  // We still use useMemo for processing data within the component

  const chartData = useMemo(() => {
    if (!data?.heatmap) return [];
    const sorted = [...data.heatmap].sort((a, b) => a.priceBinStart - b.priceBinStart);
    const currentPrice = data.hypePrice || 0;
    
    // Split into longs (price < current) and shorts (price > current)
    const longs = sorted.filter(bin => bin.priceBinEnd <= currentPrice).reverse();
    const shorts = sorted.filter(bin => bin.priceBinStart > currentPrice);

    // Calculate cumulative values starting from current price outwards
    let longCumulative = 0;
    const enrichedLongs = longs.map(bin => {
      longCumulative += bin.liquidationValue;
      return { ...bin, cumulativeValue: longCumulative, side: 'long' as const };
    }).reverse();

    let shortCumulative = 0;
    const enrichedShorts = shorts.map(bin => {
      shortCumulative += bin.liquidationValue;
      return { ...bin, cumulativeValue: shortCumulative, side: 'short' as const };
    });

    return [...enrichedLongs, ...enrichedShorts];
  }, [data]);

  const stats = useMemo(() => {
    if (!chartData.length) return { maxVal: 0, maxCum: 0, minPrice: 0, maxPrice: 0 };
    return {
      maxVal: Math.max(...chartData.map((d) => d.liquidationValue)),
      maxCum: Math.max(...chartData.map((d) => (d as any).cumulativeValue)),
      minPrice: chartData[0].priceBinStart,
      maxPrice: chartData[chartData.length - 1].priceBinEnd,
    };
  }, [chartData]);

  const getPricePosition = (price: number) => {
    if (!stats.maxPrice || stats.maxPrice === stats.minPrice) return 0;
    return ((price - stats.minPrice) / (stats.maxPrice - stats.minPrice)) * 100;
  };

  const formatUsd = (value: number) => {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            HYPE Liquidation Heatmap
            {data?.hypePrice && (
              <span className="ml-2 px-2 py-0.5 rounded bg-primary/10 text-primary text-sm font-mono font-bold border border-primary/20">
                ${data.hypePrice.toFixed(3)}
              </span>
            )}
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Estimated
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {/* <span>Last update:</span>
              <span className="font-medium text-foreground/80">
                {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : "—"}
              </span> */}
              {refreshing && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
            </div>
            <button
              onClick={fetchData}
              disabled={loading || refreshing}
              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="h-[320px] relative mt-2 px-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Info className="w-8 h-8 opacity-20" />
            <span className="text-sm">{error}</span>
          </div>
        ) : (
          <div className="h-full flex flex-col pt-4">
            {/* Legend / Tooltip info */}
            <div className="h-8 mb-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {hoveredBin ? (
                  <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className={`px-2 py-0.5 rounded border font-bold ${(hoveredBin as any).side === 'long' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                      {(hoveredBin as any).side === 'long' ? 'Long Liq' : 'Short Liq'}: ${hoveredBin.priceBinStart.toFixed(2)}
                    </span>
                    <span className="text-foreground font-semibold">
                      Value: {formatUsd(hoveredBin.liquidationValue)}
                    </span>
                    <span className={`font-medium ${(hoveredBin as any).side === 'long' ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                      Cumulative: {formatUsd((hoveredBin as any).cumulativeValue)}
                    </span>
                  </div>
                ) : (
                  "Hover over bars for liquidation details"
                )}
              </div>
              <div className="hidden sm:flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                  <span>Longs</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-500">
                  <div className="w-2 h-2 rounded-sm bg-red-500" />
                  <span>Shorts</span>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 relative flex items-end">
              {/* Cumulative Area Chart (SVG Background) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="longGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="shortGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                
                {/* Longs Area */}
                <path
                  d={`M 0 300 ${chartData.filter(d => (d as any).side === 'long').map((d, i, arr) => 
                    `L ${(chartData.indexOf(d) / (chartData.length - 1)) * 100}% ${300 - ((d as any).cumulativeValue / stats.maxCum) * 280}`
                  ).join(" ")} L ${(chartData.filter(d => (d as any).side === 'long').length / (chartData.length - 1)) * 100}% 300 Z`}
                  fill="url(#longGradient)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  className="opacity-40"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Shorts Area */}
                <path
                  d={`M ${(chartData.findIndex(d => (d as any).side === 'short') / (chartData.length - 1)) * 100}% 300 ${chartData.filter(d => (d as any).side === 'short').map((d, i) => 
                    `L ${(chartData.indexOf(d) / (chartData.length - 1)) * 100}% ${300 - ((d as any).cumulativeValue / stats.maxCum) * 280}`
                  ).join(" ")} L 100% 300 Z`}
                  fill="url(#shortGradient)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  className="opacity-40"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Individual Liquidation Bars */}
              <div className="flex items-end gap-[1px] w-full h-full relative z-10">
                {chartData.map((bin, i) => {
                  const isLong = (bin as any).side === 'long';
                  const color = isLong ? "#10b981" : "#ef4444";
                  
                  const height = bin.liquidationValue > 0 
                    ? `${Math.max(2, (bin.liquidationValue / stats.maxVal) * 90)}%` 
                    : "0%";
                  
                  const opacity = Math.max(0.15, (bin.liquidationValue / stats.maxVal));

                  return (
                    <div
                      key={i}
                      className="flex-1 h-full flex flex-col justify-end group cursor-crosshair relative"
                      onMouseEnter={() => setHoveredBin(bin)}
                      onMouseLeave={() => setHoveredBin(null)}
                    >
                      <div
                        className="w-full rounded-t-[1px] transition-all duration-300 group-hover:opacity-100 ring-currentColor group-hover:ring-2"
                        style={{
                          height,
                          backgroundColor: color,
                          opacity: hoveredBin === bin ? 1 : opacity,
                        }}
                      />
                      
                      {(i % Math.floor(chartData.length / 8) === 0 || i === chartData.length - 1) && (
                        <div className="absolute -bottom-6 left-0 transform -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                          ${bin.priceBinStart.toFixed(1)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current Price Line */}
              {data?.hypePrice && (
                <div 
                  className="absolute top-0 bottom-0 w-px bg-white/50 shadow-[0_0_8px_rgba(255,255,255,0.5)] z-20 pointer-events-none transition-all duration-500"
                  style={{ left: `${getPricePosition(data.hypePrice)}%` }}
                >
                  <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-lg" />
                  <div className="absolute top-2 left-2 bg-white text-black text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap opacity-80">
                    ${data.hypePrice.toFixed(3)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-8" /> 
          </div>
        )}
      </CardContent>
    </Card>
  );
}
