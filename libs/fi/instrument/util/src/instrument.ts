export type ChartRange = '1M' | '3M' | '1Y';
export type DemoScenario = 'ready' | 'slow' | 'empty' | 'error';
export type InstrumentStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
export interface PricePoint {
  readonly date: string;
  readonly price: number;
}
export interface Instrument {
  readonly symbol: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly research: string;
  readonly history: readonly PricePoint[];
}
export function seriesFor(
  instrument: Instrument,
  range: ChartRange,
): readonly PricePoint[] {
  return instrument.history.slice(-{ '1M': 30, '3M': 90, '1Y': 365 }[range]);
}
export function statistics(instrument: Instrument) {
  const prices = instrument.history.map((point) => point.price);
  if (
    prices.length === 0 ||
    prices.some((price) => !Number.isFinite(price) || price <= 0)
  )
    return null;
  const price = prices[prices.length - 1];
  const previous = prices.at(-2) ?? price;
  return {
    price,
    previous,
    change: price - previous,
    changePercent: previous ? ((price - previous) / previous) * 100 : 0,
    high: Math.max(...prices),
    low: Math.min(...prices),
  };
}
