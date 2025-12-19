import { NextResponse } from "next/server";
import type { LiquidationMapResponse } from "@/lib/types";
import { getHypePrices } from "@/lib/hype-utils";

const LIQUIDATION_MAP_URL = "https://dw3ji7n7thadj.cloudfront.net/aggregator/assets/HYPE/liquidation-heatmap.json";

// Cache for liquidation data (refreshed every 10 minutes)
let liquidationCache: any = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const now = Date.now();
  
  if (liquidationCache && now - cacheTime < CACHE_DURATION) {
    const prices = await getHypePrices();
    return NextResponse.json({
      ...liquidationCache,
      hypePrice: prices.perp,
      openInterest: prices.openInterest,
      lastUpdated: cacheTime,
    });
  }

  try {
    const [liqResponse, prices] = await Promise.all([
      fetch(LIQUIDATION_MAP_URL, {
        next: { revalidate: 600 },
      }),
      getHypePrices(),
    ]);

    if (!liqResponse.ok) {
      throw new Error(`Failed to fetch liquidation data: ${liqResponse.status}`);
    }

    const data = await liqResponse.json();
    
    liquidationCache = data;
    cacheTime = now;

    return NextResponse.json({
      ...data,
      hypePrice: prices.perp,
      openInterest: prices.openInterest,
      lastUpdated: now,
    });
  } catch (error) {
    console.error("Error fetching liquidation data:", error);
    
    if (liquidationCache) {
      return NextResponse.json({
        ...liquidationCache,
        lastUpdated: cacheTime,
        stale: true,
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch liquidation data", lastUpdated: now },
      { status: 500 }
    );
  }
}
