# Store Ownership Checklist

## Store owns only domain state
- [ ] No watchlist/search/profile/securityDetails in unrelated stores
- [ ] No cross-domain imports inside the domain store
- [ ] State shape is minimal (IDs + derived selectors)
- [ ] Uses `withEntities` for entity collections OR manual `entitiesById` pattern

## Data-access boundary
- [ ] API calls live in data-access libs/services
- [ ] Store orchestrates via injected data-access
- [ ] Components do not call APIs directly
- [ ] Data-access handles error normalization

## SignalStore correctness
- [ ] Computed selectors are pure (no side effects)
- [ ] Side effects in `rxMethod` or `signalMethod` only
- [ ] Clear load status + error handling pattern
- [ ] Public API is small and predictable
- [ ] Uses destructured store params in `withComputed`/`withMethods` to avoid implicit any
- [ ] `withHooks` used for initialization when needed

## Page composition
- [ ] Page container composes stores
- [ ] Actions delegated to owning store
- [ ] No state duplication across stores
- [ ] Cross-domain reads use injection, not store merging

## Validation
- [ ] `nx affected:test` passes
- [ ] `nx lint <project>` passes
- [ ] No cycles introduced (check with `nx graph`)
- [ ] PR scope remains focused

## Testing
- [ ] Store has unit tests for computed selectors
- [ ] Store has unit tests for methods (mock data-access)
- [ ] Integration tests cover critical flows