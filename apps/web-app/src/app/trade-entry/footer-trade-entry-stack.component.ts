import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import {
  IonFooter,
  IonToolbar,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TradeEntryAction } from './trade-entry.models';

@Component({
  selector: 'app-footer-trade-entry-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonFooter, IonToolbar, IonButton, IonIcon],
  template: `
    <div
      class="trade-entry-stack-actions"
      id="trade-entry-stack"
      [class.expanded]="expanded()"
    >
      @for (action of actions(); track action.id; let i = $index) {
        <div
          class="action-slot"
          [style.--i]="i"
        >
          <ion-button
            expand="block"
            fill="solid"
            color="primary"
            class="trade-entry-action-btn"
            [disabled]="action.disabled ?? false"
            [attr.tabindex]="expanded() ? 0 : -1"
            (click)="actionSelected.emit(action)"
          >
            {{ action.label }}
          </ion-button>
        </div>
      }
    </div>

    <ion-footer>
      <ion-toolbar>
        <div class="trade-entry-toolbar-inner">
          <ion-button
            expand="block"
            color="primary"
            [fill]="expanded() ? 'outline' : 'solid'"
            class="trade-entry-toggle-btn"
            [class.is-open]="expanded()"
            [attr.aria-expanded]="expanded()"
            aria-controls="trade-entry-stack"
            (click)="toggle.emit()"
          >
            <span class="toggle-label">
              <span class="label-invest">{{ toggleLabel() }}</span>
              <ion-icon name="close-outline" class="label-close" aria-hidden="true" />
            </span>
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  `,
  styleUrl: './footer-trade-entry-stack.component.scss',
})
export class FooterTradeEntryStackComponent {
  readonly actions = input.required<readonly TradeEntryAction[]>();
  readonly expanded = input(false);
  readonly toggleLabel = input('Invest');

  readonly toggle = output<void>();
  readonly actionSelected = output<TradeEntryAction>();

  constructor() {
    addIcons({ closeOutline });
  }
}
