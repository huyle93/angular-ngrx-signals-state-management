# Search Modularity — Architecture & Implementation Guide

<!-- AGENT: This is Stage 2 of the search feature. Read this entire preamble before writing any code. -->

> **STAGE 2 — AI AGENT INSTRUCTIONS**
>
> **What this document is:** Your implementation blueprint for extracting the monolithic
> search page into composable UI primitives in `search/ui`, composing them in
> `search/feature` wrappers, and enabling consumer domains to reuse search UI with
> custom accessory content via content projection.
>
> **Stage 1 (already designed — reference only, do not re-implement):**
> The data-access layer is fully specified in `docs/guides/search.arch.md`:
>
> | What | Where in search.arch.md |
> |---|---|
> | `SearchStore` (component-scoped, `rxMethod`) | Section 5.1 |
> | `SearchStorageProvider` (root-scoped, internal) | Section 5.3 |
> | `SearchRepository` (HTTP, DTO→domain mapping) | Section 4.2 |
> | Data models (`SearchResult`, `SearchResultDto`, `RecentSearch`) | Section 3 |
> | Search input behavior (debounce, switchMap, timing) | Section 7 |
> | Performance & caching | Section 9 |
>
> **Stage 2 (this document — your task):**
> Build the `search/ui` and `search/feature` layers on top of the Stage 1 data-access layer.
>
> **Before writing any code, read in this order:**
> 1. The **Progress Checklist** below — your master task list
> 2. **Section 2** of this doc — Design Principles (non-negotiable rules)
> 3. **Section 3** of this doc — Nx Boundary Rules (import/export contracts)
> 4. **Section 4** of this doc — Target File Structure (what to create)
> 5. `docs/guides/search.arch.md` Sections 3, 5.1, 5.3 — data models, store, storage provider
> 6. `.github/instructions/typescript.instructions.md` — TypeScript coding rules
> 7. `docs/copilot-samples/instructions/ngrx-signals.instructions.md` — SignalStore patterns
>
> **How to implement:**
> Work through the Progress Checklist step by step. For each step, read the Section
> referenced in the checklist for the complete spec and code. Copy the code exactly,
> adjusting only import paths for your workspace. After each step, verify it compiles
> before proceeding.

---

## Progress Checklist

<!-- AGENT: This is your master task list. Complete steps in order — each builds on the previous. -->

> **Track your progress here.** Mark each step done as you complete it.
> Steps are ordered by dependency — do not skip ahead.

### Phase 1 — UI Primitives (`search/ui`)

| Done | Step | File to Create | Spec |
|:---:|---|---|---|
| [ ] | **1. ModalBottomAccessoryDirective** | `modal-bottom-accessory.directive.ts` | Section 5.2 |
| [ ] | **2. SearchPickerShellComponent** | `search-picker-shell.component.ts` | Section 5.1 |
| [ ] | **3. SearchResultRowComponent** | `search-result-row.component.ts` | Section 5.4 |

### Phase 2 — Composite UI (`search/ui`)

| Done | Step | File to Create | Spec |
|:---:|---|---|---|
| [ ] | **4. SearchResultsListComponent** | `search-results-list.component.ts` | Section 5.3 |
| [ ] | **5. SearchEmptyStateComponent** | `search-empty-state.component.ts` | Section 5.5 |

### Phase 3 — Feature Wrappers (`search/feature`)

| Done | Step | File to Create | Spec |
|:---:|---|---|---|
| [ ] | **6. SearchPageComponent** | `search-page.component.ts` | Section 8.2 |
| [ ] | **7. SearchModalComponent** | `search-modal.component.ts` | Section 8.3 |

### Phase 4 — Validate

| Done | Step | What to Do | Spec |
|:---:|---|---|---|
| [ ] | **8. End-to-end verification** | Test all user flows | Section 10, Phase 4 |
| [ ] | **9. Export verification** | `search/ui` exports all 5 primitives | Section 10, Step 9 |
| [ ] | **10. Validation checklist** | All boxes in Section 11 must pass | Section 11 |

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Design Principles](#2-design-principles)
3. [Nx Boundary Rules](#3-nx-boundary-rules)
4. [Target File Structure](#4-target-file-structure)
5. [Component Specifications](#5-component-specifications)
6. [Content Projection Strategy](#6-content-projection-strategy)
7. [Store and Provider Scoping](#7-store-and-provider-scoping)
8. [Search Page Composition](#8-search-page-composition)
9. [Consumer Composition Pattern (VP Example)](#9-consumer-composition-pattern-vp-example)
10. [Implementation Sequence](#10-implementation-sequence)
11. [Validation Checklist](#11-validation-checklist)

---

## 1. Problem Statement

### 1.1 Current State

The search domain has:
- `SearchStore` in `search/data-access` -- owns query, results, loading, error, hasSearched state, and recent searches (persisted internally via localStorage)
- A fully functional search page in `search/feature` that contains layout, searchbar, result list, result rows, empty state, loading, and error treatment -- all inline

The search page works. The store is correctly designed. No business logic changes are needed.

### 1.2 Problem

Other domains need to present search in their own context. Virtual Portfolio (VP) needs a
search modal with a custom summary bar at the bottom. If VP imports the search page as-is,
it cannot inject its own footer. If the search page adds a `mode` input or a
`showBottomAccessory` flag, the search domain absorbs VP-specific concerns. Every new consumer
adds another mode flag. The search domain becomes a dumping ground.

### 1.3 Solution

Extract the search page's presentation and layout into generic, composable UI primitives
in `search/ui`. Consumer domains compose those primitives with their own accessory UI.
Search provides the building blocks. Consumers provide the assembly.

---

## 2. Design Principles

These rules are non-negotiable.

### 2.1 Composition Over Configuration

Consumer features inject their own accessory UI via content projection. Search does not
expose `mode`, `variant`, `showFooter`, or any consumer-specific input. If the search shell
has a bottom region, that region renders only when content is projected into it. Projection
presence is the sole source of truth.

### 2.2 Layer Purity

| Layer | Allowed | Forbidden |
|---|---|---|
| `data-access` | State, business logic, models, repository | Ionic UI imports, routing, NavController, ModalController |
| `feature` | Route wiring, store-to-UI binding, navigation | Business logic, direct HTTP, rendering decisions |
| `ui` | Presentational rendering, input/output contracts | Store injection, NavController, business logic, routing |
| `util` | Pure functions, no Angular dependencies | Services, signals, side effects |

UI components receive data via `input()` and emit events via `output()`. They do not inject
the store directly. The feature layer connects store signals to UI inputs.

### 2.3 No Feature-Mode Explosion

Do not add inputs like:
- `mode: 'vp' | 'default' | 'watchlist'`
- `showVpSummaryBar: boolean`
- `footerTemplate: TemplateRef`

These patterns create coupling between the search domain and every consumer. Use named
content projection slots instead.

### 2.4 Consumer Owns Consumer Logic

If a consumer needs a custom footer, custom CTA, custom modal orchestration, or
custom selection behavior beyond what search provides, that logic belongs in the
consumer's own `feature/` or `ui/` library. Not in search.

### 2.5 Angular 20+ Code Conventions

All code in this document follows Angular 20+ defaults:

- `standalone: true` is the default for components and directives. Do NOT set it
  explicitly in `@Component` or `@Directive` decorators.
- Use `input()` and `output()` functions, not `@Input()` / `@Output()` decorators.
- Use `inject()` for dependency injection, not constructor parameters.
- Use `@if`, `@for`, `@switch` control flow, not structural directives.

---

## 3. Nx Boundary Rules

### 3.1 What Each Library Exports

**search/data-access** exports:
- `SearchStore` (also exposes `recents` state and `removeRecent` method)
- `SearchRepository`
- All model interfaces: `SearchResult`, `SearchResultDto`, `RecentSearch`

**search/ui** exports:
- `SearchPickerShellComponent`
- `SearchResultsListComponent`
- `SearchResultRowComponent`
- `SearchEmptyStateComponent`
- `ModalBottomAccessoryDirective`

**search/feature** exports:
- `SearchPageComponent`
- Route fragment for tab configs
- `SearchModalComponent` and `SearchModalService` only if they remain fully generic

### 3.2 What Consumers Import

| Consumer needs | Import from |
|---|---|
| Search state, query logic, models | `search/data-access` |
| Shell layout, result list, result row, empty state | `search/ui` |
| The exact default search page as-is (no customization) | `search/feature` |

### 3.3 What Consumers Must Not Import

Consumer domains must not import `search/feature` when they need custom composition. If VP
needs a custom modal with a summary bar, VP builds its own wrapper using `search/ui` +
`search/data-access`. VP does not depend on `search/feature`.

### 3.4 Dependency Direction

```
search/feature  -->  search/ui  -->  (no domain deps)
      |                  ^
      v                  |
search/data-access       |
      ^                  |
      |                  |
vp/feature  -------------+
      |
      v
vp/ui  (no search deps)
```

VP feature imports `search/data-access` and `search/ui`. VP feature does not import
`search/feature`. VP ui has no search dependency -- it owns VP-specific presentation only.

---

## 4. Target File Structure

Target search domain structure:

```
libs/invest-app/search/
├── data-access/                                # Stage 1 (search.arch.md)
│   ├── search.store.ts                         #   Component-scoped SignalStore (§5.1)
│   ├── search-storage.provider.ts              #   Root-scoped recents persistence (§5.3, internal)
│   ├── search.repository.ts                    #   HTTP client, DTO→domain mapping (§4.2)
│   └── search.models.ts                        #   SearchResult, SearchResultDto, RecentSearch (§3)
│
├── feature/                                    # Stage 2 — Steps 6–7
│   ├── search-page.component.ts                #   Step 6 → this doc Section 8.2
│   ├── search-modal.component.ts               #   Step 7 → this doc Section 8.3
│   ├── search-modal.service.ts                 #   Root-scoped modal presenter
│   └── routes.ts                               #   Route fragment for tab configs
│
├── ui/                                         # Stage 2 — Steps 1–5
│   ├── search-picker-shell.component.ts        #   Step 2 → this doc Section 5.1
│   ├── search-results-list.component.ts        #   Step 4 → this doc Section 5.3
│   ├── search-result-row.component.ts          #   Step 3 → this doc Section 5.4
│   ├── search-empty-state.component.ts         #   Step 5 → this doc Section 5.5
│   └── modal-bottom-accessory.directive.ts     #   Step 1 → this doc Section 5.2
│
└── util/
    └── search.helpers.ts                       #   Pure functions: query normalization, highlight
```

---

## 5. Component Specifications

<!-- AGENT: Each subsection below is a complete file specification with copy-ready code.
     Read only the subsection for the step you're implementing. -->

> **Agent inventory:** 5 files to create (Steps 1–5). Each subsection (5.1–5.5) contains:
> location, purpose, full implementation code, and key decisions. The Progress Checklist
> maps each step to the correct subsection.

### 5.1 SearchPickerShellComponent

**Location:** `search/ui/search-picker-shell.component.ts`

**Purpose:** Generic layout container for any search experience. Provides named content
projection regions: header, content body, and an optional bottom accessory slot. Does not
own any state. Does not know about modals, pages, VP, or navigation.

```typescript
// search/ui/search-picker-shell.component.ts

import {
  Component, ChangeDetectionStrategy, contentChild,
} from '@angular/core';
import { IonHeader, IonContent, IonToolbar, IonFooter } from '@ionic/angular/standalone';
import { ModalBottomAccessoryDirective } from './modal-bottom-accessory.directive';

@Component({
  selector: 'lib-search-picker-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonContent, IonToolbar, IonFooter],
  template: `
    <ion-header>
      <ion-toolbar>
        <ng-content select="[searchShellStart]" />
        <ng-content select="[searchShellTitle]" />
        <ng-content select="[searchShellEnd]" />
      </ion-toolbar>
      <ion-toolbar>
        <ng-content select="[searchShellSearchbar]" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ng-content />
    </ion-content>

    @if (bottomAccessory()) {
      <ion-footer>
        <ng-content select="[libModalBottomAccessory]" />
      </ion-footer>
    }
  `,
})
export class SearchPickerShellComponent {
  protected readonly bottomAccessory = contentChild(ModalBottomAccessoryDirective);
}
```

**Projection slot contract:**

| Slot selector | Purpose | Required |
|---|---|---|
| `[searchShellStart]` | Header start slot: back button, close button, or nothing | No |
| `[searchShellTitle]` | Header title region | No |
| `[searchShellEnd]` | Header end slot: X close button or action button | No |
| `[searchShellSearchbar]` | Second toolbar row: the IonSearchbar | Yes |
| default (no selector) | Main content: result list, empty state, loading, error | Yes |
| `[libModalBottomAccessory]` | Footer slot: consumer-provided accessory (e.g. VP summary bar) | No |

**Key decisions:**

- The shell uses `contentChild(ModalBottomAccessoryDirective)` to detect whether bottom
  accessory content is projected. The `ion-footer` renders only when the directive is
  present. No boolean input needed.
- Two toolbar rows in the header: one for navigation controls (back/close), one for the
  searchbar. This matches Ionic's standard double-toolbar pattern for search pages.
- The shell does not provide IonSearchbar. The consumer provides it via the
  `[searchShellSearchbar]` slot. This allows consumers to configure searchbar properties
  (placeholder text, debounce, inputmode) without the shell needing pass-through inputs.

### 5.2 ModalBottomAccessoryDirective

**Location:** `search/ui/modal-bottom-accessory.directive.ts`

**Purpose:** Marker directive. Applied to projected content to identify it as the bottom
accessory region. The shell queries for this directive via `contentChild()` to decide
whether to render `ion-footer`.

```typescript
// search/ui/modal-bottom-accessory.directive.ts

import { Directive } from '@angular/core';

@Directive({
  selector: '[libModalBottomAccessory]',
})
export class ModalBottomAccessoryDirective {}
```

No logic. No inputs. No outputs. Pure structural marker.

**Why a directive instead of a boolean input:**
- Projection presence is the single source of truth.
- No risk of mismatch between `showFooter: true` but forgetting to project content.
- Consumers do not need to know about shell internals. They apply the directive to their
  accessory element. The shell detects it. Done.

### 5.3 SearchResultsListComponent

**Location:** `search/ui/search-results-list.component.ts`

**Purpose:** Renders the search result list, loading indicator, error message, no-results
message, and empty/initial state. Purely presentational. All data comes via inputs. All
user interactions are emitted via outputs.

```typescript
// search/ui/search-results-list.component.ts

import {
  Component, ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { IonList, IonSpinner, IonText } from '@ionic/angular/standalone';
import { SearchResult, RecentSearch } from '../data-access/search.models';
import { SearchResultRowComponent } from './search-result-row.component';
import { SearchEmptyStateComponent } from './search-empty-state.component';

@Component({
  selector: 'lib-search-results-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonList, IonSpinner, IonText, SearchResultRowComponent, SearchEmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="ion-text-center ion-padding">
        <ion-spinner name="crescent" aria-label="Searching..." />
      </div>
    }

    @if (showInitialState()) {
      <lib-search-empty-state
        [recents]="recents()"
        (recentSelected)="recentSelected.emit($event)"
        (recentRemoved)="recentRemoved.emit($event)"
      />
    }

    @if (noResults()) {
      <div class="ion-text-center ion-padding">
        <ion-text color="medium">
          <p>No results for "{{ query() }}"</p>
        </ion-text>
      </div>
    }

    @if (error(); as err) {
      <div class="ion-text-center ion-padding">
        <ion-text color="danger">
          <p>{{ err }}</p>
        </ion-text>
      </div>
    }

    @if (results().length > 0) {
      <ion-list>
        @for (result of results(); track result.ticker) {
          <lib-search-result-row
            [result]="result"
            (selected)="resultSelected.emit($event)"
          />
        }
      </ion-list>
    }
  `,
})
export class SearchResultsListComponent {
  // --- Inputs: all data from parent ---
  readonly results = input.required<readonly SearchResult[]>();
  readonly loading = input.required<boolean>();
  readonly error = input.required<string | null>();
  readonly query = input.required<string>();
  readonly noResults = input.required<boolean>();
  readonly showInitialState = input.required<boolean>();
  readonly recents = input.required<readonly RecentSearch[]>();

  // --- Outputs: all user events to parent ---
  readonly resultSelected = output<SearchResult>();
  readonly recentSelected = output<RecentSearch>();
  readonly recentRemoved = output<string>();
}
```

**Key decisions:**

- This component does NOT inject `SearchStore`. It receives all data via inputs.
  The feature layer is responsible for connecting store signals to these inputs.
- All seven inputs are required. The parent must supply them. This makes the data contract
  explicit and prevents runtime ambiguity.
- `noResults` and `showInitialState` are separate boolean inputs rather than computed
  internally. The store already computes these as signals. The parent passes them through.
  This keeps the UI component free of business logic about what "no results" means.

### 5.4 SearchResultRowComponent

**Location:** `search/ui/search-result-row.component.ts`

**Purpose:** Renders a single search result row: logo/avatar, ticker, name, instrument type
badge. Purely presentational.

```typescript
// search/ui/search-result-row.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IonItem, IonLabel, IonAvatar, IonBadge, IonImg } from '@ionic/angular/standalone';
import { SearchResult } from '../data-access/search.models';

@Component({
  selector: 'lib-search-result-row',
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
export class SearchResultRowComponent {
  readonly result = input.required<SearchResult>();
  readonly selected = output<SearchResult>();
}
```

**Extraction is optional.** If the row template remains simple (no custom styles, no
conditional rendering beyond the logo placeholder), the AI agent may inline the row
template directly into `SearchResultsListComponent` instead of creating a separate file.
Extract into its own component only when:
- The row template grows beyond trivial complexity (e.g. selection checkboxes, swipe actions)
- The same row rendering is needed outside the search results list (e.g. watchlist, holdings)
- The row has its own styles that should be encapsulated

Keeping a separate `SearchResultRowComponent` is the recommended default. Consolidate
later if it proves unnecessary.

### 5.5 SearchEmptyStateComponent

**Location:** `search/ui/search-empty-state.component.ts`

**Purpose:** Renders the initial/empty search state: recent searches list with swipe-to-delete,
or a placeholder message when no recents exist. Purely presentational.

```typescript
// search/ui/search-empty-state.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import {
  IonList, IonItem, IonLabel,
  IonItemSliding, IonItemOptions, IonItemOption, IonText,
} from '@ionic/angular/standalone';
import { RecentSearch } from '../data-access/search.models';

@Component({
  selector: 'lib-search-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonList, IonItem, IonLabel,
    IonItemSliding, IonItemOptions, IonItemOption, IonText,
  ],
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
  readonly recentRemoved = output<string>();
}
```

---

## 6. Content Projection Strategy

<!-- AGENT: This section explains HOW consumers use the shell and results list.
     Read Sections 6.3–6.4 to understand the usage patterns: how SearchPageComponent
     and VP modal compose the primitives you built in Section 5. -->

### 6.1 Slot Architecture

The `SearchPickerShellComponent` uses Angular's `ng-content` with `select` attributes to
define named projection regions. Consumers place their content inside the shell element and
use attribute selectors to target specific regions.

```
+-------------------------------------------------------+
| ion-header                                            |
|   toolbar 1: [searchShellStart] [title] [searchShellEnd] |
|   toolbar 2: [searchShellSearchbar]                   |
+-------------------------------------------------------+
| ion-content                                           |
|   (default ng-content -- result list goes here)       |
+-------------------------------------------------------+
| ion-footer (conditional -- only if accessory present) |
|   [libModalBottomAccessory]                           |
+-------------------------------------------------------+
```

### 6.2 Footer Conditional Rendering

The shell uses `contentChild(ModalBottomAccessoryDirective)` to detect projected accessory
content. This is a signal-based query (Angular 17.1+). When no accessory is projected, the
signal returns `undefined`, and the `@if` block skips the footer entirely. No DOM is
rendered for the footer.

```typescript
// Inside SearchPickerShellComponent
protected readonly bottomAccessory = contentChild(ModalBottomAccessoryDirective);

// In template
@if (bottomAccessory()) {
  <ion-footer>
    <ng-content select="[libModalBottomAccessory]" />
  </ion-footer>
}
```

This replaces any need for:
- `showFooter` input
- `footerTemplate` input
- `mode` input
- Feature flags for accessory visibility

### 6.3 Consumer Usage: Search Page (No Accessory)

```typescript
// search/feature/search-page.component.ts

template: `
  <lib-search-picker-shell>
    <ion-buttons searchShellStart>
      <ion-back-button [defaultHref]="defaultBackHref" />
    </ion-buttons>
    <ion-title searchShellTitle>Search</ion-title>

    <ion-searchbar
      searchShellSearchbar
      [debounce]="0"
      placeholder="Search stocks, crypto, ETFs..."
      (ionInput)="onQueryChange($event)"
      inputmode="search"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      aria-label="Search instruments"
    />

    <lib-search-results-list
      [results]="store.results()"
      [loading]="store.loading()"
      [error]="store.error()"
      [query]="store.query()"
      [noResults]="store.noResults()"
      [showInitialState]="store.showInitialState()"
      [recents]="store.recents()"
      (resultSelected)="onResultSelected($event)"
      (recentSelected)="onRecentSelected($event)"
      (recentRemoved)="store.removeRecent($event)"
    />
  </lib-search-picker-shell>
`
```

No accessory is projected. The shell detects this and does not render `ion-footer`.

### 6.4 Consumer Usage: VP Search Modal (With Accessory)

```typescript
// virtual-portfolio/feature/vp-search-picker-modal.component.ts

template: `
  <lib-search-picker-shell>
    <ion-buttons searchShellEnd>
      <ion-button (click)="close()">
        <ion-icon slot="icon-only" name="close" />
      </ion-button>
    </ion-buttons>
    <ion-title searchShellTitle>Add to Portfolio</ion-title>

    <ion-searchbar
      searchShellSearchbar
      [debounce]="0"
      placeholder="Search stocks, crypto, ETFs..."
      (ionInput)="onQueryChange($event)"
      inputmode="search"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      aria-label="Search instruments"
    />

    <lib-search-results-list
      [results]="store.results()"
      [loading]="store.loading()"
      [error]="store.error()"
      [query]="store.query()"
      [noResults]="store.noResults()"
      [showInitialState]="store.showInitialState()"
      [recents]="store.recents()"
      (resultSelected)="onResultSelected($event)"
      (recentSelected)="onRecentSelected($event)"
      (recentRemoved)="store.removeRecent($event)"
    />

    <div libModalBottomAccessory>
      <lib-vp-selection-summary-bar
        [selectedCount]="selectedCount()"
        [totalValue]="totalValue()"
        (confirm)="onConfirm()"
      />
    </div>
  </lib-search-picker-shell>
`
```

The `libModalBottomAccessory` directive marks the VP summary bar as the footer content.
The shell detects the directive and renders `ion-footer` around it.

---

## 7. Store and Provider Scoping

<!-- AGENT: Critical scoping rules. Every feature wrapper MUST provide SearchStore
     in its providers array. SearchStorageProvider is internal — never import it
     in feature or UI code. Read search.arch.md §5.1 and §5.3 for full store code. -->

### 7.1 Store Scoping Rule

`SearchStore` is feature-scoped. Each search session gets a fresh instance. The
wrapper component (page or modal) provides the store in its `providers` array:

```typescript
@Component({
  // ...
  providers: [SearchStore],
})
export class SearchPageComponent { /* ... */ }
```

When a consumer domain creates its own wrapper (e.g. `VpSearchPickerModalComponent`), that
wrapper provides the store the same way:

```typescript
@Component({
  // ...
  providers: [SearchStore],
})
export class VpSearchPickerModalComponent { /* ... */ }
```

This ensures:
- Fresh state per search session
- Automatic cleanup when the component is destroyed
- No cross-session state leakage
- Consumer does not need to manage store lifecycle

### 7.2 Recent Searches — StorageProvider Delegation

`SearchStore` exposes `recents()`, `recordRecentSearch()`, and `removeRecent()` — but it
does not own localStorage directly. Internally, the store delegates persistence to an
**internal root-scoped `SearchStorageProvider`**:

```
SearchStore (component-scoped)
  └── injects SearchStorageProvider (root-scoped singleton)
        └── owns localStorage read/write + _recents signal
```

**Why a separate provider?** The store is component-scoped (destroyed per session), but
recents must survive across sessions. A root-scoped `SearchStorageProvider` singleton holds
the `_recents` signal and its localStorage backing. Multiple `SearchStore` instances
(page + modal) share the same provider — when one store records a recent search, all
stores see the update reactively through the provider's signal.

**Feature components inject only `SearchStore`.** The `SearchStorageProvider` is internal to
the `data-access` layer and is not exported in the public API. No feature or consumer
component ever imports or injects it directly.

See `search.arch.md` Section 5.1 and 5.3 for the full implementation.

### 7.3 UI Components Must Not Provide or Inject the Store

UI components in `search/ui` do not inject `SearchStore`.
They receive all data via inputs. This keeps them:
- Testable without store setup
- Reusable without provider dependencies
- Decoupled from the data layer

The feature layer is the single integration point between store and UI.

---

## 8. Search Page Composition

<!-- AGENT: Sections 8.2 and 8.3 contain the complete feature component implementations
     for Steps 6 and 7. Copy the code exactly. These components compose the UI primitives
     you created in Steps 1–5. -->

### 8.1 Composition Overview

`SearchPageComponent` and `SearchModalComponent` compose `search/ui` primitives instead of
containing inline layout. Each feature component:
- Provides `SearchStore` in its `providers`
- Uses `SearchPickerShellComponent` for layout (header, searchbar, content, optional footer)
- Uses `SearchResultsListComponent` for result/loading/error/empty rendering
- Wires store signals to inputs and user events to store methods / navigation

### 8.2 SearchPageComponent

```typescript
// search/feature/search-page.component.ts

import {
  Component, ChangeDetectionStrategy, inject,
} from '@angular/core';
import {
  IonButtons, IonBackButton, IonTitle, IonSearchbar,
} from '@ionic/angular/standalone';
import { NavController } from '@ionic/angular/standalone';
import { SearchStore } from '../data-access/search.store';
import { SearchResult, RecentSearch } from '../data-access/search.models';
import { SearchPickerShellComponent } from '../ui/search-picker-shell.component';
import { SearchResultsListComponent } from '../ui/search-results-list.component';

@Component({
  selector: 'lib-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButtons, IonBackButton, IonTitle, IonSearchbar,
    SearchPickerShellComponent, SearchResultsListComponent,
  ],
  providers: [SearchStore],
  template: `
    <lib-search-picker-shell>
      <ion-buttons searchShellStart>
        <ion-back-button [defaultHref]="defaultBackHref" />
      </ion-buttons>
      <ion-title searchShellTitle>Search</ion-title>

      <ion-searchbar
        searchShellSearchbar
        [debounce]="0"
        placeholder="Search stocks, crypto, ETFs..."
        (ionInput)="onQueryChange($event)"
        inputmode="search"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        aria-label="Search instruments"
      />

      <lib-search-results-list
        [results]="store.results()"
        [loading]="store.loading()"
        [error]="store.error()"
        [query]="store.query()"
        [noResults]="store.noResults()"
        [showInitialState]="store.showInitialState()"
        [recents]="store.recents()"
        (resultSelected)="onResultSelected($event)"
        (recentSelected)="onRecentSelected($event)"
        (recentRemoved)="store.removeRecent($event)"
      />
    </lib-search-picker-shell>
  `,
})
export class SearchPageComponent {
  protected readonly store = inject(SearchStore);
  private readonly navCtrl = inject(NavController);

  // Derive from current tab context or route data
  protected readonly defaultBackHref = '/tabs/portfolio';

  protected onQueryChange(event: CustomEvent): void {
    const query = (event.detail.value as string | null) ?? '';
    this.store.search(query);
  }

  protected onResultSelected(result: SearchResult): void {
    this.store.recordRecentSearch(result);
    this.navCtrl.navigateForward(['/tabs/portfolio/asset', result.ticker]);
  }

  protected onRecentSelected(recent: RecentSearch): void {
    const result: SearchResult = {
      ticker: recent.ticker,
      name: recent.name,
      instrumentType: recent.instrumentType,
      logoUrl: recent.logoUrl,
      exchange: '',
    };
    this.onResultSelected(result);
  }
}
```

### 8.3 SearchModalComponent

```typescript
// search/feature/search-modal.component.ts

import {
  Component, ChangeDetectionStrategy, inject,
} from '@angular/core';
import {
  IonButtons, IonButton, IonIcon, IonTitle, IonSearchbar,
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { SearchStore } from '../data-access/search.store';
import { SearchResult, RecentSearch } from '../data-access/search.models';
import { SearchPickerShellComponent } from '../ui/search-picker-shell.component';
import { SearchResultsListComponent } from '../ui/search-results-list.component';

@Component({
  selector: 'lib-search-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButtons, IonButton, IonIcon, IonTitle, IonSearchbar,
    SearchPickerShellComponent, SearchResultsListComponent,
  ],
  providers: [SearchStore],
  template: `
    <lib-search-picker-shell>
      <ion-title searchShellTitle>Search</ion-title>
      <ion-buttons searchShellEnd>
        <ion-button (click)="close()">
          <ion-icon slot="icon-only" name="close" />
        </ion-button>
      </ion-buttons>

      <ion-searchbar
        searchShellSearchbar
        [debounce]="0"
        placeholder="Search stocks, crypto, ETFs..."
        (ionInput)="onQueryChange($event)"
        inputmode="search"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        aria-label="Search instruments"
      />

      <lib-search-results-list
        [results]="store.results()"
        [loading]="store.loading()"
        [error]="store.error()"
        [query]="store.query()"
        [noResults]="store.noResults()"
        [showInitialState]="store.showInitialState()"
        [recents]="store.recents()"
        (resultSelected)="onResultSelected($event)"
        (recentSelected)="onRecentSelected($event)"
        (recentRemoved)="store.removeRecent($event)"
      />
    </lib-search-picker-shell>
  `,
})
export class SearchModalComponent {
  protected readonly store = inject(SearchStore);
  private readonly modalCtrl = inject(ModalController);

  protected onQueryChange(event: CustomEvent): void {
    const query = (event.detail.value as string | null) ?? '';
    this.store.search(query);
  }

  protected onResultSelected(result: SearchResult): void {
    this.store.recordRecentSearch(result);
    this.modalCtrl.dismiss(result, 'select');
  }

  protected onRecentSelected(recent: RecentSearch): void {
    const result: SearchResult = {
      ticker: recent.ticker,
      name: recent.name,
      instrumentType: recent.instrumentType,
      logoUrl: recent.logoUrl,
      exchange: '',
    };
    this.onResultSelected(result);
  }

  protected close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
```

---

## 9. Consumer Composition Pattern (VP Example)

<!-- AGENT: This section is a REFERENCE PATTERN for consumer domains. You do NOT build
     VP components as part of the search domain. Read this to understand how consumers
     will use the primitives you built in Sections 5 and 8. -->

This section demonstrates how Virtual Portfolio composes search primitives with its own
domain-specific UI. This is the reference pattern for any consumer domain.

### 9.1 VP File Structure

```
libs/invest-app/virtual-portfolio/
├── feature/
│   └── vp-search-picker-modal.component.ts   # VP-owned modal wrapper
├── ui/
│   └── vp-selection-summary-bar.component.ts  # VP-owned summary bar
└── data-access/
    └── ...                                     # VP store, models (not search-related)
```

### 9.2 VpSearchPickerModalComponent

**Location:** `virtual-portfolio/feature/vp-search-picker-modal.component.ts`

**Owns:**
- Modal lifecycle (opened via ModalController by VP flow)
- Store provision (provides SearchStore)
- Composition of search shell + results list + VP summary bar
- Custom selection logic (multi-select for VP, single-select for default search)
- Confirm CTA behavior

**Does not own:**
- Search query/result logic (delegated to SearchStore)
- Layout rendering (delegated to SearchPickerShellComponent)
- Result row rendering (delegated to SearchResultRowComponent via SearchResultsListComponent)

```typescript
// virtual-portfolio/feature/vp-search-picker-modal.component.ts

import {
  Component, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import {
  IonButtons, IonButton, IonIcon, IonTitle, IonSearchbar,
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { SearchStore, SearchResult, RecentSearch } from '@invest-app/search/data-access';
import { SearchPickerShellComponent } from '@invest-app/search/ui';
import { SearchResultsListComponent } from '@invest-app/search/ui';
import { ModalBottomAccessoryDirective } from '@invest-app/search/ui';
import { VpSelectionSummaryBarComponent } from '../ui/vp-selection-summary-bar.component';

@Component({
  selector: 'lib-vp-search-picker-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonButtons, IonButton, IonIcon, IonTitle, IonSearchbar,
    SearchPickerShellComponent, SearchResultsListComponent,
    ModalBottomAccessoryDirective, VpSelectionSummaryBarComponent,
  ],
  providers: [SearchStore],
  template: `
    <lib-search-picker-shell>
      <ion-title searchShellTitle>Add to Portfolio</ion-title>
      <ion-buttons searchShellEnd>
        <ion-button (click)="close()">
          <ion-icon slot="icon-only" name="close" />
        </ion-button>
      </ion-buttons>

      <ion-searchbar
        searchShellSearchbar
        [debounce]="0"
        placeholder="Search stocks, crypto, ETFs..."
        (ionInput)="onQueryChange($event)"
        inputmode="search"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        aria-label="Search instruments"
      />

      <lib-search-results-list
        [results]="store.results()"
        [loading]="store.loading()"
        [error]="store.error()"
        [query]="store.query()"
        [noResults]="store.noResults()"
        [showInitialState]="store.showInitialState()"
        [recents]="store.recents()"
        (resultSelected)="onResultSelected($event)"
        (recentSelected)="onRecentSelected($event)"
        (recentRemoved)="store.removeRecent($event)"
      />

      <div libModalBottomAccessory>
        <lib-vp-selection-summary-bar
          [selectedCount]="selectedInstruments().length"
          (confirm)="onConfirm()"
        />
      </div>
    </lib-search-picker-shell>
  `,
})
export class VpSearchPickerModalComponent {
  protected readonly store = inject(SearchStore);
  private readonly modalCtrl = inject(ModalController);

  protected readonly selectedInstruments = signal<readonly SearchResult[]>([]);

  protected onQueryChange(event: CustomEvent): void {
    const query = (event.detail.value as string | null) ?? '';
    this.store.search(query);
  }

  protected onResultSelected(result: SearchResult): void {
    // VP uses additive selection (toggle instrument in/out of selection list)
    this.selectedInstruments.update(current => {
      const exists = current.some(r => r.ticker === result.ticker);
      return exists
        ? current.filter(r => r.ticker !== result.ticker)
        : [...current, result];
    });
  }

  protected onRecentSelected(recent: RecentSearch): void {
    const result: SearchResult = {
      ticker: recent.ticker,
      name: recent.name,
      instrumentType: recent.instrumentType,
      logoUrl: recent.logoUrl,
      exchange: '',
    };
    this.onResultSelected(result);
  }

  protected onConfirm(): void {
    this.modalCtrl.dismiss(this.selectedInstruments(), 'confirm');
  }

  protected close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
```

### 9.3 VpSelectionSummaryBarComponent

**Location:** `virtual-portfolio/ui/vp-selection-summary-bar.component.ts`

This component belongs entirely to VP. It is NOT in the search domain.

```typescript
// virtual-portfolio/ui/vp-selection-summary-bar.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IonToolbar, IonButton, IonText } from '@ionic/angular/standalone';

@Component({
  selector: 'lib-vp-selection-summary-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonToolbar, IonButton, IonText],
  template: `
    <ion-toolbar>
      <ion-text slot="start">
        {{ selectedCount() }} selected
      </ion-text>
      <ion-button
        slot="end"
        [disabled]="selectedCount() === 0"
        (click)="confirm.emit()"
      >
        Confirm
      </ion-button>
    </ion-toolbar>
  `,
})
export class VpSelectionSummaryBarComponent {
  readonly selectedCount = input.required<number>();
  readonly confirm = output<void>();
}
```

### 9.4 Why This Works

- Search domain knows nothing about VP, selections, or confirm CTAs.
- VP composes search primitives and injects its own footer via projection.
- The shell renders the footer because the `libModalBottomAccessory` directive is detected.
- If another domain (e.g. Watchlist) needs a different footer, it builds its own wrapper
  the same way. Search domain is unchanged.

---

## 10. Implementation Sequence

<!-- AGENT: Track progress using the Progress Checklist at the top of this document.
     The details below expand each step with specific test expectations. -->

> **Refer to the Progress Checklist** at the top of this document to track which steps
> are done. The details below provide test expectations for each step.

Each step is independently testable. Complete them in order.

### Phase 1: Create New UI Primitives

**Step 1: ModalBottomAccessoryDirective**

Create `search/ui/modal-bottom-accessory.directive.ts` with the marker directive from
Section 5.2. No tests needed -- it is a pure structural marker with zero logic.

**Step 2: SearchPickerShellComponent**

Create `search/ui/search-picker-shell.component.ts` with the shell from Section 5.1.

Test:
- Renders projected header start/end content
- Renders projected searchbar
- Renders default projected content
- Does NOT render `ion-footer` when no `libModalBottomAccessory` is projected
- Renders `ion-footer` when `libModalBottomAccessory` content is projected

**Step 3: SearchResultRowComponent**

Create `search/ui/search-result-row.component.ts` per Section 5.4.

Test:
- Renders ticker, name, instrument type badge
- Renders logo image when logoUrl is provided
- Renders placeholder letter when logoUrl is null
- Emits selected output on click

### Phase 2: Create SearchResultsListComponent

**Step 4: SearchResultsListComponent**

Create `search/ui/search-results-list.component.ts` per Section 5.3.

Key properties:
- Does NOT inject `SearchStore`
- All data via `input.required()`
- All events via `output()`
- Uses `SearchResultRowComponent` for row rendering

Test:
- Renders spinner when `loading` is true
- Renders empty state when `showInitialState` is true
- Renders "no results" message when `noResults` is true and includes query text
- Renders error message when `error` is non-null
- Renders result rows when `results` has items
- Emits `resultSelected` when a row is tapped
- Emits `recentSelected` when a recent item is tapped
- Emits `recentRemoved` when a recent item is swiped to delete

**Step 5: SearchEmptyStateComponent**

Create `search/ui/search-empty-state.component.ts` per Section 5.5. Uses `input()`/`output()`
exclusively. See Section 5.5 for the target contract.

### Phase 3: Compose Feature Components

**Step 6: SearchPageComponent**

Implement `search/feature/search-page.component.ts` per Section 8.2:
- Import `SearchPickerShellComponent` and `SearchResultsListComponent`
- Provide `SearchStore` in component providers
- Wire store signals to `SearchResultsListComponent` inputs
- Wire `SearchResultsListComponent` outputs to store methods and navigation

Test:
- Page renders shell with back button and title
- Searchbar input triggers `store.search()`
- Result selection records recent search and navigates to PDP
- Recent selection navigates to PDP
- Recent removal calls `store.removeRecent()`

**Step 7: SearchModalComponent**

Implement `search/feature/search-modal.component.ts` per Section 8.3:
- Same composition as search page but with X close button in end slot
- Result selection dismisses modal with result data
- Close button dismisses modal with null

Test:
- Modal renders shell with close button
- Result selection dismisses modal with result data and 'select' role
- Close button dismisses modal with null and 'cancel' role

### Phase 4: Validate

**Step 8: End-to-End Verification**

- Search page: type query, see results, tap result, navigate to PDP, back returns to search
- Search modal: open modal, type query, tap result, modal dismisses, PDP rendered
- Recent searches: tap recent, navigate to PDP, swipe to delete recent
- Empty state: no query shows recents or placeholder
- Error state: simulate API error, see inline error message
- Loading state: spinner appears during search

**Step 9: Export Verification**

`search/ui` public API exports:
- `SearchPickerShellComponent`
- `SearchResultsListComponent`
- `SearchResultRowComponent`
- `SearchEmptyStateComponent`
- `ModalBottomAccessoryDirective`

---

## 11. Validation Checklist

<!-- AGENT: Run this checklist AFTER completing all implementation steps (Steps 1–9).
     Every box must pass. If any fails, fix it before marking Step 10 complete. -->

> **Run after all implementation steps are complete.** Every box must pass.

Use this checklist to verify the implementation is complete and correct.

### Architectural Compliance

- [ ] No UI component in `search/ui` injects `SearchStore`
- [ ] No UI component in `search/ui` injects `NavController` or `ModalController`
- [ ] All UI components use `input()` / `output()` for data flow
- [ ] All UI components use `ChangeDetectionStrategy.OnPush`
- [ ] All UI components are standalone (Angular 20+ default; do NOT set `standalone: true` explicitly)
- [ ] Feature components provide `SearchStore` in their own `providers`
- [ ] `SearchPickerShellComponent` has zero consumer-specific inputs or knowledge
- [ ] `ModalBottomAccessoryDirective` has zero inputs, outputs, or logic
- [ ] Footer renders only when accessory content is projected (no boolean flag)

### Functional Correctness

- [ ] Search page works: query → results → select → PDP
- [ ] Search modal works: query → results → select → dismiss with data
- [ ] IonSearchbar debounce is `0` (store owns debounce at 250ms)
- [ ] `switchMap` cancellation still works (type fast, only last query resolves)
- [ ] Recent searches display on initial state
- [ ] Recent search swipe-to-delete works
- [ ] Error state renders inline, does not block input
- [ ] Loading spinner appears during search

### Nx Boundary Compliance

- [ ] `search/ui` has no dependency on `search/feature`
- [ ] `search/feature` depends on `search/ui` and `search/data-access`
- [ ] Consumer domains depend on `search/ui` and `search/data-access` only
- [ ] No circular dependencies between search sub-libraries

### Consumer Readiness

- [ ] `SearchPickerShellComponent` is exported from `search/ui`
- [ ] `SearchResultsListComponent` is exported from `search/ui`
- [ ] `SearchResultRowComponent` is exported from `search/ui`
- [ ] `SearchEmptyStateComponent` is exported from `search/ui`
- [ ] `ModalBottomAccessoryDirective` is exported from `search/ui`
- [ ] A consumer can compose shell + results + custom accessory without importing `search/feature`

---

## References

- Search feature architecture: `docs/guides/search.arch.md`
- Navigation patterns: `docs/ionic-angular/ionic-angular-navigation.md` Section 6
- NgRx Signals conventions: `docs/copilot-samples/instructions/ngrx-signals.instructions.md`
- Architecture rules: `docs/ngrx-signals/fundamentals/05-architecture-rules.md`
- TypeScript coding rules: `.github/instructions/typescript.instructions.md`
