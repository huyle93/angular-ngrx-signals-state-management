import { computed, Injectable, signal } from '@angular/core';

export function validAmount(raw: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= 1000000 ? value : null;
}

// Component-scoped: no persistence, account, balance, order or network operation.
@Injectable()
export class TradeDraftStore {
  private readonly state = signal({ symbol: '', amount: '', reviewed: false });
  readonly amount = computed(() => this.state().amount);
  readonly value = computed(() => validAmount(this.amount()));
  readonly reviewed = computed(() => this.state().reviewed);
  selectSymbol(symbol: string) {
    if (symbol !== this.state().symbol)
      this.state.set({ symbol, amount: '', reviewed: false });
  }
  updateAmount(amount: string) {
    this.state.update((state) => ({ ...state, amount, reviewed: false }));
  }
  review() {
    if (this.value() !== null)
      this.state.update((state) => ({ ...state, reviewed: true }));
  }
}
