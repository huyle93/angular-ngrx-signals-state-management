# NgRx SignalStore and Angular Signals -- Presenter Reference

Evergreen reference for presenting, teaching, or advocating NgRx SignalStore and Angular Signals.
Use as a quick-access index before any talk, workshop, code review, or mentoring session.

---

## Fundamentals Index

Core topics, ordered for progressive teaching. Each file stands alone for targeted deep dives.

| # | Topic | File | Summary |
|---|-------|------|---------|
| 1 | Mental Model Shift | [01-mental-model.md](./fundamentals/01-mental-model.md) | Redux vs SignalStore paradigm shift |
| 2 | Store Anatomy | [02-store-anatomy.md](./fundamentals/02-store-anatomy.md) | withState, withComputed, withMethods, withHooks |
| 3 | State and Computed | [03-state-and-computed.md](./fundamentals/03-state-and-computed.md) | Writable vs derived, patchState, computed |
| 4 | Methods and Async | [04-methods-and-async.md](./fundamentals/04-methods-and-async.md) | rxMethod, signalMethod, tapResponse |
| 5 | Architecture Rules | [05-architecture-rules.md](./fundamentals/05-architecture-rules.md) | Ownership, boundaries, naming conventions |
| 6 | Error Handling | [06-error-handling.md](./fundamentals/06-error-handling.md) | Inline, CSF, named slices |
| 7 | Events and Side Effects | [07-events-and-side-effects.md](./fundamentals/07-events-and-side-effects.md) | Component effect, store injection, Events plugin |
| 8 | Angular effect() | [08-effect.md](./fundamentals/08-effect.md) | When to use, pitfalls, SignalStore integration |

---

## Key Messages

### For Developers

- SignalStore is method-driven, not message-driven
- State lives with logic (co-located)
- Derived state is first-class (computed signals)
- Ownership matters: who owns this state?
- Reset is a first-class concern
- effect() is a last resort -- prefer computed() and linkedSignal()

### Business Value

- Less ceremony, faster onboarding for new team members
- Local reasoning per domain (easier code review, fewer merge conflicts)
- Better Angular alignment (signals are Angular's future)
- Cleaner Nx boundaries (store per domain, enforced by lint rules)
- Smaller bundle size vs full Redux setup

---

## Flow Diagrams

### Redux Flow

```
UI -> dispatch(action) -> reducer -> store -> selector -> UI
                 \-> effect -> API -> dispatch(success) -/
```

### SignalStore Flow

```
UI -> store.method() -> patchState -> computed -> UI
               \-> data-access -> API -/
```

---

## One-Liner to Remember

> Redux is message-driven. SignalStore is method-driven.

---

## Example Walkthrough: Load a Collection

### Redux Way

1. Dispatch `LoadItems`
2. Effect calls API
3. Dispatch `LoadItemsSuccess`
4. Reducer updates items
5. Selector returns items

### SignalStore Way

1. UI calls `store.loadItems()`
2. Store triggers async via data-access service
3. Store sets loading, patches items via patchState
4. Computed signals update UI

Key difference: Redux spreads logic across files. SignalStore keeps it together.

---

## Quick Reference

- Full architecture rules: [ngrx-signals.instructions.md](../copilot-samples/instructions/ngrx-signals.instructions.md)
- All fundamentals: [./fundamentals/](./fundamentals/)
