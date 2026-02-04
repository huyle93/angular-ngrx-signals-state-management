# NgRx SignalStore - CoE Talk Outline

20-minute talk for engineers joining new development.

---

## Talk Structure

| Section | Time | File |
|---------|------|------|
| 1. Mental Model Shift | 5 min | [01-mental-model.md](./fundamentals/01-mental-model.md) |
| 2. Store Anatomy | 3 min | [02-store-anatomy.md](./fundamentals/02-store-anatomy.md) |
| 3. State and Computed | 3 min | [03-state-and-computed.md](./fundamentals/03-state-and-computed.md) |
| 4. Methods and Async | 4 min | [04-methods-and-async.md](./fundamentals/04-methods-and-async.md) |
| 5. Architecture Rules | 3 min | [05-architecture-rules.md](./fundamentals/05-architecture-rules.md) |
| 6. Q&A | 2 min | - |

---

## Key Messages

### For Developers

- SignalStore is method-driven, not message-driven
- State lives with logic (co-located)
- Derived state is first-class (computed signals)
- Ownership matters: who owns this state?
- Reset is a first-class concern

### For Leadership

- Less ceremony, faster onboarding
- Local reasoning per domain (easier code review)
- Better Angular alignment (signals are Angular's future)
- Cleaner Nx boundaries (store per domain)

---

## Flow Diagrams to Show

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

## Concrete Example: Load Portfolio Positions

### Redux Way

1. Dispatch `LoadPositions`
2. Effect calls API
3. Dispatch `LoadPositionsSuccess`
4. Reducer updates positions
5. Selector returns positions

### SignalStore Way

1. UI calls `portfolioStore.loadPositions()`
2. Store triggers async via data-access
3. Store sets loading, patches positions
4. Computed signals update UI

Key difference: Redux spreads logic across files. SignalStore keeps it together.

---

## Quick Reference

- Full rules: [ngrx-signals.instructions.md](../copilot-samples/instructions/ngrx-signals.instructions.md)
- Fundamentals: [./fundamentals/](./fundamentals/)
