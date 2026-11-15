# A3 validation — 2026-11-15

Implementation experiment; human adoption review remains pending. Base `main`: `69c84e5719de283c0658353b41e47efbd355b78a`, verified against the remote before edits. Branch: `feat/a3-adaptive-fi`. Review/CI are bound to the PR's final commit, not this document's existence.

## Baseline (before implementation)

Node `v24.11.0`, npm `11.6.1`; locked Angular `21.1.1`, Ionic `8.8.3`, Nx `22.4.2`, TypeScript `5.9.3`. `npm ci --no-audit --no-fund` passed. Actual targets discovered via `npx nx show project web-app --json`: build, serve, test, lint, serve-static. The root npm test command was a failing placeholder.

`NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t build lint test -p web-app --skip-nx-cache`:

- Build passed; initial bundle 627.57 kB exceeded the existing 500 kB warning budget. Existing `nx-welcome.ts` style was 7.04 kB, over its 4 kB warning. Neither exceeded error budgets.
- Two existing tests passed.
- Lint failed: missing `@nx/eslint-plugin`. Source also referenced nonexistent `apps/.eslintrc.json` as though it were a flat config. Repair exposed one existing native-event output-name violation and an unused import. The scoped repair installs the matching Nx plugin, uses one root flat config, renames that output and removes the unused import. No disabled lint rule masks the failures.

Scoped dependency additions: `@ngrx/signals@21.0.1` and `@nx/eslint-plugin@22.4.2`. Existing lockfile package versions were preserved. npm reported audit findings (119 total after addition); dependency remediation is not part of this no-upgrade POC and this is not a security clearance.

## Executed commands and evidence

Use `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true` for local execution. The existing Nx Cloud connection returned 401 on an earlier run; local cache/cloud independence is explicit, and no account configuration was changed.

| Check                                                                                                                                                                                      | Result                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx nx run-many -t build,lint,test --projects=web-app,mobile-reference,instrument-util,instrument-data-access,instrument-ui,trading-feature,fi-web,fi-mobile,demo-design --skip-nx-cache` | Both production builds and all nine lint targets passed; 28 tests pass across nine files; the app tests now exercise sibling legacy/FI routing.                                                     |
| `npx nx run instrument-data-access:boundary-check`                                                                                                                                         | Six intended rejections passed, including a same-layer-compatible trading→instrument-state probe that specifically exercises the domain rule.                                                       |
| `npx nx serve web-app --port=4200` / `npx nx serve mobile-reference --port=4300`                                                                                                           | Both independently served `/fi/LUMA`.                                                                                                                                                               |
| `npx nx graph --file=/tmp/a3-graph.json`                                                                                                                                                   | Generated; [actual project edges](a3-project-graph.md).                                                                                                                                             |
| `npx nx format:write --files=<changed paths>` / `git diff --check`                                                                                                                         | Formatting applied only to changed files; whitespace check passed.                                                                                                                                  |
| `npx nx run web-app:browser-smoke`                                                                                                                                                         | Passed the scripted journeys in `tools/a3-browser-smoke.js`, including all five preserved routes, 320px ticket reachability, both themes, cancellation, recovery and mobile focus/draft continuity. |

New unit coverage includes deterministic fixtures/derived ranges; stale/out-of-order completion; cancellation on destruction; empty/error/recovery; amount validation and symbol isolation; flat SVG/data-table rendering; theme allowlisting; mobile disclosure continuity while typing. These are browser/unit checks, not native device tests.

## Browser findings and regression fixes

1. Ionic's inherited global structure stylesheet fixed/clipped the web body. A 320px browser could render the ticket yet could not scroll to its preview button. The web entrypoint now restores normal document scrolling; mobile retains `ion-content` ownership. The smoke script must reach and click the ticket at 320px; merely checking screenshot width was insufficient.
2. A symbol-change effect accidentally tracked internal draft reads, closing the mobile panel on typing. Its draft-selection call now uses `untracked`; a component regression test and browser typing/close/reopen journey cover this exact failure.
3. Independent review identified retry focus loss, missing wrapper tests, and a negative probe that did not isolate the domain rule. A persistent live status region now retains keyboard focus across retry; both wrappers have route/retry tests; six negative probes exercise layer, domain, native and state-library constraints. Empty/invalid history now produces unavailable state. Sibling route shells prevent a legacy header flash on FI deep links.
4. Browser assertions wait for Angular's observable rendered state rather than treating a dispatched click as completed rendering. Initial immediate-assertion runs were not recorded as passes.

Browser smoke ran with pinned Playwright CLI `0.1.24` and Chromium `157.0.8103.51`. Both web and mobile retry-focus checks passed. The existing trade-entry Invest→Buy interaction and keyboard tab sequence at 320px were also checked manually.

Semantic contrast measured in the rendered browser: text/background 13.42/13.65, muted/background 5.79/5.89, action foreground/background 7.86/8.76, focus/surface 6.95/7.19 (A/B). [Machine-readable smoke results](a3-browser-results.json). These ratios do not replace spoken screen-reader or complete accessibility auditing.

## Acceptance matrix

| Criterion             | Evidence / state                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 baseline          | Recorded above; no framework upgrades or rename. Preserved routes are covered by browser smoke.                                                                                                                                                                |
| AC2 runtimes          | Independent web/mobile builds and dev servers; distinct route components.                                                                                                                                                                                      |
| AC3 shared capability | Actual Nx graph plus input/output components; one instrument store source, separate trade owner.                                                                                                                                                               |
| AC4 layout            | 1440px: two tracks (824px + 336px); 768/320px: one track. Same web component type throughout.                                                                                                                                                                  |
| AC5 continuity        | 1440→768→320→1440 preserves `3M`, partial `125.`, identical chart/ticket DOM instances and counts of one.                                                                                                                                                      |
| AC6 themes            | Both visual themes, explicit startup `?brand=b`, state-preserving appearance changes and computed semantic contrast checks. No identity/authorization proof.                                                                                                   |
| AC7 quality           | 320px reflow, keyboard panel interactions, focus return, accessible labels/table, loading/empty/error checks. **200/400% native browser zoom pending: Mac locked, CUA unavailable.** Spoken screen-reader and physical touch/keyboard-device behavior not run. |
| AC8 boundaries        | Graph, tags, flat lint config, six expected negative rejections. CI invokes the same target.                                                                                                                                                                   |
| AC9 tests             | Unit/build/lint and browser evidence; final-commit remote CI and independent review are recorded on PR #1.                                                                                                                                                     |
| AC10 learnability     | Local task, guide, ADR, graph, screenshots and this record; no private source required.                                                                                                                                                                        |

## Scope limits and next decision

No native shell, platform gestures, safe-area behavior, system keyboard avoidance, actual brokerage operation, backend tenancy or production capacity was tested. Desktop Chromium is the browser evidence; no Safari/Firefox claim. A mobile-sized browser is not a physical phone. The draft is intentionally ephemeral and resets on symbol changes, simulated data loss, route exit and reload.

Huy reviews the unmerged experiment and whether distinct entrypoints merit their ongoing build/test cost. Actual browser zoom remains pending acceptance evidence. Spoken screen-reader testing is an untested limitation, not an additional adoption gate.

## Screenshots

[Wide Demo A](../../output/playwright/a3/web-wide-a.png) · [Wide Demo B](../../output/playwright/a3/web-wide-b.png) · [320px web](../../output/playwright/a3/web-320-b.png) · [Mobile A](../../output/playwright/a3/mobile-a.png) · [Mobile B](../../output/playwright/a3/mobile-b.png) · [Mobile panel](../../output/playwright/a3/mobile-panel-b.png)

## Preview playground follow-up

Follow-up starts at `73d9e60e4c3bf7467eb9519e21c71b9e1a7eaeb3`, against current main `938ebc9c9944ef149fe5c545b62c616352e5285e`. Repository history changed concurrently; original baseline/review receipts above describe their historical refs. Final follow-up review/CI use the current refs on the PR. Subsequently rebased onto main `1dd05369b2637fda77840ae7da3780cdb7d37779`, including the commit-hygiene hooks and shared agent guidance. The package-script conflict keeps both `nx test web-app` and the hook-installing `prepare` script. App/library/tool source is unchanged by this rebase.

User requested a demo preview comparable to trade-entry, with desktop/mobile choices and the actual Ionic application. `/fi-preview` is now linked from the existing navigation and home. Its one iframe supports Desktop web, Mobile web and Ionic mobile; 320/390px phone presets, Reload preview and Open standalone. App-local `PreviewFrameComponent` is shared with trade-entry, with no new domain import or dependency.

Executed the full nine-project build/lint/test command listed above again for this follow-up: both production builds, all nine lint targets and 29 tests across ten files pass (including the new iframe continuity/source/reload test). Existing initial/style budget warnings remain. `instrument-data-access:boundary-check` still passes all six negative probes. No domain code changed.

Chromium preview smoke passed: desktop FI has two tracks; desktop→320px web→desktop preserves the same chart DOM marker, selected 3M and partial 125.; exact iframe width/document scroll width are both 320px. Ionic mode loads port 4300, has one scroll owner without body scrolling, preserves its local 42. draft through close/reopen, and resets on reload. The host page has no document overflow at 320px; its preview stage scrolls horizontally when a fixed phone is wider. Legacy trade-entry Invest→Buy still logs its simulated action and retains a 390×750 outer frame. No page runtime errors. [Results](a3-preview-results.json); reproducible via `npx nx run web-app:preview-smoke` with both servers running. Initial browser assertions used a wrong selector and assumed a hidden panel was removed; those failed attempts were corrected, not recorded as passes.

Screenshots: [desktop](../../output/playwright/a3/preview-desktop.png), [mobile web](../../output/playwright/a3/preview-mobile-web.png), [Ionic panel](../../output/playwright/a3/preview-ionic.png). The preview harness is local/manual and needs port 4300 for Ionic. It displays start-server instructions rather than asserting iframe load proves server readiness. No physical-device, native, screen-reader or additional zoom claim comes from the phone frame. The earlier actual 200/400% desktop zoom follow-up on dbe5b24 is recorded in [the PR receipt](https://github.com/huyle93/angular-ngrx-signals-state-management/pull/1#issuecomment-6899157270).
