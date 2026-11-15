import { InstrumentStatusComponent } from '@fi/instrument-ui/instrument-status.component';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { InstrumentStore } from '@fi/instrument-data-access/instrument.store';
import { InstrumentOverviewComponent } from '@fi/instrument-ui/instrument-overview.component';
import { InstrumentChartComponent } from '@fi/instrument-ui/instrument-chart.component';
import { InstrumentDetailsComponent } from '@fi/instrument-ui/instrument-details.component';
import { DemoScenariosComponent } from '@fi/instrument-ui/demo-scenarios.component';
import { DemoTradeComponent } from '@fi/trading/demo-trade.component';
import { ThemePickerComponent } from '@fi/design/theme-picker.component';

@Component({
  selector: 'app-fi-web',
  standalone: true,
  imports: [
    InstrumentStatusComponent,
    RouterLink,
    InstrumentOverviewComponent,
    InstrumentChartComponent,
    InstrumentDetailsComponent,
    DemoScenariosComponent,
    DemoTradeComponent,
    ThemePickerComponent,
  ],
  providers: [InstrumentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fi-web.page.html',
  styleUrl: './fi-web.page.scss',
  host: { class: 'fi-theme' },
})
export class FiWebPage {
  protected readonly store = inject(InstrumentStore);
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
