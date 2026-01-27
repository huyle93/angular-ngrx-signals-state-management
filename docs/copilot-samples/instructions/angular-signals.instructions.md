---
applyTo: "**/*.{ts,html}"
---

# Angular Signals & Zoneless Architecture (v21+)

> Signal-first, zoneless Angular for optimal performance with NgRx Signals.

## Core Principle

**Signals are the source of truth.** Angular tracks signal reads to know when to update the DOM. No zones, no magic—explicit reactivity.

---

## 1. Zoneless Setup

```typescript
// app.config.ts
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // ... other providers
  ],
};
```

Remove `zone.js` from `angular.json` polyfills and uninstall:
```bash
npm uninstall zone.js
```

---

## 2. Signal Primitives (Use in This Order)

| Priority | API | Purpose | When to Use |
|----------|-----|---------|-------------|
| 1 | `signal()` | Writable state | Local component/service state |
| 2 | `computed()` | Derived readonly | Pure transformations of signals |
| 3 | `linkedSignal()` | Derived + writable | State that resets when source changes |
| 4 | `effect()` | Side effects | **Last resort**—sync to non-signal APIs |

### signal() — Writable State
```typescript
readonly count = signal(0);

// Read
console.log(this.count());

// Write
this.count.set(5);
this.count.update(c => c + 1);
```

### computed() — Derived State (Preferred)
```typescript
readonly total = computed(() => this.items().reduce((sum, i) => sum + i.price, 0));
```
- Lazily evaluated and memoized
- Dependencies tracked automatically
- **Always pure—no side effects**

### linkedSignal() — Resettable Derived State
```typescript
// Resets to first option when options change, but user can override
readonly selectedOption = linkedSignal(() => this.options()[0]);

// With previous value preservation
readonly selectedId = linkedSignal<Options[], string>({
  source: this.options,
  computation: (newOptions, previous) =>
    newOptions.find(o => o.id === previous?.value) ?? newOptions[0],
});
```

### effect() — Side Effects (Use Sparingly)
```typescript
constructor() {
  effect(() => {
    // Sync to localStorage, analytics, or imperative APIs
    localStorage.setItem('count', JSON.stringify(this.count()));
  });
}
```

**Valid use cases:**
- Logging/analytics
- `localStorage`/`sessionStorage` sync
- Third-party library integration
- Canvas/WebGL rendering

**Never use effect() to:**
- Copy data between signals (use `computed()` or `linkedSignal()`)
- Trigger state changes that cause infinite loops

---

## 3. Component Inputs/Outputs (Signal-Based)

```typescript
@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ user().name }}</h2>
    <button (click)="onSelect()">Select</button>
  `,
})
export class UserCardComponent {
  // Signal inputs (readonly signals)
  readonly user = input.required<User>();
  readonly highlight = input(false);  // with default

  // Signal outputs
  readonly selected = output<User>();

  onSelect() {
    this.selected.emit(this.user());
  }
}
```

---

## 4. Resource API (Experimental in v21)

> ⚠️ **Experimental**: API may change before stabilization.

`resource()` bridges async data into the signal graph.

```typescript
import { resource, Signal } from '@angular/core';

readonly userId: Signal<string> = input.required();

readonly userResource = resource({
  params: () => ({ id: this.userId() }),
  loader: async ({ params, abortSignal }) => {
    const response = await fetch(`/api/users/${params.id}`, { signal: abortSignal });
    return response.json();
  },
});

// In template
@if (userResource.isLoading()) {
  <spinner />
} @else if (userResource.hasValue()) {
  <user-profile [user]="userResource.value()" />
} @else if (userResource.error()) {
  <error-message [error]="userResource.error()" />
}
```

**Resource status values:** `'idle'` | `'loading'` | `'reloading'` | `'resolved'` | `'error'` | `'local'`

**Reload programmatically:**
```typescript
this.userResource.reload();
```

**httpResource (stable)** — For HTTP requests, prefer:
```typescript
import { httpResource } from '@angular/common/http';

readonly users = httpResource<User[]>(() => `/api/users`);
```

---

## 5. Template Patterns

### Control Flow (Required)
```html
@if (isLoading()) {
  <loading-spinner />
} @else {
  <content />
}

@for (item of items(); track item.id) {
  <item-row [item]="item" />
} @empty {
  <p>No items</p>
}

@switch (status()) {
  @case ('active') { <active-badge /> }
  @case ('pending') { <pending-badge /> }
  @default { <unknown-badge /> }
}
```

**Never use:** `*ngIf`, `*ngFor`, `*ngSwitch`

### Signal Reads in Templates
```html
<!-- Direct signal read -->
<p>Count: {{ count() }}</p>

<!-- Computed in template (avoid complex logic) -->
<p>Total: {{ total() }}</p>
```

---

## 6. Change Detection Requirements

For zoneless to work, Angular must be notified of changes via:

1. **Signal updates** — `signal.set()`, `signal.update()`
2. **Template event bindings** — `(click)="handler()"`
3. **AsyncPipe** — calls `markForCheck()` internally
4. **ComponentRef.setInput()** — for dynamic components

### OnPush Is Required
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,  // ALWAYS
  // ...
})
```

### Manual Notification (Rare)
```typescript
private cdr = inject(ChangeDetectorRef);

// Only when integrating non-signal async code
someCallback() {
  this.legacyValue = newValue;
  this.cdr.markForCheck();
}
```

---

## 7. RxJS Interop

### toSignal() — Observable → Signal
```typescript
import { toSignal } from '@angular/core/rxjs-interop';

readonly route$ = inject(ActivatedRoute).params;
readonly routeParams = toSignal(this.route$, { initialValue: {} });
```

### toObservable() — Signal → Observable
```typescript
import { toObservable } from '@angular/core/rxjs-interop';

readonly searchTerm = signal('');
readonly searchTerm$ = toObservable(this.searchTerm);
```

### takeUntilDestroyed() — Auto-cleanup
```typescript
constructor() {
  this.source$.pipe(
    takeUntilDestroyed(),
  ).subscribe(value => this.mySignal.set(value));
}
```

---

## 8. DOM Side Effects

### afterRenderEffect() — Post-render DOM access
```typescript
import { afterRenderEffect, viewChild, ElementRef } from '@angular/core';

readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

constructor() {
  afterRenderEffect(() => {
    const ctx = this.canvas().nativeElement.getContext('2d');
    ctx?.fillRect(0, 0, this.width(), this.height());
  });
}
```

**Phases (for performance):**
- `earlyRead` — Read DOM before writes
- `write` — Mutate DOM (never read here)
- `mixedReadWrite` — Avoid if possible
- `read` — Read DOM after writes

### afterNextRender() — One-time initialization
```typescript
afterNextRender({
  write: () => {
    this.chart = new Chart(this.canvas().nativeElement, config);
  },
});
```

---

## 9. Testing Zoneless Components

```typescript
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

describe('MyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('updates when signal changes', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.componentInstance.count.set(5);
    
    await fixture.whenStable();  // Preferred over detectChanges()
    
    expect(fixture.nativeElement.textContent).toContain('5');
  });
});
```

---

## 10. Integration with NgRx Signals

Signals and NgRx SignalStore work seamlessly together:

```typescript
// In component
readonly store = inject(DomainStore);

// Store signals are directly usable
readonly items = this.store.entities;
readonly isLoading = this.store.isLoading;

// Derive from store signals
readonly filteredItems = computed(() =>
  this.items().filter(item => item.status === this.filterStatus())
);
```

**Key pattern:** Components read from SignalStore, derive with `computed()`, and delegate mutations to store methods.

---

## Quick Reference: Signal Selection

| Scenario | Use |
|----------|-----|
| Simple local state | `signal()` |
| Derived value | `computed()` |
| Derived + user can override | `linkedSignal()` |
| Async data fetch | `resource()` / `httpResource()` |
| Convert Observable | `toSignal()` |
| Sync to imperative API | `effect()` |
| DOM manipulation | `afterRenderEffect()` |

---

## Anti-Patterns to Avoid

❌ **Mutating signal values directly**
```typescript
// BAD
this.items().push(newItem);

// GOOD
this.items.update(items => [...items, newItem]);
```

❌ **Side effects in computed()**
```typescript
// BAD
computed(() => {
  console.log('Computing...');  // Side effect!
  return this.a() + this.b();
});
```

❌ **Copying signals with effect()**
```typescript
// BAD
effect(() => this.copy.set(this.source()));

// GOOD
readonly copy = computed(() => this.source());
```

❌ **Using NgZone APIs in zoneless**
```typescript
// BAD - these never fire in zoneless
ngZone.onStable.subscribe(...)
ngZone.onMicrotaskEmpty.subscribe(...)
```

---

## References

- [Angular Signals Guide](https://angular.dev/guide/signals)
- [Zoneless Angular](https://angular.dev/guide/zoneless)
- [Resource API](https://angular.dev/guide/signals/resource)
- [linkedSignal](https://angular.dev/guide/signals/linked-signal)
- [effect](https://angular.dev/guide/signals/effect)
