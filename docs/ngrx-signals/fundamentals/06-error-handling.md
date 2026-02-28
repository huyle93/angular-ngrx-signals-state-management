# Error Handling

Errors are normal. The goal is not to prevent them but to handle them well.

Good error handling means: the user sees useful feedback, the UI never gets stuck, and the developer can debug fast.

---

## Guiding Principles

- Always clear loading state, even on error (no stuck spinners)
- Normalize errors into user-friendly strings before storing
- Store holds the error; UI decides how to show it (toast, banner, inline)
- Never swallow errors silently
- Keep error state close to the data it belongs to

---

## Level 1: Inline Error State (Start Here)

The simplest approach. Each store manages its own error string alongside loading and data.

**When to use:** Most stores. Single async operation per store. This is the default.

```typescript
export interface TodoState {
  todos: Todo[];
  loading: boolean;
  error: string | null;
}

const initialState: TodoState = {
  todos: [],
  loading: false,
  error: null,
};

export const TodoStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ error, loading }) => ({
    hasError: computed(() => !!error()),
    canRetry: computed(() => !!error() && !loading()),
  })),

  withMethods((store, repo = inject(TodoRepository)) => ({
    load: rxMethod<void>((trigger$) =>
      trigger$.pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          repo.getTodos$().pipe(
            tapResponse({
              next: (todos) => patchState(store, { todos }),
              error: (e) => patchState(store, { error: normalizeError(e) }),
              finalize: () => patchState(store, { loading: false }),
            })
          )
        )
      )
    ),

    clearError() {
      patchState(store, { error: null });
    },

    reset() {
      patchState(store, initialState);
    },
  })),
);
```

**Why `finalize` matters:** `tapResponse` catches the inner observable error and completes it. But `finalize` runs whether the inner observable succeeds or errors. This is the only safe place to clear `loading`.

Without `finalize`, a failed request leaves `loading: true` forever.

---

## The `normalizeError` Helper

API errors come in many shapes. Normalize them into a single string early.

```typescript
function normalizeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    // Backend returned an error body
    if (e.error?.message) return String(e.error.message);
    // HTTP status text fallback
    if (e.statusText) return `${e.status}: ${e.statusText}`;
  }
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong';
}
```

**Rule:** Every store should use the same `normalizeError` function. Extract it into a shared utility file.

**Do not** store the raw `HttpErrorResponse` in state. It is not serializable and contains more than the UI needs.

---

## UI Consumption: Store Exposes, UI Decides

The store exposes `error()`. The UI picks how to display it.

### Option A: Template-driven (preferred)

```html
@if (store.hasError()) {
  <div class="error-banner">
    <p>{{ store.error() }}</p>
    <button (click)="store.load()">Retry</button>
  </div>
}
```

### Option B: Effect-driven (toast/alert)

```typescript
@Component({ /* ... */ })
export class TodoPage {
  readonly store = inject(TodoStore);

  constructor() {
    effect(() => {
      const err = this.store.error();
      if (err) this.toastService.showError(err);
    });
  }
}
```

**Tradeoff:**
- Template-driven: simpler, testable, visible in markup
- Effect-driven: needed for toast/alert/modal that lives outside the template

**Rule:** UI-only effects belong in the component, never in the store.

---

## Level 2: Custom Store Feature (withRequestStatus)

When multiple stores repeat the same loading/error/success pattern, extract it.

**When to use:** You have 3+ stores with the same async state shape. DRY matters here.

```typescript
import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withState } from '@ngrx/signals';

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
export function setError(error: string): { requestStatus: RequestStatus } {
  return { requestStatus: { error } };
}
```

Usage in a store:

```typescript
export const PortfolioStore = signalStore(
  { providedIn: 'root' },

  withRequestStatus(),

  withState({ positions: [] as Position[] }),

  withMethods((store, repo = inject(PortfolioRepository)) => ({
    load: rxMethod<void>((trigger$) =>
      trigger$.pipe(
        tap(() => patchState(store, setPending())),
        switchMap(() =>
          repo.getPositions$().pipe(
            tapResponse({
              next: (positions) => patchState(store, { positions }, setFulfilled()),
              error: (e) => patchState(store, setError(normalizeError(e))),
              finalize: () => {
                // Only clear pending if still pending (avoid overwriting error)
                if (store.isPending()) {
                  patchState(store, setFulfilled());
                }
              },
            })
          )
        )
      )
    ),
  })),
);
```

**Tradeoff vs Level 1:**

| | Inline (Level 1) | withRequestStatus (Level 2) |
|---|---|---|
| Setup | Zero, just add fields | Create shared feature once |
| Consistency | Depends on developer | Enforced by feature |
| Best for | 1-2 stores | 3+ stores with same pattern |

---

## Level 3: Multiple Async Operations in One Store

Some stores manage more than one async call. A single `loading`/`error` pair is not enough.

**When to use:** Store handles both a list load and an item submit. Or multiple independent API calls.

### Option A: Named State Slices

```typescript
withState({
  // List loading
  positions: [] as Position[],
  loadStatus: 'idle' as RequestStatus,

  // Submit operation
  submitStatus: 'idle' as RequestStatus,
})
```

### Option B: Named RequestStatus with Collection Prefix

Use `withRequestStatus` with a name prefix by convention:

```typescript
withState({
  positions: [] as Position[],
  loadRequestStatus: 'idle' as RequestStatus,
  submitRequestStatus: 'idle' as RequestStatus,
}),
withComputed((store) => ({
  isLoadPending: computed(() => store.loadRequestStatus() === 'pending'),
  isSubmitPending: computed(() => store.submitRequestStatus() === 'pending'),
  loadError: computed(() => {
    const s = store.loadRequestStatus();
    return typeof s === 'object' ? s.error : null;
  }),
  submitError: computed(() => {
    const s = store.submitRequestStatus();
    return typeof s === 'object' ? s.error : null;
  }),
}))
```

**Tradeoff:** More state to manage, but each operation has clear status. UI can show "submitting..." and "list failed" independently.

**Rule:** If two async operations can run at the same time, they need separate status fields. One `loading` boolean is not enough.

---

## Error Recovery Patterns

### Retry

Expose a method that re-triggers the same operation.

```typescript
// Store already has load()
// UI calls store.load() again on retry button click
```

### Clear on Navigate

Reset error when user leaves the page. Use `withHooks`:

```typescript
withHooks({
  onDestroy(store) {
    patchState(store, { error: null });
  },
})
```

Or reset fully for feature-scoped stores (they destroy with the route anyway).

### Optimistic Update + Rollback

For fast UI feedback on writes. Risky but sometimes worth it.

```typescript
toggleTodo: rxMethod<number>((id$) =>
  id$.pipe(
    tap((id) => {
      // Optimistic: update UI immediately
      patchState(store, updateEntity({
        id,
        changes: (t) => ({ done: !t.done }),
      }));
    }),
    exhaustMap((id) =>
      repo.toggleTodo$(id).pipe(
        tapResponse({
          next: () => { /* already updated */ },
          error: (e) => {
            // Rollback: undo the optimistic change
            patchState(store, updateEntity({
              id,
              changes: (t) => ({ done: !t.done }),
            }));
            patchState(store, { error: normalizeError(e) });
          },
        })
      )
    )
  )
)
```

**When to use:** Toggle switches, like/unlike, quick state flips where latency feels bad.

**When to avoid:** Financial transactions, form submissions, anything where rollback is complex.

---

## Do and Don't

**Do:**

- Always handle error in `tapResponse` (it is required, not optional)
- Always use `finalize` to clear loading state
- Normalize errors into plain strings before storing
- Keep `normalizeError` in a shared utility, not copy-pasted per store
- Let UI decide how to display errors (toast vs banner vs inline)

**Don't:**

- Store raw `HttpErrorResponse` objects in state
- Show technical error messages to users (log them, show friendly text)
- Forget `finalize` (stuck spinners are a UX bug)
- Put toast/alert logic in the store
- Swallow errors with empty `catchError(() => EMPTY)` without logging

---

## Decision Guide

```
How many stores need loading/error state?
  |
  +--> 1-2 stores --> Level 1: Inline error state
  |
  +--> 3+ stores with same shape --> Level 2: withRequestStatus CSF
  |
  +--> Store has multiple independent async ops --> Level 3: Named slices
```
