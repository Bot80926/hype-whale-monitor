import { NextResponse } from "next/server";
import type {
  HypurrscanTwapResponse,
  HyperliquidMetaAndAssetCtxs,
  EnrichedTwap,
  TwapsApiResponse,
} from "@/lib/types";
import { getHypePrices } from "@/lib/hype-utils";

const HYPURRSCAN_API = "https://api.hypurrscan.io/twap/*";
const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";

// HYPE market IDs
const HYPE_PERP_ID = 159;
const HYPE_SPOT_ID = 10107;

// Cache for market metadata (refreshed every 5 minutes)
let perpCache: { name: string; markPx: string }[] = [];
let spotCache: Map<number, { name: string; markPx: string }> = new Map();
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface SpotMeta {
  tokens: { name: string; index: number }[];
  universe: { name: string; tokens: [number, number]; index: number }[];
}

interface SpotAssetCtx {
  prevDayPx: string;
  dayNtlVlm: string;
  markPx: string;
  midPx: string;
  circulatingSupply: string;
}

async function fetchMarketMetadata(): Promise<void> {
  const now = Date.now();
  if (perpCache.length > 0 && now - cacheTime < CACHE_DURATION) {
    return;
  }

  try {
    // Fetch perp and spot metadata in parallel
    const [perpResponse, spotResponse] = await Promise.all([
      fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      }),
      fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
      }),
    ]);

    if (perpResponse.ok) {
      const data = (await perpResponse.json()) as HyperliquidMetaAndAssetCtxs;
      const universe = data[0].universe;
      const assetCtxs = data[1];

      perpCache = universe.map((asset, index) => ({
        name: asset.name,
        markPx: assetCtxs[index]?.markPx || "0",
      }));
    }

    if (spotResponse.ok) {
      const data = (await spotResponse.json()) as [SpotMeta, SpotAssetCtx[]];
      const tokens = data[0].tokens;
      const universe = data[0].universe;
      const assetCtxs = data[1];

      // Build token name lookup
      const tokenNames = new Map<number, string>();
      for (const token of tokens) {
        tokenNames.set(token.index, token.name);
      }

      // Build spot cache with base token names
      spotCache.clear();
      for (let i = 0; i < universe.length; i++) {
        const spot = universe[i];
        const baseTokenIndex = spot.tokens[0];
        const baseName = tokenNames.get(baseTokenIndex) || spot.name;
        const spotMarketId = 10000 + spot.index;
        
        // Use spot.index to access assetCtxs if available, otherwise fallback to loop index
        const ctx = assetCtxs[spot.index] || assetCtxs[i];
        
        spotCache.set(spotMarketId, {
          name: baseName,
          markPx: ctx?.markPx || "0",
        });
      }
    }

    cacheTime = now;
  } catch (error) {
    console.error("Failed to fetch market metadata:", error);
  }
}

function getTokenInfo(marketId: number): { name: string; markPx: number } {
  // Handle perp markets (0-999)
  if (marketId < 10000 && perpCache[marketId]) {
    return {
      name: perpCache[marketId].name,
      markPx: parseFloat(perpCache[marketId].markPx) || 0,
    };
  }
  // Handle spot markets (10000+)
  if (marketId >= 10000) {
    const spotInfo = spotCache.get(marketId);
    if (spotInfo) {
      return {
        name: spotInfo.name,
        markPx: parseFloat(spotInfo.markPx) || 0,
      };
    }
    return { name: `SPOT-${marketId - 10000}`, markPx: 0 };
  }
  return { name: `Unknown-${marketId}`, markPx: 0 };
}

function isHypeMarket(marketId: number): boolean {
  return marketId === HYPE_PERP_ID || marketId === HYPE_SPOT_ID;
}

export async function GET() {
  try {
    // Fetch TWAPs, HYPE prices, and market metadata in parallel
    const [twapsResponse, prices] = await Promise.all([
      fetch(HYPURRSCAN_API, { next: { revalidate: 30 } }),
      getHypePrices(),
      fetchMarketMetadata(),
    ]);

    if (!twapsResponse.ok) {
      throw new Error(`Failed to fetch TWAPs: ${twapsResponse.status}`);
    }

    const rawTwaps = (await twapsResponse.json()) as HypurrscanTwapResponse[];
    const now = Date.now();

    // Filter and enrich TWAPs - only show active HYPE TWAPs
    const enrichedTwaps: EnrichedTwap[] = rawTwaps
      .filter((twap) => !twap.ended && isHypeMarket(twap.action.twap.a)) // Only active HYPE TWAPs
      .map((twap) => {
        const marketId = twap.action.twap.a;
        const tokenInfo = getTokenInfo(marketId);
        
        // Use the unified prices for HYPE logic if available
        const markPx = marketId === HYPE_PERP_ID ? prices.perp : 
                       marketId === HYPE_SPOT_ID ? prices.spot : 
                       tokenInfo.markPx;

        const size = parseFloat(twap.action.twap.s);
        const sizeUsd = size * markPx;

        const durationMinutes = twap.action.twap.m;
        const startTime = twap.time;
        const endTime = startTime + durationMinutes * 60 * 1000;
        const timeRemainingMinutes = Math.max(
          0,
          Math.round((endTime - now) / (60 * 1000))
        );

        return {
          id: twap.hash,
          time: twap.time,
          user: twap.user,
          marketId,
          marketType: marketId >= 10000 ? ("SPOT" as const) : ("PERP" as const),
          token: tokenInfo.name,
          side: twap.action.twap.b ? ("BUY" as const) : ("SELL" as const),
          size: twap.action.twap.s,
          sizeUsd,
          durationMinutes,
          timeRemainingMinutes,
          reduceOnly: twap.action.twap.r,
          randomize: twap.action.twap.t,
          status: "active" as const,
          hash: twap.hash,
        };
      })
      .sort((a, b) => b.time - a.time); // Sort by time, newest first

    const response: TwapsApiResponse = {
      twaps: enrichedTwaps,
      lastUpdated: now,
      hypePrice: prices.perp,
      hypeSpotPrice: prices.spot,
      openInterest: prices.openInterest,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching TWAPs:", error);
    return NextResponse.json(
      { error: "Failed to fetch TWAPs", twaps: [], lastUpdated: Date.now() },
      { status: 500 }
    );
  }
}
