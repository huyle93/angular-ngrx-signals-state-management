import { Route } from '@angular/router';
import { HomeComponent } from './home.component';
import { CounterComponent } from './counter.component';
import { TodoComponent } from './todo.component';

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
    path: '**',
    redirectTo: '',
  },
];
