"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Bell, AlertTriangle } from "lucide-react";
import type { EnrichedTwap, TwapsApiResponse } from "@/lib/types";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimeRemaining(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatSize(size: string): string {
  const num = parseFloat(size);
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(2);
}

export function TwapTable() {
  const [twaps, setTwaps] = useState<EnrichedTwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [hypePrice, setHypePrice] = useState<number | null>(null);
  const [hypeSpotPrice, setHypeSpotPrice] = useState<number | null>(null);
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [marketFilter, setMarketFilter] = useState<"ALL" | "PERP" | "SPOT">("ALL");
  const previousTwapIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const playVoiceAlert = (message: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "zh-CN";
      window.speechSynthesis.speak(utterance);
    }
  };

  const fetchTwaps = async () => {
    if (!loading) setRefreshing(true);
    try {
      const response = await fetch("/api/twaps");
      if (!response.ok) {
        throw new Error("Failed to fetch TWAPs");
      }
      const data: TwapsApiResponse = await response.json();
      
      // Alert logic for new large HYPE orders
      if (!isFirstLoad.current) {
        const newTwaps = data.twaps.filter(t => !previousTwapIds.current.has(t.id));
        newTwaps.forEach(twap => {
          if (twap.token === "HYPE" && twap.sizeUsd >= 500000) {
            const sideText = twap.side === "BUY" ? "Buy" : "Sell";
            const amountText = (twap.sizeUsd / 100000).toFixed(0);
            const msg = `Large HYPE ${twap.marketType === 'SPOT' ? 'Spot' : 'Perp'} ${sideText} order, value $${Number(amountText)}00k`;
            toast.success(msg, {
              icon: <Bell className="w-4 h-4" />,
              duration: 15000,
              description: `User: ${formatAddress(twap.user)} | Size: ${formatSize(twap.size)} HYPE`,
            });
            
            playVoiceAlert(msg);
          }
        });
      }

      // Update seen IDs
      previousTwapIds.current = new Set(data.twaps.map(t => t.id));
      isFirstLoad.current = false;

      setTwaps(data.twaps);
      setLastUpdated(data.lastUpdated);
      setHypePrice(data.hypePrice || null);
      setHypeSpotPrice(data.hypeSpotPrice || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTwaps();
    const interval = setInterval(fetchTwaps, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter twaps
  const filteredTwaps = twaps.filter((t) => {
    if (sideFilter !== "ALL" && t.side !== sideFilter) return false;
    if (marketFilter !== "ALL" && t.marketType !== marketFilter) return false;
    return true;
  });

  // Calculate totals from filtered data
  const buyTotal = filteredTwaps
    .filter((t) => t.side === "BUY")
    .reduce((sum, t) => sum + t.sizeUsd, 0);
  const sellTotal = filteredTwaps
    .filter((t) => t.side === "SELL")
    .reduce((sum, t) => sum + t.sizeUsd, 0);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            Active HYPE TWAPs
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({twaps.length})
            </span>
            {hypePrice && (
              <div className="ml-4 flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Perp</span>
                  <span className="text-sm font-mono text-primary font-bold">${hypePrice.toFixed(2)}</span>
                </div>
                {hypeSpotPrice && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Spot</span>
                    <span className="text-sm font-mono text-amber-500 font-bold">${hypeSpotPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* <span>Last update:</span>
              <span className="font-medium text-foreground/80">
                {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}
              </span> */}
              {refreshing && (
                <span className="flex items-center gap-1 text-primary">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Loading...
                </span>
              )}
            </div>
            <button
              onClick={fetchTwaps}
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

        {/* Summary Stats and Filters */}
        {twaps.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-border/40">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                </div>
                <span className="text-sm text-muted-foreground">Buy</span>
                <span className="text-sm font-semibold text-emerald-400">
                  {formatUsd(buyTotal)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-rose-500/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-sm bg-rose-500" />
                </div>
                <span className="text-sm text-muted-foreground">Sell</span>
                <span className="text-sm font-semibold text-rose-400">
                  {formatUsd(sellTotal)}
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Side:</span>
                <div className="flex rounded-md overflow-hidden border border-border/50">
                  {(["ALL", "BUY", "SELL"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSideFilter(option)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        sideFilter === option
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Market:</span>
                <div className="flex rounded-md overflow-hidden border border-border/50">
                  {(["ALL", "PERP", "SPOT"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setMarketFilter(option)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        marketFilter === option
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="text-destructive mb-2">Error</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        ) : filteredTwaps.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <div className="text-muted-foreground">
              {twaps.length === 0 ? "No active HYPE TWAPs" : "No matching TWAPs"}
            </div>
            <div className="text-sm text-muted-foreground/60 mt-1">
              {twaps.length === 0 ? "Check back later for new orders" : "Try adjusting the filters"}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/30">
                  <TableHead className="w-[70px] pl-6">Side</TableHead>
                  <TableHead className="w-[70px]">Market</TableHead>
                  <TableHead className="w-[120px]">Value</TableHead>
                  <TableHead className="text-right w-[110px]">HYPE Amount</TableHead>
                  <TableHead className="w-[110px]">Created At</TableHead>
                  <TableHead className="w-[130px]">Wallet</TableHead>
                  <TableHead className="text-right pr-6">
                    Time Remaining
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTwaps.map((twap) => {
                  const progress = Math.max(
                    0,
                    Math.min(
                      100,
                      ((twap.durationMinutes - twap.timeRemainingMinutes) /
                        twap.durationMinutes) *
                        100
                    )
                  );

                  return (
                    <TableRow
                      key={twap.id}
                      className="border-border/20 hover:bg-primary/5 transition-colors group"
                    >
                      <TableCell className="pl-6">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                            twap.side === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {twap.side}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            twap.marketType === "SPOT"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {twap.marketType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`${twap.sizeUsd >= 1000000 ? "text-amber-400 font-bold" : "font-semibold"} text-foreground`}>
                            ${twap.sizeUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {twap.sizeUsd >= 1000000 && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm text-muted-foreground">
                          {formatSize(twap.size)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(twap.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'  })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://hypurrscan.io/address/${twap.user}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          {formatAddress(twap.user)}
                          <svg
                            className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-20 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-700"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground min-w-[50px] text-right">
                            {formatTimeRemaining(twap.timeRemainingMinutes)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
