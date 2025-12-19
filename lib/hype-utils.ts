export interface HypePrices {
  perp: number;
  spot: number;
  openInterest: number;
  lastUpdated: number;
}

const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";
const HYPE_PERP_ID = 159;
const HYPE_SPOT_INDEX = 107;

let priceCache: HypePrices | null = null;
let cacheTime = 0;
const CACHE_DURATION = 10000; // 10 seconds

export async function getHypePrices(): Promise<HypePrices> {
  const now = Date.now();
  if (priceCache && now - cacheTime < CACHE_DURATION) {
    return priceCache;
  }

  try {
    const [perpRes, spotRes] = await Promise.all([
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

    let perpPrice = 0;
    let spotPrice = 0;
    let openInterest = 0;

    if (perpRes.ok) {
      const data = await perpRes.json();
      const universe = data[0].universe;
      const assetCtxs = data[1];
      const hypeIndex = universe.findIndex((a: any) => a.name === "HYPE");
      if (hypeIndex !== -1) {
        perpPrice = parseFloat(assetCtxs[hypeIndex]?.markPx) || 0;
        openInterest = parseFloat(assetCtxs[hypeIndex]?.openInterest) || 0;
      }
    }

    if (spotRes.ok) {
      const data = await spotRes.json();
      const universe = data[0].universe;
      const assetCtxs = data[1];
      // HYPE Spot is at index 107 in universe
      const spotMarket = universe.find((m: any) => m.index === HYPE_SPOT_INDEX);
      if (spotMarket) {
        spotPrice = parseFloat(assetCtxs[HYPE_SPOT_INDEX]?.markPx) || 0;
      } else {
        // Fallback search
        const hypeSpot = universe.find((m: any) => m.name === "HYPE/USDC");
        if (hypeSpot) {
          spotPrice = parseFloat(assetCtxs[hypeSpot.index]?.markPx) || 0;
        }
      }
    }

    priceCache = { 
      perp: perpPrice, 
      spot: spotPrice, 
      openInterest: openInterest,
      lastUpdated: now 
    };
    cacheTime = now;
    return priceCache;
  } catch (error) {
    console.error("Error fetching HYPE prices:", error);
    if (priceCache) return priceCache;
    return { perp: 0, spot: 0, openInterest: 0, lastUpdated: now };
  }
}
