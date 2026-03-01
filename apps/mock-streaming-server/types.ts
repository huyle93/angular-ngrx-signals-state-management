// ---------------------------------------------------------------------------
// Shared types (mirrors the Angular client interfaces)
// ---------------------------------------------------------------------------

/** Full market quote tick. Sent by default (?mode=full). */
export interface QuoteTick {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
}

/**
 * Partial update (delta). Sent when ?mode=delta.
 * Only `symbol` and `timestamp` are guaranteed. All other fields are
 * optional -- the client must *merge* this into the existing entity,
 * not overwrite it.
 */
export interface QuoteDelta {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
  timestamp: number;
}
