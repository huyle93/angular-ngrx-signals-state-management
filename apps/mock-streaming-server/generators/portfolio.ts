import { PortfolioSnapshot, Position } from '../types.js';
import { generateQuoteTick } from './quote.js';

// ---------------------------------------------------------------------------
// Hardcoded demo positions (POC only -- see types.ts for field descriptions)
// ---------------------------------------------------------------------------

const DEMO_HOLDINGS: Array<{ symbol: string; shares: number; avgCost: number }> = [
  { symbol: 'AAPL',  shares: 50, avgCost: 185.00 },
  { symbol: 'GOOGL', shares: 30, avgCost: 165.00 },
  { symbol: 'MSFT',  shares: 20, avgCost: 400.00 },
  { symbol: 'TSLA',  shares: 15, avgCost: 230.00 },
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generates a complete portfolio snapshot using the current market prices.
 * Each call re-prices all positions, so values fluctuate with the random walk.
 */
export function generatePortfolioSnapshot(): PortfolioSnapshot {
  const positions: Position[] = DEMO_HOLDINGS.map((holding) => {
    const tick = generateQuoteTick(holding.symbol);
    const marketValue = +(tick.price * holding.shares).toFixed(2);
    const costBasis = +(holding.avgCost * holding.shares).toFixed(2);
    const gainLoss = +(marketValue - costBasis).toFixed(2);
    const gainLossPercent = +((gainLoss / costBasis) * 100).toFixed(2);

    return {
      symbol: holding.symbol,
      shares: holding.shares,
      avgCost: holding.avgCost,
      currentPrice: tick.price,
      marketValue,
      gainLoss,
      gainLossPercent,
    };
  });

  const totalValue = +positions.reduce((sum, p) => sum + p.marketValue, 0).toFixed(2);
  const totalCost = positions.reduce((sum, p) => sum + p.avgCost * p.shares, 0);
  const dayChange = +(totalValue - totalCost).toFixed(2);
  const dayChangePercent = +((dayChange / totalCost) * 100).toFixed(2);

  return {
    totalValue,
    dayChange,
    dayChangePercent,
    positions,
    timestamp: Date.now(),
  };
}
