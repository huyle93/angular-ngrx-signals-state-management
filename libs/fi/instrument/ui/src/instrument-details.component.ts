import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Instrument, statistics } from '@fi/instrument-util/instrument';

@Component({
  selector: 'app-instrument-details',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>At a glance</h2>
      <dl>
        <div>
          <dt>Previous close</dt>
          <dd>{{ stats().previous | currency }}</dd>
        </div>
        <div>
          <dt>Year high</dt>
          <dd>{{ stats().high | currency }}</dd>
        </div>
        <div>
          <dt>Year low</dt>
          <dd>{{ stats().low | currency }}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>USD · demo</dd>
        </div>
      </dl>
    </section>
    <section class="research">
      <span class="eyebrow">A little context</span>
      <h2>Behind the idea</h2>
      <p>{{ instrument().research }}</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      h2 {
        font-size: 1.15rem;
        margin: 0 0 1rem;
      }
      dl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
        gap: 1.25rem;
        margin: 0;
      }
      dt {
        font-size: 0.8rem;
        color: var(--fi-muted);
        margin-bottom: 0.4rem;
      }
      dd {
        margin: 0;
        font-weight: 600;
      }
      .research {
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--fi-border);
      }
      .eyebrow {
        color: var(--fi-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .research h2 {
        margin: 0.5rem 0;
      }
      .research p {
        color: var(--fi-muted);
        line-height: 1.7;
        margin-bottom: 0;
        max-width: 65ch;
      }
    `,
  ],
})
export class InstrumentDetailsComponent {
  readonly instrument = input.required<Instrument>();
  readonly stats = input.required<ReturnType<typeof statistics>>();
}
