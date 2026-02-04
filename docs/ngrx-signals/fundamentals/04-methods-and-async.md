# Methods and Async

Methods are the public API of your store.

---

## withMethods - Define Actions

```typescript
withMethods((store, repo = inject(FooRepository)) => ({
  load: rxMethod<void>(/* ... */),
  add(item) { patchState(store, { items: [...store.items(), item] }); },
  reset() { patchState(store, initialState); },
}))
```

Design methods as a real API:

- `load()` - fetch data
- `refresh()` - re-fetch data
- `submit()` - send data
- `reset()` - clear state

---

## rxMethod - Async with RxJS

Use `rxMethod` from `@ngrx/signals/rxjs-interop` for:

- HTTP calls
- WebSocket/SSE
- Polling
- Retries
- Cancellation

```typescript
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { switchMap, tap } from 'rxjs/operators';

load: rxMethod<void>((trigger$) =>
  trigger$.pipe(
    tap(() => patchState(store, { loading: true, error: null })),
    switchMap(() =>
      repo.getData$().pipe(
        tapResponse({
          next: (data) => patchState(store, { data, lastUpdated: Date.now() }),
          error: (e) => patchState(store, { error: normalizeError(e) }),
          finalize: () => patchState(store, { loading: false }),
        })
      )
    )
  )
)
```

Rule: Always clear loading in `finalize` to avoid stuck spinners.

---

## tapResponse - Handle Success/Error/Finalize

Always use `tapResponse` from `@ngrx/operators`:

```typescript
tapResponse({
  next: (data) => { /* success */ },
  error: (err) => { /* error */ },
  finalize: () => { /* always runs */ },
})
```

---

## Concurrency Operators

Choose by user intent:

| Operator | Behavior | Use For |
|----------|----------|---------|
| `switchMap` | Cancel previous | Search typing, refresh |
| `exhaustMap` | Ignore while busy | Submit forms, place orders |
| `concatMap` | Queue in order | Sequential writes |
| `mergeMap` | Run in parallel | Independent loads |

Most common: `switchMap` for reads, `exhaustMap` for writes.

---

## signalMethod - Simple Side Effects

Use `signalMethod` from `@ngrx/signals` when:

- Side effect is simple
- No need for RxJS operators
- Bundle size matters

```typescript
import { signalMethod } from '@ngrx/signals';

logValue: signalMethod<number>((num) => {
  console.log('Value:', num);
})
```

Rule: If you need cancellation or concurrency control, use `rxMethod`.
