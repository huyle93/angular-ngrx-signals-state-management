# Events and Side Effects

Side effects are things that happen because of a state change: show a toast, refresh another store, navigate, log analytics.

The question is not "should I handle side effects?" -- you will. The question is "where and how?"

---

## Guiding Principles

- Store owns state. UI owns side effects that touch the screen.
- Start simple. Use the Events plugin only when you outgrow simple patterns.
- Decouple the "what happened" from the "what to do about it"
- Cross-domain side effects need a different pattern than local ones

---

## Level 1: Component Effect (Start Here)

The simplest pattern. The component watches store signals and reacts.

**When to use:** One component cares about a state change. Toast, alert, navigation after success.

```typescript
@Component({ /* ... */ })
export class TradePage {
  readonly store = inject(TradingStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  constructor() {
    // Show toast on trade error
    effect(() => {
      const err = this.store.error();
      if (err) this.toast.showError(err);
    });

    // Navigate on trade success
    effect(() => {
      if (this.store.tradeConfirmed()) {
        this.router.navigate(['/portfolio']);
      }
    });
  }
}
```

**How the store supports this:**

```typescript
export const TradingStore = signalStore(
  withState({
    loading: false,
    error: null as string | null,
    tradeConfirmed: false,
  }),

  withMethods((store, repo = inject(TradingRepository)) => ({
    placeTrade: rxMethod<TradeRequest>((req$) =>
      req$.pipe(
        tap(() => patchState(store, { loading: true, error: null, tradeConfirmed: false })),
        exhaustMap((req) =>
          repo.placeTrade$(req).pipe(
            tapResponse({
              next: () => patchState(store, { tradeConfirmed: true }),
              error: (e) => patchState(store, { error: normalizeError(e) }),
              finalize: () => patchState(store, { loading: false }),
            })
          )
        )
      )
    ),

    reset() {
      patchState(store, { loading: false, error: null, tradeConfirmed: false });
    },
  })),
);
```

**Key idea:** The store sets `tradeConfirmed: true`. It does not navigate. It does not show a toast. It just records what happened. The UI reacts.

**Tradeoff:**
- Pro: simple, testable, store stays UI-agnostic
- Con: if 5 components need to react to the same event, you repeat effects

---

## Level 2: Store-to-Store via Injection

One store reads or calls another store after something happens.

**When to use:** After a trade is placed, the portfolio store should refresh. Direct, clear dependency.

```typescript
export const TradingStore = signalStore(
  // ...
  withMethods((
    store,
    repo = inject(TradingRepository),
    portfolioStore = inject(PortfolioStore),
  ) => ({
    placeTrade: rxMethod<TradeRequest>((req$) =>
      req$.pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        exhaustMap((req) =>
          repo.placeTrade$(req).pipe(
            tapResponse({
              next: () => {
                patchState(store, { tradeConfirmed: true });
                // Direct call: tell portfolio to refresh
                portfolioStore.load();
              },
              error: (e) => patchState(store, { error: normalizeError(e) }),
              finalize: () => patchState(store, { loading: false }),
            })
          )
        )
      )
    ),
  })),
);
```

**Tradeoff:**
- Pro: explicit, easy to follow, easy to debug
- Con: TradingStore now depends on PortfolioStore. If 3 more stores need to react, you inject all 3.

**Rule:** Store A can read Store B. Store A should not mutate Store B's state directly. Calling a public method like `load()` is fine. Calling `patchState` on another store is not.

**When this breaks down:** If TradingStore needs to notify Portfolio, Watchlist, Analytics, and Notifications stores, the dependency list grows too long. That is when you move to Level 3.

---

## Level 3: Events Plugin (Decoupled Coordination)

The Events plugin separates "what happened" (events) from "what to do about it" (handlers). Stores react to events without knowing who dispatched them.

**When to use:**
- 3+ stores need to react to the same event
- Cross-domain workflows (login, logout, session reset)
- You want to add reactors without changing the dispatcher

### Step 1: Define Events

Events describe what happened. Group them by source.

```typescript
// trading-events.ts
import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

export const tradingPageEvents = eventGroup({
  source: 'Trading Page',
  events: {
    tradeSubmitted: type<TradeRequest>(),
    tradeReviewRequested: type<TradeRequest>(),
  },
});

export const tradingApiEvents = eventGroup({
  source: 'Trading API',
  events: {
    tradeSuccess: type<TradeConfirmation>(),
    tradeFailure: type<string>(),        // error message
    reviewSuccess: type<TradePreview>(),
    reviewFailure: type<string>(),
  },
});
```

**Naming convention:** `[Source] eventName`. Source is where the event originates. Page events come from UI. API events come from async handlers.

### Step 2: Handle State Transitions (withReducer)

Reducers update state in response to events. Pure, synchronous, predictable.

```typescript
// trading.store.ts
import { signalStore, withState } from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

export const TradingStore = signalStore(
  withState({
    loading: false,
    error: null as string | null,
    preview: null as TradePreview | null,
    confirmation: null as TradeConfirmation | null,
  }),

  withReducer(
    on(tradingPageEvents.tradeSubmitted, () => ({
      loading: true,
      error: null,
      confirmation: null,
    })),
    on(tradingPageEvents.tradeReviewRequested, () => ({
      loading: true,
      error: null,
      preview: null,
    })),
    on(tradingApiEvents.tradeSuccess, ({ payload }) => ({
      loading: false,
      confirmation: payload,
    })),
    on(tradingApiEvents.tradeFailure, ({ payload }) => ({
      loading: false,
      error: payload,
    })),
    on(tradingApiEvents.reviewSuccess, ({ payload }) => ({
      loading: false,
      preview: payload,
    })),
    on(tradingApiEvents.reviewFailure, ({ payload }) => ({
      loading: false,
      error: payload,
    })),
  ),
);
```

**Key idea:** Reducers only update state. No API calls. No side effects. This is intentional.

### Step 3: Handle Side Effects (withEventHandlers)

Event handlers run async work and dispatch new events as results.

```typescript
// trading.store.ts (continued)
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { mapResponse } from '@ngrx/operators';

// Add to the same store:
withEventHandlers((
  store,
  events = inject(Events),
  repo = inject(TradingRepository),
) => ({
  submitTrade$: events
    .on(tradingPageEvents.tradeSubmitted)
    .pipe(
      exhaustMap(({ payload: req }) =>
        repo.placeTrade$(req).pipe(
          mapResponse({
            next: (confirmation) => tradingApiEvents.tradeSuccess(confirmation),
            error: (e: { message: string }) =>
              tradingApiEvents.tradeFailure(e.message),
          })
        )
      )
    ),

  reviewTrade$: events
    .on(tradingPageEvents.tradeReviewRequested)
    .pipe(
      switchMap(({ payload: req }) =>
        repo.previewTrade$(req).pipe(
          mapResponse({
            next: (preview) => tradingApiEvents.reviewSuccess(preview),
            error: (e: { message: string }) =>
              tradingApiEvents.reviewFailure(e.message),
          })
        )
      )
    ),
}))
```

**Note:** Event handlers use `mapResponse` (not `tapResponse`). The difference:
- `tapResponse`: handles response, does not emit (for `rxMethod` where you patch state directly)
- `mapResponse`: maps response to a new event to dispatch (for event handlers that return events)

### Step 4: Other Stores React

This is where decoupling pays off. PortfolioStore reacts to trade success without the TradingStore knowing about it.

```typescript
// portfolio.store.ts
export const PortfolioStore = signalStore(
  // ...
  withEventHandlers((
    store,
    events = inject(Events),
    repo = inject(PortfolioRepository),
  ) => ({
    refreshOnTradeSuccess$: events
      .on(tradingApiEvents.tradeSuccess)
      .pipe(
        switchMap(() =>
          repo.getPositions$().pipe(
            tapResponse({
              next: (positions) => patchState(store, { positions }),
              error: (e) => console.error('Portfolio refresh failed', e),
            })
          )
        )
      ),
  }))
);
```

**Key benefit:** To add another reactor (say, AnalyticsStore logs trade events), you add a handler in AnalyticsStore. You do not change TradingStore at all.

### Step 5: Dispatch from Component

```typescript
@Component({
  providers: [TradingStore],
  // ...
})
export class TradingPage {
  readonly store = inject(TradingStore);
  readonly dispatch = injectDispatch(tradingPageEvents);

  onSubmit(req: TradeRequest) {
    this.dispatch.tradeSubmitted(req);
  }

  onReview(req: TradeRequest) {
    this.dispatch.tradeReviewRequested(req);
  }
}
```

---

## mapResponse vs tapResponse

This comes up often. Here is when to use each.

| | tapResponse | mapResponse |
|---|---|---|
| **Returns** | Nothing (side effect only) | A new event to dispatch |
| **Use in** | `rxMethod` pipelines | `withEventHandlers` pipelines |
| **State update** | Direct `patchState` in callbacks | Reducer handles the returned event |
| **Package** | `@ngrx/operators` | `@ngrx/operators` |

```typescript
// tapResponse: use inside rxMethod, patch state directly
tapResponse({
  next: (data) => patchState(store, { data }),
  error: (e) => patchState(store, { error: normalizeError(e) }),
  finalize: () => patchState(store, { loading: false }),
})

// mapResponse: use inside event handlers, return events
mapResponse({
  next: (data) => apiEvents.loadSuccess(data),
  error: (e) => apiEvents.loadFailure(e.message),
})
```

---

## Scoped Events

By default, events are global. Any store anywhere can listen. Sometimes you want isolation.

**When to use:** Feature modules that should not leak events to the rest of the app. Micro-frontend boundaries.

```typescript
@Component({
  providers: [
    provideDispatcher(),  // Creates a local event scope
    TradeWizardStore,
  ],
})
export class TradeWizard {
  readonly dispatch = injectDispatch(wizardEvents);

  next() {
    // This event stays within TradeWizard's scope
    this.dispatch.stepCompleted();
  }

  submitToParent() {
    // This event bubbles up to the parent scope
    this.dispatch({ scope: 'parent' }).tradeReady(this.store.request());
  }
}
```

**Rule:** Default to global scope. Only use scoped events when you have a clear isolation need.

---

## Decision Guide: Which Level to Use

```
Side effect is UI-only (toast, navigate, alert)?
  --> Level 1: Component effect

One store needs to tell one other store to refresh?
  --> Level 2: Direct injection

Multiple stores react to the same event?
  --> Level 3: Events plugin

Cross-domain workflow (login/logout/session reset)?
  --> Level 3: Events plugin
```

---

## Complete Flow: Trade Lifecycle

Putting it all together. A trade goes through review, submit, confirmation.

```
User clicks "Review"
  --> Component dispatches: tradeReviewRequested(request)
  --> TradingStore reducer: loading: true, error: null
  --> Event handler: calls repo.previewTrade$()
  --> API success: dispatches reviewSuccess(preview)
  --> TradingStore reducer: loading: false, preview: data
  --> UI shows preview screen

User clicks "Submit"
  --> Component dispatches: tradeSubmitted(request)
  --> TradingStore reducer: loading: true
  --> Event handler: calls repo.placeTrade$()
  --> API success: dispatches tradeSuccess(confirmation)
  --> TradingStore reducer: loading: false, confirmation: data
  --> PortfolioStore handler: refreshes positions
  --> UI shows confirmation
  --> Component effect: navigates to /portfolio
```

---

## Do and Don't

**Do:**

- Start with Level 1 (component effects). Move up only when needed.
- Keep event names descriptive: `tradeSubmitted`, not `submit`
- Use `mapResponse` in event handlers, `tapResponse` in rxMethod
- Let reducers handle state. Let event handlers handle async.
- Group events by source: page events vs API events

**Don't:**

- Use the Events plugin for everything (it adds complexity)
- Put navigation or toast logic in stores
- Create circular event chains (event A triggers B which triggers A)
- Mix `patchState` in event handlers when you have a reducer for the same state (pick one approach per store)
- Dispatch events from reducers (reducers are synchronous and pure)

---

## Pitfalls

**1. Mixing withMethods and withReducer for the same state**

Pick one approach per store. Either the store uses methods + rxMethod + tapResponse, or it uses events + withReducer + withEventHandlers. Mixing both makes it unclear who owns state transitions.

**2. Forgetting that event handlers must return events**

In `withEventHandlers`, the observable pipeline should return event objects (via `mapResponse`). If you use `tapResponse` instead, no event gets dispatched and your reducer never fires.

**3. Over-engineering with events too early**

If only one store cares about an action, a direct method call is simpler and clearer. Events add indirection. That indirection is worth it only when multiple consumers need to react.

**4. Circular event chains**

Event A dispatches, handler fires, dispatches Event B, another handler dispatches Event A again. This is an infinite loop. Guard against it by keeping event flow one-directional.
