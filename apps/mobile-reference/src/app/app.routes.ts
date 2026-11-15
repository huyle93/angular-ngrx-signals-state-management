import { Routes } from '@angular/router';
export const appRoutes: Routes = [
  {
    path: 'fi/:symbol',
    loadComponent: () =>
      import('@fi/mobile/fi-mobile.page').then((m) => m.FiMobilePage),
  },
  { path: '**', redirectTo: 'fi/LUMA' },
];
