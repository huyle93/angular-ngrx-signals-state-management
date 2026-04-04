import { Route } from '@angular/router';
import { HomeComponent } from './home.component';
import { CounterComponent } from './counter.component';
import { TodoComponent } from './todo.component';
import { PriceTickerDemoComponent } from './price-ticker-demo.component';
import { TradeEntryDemoComponent } from './trade-entry/trade-entry-demo.component';

export const appRoutes: Route[] = [
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
    path: 'trade-entry',
    component: TradeEntryDemoComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
