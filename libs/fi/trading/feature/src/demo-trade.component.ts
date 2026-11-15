import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { TradeDraftStore } from '@fi/trading-data-access/trade-draft.store';
import { OrderEntryComponent } from '@fi/trading-ui/order-entry.component';

/** Desktop presentation host. The trading session outlives temporary data loss. */
@Component({
  selector: 'app-demo-trade',
  standalone: true,
  imports: [OrderEntryComponent],
  providers: [TradeDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft.view(); as view) {
      <aside class="ticket" aria-label="Demo trade ticket">
        <app-order-entry
          [view]="view"
          (amountChange)="draft.updateAmount($event)"
          (reviewRequested)="draft.review()"
        />
      </aside>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-inline-size: 0;
      }
      .ticket {
        border: 1px solid var(--fi-border);
        background: var(--fi-surface);
        border-radius: var(--fi-radius);
        padding: 1.5rem;
      }
    `,
  ],
})
export class DemoTradeComponent {
  readonly symbol = input.required<string>();
  readonly price = input.required<number | null>();
  protected readonly draft = inject(TradeDraftStore);
  constructor() {
    effect(() => {
      const symbol = this.symbol();
      const price = this.price();
      untracked(() => this.draft.setContext(symbol, price));
    });
  }
}
