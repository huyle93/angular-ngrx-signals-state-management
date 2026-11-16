import { computed, Injectable, signal } from '@angular/core';
import {
  OrderEntryView,
  validAmount,
  validPrice,
} from '@fi/trading-util/order-entry';

/** One trading session per host; no persistence, account, order or network API. */
@Injectable()
export class TradeDraftStore {
  private readonly state = signal({
    symbol: '',
    price: null as number | null,
    amount: '',
    reviewed: false,
  });
  readonly amount = computed(() => this.state().amount);
  readonly value = computed(() => validAmount(this.amount()));
  readonly reviewed = computed(() => this.state().reviewed);
  readonly view = computed<OrderEntryView | null>(() => {
    const state = this.state();
    if (!validPrice(state.price)) return null;
    return {
      ...state,
      price: state.price,
      value: this.value(),
      shares: (this.value() ?? 0) / state.price,
    };
  });

  /** Returns whether the instrument context changed. Same-symbol refresh retains raw input. */
  setContext(symbol: string, price: number | null): boolean {
    const previous = this.state();
    const changed = previous.symbol !== symbol;
    if (changed) this.state.set({ symbol, price, amount: '', reviewed: false });
    else if (previous.price !== price)
      this.state.update((state) => ({ ...state, price, reviewed: false }));
    return changed;
  }
  updateAmount(amount: string) {
    this.state.update((state) => ({ ...state, amount, reviewed: false }));
  }
  review() {
    if (this.view() && this.value() !== null)
      this.state.update((state) => ({ ...state, reviewed: true }));
  }
}
