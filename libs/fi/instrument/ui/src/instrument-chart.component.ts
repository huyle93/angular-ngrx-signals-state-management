import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ChartRange, PricePoint } from '@fi/instrument-util/instrument';

@Component({
  selector: 'app-instrument-chart',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-heading">
      <h2>Price story</h2>
      <div class="ranges" role="group" aria-label="Chart range">
        @for (option of ranges; track option) {
          <button
            type="button"
            [attr.aria-pressed]="range() === option"
            (click)="rangeChange.emit(option)"
          >
            {{ option }}
          </button>
        }
      </div>
    </div>
    <p class="muted">
      {{ series().at(0)?.date }} — {{ series().at(-1)?.date }} · synthetic
      history
    </p>
    <svg
      viewBox="0 0 600 210"
      role="img"
      [attr.aria-label]="summary()"
      preserveAspectRatio="none"
    >
      <path d="M 0 40 H 600 M 0 105 H 600 M 0 170 H 600" class="grid" />
      <polyline
        [attr.points]="points()"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div class="extent">
      <span>Low {{ low() | currency }}</span
      ><span>High {{ high() | currency }}</span>
    </div>
    <details>
      <summary>View chart values</summary>
      <div class="values">
        <table>
          <caption>
            All
            {{
              range()
            }}
            synthetic closing values
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">USD</th>
            </tr>
          </thead>
          <tbody>
            @for (point of series(); track point.date) {
              <tr>
                <td>{{ point.date }}</td>
                <td>{{ point.price | currency }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .chart-heading {
        display: flex;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      h2 {
        font-size: 1.15rem;
        margin: 0;
      }
      .ranges {
        display: flex;
        gap: 0.35rem;
      }
      button {
        min-height: 44px;
        min-width: 48px;
        border: 1px solid var(--fi-border);
        border-radius: 8px;
        background: var(--fi-surface);
        color: var(--fi-text);
        font: inherit;
        cursor: pointer;
      }
      button[aria-pressed='true'] {
        background: var(--fi-action);
        color: var(--fi-on-action);
        border-color: var(--fi-action);
      }
      svg {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 12 / 5;
        min-height: 150px;
        max-height: 250px;
        color: var(--fi-action);
        margin: 1.5rem 0 1rem;
      }
      .grid {
        stroke: var(--fi-border);
        stroke-dasharray: 3 6;
        fill: none;
      }
      .muted,
      .extent {
        color: var(--fi-muted);
        font-size: 0.8rem;
      }
      .extent {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      details {
        margin-top: 1.25rem;
      }
      summary {
        min-height: 44px;
        align-content: center;
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--fi-action);
      }
      table {
        border-collapse: collapse;
        width: 100%;
        font-size: 0.85rem;
      }
      th,
      td {
        padding: 0.6rem;
        border-bottom: 1px solid var(--fi-border);
        text-align: left;
      }
      caption {
        text-align: left;
        margin: 1rem 0;
      }
    `,
  ],
})
export class InstrumentChartComponent {
  readonly series = input.required<readonly PricePoint[]>();
  readonly range = input.required<ChartRange>();
  readonly rangeChange = output<ChartRange>();
  protected readonly ranges: readonly ChartRange[] = ['1M', '3M', '1Y'];
  protected readonly low = computed(() =>
    Math.min(...this.series().map((p) => p.price)),
  );
  protected readonly high = computed(() =>
    Math.max(...this.series().map((p) => p.price)),
  );
  protected readonly points = computed(() =>
    this.series()
      .map(
        (p, i, all) =>
          `${(i / Math.max(all.length - 1, 1)) * 600},${185 - ((p.price - this.low()) / (this.high() - this.low() || 1)) * 160}`,
      )
      .join(' '),
  );
  protected readonly summary = computed(
    () =>
      `${this.range()} synthetic price chart. Low ${this.low().toFixed(2)} USD, high ${this.high().toFixed(2)} USD. Full values follow.`,
  );
}
