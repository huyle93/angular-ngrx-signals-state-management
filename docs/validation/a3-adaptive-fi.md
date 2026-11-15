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
| `npx nx run-many -t build,lint,test --projects=web-app,mobile-reference,instrument-util,instrument-data-access,instrument-ui,trading-feature,fi-web,fi-mobile,demo-design --skip-nx-cache` | Both production builds and all nine lint targets passed; 24 tests pass across six files (including the two baseline tests).                                                                         |
| `npx nx run instrument-data-access:boundary-check`                                                                                                                                         | Passed by observing three intended rejections: data→foreign feature, UI→data, pure util→Ionic.                                                                                                      |
| `npx nx serve web-app --port=4200` / `npx nx serve mobile-reference --port=4300`                                                                                                           | Both independently served `/fi/LUMA`.                                                                                                                                                               |
| `npx nx graph --file=/tmp/a3-graph.json`                                                                                                                                                   | Generated; [actual project edges](a3-project-graph.md).                                                                                                                                             |
| `npx nx format:write --files=<changed paths>` / `git diff --check`                                                                                                                         | Formatting applied only to changed files; whitespace check passed.                                                                                                                                  |
| Browser CLI smoke                                                                                                                                                                          | Passed the scripted journeys in `tools/a3-browser-smoke.js`, including all five preserved routes, 320px ticket reachability, both themes, cancellation, recovery and mobile focus/draft continuity. |

New unit coverage includes deterministic fixtures/derived ranges; stale/out-of-order completion; cancellation on destruction; empty/error/recovery; amount validation and symbol isolation; flat SVG/data-table rendering; theme allowlisting; mobile disclosure continuity while typing. These are browser/unit checks, not native device tests.

## Browser findings and regression fixes

1. Ionic's inherited global structure stylesheet fixed/clipped the web body. A 320px browser could render the ticket yet could not scroll to its preview button. The web entrypoint now restores normal document scrolling; mobile retains `ion-content` ownership. The smoke script must reach and click the ticket at 320px; merely checking screenshot width was insufficient.
2. A symbol-change effect accidentally tracked internal draft reads, closing the mobile panel on typing. Its draft-selection call now uses `untracked`; a component regression test and browser typing/close/reopen journey cover this exact failure.
3. Browser assertions wait for Angular's observable rendered state rather than treating a dispatched click as completed rendering. Initial immediate-assertion runs were not recorded as passes.

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
| AC8 boundaries        | Graph, tags, flat lint config, three expected negative rejections. CI invokes the same target.                                                                                                                                                                 |
| AC9 tests             | Unit/build/lint and browser evidence; remote CI result to be linked with final PR review.                                                                                                                                                                      |
| AC10 learnability     | Local task, guide, ADR, graph, screenshots and this record; no private source required.                                                                                                                                                                        |

## Scope limits and next decision

No native shell, platform gestures, safe-area behavior, system keyboard avoidance, actual brokerage operation, backend tenancy or production capacity was tested. Desktop Chromium is the browser evidence; no Safari/Firefox claim. A mobile-sized browser is not a physical phone. The draft is intentionally ephemeral and resets on symbol changes, simulated data loss, route exit and reload.

Huy reviews the unmerged experiment and whether distinct entrypoints merit their ongoing build/test cost. Actual browser zoom and spoken screen-reader review remain explicit follow-ups, not inferred passes.

## Screenshots

[Wide Demo A](../../output/playwright/a3/web-wide-a.png) · [Wide Demo B](../../output/playwright/a3/web-wide-b.png) · [320px web](../../output/playwright/a3/web-320-b.png) · [Mobile A](../../output/playwright/a3/mobile-a.png) · [Mobile B](../../output/playwright/a3/mobile-b.png) · [Mobile panel](../../output/playwright/a3/mobile-panel-b.png)
