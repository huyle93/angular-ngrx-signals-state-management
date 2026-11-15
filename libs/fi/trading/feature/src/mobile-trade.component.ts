import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonModal,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TradeDraftStore } from '@fi/trading-data-access/trade-draft.store';
import { OrderEntryComponent } from '@fi/trading-ui/order-entry.component';

/** Mobile presentation owns the overlay; its draft outlives the modal's inner view. */
@Component({
  selector: 'app-mobile-trade',
  standalone: true,
  imports: [IonContent, IonHeader, IonModal, IonToolbar, OrderEntryComponent],
  providers: [TradeDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-trade.component.html',
  styleUrl: './mobile-trade.component.scss',
})
export class MobileTradeComponent {
  readonly symbol = input.required<string>();
  readonly price = input.required<number | null>();
  protected readonly draft = inject(TradeDraftStore);
  protected readonly active = signal(false);
  protected readonly openError = signal(false);
  private readonly modal = viewChild.required(IonModal);
  private readonly modalElement = viewChild.required<
    IonModal,
    ElementRef<HTMLIonModalElement>
  >(IonModal, { read: ElementRef });
  private readonly body = viewChild(OrderEntryComponent);
  private readonly trigger =
    viewChild.required<ElementRef<HTMLButtonElement>>('invest');
  private readonly destroyed = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private presenting: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private restoreFocus = true;

  constructor() {
    effect(() => {
      const symbol = this.symbol();
      const price = this.price();
      untracked(() => {
        const changed = this.draft.setContext(symbol, price);
        if ((changed || !this.draft.view()) && this.active())
          void this.dismiss(false);
      });
    });
    this.destroyed.onDestroy(() => {
      void this.dismiss(false);
    });
  }

  protected async open() {
    if (this.closing) await this.closing;
    // Set the latch synchronously: repeated taps cannot queue another overlay.
    if (this.destroyed.destroyed || this.active() || !this.draft.view()) return;
    this.restoreFocus = true;
    this.openError.set(false);
    this.active.set(true);
    this.presenting = this.modal().present();
    try {
      await this.presenting;
    } catch {
      // Contain a failed presentation so the trigger and route guard can recover.
      try {
        await this.dismiss(false);
      } finally {
        this.active.set(false);
        this.openError.set(true);
      }
    } finally {
      this.presenting = undefined;
    }
  }

  /** The route guard awaits this before Angular destroys the inline modal host. */
  dismiss(restoreFocus = true): Promise<void> {
    if (!restoreFocus) this.restoreFocus = false;
    if (this.closing) return this.closing;
    if (!this.active()) return Promise.resolve();
    const modal = this.modal();
    this.closing = (async () => {
      await this.presenting?.catch(() => undefined);
      await modal.dismiss();
    })().finally(() => {
      this.closing = undefined;
    });
    return this.closing;
  }

  protected presented() {
    this.body()?.focusAmount();
  }
  protected wrapTab(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    // Ionic's focus listener redirects background focus. Wrap native controls at
    // the boundary as well, before the browser can move focus into its chrome.
    const controls = Array.from(
      this.modalElement().nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last?.focus();
    }
  }
  protected dismissed() {
    this.active.set(false);
    if (this.destroyed.destroyed) return;
    // Angular must re-enable the trigger before it can receive focus.
    afterNextRender(
      () => {
        const trigger = this.trigger().nativeElement;
        if (
          this.restoreFocus &&
          !this.active() &&
          trigger.isConnected &&
          !trigger.disabled
        )
          trigger.focus();
      },
      { injector: this.injector },
    );
  }
}
