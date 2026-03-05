# Side Effects

Side effects are things that happen because of a state change: show a toast, refresh another store, navigate, log analytics.

The question is not "should I handle side effects?" — you will. The question is "where and how?"

---

## Guiding Principles

- **Store owns state. UI owns side effects that touch the screen.**
- Start simple. Escalate only when the simple pattern creates real pain.
- Decouple the "what happened" from the "what to do about it."
- Cross-domain side effects need a different pattern than local ones.

---

## Level 1: Component Effect (Start Here)

The component watches store signals and reacts. This is the default pattern for most side effects.

**When to use:** One component cares about a state change — toast, alert, navigation after success.

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

**Key idea:** The store sets `tradeConfirmed: true`. It does not navigate. It does not show a toast. It records what happened. The UI decides what to do about it.

**Tradeoff:**

| Pro | Con |
|-----|-----|
| Simple, testable, store stays UI-agnostic | If 5 components need the same reaction, you repeat effects |
| No extra abstractions | Relies on signal flags that must be reset |

**When this is enough:** Most of the time. If you find yourself writing the same effect in multiple components, consider Level 2.

---

## Level 2: Store-to-Store via Injection

One store calls another store's public method after something happens.

**When to use:** After a trade is placed, the portfolio store should refresh. Direct, explicit dependency.

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
                portfolioStore.load(); // Direct call
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

**Rules:**

- Store A can **read** Store B's signals.
- Store A can **call** Store B's public methods (`load()`, `refresh()`).
- Store A must **never** call `patchState` on Store B. That violates ownership.

**Tradeoff:**

| Pro | Con |
|-----|-----|
| Explicit, easy to follow, easy to debug | TradingStore depends on PortfolioStore |
| No event infrastructure needed | If 3+ stores need to react, injections grow |

**When this breaks down:** If TradingStore needs to notify Portfolio, Watchlist, Analytics, and Notifications stores, the dependency list grows too long and the store becomes a coordinator instead of a state owner. That is when you escalate to event-driven architecture.

---

## Level 3: Event-Driven Architecture (NgRx Events Plugin)

When multiple stores need to react to the same occurrence, or when cross-domain workflows span several bounded contexts, the NgRx Events plugin decouples "what happened" from "what to do about it."

> **This is a separate architectural pattern.** It introduces event creators, reducers, event handlers, and a dispatcher — a lightweight Flux-inspired layer on top of SignalStore.

**Full coverage:** See [09-event-driven-architecture.md](09-event-driven-architecture.md) for the complete guide including API reference, architectural patterns, scoped events, testing, and migration path.

**When to reach for it:**

- 3+ stores need to react to the same occurrence
- Cross-domain workflows (login/logout, session reset, app-wide refresh)
- You want to add reactors without modifying the event source
- You need clear separation of state transitions (pure) from side effects (async)

**When NOT to use it:**

- One component reacts to one store → Level 1
- One store calls one store → Level 2
- You just want "Redux for the aesthetic" → stay with methods

---

## Decision Guide

```
Side effect is UI-only (toast, navigate, alert)?
  → Level 1: Component effect

One store needs to tell one other store to refresh?
  → Level 2: Direct injection

Multiple stores react to the same occurrence?
  → Level 3: Events plugin (see 09-event-driven-architecture.md)

Cross-domain workflow (login/logout/session reset)?
  → Level 3: Events plugin (see 09-event-driven-architecture.md)
```

**Start at Level 1. Move up only when the current level creates real friction — not theoretical friction.**

---

## mapResponse vs tapResponse

This distinction matters across both patterns (methods and events). Here is the canonical reference.

| | `tapResponse` | `mapResponse` |
|---|---|---|
| **Returns** | Nothing (side effect only) | A new value (or event) to emit |
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
  error: (e: { message: string }) => apiEvents.loadFailure(e.message),
})
```

**Rule:** If you are writing `rxMethod` + `patchState`, use `tapResponse`. If you are writing `withEventHandlers` and need to dispatch a result event, use `mapResponse`. Mixing them up is the #1 Events plugin bug.

---

## Do and Don't

**Do:**

- Default to Level 1 (component effects) for UI reactions
- Keep stores UI-agnostic — no toasts, modals, or navigation inside stores
- Use `tapResponse` with `finalize` to always clear loading state
- Keep side effect logic close to the component that owns the screen

**Don't:**

- Import `Router`, `ToastController`, or `AlertController` in stores
- Use `effect()` to propagate state between signals (use `computed()` or `linkedSignal()`)
- Jump to the Events plugin because "it feels more enterprise" — complexity must be earned
- Create God stores that orchestrate 5 other stores via injection

---

## Pitfalls

**1. Forgetting to reset signal flags**

If your store sets `tradeConfirmed: true`, the component effect fires. But if the user navigates away and comes back, the effect fires again. Always reset flags after handling them, or use a `withHooks` cleanup.

**2. effect() running on initial signal values**

An `effect()` runs immediately with the current signal value. If `error()` starts as `null`, the effect runs with `null`. Guard against it:

```typescript
effect(() => {
  const err = this.store.error();
  if (err) this.toast.showError(err); // Guard: only act on truthy
});
```

**3. Over-injecting stores**

If Store A injects Stores B, C, D, and E to notify them, you have a coordination problem disguised as dependency injection. That is the signal to move to the Events plugin (see [09-event-driven-architecture.md](09-event-driven-architecture.md)).

**4. Side effects in computed()**

Never. `computed()` must be pure. Side effects belong in `effect()` or event handlers.
