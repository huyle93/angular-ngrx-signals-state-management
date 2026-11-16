import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoTheme } from './demo-theme';
@Component({
  selector: 'app-theme-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label
    >Appearance
    <select
      aria-label="Demo appearance"
      [value]="theme.brand()"
      (change)="theme.select($any($event.target).value)"
    >
      <option value="a">Demo A · Grove</option>
      <option value="b">Demo B · Ink</option>
    </select></label
  >`,
  styles: [
    `
      label {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        font-size: 0.8rem;
        color: var(--fi-muted);
      }
      select {
        font: inherit;
        color: var(--fi-text);
        background: var(--fi-surface);
        border: 1px solid var(--fi-border);
        border-radius: 8px;
        min-height: 44px;
        max-width: 100%;
        padding: 0.5rem;
      }
    `,
  ],
})
export class ThemePickerComponent {
  protected readonly theme = inject(DemoTheme);
}
