# Migration Playbook: De-god-store

## Phase 1: Inventory (read-only)
- Extract:
  - state keys
  - methods
  - side effects (API calls, storage)
- Classify each into an owner domain (trading | portfolio | watchlist | search | profile | market-data | other).
- Produce an extraction table and file change list.
- **No code changes in this phase.**

## Phase 2: Rebuild-from-spec
- Write minimal allowed state + public API for the new domain store.
- Generate a new store file from templates (`signalstore.store.template.ts`).
- Choose `withEntities` or manual entity map based on collection complexity.
- Do not port cross-domain state.
- Add `withHooks` for initialization if needed.

## Phase 3: Compose
- Update page container/shell to:
  - read from multiple stores via injection
  - delegate actions to owning stores
- Keep UI behavior the same.
- Use `computed` at page level to combine cross-domain data if needed.

## Phase 4: Remove legacy
- Strip legacy store fields/methods or delete file after migration.
- Remove unused selectors and update imports.
- Run `nx affected:lint` to catch dead imports.

## Phase 5: Validate fast
- Run validation commands frequently:
  ```bash
  nx affected:test --base=main
  nx affected:lint --base=main
  nx graph  # Check for cycles
  ```
- Fix errors iteratively without reintroducing cross-domain state.
- If build breaks, check import paths first.

## Rollback strategy
- Keep legacy store intact until new store is fully validated.
- Use feature flags if available to toggle between implementations.
- Merge in small PRs (one domain at a time).