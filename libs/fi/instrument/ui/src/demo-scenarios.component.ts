import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { DemoScenario } from '@fi/instrument-util/instrument';
@Component({
  selector: 'app-demo-scenarios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<details>
    <summary>Explore data states</summary>
    <div role="group" aria-label="Simulate data state">
      <button type="button" (click)="scenario.emit('ready')">Ready</button
      ><button type="button" (click)="scenario.emit('slow')">
        Slow loading
      </button>
      <button type="button" (click)="scenario.emit('empty')">Empty</button
      ><button type="button" (click)="scenario.emit('error')">Error</button>
    </div>
    <p>Local simulations only. No request leaves this app.</p>
  </details>`,
  styles: [
    `
      :host {
        display: block;
        font-size: 0.8rem;
        color: var(--fi-muted);
      }
      summary {
        cursor: pointer;
        min-height: 44px;
        align-content: center;
      }
      div {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      button {
        font: inherit;
        min-height: 44px;
        border: 1px solid var(--fi-border);
        background: var(--fi-surface);
        color: var(--fi-text);
        border-radius: 8px;
        padding: 0.5rem 0.8rem;
        cursor: pointer;
      }
    `,
  ],
})
export class DemoScenariosComponent {
  readonly scenario = output<DemoScenario>();
}
