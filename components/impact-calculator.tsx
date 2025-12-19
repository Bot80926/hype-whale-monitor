"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, TrendingDown, Info, Calculator } from "lucide-react";
import { LiquidationHeatmapEntry, L2BookResponse, L2BookLevel } from "@/lib/types";
import { simulateLongCascade, CascadeResult } from "@/lib/impact-utils";

interface ImpactCalculatorProps {
  heatmapData: LiquidationHeatmapEntry[];
  currentPrice: number;
  openInterest: number;
}

export function ImpactCalculator({ heatmapData, currentPrice, openInterest }: ImpactCalculatorProps) {
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [orderBook, setOrderBook] = useState<L2BookResponse | null>(null);
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = async () => {
    try {
      const res = await fetch("/api/order-book");
      if (!res.ok) throw new Error("Failed to fetch order book");
      const data = await res.json();
      setOrderBook(data);
    } catch (err) {
      console.error(err);
      setError("Failed to sync order book depth");
    }
  };

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const handleCalculate = () => {
    if (!targetPrice || isNaN(parseFloat(targetPrice))) return;
    if (!orderBook) {
      setError("Waiting for order book data...");
      return;
    }

    setLoading(true);
    setError(null);

    const target = parseFloat(targetPrice);
    
    // Safety check: target must be below current
    if (target >= currentPrice) {
      setError("Target price must be below current price for long liquidation impact.");
      setLoading(false);
      return;
    }

    try {
      const simulation = simulateLongCascade(
        target,
        currentPrice,
        openInterest,
        heatmapData,
        orderBook.levels[0] // Bids
      );
      setResult(simulation);
    } catch (err) {
      setError("Simulation error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Calculator className="w-5 h-5" />
          </div>
          Liquidation Impact Simulator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Target Trigger Price ($)
                <Info className="w-3 h-3 cursor-help" />
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={`e.g. ${(currentPrice * 0.95).toFixed(2)}`}
                  value={targetPrice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetPrice(e.target.value)}
                  className="bg-background/50"
                />
                <Button 
                  onClick={handleCalculate} 
                  disabled={loading || !orderBook}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Simulate"}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-xs text-muted-foreground">
              <p>
                Calculates the cascading effect of triggered long liquidations on the HYPE order book depth.
              </p>
            </div>
          </div>

          <div className="relative">
            {result ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cascade Floor</div>
                    <div className="text-2xl font-mono text-red-500 font-bold">${result.finalPrice.toFixed(3)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Liquidation</div>
                    <div className="text-2xl font-mono text-primary font-bold">${(result.totalLiquidationTriggered / 1000).toFixed(1)}K</div>
                  </div>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[120px] pr-2 scrollbar-thin scrollbar-thumb-border">
                  {result.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs border-l-2 border-muted pl-3 py-1">
                      <TrendingDown className="w-3 h-3 text-red-400" />
                      <span>{step.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-6 text-muted-foreground/50">
                <Zap className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">Input price and click Simulate</p>
              </div>
            )}
            
            {error && (
              <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white text-xs p-2 rounded-md animate-bounce">
                {error}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
