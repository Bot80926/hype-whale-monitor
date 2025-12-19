import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";

interface WhaleData {
  liquidation: {
    longUsd: number;
    shortUsd: number;
  };
  longShort: {
    longCount: number;
    shortCount: number;
  };
}

export function WhaleAnalysis() {
  const [data, setData] = useState<WhaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whale-analysis");
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError("Failed to load whale analysis");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000 * 60); // Refresh every hour
    return () => clearInterval(interval);
  }, []);

  const totalLiquidation = data 
    ? data.liquidation.longUsd + data.liquidation.shortUsd 
    : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                    Total 24h Liquidation
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-3/4 bg-primary/10" />
                ) : error ? (
                    <div className="text-destructive text-sm flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Error
                    </div>
                ) : (
                    <div className="text-2xl font-bold font-mono text-foreground">
                        {formatCurrency(totalLiquidation)}
                    </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="text-emerald-400">
                   Longs: {data ? formatCurrency(data.liquidation.longUsd) : "-"} { ' '}
                  </span>
                   |  {' '}
                  <span className="text-rose-400">
                   Shorts: {data ? formatCurrency(data.liquidation.shortUsd) : "-"}
                  </span>
                </div>
            </CardContent>
        </Card>

        <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm border-emerald-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Whale Long Positions
                </CardTitle>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <Skeleton className="h-8 w-1/2 bg-emerald-500/10" />
                ) : error ? (
                     <div className="text-destructive text-sm">--</div>
                ) : (
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                        {data?.longShort.longCount}
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Active long whales</p>
            </CardContent>
        </Card>

        <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm border-rose-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    Whale Short Positions
                </CardTitle>
            </CardHeader>
             <CardContent>
                 {loading ? (
                    <Skeleton className="h-8 w-1/2 bg-rose-500/10" />
                ) : error ? (
                     <div className="text-destructive text-sm">--</div>
                ) : (
                    <div className="text-2xl font-bold font-mono text-rose-400">
                        {data?.longShort.shortCount}
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Active short whales</p>
            </CardContent>
        </Card>
    </div>
  );
}
