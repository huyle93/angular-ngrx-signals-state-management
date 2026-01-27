---
description: Refactors an existing component to use modern signal-based patterns
---

# Refactor Component to Signals

You are refactoring an existing Angular component to use modern signal-based state management.

## Context

This repository uses Angular 21 with:
- Signal-based reactivity (not RxJS for local state)
- Zoneless change detection
- OnPush strategy
- Modern control flow syntax

## Refactoring Checklist

### 1. Replace Observables with Signals (Local State Only)

❌ **Before:**
```typescript
private count$ = new BehaviorSubject(0);
readonly count = this.count$.asObservable();
```

✅ **After:**
```typescript
protected readonly count = signal(0);
```

### 2. Replace Derived Observables with Computed

❌ **Before:**
```typescript
readonly doubled = this.count$.pipe(map(c => c * 2));
```

✅ **After:**
```typescript
protected readonly doubled = computed(() => this.count() * 2);
```

### 3. Update Template Syntax

❌ **Before:**
```html
<div *ngIf="count$ | async as count">
  Count: {{ count }}
</div>
```

✅ **After:**
```html
@if (count(); as count) {
  <div>Count: {{ count }}</div>
}
```

### 4. Replace Lifecycle Hooks with Effects (If Needed)

❌ **Before:**
```typescript
ngOnInit() {
  this.count$.subscribe(count => {
    console.log('Count changed:', count);
  });
}
```

✅ **After:**
```typescript
constructor() {
  effect(() => {
    console.log('Count changed:', this.count());
  });
}
```

### 5. Update Method Implementations

❌ **Before:**
```typescript
increment() {
  this.count$.next(this.count$.value + 1);
}
```

✅ **After:**
```typescript
protected increment() {
  this.count.update(c => c + 1);
}
```

## Important Rules

1. **Keep RxJS for:**
   - HTTP requests (but use `toSignal()` to consume)
   - Event streams from external sources
   - Complex async operations

2. **Use Signals for:**
   - Component state
   - Derived values
   - UI state
   - Form state (when not using reactive forms)

3. **Always:**
   - Add `protected readonly` to template-exposed signals
   - Use OnPush change detection
   - Convert control flow to modern syntax
   - Update tests to work with signals

## Conversion Pattern for Async Data

❌ **Before:**
```typescript
users$ = this.http.get<User[]>('/api/users');
```

✅ **After:**
```typescript
private users$ = this.http.get<User[]>('/api/users');
protected readonly users = toSignal(this.users$, { initialValue: [] });
```

## Update Tests

- Access signals with `component.count()` not `component.count`
- Test signal updates with `expect(component.count()).toBe(1)`
- Test computed reactivity
- Remove async/fakeAsync if no longer needed

## Output

Provide the refactored component with:
1. Updated signal-based implementation
2. Modern template syntax
3. Updated tests
4. Brief explanation of key changes
