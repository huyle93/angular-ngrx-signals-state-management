import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Instrument, statistics } from '@fi/instrument-util/instrument';

@Component({
  selector: 'app-instrument-overview',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eyebrow">
      {{ instrument().category }} · {{ instrument().symbol }}
    </div>
    <h1>{{ instrument().name }}</h1>
    <div class="price-row">
      <strong class="price">{{ stats().price | currency }}</strong>
      <span class="change" [class.negative]="stats().change < 0"
        >{{ stats().change >= 0 ? '+' : ''
        }}{{ stats().change | number: '1.2-2' }} ({{
          stats().changePercent | number: '1.2-2'
        }}%) <span>last synthetic day</span></span
      >
    </div>
    <p class="muted">{{ instrument().description }}</p>
    <p class="as-of">
      Fictional USD values · fixed at 31 Oct 2026 · not a live quote
    </p>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      h1 {
        font-size: clamp(1.75rem, 4vw, 2.6rem);
        letter-spacing: -0.04em;
        margin: 0.6rem 0 1rem;
        line-height: 1.15;
      }
      .eyebrow,
      .as-of {
        font-size: 0.8rem;
        color: var(--fi-muted);
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }
      .price-row {
        display: flex;
        align-items: baseline;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .price {
        font-size: 2.8rem;
        letter-spacing: -0.05em;
      }
      .change {
        color: var(--fi-positive);
        font-weight: 600;
      }
      .change.negative {
        color: var(--fi-error);
      }
      .change span {
        display: block;
        font-size: 0.75rem;
        color: var(--fi-muted);
        margin-top: 0.2rem;
      }
      .muted {
        color: var(--fi-muted);
        line-height: 1.6;
        max-width: 55ch;
      }
      .as-of {
        margin-bottom: 0;
      }
    `,
  ],
})
export class InstrumentOverviewComponent {
  readonly instrument = input.required<Instrument>();
  readonly stats = input.required<NonNullable<ReturnType<typeof statistics>>>();
}
