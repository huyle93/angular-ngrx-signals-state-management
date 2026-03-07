import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { PriceFlashDirective } from './price-flash.directive';
import { PriceTickerComponent } from './price-ticker.component';

@Component({
  selector: 'app-price-ticker-demo',
  imports: [PriceTickerComponent, PriceFlashDirective],
  template: `
    <section class="demo-container" aria-labelledby="ticker-demo-title">
      <h2 id="ticker-demo-title">Price Ticker Odometer Demo</h2>
      <p class="subtitle">Signal-driven simulated stock price updates every 1 second.</p>

      <div class="ticker-panel">
        <app-price-ticker
          class="ticker-value"
          [value]="livePrice()"
          [decimals]="2"
          [instant]="instant()"
          [appPriceFlash]="livePrice()"
        />

        <p class="meta">Tick: {{ tick() }} • Last price: {{ livePrice().toFixed(2) }}</p>
      </div>

      <button type="button" class="btn-snap" (click)="snapNextTick()">
        Snap Next Update
      </button>
    </section>
  `,
  styles: [
    `
      .demo-container {
        max-width: 700px;
        margin: 0 auto;
      }

      h2 {
        color: #1976d2;
        margin-bottom: 0.5rem;
      }

      .subtitle {
        color: #666;
        margin-bottom: 1.5rem;
      }

      .ticker-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 1.5rem;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
      }

      .ticker-value {
        font-size: 3rem;
        font-weight: 700;
        line-height: 1;
        color: #1d1d1f;
      }

      .meta {
        color: #666;
      }

      .btn-snap {
        margin-top: 1rem;
        padding: 0.6rem 1rem;
        border: 1px solid #1976d2;
        background: #1976d2;
        color: white;
        border-radius: 6px;
        cursor: pointer;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceTickerDemoComponent {
  protected readonly tick = signal(0);
  protected readonly instant = signal(false);

  protected readonly livePrice = computed(() => {
    const t = this.tick();
    const baseline = 184.25;
    const drift = t * 0.02;
    const wave = Math.sin(t / 2) * 0.72 + Math.cos(t / 5) * 0.41;
    return Number((baseline + drift + wave).toFixed(2));
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const timer = setInterval(() => {
      this.tick.update(value => value + 1);
      if (this.instant()) {
        this.instant.set(false);
      }
    }, 1000);

    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
    });
  }

  protected snapNextTick(): void {
    this.instant.set(true);
  }
}
