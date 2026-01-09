
"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { SimulatedPositionsTable, SimulatedPosition } from "@/components/simulated-positions-table";
import { EnrichedTwap, TwapsApiResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayCircle, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SimulatorPage() {
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [twaps, setTwaps] = useState<EnrichedTwap[]>([]);
  const [hypePrice, setHypePrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastDenseTriggerRef = useRef<{ BUY: number; SELL: number }>({ BUY: 0, SELL: 0 });

  // Fetch Positions
  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/simulator/positions", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPositions(data);
      }
    } catch (e) {
      console.error("Failed to fetch positions", e);
    }
  };

  // Fetch Data (Twaps + Price)
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/twaps", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch Data");
      const data: TwapsApiResponse = await res.json();
      
      setTwaps(data.twaps);
      if (data.hypePrice) setHypePrice(data.hypePrice);
      setError(null);
      
      // Check Triggers (Passing latest positions for DB-backed trigger tracking)
      checkTriggers(data.twaps, data.hypePrice || 0, positions);

      // Check Active Positions PnL
      checkPositionsPnL(data.hypePrice || 0);

    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Manual Refresh
  const handleRefresh = () => {
    fetchPositions();
    fetchData();
    toast.success("Data refreshed");
  };

  // Open Position Helper
  const openPosition = async (direction: "BUY" | "SELL", price: number, triggerId?: string, endTime?: string) => {
    if (price <= 0) return;
    
    // Optimistic UI update? No, safer to wait DB.
    if (!triggerId) {
        toast.info(`Triggered Simulated ${direction} Position at $${price.toFixed(4)}`);
    }

    try {
      const res = await fetch("/api/simulator/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_price: price,
          direction,
          amount_usd: 1000,
          leverage: 5,
          trigger_id: triggerId,
          end_time: endTime
        })
      });
      if (res.ok) {
        if (!triggerId) toast.success("Position Opened Successfully");
        fetchPositions();
      }
    } catch (e) {
      console.error("Failed to open position", e);
    }
  };

  // Close Position Helper
  const closePosition = async (id: string, status: "CLOSED_TP" | "CLOSED_SL" | "CLOSED_TIME", closePrice: number, pnlPercent: number) => {
     try {
      const res = await fetch("/api/simulator/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          close_price: closePrice,
          pnl_percent: pnlPercent
        })
      });
      if (res.ok) {
        let message = "";
        switch(status) {
            case "CLOSED_TP": message = "See ya! Take Profit Hit 🎯"; break;
            case "CLOSED_SL": message = "Ouch! Stop Loss Hit 🛑"; break;
            case "CLOSED_TIME": message = "Time's up! Order Completed ⏱️"; break;
        }
        toast(message, {
            description: `PnL: ${pnlPercent.toFixed(2)}%`
        });
        fetchPositions();
      }
    } catch (e) {
      console.error("Failed to close position", e);
    }
  };

  // Trigger Logic
  const checkTriggers = (currentTwaps: EnrichedTwap[], currentPrice: number, existingPositions: SimulatedPosition[]) => {
    if (currentTwaps.length === 0 || currentPrice === 0) return;
    
    const existingTriggerIds = new Set(existingPositions.map(p => p.trigger_id).filter(Boolean));

    // 1. Large Order Trigger (> 1M)
    // We check ALL twaps for backfill, not just new ones
    currentTwaps.forEach(t => {
        if (t.sizeUsd > 1_000_000) {
            const triggerId = `large_${t.id}`;
            if (!existingTriggerIds.has(triggerId)) {
                console.log("Trigger: Backfilling/Opening Large Order", triggerId);
                // For backfill, we use the TWAP price if it's old, otherwise currentPrice
                const entryPrice = t.price || currentPrice;
                const endTime = t.time + (t.durationMinutes * 60 * 1000);
                openPosition(t.side, entryPrice, triggerId, new Date(endTime).toISOString());
                existingTriggerIds.add(triggerId); // Avoid multi-open in same loop
            }
        }
    });

    // 2. Dense Orders Trigger (10 orders in 10 mins)
    // Strategy: Bucket orders into 10 min windows
    const sortedTwaps = [...currentTwaps].sort((a, b) => a.time - b.time);
    if (sortedTwaps.length < 10) return;

    const WINDOW_MS = 10 * 60 * 1000;
    
    // We'll iterate through all TWAPs and check sliding windows or fixed buckets?
    // Sliding window is more accurate for "within 10 mins".
    for (let i = 0; i <= sortedTwaps.length - 10; i++) {
        const window = sortedTwaps.slice(i);
        const startTime = window[0].time;
        const endTime = startTime + WINDOW_MS;
        
        const inWindow = window.filter(t => t.time <= endTime);
        if (inWindow.length >= 10) {
            const buys = inWindow.filter(t => t.side === "BUY");
            const sells = inWindow.filter(t => t.side === "SELL");

            if (buys.length >= 10) {
                const triggerId = `dense_${inWindow[0].id}_BUY`;
                if (!existingTriggerIds.has(triggerId)) {
                    const lastTwap = inWindow[inWindow.length - 1];
                    const endTime = lastTwap.time + (lastTwap.durationMinutes * 60 * 1000);
                    openPosition("BUY", lastTwap.price || currentPrice, triggerId, new Date(endTime).toISOString());
                    existingTriggerIds.add(triggerId);
                    i += inWindow.length - 1; // Skip ahead
                }
            }
            if (sells.length >= 10) {
                const triggerId = `dense_${inWindow[0].id}_SELL`;
                if (!existingTriggerIds.has(triggerId)) {
                    const lastTwap = inWindow[inWindow.length - 1];
                    const endTime = lastTwap.time + (lastTwap.durationMinutes * 60 * 1000);
                    openPosition("SELL", lastTwap.price || currentPrice, triggerId, new Date(endTime).toISOString());
                    existingTriggerIds.add(triggerId);
                    i += inWindow.length - 1; // Skip ahead
                }
            }
        }
    }
  };


  // PnL Monitor Logic
  const checkPositionsPnL = (currentPrice: number) => {
    if (currentPrice === 0) return;
  };

  useEffect(() => {
    if (hypePrice === 0 || positions.length === 0) return;
    
    positions.forEach(pos => {
        if (pos.status !== "OPEN") return;
        
        // Calculate PnL
        let rawPnl = 0;
        if (pos.direction === "BUY") {
            rawPnl = (hypePrice - pos.entry_price) / pos.entry_price;
        } else {
            rawPnl = (pos.entry_price - hypePrice) / pos.entry_price;
        }
        
        const pnlPercent = rawPnl * pos.leverage * 100;

        // 1. Time-based Exit
        if (pos.end_time && Date.now() > new Date(pos.end_time).getTime()) {
            closePosition(pos.id, "CLOSED_TIME", hypePrice, pnlPercent);
            return;
        }

        // 2. PnL-based Exit
        if (pnlPercent >= 20) {
            closePosition(pos.id, "CLOSED_TP", hypePrice, pnlPercent);
        } else if (pnlPercent <= -20) {
             closePosition(pos.id, "CLOSED_SL", hypePrice, pnlPercent);
        }
    });

  }, [hypePrice, positions]);


  // Initial Load & Polling
  useEffect(() => {
    fetchPositions();
    fetchData(); // first fetch

    const interval = setInterval(() => {
        fetchData();
    }, 30000); 

    const posInterval = setInterval(fetchPositions, 10000); // Check DB more often?

    return () => {
        clearInterval(interval);
        clearInterval(posInterval);
    };
  }, []);

  // Calculate Stats
  const activePositions = positions.filter(p => p.status === "OPEN");
  const closedPositions = positions.filter(p => p.status !== "OPEN");
  
  const totalOrders = positions.length;
  const realizedPnL = closedPositions.reduce((sum, p) => sum + (p.pnl_percent || 0), 0);
  const realizedPnlUsd = closedPositions.reduce((sum, p) => sum + (p.amount_usd * ((p.pnl_percent || 0) / 100)), 0);
  
  // Unrealized PnL Calculation
  const unrealizedPnL = activePositions.reduce((sum, pos) => {
    let rawPnl = 0;
    if (pos.direction === "BUY") {
        rawPnl = (hypePrice - pos.entry_price) / pos.entry_price;
    } else {
        rawPnl = (pos.entry_price - hypePrice) / pos.entry_price;
    }
    return sum + (rawPnl * pos.leverage * 100);
  }, 0);

  const unrealizedPnlUsd = activePositions.reduce((sum, pos) => {
    let rawPnl = 0;
    if (pos.direction === "BUY") {
        rawPnl = (hypePrice - pos.entry_price) / pos.entry_price;
    } else {
        rawPnl = (pos.entry_price - hypePrice) / pos.entry_price;
    }
    return sum + (pos.amount_usd * rawPnl * pos.leverage);
  }, 0);

  const totalPnL = realizedPnL + unrealizedPnL;
  const totalProfitUsd = realizedPnlUsd + unrealizedPnlUsd;

  return (
    <div className="min-h-screen bg-background p-8">
    <div className="max-w-6xl mx-auto space-y-8">
            <div className="space-y-4 border-b border-border/40 pb-6">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Dashboard
                </Link>
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                            Simulated Trading
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Automated strategies based on TWAP triggers
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="text-sm font-medium">Refresh Data</span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border shadow-sm">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">HYPE Price</span>
                            <span className="font-mono font-bold text-primary">${hypePrice.toFixed(4)}</span>
                        </div>
                    </div>
                </header>
            </div>
 
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Card className="bg-card/50 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                             <PlayCircle className="w-4 h-4 text-blue-500"/>
                             Active Positions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center justify-between">
                            {activePositions.length}
                            <span className={`text-xs font-mono ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}%
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Unrealized PnL</p>
                    </CardContent>
                 </Card>
 
                 <Card className="bg-card/50 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                             <RefreshCw className="w-4 h-4 text-purple-500"/>
                             Total Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalOrders}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Historical Count</p>
                    </CardContent>
                 </Card>
 
                 <Card className="bg-card/50 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${totalPnL >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}/>
                             Total Profit
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'} flex items-center justify-between`}>
                            {totalProfitUsd >= 0 ? '+' : '-'}${Math.abs(totalProfitUsd).toFixed(2)}
                            <span className="text-xs font-mono opacity-80">
                                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}%
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Realized + Unrealized</p>
                    </CardContent>
                 </Card>

                 <Card className="bg-card/50 backdrop-blur-sm border-border/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500"/>
                             Win Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {closedPositions.length > 0 
                                ? ((closedPositions.filter(p => (p.pnl_percent || 0) > 0).length / closedPositions.length) * 100).toFixed(1)
                                : "0.0"}%
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Closed Positions</p>
                    </CardContent>
                 </Card>
            </div>

            <SimulatedPositionsTable positions={positions} currentPrice={hypePrice} />
            
            {loading && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-4 p-10 rounded-3xl bg-card/80 border border-border/50 shadow-2xl backdrop-blur-xl">
                        <div className="relative">
                            <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full animate-pulse" />
                            <RefreshCw className="w-10 h-10 animate-spin text-primary relative z-10" />
                        </div>
                        <div className="space-y-1 text-center">
                            <p className="text-sm font-bold tracking-tight">Syncing Market Data</p>
                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest animate-pulse">Please wait...</p>
                        </div>
                    </div>
                </div>
            )}
             
            {error && (
                 <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
                    <AlertCircle className="w-4 h-4"/>
                    {error}
                 </div>
            )}
        </div>
    </div>
  );
}
