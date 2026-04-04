import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
} from '@ionic/angular/standalone';
import { FooterTradeEntryStackComponent } from './footer-trade-entry-stack.component';
import { TradeEntryAction, TradeIntent } from './trade-entry.models';

@Component({
  selector: 'app-trade-entry-demo',
  imports: [
    FooterTradeEntryStackComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonNote,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-page-wrapper">
      <div class="mobile-frame">
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>Stock Detail -- AAPL</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content class="demo-content">
          <!-- Simulated PDP body -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>Apple Inc. (AAPL)</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p class="price-line">$178.42 <span class="change positive">+1.23 (+0.69%)</span></p>
              <p class="blurb">
                Technology company that designs, manufactures, and markets smartphones, personal computers,
                tablets, wearables, and accessories.
              </p>
            </ion-card-content>
          </ion-card>

          <!-- Business context controls -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>Simulated Business Context</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-label>Supports Recurring Buy</ion-label>
                  <ion-toggle
                    slot="end"
                    [checked]="supportsRecurringBuy()"
                    (ionChange)="supportsRecurringBuy.set(!supportsRecurringBuy())"
                  />
                </ion-item>
                <ion-item>
                  <ion-label>User Has Position (enables Sell)</ion-label>
                  <ion-toggle
                    slot="end"
                    [checked]="hasPosition()"
                    (ionChange)="hasPosition.set(!hasPosition())"
                  />
                </ion-item>
              </ion-list>
              <ion-note class="state-note">
                Visible actions: {{ tradeEntryActions().length }} &nbsp;|&nbsp;
                Stack expanded: {{ investExpanded() }}
              </ion-note>
            </ion-card-content>
          </ion-card>

          <!-- Event log -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                Event Log
                @if (eventLog().length > 0) {
                  <ion-badge color="medium" class="log-badge">{{ eventLog().length }}</ion-badge>
                }
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="log-entries">
                @for (entry of eventLog(); track $index) {
                  <div class="log-entry">{{ entry }}</div>
                }
                @empty {
                  <div class="log-entry log-empty">No events yet. Tap Invest below.</div>
                }
              </div>
              @if (eventLog().length > 0) {
                <ion-button fill="clear" size="small" color="medium" (click)="eventLog.set([])">
                  Clear Log
                </ion-button>
              }
            </ion-card-content>
          </ion-card>

          <!-- spacer to avoid content hiding behind fixed footer -->
          <div class="footer-spacer"></div>
        </ion-content>

        @if (tradeEntryActions().length > 0) {
          <app-footer-trade-entry-stack
            [actions]="tradeEntryActions()"
            [expanded]="investExpanded()"
            (toggle)="onInvestToggle()"
            (actionSelected)="onTradeEntryActionSelected($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    .demo-page-wrapper {
      display: flex;
      justify-content: center;
      padding: 24px 0;
    }

    .mobile-frame {
      position: relative;
      width: 390px;
      height: 750px;
      border-radius: 44px;
      border: 8px solid #1a1a1a;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      background: #f2f2f7;
      display: flex;
      flex-direction: column;
      // Creates a containing block for position:fixed descendants (app-footer-trade-entry-stack :host)
      // so the fixed footer stays inside the phone frame instead of anchoring to the viewport.
      transform: translateZ(0);
    }

    ion-content.demo-content {
      --background: #f2f2f7;
    }

    .price-line {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a1a1a;
    }

    .change.positive {
      font-size: 15px;
      color: #2e7d32;
      font-weight: 500;
    }

    .blurb {
      font-size: 14px;
      color: #555;
      line-height: 1.5;
    }

    .state-note {
      display: block;
      font-size: 12px;
      color: #999;
      margin-top: 8px;
      padding: 0 4px;
    }

    .log-badge {
      margin-left: 6px;
      font-size: 11px;
      vertical-align: middle;
    }

    .log-entries {
      max-height: 140px;
      overflow-y: auto;
      display: flex;
      flex-direction: column-reverse;
    }

    .log-entry {
      font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 11px;
      padding: 3px 0;
      border-bottom: 1px solid #f0f0f0;
      color: #444;

      &.log-empty {
        color: #aaa;
        font-style: italic;
      }
    }

    .footer-spacer {
      height: 90px;
    }
  `],
})
export class TradeEntryDemoComponent {
  // -- Simulated business context --
  protected readonly supportsRecurringBuy = signal(true);
  protected readonly hasPosition = signal(false);

  // -- State owned by parent --
  protected readonly investExpanded = signal(false);

  protected readonly tradeEntryActions = computed<readonly TradeEntryAction[]>(() => {
    const actions: TradeEntryAction[] = [
      { id: 'buy', label: 'Buy' },
    ];

    if (this.supportsRecurringBuy()) {
      actions.push({ id: 'recurring-buy', label: 'Recurring Buy' });
    }

    if (this.hasPosition()) {
      actions.push({ id: 'sell', label: 'Sell' });
    }

    return actions;
  });

  // -- Demo logging --
  protected readonly eventLog = signal<string[]>([]);

  protected onInvestToggle(): void {
    this.investExpanded.update((v) => !v);
    this.log(`toggle -> expanded: ${this.investExpanded()}`);
  }

  protected onTradeEntryActionSelected(action: TradeEntryAction): void {
    this.investExpanded.set(false);
    this.log(`actionSelected -> ${action.id} ("${action.label}")`);
    this.openTradeTicketModal(action.id);
  }

  private openTradeTicketModal(intent: TradeIntent): void {
    this.log(`modal launch -> intent: ${intent}, symbol: AAPL, account: 12345`);
  }

  private log(message: string): void {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.eventLog.update((entries) => [...entries, `[${ts}] ${message}`]);
  }
}
