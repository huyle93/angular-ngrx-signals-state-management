# Store Anatomy

A SignalStore is a stateful ViewModel with explicit write-points.

---

## Basic Structure

```typescript
import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';

export const TodoStore = signalStore(
  { providedIn: 'root' },

  withState({ todos: [], loading: false, error: null }),

  withComputed((store) => ({
    activeTodos: computed(() => store.todos().filter(t => !t.done)),
  })),

  withMethods((store) => ({
    load() { /* ... */ },
    add(todo) { /* ... */ },
    reset() { /* ... */ },
  })),
);
```

---

## Building Blocks

| Function | Purpose |
|----------|---------|
| `signalStore()` | Creates an injectable store service |
| `withState()` | Adds state slices |
| `withComputed()` | Adds derived signals |
| `withMethods()` | Adds methods for state updates |
| `withHooks()` | Adds lifecycle hooks (onInit, onDestroy) |
| `withEntities()` | Adds entity collection management |

---

## Nx Domain Structure

```
libs/portfolio/
 |- state/
 |   \- portfolio.store.ts      <- SignalStore here
 |- data-access/
 |   \- portfolio.repository.ts <- API calls here
 \- feature/
     \- portfolio.component.ts  <- UI here
```

Flow:

```
feature -> store.method() -> patchState() -> computed() -> template
                  \-> data-access -> API
```

---

## Redux vs SignalStore Files

**Redux:**

```
+state/
  |- portfolio.actions.ts
  |- portfolio.reducer.ts
  |- portfolio.selectors.ts
  \- portfolio.effects.ts
```

**SignalStore:**

```
state/
  \- portfolio.store.ts
```

Fewer files does not mean less discipline. It means local reasoning.
