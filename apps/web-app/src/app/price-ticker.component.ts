import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface TickerSegment {
  isDigit: boolean;
  char: string;
  offset: string;
}

@Component({
  selector: 'app-price-ticker',
  imports: [],
  template: `
    <span class="sr-only">{{ currencySymbol() }}{{ formatted() }}</span>

    <div class="ticker-wrapper" aria-hidden="true">
      <span class="static-char">{{ currencySymbol() }}</span>

      @for (segment of segments(); track $index) {
        @if (segment.isDigit) {
          <div class="digit-viewport">
            <div
              class="digit-strip"
              [style.transform]="segment.offset"
              [style.transition-duration]="duration()">
              <div>0</div><div>1</div><div>2</div><div>3</div><div>4</div>
              <div>5</div><div>6</div><div>7</div><div>8</div><div>9</div>
            </div>
          </div>
        } @else {
          <span class="static-char">{{ segment.char }}</span>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: baseline;
        font-variant-numeric: tabular-nums;
        font-feature-settings: 'tnum';
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }

      .ticker-wrapper {
        display: flex;
        align-items: baseline;
      }

      .static-char {
        line-height: 1em;
      }

      .digit-viewport {
        display: inline-block;
        width: 1ch;
        height: 1em;
        line-height: 1em;
        overflow: hidden;
        contain: strict;
      }

      .digit-strip {
        display: flex;
        flex-direction: column;
        will-change: transform;
        transition-property: transform;
        transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
      }

      .digit-strip > div {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 1em;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceTickerComponent {
  readonly value = input.required<number>();
  readonly instant = input(false);
  readonly currencySymbol = input('$');
  readonly decimals = input(2);

  private readonly formatter = computed(
    () =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: this.decimals(),
        maximumFractionDigits: this.decimals(),
        useGrouping: true,
      })
  );

  protected readonly formatted = computed(() => this.formatter().format(this.value()));

  protected readonly duration = computed(() => (this.instant() ? '0ms' : '500ms'));

  protected readonly segments = computed<TickerSegment[]>(() =>
    this.formatted().split('').map(char => {
      const isDigit = /\d/.test(char);
      const digit = isDigit ? parseInt(char, 10) : 0;
      return {
        isDigit,
        char,
        offset: isDigit ? `translate3d(0, -${digit * 10}%, 0)` : '',
      };
    })
  );
}
