---
applyTo: "**/*.ts"
---

# NgRx Signals Instructions

Custom instructions for implementing state management with NgRx Signals in Angular projects.

This document covers SignalStore, SignalState, signalMethod, rxMethod, entity management, Events plugin, and related utilities from the @ngrx/signals package.

---

## Architecture Rules (Non-negotiable)

### Layering

- UI (page/component) MUST NOT call API clients directly.
- Stores MUST NOT import generated OpenAPI clients directly.
- Stores call Repositories only.
- Repositories call `data-source/project-api/client.ts`, which wraps generated API clients.

Data Flow: UI -> Store -> Repository -> API Client -> OpenAPI

### Store is UI-agnostic

- Stores never call: ToastController, AlertController, Router navigation, modal/sheet controllers.
- Stores expose state; UI decides toast/banner/navigation.

### Public API

- Store exposes readonly signals + methods.
- No external `patchState` (mutation is store-owned).
- By default, SignalStore state is protected from external modifications.

### Nx Boundaries

- `domain/data-access`: stores + repositories (+ any domain DTO mapping).
- `domain/feature-*`: consumes stores; does not define them.
- Avoid circular dependencies. Enforce direction in dependency graph.

---

## NgRx Signals Utilities

### Core SignalStore

Use these for every domain store:

- `signalStore` - creates an injectable store service
- `withState` - adds state slices to the store
- `withComputed` - adds computed signals derived from state
- `withMethods` - adds methods for state updates and side effects
- `patchState` - updates store state immutably
- `getState` - retrieves current state snapshot

### SignalState (Lightweight Alternative)

Use `signalState` for simple component-level state that does not need injection:

```ts
import { signalState, patchState } from '@ngrx/signals';

const state = signalState({ count: 0, loading: false });
patchState(state, { count: 1 });
```

### RxJS Integration for Side Effects

Use these when you have IO / concurrency / cancellation needs:

- `rxMethod` from `@ngrx/signals/rxjs-interop` for side effects (HTTP, SSE/WebSocket, polling, retries).
- `tapResponse({ next, error, finalize })` from `@ngrx/operators` for consistent success/error/finalize handling.

Rule: Do not manually `subscribe()` in stores for API calls. Use `rxMethod`.

### signalMethod (Signal-driven Side Effects Without RxJS)

Use `signalMethod` from `@ngrx/signals` when:

- The side effect is local/lightweight and you do not need RxJS operators.
- Bundle size matters and you can accept simpler concurrency behavior.
- You want explicit tracking of signal dependencies.

```ts
import { signalMethod } from '@ngrx/signals';

readonly logValue = signalMethod<number>((num) => {
  console.log('Value:', num);
});

// Can be called with static value, signal, or computation function
this.logValue(42);
this.logValue(someSignal);
this.logValue(() => a() + b());
```

Rule: If you need robust race-condition handling (search typing, cancellation, concurrency control) use `rxMethod` (RxJS is better for that).

### Lifecycle Hooks (withHooks)

Use `withHooks({ onInit, onDestroy })` when:

- Store should auto-load on creation (only for truly global essentials).
- Store needs cleanup (stop streaming, cancel timers/polling, reset transient state).
- You need to set up effects or subscriptions that run within injection context.

```ts
withHooks({
  onInit(store) {
    // Runs in injection context - can use takeUntilDestroyed()
    interval(2_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => store.increment());
  },
  onDestroy(store) {
    console.log('Store destroyed, final count:', store.count());
  },
})
```

### Entity Management (withEntities)

Use `@ngrx/signals/entities` + `withEntities()` when:

- You manage collections that need frequent updates and dedup by id.
- You want efficient updates (upsert/update/remove by id) without rebuilding arrays.
- You want stable identity for performance.

Entity updaters available:

- `addEntity`, `addEntities`, `prependEntity`, `prependEntities`
- `setEntity`, `setEntities`, `setAllEntities`
- `updateEntity`, `updateEntities`, `updateAllEntities`
- `upsertEntity`, `upsertEntities`
- `removeEntity`, `removeEntities`, `removeAllEntities`

```ts
import { withEntities, addEntity, updateEntity, removeEntity } from '@ngrx/signals/entities';

export const TodosStore = signalStore(
  withEntities<Todo>(),
  withMethods((store) => ({
    addTodo(todo: Todo) {
      patchState(store, addEntity(todo));
    },
    toggleTodo(id: number) {
      patchState(store, updateEntity({
        id,
        changes: (todo) => ({ completed: !todo.completed })
      }));
    },
  }))
);
```

For custom entity identifiers, use `selectId`:

```ts
const selectId: SelectEntityId<Todo> = (todo) => todo.key;
patchState(store, addEntities(todos, { selectId }));
```

For named collections:

```ts
withEntities({ entity: type<Todo>(), collection: 'todo' })
// Creates: todoIds, todoEntityMap, todoEntities
```

### Custom Store Features

When you repeat patterns across stores, extract them using `signalStoreFeature`:

- `withRequestStatus()` (loading/error/pending/fulfilled states)
- `withCacheTTL()` (lastUpdated + stale detection)
- `withSelectedEntity()` (selected entity from collection)
- `withLogger()` (state change logging)

```ts
import { signalStoreFeature, withState, withComputed } from '@ngrx/signals';

export type RequestStatus = 'idle' | 'pending' | 'fulfilled' | { error: string };

export function withRequestStatus() {
  return signalStoreFeature(
    withState<{ requestStatus: RequestStatus }>({ requestStatus: 'idle' }),
    withComputed(({ requestStatus }) => ({
      isPending: computed(() => requestStatus() === 'pending'),
      isFulfilled: computed(() => requestStatus() === 'fulfilled'),
      error: computed(() => {
        const status = requestStatus();
        return typeof status === 'object' ? status.error : null;
      }),
    }))
  );
}

// State updaters as standalone functions (tree-shakable)
export function setPending(): { requestStatus: RequestStatus } {
  return { requestStatus: 'pending' };
}

export function setFulfilled(): { requestStatus: RequestStatus } {
  return { requestStatus: 'fulfilled' };
}
```

For features with input requirements, use `type` helper:

```ts
export function withSelectedEntity<Entity>() {
  return signalStoreFeature(
    { state: type<EntityState<Entity>>() },
    withState<{ selectedEntityId: EntityId | null }>({ selectedEntityId: null }),
    withComputed(({ entityMap, selectedEntityId }) => ({
      selectedEntity: computed(() => {
        const id = selectedEntityId();
        return id ? entityMap()[id] : null;
      }),
    }))
  );
}
```

### Events Plugin (Decoupled Communication)

Use `@ngrx/signals/events` when:

- You need decoupled orchestration without store injection.
- Cross-store workflows are common (login/logout, session hydration, global resets).
- You want Redux-like event-driven architecture.

```ts
import { event, eventGroup, type } from '@ngrx/signals';
import { withReducer, withEventHandlers, on, Events, Dispatcher } from '@ngrx/signals/events';

// Define events
export const bookSearchEvents = eventGroup({
  source: 'Book Search Page',
  events: {
    opened: type<void>(),
    queryChanged: type<string>(),
  },
});

// Handle state transitions
export const BookSearchStore = signalStore(
  withState({ query: '', books: [], isLoading: false }),
  withReducer(
    on(bookSearchEvents.opened, () => ({ isLoading: true })),
    on(bookSearchEvents.queryChanged, ({ payload: query }) => ({ query, isLoading: true })),
  ),
  withEventHandlers((store, events = inject(Events), booksService = inject(BooksService)) => ({
    loadBooks$: events.on(bookSearchEvents.queryChanged).pipe(
      switchMap(({ payload: query }) => booksService.getByQuery(query).pipe(
        mapResponse({
          next: (books) => booksApiEvents.loadedSuccess(books),
          error: (error) => booksApiEvents.loadedFailure(error.message),
        })
      ))
    ),
  }))
);

// Dispatch events from component
@Component({ /* ... */ })
export class BookSearch {
  readonly dispatch = injectDispatch(bookSearchEvents);

  onQueryChange(query: string) {
    this.dispatch.queryChanged(query);
  }
}
```

Guidelines:

- Keep domain stores focused; events layer orchestrates.
- Do not replace every store-to-store dependency with Events.
- Use Events for cross-cutting system flows.
- Use scoped events (`provideDispatcher()`) for feature isolation.

### Additional Utilities

- `withProps` - add static properties, observables, dependencies to store
- `withFeature` - alternative approach for features with external inputs
- `deepComputed` - create deep computed signals for nested state
- `linkedState` - create state linked to external signals
- `getState` - get current state snapshot from store

---

## Store Placement and Scope

### Global Domain Store (providedIn: 'root')

Use when state is shared across tabs/screens and should persist:

- `ProfileStore` (identity + account context)
- `PortfolioStore` (accounts/positions summaries)
- `WatchlistStore` (collection, used widely)
- `FeatureFlagsStore` / `SessionStore` (cross-cutting)

### Feature/Flow-scoped Store (provided at route/feature)

Use when state should reset on exit:

- Onboarding stepper
- Transient search results store (while keeping search history global)
- Form wizard state

Rule: Favor global for shared read models; favor feature scope for transient flows and heavy temporary state.

---

## Store-to-Store Communication

### Mental Model

- Some stores are Context Stores: they own global truth needed by many domains (Profile/Session/FeatureFlags).
- Other stores consume context to perform domain work (Trading, Transfers, Orders, etc.).

### Pattern A: Read Context Signals from Another Store (default)

Use when you need shared context (accountNumber, userId, featureFlags) reactively.

```ts
withMethods((store, profile = inject(ProfileStore)) => ({
  load: rxMethod<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() => {
        const accountId = profile.accountId();
        if (!accountId) return EMPTY;
        return repo.getData$(accountId);
      })
    )
  ),
}))
```

Rules:

- Store B MUST NOT mutate Store A.
- Keep clear dependency direction (Context Stores can be depended on by many stores).
- Never create circular dependencies.

### Pattern B: Pass Context as Method Parameters

Use when the caller already has the value and the dependency is one-off.

```ts
// UI passes context
store.previewOrder({ accountNumber: profileStore.accountNumber(), symbol: 'AAPL' });
```

Benefit: TradingStore does not depend on ProfileStore.

### Pattern C: Events (Decoupled Orchestration)

Use when many stores need to react to a cross-cutting event without direct store injection.

Examples:

- "login succeeded" -> load profile + hydrate watchlist + load portfolio
- "logout" -> reset multiple stores

### Guarding Missing Context (mandatory)

If a store requires context (like accountNumber):

- Expose `missingContext` / `canRun` computed signals (or return early in methods).
- Never call repository with incomplete context.
- UI should handle missing context (routing to onboarding or showing message).

```ts
withComputed((store, profile = inject(ProfileStore)) => ({
  canLoad: computed(() => !!profile.accountId()),
  missingContext: computed(() => !profile.accountId() ? 'Account ID required' : null),
}))
```

---

## Canonical Async State Pattern

Standardize async state so UI is trivial and consistent:

```ts
interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  lastUpdated: number | null; // optional
}
```

Rule: Always clear loading in `finalize` (avoid stuck spinners).

---

## Canonical Store Template

```ts
import { inject, computed } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { switchMap, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';

import { FooRepository } from './foo.repository';
import { ProfileStore } from '../profile/profile.store';

export interface FooState {
  loading: boolean;
  error: string | null;
  data: FooModel | null;
  lastUpdated: number | null;
}

const initialState: FooState = {
  loading: false,
  error: null,
  data: null,
  lastUpdated: null,
};

export const FooStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    hasData: computed(() => !!store.data()),
    isEmpty: computed(() => !store.loading() && !store.data()),
  })),

  withMethods((store, repo = inject(FooRepository), profile = inject(ProfileStore)) => ({
    load: rxMethod<void>((trigger$) =>
      trigger$.pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() => {
          const accountNumber = profile.accountNumber?.() ?? null;
          if (!accountNumber) return EMPTY;

          return repo.getFoo$({ accountNumber }).pipe(
            tapResponse({
              next: (data) => patchState(store, { data, lastUpdated: Date.now() }),
              error: (e) => patchState(store, { error: normalizeError(e) }),
              finalize: () => patchState(store, { loading: false }),
            })
          );
        })
      )
    ),

    reset() {
      patchState(store, initialState);
    },
  })),

  withHooks({
    onInit(store) {
      // Only auto-load if this store is truly global essential.
      // store.load();
    },
    onDestroy(store) {
      // Cleanup streams/polling/reset transient state if needed.
    },
  })
);

function normalizeError(e: unknown): string {
  if (e && typeof e === 'object') {
    if ('error' in e && e.error && typeof e.error === 'object' && 'message' in e.error) {
      return String(e.error.message);
    }
    if ('message' in e) {
      return String(e.message);
    }
  }
  return 'Unexpected error';
}
```

---

## Concurrency Playbook

Choose operator by user intent:

### switchMap - "latest wins"

Use for:

- Search typing
- Refresh / pull-to-refresh
- "Replace results" requests

Behavior: Cancels previous request.

### exhaustMap - "ignore while busy"

Use for:

- Submit profile
- Place trade order
- Any action where double-tap should NOT run concurrently

Behavior: Ignores new triggers until current completes.

### concatMap - "queue"

Use for:

- Sequential writes that must preserve ordering

Behavior: Queues requests.

### mergeMap - "parallel"

Use for:

- Independent loads that can happen concurrently

Warning: Results can arrive out of order; patching must be safe.

---

## Sequential APIs (A -> X -> B -> Y)

Common pattern: call A to obtain X, then call B using X.

Guidelines:

- Use `switchMap` if "latest wins" (query changed, user navigated).
- Use `concatMap` if every chain must complete in order.
- Use `exhaustMap` for submit flows.

Implementation approach:

- In a single rxMethod pipeline: A -> switch/concat -> B -> patch.
- For parallel dependencies: use `forkJoin` (one-time) instead of `combineLatest`.

---

## Repository Boundary Rules

Repository:

- Is the IO boundary.
- Calls `data-source/project-api/client.ts` and API client.
- Returns typed `Observable<T>`: `get$`, `create$`, `update$`, `delete$`.
- May do transport-level DTO mapping.

Store:

- Orchestrates repository calls via `rxMethod`.
- Owns loading/error/data signals.
- Never imports API client.

---

## Entity Management Playbook

Use `withEntities()` when:

- Collections update frequently (add/remove/update).
- You need dedup/caching by id.
- You need stable identity for performance.

Rules:

- Keep normalized entity state.
- Build view models using computed signals (map/sort/filter).
- Prefer entity updaters for mutation operations (upsert/update/remove).

```ts
export const TodosStore = signalStore(
  withEntities<Todo>(),
  withComputed(({ entities }) => ({
    completedTodos: computed(() => entities().filter(t => t.completed)),
    activeTodos: computed(() => entities().filter(t => !t.completed)),
    todosCount: computed(() => entities().length),
  })),
  withMethods((store) => ({
    setTodos(todos: Todo[]) {
      patchState(store, setAllEntities(todos));
    },
    addTodo(todo: Todo) {
      patchState(store, addEntity(todo));
    },
    toggleTodo(id: number) {
      patchState(store, updateEntity({
        id,
        changes: (todo) => ({ completed: !todo.completed }),
      }));
    },
    removeTodo(id: number) {
      patchState(store, removeEntity(id));
    },
    clearCompleted() {
      patchState(store, removeEntities((todo) => todo.completed));
    },
  }))
);
```

---

## UI Side Effects: Toast, Banners, Navigation

Store:

- Exposes `error()`, `loading()`, optional `success()` markers if needed.

UI:

- Preferred: template-driven bindings.
- Acceptable: `effect()` in component for UI-only side effects.

Rule: UI-only effects are fine in UI layer; never in store.

```ts
// Component
export class MyComponent {
  readonly store = inject(MyStore);

  constructor() {
    effect(() => {
      const error = this.store.error();
      if (error) {
        this.toastService.showError(error);
      }
    });
  }
}
```

---

## PR Checklist (Review Gate)

- [ ] UI does not call repository/OpenAPI
- [ ] Store calls repository only
- [ ] API calls use rxMethod + tapResponse + finalize
- [ ] Correct concurrency operator chosen
- [ ] Derived state is computed; no redundant state
- [ ] Entities used where collections need frequent updates
- [ ] withHooks used for init/cleanup when needed
- [ ] Store is UI-agnostic (no UI controllers/router)
- [ ] Store-to-store communication follows Pattern A/B/C and avoids cycles
- [ ] State protected from external modification (default behavior)
- [ ] Custom features extracted for repeated patterns

---

## References

- [NgRx SignalStore](https://ngrx.io/guide/signals/signal-store)
- [NgRx SignalState](https://ngrx.io/guide/signals/signal-state)
- [NgRx signalMethod](https://ngrx.io/guide/signals/signal-method)
- [NgRx RxJS Integration](https://ngrx.io/guide/signals/rxjs-integration)
- [NgRx Lifecycle Hooks](https://ngrx.io/guide/signals/signal-store/lifecycle-hooks)
- [NgRx Entity Management](https://ngrx.io/guide/signals/signal-store/entity-management)
- [NgRx Custom Store Features](https://ngrx.io/guide/signals/signal-store/custom-store-features)
- [NgRx Events Plugin](https://ngrx.io/guide/signals/signal-store/events)
- [NgRx Testing](https://ngrx.io/guide/signals/signal-store/testing)
