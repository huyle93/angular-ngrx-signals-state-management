import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { TradeDraftStore } from './trade-draft.store';

@Component({
  selector: 'app-demo-trade',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  providers: [TradeDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (disclosure()) {
      <button
        #invest
        class="primary invest"
        type="button"
        [attr.aria-expanded]="open()"
        aria-controls="trade-panel"
        (click)="toggle()"
      >
        Invest · demo
      </button>
    }
    <section
      id="trade-panel"
      class="ticket"
      [hidden]="disclosure() && !open()"
      aria-labelledby="trade-title"
    >
      <div class="eyebrow">Practice space</div>
      <h2 id="trade-title">Your next idea</h2>
      <p class="muted">
        Explore an amount for <strong>{{ symbol() }}</strong
        >. This stays in your browser until you leave.
      </p>
      <form (submit)="$event.preventDefault(); draft.review()">
        <label for="trade-amount">Amount in USD</label>
        <div class="amount-field">
          <span aria-hidden="true">$</span
          ><input
            #amount
            id="trade-amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            [value]="draft.amount()"
            (input)="draft.updateAmount($any($event.target).value)"
            aria-describedby="amount-help amount-error"
            [attr.aria-invalid]="
              draft.amount() !== '' && draft.value() === null
            "
          />
        </div>
        <p id="amount-help" class="hint">
          Enter $1–$1,000,000, with up to two decimal places.
        </p>
        <p id="amount-error" class="error" aria-live="polite">
          @if (draft.amount() && draft.value() === null) {
            Enter a valid demo amount.
          }
        </p>
        <dl>
          <div>
            <dt>Synthetic price</dt>
            <dd>{{ price() | currency }}</dd>
          </div>
          <div>
            <dt>Illustrative shares</dt>
            <dd>{{ shares() | number: '1.0-4' }}</dd>
          </div>
        </dl>
        <button
          class="primary"
          type="submit"
          [disabled]="draft.value() === null"
        >
          Preview demo amount
        </button>
      </form>
      <p class="receipt" role="status">
        @if (draft.reviewed()) {
          Preview: {{ draft.value() | currency }} for {{ symbol() }}. No order
          was placed.
        }
      </p>
      <p class="disclaimer">
        Learning only. No account, no order, no money moves.
      </p>
      @if (disclosure()) {
        <button type="button" class="close" (click)="close()">
          Close demo panel
        </button>
      }
    </section>
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
      .ticket[hidden] {
        display: none;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-size: 0.7rem;
        color: var(--fi-muted);
      }
      h2 {
        font-size: 1.4rem;
        margin: 0.5rem 0;
      }
      .muted {
        font-size: 0.9rem;
        color: var(--fi-muted);
        line-height: 1.6;
      }
      label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        margin: 1.5rem 0 0.5rem;
      }
      .amount-field {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--fi-muted);
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        background: var(--fi-bg);
      }
      input {
        width: 100%;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--fi-text);
        font: inherit;
        font-size: 1.5rem;
        min-height: 44px;
      }
      .hint,
      .error,
      .disclaimer {
        font-size: 0.75rem;
        color: var(--fi-muted);
      }
      .error {
        color: var(--fi-error);
        min-height: 1.2em;
      }
      dl {
        font-size: 0.8rem;
        margin: 1.5rem 0;
      }
      dl div {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0.8rem 0;
      }
      dt {
        color: var(--fi-muted);
      }
      dd {
        margin: 0;
        font-weight: 600;
      }
      button {
        font: inherit;
        cursor: pointer;
        min-height: 48px;
        border-radius: 8px;
        padding: 0.7rem 1rem;
        width: 100%;
      }
      .primary {
        background: var(--fi-action);
        color: var(--fi-on-action);
        border: 0;
        font-weight: 600;
      }
      .primary:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .invest {
        margin-bottom: 1rem;
      }
      .close {
        background: transparent;
        border: 1px solid var(--fi-border);
        color: var(--fi-action);
      }
      .receipt {
        font-size: 0.85rem;
        line-height: 1.5;
      }
      .disclaimer {
        border-top: 1px solid var(--fi-border);
        padding-top: 1rem;
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class DemoTradeComponent {
  readonly symbol = input.required<string>();
  readonly price = input.required<number>();
  readonly disclosure = input(false);
  protected readonly draft = inject(TradeDraftStore);
  protected readonly open = signal(false);
  protected readonly shares = computed(
    () => (this.draft.value() ?? 0) / this.price(),
  );
  private readonly invest = viewChild<ElementRef<HTMLButtonElement>>('invest');
  private readonly amount = viewChild<ElementRef<HTMLInputElement>>('amount');
  private readonly injector = inject(Injector);
  constructor() {
    effect(() => {
      const symbol = this.symbol();
      untracked(() => this.draft.selectSymbol(symbol));
      this.open.set(false);
    });
  }
  protected toggle() {
    this.open.update((value) => !value);
    if (this.open())
      afterNextRender(
        () => {
          if (this.open()) this.amount()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
  }
  protected close() {
    this.open.set(false);
    this.invest()?.nativeElement.focus();
  }
}
