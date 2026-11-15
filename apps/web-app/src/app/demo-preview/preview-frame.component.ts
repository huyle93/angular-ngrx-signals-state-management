import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Demo-only viewport chrome. Projected content owns its UI and scrolling. */
@Component({
  selector: 'app-preview-frame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage" tabindex="0" role="region" aria-label="Preview viewport">
      <div
        class="viewport"
        [class.phone]="phone()"
        [style.--preview-width]="width() + 'px'"
        [style.height.px]="height()"
      >
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .stage {
        max-width: 100%;
        overflow: auto;
        padding: 24px 12px 36px;
      }
      .stage:focus-visible {
        outline: 3px solid #1976d2;
        outline-offset: -3px;
      }
      .viewport {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid #c6cdd5;
        border-radius: 12px;
        background: #fff;
        // Contain legacy fixed footers within this demo viewport.
        transform: translateZ(0);
      }
      .phone {
        width: var(--preview-width);
        box-sizing: content-box;
        border: 8px solid #1a1a1a;
        border-radius: 36px;
        margin-inline: auto;
        box-shadow: 0 12px 24px rgb(0 0 0 / 15%);
      }
    `,
  ],
})
export class PreviewFrameComponent {
  readonly phone = input(true);
  readonly width = input(390);
  readonly height = input(750);
}
