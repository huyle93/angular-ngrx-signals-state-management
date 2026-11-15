import { InstrumentStatusComponent } from '@fi/instrument-ui/instrument-status.component';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { InstrumentStore } from '@fi/instrument-data-access/instrument.store';
import { InstrumentOverviewComponent } from '@fi/instrument-ui/instrument-overview.component';
import { InstrumentChartComponent } from '@fi/instrument-ui/instrument-chart.component';
import { InstrumentDetailsComponent } from '@fi/instrument-ui/instrument-details.component';
import { DemoScenariosComponent } from '@fi/instrument-ui/demo-scenarios.component';
import { MobileTradeComponent } from '@fi/trading/mobile-trade.component';
import { ThemePickerComponent } from '@fi/design/theme-picker.component';
import { IonHeader, IonToolbar, IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-fi-mobile',
  standalone: true,
  imports: [
    InstrumentStatusComponent,
    RouterLink,
    InstrumentOverviewComponent,
    InstrumentChartComponent,
    InstrumentDetailsComponent,
    DemoScenariosComponent,
    MobileTradeComponent,
    ThemePickerComponent,
    IonHeader,
    IonToolbar,
    IonContent,
  ],
  providers: [InstrumentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fi-mobile.page.html',
  styleUrl: './fi-mobile.page.scss',
  host: { class: 'fi-theme ion-page' },
})
export class FiMobilePage {
  protected readonly store = inject(InstrumentStore);
  private readonly trading = viewChild.required(MobileTradeComponent);
  async canLeave() {
    await this.trading().dismiss(false);
    return true;
  }
  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('symbol') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((symbol) => {
        void this.store.load(symbol);
      });
  }
}
