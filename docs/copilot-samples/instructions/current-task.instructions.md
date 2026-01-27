# Mission: Portfolio Domain Store Ownership Setup (Pattern-First)

## Mission statement
Establish the correct, modern pattern for how this app uses:
- data-access (generated client.ts / HTTP layer)
- NgRx SignalStores (domain-owned state + orchestration)
- page/container composition (portfolio page composes multiple domain stores)

This work may replace existing implementations, but treat it as a **pattern-first setup** rather than “refactor the old code.”

## Source of truth
- This file (`current-task.instructions.md`) is the source of truth for this mission.
- The existing “bad” PortfolioStore is **reference only** for inventory and parity checks. Do not refactor it in place first.

## Definition of Done
- PortfolioStore is implemented using modern SignalStore patterns and owns only portfolio domain state.
- Portfolio page/container composes required domain stores (portfolio + watchlist + search + profile + market-data/security if applicable).
- All API access is routed through the existing generated `client.ts` (or the approved data-access wrapper that calls it).
- No cross-domain imports inside PortfolioStore (avoid cycles).
- No cross-domain state in PortfolioStore (watchlist/search/profile/security details).
- Build passes:
  - Fastest build command (e.g., `nx affected -t build` or `nx build <app>`)
  - Lint/test if time permits

## Primary approach (strict order)
1) Inventory (read-only)
   - List legacy PortfolioStore state keys + methods.
   - Classify each into owner domain: portfolio | watchlist | search | profile | market-data/security | other.
   - Produce an extraction table (below). No code generation yet.
2) Define the PortfolioStore spec (below) and confirm public API.
3) Implement a new PortfolioStore from the spec
   - Create a new file (e.g., `portfolio.store.ts` or `portfolio.store.refactored.ts` depending on your migration strategy).
   - Wire all API calls through existing `client.ts` methods (directly or via a thin data-access wrapper).
4) Migrate the portfolio page/container to compose stores
   - Portfolio page reads portfolio state from PortfolioStore.
   - Watchlist actions/data from WatchlistStore.
   - Search query/history/results from SearchStore.
   - Profile gating/context from ProfileStore.
   - Market-data/security details from MarketData/SecurityStore (or existing correct owner).
5) Remove legacy wiring
   - Replace imports/usages of the legacy store.
   - Delete or strip the legacy PortfolioStore after parity and build are green.
6) Validate fast and iterate
   - Run builds early/often; fix errors without reintroducing forbidden state.

## PortfolioStore spec (authoritative)

### Allowed PortfolioStore state (strict)
- `portfolio` (portfolio aggregates / positions / balances as portfolio domain defines)
- `accounts` (only if used for portfolio scoping; otherwise belongs elsewhere)
- `selectedAccountId`
- `selectedHoldingId` (store ID only; derive selected holding via computed)
- `isLoading` (or `loadStatus`)
- `error` (typed error shape if exists)

### Forbidden in PortfolioStore (must not exist)
- Any watchlist state: items, limits, flags, delete confirmation, etc.
- Any search state: query, results, history, selection.
- Any profile state: user profile, username, account profile flags.
- Security details / quotes / market-data caching (unless explicitly defined as portfolio-owned in this mission).
- UI transient flags: confirmation dialogs, toast state, “deletedSymbol”, etc. (belongs to component UI state or owning domain store).

### Required PortfolioStore public API (minimal, stable)
- `loadPortfolio(scope)` (scope includes `selectedAccountId` if applicable)
- `refresh()` (reload current scope)
- `selectAccount(accountId)`
- `selectHolding(holdingId | null)`
- Derived/computed signals:
  - `selectedAccount`
  - `selectedHolding`
  - `positions` / `holdings`
  - any portfolio-domain computed totals (only if truly portfolio-owned)

## API wiring requirement (client.ts)
- All network calls must use the existing generated `client.ts` methods.
- If needed, create a thin `portfolio-data-access` wrapper that calls `client.ts`:
  - data-access owns transport/mapping concerns
  - PortfolioStore orchestrates calls and owns state
- Do not call HTTP directly from components.

## Page composition requirement (Portfolio shell/container)
The Portfolio page/container composes multiple stores:
- PortfolioStore: portfolio domain only
- WatchlistStore: watchlist domain only (add/remove/list/limits)
- SearchStore: search domain only (query/history/results/navigation triggers)
- ProfileStore: profile domain only (user context, gating, account context if that is profile-owned)
- MarketData/SecurityStore: quotes/security details (if present)

## Inventory / extraction table (fill this in during Phase 1)
| Legacy key/method | Classified owner | Destination | Action | Notes |
|---|---|---|---|---|
| portfolio | portfolio | PortfolioStore | keep | |
| accounts | portfolio or profile | TBD | keep/move | decide based on usage |
| selectedAccountId | portfolio | PortfolioStore | keep | |
| selectedHolding | portfolio | PortfolioStore | replace | convert to selectedHoldingId |
| watchlist* | watchlist | WatchlistStore | move/delete from portfolio | |
| search* | search | SearchStore | move/delete from portfolio | |
| userProfile/userName | profile | ProfileStore | move/delete from portfolio | |
| securityDetails | market-data/security | MarketData/SecurityStore | move/delete from portfolio | |
| UI confirms/toasts | UI | component | move | |

## Constraints to prevent rabbit holes
- Do not “clean up” unrelated code.
- Do not re-architect unrelated domains.
- Do not introduce new shared/global stores unless explicitly required.
- Prefer minimal diffs and incremental compile passes.
- If a needed method is missing in Watchlist/Search/Profile stores, add a minimal method there rather than pulling state into PortfolioStore.

## Commands (adjust as needed)
- Build (fast): `nx affected -t build`
- Optional: `nx affected -t lint,test`
- Ownership leak scan:
  - `rg -n "watchlist|search|profile|securityDetails|recentSearch" libs/**/portfolio*`

## Notes / decisions log
Record decisions here as you go (prevents backtracking):
- Accounts ownership decision:
- Security details ownership decision:
- Any temporary UI-local state decisions: