// Hypurrscan TWAP API types
export interface HypurrscanTwapResponse {
  time: number;
  user: string;
  action: {
    type: "twapOrder";
    twap: {
      a: number; // Market ID
      b: boolean; // Buy (true) or Sell (false)
      s: string; // Size (amount)
      r: boolean; // Reduce only
      m: number; // Duration in minutes
      t: boolean; // Randomize
    };
  };
  block: number;
  hash: string;
  error: string | null;
  ended?: "canceled" | "error" | "ended";
}

// Hyperliquid market metadata types
export interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

export interface HyperliquidAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: [string, string];
}

export interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

export interface HyperliquidMetaAndAssetCtxs {
  0: HyperliquidMeta;
  1: HyperliquidAssetCtx[];
}

// Enriched TWAP data for UI
export interface EnrichedTwap {
  id: string;
  time: number;
  user: string;
  marketId: number;
  marketType: "PERP" | "SPOT";
  token: string;
  side: "BUY" | "SELL";
  size: string;
  sizeUsd: number;
  durationMinutes: number;
  timeRemainingMinutes: number;
  reduceOnly: boolean;
  randomize: boolean;
  status: "active" | "canceled" | "error" | "ended";
  hash: string;
}

// API response type
export interface TwapsApiResponse {
  twaps: EnrichedTwap[];
  lastUpdated: number;
  hypePrice?: number;
  hypeSpotPrice?: number;
  openInterest?: number;
}

export interface LiquidationHeatmapEntry {
  coin: string;
  priceBinIndex: number;
  priceBinStart: number;
  priceBinEnd: number;
  liquidationValue: number;
  positionsCount: number;
  mostImpactedSegment: number;
}

export interface LiquidationMapResponse {
  coin: string;
  heatmap: LiquidationHeatmapEntry[];
  lastUpdated: number;
  hypePrice?: number;
  openInterest?: number;
}

export interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

export interface L2BookResponse {
  levels: [L2BookLevel[], L2BookLevel[]];
  coin: string;
  time: number;
}
