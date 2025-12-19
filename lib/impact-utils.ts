import { LiquidationHeatmapEntry, L2BookLevel } from "./types";

export interface CascadeResult {
  finalPrice: number;
  totalLiquidationTriggered: number;
  steps: {
    startPrice: number;
    endPrice: number;
    liquidatedValue: number;
    description: string;
  }[];
}

export interface SimulationParams {
  k: number;    // Cascade intensity coefficient (e.g., 0.18)
  a: number;    // Exponential growth factor (e.g., 14)
  x0: number;   // Drawdown threshold (e.g., 0.05)
  longRatio: number; // Percentage of OI that is long (e.g., 0.6)
}

/**
 * Simulates cascading long liquidations using a density-based pressure estimator.
 * 
 * Logic:
 * 1. Build price bins starting from the target price downwards.
 * 2. Estimate the liquidation sell pressure L(p) at each bin using a density function:
 *    L(p) = OI_long * k * exp(a * ((P0 - p) / P0 - x0))
 * 3. Calculate the cumulative sell pressure (Sigma L(p)) and cumulative bid depth (Sigma BidQty(p)).
 * 4. Find the intersection point where Cumulative Sell >= Cumulative Bid.
 */
export function simulateLongCascade(
  targetPrice: number,
  currentPrice: number,
  openInterest: number,
  heatmap: LiquidationHeatmapEntry[],
  bids: L2BookLevel[],
  params: SimulationParams = { k: 0.18, a: 14, x0: 0.05, longRatio: 0.6 }
): CascadeResult {
  // Ensure we are working with numbers
  const currentPriceNum = Number(currentPrice);
  const targetPriceNum = Number(targetPrice);
  const OI_long = openInterest * params.longRatio;

  // Track results
  let totalLiquidationTriggered = 0;
  const steps: CascadeResult["steps"] = [];
  
  // Parse and sort bids (Highest to Lowest)
  let activeBids = bids
    .map(b => ({ px: Number(b.px), sz: Number(b.sz) }))
    .filter(b => !isNaN(b.px) && !isNaN(b.sz))
    .sort((a, b) => b.px - a.px);

  // 1. Build price bins for the calculation ( O(N) complexity )
  // We scan from Pt downwards to find where Sell Pressure >= Buyer Depth
  const BINS_COUNT = 100;
  const RANGE_PCT = 0.20; // Check up to 20% drawdown
  const binStep = (currentPriceNum * RANGE_PCT) / BINS_COUNT;
  
  let currentBinPrice = currentPriceNum;
  let cumSellHype = 0;
  let cumBidHype = 0;
  let floorPrice = targetPriceNum;
  let foundFloor = false;

  // We iterate from Current Price down to the bottom of our range
  for (let i = 0; i < BINS_COUNT; i++) {
    currentBinPrice -= binStep;
    const drawdownPct = (currentPriceNum - currentBinPrice) / currentPriceNum;
    
    // Step 2: Estimate Liquidation Density L(p) 
    // Only triggers after x0 drawdown
    let stepSellHype = 0;
    if (drawdownPct > params.x0) {
      // Density function: L(p) = OI_long * k * exp( a * (drawdown - x0) )
      // We calculate the *incremental* sell pressure for this bin
      const intensity = params.k * Math.exp(params.a * (drawdownPct - params.x0));
      stepSellHype = (OI_long * intensity * (binStep / currentPriceNum)); 
    }

    // Step 3: Cumulative Sell Pressure (HYPE tokens)
    cumSellHype += stepSellHype;

    // Step 4: Cumulative Bid Depth (HYPE tokens)
    // Add all bids that are at or above this currentBinPrice
    activeBids.forEach(bid => {
      if (bid.px >= currentBinPrice && bid.px < (currentBinPrice + binStep)) {
        cumBidHype += bid.sz;
      }
    });

    // Step 5: Check for Intersection (Cascade Floor)
    // Cascade triggers if cumulative sell > cumulative bid
    // But we only care if we've passed the Pt (Target Price)
    if (!foundFloor && currentBinPrice <= targetPriceNum) {
      if (cumSellHype >= cumBidHype) {
        floorPrice = currentBinPrice;
        foundFloor = true;
        
        steps.push({
          startPrice: currentPriceNum,
          endPrice: floorPrice,
          liquidatedValue: cumSellHype * floorPrice,
          description: `Cumulative intersection hit at $${floorPrice.toFixed(3)}. Total estimated pressure: $${(cumSellHype * floorPrice / 1000).toFixed(1)}K`
        });
      }
    }

    // Performance/UI: Add a few steps to the result for visualization if needed
    if (i % 25 === 0 && currentBinPrice <= targetPriceNum && !foundFloor) {
      steps.push({
        startPrice: currentBinPrice + binStep,
        endPrice: currentBinPrice,
        liquidatedValue: stepSellHype * currentBinPrice,
        description: `Scanning price $${currentBinPrice.toFixed(2)}: Sell ($${(cumSellHype * currentBinPrice / 1000).toFixed(1)}K) vs Depth ($${(cumBidHype * currentBinPrice / 1000).toFixed(1)}K)`
      });
    }
  }

  // If no intersection found in range, use targetPrice or the bottom of range
  if (!foundFloor) {
    floorPrice = targetPriceNum;
    steps.push({
        startPrice: currentPriceNum,
        endPrice: floorPrice,
        liquidatedValue: cumSellHype * floorPrice,
        description: `No total cascade floor found. Liquidity depth exceeds estimated sell pressure at target.`
    });
  }

  return {
    finalPrice: floorPrice,
    totalLiquidationTriggered: cumSellHype * floorPrice,
    steps
  };
}
