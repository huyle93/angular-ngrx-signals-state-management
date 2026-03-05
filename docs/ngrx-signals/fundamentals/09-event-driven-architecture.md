# Event-Driven Architecture with NgRx Signals

The Events plugin extends SignalStore with a lightweight, Flux-inspired event layer. It separates **what happened** (events) from **how the system reacts** (reducers and event handlers), enabling decoupled coordination across stores without the boilerplate of traditional Redux.

**Prerequisite:** Read [07-events-and-side-effects.md](07-events-and-side-effects.md) first. If Levels 1–2 solve your problem, stop there. This guide is for when they don't.

---

## When Events Earn Their Place

Events add indirection. Indirection has a cost. Use events only when:

| Signal | Why |
|--------|-----|
| 3+ stores react to the same occurrence | Direct injection creates a fan-out dependency |
| Cross-domain workflows (login, logout, session reset) | No single store should own the coordination |
| You need to add reactors without modifying the source | Open/closed principle at the store level |
| State transitions must be auditable and pure | Reducers provide a clear, testable state machine |
| Micro-frontends or feature isolation | Scoped events prevent leaking across boundaries |

**If none of these apply, stay with `withMethods` + `rxMethod`.** Simplicity is a feature.

---

## Architecture Overview

```
┌─────────┐    dispatch     ┌────────────┐
│  View    │ ─────────────> │ Dispatcher │
│ (Page)  │                 └─────┬──────┘
└─────────┘                       │
      ▲                           ▼
      │                   ┌──────────────┐
      │ read signals      │    Store     │
      │                   │              │
      │                   │ withReducer  │──── pure state transitions
      │                   │              │
      └───────────────────│ withEvent    │──── async side effects
                          │  Handlers   │     (dispatch result events)
                          └──────────────┘
```

**Data flow is unidirectional:**
1. **View** dispatches an event (user interaction or lifecycle trigger)
2. **Dispatcher** routes the event to all listening stores
3. **withReducer** handles synchronous state transitions (pure)
4. **withEventHandlers** handles async side effects and dispatches result events
5. **View** reads updated signals and re-renders

---

## Core API Reference

### Defining Events

Events are typed objects that describe what happened. They carry a `type` string and an optional `payload`.

#### Individual Events with `event()`

Use for standalone events that don't share a source.

```typescript
import { type } from '@ngrx/signals';
import { event } from '@ngrx/signals/events';

// Event without payload
export const appInitialized = event('[App] Initialized');

// Event with payload
export const sessionExpired = event(
  '[Session] Expired',
  type<{ reason: string }>()
);
```

Calling `appInitialized()` returns `{ type: '[App] Initialized' }`.
Calling `sessionExpired({ reason: 'timeout' })` returns `{ type: '[Session] Expired', payload: { reason: 'timeout' } }`.

#### Grouped Events with `eventGroup()`

Use when multiple events share the same source. This is the common pattern.

```typescript
import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

export const portfolioPageEvents = eventGroup({
  source: 'Portfolio Page',
  events: {
    opened: type<void>(),
    refreshRequested: type<void>(),
    positionSelected: type<string>(), // symbol
  },
});

export const portfolioApiEvents = eventGroup({
  source: 'Portfolio API',
  events: {
    loadSuccess: type<Position[]>(),
    loadFailure: type<string>(),
  },
});
```

**Naming convention:**

| Part | Rule | Example |
|------|------|---------|
| Source | Where the event originates | `'Portfolio Page'`, `'Trading API'` |
| Event name | Past tense, describes what happened | `opened`, `tradeSubmitted`, `loadSuccess` |
| Auto-generated type | `[Source] eventName` | `[Portfolio Page] opened` |

**Rule:** Separate page events (user intent) from API events (system responses). This keeps the event flow one-directional and easy to trace.

---

### State Transitions with `withReducer`

Reducers are pure, synchronous functions that compute the next state from the current state and a dispatched event. No API calls. No side effects.

```typescript
import { signalStore, withState } from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

export const PortfolioStore = signalStore(
  { providedIn: 'root' },

  withState({
    positions: [] as Position[],
    loading: false,
    error: null as string | null,
  }),

  withReducer(
    on(portfolioPageEvents.opened, portfolioPageEvents.refreshRequested, () => ({
      loading: true,
      error: null,
    })),
    on(portfolioApiEvents.loadSuccess, ({ payload: positions }) => ({
      positions,
      loading: false,
    })),
    on(portfolioApiEvents.loadFailure, ({ payload: error }) => ({
      loading: false,
      error,
    })),
  ),
);
```

**Key details:**

- The `on()` function accepts **one or more** event creators. Multiple events can share the same reducer logic.
- The handler receives `{ type, payload }` as the first argument and current `state` as the second.
- Return a **partial state object**, a **partial state updater**, or an **array** of updaters.

#### Advanced: Partial State Updaters

For computed state transitions, return a function instead of an object:

```typescript
on(counterEvents.incrementBy, (event, state) => ({
  count: state.count + event.payload,
})),

// Or return a reusable updater function
on(counterEvents.increment, () => incrementCount()),

function incrementCount(): PartialStateUpdater<{ count: number }> {
  return (state) => ({ count: state.count + 1 });
}
```

---

### Async Side Effects with `withEventHandlers`

Event handlers run async work (API calls, WebSocket messages, timers) and dispatch result events back into the system.

```typescript
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { mapResponse } from '@ngrx/operators';

// Add to the same store after withReducer:
withEventHandlers((store, events = inject(Events), repo = inject(PortfolioRepository)) => ({
  loadPositions$: events
    .on(portfolioPageEvents.opened, portfolioPageEvents.refreshRequested)
    .pipe(
      switchMap(() =>
        repo.getPositions$().pipe(
          mapResponse({
            next: (positions) => portfolioApiEvents.loadSuccess(positions),
            error: (e: { message: string }) => portfolioApiEvents.loadFailure(e.message),
          })
        )
      )
    ),
})),
```

**Key details:**

- Event handlers use `mapResponse` (not `tapResponse`). `mapResponse` returns an event object that gets auto-dispatched. `tapResponse` returns nothing — use it only in `rxMethod` pipelines.
- Handlers can listen to **multiple events** via `events.on(eventA, eventB)`.
- Choose the right RxJS concurrency operator: `switchMap` for cancelable requests, `exhaustMap` for submit-once operations, `concatMap` for ordered queues.
- Handlers can return a **dictionary** (named handlers) or an **array** (anonymous handlers).

#### Array-style Handlers (for non-event sources)

Event handlers aren't limited to the `Events` service. Any observable can be a source:

```typescript
withEventHandlers((store, repo = inject(PortfolioRepository)) => [
  // Poll every 30 seconds
  timer(0, 30_000).pipe(
    exhaustMap(() =>
      repo.getPositions$().pipe(
        mapResponse({
          next: (positions) => portfolioApiEvents.loadSuccess(positions),
          error: (e: { message: string }) => portfolioApiEvents.loadFailure(e.message),
        })
      )
    )
  ),
]),
```

#### `ReducerEvents` vs `Events`

The Events plugin provides two injectable event streams with different timing:

| Service | Timing | Use for |
|---------|--------|---------|
| `Events` | Fires **after** all reducers have processed | Side effects that need up-to-date state |
| `ReducerEvents` | Fires **before** `Events` | Custom state transitions when `withReducer` is not enough |

Use `ReducerEvents` when you need to update state imperatively (via `patchState`) in response to events, ensuring the state is ready before other handlers react:

```typescript
import { ReducerEvents, withEventHandlers } from '@ngrx/signals/events';

withEventHandlers((store, events = inject(ReducerEvents)) => [
  events
    .on(counterEvents.increment)
    .pipe(
      tap(() => patchState(store, { count: store.count() + 1 }))
    ),
]),
```

**Rule:** Prefer `withReducer` for state transitions. Use `ReducerEvents` only when you need access to `store` instance methods or complex logic that a pure reducer cannot express.

---

### Dispatching Events

#### From Components: `injectDispatch`

The streamlined way. Returns a typed dispatch object matching the event group.

```typescript
import { injectDispatch } from '@ngrx/signals/events';

@Component({
  providers: [PortfolioStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else {
      @for (position of store.positions(); track position.symbol) {
        <app-position-card
          [position]="position"
          (click)="dispatch.positionSelected(position.symbol)" />
      }
    }
  `,
})
export class PortfolioPage {
  protected readonly store = inject(PortfolioStore);
  protected readonly dispatch = injectDispatch(portfolioPageEvents);

  constructor() {
    this.dispatch.opened();
  }
}
```

#### From Services or Programmatic Code: `Dispatcher`

The lower-level API. Use when `injectDispatch` doesn't fit (e.g., inside a service, guard, or resolver).

```typescript
import { Dispatcher } from '@ngrx/signals/events';

@Injectable({ providedIn: 'root' })
export class SessionGuard {
  private readonly dispatcher = inject(Dispatcher);

  canActivate(): boolean {
    if (this.isExpired()) {
      this.dispatcher.dispatch(sessionExpired({ reason: 'token_expired' }));
      return false;
    }
    return true;
  }
}
```

---

## Scoped Events

By default, the `Dispatcher` and `Events` services operate in a **global scope** — every dispatched event is visible to every store. Scoped events create isolated event boundaries.

### When to Scope

- **Feature isolation:** A wizard or multi-step flow that should not leak events to the rest of the app
- **Micro-frontend boundaries:** Each remote module gets its own event scope
- **Reusable components:** Same component used in different contexts with independent event flows

### Creating a Local Scope

```typescript
import { provideDispatcher, injectDispatch } from '@ngrx/signals/events';

@Component({
  providers: [
    provideDispatcher(), // Creates local Dispatcher + Events scope
    TradeWizardStore,
  ],
})
export class TradeWizard {
  protected readonly dispatch = injectDispatch(wizardEvents);

  next() {
    // Default: dispatched to local scope only
    this.dispatch.stepCompleted();
  }

  submitToParent() {
    // Explicitly forward to parent scope
    this.dispatch({ scope: 'parent' }).tradeReady(this.store.request());
  }

  triggerGlobalRefresh() {
    // Forward to the global scope
    this.dispatch({ scope: 'global' }).refreshTriggered();
  }
}
```

**Scope visibility rules:**

| Scope | Visible to self? | Visible to ancestors? | Visible to descendants? |
|-------|-------------------|-----------------------|-------------------------|
| `self` (default) | Yes | No | No |
| `parent` | No | Yes (parent only) | No |
| `global` | No | Yes (root scope) | Yes (all scopes) |

**Events flow downward:** A local `Events` service receives events dispatched in its own scope **and** events dispatched in any ancestor scope, including global. Local events do **not** bubble up to ancestors unless explicitly forwarded.

### Scoping Events in Event Handlers

Use `toScope` and `mapToScope` to control scope from within event handlers:

```typescript
import { toScope, mapToScope } from '@ngrx/signals/events';

withEventHandlers((store, events = inject(Events), repo = inject(TradeRepository)) => ({
  submitTrade$: events.on(wizardEvents.tradeReady).pipe(
    exhaustMap(({ payload: req }) =>
      repo.placeTrade$(req).pipe(
        mapResponse({
          // Success stays in local scope (default)
          next: (confirmation) => tradeApiEvents.success(confirmation),
          // Failure forwards to global scope for cross-cutting error handling
          error: (e: { message: string }) => [
            tradeApiEvents.failure(e.message),
            toScope('global'),
          ],
        })
      )
    )
  ),

  // Forward ALL result events to parent scope
  notifyParent$: events.on(wizardEvents.stepCompleted).pipe(
    map(({ payload }) => parentEvents.wizardProgress(payload)),
    mapToScope('parent'),
  ),
})),
```

**Rule:** Default to global scope. Only introduce `provideDispatcher()` when you have a clear isolation need. Premature scoping adds complexity with no benefit.

---

## Architectural Patterns

### Pattern 1: Cross-Domain Coordination

The canonical use case. Multiple bounded contexts react to the same business event.

```typescript
// auth-events.ts
export const authApiEvents = eventGroup({
  source: 'Auth API',
  events: {
    loginSuccess: type<UserProfile>(),
    logoutCompleted: type<void>(),
    sessionExpired: type<{ reason: string }>(),
  },
});
```

Each domain reacts independently:

```typescript
// portfolio.store.ts — refreshes holdings on login
withEventHandlers((store, events = inject(Events), repo = inject(PortfolioRepository)) => ({
  onLogin$: events.on(authApiEvents.loginSuccess).pipe(
    switchMap(() => repo.getPositions$().pipe(
      mapResponse({
        next: (positions) => portfolioApiEvents.loadSuccess(positions),
        error: (e: { message: string }) => portfolioApiEvents.loadFailure(e.message),
      })
    ))
  ),
  onLogout$: events.on(authApiEvents.logoutCompleted).pipe(
    tap(() => patchState(store, { positions: [], loading: false, error: null }))
  ),
})),

// watchlist.store.ts — reloads watchlist on login
withEventHandlers((store, events = inject(Events), repo = inject(WatchlistRepository)) => ({
  onLogin$: events.on(authApiEvents.loginSuccess).pipe(
    switchMap(() => repo.getWatchlist$().pipe(
      mapResponse({
        next: (items) => watchlistApiEvents.loadSuccess(items),
        error: (e: { message: string }) => watchlistApiEvents.loadFailure(e.message),
      })
    ))
  ),
  onLogout$: events.on(authApiEvents.logoutCompleted).pipe(
    tap(() => patchState(store, initialState))
  ),
})),

// analytics.store.ts — logs session events, never touches other stores
withEventHandlers((store, events = inject(Events), analytics = inject(AnalyticsService)) => ({
  trackLogin$: events.on(authApiEvents.loginSuccess).pipe(
    tap(({ payload }) => analytics.track('login', { userId: payload.id }))
  ),
  trackLogout$: events.on(authApiEvents.logoutCompleted).pipe(
    tap(() => analytics.track('logout'))
  ),
})),
```

**Key benefit:** To add a new reactor (e.g., `NotificationsStore` clears badges on logout), add a handler in the new store. No changes to `AuthStore` or any existing store.

### Pattern 2: Event-Driven CRUD Store

A single domain store using events for full state lifecycle.

```typescript
// todo-events.ts
export const todoPageEvents = eventGroup({
  source: 'Todo Page',
  events: {
    opened: type<void>(),
    created: type<string>(),       // title
    toggled: type<number>(),       // id
    deleted: type<number>(),       // id
  },
});

export const todoApiEvents = eventGroup({
  source: 'Todo API',
  events: {
    loadSuccess: type<Todo[]>(),
    loadFailure: type<string>(),
    mutationSuccess: type<Todo[]>(), // return full list after mutation
    mutationFailure: type<string>(),
  },
});
```

```typescript
// todo.store.ts
export const TodoStore = signalStore(
  withState({ todos: [] as Todo[], loading: false, error: null as string | null }),

  withComputed(({ todos }) => ({
    activeTodos: computed(() => todos().filter(t => !t.done)),
    completedCount: computed(() => todos().filter(t => t.done).length),
  })),

  withReducer(
    on(todoPageEvents.opened, () => ({ loading: true, error: null })),
    on(todoPageEvents.created, todoPageEvents.toggled, todoPageEvents.deleted, () => ({
      loading: true,
    })),
    on(todoApiEvents.loadSuccess, todoApiEvents.mutationSuccess, ({ payload: todos }) => ({
      todos,
      loading: false,
    })),
    on(todoApiEvents.loadFailure, todoApiEvents.mutationFailure, ({ payload: error }) => ({
      loading: false,
      error,
    })),
  ),

  withEventHandlers((store, events = inject(Events), repo = inject(TodoRepository)) => ({
    load$: events.on(todoPageEvents.opened).pipe(
      switchMap(() => repo.getAll$().pipe(
        mapResponse({
          next: (todos) => todoApiEvents.loadSuccess(todos),
          error: (e: { message: string }) => todoApiEvents.loadFailure(e.message),
        })
      ))
    ),
    create$: events.on(todoPageEvents.created).pipe(
      concatMap(({ payload: title }) => repo.create$(title).pipe(
        mapResponse({
          next: (todos) => todoApiEvents.mutationSuccess(todos),
          error: (e: { message: string }) => todoApiEvents.mutationFailure(e.message),
        })
      ))
    ),
    toggle$: events.on(todoPageEvents.toggled).pipe(
      concatMap(({ payload: id }) => repo.toggle$(id).pipe(
        mapResponse({
          next: (todos) => todoApiEvents.mutationSuccess(todos),
          error: (e: { message: string }) => todoApiEvents.mutationFailure(e.message),
        })
      ))
    ),
    delete$: events.on(todoPageEvents.deleted).pipe(
      concatMap(({ payload: id }) => repo.delete$(id).pipe(
        mapResponse({
          next: (todos) => todoApiEvents.mutationSuccess(todos),
          error: (e: { message: string }) => todoApiEvents.mutationFailure(e.message),
        })
      ))
    ),
  })),
);
```

**When this pattern fits:** The domain is simple enough that one store handles all CRUD, but the page is complex enough that separating state transitions from async logic improves readability and testability.

**When it's overkill:** If only one component ever touches this store and the store has < 3 methods. Stay with `withMethods` + `rxMethod`.

---

## File Organization

### Single-Domain Store

```
libs/portfolio/
  data-access/
    portfolio.repository.ts       ← API calls
  state/
    portfolio.events.ts           ← event creators (page + API)
    portfolio.store.ts            ← withState, withReducer, withEventHandlers
  feature/
    portfolio-page.component.ts   ← dispatches + reads signals
```

### Cross-Domain Events

Shared events live at the domain boundary, not inside a specific store:

```
libs/shared/
  events/
    auth.events.ts                ← login, logout, session expired
    app-lifecycle.events.ts       ← app initialized, backgrounded, resumed
```

**Rule:** If only one store dispatches and consumes an event, the event file lives next to that store. If multiple domains consume the event, it lives in a shared location.

---

## Testing Event-Driven Stores

### Testing Reducers (Unit)

Reducers are pure functions. Test them by dispatching events and asserting state.

```typescript
describe('PortfolioStore reducers', () => {
  let store: InstanceType<typeof PortfolioStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioStore, provideDispatcher()],
    });
    store = TestBed.inject(PortfolioStore);
  });

  it('sets loading on page opened', () => {
    const dispatcher = TestBed.inject(Dispatcher);
    dispatcher.dispatch(portfolioPageEvents.opened());

    expect(store.loading()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('stores positions on load success', () => {
    const dispatcher = TestBed.inject(Dispatcher);
    const positions: Position[] = [{ symbol: 'AAPL', quantity: 10 }];

    dispatcher.dispatch(portfolioApiEvents.loadSuccess(positions));

    expect(store.positions()).toEqual(positions);
    expect(store.loading()).toBe(false);
  });
});
```

### Testing Event Handlers (Integration)

Event handlers involve async — use `fakeAsync` or mock the repository.

```typescript
describe('PortfolioStore event handlers', () => {
  let store: InstanceType<typeof PortfolioStore>;
  let dispatcher: Dispatcher;
  let repo: jasmine.SpyObj<PortfolioRepository>;

  beforeEach(() => {
    repo = jasmine.createSpyObj('PortfolioRepository', ['getPositions$']);

    TestBed.configureTestingModule({
      providers: [
        PortfolioStore,
        provideDispatcher(),
        { provide: PortfolioRepository, useValue: repo },
      ],
    });

    store = TestBed.inject(PortfolioStore);
    dispatcher = TestBed.inject(Dispatcher);
  });

  it('loads positions when page opens', fakeAsync(() => {
    const positions: Position[] = [{ symbol: 'AAPL', quantity: 10 }];
    repo.getPositions$.and.returnValue(of(positions));

    dispatcher.dispatch(portfolioPageEvents.opened());
    tick();

    expect(store.positions()).toEqual(positions);
    expect(store.loading()).toBe(false);
  }));

  it('sets error on load failure', fakeAsync(() => {
    repo.getPositions$.and.returnValue(throwError(() => ({ message: 'Network error' })));

    dispatcher.dispatch(portfolioPageEvents.opened());
    tick();

    expect(store.error()).toBe('Network error');
    expect(store.loading()).toBe(false);
  }));
});
```

### Testing Cross-Store Reactions

Verify that Store B reacts when Store A's event fires.

```typescript
describe('PortfolioStore reacts to auth events', () => {
  it('clears state on logout', () => {
    // Setup both stores
    TestBed.configureTestingModule({
      providers: [PortfolioStore, provideDispatcher()],
    });

    const store = TestBed.inject(PortfolioStore);
    const dispatcher = TestBed.inject(Dispatcher);

    // Pre-load some state
    dispatcher.dispatch(portfolioApiEvents.loadSuccess([{ symbol: 'AAPL', quantity: 10 }]));
    expect(store.positions().length).toBe(1);

    // Dispatch cross-domain event
    dispatcher.dispatch(authApiEvents.logoutCompleted());

    expect(store.positions()).toEqual([]);
  });
});
```

---

## Migration Guide: Methods to Events

Not every store needs events. Here's how to identify when and how to migrate.

### When to Migrate

| Signal | Action |
|--------|--------|
| Store injects 3+ other stores to notify them | Migrate the notifications to events |
| Multiple components duplicate the same `effect()` logic | Extract to event handlers |
| You can't add a new reactor without modifying the source store | Events decouple the source |
| The team needs to audit all state transitions | Pure reducers make state changes traceable |
| You don't have any of the above | Don't migrate. Methods are fine. |

### Step-by-Step

1. **Define events** that replace the method calls. One event per user intent or API result.
2. **Extract state transitions** from `patchState()` calls into `withReducer` + `on()`.
3. **Move async logic** from `rxMethod` into `withEventHandlers`. Replace `tapResponse` with `mapResponse`.
4. **Replace method calls in components** with `injectDispatch` + event dispatches.
5. **Remove `withMethods`** once all methods are replaced. Keep only methods that don't touch state (pure utilities).
6. **Test each layer independently:** reducers (pure unit tests), handlers (integration tests), components (dispatch + assertion).

### Before and After

**Before (methods):**

```typescript
export const PortfolioStore = signalStore(
  withState({ positions: [], loading: false, error: null }),
  withMethods((store, repo = inject(PortfolioRepository)) => ({
    load: rxMethod<void>((trigger$) =>
      trigger$.pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() => repo.getPositions$().pipe(
          tapResponse({
            next: (positions) => patchState(store, { positions }),
            error: (e) => patchState(store, { error: normalizeError(e) }),
            finalize: () => patchState(store, { loading: false }),
          })
        ))
      )
    ),
  })),
);
```

**After (events):**

```typescript
export const PortfolioStore = signalStore(
  withState({ positions: [], loading: false, error: null }),

  withReducer(
    on(portfolioPageEvents.opened, () => ({ loading: true, error: null })),
    on(portfolioApiEvents.loadSuccess, ({ payload: positions }) => ({ positions, loading: false })),
    on(portfolioApiEvents.loadFailure, ({ payload: error }) => ({ loading: false, error })),
  ),

  withEventHandlers((store, events = inject(Events), repo = inject(PortfolioRepository)) => ({
    load$: events.on(portfolioPageEvents.opened).pipe(
      switchMap(() => repo.getPositions$().pipe(
        mapResponse({
          next: (positions) => portfolioApiEvents.loadSuccess(positions),
          error: (e: { message: string }) => portfolioApiEvents.loadFailure(e.message),
        })
      ))
    ),
  })),
);
```

**What changed:**
- State transitions are isolated in `withReducer` (pure, auditable)
- Async logic is in `withEventHandlers` (observables that return events)
- `tapResponse` → `mapResponse`
- Component calls `dispatch.opened()` instead of `store.load()`

---

## Complete Flow: Trade Lifecycle

A trade through review → submit → confirmation, involving multiple stores.

```
User clicks "Review"
  → Component dispatches: tradingPageEvents.tradeReviewRequested(request)
  → TradingStore reducer: { loading: true, error: null, preview: null }
  → TradingStore handler: calls repo.previewTrade$()
  → API responds
  → Handler dispatches: tradingApiEvents.reviewSuccess(preview)
  → TradingStore reducer: { loading: false, preview: data }
  → UI shows preview screen

User clicks "Submit"
  → Component dispatches: tradingPageEvents.tradeSubmitted(request)
  → TradingStore reducer: { loading: true, confirmation: null }
  → TradingStore handler: calls repo.placeTrade$()
  → API responds
  → Handler dispatches: tradingApiEvents.tradeSuccess(confirmation)
  → TradingStore reducer: { loading: false, confirmation: data }
  → PortfolioStore handler: refreshes positions (reacts to tradeSuccess)
  → AnalyticsStore handler: logs trade event (reacts to tradeSuccess)
  → UI shows confirmation screen
  → Component effect: navigates to /portfolio
```

**Key observation:** TradingStore does not know PortfolioStore or AnalyticsStore exist. The event bus handles coordination. Adding a NotificationsStore reactor requires zero changes to TradingStore.

---

## Do and Don't

**Do:**

- Separate page events (user intent) from API events (system responses)
- Keep reducers pure — no injections, no side effects, just state math
- Use `mapResponse` in event handlers, `tapResponse` in `rxMethod`
- Choose one approach per store: methods OR events. Don't mix.
- Test reducers with simple dispatch → assert state
- Use `eventGroup` for related events, standalone `event()` for cross-cutting concerns
- Place shared events in a `libs/shared/events/` folder

**Don't:**

- Use the Events plugin for every store — it's overhead when methods suffice
- Dispatch events from reducers — reducers are synchronous and pure
- Create circular event chains (A dispatches → handler dispatches B → handler dispatches A)
- Use `tapResponse` inside `withEventHandlers` — no event gets dispatched, reducer never fires
- Mix `patchState` in event handlers when `withReducer` manages the same state
- Scope events prematurely — global is the default, scope only for isolation needs

---

## Pitfalls

**1. Mixing `withMethods` and `withReducer` for the same state**

Pick one. Either `withMethods` + `rxMethod` + `tapResponse`, or `withReducer` + `withEventHandlers` + `mapResponse`. Mixing both creates ambiguity about who owns state transitions.

**2. Using `tapResponse` in event handlers**

`tapResponse` performs a side effect and returns nothing. In `withEventHandlers`, the pipeline must return event objects for the dispatcher. Use `mapResponse` instead. This is the #1 Events plugin bug.

**3. Forgetting `ReducerEvents` timing**

If you use `patchState` inside a handler subscribed to `Events`, other handlers reacting to the same event may see stale state. Use `ReducerEvents` for state transitions in handlers.

**4. Over-engineering early**

If only one store cares about an action, a direct method call is simpler and clearer. Events add indirection. That indirection is worth it only when multiple consumers need to react. Start with methods. Migrate to events when the signals in the "When to Migrate" table appear.

**5. Circular event chains**

Event A dispatches → handler fires → dispatches Event B → another handler dispatches Event A. This is an infinite loop. Prevent it by keeping event flow **one-directional**: page events → API events → done. Never dispatch a page event from an API event handler.

**6. Giant event files**

If your events file has 20+ events, your domain is too broad. Split by subdomain. `tradingPageEvents`, `tradeReviewEvents`, `tradeExecutionEvents` — not one `tradeEvents` with everything.

---

## Summary

| Concept | API | Purpose |
|---------|-----|---------|
| Define events | `event()`, `eventGroup()` | Describe what happened |
| State transitions | `withReducer()`, `on()` | Pure state updates |
| Async side effects | `withEventHandlers()` | API calls, dispatch result events |
| Event stream (post-reducer) | `Events` service | React after state is updated |
| Event stream (pre-reducer) | `ReducerEvents` service | Custom state transitions |
| Dispatch from UI | `injectDispatch()` | Typed, grouped dispatch |
| Dispatch from services | `Dispatcher` service | Programmatic dispatch |
| Local isolation | `provideDispatcher()` | Scoped event boundaries |
| Scope control in handlers | `toScope()`, `mapToScope()` | Forward events across scopes |
| Response mapping | `mapResponse` | Convert API response to event |
