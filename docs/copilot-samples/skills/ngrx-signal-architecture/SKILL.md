---
name: ngrx-signalstore-architecture
description: Enforce Nx domain ownership and modern NgRx SignalStore patterns (data-access → store → page composition). Use for refactors that remove cross-domain state, prevent god stores, define minimal store state, and implement repeatable migration steps with fast validation.
---

# Skill Instructions: NgRx SignalStore Architecture

## What this skill helps accomplish
- Create or refactor domain stores using modern NgRx SignalStore patterns.
- Enforce domain ownership and Nx boundaries.
- Migrate “god stores” into a composition model at the page/container layer.
- Establish consistent patterns for data-access ownership, API orchestration, and derived state.
- Execute migrations quickly without rabbit-hole refactors.

## When to use this skill
Use this skill when the request involves any of:
- SignalStore creation/refactor
- Data-access ownership changes
- Removing cross-domain state from a domain store
- Page/container composition across multiple domain stores
- Establishing shared patterns for the app (repeatable across domains)

## Non-negotiable rules
- Domain store owns only domain state and orchestration.
- Page/shell composes domain stores; domain stores do not merge other domains’ state.
- Data-access libs own API calls; stores orchestrate; components bind.
- Do not refactor a god store in place first. Use inventory → rebuild-from-spec → migrate → delete old.
- Prefer IDs in state and derive objects via computed.
- Computed must be pure; side effects only in rxMethod/signalMethod or approved effect pattern.
- Avoid cross-domain imports inside domain stores. Prevent cycles.

## Default migration workflow (use this exact order)
1) Inventory (read-only)
   - List state keys and methods in the legacy store.
   - Classify each into a domain owner: trading | portfolio | watchlist | search | profile | market-data | other.
   - Output an extraction table and a minimal file change list. No code generation yet.
2) Define spec
   - Write the minimal allowed state + public API for the domain store.
   - Explicitly list forbidden state.
3) Rebuild-from-spec
   - Create a new store file from the spec (do not “clean up” old code).
   - Use templates in `./templates/`.
4) Compose at the page/container layer
   - Wire the page to read from multiple domain stores.
   - Delegate actions to the owning store (watchlist add/remove, search navigation, profile gating).
5) Remove legacy code
   - Delete or strip old store fields/methods and remove cross-domain state.
6) Validate fast
   - Run the fastest build command frequently.
   - Fix errors iteratively without reintroducing cross-domain state.

## Output format expected from the agent
For any store refactor request, produce:
- A short plan with the workflow phase you are executing.
- An extraction table (during inventory).
- A list of files to add/change/delete.
- Code changes that are minimal and compile.
- A short PR checklist at the end.

## Templates and resources
- Store template: [templates/signalstore.store.template.ts](./templates/signalstore.store.template.ts) (includes `withEntities` alternative)
- Data-access template: [templates/data-access.service.template.ts](./templates/data-access.service.template.ts)
- Ownership checklist: [checklists/store-ownership-checklist.md](./checklists/store-ownership-checklist.md)
- Migration playbook: [checklists/migration-playbook.md](./checklists/migration-playbook.md)
- Quick audit script: [scripts/rg-ownership-audit.sh](./scripts/rg-ownership-audit.sh)