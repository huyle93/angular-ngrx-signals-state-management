# Angular effect()

An `effect()` is a reactive side effect that runs whenever the signals it reads change. It is the bridge between Angular's reactive signal system and imperative, non-reactive APIs.

The official Angular guidance is clear: **effect() should be the last API you reach for**. There are no situations where effect is "good" -- only situations where it is appropriate.

---

## Guiding Principles

- Prefer `computed()` for derived values. Prefer `linkedSignal()` for writable derived state.
- effect() is for syncing signal state outward to non-reactive APIs (DOM, localStorage, logging, analytics).
- Never use effect() to propagate state changes between signals. That is what `computed()` and `linkedSignal()` exist for.
- Keep effects small and focused. One effect, one responsibility.
- Always clean up resources (timers, subscriptions, listeners) via `onCleanup`.

---

## API Signature

```typescript
import { effect } from '@angular/core';

const effectRef: EffectRef = effect(
  (onCleanup: EffectCleanupRegisterFn) => void,
  options?: CreateEffectOptions
);
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `injector` | `Injector` | Explicit injector when creating effect outside injection context |
| `manualCleanup` | `boolean` | Disables automatic cleanup on destroy. You must call `effectRef.destroy()` yourself |

---

## Two Kinds of Effects

Angular distinguishes effects by where they are created:

| Kind | Created in | Execution timing | Destroyed when |
|------|-----------|-------------------|----------------|
| View Effect | Component, directive, or component-scoped service | Before its component is checked during change detection | Component is destroyed |
| Root Effect | Root-provided service or outside the component tree | Before all components are checked (as microtask) | Application is destroyed |

Both re-run if dependencies change during execution, before change detection moves forward.

---

## Level 1: Basic Usage (Start Here)

### Logging

```typescript
@Component({ /* ... */ })
export class CounterComponent {
  readonly count = signal(0);

  constructor() {
    effect(() => {
      console.log('Count changed to:', this.count());
    });
  }
}
```

### Sync to localStorage

```typescript
@Component({ /* ... */ })
export class SettingsComponent {
  readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => {
      localStorage.setItem('theme', this.theme());
    });
  }
}
```

### Cleanup with onCleanup

```typescript
constructor() {
  effect((onCleanup) => {
    const user = currentUser();
    const timer = setTimeout(() => {
      console.log(`1 second ago, the user became ${user}`);
    }, 1000);

    onCleanup(() => {
      clearTimeout(timer);
    });
  });
}
```

`onCleanup` runs before each re-execution and when the effect is destroyed. Use it for timers, subscriptions, abort controllers, or any resource that must not leak.

---

## Level 2: Injection Context and Lifecycle

### Default: Constructor or Field Initializer

effect() requires an injection context. The simplest way is a constructor or class field:

```typescript
@Component({ /* ... */ })
export class MyComponent {
  readonly store = inject(MyStore);

  constructor() {
    effect(() => {
      // runs in injection context
      if (this.store.error()) {
        console.error('Store error:', this.store.error());
      }
    });
  }
}
```

### Outside Constructor: Explicit Injector

When you must create an effect after construction (e.g., in a method called later):

```typescript
@Component({ /* ... */ })
export class MyComponent {
  private readonly injector = inject(Injector);
  readonly count = signal(0);

  startLogging(): void {
    effect(
      () => { console.log('Count:', this.count()); },
      { injector: this.injector }
    );
  }
}
```

### Manual Cleanup

Disable automatic destroy for effects that outlive their default scope:

```typescript
const ref = effect(
  () => { /* ... */ },
  { manualCleanup: true }
);

// Later, when truly done:
ref.destroy();
```

Use this sparingly. If you forget to call `destroy()`, the effect leaks.

---

## Level 3: Advanced Patterns

### Reading Signals Without Tracking (untracked)

Sometimes an effect should react to one signal but read another without creating a dependency:

```typescript
effect(() => {
  // Only re-runs when currentUser changes, not when counter changes
  const user = currentUser();
  const count = untracked(counter);
  console.log(`User: ${user}, counter was: ${count}`);
});
```

`untracked()` also wraps function calls whose internal signal reads should not create dependencies:

```typescript
effect(() => {
  const user = currentUser();
  untracked(() => {
    // loggingService may read signals internally; those won't be tracked
    this.loggingService.log(`User set to ${user}`);
  });
});
```

### Async and the Reactive Context Boundary

The reactive context only exists synchronously. Signal reads after `await` are not tracked:

```typescript
// WRONG -- theme() is read after await, not tracked
effect(async () => {
  const data = await fetchData();
  console.log(`Theme: ${theme()}`); // theme changes won't re-trigger
});

// CORRECT -- read signals before await
effect(async () => {
  const currentTheme = theme(); // tracked
  const data = await fetchData();
  console.log(`Theme: ${currentTheme}`);
});
```

### Dynamic Dependencies

Like `computed()`, effects track dependencies dynamically. Only signals read in the most recent execution are tracked:

```typescript
effect(() => {
  if (showDetails()) {
    console.log('Details:', details()); // tracked only when showDetails is true
  } else {
    console.log('Summary view');
    // details() is NOT a dependency here
  }
});
```

---

## effect() with NgRx SignalStore

### Watching Store Signals from Components

The most common pattern: a component watches store signals for UI side effects (toast, navigation, analytics):

```typescript
@Component({ /* ... */ })
export class OrderPage {
  private readonly store = inject(OrderStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  constructor() {
    // Navigate on success
    effect(() => {
      if (this.store.orderConfirmed()) {
        this.router.navigate(['/orders', this.store.orderId()]);
      }
    });

    // Show error toast
    effect(() => {
      const err = this.store.error();
      if (err) this.toast.showError(err);
    });
  }
}
```

Rule: The store owns state. The component owns UI side effects. effect() is the bridge.

### Inside withHooks (Store Lifecycle Effects)

Use effect() inside `withHooks` `onInit` for store-level side effects that run in injection context:

```typescript
export const PreferencesStore = signalStore(
  { providedIn: 'root' },

  withState({ theme: 'light' as 'light' | 'dark' }),

  withMethods((store) => ({
    setTheme(theme: 'light' | 'dark') {
      patchState(store, { theme });
    },
  })),

  withHooks({
    onInit(store) {
      // Runs in injection context -- sync theme to document
      effect(() => {
        document.documentElement.setAttribute('data-theme', store.theme());
      });
    },
  })
);
```

### What NOT to Do: effect() as Store Logic

Never use effect() to drive store state changes. That breaks the unidirectional data flow:

```typescript
// WRONG -- using effect to sync signals inside a store
withHooks({
  onInit(store) {
    effect(() => {
      // This causes ExpressionChangedAfterItHasBeenChecked errors
      // and creates hidden, hard-to-debug feedback loops
      if (store.items().length > 0) {
        patchState(store, { hasItems: true });
      }
    });
  },
})

// CORRECT -- use computed
withComputed(({ items }) => ({
  hasItems: computed(() => items().length > 0),
}))
```

### Prefer rxMethod / signalMethod for Store Side Effects

For async operations inside the store (HTTP calls, streaming, polling), use `rxMethod` or `signalMethod`, not effect():

```typescript
// CORRECT -- rxMethod handles async with proper cancellation
withMethods((store, repo = inject(ItemRepository)) => ({
  load: rxMethod<void>((trigger$) =>
    trigger$.pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() =>
        repo.getItems$().pipe(
          tapResponse({
            next: (items) => patchState(store, { items, loading: false }),
            error: (e) => patchState(store, { error: normalizeError(e), loading: false }),
          })
        )
      )
    )
  ),
}))
```

---

## afterRenderEffect: DOM-Specific Side Effects

When you need to read or write the DOM after Angular has rendered, use `afterRenderEffect` instead of `effect()`.

`effect()` runs before DOM updates. `afterRenderEffect` runs after.

```typescript
@Component({ /* ... */ })
export class ChartComponent {
  chartData = input.required<ChartData>();
  canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  chart: ChartInstance;

  constructor() {
    afterNextRender({
      write: () => {
        this.chart = initializeChart(this.canvas().nativeElement, this.chartData());
      },
    });

    afterRenderEffect(() => {
      this.chart.updateData(this.chartData());
    });
  }
}
```

### Render Phases

`afterRenderEffect` supports four phases to avoid layout thrashing:

| Phase | Purpose | Rule |
|-------|---------|------|
| `earlyRead` | Read DOM before a write (custom layout) | Never write in this phase |
| `write` | Write to the DOM | Never read in this phase |
| `mixedReadWrite` | Read and write simultaneously | Avoid if possible |
| `read` | Read from the DOM after writes | Never write in this phase |

```typescript
afterRenderEffect({
  earlyRead: (onCleanup) => {
    return element.getBoundingClientRect();
  },
  write: (rect, onCleanup) => {
    overlay.style.top = `${rect().top}px`;
  },
});
```

Prefer `read` and `write` phases over `earlyRead` and `mixedReadWrite` for better performance.

Note: `afterRenderEffect` runs on browser platforms only. It does not run on the server.

---

## Do and Don't

| Do | Don't |
|----|-------|
| Use effect() for logging, analytics, localStorage sync | Use effect() to derive state (use `computed()`) |
| Use effect() for syncing to imperative 3rd-party APIs | Use effect() to copy one signal's value into another |
| Use `onCleanup` for timers, subscriptions, listeners | Forget cleanup -- leaked timers cause subtle bugs |
| Read all signals before `await` in async effects | Read signals after `await` (they won't be tracked) |
| Use `untracked()` for incidental reads | Create implicit dependencies on signals you don't care about |
| Keep effects in components for UI side effects | Put toast/navigation logic inside the store |
| Use `afterRenderEffect` for DOM reads/writes | Use `effect()` to measure or modify the DOM |
| Use `rxMethod` or `signalMethod` for store async | Use `effect()` inside `withMethods` for HTTP calls |

---

## Common Pitfalls

### 1. Setting Signal Values Inside effect()

This is the most common mistake. Setting a signal inside an effect that reads other signals can cause `ExpressionChangedAfterItHasBeenChecked` errors, infinite loops, or unnecessary change detection cycles.

```typescript
// RED FLAG -- signal mutation inside effect
effect(() => {
  const items = this.store.items();
  this.filteredCount.set(items.filter(i => i.active).length); // WRONG
});

// FIX -- use computed
readonly filteredCount = computed(() =>
  this.store.items().filter(i => i.active).length
);
```

### 2. Accidental Dependencies

Reading signals you don't intend to track creates effects that run too often:

```typescript
// Runs on EVERY change to either signal
effect(() => {
  console.log(`User: ${user()}, Theme: ${theme()}`);
});

// If you only want to react to user changes:
effect(() => {
  const u = user();
  const t = untracked(theme);
  console.log(`User: ${u}, Theme: ${t}`);
});
```

### 3. Missing Cleanup

```typescript
// BUG -- interval leaks when component is destroyed
effect(() => {
  const id = setInterval(() => poll(resource()), 5000);
  // No cleanup registered!
});

// FIX
effect((onCleanup) => {
  const id = setInterval(() => poll(resource()), 5000);
  onCleanup(() => clearInterval(id));
});
```

### 4. Async Context Loss

```typescript
// BUG -- searchTerm is read after await, not tracked
effect(async () => {
  const results = await search(searchTerm());
  // searchTerm changes won't re-trigger the effect
});

// FIX -- capture before await
effect(async () => {
  const term = searchTerm();
  const results = await search(term);
  displayResults(results);
});
```

### 5. Using effect() Where rxMethod is Better

If the side effect involves HTTP calls, cancellation, debounce, retry, or concurrency control, `rxMethod` is the right tool. effect() has no built-in operators for these concerns.

---

## Decision Guide

```
Need derived state?
  YES --> computed()
  Need it writable?
    YES --> linkedSignal()
    NO  --> computed()

Need to sync to imperative API?
  YES --> Does it need post-render DOM access?
    YES --> afterRenderEffect()
    NO  --> effect()

Need async with cancellation/retry/debounce?
  YES --> rxMethod (inside store) or rxjs pipe (in service)

Need lightweight fire-and-forget in store?
  YES --> signalMethod

None of the above?
  Probably don't need effect(). Re-examine.
```

---

## Tradeoffs at a Glance

| Approach | Strength | Weakness |
|----------|----------|----------|
| `computed()` | Pure, memoized, no side effects | Read-only, synchronous only |
| `linkedSignal()` | Writable + derived | Newer API, less ecosystem awareness |
| `effect()` | Bridges reactive to imperative | Easy to misuse, no cancellation operators |
| `afterRenderEffect()` | Safe DOM access, phased execution | Browser-only, not for state logic |
| `rxMethod` | Full RxJS operator power, cancellation | Heavier, requires RxJS knowledge |
| `signalMethod` | Lightweight, no RxJS needed | No built-in concurrency control |
