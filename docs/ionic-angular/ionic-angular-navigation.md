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
6. [Global Search -- Routed Page Pattern](#6-global-search----routed-page-pattern)
7. [Multi-Step Wizard -- Account Opening Flow](#7-multi-step-wizard----account-opening-flow)
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
        path: 'portfolio/search',
        loadComponent: () =>
          import('./shared/search.component').then(m => m.SearchComponent),
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
        path: 'discover/search',
        loadComponent: () =>
          import('./shared/search.component').then(m => m.SearchComponent),
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
        path: 'news/search',
        loadComponent: () =>
          import('./shared/search.component').then(m => m.SearchComponent),
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

## 6. Global Search -- Routed Page Pattern

Search is a **navigation step** between a tab root and the Asset Detail Page (PDP). The user
flows through: `tab root → search → PDP`. Pressing back from PDP returns to the search
results, and pressing back from search returns to the tab root. This follows the standard iOS
navigation stack pattern where each screen is a forward push.

### 6.1 Why a Route, Not a Modal

Product decision: the user must be able to press back from PDP to return to search results
and quickly select a different asset. This requires search to persist on the navigation stack.

| Consideration | Route approach (correct) | Modal approach (wrong for this case) |
|---|---|---|
| Back from PDP | Returns to search page with results preserved. User taps another result. | Returns to the page that launched search. User must reopen search and re-query. |
| Navigation stack | `portfolio → search → AAPL detail` — standard iOS push stack. Swipe-back works at every level. | Search is not on the stack. No way to "go back" to it from PDP. |
| Reuse across tabs | Same `SearchComponent`, one route per tab prefix. Same pattern as PDP (Section 5). | Works, but violates the product requirement for back navigation to search. |
| Will search be a tab? | No — it is a child page within each tab, not a tab itself. | N/A |

### 6.2 Route Configuration

Search routes follow the same per-tab duplication pattern as PDP. Each tab that can launch
search gets a `<tab>/search` sibling route pointing to the shared `SearchComponent`:

```
tabs/portfolio/search          --> SearchComponent
tabs/discover/search           --> SearchComponent
tabs/news/search               --> SearchComponent
```

These are already included in the route config in Section 4.1. The navigation stacks:

```
portfolio  → portfolio/search  → portfolio/asset/AAPL
discover   → discover/search   → discover/asset/BTC
news       → news/search       → news/asset/TSLA
```

Back pops each level: `AAPL detail → search → portfolio`. Tab bar stays on the correct tab
throughout. Swipe-back gesture works at every transition.

### 6.3 SearchComponent

```typescript
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NavController, IonHeader, IonToolbar, IonButtons, IonBackButton,
  IonSearchbar, IonContent, IonList, IonItem, IonLabel,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonButtons, IonBackButton,
    IonSearchbar, IonContent, IonList, IonItem, IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="tabRoot" />
        </ion-buttons>
        <ion-searchbar
          placeholder="Search stocks, crypto, ETFs..."
          (ionInput)="onSearch($event)"
          [debounce]="300"
        />
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        @for (result of results(); track result.ticker) {
          <ion-item button (click)="navigateToAsset(result.ticker)">
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
export class SearchComponent {
  private readonly navCtrl = inject(NavController);
  private readonly route = inject(ActivatedRoute);

  /** Resolved from the current URL: '/tabs/portfolio', '/tabs/discover', etc. */
  protected readonly tabRoot: string;

  protected readonly results = signal<{ ticker: string; name: string }[]>([]);

  constructor() {
    // Derive the tab prefix from the current route: /tabs/<tab>/search → /tabs/<tab>
    const url = this.route.snapshot.pathFromRoot
      .map(s => s.url.map(u => u.path).join('/'))
      .filter(Boolean)
      .join('/');
    const segments = url.split('/');
    // segments: ['tabs', '<tab>', 'search'] → take first two
    this.tabRoot = '/' + segments.slice(0, 2).join('/');
  }

  protected onSearch(event: CustomEvent): void {
    const query = (event.detail.value ?? '').trim();
    // Call search API, update results signal
  }

  protected navigateToAsset(ticker: string): void {
    // Push PDP onto the stack ABOVE search (within the same tab)
    this.navCtrl.navigateForward([this.tabRoot, 'asset', ticker]);
  }
}
```

**Key details:**

- `ion-back-button` with `defaultHref` pointing to the tab root — back returns to Portfolio,
  Discover, or News depending on which tab launched search.
- `tabRoot` is derived from the current URL so the component is tab-agnostic.
- Tapping a result navigates **forward** to the PDP within the same tab. Search stays on
  the stack behind PDP.
- Because `ion-router-outlet` preserves pages, when the user presses back from PDP, the
  search page is revealed with its results and scroll position intact.

### 6.4 Navigating to Search from Tab Pages

```typescript
// In PortfolioComponent
this.navCtrl.navigateForward(['/tabs/portfolio/search']);

// In DiscoverComponent
this.navCtrl.navigateForward(['/tabs/discover/search']);

// In NewsComponent
this.navCtrl.navigateForward(['/tabs/news/search']);
```

### 6.5 Navigating to Search from PDP

Search can also be launched from within a PDP page. This pushes search onto the stack above
PDP, creating a deeper stack:

```
portfolio → AAPL detail → search → TSLA detail
```

Back from TSLA detail returns to search. Back from search returns to AAPL detail. This is
standard iOS push behavior and works correctly with `ion-router-outlet`.

```typescript
// In AssetDetailComponent — navigate to search within the current tab
this.navCtrl.navigateForward([this.tabRoot, 'search']);
```

### 6.6 Do's and Don'ts

> **DO:** Use the same per-tab route duplication pattern as PDP — one `<tab>/search` route per tab.
> **DO:** Navigate forward to PDP from search (keeps search on the stack for back navigation).
> **DO:** Derive the tab prefix dynamically so `SearchComponent` is tab-agnostic.
> **DO:** Set `defaultHref` on `ion-back-button` to the tab root.
>
> **DON'T:** Create a single shared `tabs/search` route — it breaks tab highlighting (same reason as PDP).
> **DON'T:** Use `navigateRoot` from search to PDP — it replaces the stack and destroys the search page.
> **DON'T:** Implement search as a modal if product requires back-to-search from PDP.

---

## 7. Multi-Step Wizard -- Account Opening Flow

After login, the user may need to open investing accounts (Brokerage, Crypto, IRA). This
wizard is a multi-step flow launchable from Portfolio ("Open a Brokerage Account" CTA),
Discover ("Start Trading Crypto" CTA), or Profile ("Open New Account" button).

Two navigation patterns can implement this flow: **routed pages** and **modal with internal
steps**. Neither is universally better. The correct choice depends on product requirements --
specifically around resume/re-entry, cancel semantics, tab bar visibility, and flow
complexity. Section 7.1 provides a product Q&A exercise to determine which pattern fits.

### 7.1 Choosing the Pattern -- Product Requirements Drive the Decision

Run these questions with PM/UX. Their answers become the business-backed rationale for the
navigation pattern.

**Resume, recovery, and re-entry (usually the decider):**

| # | Question | YES implies | NO implies |
|---|---|---|---|
| 1 | If user leaves mid-flow (background, crash, app update), should they resume where they left off? | Routed | Modal acceptable |
| 2 | Should we support a "Continue account opening" entry point from Portfolio/Profile later? | Routed | Either |
| 3 | If user abandons at step 6, should a push/email deep link return them to step 6? | Routed | Either |
| 4 | Should support/analytics identify "stuck at step X" with a stable identifier? | Routed | Either |

**Cancel semantics and immersion:**

| # | Question | YES implies | NO implies |
|---|---|---|---|
| 5 | Is "X Cancel" a "terminate process / exit application" action (not "dismiss overlay")? | Routed | Modal |
| 6 | On X, do we need a "Discard progress?" confirmation dialog? | Routed (safer for serious flows) | Either |
| 7 | Should the tab bar be hidden during the flow (focus mode, like checkout)? | Routed outside tabs | Either |

**Complexity, branching, and compliance:**

| # | Question | YES implies | NO implies |
|---|---|---|---|
| 8 | Will steps vary by account type and change over time? | Routed | Either |
| 9 | Do we expect conditional skips/reordering based on eligibility or KYC? | Routed | Either |
| 10 | Do we need an audit trail proving the user visited specific disclosure screens? | Routed | Either |
| 11 | Should QA open step 3 directly for testing without walking through steps 1-2? | Routed | Either |

**Decision rule:** If PM answers YES to 2+ questions in the resume/re-entry group (1-4),
the product outcome strongly favors a routed wizard. If PM answers NO to all of them and the
flow is short (3-4 steps) with low stakes, a modal wizard is a clean fit.

### 7.2 Option A -- Routed Wizard (Outside Tabs)

This is the pattern for high-stakes, multi-step journeys where the product requires
addressable steps, resume capability, and a focused full-screen experience.

#### 7.2.1 Why Routed

- **One navigation system.** Hardware back, swipe-back, and `ion-back-button` work natively
  between steps with no custom logic.
- **Addressable steps.** Each step has a URL. Deep linking, session resume, and
  "continue application" entry points work naturally.
- **Scales with complexity.** Branching by account type, conditional step skips, and
  server-driven step sequences are straightforward when each step is a route.
- **Observability.** Step-level analytics, audit trails, and support debugging use stable
  route-based identifiers (`account_opening_brokerage_funding`).

#### 7.2.2 Route Configuration

Routes live **outside** `tabs` so the tab bar is hidden and the wizard takes over the full
screen. A shell component owns the header (Back + X Cancel) and progress indicator. Step
components are rendered by parent route's `ion-router-outlet`.

```typescript
// In app.routes.ts — wizard routes at the top level, alongside tabs
export const routes: Routes = [
  { path: '', redirectTo: 'tabs/portfolio', pathMatch: 'full' },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.component').then(m => m.TabsComponent),
    children: [/* tab routes from Section 4.1 */],
  },
  // Account Opening Wizard — outside tabs, tab bar hidden
  {
    path: 'account-opening/:accountType',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./account-opening/wizard-shell.component').then(m => m.WizardShellComponent),
    providers: [AccountOpeningStore], // SignalStore scoped to wizard lifecycle
    children: [
      {
        path: 'account-type',
        loadComponent: () =>
          import('./account-opening/steps/account-type.component').then(m => m.AccountTypeStepComponent),
      },
      {
        path: 'personal-info',
        loadComponent: () =>
          import('./account-opening/steps/personal-info.component').then(m => m.PersonalInfoStepComponent),
      },
      {
        path: 'disclosures',
        loadComponent: () =>
          import('./account-opening/steps/disclosures.component').then(m => m.DisclosuresStepComponent),
      },
      {
        path: 'funding',
        loadComponent: () =>
          import('./account-opening/steps/funding.component').then(m => m.FundingStepComponent),
      },
      {
        path: 'review',
        loadComponent: () =>
          import('./account-opening/steps/review.component').then(m => m.ReviewStepComponent),
      },
      // Invalid or missing step — redirect to first step
      { path: '', redirectTo: 'account-type', pathMatch: 'full' },
      { path: '**', redirectTo: 'account-type' },
    ],
  },
];
```

**URL shape:** `/account-opening/brokerage/personal-info`. The URL encodes account type and
current step. This supports deep linking, resume, and analytics instrumentation.

#### 7.2.3 Wizard Shell Component

The shell owns the header with Back + X Cancel, a progress indicator, and a nested
`ion-router-outlet` for step content. Step components are "dumb" -- they render forms,
validate, and emit next/back intents.

```typescript
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NavController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonBackButton, IonProgressBar, IonRouterOutlet,
} from '@ionic/angular/standalone';
import { AccountOpeningStore } from './account-opening.store';
import { AccountOpeningFlowContextService } from './account-opening-flow-context.service';

@Component({
  selector: 'app-wizard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonBackButton, IonProgressBar, IonRouterOutlet,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="firstStepUrl()" />
        </ion-buttons>
        <ion-title>{{ store.currentStepTitle() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar [value]="store.progress()" />
    </ion-header>
    <ion-router-outlet />
  `,
})
export class WizardShellComponent {
  protected readonly store = inject(AccountOpeningStore);
  private readonly navCtrl = inject(NavController);
  private readonly route = inject(ActivatedRoute);
  // originUrl is navigation context, not domain state — lives in a root-scoped
  // service so it survives across the calling tab and the wizard route scope.
  private readonly flowCtx = inject(AccountOpeningFlowContextService);

  /** URL of the first step — used as defaultHref when there is no stack history. */
  protected readonly firstStepUrl = computed(() => {
    const accountType = this.route.snapshot.paramMap.get('accountType') ?? 'brokerage';
    return `/account-opening/${accountType}/account-type`;
  });

  /** Cancel the flow — back animation, user is retreating / abandoning. */
  protected cancel(): void {
    const origin = this.flowCtx.originUrl() ?? '/tabs/portfolio';
    this.flowCtx.clear();
    this.navCtrl.navigateBack(origin);
  }

  /** Complete the flow — root animation, forward progress to a fresh destination. */
  protected complete(): void {
    const origin = this.flowCtx.originUrl() ?? '/tabs/portfolio';
    this.flowCtx.clear();
    this.navCtrl.navigateRoot(origin);
  }
}
```

**Key details:**

- `ion-back-button` handles step-to-step back navigation. If user arrived via deep link
  (no stack history), `defaultHref` sends them to the first step.
- Cancel always exits the entire wizard with a back-slide animation via `navigateBack`.
- Completion is called by the last step component via `inject(WizardShellComponent).complete()`
  or by emitting an event the shell handles — never navigated from inside the step directly.
- The shell's `ion-router-outlet` renders step components. Each step transition is a
  standard Ionic forward/back page animation with swipe-back support.
- **`originUrl` lives in `AccountOpeningFlowContextService`, not in `AccountOpeningStore`.**
  The store is route-scoped (destroyed on exit); the service is root-scoped (survives across
  lifecycle boundaries). The calling tab sets the origin before navigating forward — at that
  point the store does not yet exist.

#### 7.2.4 Origin Tracking and Return

On wizard entry, capture the launching URL so Cancel and completion return the user to the
correct location (Portfolio, PDP, Profile, etc.).

```typescript
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AccountOpeningFlowContextService {
  private readonly _originUrl = signal<string | null>(null);
  readonly originUrl = this._originUrl.asReadonly();

  /** Call once when launching the wizard. */
  setOrigin(url: string): void {
    this._originUrl.set(url);
  }

  clear(): void {
    this._originUrl.set(null);
  }
}
```

Launching from any tab:

```typescript
// In PortfolioComponent
private readonly flowContext = inject(AccountOpeningFlowContextService);
private readonly navCtrl = inject(NavController);

protected openBrokerageAccount(): void {
  this.flowContext.setOrigin('/tabs/portfolio');
  this.navCtrl.navigateForward('/account-opening/brokerage/account-type');
}

// In DiscoverComponent
protected startCryptoTrading(): void {
  this.flowContext.setOrigin('/tabs/discover');
  this.navCtrl.navigateForward('/account-opening/crypto/account-type');
}

// In ProfileComponent
protected openNewAccount(): void {
  this.flowContext.setOrigin('/tabs/profile');
  this.navCtrl.navigateForward('/account-opening/brokerage/account-type');
}
```

**`clear()` must be called before every exit** (cancel and completion). The shell's `cancel()`
and `complete()` methods both call `flowCtx.clear()` immediately before navigating away.
If `clear()` is omitted, a stale origin from a previous session can send the user to the
wrong tab on their next wizard run.

**Deep link null case:** When a user opens `/account-opening/brokerage/personal-info` directly
(push notification, email link), no tab component has called `setOrigin()`. `originUrl()`
returns `null`. The `?? '/tabs/portfolio'` fallback in the shell is the intentional default
— document this fallback in a product decision if a different tab should be preferred for
the app's primary account type.

For resilience against app kill/crash, persist `originUrl` to `sessionStorage` in
`AccountOpeningFlowContextService`. On `setOrigin`, write to storage. On service init
(`constructor` or `withHooks`), read from storage if the in-memory signal is null. On
`clear()`, remove from storage. This keeps origin tracking co-located in the one service
that owns it.

#### 7.2.5 Step Navigation

Step components call the store or `NavController` to move forward/backward:

```typescript
// In any step component (e.g. PersonalInfoStepComponent)
private readonly store = inject(AccountOpeningStore);
private readonly navCtrl = inject(NavController);

protected next(): void {
  const nextStep = this.store.getNextStep(); // e.g. 'disclosures'
  const accountType = this.store.accountType();
  this.navCtrl.navigateForward(`/account-opening/${accountType}/${nextStep}`);
}
```

Back navigation is handled automatically by `ion-back-button` in the shell or swipe-back
gesture. No explicit back logic needed in step components.

#### 7.2.6 Cancel and Completion Animations

| Action | API | Animation | Why |
|---|---|---|---|
| Cancel from any step | `navigateBack(originUrl)` | Slide out (back) | User retreating -- abandon semantics |
| Submit / completion | `navigateRoot(originUrl)` | Crossfade | Clean reset -- flow complete, no back into wizard |
| Step forward | `navigateForward(nextStepUrl)` | Slide in from right | Standard forward push |
| Step back | `ion-back-button` / swipe-back | Slide out to right | Standard back pop |

On cancel: `navigateBack` produces a back-slide animation. This is correct because the user
is retreating. Do not use `navigateRoot` for cancel -- the crossfade animation signals
completion, not abandonment. Do not use `navCtrl.back()` -- it only pops one step.

On completion: `navigateRoot` produces a crossfade and clears the wizard from the stack.
The user cannot swipe back into the wizard after successful submission.

#### 7.2.7 Edge Cases

- **Deep link to step 3 (no prior history).** `ion-back-button` uses `defaultHref` to
  navigate to step 1. The store should validate that prior steps are complete and redirect
  to the earliest incomplete step if needed.
- **Invalid step in URL.** The wildcard redirect (`path: '**'`) in the route config sends
  the user to the first step.
- **Browser refresh / app kill.** If the store persists progress to `sessionStorage`, the
  wizard can rehydrate. Without persistence, the user starts over (acceptable for many
  products).
- **Branching changes step list mid-flow.** If eligibility results remove a future step,
  the store's step sequence updates. If the user is already on a now-invalid step, redirect
  to the nearest valid step.

#### 7.2.8 Config-Driven Step Sequences

Support multiple account types with different step lists:

```typescript
const STEP_SEQUENCES: Record<string, string[]> = {
  brokerage: ['account-type', 'personal-info', 'disclosures', 'funding', 'review'],
  crypto:    ['account-type', 'personal-info', 'crypto-agreement', 'funding', 'review'],
  ira:       ['account-type', 'personal-info', 'beneficiary', 'disclosures', 'funding', 'review'],
};

// In AccountOpeningStore
getNextStep(): string | null { /* ... */ }
getPrevStep(): string | null { /* ... */ }
getStepIndex(step: string): number { /* ... */ }
```

This structure supports server-driven step maps. Replace the static record with an API
response and the routing layer remains unchanged.

### 7.3 Option B -- Modal Wizard

This is the pattern for short, self-contained flows where the product does not require
resume, deep linking, or step-level addressability.

#### 7.3.1 Why Modal

- **Isolation.** The modal overlays the current tab without touching its navigation stack.
  Dismissing restores the exact tab state.
- **Cross-tab launching.** Any tab can present the same modal. No route duplication needed.
- **Dismiss guard.** `canDismiss` blocks accidental swipe/backdrop dismissal -- useful for
  flows with unsaved form state.
- **Cancel animation.** `modalCtrl.dismiss()` slides the modal back down (reverse of
  present). No navigation direction decision needed.

#### 7.3.2 AccountOpeningWizardComponent (Modal)

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
          }
        </ion-buttons>
        <ion-title>{{ stepTitles[currentStepIndex()] }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
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
        @case (0) { <!-- Account type selection --> }
        @case (1) { <!-- Personal information --> }
        @case (2) { <!-- Funding source --> }
        @case (3) { <!-- Review & submit --> }
      }
    </ion-content>
  `,
})
export class AccountOpeningWizardComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly preselectedType = input<AccountType>();

  protected readonly stepTitles = ['Account Type', 'Personal Info', 'Funding', 'Review'];
  protected readonly currentStepIndex = signal(0);
  protected readonly canAdvance = signal(true);

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
    // dismiss() slides the modal back down to reveal the originating tab.
    // No NavController needed -- the tab was overlaid, never left.
    this.modalCtrl.dismiss(null, 'cancel');
  }

  protected submit(): void {
    this.modalCtrl.dismiss({ accountType: 'brokerage' }, 'confirm');
  }
}
```

#### 7.3.3 AccountOpeningService

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

Launching from any tab:

```typescript
// In PortfolioComponent
protected async openBrokerageAccount(): Promise<void> {
  const result = await inject(AccountOpeningService).start('brokerage');
  if (result.opened) { /* refresh portfolio data */ }
}
```

The modal overlays whatever tab is active. Dismissing returns the user to their exact
position in the current tab.

#### 7.3.4 When to Use `ion-nav` Inside a Modal

For complex wizards (10+ steps, conditional branching, each step is a full standalone
component), a modal can contain `ion-nav` for native-style push/pop navigation inside the
modal. `ion-nav` manages its own internal stack completely isolated from the tab router. Use
this only when `@switch`-based step management becomes unwieldy.

```typescript
template: `<ion-nav [root]="wizardStep1" />`
```

### 7.4 Pattern Comparison

| Concern | Routed wizard (7.2) | Modal wizard (7.3) |
|---|---|---|
| Resume / re-entry | Natural -- URL encodes step; restore from storage | Must rebuild custom restore logic |
| Deep linking to a step | Built-in via route params | Not available |
| Step analytics / audit | Stable route-based identifiers | Must instrument manually per step |
| QA direct-to-step | Navigate to URL | Requires test harness |
| Hardware back / swipe-back | Native per step (no custom code) | Must implement manually or use `ion-nav` |
| Tab bar during flow | Hidden (routes outside tabs) | Hidden (modal overlay) |
| Cross-tab launching | Any tab navigates to `/account-opening/...` | Any tab presents the modal |
| Cancel animation | `navigateBack(originUrl)` -- back slide | `modalCtrl.dismiss()` -- slide down |
| Completion animation | `navigateRoot(originUrl)` -- crossfade | `modalCtrl.dismiss()` -- slide down |
| Dismiss guard | `canDeactivate` route guard | `canDismiss` on modal |
| Branching / variant steps | Config-driven step sequences per account type | Signal-based `@switch` or `ion-nav` |
| State lifecycle | SignalStore scoped to route `providers` | Exists while modal is open |

### 7.5 Do's and Don'ts

> **DO:** Let product requirements (resume, deep link, audit trail, branching) drive the
> pattern choice. Use Section 7.1 to gather answers.
> **DO:** Place routed wizard routes **outside** `tabs` to hide the tab bar during the flow.
> **DO:** Use `navigateBack(originUrl)` for cancel and `navigateRoot(originUrl)` for
> completion in routed wizards.
> **DO:** Use `canDismiss` on modal wizards to prevent accidental swipe/backdrop dismissal.
> **DO:** Manage modal wizard steps with signals and `@switch` for flows under 6 steps.
>
> **DON'T:** Put wizard step routes inside `tabs` children -- it pollutes the tab's back
> history and requires per-tab route duplication for every step.
> **DON'T:** Use `navigateRoot` for cancel -- the crossfade animation signals completion,
> not abandonment.
> **DON'T:** Use `navCtrl.back()` for cancel -- it only pops one step, not the entire wizard.
> **DON'T:** Use a modal when product requires resume, deep linking, or step-level audit.
> **DON'T:** Use routed pages when the flow is 3-4 steps, low stakes, and no resume is needed
> -- a modal is simpler.

---

## 8. Route vs Modal -- Decision Framework

| Scenario | Pattern | Why |
|---|---|---|
| Drill-down within a tab (Portfolio -> AAPL detail) | **Route** (sibling child) | Preserves tab stack; back button works natively; URL is meaningful for deep linking. |
| Same view from multiple tabs (PDP from Portfolio, Discover, News) | **Route per tab** (shared component) | Each tab gets correct back navigation and tab highlighting. This is the Robinhood/Spotify pattern. |
| Search as a navigation step (tab root → Search → PDP) | **Route per tab** (shared component) | User needs back-to-search from PDP to pick different results. Same reuse pattern as PDP. |
| Multi-step wizard (Account Opening) | **Routed** (outside tabs) or **Modal** | Product decision: routed if resume, deep link, or audit trail needed (see Section 7.1 Q&A); modal if short, low-stakes, no re-entry. |
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
| 8 | Wizard steps as tab routes (inside `tabs` children) | Place wizard routes **outside** `tabs` (tab bar hidden) or use a modal. Never pollute a tab's back history with wizard steps. |
| 9 | Single shared route for a cross-tab view (`tabs/asset/:ticker` or `tabs/search`) | Duplicate the route per tab (`portfolio/asset/:ticker`, `portfolio/search`, etc.). A shared route breaks tab highlighting and back navigation. |
| 10 | Using `isOpen` on `ion-modal` without `(didDismiss)` handler | `isOpen` is one-way. You must listen to `didDismiss` and set the signal to `false`, or the modal cannot reopen. |
| 11 | Missing `canDismiss` on modals with forms or wizards | Set `canDismiss` to a guard function to prevent accidental swipe/backdrop dismissal during data entry or multi-step flows. |
| 12 | Custom CSS animations replacing Ionic defaults | Ionic provides native-quality page and modal animations by default. Only customize via `enterAnimation`/`leaveAnimation` when the design explicitly requires non-standard transitions. |
| 13 | Routed wizard steps duplicated across every tab prefix | Place wizard routes outside `tabs` (one set of routes, tab bar hidden). Per-tab route duplication is for single-page views (PDP, Search), not multi-step flows. |

---

## References

- Ionic Angular Navigation: https://ionicframework.com/docs/angular/navigation
- Ionic Modal API: https://ionicframework.com/docs/api/modal
- Ionic Page Lifecycle: https://ionicframework.com/docs/angular/lifecycle
- Ionic Standalone Build Options: https://ionicframework.com/docs/angular/build-options
- Angular Router: https://angular.dev/guide/routing
