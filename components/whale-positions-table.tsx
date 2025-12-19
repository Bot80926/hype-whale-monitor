"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhalePosition {
  user: string;
  symbol: string;
  positionSize: number;
  entryPrice: number;
  markPrice: number;
  liqPrice: number;
  leverage: number;
  marginBalance: number;
  positionValueUsd: number;
  unrealizedPnL: number;
  fundingFee: number;
  marginMode: string;
  createTime: number;
  updateTime: number;
}

export function WhalePositionsTable() {
  const [positions, setPositions] = useState<WhalePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
        try {
            // Only set loading on initial load to avoid flickering during refresh
            if (positions.length === 0) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            
            const res = await fetch("/api/whale-positions");
            if (!res.ok) throw new Error("Failed to fetch data");
            
            const result = await res.json();
            if (result.code === 0 && Array.isArray(result.data)) {
                setPositions(result.data);
                setError(null);
            } else {
                throw new Error("Invalid data format");
            }
        } catch (err) {
          setError("Failed to load whale positions");
          console.error(err);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
    };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: number, minimumFractionDigits = 0, maximumFractionDigits = 0) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(val);
  };
  
  const formatNumber = (val: number, maximumFractionDigits = 2) => {
      return new Intl.NumberFormat("en-US", {
          maximumFractionDigits
      }).format(val);
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [pnlFilter, setPnlFilter] = useState<'all' | 'profit' | 'loss'>('all');

  // Filter positions
  const filteredPositions = positions.filter(pos => {
    const isLong = pos.positionSize > 0;
    const isProfit = pos.unrealizedPnL > 0;
    const isLoss = pos.unrealizedPnL < 0;

    if (sideFilter === 'long' && !isLong) return false;
    if (sideFilter === 'short' && isLong) return false;

    if (pnlFilter === 'profit' && !isProfit) return false;
    if (pnlFilter === 'loss' && !isLoss) return false;

    return true;
  });

  // Calculate stats from ALL positions (to give context)
  const stats = positions.reduce((acc, pos) => {
    const isLong = pos.positionSize > 0;
    const value = pos.positionValueUsd;
    
    if (isLong) {
        acc.longCount++;
        acc.longValue += value;
    } else {
        acc.shortCount++;
        acc.shortValue += value;
    }
    return acc;
  }, { longCount: 0, longValue: 0, shortCount: 0, shortValue: 0 });

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    Whale Positions
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (Top 50)
                    </span>
                </CardTitle>
                <div className="flex items-center gap-3">
                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {/* Status text if needed, effectively simpler to just use button spinner */}
                        {(loading || refreshing) && (
                            <span className="flex items-center gap-1 text-primary">
                            <span className="relative flex h-2 w-2 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            Updating...
                            </span>
                        )}
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading || refreshing}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <svg
                            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Stats & Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/40">
                {/* Stats Summary */}
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-emerald-500/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Longs</span>
                        <div className="flex flex-col leading-none">
                            <span className="text-sm font-semibold text-emerald-400">{stats.longCount}</span>
                        </div>
                         <span className="text-xs text-muted-foreground">({formatNumber(stats.longValue/1000000, 1)}M)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-rose-500/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-sm bg-rose-500" />
                        </div>
                        <span className="text-sm text-muted-foreground">Shorts</span>
                         <div className="flex flex-col leading-none">
                            <span className="text-sm font-semibold text-rose-400">{stats.shortCount}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">({formatNumber(stats.shortValue/1000000, 1)}M)</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Side:</span>
                        <div className="flex rounded-md overflow-hidden border border-border/50">
                            <button onClick={() => setSideFilter('all')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", sideFilter === 'all' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>ALL</button>
                            <button onClick={() => setSideFilter('long')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", sideFilter === 'long' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>LONG</button>
                            <button onClick={() => setSideFilter('short')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", sideFilter === 'short' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>SHORT</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">PnL:</span>
                        <div className="flex rounded-md overflow-hidden border border-border/50">
                             <button onClick={() => setPnlFilter('all')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", pnlFilter === 'all' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>ALL</button>
                            <button onClick={() => setPnlFilter('profit')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", pnlFilter === 'profit' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>PROFIT</button>
                            <button onClick={() => setPnlFilter('loss')} className={cn("px-2.5 py-1 text-xs font-medium transition-colors", pnlFilter === 'loss' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>LOSS</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-md border-0">
             {loading && positions.length === 0 ? (
                 <div className="p-4 space-y-3">
                     {[...Array(5)].map((_, i) => (
                         <Skeleton key={i} className="h-10 w-full" />
                     ))}
                 </div>
             ) : error ? (
                 <div className="p-8 text-center text-muted-foreground">{error}</div>
             ) : (
                <div className="overflow-x-auto -mx-6">
                <Table>
                    <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/30">
                        <TableHead className="w-[140px] pl-6">User</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead className="text-right">Size (HYPE)</TableHead>
                        <TableHead className="text-right">Entry Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Unrealized PnL</TableHead>
                        <TableHead className="text-right pr-6">Time</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredPositions.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                No positions match the filter
                            </TableCell>
                        </TableRow>
                    ) : (
                     filteredPositions.map((pos, idx) => {
                        const isLong = pos.positionSize > 0;
                        const pnlColor = pos.unrealizedPnL > 0 ? "text-emerald-400" : pos.unrealizedPnL < 0 ? "text-rose-400" : "text-muted-foreground";
                        
                        return (
                        <TableRow key={`${pos.user}-${idx}`} className="border-border/20 hover:bg-primary/5 transition-colors group">
                            <TableCell className="font-mono text-xs pl-6">
                                <a 
                                    href={`https://hypurrscan.io/address/${pos.user}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 hover:text-primary transition-colors group"
                                >
                                    {shortenAddress(pos.user)}
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                            </TableCell>
                            <TableCell>
                                <span className={cn("inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border", 
                                    isLong ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                )}>
                                    {isLong ? "LONG" : "SHORT"}
                                </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-foreground/90">
                                {formatNumber(Math.abs(pos.positionSize))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                {formatCurrency(pos.entryPrice, 2, 4)}
                            </TableCell>
                             <TableCell className="text-right font-mono text-sm font-medium">
                                {formatCurrency(pos.positionValueUsd)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono text-sm font-medium", pnlColor)}>
                                {pos.unrealizedPnL > 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnL)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground pr-6">
                                {formatTime(pos.createTime)}
                            </TableCell>
                        </TableRow>
                        );
                    })
                    )}
                    </TableBody>
                </Table>
                </div>
             )}
        </div>
      </CardContent>
    </Card>
  );
}
