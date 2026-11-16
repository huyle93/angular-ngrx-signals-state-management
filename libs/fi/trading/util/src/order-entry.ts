export interface OrderEntryView {
  readonly symbol: string;
  readonly price: number;
  readonly amount: string;
  readonly value: number | null;
  readonly shares: number;
  readonly reviewed: boolean;
}

export function validAmount(raw: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= 1000000 ? value : null;
}

export function validPrice(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}
