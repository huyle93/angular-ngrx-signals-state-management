# Architecture Rules

These are non-negotiable for consistency across the codebase.

---

## Layering

```
UI (page/component)
    |
    v
Store (SignalStore)
    |
    v
Repository (data-access)
    |
    v
API Client (OpenAPI)
```

Rules:

- UI must not call API directly
- Store must not import API clients directly
- Store calls Repository only
- Repository calls API client

---

## Store is UI-Agnostic

Store never calls:

- ToastController
- AlertController
- Router navigation
- Modal/sheet controllers

Store exposes state. UI decides what to show.

```typescript
// Store exposes error signal
error: computed(() => store.errorMessage()),

// UI shows toast based on error
effect(() => {
  const err = store.error();
  if (err) this.toast.show(err);
});
```

---

## Store Scope

**Global (providedIn: root):**

Use for state shared across app:

- ProfileStore (user identity)
- PortfolioStore (account data)
- FeatureFlagsStore (cross-cutting)

**Feature-scoped (provided at route):**

Use for state that resets on navigation:

- Onboarding wizard
- Search results
- Form wizard

Rule: Favor global for shared read models. Favor feature scope for transient flows.

---

## Store-to-Store Communication

### Pattern A: Read from Context Store

Use when you need shared context (account number, user ID):

```typescript
withMethods((store, profile = inject(ProfileStore)) => ({
  load: rxMethod<void>((trigger$) =>
    trigger$.pipe(
      switchMap(() => {
        const accountId = profile.accountId();
        if (!accountId) return EMPTY;
        return repo.getData$(accountId);
      })
    )
  ),
}))
```

Rules:

- Store B must not mutate Store A
- Keep clear dependency direction
- Never create circular dependencies

### Pattern B: Pass as Parameter

Use when caller has the value:

```typescript
store.previewOrder({ accountNumber: '123', symbol: 'AAPL' });
```

### Pattern C: Events

Use for cross-domain coordination (login/logout, session changes):

```typescript
// Login succeeded -> load profile, portfolio, watchlist
```

---

## Nx Boundaries

```
libs/
  portfolio/
    data-access/   <- stores + repositories
    feature-*/     <- consumes stores, does not define them
```

- `data-access`: stores and repositories
- `feature-*`: UI components that use stores
- Avoid circular dependencies
- Enforce direction in dependency graph

---

## PR Checklist

Before merging, verify:

- [ ] UI does not call repository/API directly
- [ ] Store calls repository only
- [ ] API calls use rxMethod + tapResponse + finalize
- [ ] Correct concurrency operator chosen
- [ ] Derived state is computed, not stored
- [ ] Store is UI-agnostic (no toasts/router)
- [ ] No circular store dependencies
