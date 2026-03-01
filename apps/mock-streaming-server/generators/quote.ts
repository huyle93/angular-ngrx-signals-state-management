import { BASE_PRICES } from '../config.js';
import { QuoteDelta, QuoteTick } from '../types.js';

// Running prices per symbol, updated on every tick (simulate random walk).
const currentPrices: Record<string, number> = { ...BASE_PRICES };

// ---------------------------------------------------------------------------
// Full tick
// ---------------------------------------------------------------------------

/**
 * Generates a complete QuoteTick for the given symbol.
 *
 * Unknown symbols (e.g. DJI, SPX, BTC) are lazily seeded with a random base
 * price between $50 and $500 on the first call for that symbol.
 */
export function generateQuoteTick(symbol: string): QuoteTick {
  // Lazy-seed unknown symbols
  if (!(symbol in BASE_PRICES)) {
    BASE_PRICES[symbol] = +(Math.random() * 450 + 50).toFixed(2);
    console.log(`[Generator] Seeding new symbol "${symbol}" at $${BASE_PRICES[symbol]}`);
  }

  const sessionOpen = BASE_PRICES[symbol];
  const base = currentPrices[symbol] ?? sessionOpen;

  // Random walk: ±0.5% per tick
  const changePct = (Math.random() - 0.5) * 0.01;
  const price = +(base * (1 + changePct)).toFixed(2);
  const change = +(price - sessionOpen).toFixed(2);
  const changePercent = +((change / sessionOpen) * 100).toFixed(2);
  const spread = +(Math.random() * 0.1).toFixed(2);

  currentPrices[symbol] = price;

  return {
    symbol,
    price,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 1_000_000) + 100_000,
    bid: +(price - spread).toFixed(2),
    ask: +(price + spread).toFixed(2),
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Delta tick
// ---------------------------------------------------------------------------

/**
 * Generates a sparse QuoteDelta for the given symbol.
 *
 * `price` is always included (the most-watched field). All other streaming
 * fields are randomly included or omitted to simulate a real delta feed where
 * only fields that actually changed are sent.
 */
export function generateQuoteDelta(symbol: string): QuoteDelta {
  const full = generateQuoteTick(symbol);

  const delta: QuoteDelta = {
    symbol: full.symbol,
    timestamp: full.timestamp,
    price: full.price, // always included
  };

  if (Math.random() > 0.5) delta.change = full.change;
  if (Math.random() > 0.5) delta.changePercent = full.changePercent;
  if (Math.random() > 0.6) delta.volume = full.volume;
  if (Math.random() > 0.7) delta.bid = full.bid;
  if (Math.random() > 0.7) delta.ask = full.ask;

  return delta;
}
