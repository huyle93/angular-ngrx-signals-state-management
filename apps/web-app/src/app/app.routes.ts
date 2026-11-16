import { DemoShellComponent } from './demo-shell.component';
import { Route } from '@angular/router';
import { HomeComponent } from './home.component';
import { CounterComponent } from './counter.component';
import { TodoComponent } from './todo.component';
import { PriceTickerDemoComponent } from './price-ticker-demo.component';
import { TradeEntryDemoComponent } from './trade-entry/trade-entry-demo.component';

export const appRoutes: Route[] = [
  {
    path: 'fi/:symbol',
    loadComponent: () => import('@fi/web/fi-web.page').then((m) => m.FiWebPage),
  },
  {
    path: '',
    component: DemoShellComponent,
    children: [
      {
        path: '',
        component: HomeComponent,
      },
      {
        path: 'counter',
        component: CounterComponent,
      },
      {
        path: 'todo',
        component: TodoComponent,
      },
      {
        path: 'ticker',
        component: PriceTickerDemoComponent,
      },
      {
        path: 'fi-preview',
        loadComponent: () =>
          import('./demo-preview/fi-preview.component').then(
            (m) => m.FiPreviewComponent,
          ),
      },
      {
        path: 'trade-entry',
        component: TradeEntryDemoComponent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
