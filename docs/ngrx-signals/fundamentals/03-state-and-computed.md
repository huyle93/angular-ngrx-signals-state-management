# State and Computed

State is what you store. Computed is what you derive.

---

## withState - Stored Values

Use `withState` for data that:

- Comes from API
- Needs to persist across interactions
- Cannot be derived from other state

```typescript
withState({
  loading: false,
  error: null,
  data: null,
  lastUpdated: null,
})
```

Standard async state shape:

```typescript
interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  lastUpdated: number | null;
}
```

---

## withComputed - Derived Values

Use `withComputed` for data that:

- Can be calculated from stored state
- Should update automatically when source changes
- Should not be stored twice

```typescript
withComputed((store) => ({
  hasData: computed(() => !!store.data()),
  isEmpty: computed(() => !store.loading() && !store.data()),
  activeTodos: computed(() => store.todos().filter(t => !t.done)),
  totalCount: computed(() => store.todos().length),
}))
```

---

## Rule: Do Not Store Derived Data

Bad:

```typescript
withState({
  todos: [],
  activeTodos: [],    // derived - should not be here
  completedCount: 0,  // derived - should not be here
})
```

Good:

```typescript
withState({
  todos: [],
}),
withComputed((store) => ({
  activeTodos: computed(() => store.todos().filter(t => !t.done)),
  completedCount: computed(() => store.todos().filter(t => t.done).length),
}))
```

---

## patchState - Update State

Use `patchState` to update state. Always immutable.

```typescript
import { patchState } from '@ngrx/signals';

withMethods((store) => ({
  setLoading() {
    patchState(store, { loading: true, error: null });
  },
  setData(data) {
    patchState(store, { data, loading: false, lastUpdated: Date.now() });
  },
  setError(error) {
    patchState(store, { error, loading: false });
  },
}))
```

---

## Ownership Rule

State is protected by default. No external `patchState`.

- Store exposes readonly signals
- Store exposes methods to change state
- External code calls methods, not patchState
