import type { FiMobilePage } from '@fi/mobile/fi-mobile.page';
import { Routes } from '@angular/router';
export const appRoutes: Routes = [
  {
    path: 'fi/:symbol',
    canDeactivate: [(page: FiMobilePage) => page.canLeave()],
    loadComponent: () =>
      import('@fi/mobile/fi-mobile.page').then((m) => m.FiMobilePage),
  },
  { path: '**', redirectTo: 'fi/LUMA' },
];
