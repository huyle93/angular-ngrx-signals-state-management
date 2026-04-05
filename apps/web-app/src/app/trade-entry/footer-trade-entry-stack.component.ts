import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
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

/**
 * Minimum ms between toggle taps. Covers the full animation window:
 * 260ms slide + max stagger (2 * 55ms) + 30ms buffer = 400ms ceiling,
 * but 350ms is sufficient to block accidental double-taps while allowing
 * intentional quick close → reopen.
 */
const TOGGLE_GUARD_MS = 350;

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
        >
          <ion-button
            expand="block"
            fill="solid"
            color="primary"
            class="trade-entry-action-btn"
            [style.transition-delay]="expanded() ? (i * 55) + 'ms' : '0ms'"
            [disabled]="action.disabled ?? false"
            [attr.tabindex]="actionsInteractive() ? 0 : -1"
            (click)="onActionTap(action)"
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
            (click)="onToggleTap()"
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

  /**
   * True only after the expand animation fully settles (last button visible).
   * Prevents accidental action selection while buttons are still animating in.
   */
  protected readonly actionsInteractive = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  // Toggle guard: blocks re-tapping during animation window.
  private toggleGuardActive = false;
  private toggleGuardTimer: ReturnType<typeof setTimeout> | null = null;

  // Settle timer: gates action interactivity until expand animation completes.
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({ closeOutline });

    // Watch expanded state to manage action interactivity window.
    // effect() is appropriate here: it's a UI side-effect (timer management),
    // not business logic.
    effect(() => {
      const isExpanded = this.expanded();

      if (this.settleTimer !== null) {
        clearTimeout(this.settleTimer);
        this.settleTimer = null;
      }

      if (!isExpanded) {
        // Disable immediately — do not wait for collapse animation.
        this.actionsInteractive.set(false);
      } else {
        // Enable after the last button finishes sliding in.
        // = transition duration + stagger of last item + small buffer.
        const settleMs = 260 + (this.actions().length - 1) * 55 + 20;
        this.settleTimer = setTimeout(() => {
          this.actionsInteractive.set(true);
          this.settleTimer = null;
        }, settleMs);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.settleTimer !== null) clearTimeout(this.settleTimer);
      if (this.toggleGuardTimer !== null) clearTimeout(this.toggleGuardTimer);
    });
  }

  /**
   * Guards against double-tap / rapid toggle.
   * Emits toggle only once per TOGGLE_GUARD_MS window.
   */
  protected onToggleTap(): void {
    if (this.toggleGuardActive) return;
    this.toggleGuardActive = true;
    if (this.toggleGuardTimer !== null) clearTimeout(this.toggleGuardTimer);
    this.toggleGuardTimer = setTimeout(() => {
      this.toggleGuardActive = false;
      this.toggleGuardTimer = null;
    }, TOGGLE_GUARD_MS);
    this.toggle.emit();
  }

  /**
   * Guards against taps while the expand animation is still in progress.
   * actionsInteractive() becomes true only after the last button settles.
   */
  protected onActionTap(action: TradeEntryAction): void {
    if (!this.actionsInteractive()) return;
    this.actionSelected.emit(action);
  }
}
