# Ionic Angular Navigation -- AI Agent Instructions

> Authoritative routing reference for an Ionic Angular investing app (similar to Robinhood).
> All generated code must follow these patterns exactly. Deviations produce broken navigation
> stacks, corrupted tab state, or incorrect back-button behavior on native devices.

---

## Table of Contents

1. [Technology Constraints](#1-technology-constraints)
2. [Mental Model: Mobile Navigation Stacks](#2-mental-model-mobile-navigation-stacks)
3. [Application Shell](#3-application-shell)
4. [Tab Routing](#4-tab-routing)
5. [Asset Detail Page (PDP) -- Reusing Views Across Tabs](#5-asset-detail-page-pdp----reusing-views-across-tabs)
6. [Global Search -- Modal Pattern](#6-global-search----modal-pattern)
7. [Get-Started Account Opening Wizard](#7-get-started-account-opening-wizard)
8. [Route vs Modal -- Decision Framework](#8-route-vs-modal----decision-framework)
9. [Animations and Gestures](#9-animations-and-gestures)
10. [Page Lifecycle](#10-page-lifecycle)
11. [Navigation API Reference](#11-navigation-api-reference)
12. [Common Mistakes](#12-common-mistakes)

---

## 1. Technology Constraints

| Dependency | Version | Notes |
|---|---|---|
| Angular | 20+ | Zoneless, signal-based, standalone only |
| Ionic | 8+ (latest) | All imports from `@ionic/angular/standalone` |
| TypeScript | 5.8+ | Strict mode |

**Hard rules for every generated file:**

- Standalone components only. No `NgModule`.
- All Ionic imports from `@ionic/angular/standalone`. Never `@ionic/angular`.
- Bootstrap with `provideIonicAngular()`, `provideZonelessChangeDetection()`, and
  `{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }`.
- `ChangeDetectionStrategy.OnPush` on every component.
- `signal()`, `computed()`, signal `input()` / `output()` for all state. No `@Input` decorators.
- `@if` / `@for` / `@switch` control flow. No structural directives.

---

## 2. Mental Model: Mobile Navigation Stacks

### 2.1 How `ion-router-outlet` Works

`ion-router-outlet` manages a stack of pages. Navigating forward pushes a new page on top;
the previous page is hidden but stays alive in the DOM (scroll position, form state preserved).
Navigating back pops and destroys the top page, revealing the one beneath.

This differs from Angular's `router-outlet`, which destroys the previous component on every
navigation. Consequence: `ngOnInit` fires once per page creation, not on every visit. Use
Ionic lifecycle hooks (`ionViewWillEnter`) for logic that must run on re-entry.

### 2.2 Non-Linear Routing (Tabs)

Our app uses four tabs, so it uses **non-linear routing**. Each tab maintains its own
independent navigation stack. Switching tabs does not push or pop -- it swaps which stack is
visible. Pressing back navigates within the current tab's stack, not the global browser
history.

**Critical rule: Never use `LocationStrategy.historyGo()` in this app.** It operates on
global browser history and will navigate across tab boundaries unpredictably.

### 2.3 Swipe-Back Gesture (iOS)

On iOS, `ion-router-outlet` enables a native swipe-from-left-edge gesture to pop the current
page. This works because the previous page stays alive in the DOM — Ionic animates both pages
simultaneously during the swipe.

**For swipe-back to work correctly:**

- Pages must be inside `ion-router-outlet`, not `router-outlet`.
- Navigation must use forward-push semantics (`navigateForward` or `routerDirection="forward"`).
  Pages reached via `navigateRoot` replace the stack and are not swipe-back eligible.
- `ion-back-button` is not required for the swipe gesture — the outlet handles it. But always
  include `ion-back-button` as a visible tap target for users who don't discover the gesture.

Modal dismiss gestures are separate — see [Section 9: Animations and Gestures](#9-animations-and-gestures).

---

## 3. Application Shell

### 3.1 main.ts

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({}),
    provideRouter(routes),
  ],
});
```

### 3.2 app.component.ts

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class AppComponent {}
```

---

## 4. Tab Routing

### 4.1 Complete Route Configuration

This is the single source of truth for the app's routing structure. Every tab-scoped page is
a sibling child of the `tabs` route, prefixed by its tab name so the tab bar highlights
correctly.

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tabs/portfolio', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.component').then(m => m.TabsComponent),
    children: [
      // --- Portfolio tab ---
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./portfolio/portfolio.component').then(m => m.PortfolioComponent),
      },
      {
        path: 'portfolio/asset/:ticker',
        loadComponent: () =>
          import('./shared/asset-detail.component').then(m => m.AssetDetailComponent),
      },

      // --- Discover tab ---
      {
        path: 'discover',
        loadComponent: () =>
          import('./discover/discover.component').then(m => m.DiscoverComponent),
      },
      {
        path: 'discover/asset/:ticker',
        loadComponent: () =>
          import('./shared/asset-detail.component').then(m => m.AssetDetailComponent),
      },

      // --- News tab ---
      {
        path: 'news',
        loadComponent: () => import('./news/news.component').then(m => m.NewsComponent),
      },
      {
        path: 'news/asset/:ticker',
        loadComponent: () =>
          import('./shared/asset-detail.component').then(m => m.AssetDetailComponent),
      },

      // --- Profile tab ---
      {
        path: 'profile',
        loadComponent: () =>
          import('./profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'profile/settings',
        loadComponent: () =>
          import('./profile/settings.component').then(m => m.SettingsComponent),
      },

      { path: '', redirectTo: 'portfolio', pathMatch: 'full' },
    ],
  },
];
```

**Why sibling routes, not nested `children`?** Each `path: 'portfolio/asset/:ticker'` is a
sibling entry under the `tabs` children -- not inside a further nested `children` array of the
`portfolio` route. This is the correct Ionic pattern because:

1. Ionic's `ion-tabs` already renders its own nested `ion-router-outlet`. Adding more nesting
   creates duplicate outlets that break page transitions.
2. Sibling routes with the tab prefix (e.g. `portfolio/...`) keep that tab highlighted in the
   tab bar. Ionic matches the first path segment to determine the active tab.
3. The back button correctly pops within the tab's stack.

### 4.2 Tabs Component

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { pieChart, compass, newspaper, person } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="portfolio">
          <ion-icon name="pie-chart" />
          <ion-label>Portfolio</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="discover">
          <ion-icon name="compass" />
          <ion-label>Discover</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="news">
          <ion-icon name="newspaper" />
          <ion-label>News</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile">
          <ion-icon name="person" />
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsComponent {
  constructor() {
    addIcons({ pieChart, compass, newspaper, person });
  }
}
```

The `tab` property on each `ion-tab-button` must exactly match the `path` in the route config.
No manually placed `ion-router-outlet` is needed -- `ion-tabs` creates one internally.

### 4.3 Tab Rules

These are inviolable. Violating them produces broken stacks and confusing UX.

1. **Tabs switch only via the tab bar.** No button or `router.navigate()` call in one tab
   may activate a different tab. If Portfolio needs to show something from Discover, either
   duplicate the route under the `portfolio/` prefix or use a modal.

2. **Each tab is an independent stack.** Navigation inside Portfolio never touches the
   Discover stack. When the user returns to Discover, they see exactly the page they left.

3. **Always use absolute paths.** Navigate with `/tabs/portfolio/asset/AAPL`, not relative
   `asset/AAPL`. Relative paths are ambiguous when the user is deep in a tab stack.

4. **Always set `defaultHref` on `ion-back-button`.** This is the fallback if there is no
   previous page in the stack (e.g. the user deep-linked directly).

### 4.4 Do's and Don'ts

> **DO:** Use `loadComponent` with lazy imports for every route.
> **DO:** Prefix all child routes with the tab name (`portfolio/asset/:ticker`).
> **DO:** Use absolute paths for all in-tab navigation (`/tabs/portfolio/...`).
>
> **DON'T:** Nest a `children` array inside a tab's root route — keep sub-pages as siblings under `tabs`.
> **DON'T:** Navigate programmatically to a different tab's route prefix.
> **DON'T:** Place `ion-router-outlet` manually inside the tabs template — `ion-tabs` creates it.

---

## 5. Asset Detail Page (PDP) -- Reusing Views Across Tabs

The Asset Detail Page displays a stock or crypto (AAPL, BTC, etc.). It is reachable from
Portfolio, Discover, and News. This is the most common "reuse across tabs" pattern in our app.

### 5.1 Why Route Duplication, Not a Single Shared Route

A shared route like `tabs/asset/:ticker` would break tab highlighting -- Ionic would not know
which tab to select, and the back button would behave unpredictably. Instead, every tab that
needs PDP gets its own route entry, all pointing to the same `AssetDetailComponent`:

```
tabs/portfolio/asset/:ticker   --> AssetDetailComponent
tabs/discover/asset/:ticker    --> AssetDetailComponent
tabs/news/asset/:ticker        --> AssetDetailComponent
```

This is the pattern used by Robinhood and Spotify: the same UI component, separate per-tab
routes, ensuring independent stack behavior and correct tab highlighting.

### 5.2 AssetDetailComponent

```typescript
import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-asset-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/portfolio" />
        </ion-buttons>
        <ion-title>{{ ticker() }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Price chart, buy/sell buttons, holdings info -->
    </ion-content>
  `,
})
export class AssetDetailComponent {
  readonly ticker = input.required<string>();
}
```

### 5.3 Navigating to PDP from Different Tabs

From Portfolio:

```typescript
// Inside PortfolioComponent
this.navCtrl.navigateForward(['/tabs/portfolio/asset', 'AAPL']);
```

From Discover:

```typescript
// Inside DiscoverComponent
this.navCtrl.navigateForward(['/tabs/discover/asset', 'BTC']);
```

From a News article:

```typescript
// Inside NewsComponent
this.navCtrl.navigateForward(['/tabs/news/asset', 'TSLA']);
```

Each navigation pushes onto the current tab's stack. Back returns to the originating list.
Tab bar stays on the correct tab.

### 5.4 Do's and Don'ts

> **DO:** Create one route entry per tab, all pointing to the same `AssetDetailComponent`.
> **DO:** Use `input.required<string>()` for the `ticker` route param (bound via `withComponentInputBinding()`).
> **DO:** Set `defaultHref` to the current tab's root (e.g. `/tabs/portfolio`) on `ion-back-button`.
>
> **DON'T:** Create a single shared `tabs/asset/:ticker` route — it breaks tab highlighting and back navigation.
> **DON'T:** Navigate to a PDP route under a different tab's prefix from the current tab.

---

## 6. Global Search -- Modal Pattern

Search can be launched from Portfolio, Discover, and from within the Asset Detail page. It
does not belong to any single tab. This makes it a **modal**, not a routed page.

### 6.1 Why a Modal Instead of a Route

| Consideration | Route approach (wrong) | Modal approach (correct) |
|---|---|---|
| Tab ownership | Which tab prefix? `portfolio/search`? Breaks when launched from Discover. | Floats above all tabs. No tab ownership conflict. |
| Back behavior | Pushing a search route corrupts the current tab stack. Results page cannot "go back" to the correct origin. | Dismissing the modal returns exactly where the user was. |
| Origin context | The search page does not know how to "go back" to Portfolio vs Discover. | The modal simply closes, revealing the underlying page unchanged. |
| Deep linking | Global search is transient -- URL-addressing it adds no user value. | Correct for ephemeral, context-independent surfaces. |

### 6.2 SearchModalService

```typescript
import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { SearchModalComponent } from './search-modal.component';

@Injectable({ providedIn: 'root' })
export class SearchModalService {
  private readonly modalCtrl = inject(ModalController);

  async open(): Promise<{ ticker: string } | null> {
    const modal = await this.modalCtrl.create({
      component: SearchModalComponent,
      // Full-screen on mobile, sheet-style on tablet if desired:
      // breakpoints: [0, 0.75, 1], initialBreakpoint: 1,
    });
    await modal.present();

    const { data, role } = await modal.onDidDismiss<{ ticker: string }>();
    return role === 'select' ? data ?? null : null;
  }
}
```

### 6.3 SearchModalComponent

```typescript
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import {
  ModalController, IonHeader, IonToolbar, IonButtons, IonButton,
  IonSearchbar, IonContent, IonList, IonItem, IonLabel,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonButtons, IonButton,
    IonSearchbar, IonContent, IonList, IonItem, IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-searchbar
          placeholder="Search stocks, crypto, ETFs..."
          (ionInput)="onSearch($event)"
          [debounce]="300"
        />
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        @for (result of results(); track result.ticker) {
          <ion-item button (click)="select(result.ticker)">
            <ion-label>
              <h2>{{ result.ticker }}</h2>
              <p>{{ result.name }}</p>
            </ion-label>
          </ion-item>
        }
      </ion-list>
    </ion-content>
  `,
})
export class SearchModalComponent {
  private readonly modalCtrl = inject(ModalController);

  protected readonly results = signal<{ ticker: string; name: string }[]>([]);

  protected onSearch(event: CustomEvent): void {
    const query = (event.detail.value ?? '').trim();
    // Call search API, update results signal
  }

  protected select(ticker: string): void {
    this.modalCtrl.dismiss({ ticker }, 'select');
  }

  protected dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
```

### 6.4 Consuming Search Results

The calling component opens search, receives the selected ticker, then navigates within its
own tab:

```typescript
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NavController, IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { SearchModalService } from '../shared/search-modal.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonButton, IonIcon],
  template: `
    <ion-content>
      <ion-button fill="clear" (click)="openSearch()">
        <ion-icon name="search" slot="icon-only" />
      </ion-button>
      <!-- Portfolio holdings list -->
    </ion-content>
  `,
})
export class PortfolioComponent {
  private readonly navCtrl = inject(NavController);
  private readonly searchModal = inject(SearchModalService);

  protected async openSearch(): Promise<void> {
    const result = await this.searchModal.open();
    if (result) {
      // Navigate within THIS tab (portfolio), not across tabs
      this.navCtrl.navigateForward(['/tabs/portfolio/asset', result.ticker]);
    }
  }
}
```

If search is launched from the Asset Detail page inside the Discover tab, the same pattern
applies -- the PDP component calls `searchModal.open()` and navigates to
`/tabs/discover/asset/<ticker>`. The modal correctly overlays whatever tab is active.

### 6.5 Do's and Don'ts

> **DO:** Wrap `ModalController.create()` in a service for modals launched from multiple places.
> **DO:** Navigate within the *current* tab after the modal dismisses — never cross tabs.
> **DO:** Use `role` to distinguish `confirm` / `cancel` / `select` outcomes in `onDidDismiss`.
>
> **DON'T:** Route to a search page under a tab prefix — search is cross-tab, use a modal.
> **DON'T:** Mix `ModalController` and `isOpen` binding for the same modal instance — pick one pattern.

---

## 7. Get-Started Account Opening Wizard

After login, the user may need to open investing accounts (Brokerage, Crypto, IRA). This
wizard is a multi-step flow launchable from Portfolio ("Open a Brokerage Account" CTA),
Discover ("Start Trading Crypto" CTA), or Profile ("Open New Account" button).

### 7.1 Why a Modal, Not Routed Pages

A wizard like this cannot be implemented as tab routes for three reasons:

1. **Cross-tab launching.** If the wizard routes live under `portfolio/`, launching from
   Discover would either cross tabs (forbidden) or require route duplication of every wizard
   step in every tab (absurd for a multi-step flow).

2. **Back button conflict.** If wizard steps are routed pages in a tab stack, pressing the
   hardware back button pops a wizard step -- but also corrupts the tab's real navigation
   history. The user cannot cleanly abandon the wizard mid-flow.

3. **Isolation.** The wizard is a self-contained flow with its own "Cancel" and "Back"
   semantics. A modal encapsulates this perfectly: dismiss to abandon, internal step
   navigation is managed by signals, and the underlying tab is untouched.

### 7.2 AccountOpeningWizardComponent

```typescript
import { Component, ChangeDetectionStrategy, signal, computed, inject, input } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonProgressBar, ModalController,
} from '@ionic/angular/standalone';

type AccountType = 'brokerage' | 'crypto' | 'ira';

@Component({
  selector: 'app-account-opening-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonProgressBar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          @if (currentStepIndex() > 0) {
            <ion-button (click)="previousStep()">Back</ion-button>
          } @else {
            <ion-button (click)="cancel()">Cancel</ion-button>
          }
        </ion-buttons>
        <ion-title>{{ stepTitles[currentStepIndex()] }}</ion-title>
        <ion-buttons slot="end">
          @if (isLastStep()) {
            <ion-button (click)="submit()" [strong]="true">Submit</ion-button>
          } @else {
            <ion-button (click)="nextStep()" [disabled]="!canAdvance()">
              Next
            </ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar [value]="progress()" />
    </ion-header>
    <ion-content class="ion-padding">
      @switch (currentStepIndex()) {
        @case (0) {
          <!-- Step 1: Select account type (brokerage / crypto / IRA) -->
        }
        @case (1) {
          <!-- Step 2: Personal information & disclosures -->
        }
        @case (2) {
          <!-- Step 3: Funding source (link bank, transfer) -->
        }
        @case (3) {
          <!-- Step 4: Review & submit -->
        }
      }
    </ion-content>
  `,
})
export class AccountOpeningWizardComponent {
  private readonly modalCtrl = inject(ModalController);

  /** Pre-selected account type passed from the launching context. */
  readonly preselectedType = input<AccountType>();

  protected readonly stepTitles = [
    'Account Type',
    'Personal Info',
    'Funding',
    'Review & Submit',
  ];

  protected readonly currentStepIndex = signal(0);
  protected readonly canAdvance = signal(true); // Validate per step

  protected readonly isLastStep = computed(
    () => this.currentStepIndex() === this.stepTitles.length - 1,
  );

  protected readonly progress = computed(
    () => (this.currentStepIndex() + 1) / this.stepTitles.length,
  );

  protected nextStep(): void {
    this.currentStepIndex.update(i => Math.min(i + 1, this.stepTitles.length - 1));
  }

  protected previousStep(): void {
    this.currentStepIndex.update(i => Math.max(i - 1, 0));
  }

  protected cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  protected submit(): void {
    // Call account creation API, then dismiss on success
    this.modalCtrl.dismiss({ accountType: 'brokerage' }, 'confirm');
  }
}
```

### 7.3 AccountOpeningService

Wraps the modal creation so any component can launch the wizard with one call:

```typescript
import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { AccountOpeningWizardComponent } from './account-opening-wizard.component';

type AccountType = 'brokerage' | 'crypto' | 'ira';

@Injectable({ providedIn: 'root' })
export class AccountOpeningService {
  private readonly modalCtrl = inject(ModalController);

  async start(preselectedType?: AccountType): Promise<{ opened: boolean }> {
    const modal = await this.modalCtrl.create({
      component: AccountOpeningWizardComponent,
      componentProps: { preselectedType },
      canDismiss: async (_data, role) => role === 'confirm' || role === 'cancel',
    });
    await modal.present();

    const { role } = await modal.onDidDismiss();
    return { opened: role === 'confirm' };
  }
}
```

### 7.4 Launching from Any Tab

```typescript
// In PortfolioComponent
private readonly accountOpening = inject(AccountOpeningService);

protected async openBrokerageAccount(): Promise<void> {
  const result = await this.accountOpening.start('brokerage');
  if (result.opened) {
    // Refresh portfolio data
  }
}

// In DiscoverComponent
protected async startCryptoTrading(): Promise<void> {
  await this.accountOpening.start('crypto');
}

// In ProfileComponent
protected async openNewAccount(): Promise<void> {
  await this.accountOpening.start();
}
```

The modal overlays whatever tab is active. Dismissing it returns the user to their exact
position in their current tab with full state preservation.

### 7.5 When to Use `ion-nav` Inside a Modal

For very complex wizards (10+ steps, conditional branching, each step is a full standalone
component), a modal can contain `ion-nav` for native-style push/pop navigation inside the
modal:

```typescript
template: `
  <ion-nav [root]="wizardStep1" />
`
```

`ion-nav` manages its own internal stack completely isolated from the tab router. Use this
only when `@switch`-based step management becomes unwieldy. For our 4-step account opening
flow, signal-based steps are the right choice.

### 7.6 Alternative: Routed Wizard (When Already Built)

If the wizard is already implemented as routed pages, it can work correctly without converting
to a modal. The key question is **where the routes live**, which determines whether the tab
bar is visible during the wizard.

#### Routes Inside `tabs` Children — Tab Bar Visible

```typescript
// Wizard routes under a tab prefix — tab bar stays visible
{ path: 'portfolio/open-account', loadComponent: () => import('./wizard/step1.component').then(m => m.Step1Component) },
{ path: 'portfolio/open-account/personal-info', loadComponent: () => import('./wizard/step2.component').then(m => m.Step2Component) },
{ path: 'portfolio/open-account/funding', loadComponent: () => import('./wizard/step3.component').then(m => m.Step3Component) },
{ path: 'portfolio/open-account/review', loadComponent: () => import('./wizard/step4.component').then(m => m.Step4Component) },
```

**Behavior:**

- Tab bar remains visible at the bottom throughout the entire wizard.
- Swipe-back and hardware back pop wizard steps correctly (native feel).
- But every wizard step pollutes the tab's back history. After completing the wizard,
  pressing back walks backward through wizard steps before reaching the portfolio list.
- If the wizard must launch from multiple tabs, every step route must be duplicated per tab.

**Acceptable when:** The wizard is 2-3 steps, belongs to a single tab, and the tab bar
being visible is not a UX concern.

#### Routes Outside `tabs` — Tab Bar Hidden

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'tabs/portfolio', pathMatch: 'full' },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.component').then(m => m.TabsComponent),
    children: [/* tab routes */],
  },
  // Wizard at top level — renders in root ion-router-outlet, no tab bar
  {
    path: 'open-account',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./wizard/step1.component').then(m => m.Step1Component) },
      { path: 'personal-info', loadComponent: () => import('./wizard/step2.component').then(m => m.Step2Component) },
      { path: 'funding', loadComponent: () => import('./wizard/step3.component').then(m => m.Step3Component) },
      { path: 'review', loadComponent: () => import('./wizard/step4.component').then(m => m.Step4Component) },
    ],
  },
];
```

**Behavior:**

- Tab bar is completely hidden — the wizard takes over the full screen.
- Swipe-back between wizard steps works natively.
- Only one set of routes needed (no per-tab duplication).
- Navigate to `/open-account` from any tab. On completion, use
  `navigateRoot('/tabs/portfolio')` to return.
- **Downside vs modal:** No `canDismiss` guard, no swipe-down-to-dismiss. The user can swipe
  back through steps and exit without explicit Cancel. Add a `canDeactivate` route guard to
  warn about unsaved progress.

#### When to Convert from Routes to Modal

**Convert to a modal if:**

- The wizard launches from 3+ places across different tabs.
- You need `canDismiss` to block accidental abandonment (swipe, backdrop tap).
- The design requires the wizard to feel like an overlay, not a full navigation takeover.
- The user's position in the current tab must be preserved exactly during the wizard.

**Keep routed pages if:**

- The wizard belongs to one tab with 2-3 steps.
- URL-addressable steps add value (deep linking, session resumption).
- It is already built and working correctly — don't rewrite working code without a reason.

### 7.7 Do's and Don'ts

> **DO:** Use `canDismiss` on modal wizards to prevent accidental swipe/backdrop dismissal.
> **DO:** Manage wizard steps with signals and `@switch` for flows under 6 steps.
> **DO:** Use `ion-nav` inside the modal for wizards with 10+ steps or conditional branching.
>
> **DON'T:** Put wizard step routes inside `tabs` children if the wizard launches from multiple tabs.
> **DON'T:** Duplicate 4+ wizard step routes across every tab prefix — that signals the need for a modal.
> **DON'T:** Use `navigateBack` to exit a completed wizard — use `modalCtrl.dismiss()` or `navigateRoot`.

---

## 8. Route vs Modal -- Decision Framework

| Scenario | Pattern | Why |
|---|---|---|
| Drill-down within a tab (Portfolio -> AAPL detail) | **Route** (sibling child) | Preserves tab stack; back button works natively; URL is meaningful for deep linking. |
| Same view from multiple tabs (PDP from Portfolio, Discover, News) | **Route per tab** (shared component) | Each tab gets correct back navigation and tab highlighting. This is the Robinhood/Spotify pattern. |
| Global overlay from any context (Search) | **Modal** via service | No tab ownership; dismiss returns to exact origin; transient interaction not worth a URL. |
| Multi-step wizard from any context (Account Opening) | **Modal** with internal steps | Isolates wizard state from tab stacks; cancel/back semantics are self-contained; avoids duplicating N wizard routes per tab. |
| Settings sub-pages (Profile -> Settings -> Notifications) | **Route** (sibling under profile/) | Linear drill-down within a single tab. Standard shared-URL pattern. |
| Quick action (confirm trade, set alert) | **Inline modal** with `isOpen` signal | Short-lived interaction; no routing needed; signal controls open/close. |
| Sheet overlay (order type picker, filter drawer) | **Sheet modal** with breakpoints | `breakpoints` + `initialBreakpoint` create native bottom-sheet UX. Background remains interactive via `backdropBreakpoint`. |

**Default rule: Use a route when the destination is a full page that belongs to a tab and
benefits from URL addressability and back-button navigation. Use a modal when the view is
transient, context-independent, or must be launchable from multiple unrelated surfaces.**

---

## 9. Animations and Gestures

Ionic provides native-quality animations out of the box. No custom animation code is needed
for standard navigation patterns. Understanding what ships by default prevents
over-engineering and ensures the app feels native on both iOS and Android.

### 9.1 Page Transition Animations

Page transitions fire automatically when using `ion-router-outlet`. The animation style
depends on the navigation direction and the platform:

| Direction | iOS Animation | Material Animation | Triggered by |
|---|---|---|---|
| `forward` | New page slides in from right; previous page shifts left and dims | Fade through | `navigateForward`, `routerDirection="forward"` |
| `back` | Current page slides right and out; previous page slides in from left | Fade through (reverse) | `navCtrl.back()`, `ion-back-button`, swipe-back gesture |
| `root` | No directional animation (crossfade) | Fade | `navigateRoot`, `routerDirection="root"` |

No configuration needed. These are default behaviors of `ion-router-outlet`.

### 9.2 Modal Presentation Styles

Ionic modals support three presentation styles. Each has different animations, gestures, and
visual behavior — all provided by default.

#### Default Modal (Full-Screen Slide-Up)

The default `ion-modal` slides up from the bottom of the screen, covering the full viewport.
Dismissing slides it back down. This is the standard iOS full-screen modal pattern.

```typescript
const modal = await this.modalCtrl.create({
  component: SearchModalComponent,
});
await modal.present();  // Slides up from bottom
// modal.dismiss()      // Slides back down
```

The user **cannot** swipe to dismiss a default full-screen modal. They must tap an explicit
close/cancel button. This is correct for content-heavy modals like Search where accidental
dismissal would lose state.

#### Card Modal (iOS Card Stack)

Setting `presentingElement` converts the modal into an iOS-style card. The presenting page
scales down and the modal slides up as a card on top. **Swipe-down-to-dismiss is automatically
enabled.**

```typescript
const modal = await this.modalCtrl.create({
  component: AccountModalComponent,
  presentingElement: document.querySelector('ion-router-outlet') as HTMLElement,
  canDismiss: true, // default — swipe-down dismisses
});
```

**Behavior:**

- Previous page scales to ~93% and shifts back (iOS "card stack" effect).
- User can swipe down from the top of the modal to dismiss.
- `canDismiss: false` or a guard function disables swipe-to-dismiss.
- Multiple card modals can stack (each pushes the previous one further back).

#### Sheet Modal (Bottom Sheet with Breakpoints)

Sheet modals appear as draggable bottom sheets. Configure with `breakpoints` and
`initialBreakpoint`:

```typescript
const modal = await this.modalCtrl.create({
  component: OrderTypePicker,
  breakpoints: [0, 0.25, 0.5, 1],
  initialBreakpoint: 0.5,
  backdropBreakpoint: 0.5, // Backdrop dims only above 50%
});
```

**Behavior:**

- Modal snaps to breakpoint heights (25%, 50%, 100% of viewport).
- User drags the sheet between breakpoints.
- Including `0` in `breakpoints` enables swipe-to-dismiss (drag below lowest non-zero
  breakpoint).
- Background content remains interactive below `backdropBreakpoint`.

### 9.3 Modal Dismiss Gestures Summary

| Modal Style | Dismiss Gesture | How to Enable | How to Prevent |
|---|---|---|---|
| Default (full-screen) | None — no swipe | N/A | N/A |
| Card (`presentingElement`) | Swipe down from top | Set `presentingElement` | `canDismiss: false` or guard function |
| Sheet (`breakpoints`) | Drag below lowest breakpoint | Include `0` in `breakpoints` | Omit `0` from `breakpoints` |
| All styles | Backdrop tap | Default behavior | `backdropDismiss: false` |

### 9.4 Controlling `canDismiss`

Use `canDismiss` to guard against accidental dismissal for modals with unsaved state (wizards,
forms, trade confirmations):

```typescript
const modal = await this.modalCtrl.create({
  component: AccountOpeningWizardComponent,
  presentingElement: document.querySelector('ion-router-outlet') as HTMLElement,
  canDismiss: async (data, role) => {
    // Always allow programmatic dismiss (confirm/cancel button clicks)
    if (role === 'confirm' || role === 'cancel') return true;
    // Block swipe/backdrop dismiss (role === 'gesture' or 'backdrop')
    // Optionally show a confirmation action sheet here
    return false;
  },
});
```

The `role` parameter tells you HOW the dismiss was triggered:

- `'gesture'` — user swiped to dismiss (card modal) or dragged below threshold (sheet)
- `'backdrop'` — user tapped the backdrop
- Any custom string — your code called `modalCtrl.dismiss(data, 'confirm')`

### 9.5 Inline Modal with `isOpen` Signal

For simple modals controlled by a signal (confirm trade, set alert), use the `isOpen` +
`(didDismiss)` pattern:

```typescript
protected readonly showConfirmTrade = signal(false);

template: `
  <ion-modal
    [isOpen]="showConfirmTrade()"
    (didDismiss)="showConfirmTrade.set(false)"
    [initialBreakpoint]="0.5"
    [breakpoints]="[0, 0.5]"
  >
    <ng-template>
      <ion-content class="ion-padding">
        <!-- Confirm trade UI -->
      </ion-content>
    </ng-template>
  </ion-modal>
`
```

**Critical rule:** `isOpen` is one-way. You **must** listen to `(didDismiss)` and reset the
signal to `false`. Without this, the modal cannot be reopened after the user swipes or taps
the backdrop to dismiss.

### 9.6 Do's and Don'ts

> **DO:** Use card modals (`presentingElement`) for full-page overlays where swipe-to-dismiss is appropriate (settings, account views).
> **DO:** Use sheet modals (`breakpoints`) for contextual pickers, filters, and drawers.
> **DO:** Use `canDismiss` on any modal containing forms, wizards, or trade confirmations.
> **DO:** Always handle `(didDismiss)` when using `isOpen` on `ion-modal`.
>
> **DON'T:** Write custom CSS animations to replicate what Ionic provides by default.
> **DON'T:** Mix `ModalController` and `isOpen` binding for the same modal — pick one approach.
> **DON'T:** Forget that default full-screen modals have no swipe-to-dismiss — add a visible close button.

---

## 10. Page Lifecycle

Because `ion-router-outlet` keeps pages alive in the DOM, lifecycle timing differs from
standard Angular.

| Hook | When | Use for |
|---|---|---|
| `ngOnInit` | Once, first creation | Initial data fetch, subscription setup |
| `ionViewWillEnter` | Every time page becomes visible | Refresh portfolio positions, re-fetch prices |
| `ionViewDidEnter` | After transition animation ends | Heavy operations (avoids janky animations) |
| `ionViewWillLeave` | Page about to be hidden | Pause real-time price streams |
| `ionViewDidLeave` | Page fully hidden | Stop background polling |
| `ngOnDestroy` | Page popped off stack | Final cleanup |

Implement via Ionic interfaces:

```typescript
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { ViewWillEnter, ViewDidLeave } from '@ionic/angular/standalone';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
  template: `<ion-content><!-- holdings --></ion-content>`,
})
export class PortfolioComponent implements OnInit, ViewWillEnter, ViewDidLeave {
  ngOnInit(): void {
    // Load account info once.
  }

  ionViewWillEnter(): void {
    // Refresh positions & prices every time user returns to this tab.
  }

  ionViewDidLeave(): void {
    // Pause real-time WebSocket price feeds while tab is not visible.
  }
}
```

**Key rule:** Ionic lifecycle hooks fire only on components directly mapped to a route, not on
child components rendered inside them. If a child needs lifecycle awareness, the parent must
relay the event.

---

## 11. Navigation API Reference

### 11.1 Template Navigation

When using `routerLink` on Ionic components, import both `RouterLink` (Angular) and
`IonRouterLink` (Ionic). For `<a>` elements, use `IonRouterLinkWithHref` instead.

```typescript
imports: [IonItem, IonLabel, RouterLink, IonRouterLink],
template: `
  <ion-item [routerLink]="['/tabs/portfolio/asset', 'AAPL']" routerDirection="forward">
    <ion-label>Apple Inc.</ion-label>
  </ion-item>
`
```

`routerDirection` controls the page transition animation:
- `forward` -- slide from right (push)
- `back` -- slide from left (pop)
- `root` -- no directional animation (top-level switch)

### 11.2 Programmatic Navigation

```typescript
private readonly navCtrl = inject(NavController);

// Push onto stack (with forward animation)
this.navCtrl.navigateForward(['/tabs/portfolio/asset', 'AAPL']);

// Pop back (with back animation)
this.navCtrl.back();

// Replace root (no animation, for top-level resets)
this.navCtrl.navigateRoot(['/tabs/portfolio']);
```

Prefer `NavController` over `Router` when you need control over transition direction.
`Router.navigate()` works but defaults to forward animation regardless of navigation direction.

### 11.3 Back Button

```typescript
imports: [IonButtons, IonBackButton],
template: `
  <ion-buttons slot="start">
    <ion-back-button defaultHref="/tabs/portfolio" />
  </ion-buttons>
`
```

Always provide `defaultHref` -- it covers the case when the user deep-linked directly to an
inner page and there is no stack history to pop.

---

## 12. Common Mistakes

| # | Mistake | Fix |
|---|---|---|
| 1 | Cross-tab `routerLink` (e.g. button in Portfolio navigating to `/tabs/news`) | Use a modal or duplicate the route under the current tab prefix. |
| 2 | Using `<router-outlet>` instead of `<ion-router-outlet>` | `ion-router-outlet` manages page stacks, animations, and lifecycle. `router-outlet` does not. |
| 3 | `LocationStrategy.historyGo(-1)` in a tabbed app | Use `navCtrl.back()` or `ion-back-button`. |
| 4 | Nesting `ion-router-outlet` outside of `ion-tabs` | Only `ion-tabs` should create a nested outlet. Use sibling (shared URL) routes for sub-pages. |
| 5 | Missing `defaultHref` on `ion-back-button` | Always set it to the tab root (e.g. `/tabs/portfolio`). |
| 6 | Importing from `@ionic/angular` | Always import from `@ionic/angular/standalone` for tree-shaking. |
| 7 | Relative paths in tab navigation (`['asset', ticker]`) | Use absolute paths (`['/tabs/portfolio/asset', ticker]`). Relative paths break when deep in a stack. |
| 8 | Wizard steps as tab routes | Wizard flows are modals with internal signal-based step management. Never pollute tab routing with wizard steps. |
| 9 | Single `tabs/asset/:ticker` route shared across tabs | Duplicate the route per tab (`portfolio/asset/:ticker`, `discover/asset/:ticker`, etc.). A shared route breaks tab highlighting and back navigation. |
| 10 | Using `isOpen` on `ion-modal` without `(didDismiss)` handler | `isOpen` is one-way. You must listen to `didDismiss` and set the signal to `false`, or the modal cannot reopen. |
| 11 | Missing `canDismiss` on modals with forms or wizards | Set `canDismiss` to a guard function to prevent accidental swipe/backdrop dismissal during data entry or multi-step flows. |
| 12 | Custom CSS animations replacing Ionic defaults | Ionic provides native-quality page and modal animations by default. Only customize via `enterAnimation`/`leaveAnimation` when the design explicitly requires non-standard transitions. |
| 13 | Routed wizard steps duplicated across every tab prefix | If a wizard needs 3+ step routes per tab, convert to a modal with signal-based steps. Route duplication is for single-page views (PDP), not multi-step flows. |

---

## References

- Ionic Angular Navigation: https://ionicframework.com/docs/angular/navigation
- Ionic Modal API: https://ionicframework.com/docs/api/modal
- Ionic Page Lifecycle: https://ionicframework.com/docs/angular/lifecycle
- Ionic Standalone Build Options: https://ionicframework.com/docs/angular/build-options
- Angular Router: https://angular.dev/guide/routing
