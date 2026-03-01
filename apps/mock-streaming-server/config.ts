// ---------------------------------------------------------------------------
// Server configuration
// ---------------------------------------------------------------------------

export const PORT = 3333;

/** Symbols streamed when the client sends no ?symbols= param. */
export const DEFAULT_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

/**
 * Session-open prices used as the baseline for the random walk.
 * Unknown symbols (e.g. DJI, SPX, BTC) are seeded lazily at runtime by
 * the quote generator and added to this map automatically.
 */
export const BASE_PRICES: Record<string, number> = {
  AAPL: 198.50,
  GOOGL: 178.25,
  MSFT: 425.80,
  TSLA: 248.90,
  AMZN: 192.40,
};
