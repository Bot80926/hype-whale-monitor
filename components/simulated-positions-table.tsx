
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SimulatedPosition {
  id: string;
  created_at: string;
  entry_price: number;
  direction: "BUY" | "SELL";
  status: "OPEN" | "CLOSED_TP" | "CLOSED_SL" | "CLOSED_TIME";
  amount_usd: number;
  leverage: number;
  close_price?: number;
  pnl_percent?: number;
  trigger_id?: string;
  end_time?: string;
}

interface SimulatedPositionsTableProps {
  positions: SimulatedPosition[];
  currentPrice: number;
}

export function SimulatedPositionsTable({ positions, currentPrice }: SimulatedPositionsTableProps) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Simulated Positions History</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead>Time</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Entry Price</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Close Estimate</TableHead>
                <TableHead className="text-right">PnL %</TableHead>
                <TableHead className="text-right">Profit ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos) => {
                const isOpen = pos.status === "OPEN";
                let displayPnl = pos.pnl_percent;
                
                if (isOpen && currentPrice > 0) {
                  const rawPnl = pos.direction === "BUY" 
                    ? (currentPrice - pos.entry_price) / pos.entry_price
                    : (pos.entry_price - currentPrice) / pos.entry_price;
                  displayPnl = rawPnl * pos.leverage * 100;
                }

                const profitUsd = displayPnl !== undefined ? (pos.amount_usd * (displayPnl / 100)) : 0;

                return (
                  <TableRow key={pos.id} className="border-border/20 hover:bg-primary/5 transition-colors">
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(pos.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                        pos.direction === "BUY"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {pos.direction}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">${pos.entry_price.toFixed(4)}</TableCell>
                    <TableCell className="font-mono text-sm">${pos.amount_usd}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        pos.status === "OPEN" ? "bg-blue-500/10 text-blue-400 animate-pulse" :
                        pos.status === "CLOSED_TP" ? "bg-emerald-500/10 text-emerald-400" :
                        pos.status === "CLOSED_TIME" ? "bg-amber-500/10 text-amber-400" :
                        "bg-rose-500/10 text-rose-400"
                      }`}>
                        {pos.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pos.end_time ? (
                        <div className="flex flex-col">
                           <span>{new Date(pos.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           {isOpen && (
                             <span className="text-[9px] uppercase font-bold text-primary/60">Auto-Close</span>
                           )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${
                      (displayPnl || 0) > 0 ? "text-emerald-400" : (displayPnl || 0) < 0 ? "text-rose-400" : ""
                    }`}>
                      {displayPnl !== undefined ? (
                         <span className="flex items-center justify-end gap-1">
                            {displayPnl >= 0 ? '+' : ''}{displayPnl?.toFixed(2)}%
                            {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                         </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${
                      profitUsd > 0 ? "text-emerald-400" : profitUsd < 0 ? "text-rose-400" : ""
                    }`}>
                      {profitUsd !== 0 ? (
                        `${profitUsd >= 0 ? '+' : ''}$${profitUsd.toFixed(2)}`
                      ) : "$0.00"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {positions.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                     No simulated positions yet.
                   </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
