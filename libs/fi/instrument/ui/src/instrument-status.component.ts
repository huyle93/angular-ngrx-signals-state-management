import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { InstrumentStatus } from '@fi/instrument-util/instrument';

@Component({
  selector: 'app-instrument-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      #region
      tabindex="-1"
      aria-label="Instrument status"
      [class.fi-status]="status() !== 'ready' && status() !== 'idle'"
    >
      @if (status() === 'empty') {
        <h1>No instrument data</h1>
      }
      @if (status() === 'error') {
        <h1>Unable to load this idea</h1>
      }
      <p role="status" aria-live="polite" aria-atomic="true">{{ message() }}</p>
      @if (status() === 'empty' || status() === 'error') {
        <button type="button" (click)="requestRetry()">Try again</button>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 1rem;
      }
      section {
        border-radius: 8px;
      }
      p {
        font-size: 0.8rem;
        color: var(--fi-muted);
        margin: 0.5rem 0;
      }
      h1 {
        font-size: 1.4rem;
        margin-top: 0;
      }
    `,
  ],
})
export class InstrumentStatusComponent {
  readonly status = input.required<InstrumentStatus>();
  readonly symbol = input.required<string>();
  readonly error = input('');
  readonly retry = output<void>();
  private readonly region =
    viewChild.required<ElementRef<HTMLElement>>('region');
  protected readonly message = computed(() => {
    switch (this.status()) {
      case 'loading':
        return 'Loading synthetic instrument…';
      case 'ready':
        return `Synthetic data loaded for ${this.symbol()}.`;
      case 'empty':
        return `No synthetic values are available for ${this.symbol()}. Choose LUMA or TIDE, or try again.`;
      case 'error':
        return this.error();
      default:
        return '';
    }
  });
  protected requestRetry() {
    // The region and its live paragraph survive loading and recovery. Keyboard
    // focus stays here when the retry button is removed, before the loaded UI.
    this.region().nativeElement.focus();
    this.retry.emit();
  }
}
