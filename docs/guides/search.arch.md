# Search Feature — Architecture & Implementation Guide

<!-- AGENT: This is Stage 1 — the data-access layer reference.
     For Stage 2 (UI primitives and feature composition), see docs/guides/search-modular.arch.md -->

> **Purpose:** Authoritative architecture and implementation reference for the search
> feature. AI coding agents and developers must follow these patterns exactly.
>
> **Stage 1 of 2** — This document defines the data-access layer: mental model, data
> models, store, repository, data flow, search behavior, performance, and edge cases.
> **Stage 2** is in `docs/guides/search-modular.arch.md` — UI layer: composable
> primitives, feature wrappers, and consumer composition patterns.
>
> **Cross-references:**
> - Stage 2 (UI modularity): `docs/guides/search-modular.arch.md`
> - Navigation patterns: `docs/ionic-angular/ionic-angular-navigation.md` Section 6
> - NgRx Signals conventions: `docs/copilot-samples/instructions/ngrx-signals.instructions.md`
> - App context: `external-context/invest.app.md`

---

## Table of Contents

1. [Mental Model](#1-mental-model)
2. [Feature Structure](#2-feature-structure)
3. [Data Models](#3-data-models)
4. [Data Flow & API Integration](#4-data-flow--api-integration)
5. [State Management (SignalStore)](#5-state-management-signalstore)
6. [Component Architecture](#6-component-architecture)
7. [Search Input Behavior](#7-search-input-behavior)
8. [Search → PDP Navigation Contract](#8-search--pdp-navigation-contract)
9. [Performance & UX Optimizations](#9-performance--ux-optimizations)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Accessibility](#11-accessibility)
12. [Implementation Sequence](#12-implementation-sequence)

---

## 1. Mental Model

### 1.1 What Search Is

Search is the **primary instrument discovery mechanism** in the app. It connects users to
the Asset Detail Page (PDP) — the product detail page for stocks, crypto, and ETFs. Think
of it as a fast, focused picker that bridges the user's intent ("I want to find AAPL") to
the instrument's detail view.

The UX is modeled after Robinhood's search: a single input field, instant results as the
user types, and a clean result list showing ticker symbol, company name, and logo. Tap a
result → go to PDP. That's it. Simplicity is the product.

### 1.2 Two Presentation Modes

Search operates in two modes with identical search logic but different navigation shells:

| Mode | Shell | Trigger | Back-from-PDP behavior |
|---|---|---|---|
| **Page** | Routed child of each tab. Chevron back button (start slot). | Search icon in tab header, "Find instrument" link. | Returns to search results (preserved on stack). |
| **Modal** | Full-screen overlay via `ModalController`. X close button (end slot). | Quick CTAs, in-context lookups, secondary entry points. | Returns to originating page (modal is gone). |

Both modes share the same `SearchResultListComponent`, `SearchStore`, and
`SearchRepository`. Only the outer shell differs. See Section 6.

### 1.3 Speed Is the Feature

In a brokerage app, search latency directly impacts user trust and perceived app quality.
The architecture must guarantee:

- **< 100ms** from keystroke to visual feedback (loading indicator appears)
- **< 300ms** perceived result display for cache hits
- **Cancel-on-new-keystroke** — no stale results appearing after the user has moved on
- **Never blank** — show recent searches or trending instruments while waiting

---

## 2. Feature Structure

Following the domain 4-layer architecture from the workspace conventions:

```
libs/invest-app/search/
├── data-access/
│   ├── search.store.ts              # NgRx SignalStore — owns all search domain state
│   ├── search-storage.provider.ts   # Root-scoped persistence for recents (internal)
│   ├── search.repository.ts         # API client wrapper — all HTTP lives here
│   └── search.models.ts             # Domain-specific TypeScript types
│
├── feature/
│   ├── search-page.component.ts            # Routed page wrapper (ion-back-button + navigation)
│   ├── search-modal.component.ts           # Modal wrapper (X close + dismiss with data)
│   ├── search-modal.service.ts             # Root-scoped service to present modal, returns selection
│   └── routes.ts                           # Route fragment (consumed by tab route configs)
│
├── ui/
│   ├── search-result-list.component.ts     # Shared search input + result list (presentational)
│   ├── search-result-item.component.ts     # Single result row: logo, ticker, name, type badge
│   └── search-empty-state.component.ts     # Empty/initial state: recent searches, trending
│
└── util/
    └── search.helpers.ts                   # Pure functions: query normalization, highlight matching
```

### 2.1 Layer Responsibilities

| Layer | Owns | Forbidden |
|---|---|---|
| `data-access` | Store (state + methods), repository (HTTP), models | Ionic UI imports, routing, NavController |
| `feature` | Route wiring, store→UI connection, navigation decisions | Business logic, direct API calls, HTTP |
| `ui` | Presentational rendering, user interaction events | Store injection, NavController, business logic |
| `util` | Pure functions (no Angular deps) | Services, signals, side effects |

---

## 3. Data Models

### 3.1 API Response Shape

The `productSearch` endpoint returns matched instruments. Define the API DTO separately
from the domain model to insulate the store from transport changes:

```typescript
// data-access/search.models.ts

/** Raw shape from the productSearch API endpoint. */
export interface SearchResultDto {
  readonly symbol: string;
  readonly name: string;
  readonly type: 'STOCK' | 'CRYPTO' | 'ETF' | 'MUTUAL_FUND';
  readonly logoUrl: string | null;
  readonly exchange: string;
}

/** Domain model used by store and UI. Repository maps DTO → this. */
export interface SearchResult {
  readonly ticker: string;       // normalized symbol (e.g. "AAPL")
  readonly name: string;         // display name (e.g. "Apple Inc.")
  readonly instrumentType: 'stock' | 'crypto' | 'etf' | 'mutual-fund';
  readonly logoUrl: string | null;
  readonly exchange: string;
}

/** Lightweight reference for recent searches (persisted to local storage). */
export interface RecentSearch {
  readonly ticker: string;
  readonly name: string;
  readonly instrumentType: SearchResult['instrumentType'];
  readonly logoUrl: string | null;
  readonly searchedAt: number;   // epoch ms — for ordering and TTL eviction
}
```

### 3.2 Why Separate DTO and Domain Model

- Backend may rename fields, change casing, or add/remove properties. The repository absorbs
  these changes; the store and UI are unaffected.
- Domain model uses frontend-idiomatic naming (`ticker` not `symbol`, lowercase union types).
- The mapping is one line per field — trivial but valuable as a buffer.

---

## 4. Data Flow & API Integration

### 4.1 Unidirectional Data Flow

```
SearchResultListComponent (UI — emits query string)
        ↓ output event
SearchPageComponent / SearchModalComponent (feature — calls store method)
        ↓ store.search(query)
SearchStore (data-access — orchestrates via rxMethod)
        ↓ calls repository
SearchRepository (data-access — wraps HTTP client)
        ↓ HTTP GET
productSearch API endpoint
```

**UI never calls the repository.** Feature never calls the API. Store orchestrates everything.

### 4.2 Repository

```typescript
// data-access/search.repository.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { SearchResult, SearchResultDto } from './search.models';

@Injectable({ providedIn: 'root' })
export class SearchRepository {
  private readonly http = inject(HttpClient);

  search$(query: string): Observable<readonly SearchResult[]> {
    return this.http
      .get<readonly SearchResultDto[]>('/api/instruments/search', {
        params: { q: query },
      })
      .pipe(map(dtos => dtos.map(mapDtoToResult)));
  }
}

function mapDtoToResult(dto: SearchResultDto): SearchResult {
  return {
    ticker: dto.symbol,
    name: dto.name,
    instrumentType: mapInstrumentType(dto.type),
    logoUrl: dto.logoUrl,
    exchange: dto.exchange,
  };
}

function mapInstrumentType(
  apiType: SearchResultDto['type'],
): SearchResult['instrumentType'] {
  const typeMap: Record<SearchResultDto['type'], SearchResult['instrumentType']> = {
    STOCK: 'stock',
    CRYPTO: 'crypto',
    ETF: 'etf',
    MUTUAL_FUND: 'mutual-fund',
  };
  return typeMap[apiType];
}
```

**Rules:**
- Repository returns `Observable<readonly SearchResult[]>` — the store subscribes
  via `rxMethod`, never the UI.
- Mapping lives in the repository file, not the store.
- If the API changes field names, only this file changes.

### 4.3 API Request Strategy

The `productSearch` endpoint is the primary constraint. Typical brokerage search APIs have:
- **50–200ms latency** per request
- **Rate limits** (e.g. 10 req/s per user)
- **No server-side debounce** — every request counts

Our strategy:

| Concern | Approach |
|---|---|
| Debounce | 250ms client-side debounce on input (see Section 7) |
| Cancellation | `switchMap` in `rxMethod` — new keystroke cancels in-flight request |
| Minimum query length | 1 character minimum before sending request |
| Empty query | Clears results immediately, shows recent searches / trending |
| Caching | Short-lived in-memory cache in repository (see Section 9) |
| Rate limiting | Client-side debounce + switchMap naturally limits rate |

---

## 5. State Management (SignalStore)

### 5.1 Store Design

The `SearchStore` is **feature-scoped** (provided at route/modal level), not global.
Search results are transient — they should not persist when the user leaves search. Recent
searches are a separate concern managed by a lightweight root-scoped service.

```typescript
// data-access/search.store.ts
import { computed, inject } from '@angular/core';
import {
  patchState, signalStore, withComputed, withHooks, withMethods, withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap, debounceTime, filter, distinctUntilChanged } from 'rxjs';
import { SearchRepository } from './search.repository';
import { SearchResult } from './search.models';
import { SearchStorageProvider } from './search-storage.provider';

interface SearchState {
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly hasSearched: boolean;  // distinguishes "no results" from "hasn't searched yet"
}

const initialState: SearchState = {
  query: '',
  results: [],
  loading: false,
  error: null,
  hasSearched: false,
};

export const SearchStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    /** True when results are empty AND user has submitted a search. */
    noResults: computed(() => store.hasSearched() && !store.loading() && store.results().length === 0),
    /** True when no query has been entered — show recent/trending. */
    showInitialState: computed(() => !store.hasSearched() && store.query().length === 0),
    /** Trimmed, lowercase query for display/comparison. */
    normalizedQuery: computed(() => store.query().trim().toLowerCase()),
  })),

  withComputed(() => {
    const storage = inject(SearchStorageProvider);
    return {
      /** Recent searches — delegates to the root-scoped storage provider. */
      recents: computed(() => storage.recentList()),
    };
  }),

  withMethods((store, repo = inject(SearchRepository), storage = inject(SearchStorageProvider)) => ({

    /**
     * Primary search method. Accepts a raw query string (from ionInput).
     * Debounce, cancellation, and min-length filtering happen INSIDE the pipe.
     *
     * Why rxMethod + switchMap (not signalMethod):
     * - switchMap cancels in-flight HTTP on new keystroke — critical for search-as-you-type
     * - debounceTime reduces API calls — cannot do this with signalMethod
     * - distinctUntilChanged prevents duplicate requests for same normalized query
     */
    search: rxMethod<string>(
      pipe(
        tap(query => patchState(store, { query })),
        debounceTime(250),
        distinctUntilChanged(),
        tap(query => {
          if (query.trim().length === 0) {
            patchState(store, { results: [], loading: false, error: null, hasSearched: false });
          }
        }),
        filter(query => query.trim().length >= 1),
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(query =>
          repo.search$(query.trim()).pipe(
            tapResponse({
              next: results => patchState(store, { results, hasSearched: true }),
              error: (e: unknown) => patchState(store, {
                error: normalizeError(e),
                results: [],
                hasSearched: true,
              }),
              finalize: () => patchState(store, { loading: false }),
            }),
          ),
        ),
      ),
    ),

    /** Record a selected result as a recent search. */
    recordRecentSearch(result: SearchResult): void {
      storage.add(result);
    },

    /** Remove a recent search by ticker. */
    removeRecent(ticker: string): void {
      storage.remove(ticker);
    },

    /** Reset store to initial state (on destroy / modal dismiss). */
    reset(): void {
      patchState(store, initialState);
    },
  })),

  withHooks({
    onDestroy(store) {
      store.reset();
    },
  }),
);

function normalizeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'Search failed. Please try again.';
}
```

### 5.2 Key Design Decisions

| Decision | Rationale |
|---|---|
| `rxMethod<string>` (not `signalMethod`) | Search-as-you-type requires `debounceTime`, `switchMap` (cancel previous), `distinctUntilChanged`. RxJS is the right tool for this concurrency pattern. |
| Debounce **inside** the rxMethod pipe | Single source of truth for timing. UI emits every keystroke; store handles throttling. UI stays dumb. |
| `switchMap` (not `exhaustMap`) | "Latest wins" — when user types new characters, cancel the old request. User only cares about results matching their current query. |
| `distinctUntilChanged` | Prevents duplicate API calls when debounced value hasn't changed (e.g. user types then deletes then retypes same char). |
| `hasSearched` flag | Distinguishes three UI states: initial (show recents), loading, and "no results found". Without this flag, "no results" and "hasn't searched" are ambiguous. |
| `finalize` clears loading | Prevents stuck spinners on error or cancellation. Non-negotiable. |
| Feature-scoped store | Search results are transient. New search session = fresh state. No stale results from a previous search leaking into a new modal/page. |
| Internal `SearchStorageProvider` | Recents are persistent (survive across sessions). A root-scoped provider owns localStorage read/write. The store delegates to it via `withComputed` and `withMethods` — feature components inject only `SearchStore`. |

### 5.3 SearchStorageProvider (Internal, Root-Scoped)

Recent searches survive across search sessions and app restarts. A root-scoped
`SearchStorageProvider` owns `localStorage` persistence. This provider is **internal to the
`data-access` layer** — it is NOT exported in the public API. Feature components never inject
it directly; they access recents through `SearchStore` which delegates to the provider.

Multiple `SearchStore` instances (page + modal) share the same `SearchStorageProvider`
singleton. Transient state (query, results, loading) is scoped per store instance; persistent
state (recents) is shared through the provider.

```typescript
// data-access/search-storage.provider.ts  (internal — not exported from library)
import { Injectable, signal, computed } from '@angular/core';
import { RecentSearch, SearchResult } from './search.models';

const STORAGE_KEY = 'invest_recent_searches';
const MAX_RECENTS = 10;

@Injectable({ providedIn: 'root' })
export class SearchStorageProvider {
  private readonly _recents = signal<readonly RecentSearch[]>(this.loadFromStorage());

  readonly recents = this._recents.asReadonly();

  /** Most recent first, capped at MAX_RECENTS. */
  readonly recentList = computed(() =>
    [...this._recents()].sort((a, b) => b.searchedAt - a.searchedAt).slice(0, MAX_RECENTS),
  );

  add(result: SearchResult): void {
    const entry: RecentSearch = {
      ticker: result.ticker,
      name: result.name,
      instrumentType: result.instrumentType,
      logoUrl: result.logoUrl,
      searchedAt: Date.now(),
    };
    // Remove duplicate, prepend new, cap length
    const updated = [entry, ...this._recents().filter(r => r.ticker !== result.ticker)]
      .slice(0, MAX_RECENTS);
    this._recents.set(updated);
    this.saveToStorage(updated);
  }

  remove(ticker: string): void {
    const updated = this._recents().filter(r => r.ticker !== ticker);
    this._recents.set(updated);
    this.saveToStorage(updated);
  }

  clear(): void {
    this._recents.set([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  private loadFromStorage(): readonly RecentSearch[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as readonly RecentSearch[]) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(recents: readonly RecentSearch[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
    } catch {
      // Storage full or unavailable — fail silently, recents are non-critical
    }
  }
}
```

---

## 6. Component Architecture

### 6.1 Component Tree

```
SearchPageComponent (feature — routed)         SearchModalComponent (feature — modal)
├── ion-header                                  ├── ion-header
│   └── ion-back-button (start)                 │   └── ion-button X close (end)
└── ion-content                                 └── ion-content
    └── SearchResultListComponent (ui)              └── SearchResultListComponent (ui)
        ├── ion-searchbar                               ├── ion-searchbar
        ├── SearchEmptyStateComponent (ui)              ├── SearchEmptyStateComponent (ui)
        │   ├── Recent searches list                    │   ├── Recent searches list
        │   └── Trending instruments                    │   └── Trending instruments
        └── Results list                                └── Results list
            └── SearchResultItemComponent (ui)              └── SearchResultItemComponent (ui)
                ├── Logo (img)                                  ├── Logo (img)
                ├── Ticker + Name                               ├── Ticker + Name
                └── Type badge                                  └── Type badge
```

### 6.2 SearchResultListComponent (Shared UI Core)

This is the reusable heart of both search modes. It owns the search input, orchestrates
the store, and renders the result list. It knows nothing about navigation or modals.

```typescript
// ui/search-result-list.component.ts
import {
  Component, ChangeDetectionStrategy, inject, output, OnInit,
} from '@angular/core';
import {
  IonSearchbar, IonList, IonSpinner, IonText,
} from '@ionic/angular/standalone';
import { SearchStore } from '../data-access/search.store';
import { SearchResult, RecentSearch } from '../data-access/search.models';
import { SearchResultItemComponent } from './search-result-item.component';
import { SearchEmptyStateComponent } from './search-empty-state.component';

@Component({
  selector: 'lib-search-result-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSearchbar, IonList, IonSpinner, IonText,
    SearchResultItemComponent, SearchEmptyStateComponent,
  ],
  template: `
    <ion-searchbar
      #searchbar
      placeholder="Search stocks, crypto, ETFs..."
      (ionInput)="onQueryChange($event)"
      [debounce]="0"
      inputmode="search"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      aria-label="Search instruments"
    />

    @if (store.loading()) {
      <div class="ion-text-center ion-padding">
        <ion-spinner name="crescent" aria-label="Searching..." />
      </div>
    }

    @if (store.showInitialState()) {
      <lib-search-empty-state
        [recents]="store.recents()"
        (recentSelected)="onRecentSelected($event)"
        (recentRemoved)="store.removeRecent($event)"
      />
    }

    @if (store.noResults()) {
      <div class="ion-text-center ion-padding">
        <ion-text color="medium">
          <p>No results for "{{ store.query() }}"</p>
        </ion-text>
      </div>
    }

    @if (store.error(); as error) {
      <div class="ion-text-center ion-padding">
        <ion-text color="danger">
          <p>{{ error }}</p>
        </ion-text>
      </div>
    }

    @if (store.results().length > 0) {
      <ion-list>
        @for (result of store.results(); track result.ticker) {
          <lib-search-result-item
            [result]="result"
            (selected)="onResultSelected($event)"
          />
        }
      </ion-list>
    }
  `,
})
export class SearchResultListComponent implements OnInit {
  protected readonly store = inject(SearchStore);

  /** Emitted when user taps a search result or a recent search. Parent handles navigation. */
  readonly resultSelected = output<SearchResult>();

  ngOnInit(): void {
    // Focus searchbar on mount for immediate typing
    // Handled via ViewChild + ionViewWillEnter in page wrapper if needed
  }

  protected onQueryChange(event: CustomEvent): void {
    const query = (event.detail.value as string | null) ?? '';
    this.store.search(query);
  }

  protected onResultSelected(result: SearchResult): void {
    this.store.recordRecentSearch(result);
    this.resultSelected.emit(result);
  }

  protected onRecentSelected(recent: RecentSearch): void {
    // Convert recent to a search result shape for navigation
    const result: SearchResult = {
      ticker: recent.ticker,
      name: recent.name,
      instrumentType: recent.instrumentType,
      logoUrl: recent.logoUrl,
      exchange: '', // not needed for navigation, PDP fetches full data
    };
    this.resultSelected.emit(result);
  }
}
```

**Critical: `[debounce]="0"` on IonSearchbar.** Debounce is handled inside the store's
`rxMethod` pipe (250ms). Do NOT double-debounce — IonSearchbar's built-in debounce +
store debounce would add up to unacceptable latency. Set IonSearchbar to `0` and let the
store own the timing.

### 6.3 SearchResultItemComponent (Presentational)

```typescript
// ui/search-result-item.component.ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IonItem, IonLabel, IonAvatar, IonBadge, IonImg } from '@ionic/angular/standalone';
import { SearchResult } from '../data-access/search.models';

@Component({
  selector: 'lib-search-result-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonItem, IonLabel, IonAvatar, IonBadge, IonImg],
  template: `
    <ion-item button (click)="selected.emit(result())" detail="false">
      <ion-avatar slot="start" aria-hidden="true">
        @if (result().logoUrl) {
          <ion-img [src]="result().logoUrl" [alt]="result().ticker + ' logo'" />
        } @else {
          <div class="logo-placeholder">{{ result().ticker.charAt(0) }}</div>
        }
      </ion-avatar>
      <ion-label>
        <h2>{{ result().ticker }}</h2>
        <p>{{ result().name }}</p>
      </ion-label>
      <ion-badge slot="end" color="light">{{ result().instrumentType }}</ion-badge>
    </ion-item>
  `,
  styles: [`
    .logo-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--ion-color-light);
      font-weight: 600;
      font-size: 1.1rem;
    }
  `],
})
export class SearchResultItemComponent {
  readonly result = input.required<SearchResult>();
  readonly selected = output<SearchResult>();
}
```

### 6.4 SearchEmptyStateComponent (Recent Searches)

```typescript
// ui/search-empty-state.component.ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption, IonText } from '@ionic/angular/standalone';
import { RecentSearch } from '../data-access/search.models';

@Component({
  selector: 'lib-search-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption, IonText],
  template: `
    @if (recents().length > 0) {
      <div class="ion-padding-horizontal ion-padding-top">
        <ion-text color="medium"><h6>Recent Searches</h6></ion-text>
      </div>
      <ion-list>
        @for (recent of recents(); track recent.ticker) {
          <ion-item-sliding>
            <ion-item button (click)="recentSelected.emit(recent)">
              <ion-label>
                <h3>{{ recent.ticker }}</h3>
                <p>{{ recent.name }}</p>
              </ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" (click)="recentRemoved.emit(recent.ticker)">
                Remove
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        }
      </ion-list>
    } @else {
      <div class="ion-text-center ion-padding">
        <ion-text color="medium">
          <p>Search for stocks, crypto, and ETFs</p>
        </ion-text>
      </div>
    }
  `,
})
export class SearchEmptyStateComponent {
  readonly recents = input.required<readonly RecentSearch[]>();
  readonly recentSelected = output<RecentSearch>();
  readonly recentRemoved = output<string>();  // ticker
}
```

### 6.5 Feature Wrappers (Page & Modal)

See `docs/ionic-angular/ionic-angular-navigation.md` Section 6.6–6.8 for the full
`SearchPageComponent`, `SearchModalComponent`, and `SearchModalService` implementations.
The key contracts:

**SearchPageComponent** (routed):
- Provides `SearchStore` at the component level (fresh instance per route activation).
- `ion-back-button` in start slot, `defaultHref` derived from current tab.
- `onResultSelected(result)` → `navCtrl.navigateForward([tabRoot, 'asset', result.ticker])`.

**SearchModalComponent** (modal):
- Provides `SearchStore` at the component level.
- X close button in end slot.
- `onResultSelected(result)` → `modalCtrl.dismiss(result, 'select')`.
- `close()` → `modalCtrl.dismiss(null, 'cancel')`.

**SearchModalService** (root-scoped):
- `open(): Promise<SearchResult | null>` — presents modal, returns selected result.
- Caller navigates to PDP after receiving result.

**Store Scoping:** Both wrappers provide `SearchStore` in their own `providers` array:

```typescript
// In SearchPageComponent
@Component({
  // ...
  providers: [SearchStore],
})

// In SearchModalComponent
@Component({
  // ...
  providers: [SearchStore],
})
```

This ensures each search session gets a fresh store. When the page is popped or the modal
is dismissed, the store is destroyed with its state. No cleanup needed.

---

## 7. Search Input Behavior

### 7.1 Keystroke → Result Timeline

```
User types "A"
  t=0ms     ionInput fires → store.search("A")
  t=0ms     patchState({ query: "A" })                    ← instant query display
  t=250ms   debounceTime(250) fires
  t=250ms   filter: "A".length >= 1 ✓ → passes
  t=250ms   patchState({ loading: true })                  ← spinner appears
  t=250ms   HTTP: GET /api/instruments/search?q=A          ← request sent
  t=350ms   Response arrives → patchState({ results, loading: false })  ← results render

User continues typing "AP" at t=100ms
  t=100ms   ionInput fires → store.search("AP")
  t=100ms   patchState({ query: "AP" })
  t=250ms   original "A" debounce fires but distinctUntilChanged sees "AP" ≠ "A"
            → "A" request is in-flight
  t=350ms   debounceTime(250) for "AP" fires
  t=350ms   switchMap: CANCELS in-flight "A" request       ← critical!
  t=350ms   HTTP: GET /api/instruments/search?q=AP
  t=450ms   Response arrives for "AP" → results render
```

### 7.2 Why This Timing

| Parameter | Value | Rationale |
|---|---|---|
| IonSearchbar `debounce` | `0` | No double-debounce. Store owns timing. |
| rxMethod `debounceTime` | `250ms` | Balances responsiveness vs API rate. Industry standard for search. |
| Min query length | `1` char | Even single characters yield useful results for tickers (e.g. "A" → "AAPL", "AMZN"). |
| `switchMap` | — | Latest-wins. Cancels stale requests. User never sees results for a query they've already moved past. |
| `distinctUntilChanged` | — | Prevents duplicate request when debounced value hasn't changed. |

### 7.3 Clearing the Input

When the user clears the search field (taps the X on IonSearchbar, or deletes all text):

1. `ionInput` fires with empty string
2. Store immediately sets `query: ''`, `results: []`, `hasSearched: false`
3. Any in-flight HTTP is cancelled by `switchMap` (empty string is filtered out by `filter`)
4. UI shows `SearchEmptyStateComponent` (recent searches)

This is handled inside the `rxMethod` pipe — see the `tap` before `filter` in Section 5.1.

---

## 8. Search → PDP Navigation Contract

### 8.1 The Contract

When a user taps a search result, the search feature's responsibility ends at emitting the
selected `SearchResult` via the `resultSelected` output. **The navigation to PDP
is entirely owned by the feature wrapper** (page or modal).

This separation ensures:
- `SearchResultListComponent` is reusable and navigation-agnostic
- Page wrapper uses `navCtrl.navigateForward` (push PDP onto tab stack)
- Modal wrapper uses `modalCtrl.dismiss(result)` (return data to caller)
- The caller of the modal navigates to PDP (it knows its tab prefix)

### 8.2 PDP Route Parameter

PDP receives the ticker via route parameter bound by `withComponentInputBinding()`:

```
/tabs/portfolio/asset/AAPL     → AssetDetailComponent receives ticker() = "AAPL"
```

PDP is responsible for fetching the full instrument data (price, chart, holdings) using the
ticker. Search does NOT pass the full result object to PDP — only the ticker identifier
travels via the URL. This keeps deep linking and URL sharing working correctly.

### 8.3 Navigation Flows

**Page mode:**
```
Portfolio → Search Page → tap "AAPL" → navigateForward(/tabs/portfolio/asset/AAPL)
                ↑                                     ↓
          (stays on stack)                      AAPL PDP renders
                ↑                                     ↓
          back from PDP ← ← ← ← ← ← ← ← ← (ion-back-button / swipe)
```

**Modal mode:**
```
Portfolio → [Search Modal opens] → tap "AAPL" → modal.dismiss({ticker:"AAPL"})
     ↑                                                    ↓
     |              modal is now gone                      ↓
     |                                        caller receives result
     |                                        navCtrl.navigateForward(/tabs/portfolio/asset/AAPL)
     |                                                    ↓
     ← ← ← ← ← ← back from PDP ← ← ← ← ←    AAPL PDP renders
```

---

## 9. Performance & UX Optimizations

### 9.1 Perceived Performance: Never Blank

The search screen must never show an empty white screen:

| State | What to show |
|---|---|
| Initial (no query) | Recent searches (from `SearchStore`) |
| Typing (loading) | Keep previous results visible + spinner at top |
| Results arrived | Result list |
| No results | "No results for [query]" message |
| Error | Error message + retry suggestion |

**Key: Do NOT clear results on new keystroke.** The previous results stay visible while the
new request is loading. This eliminates the "flash of empty" that makes search feel slow.
The store's `rxMethod` pipe in Section 5.1 only patches `results` when the new response
arrives — the `loading: true` patch does NOT clear results.

### 9.2 In-Memory Response Cache

For repeat queries (user types "AAPL", navigates to PDP, comes back, types "AAPL" again),
cache at the repository level:

```typescript
// data-access/search.repository.ts (enhanced)
private readonly cache = new Map<string, {
  results: readonly SearchResult[];
  timestamp: number;
}>();

private readonly CACHE_TTL = 60_000; // 1 minute

search$(query: string): Observable<readonly SearchResult[]> {
  const normalized = query.trim().toLowerCase();
  const cached = this.cache.get(normalized);

  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
    return of(cached.results);
  }

  return this.http
    .get<readonly SearchResultDto[]>('/api/instruments/search', {
      params: { q: query },
    })
    .pipe(
      map(dtos => dtos.map(mapDtoToResult)),
      tap(results => this.cache.set(normalized, { results, timestamp: Date.now() })),
    );
}
```

**Cache is in the repository, not the store.** The store is feature-scoped (destroyed per
session). The repository is root-scoped — cache survives across search sessions within the
same app lifecycle.

**TTL of 60s** is appropriate for search — ticker symbols and company names don't
change frequently. Prices are NOT in search results (they're on PDP).

### 9.3 Logo Preloading

Instrument logos are small images (usually 32×32 or 64×64 PNGs). Use `IonImg` which provides
lazy loading + in-viewport detection automatically. No custom preloading needed.

For the logo placeholder (when `logoUrl` is null), render the first character of the ticker
in a styled circle — instant, no network request.

### 9.4 TrackBy for Result List

`@for (result of store.results(); track result.ticker)` — tracking by ticker ensures
Angular reuses DOM nodes when results change between keystrokes. If the user types "AA" and
then "AAP", results like "AAPL" that appear in both responses reuse their DOM node instead
of being destroyed and recreated.

### 9.5 Zoneless Considerations

In a zoneless Angular app, change detection is triggered by signal reads in the template.
Our architecture is naturally zoneless-compatible:

- All state is in NgRx signals (automatically trigger CD when read in template)
- `rxMethod` patches state via `patchState` which updates signals → triggers CD
- No manual `ChangeDetectorRef.markForCheck()` needed
- No `setTimeout` / `setInterval` / zone patches involved

**Potential pitfall:** `IonSearchbar`'s `ionInput` event is a CustomEvent dispatched by Ionic's
Stencil runtime. In zoneless mode, this event is still handled correctly because Angular's
event binding (`(ionInput)`) triggers change detection regardless of zones. No special
handling needed.

---

## 10. Edge Cases & Error Handling

### 10.1 Edge Case Matrix

| Scenario | Expected Behavior | Implementation |
|---|---|---|
| User types and immediately clears | Cancel in-flight request, show recents | `switchMap` cancels HTTP; `filter` blocks empty query |
| User types very fast (10+ chars/sec) | Only last debounced query sends HTTP | `debounceTime(250)` collapses intermediate keystrokes |
| Same query typed twice | Only one HTTP call | `distinctUntilChanged` deduplicates |
| Network error (timeout, 500) | Show error message, keep previous results | `tapResponse.error` patches error; results from previous query remain |
| Slow API response (> 2s) | Spinner visible until response or cancellation | `loading` stays true until `finalize` fires |
| API returns empty array | "No results for [query]" message | `hasSearched: true` + `results: []` → `noResults` computed is true |
| User navigates away during loading | HTTP request cancelled (store destroyed) | Feature-scoped store — Angular destroys it, rxMethod unsubscribes |
| Device offline | Show error message | HTTP error caught by `tapResponse.error` |
| API rate limit (429) | Show friendly error, user can retry by modifying query | `tapResponse.error` handles all HTTP errors uniformly |
| Search result has no logo | Show placeholder with first letter of ticker | `@if (result().logoUrl)` / `@else` in template |
| Very long result list (100+ items) | Ionic virtual scroll handles rendering | Use `IonList` — Ionic handles efficient rendering. For truly massive lists, consider server-side pagination. |
| Query with special characters | Encode properly, no injection | `HttpClient` auto-encodes query params in `params` object |

### 10.2 Error Strategy

Errors in search are **non-critical**. The user can always modify their query and try again.

**DO:**
- Show inline error text below the search bar
- Keep previous results visible if available
- Clear error when user types a new query (handled by `tap` → `patchState({ error: null })`)

**DO NOT:**
- Show a full-screen error page
- Show a toast/alert (interruptive for a typing flow)
- Block the search input on error
- Retry automatically (user's next keystroke is the natural retry)

---

## 11. Accessibility

### 11.1 Requirements

| Element | A11y Requirement |
|---|---|
| `ion-searchbar` | `aria-label="Search instruments"`, `inputmode="search"`, `enterkeyhint="search"` |
| Result list | `ion-list` provides list role natively |
| Result item | `ion-item button` provides button role + keyboard focus |
| Logo image | `[alt]="result.ticker + ' logo'"` or `aria-hidden="true"` for decorative |
| Spinner | `aria-label="Searching..."` |
| No results text | Live region or visible text — screen reader announces state change |
| Type badge | Text content is sufficient (read as "stock", "crypto", etc.) |

### 11.2 Keyboard Navigation

- IonSearchbar auto-focuses on page/modal enter (standard Ionic behavior)
- Arrow keys + Enter navigate result list (IonItem handles this natively)
- Escape on modal → dismiss (handled by Ionic modal)
- Tab cycles through interactive elements

---

## 12. Implementation Sequence

This is the recommended build order. Each step is independently testable.

### Phase 1: Data Layer

1. **Models** — Create `search.models.ts` with `SearchResultDto`,
   `SearchResult`, `RecentSearch` interfaces.
2. **Repository** — Create `search.repository.ts` with `search$()` method
   and DTO→domain mapping. Initially mock the HTTP response for development.
3. **SearchStorageProvider** — Create `search-storage.provider.ts` (internal to data-access,
   not exported). Root-scoped provider with localStorage persistence for recent searches.

### Phase 2: State Layer

4. **Store** — Create `search.store.ts` with `rxMethod<string>` search pipe,
   computed signals, and `recordRecentSearch` method.
5. **Store Tests** — Test debounce, switchMap cancellation, error handling, state transitions.

### Phase 3: UI Components

6. **SearchResultItemComponent** — Presentational: logo, ticker, name, type badge.
   Test with static input data.
7. **SearchEmptyStateComponent** — Presentational: recent searches list, remove gesture.
   Test with static input data.
8. **SearchResultListComponent** — Composes items + empty state. Injects store. Wire
   `ionInput` → `store.search()`, `resultSelected` output.

### Phase 4: Feature Wrappers

9. **SearchPageComponent** — Routed wrapper with `ion-back-button`. Provides store.
   Wire `resultSelected` → `navigateForward` to PDP.
10. **SearchModalComponent** — Modal wrapper with X close. Provides store.
    Wire `resultSelected` → `modalCtrl.dismiss(result)`.
11. **SearchModalService** — Root-scoped, presents modal, returns `Promise<SearchResult | null>`.

### Phase 5: Integration

12. **Route Config** — Add `<tab>/search` routes per tab pointing to `SearchPageComponent`
    (see navigation doc Section 4.1).
13. **Tab Page Integration** — Add search icon buttons to Portfolio, Discover, News headers.
    Wire to `navigateForward(['/tabs/<tab>/search'])`.
14. **Modal Integration** — Wire secondary CTAs to `SearchModalService.open()`.
15. **PDP Connection** — Verify full flow: search → tap result → PDP renders with correct ticker.

### Phase 6: Polish

16. **Cache** — Add in-memory response cache to repository.
17. **Error States** — Verify offline, timeout, 429 behaviors.
18. **A11y Audit** — Run AXE checks, verify keyboard navigation, verify screen reader flow.
19. **Performance** — Profile render times, verify no unnecessary re-renders in zoneless mode.

---

## References

- Navigation architecture: `docs/ionic-angular/ionic-angular-navigation.md` Section 6
- NgRx Signals patterns: `docs/copilot-samples/instructions/ngrx-signals.instructions.md`
- NgRx Signals fundamentals: `docs/ngrx-signals/fundamentals/`
- App architecture: `external-context/invest.app.md`
- Ionic Searchbar API: https://ionicframework.com/docs/api/searchbar
- Angular Signals: https://angular.dev/guide/signals