# Run the adaptive FI example

Use Node 24.11.0 and npm 11.6.1 (the tested pair). Keep `package-lock.json`.

For the preview playground, start both apps with one command (stop any existing serve commands first):

```sh
npx nx run web-app:serve-fi-demo
```

Open `http://localhost:4200/fi-preview`, or choose **Adaptive FI** from the existing demo navigation/home card. **Desktop web** and **Mobile web** resize the same embedded web page without resetting its chart or draft. Choose 320px or 390px phone width. **Ionic mobile** loads the actual separate app on port 4300, with its own session. Changing between web and Ionic, or selecting Reload preview, starts fresh. Open standalone launches the current app outside the frame for browser zoom and device testing. If port 4300 is unavailable, the Ionic tab includes the command to start it; reload after starting the server. The frame does not detect server readiness or assert a successful load.

You can also run the entrypoints independently:

```sh
npm ci
npx nx serve web-app --port=4200
# In another terminal:
npx nx serve mobile-reference --port=4300
```

Open `http://localhost:4200/fi/LUMA` and `http://localhost:4300/fi/LUMA`. Select TIDE for a second fictional issuer. Both pages load the same shared source; the mobile app is a browser-hosted Ionic reference. Existing web routes `/`, `/counter`, `/todo`, `/ticker`, and `/trade-entry` remain available.

Choose Demo A / Grove or Demo B / Ink using Appearance, or start with `?brand=b`. This changes visual tokens, not an account or tenant. Each new app session starts from its URL; the selection is not persisted. Theme changes and browser resize preserve the current symbol, chart range and entered amount. A different symbol, reload or leaving the FI page resets the demo trade draft. Explore data states offers deterministic loading, empty and error simulations; retry restores normal data. Simulations remove unavailable instrument/quote content and close an open mobile modal. Same-symbol retry retains the raw amount but clears its preview.

On web, choose 3M and enter `125.` without completing the amount, then narrow and widen the window. The same chart and ticket should remain, with the partial value intact. On mobile, scroll to Invest, open the full-page modal, enter an amount, close it and reopen it. Closing returns keyboard focus to Invest. Nothing submits an order.

## Check the boundary

```sh
NX_NO_CLOUD=true npx nx run-many -t build,lint,test --projects=web-app,mobile-reference,instrument-util,instrument-data-access,instrument-ui,trading-feature,trading-ui,trading-data-access,trading-util,fi-web,fi-mobile,demo-design --skip-nx-cache
NX_NO_CLOUD=true npx nx run instrument-data-access:boundary-check
npx nx graph
```

`npm test` now delegates to the existing Nx web test target; use the command above for the full FI slice. The negative boundary target succeeds only when all deliberately forbidden imports produce the expected lint errors. No invalid files remain in the tree. `NX_NO_CLOUD=true` permits local validation without claiming or configuring a remote cache.

## Read the code

- `libs/fi/instrument/util`: typed instrument/series contracts and pure derivation.
- `libs/fi/instrument/data-access`: synthetic repository and route-scoped SignalStore.
- `libs/fi/instrument/ui`: price, chart, statistics/research, simulation controls; inputs/outputs only.
- `libs/fi/trading/util`: pure validation and order-entry view contracts.
- `libs/fi/trading/data-access`: host-scoped ephemeral draft session; no network access.
- `libs/fi/trading/ui`: controlled form body, with no store or Ionic dependency.
- `libs/fi/trading/feature`: desktop rail and full-page mobile modal presentation/lifecycle.
- `libs/fi/experience/{web,mobile}`: distinct assemblies, route adapters and layout-pattern selection.
- `libs/fi/design`: public visual tokens, shared container/adaptive-layout mixins and visual selector.

Read [design-system layout ownership](../patterns/design-system-layout-ownership.md) for the boundary between shared layout rules and experience choices. The demo uses a 56.5rem content-fit threshold (34rem main + 21rem maximum aside + 1.5rem gap), derived by the shared Sass mixin. The browser smoke checks the threshold, a constrained container inside a wide viewport, and larger root text without remounting state owners.

Start with the [ADR](../decisions/ADR-A3-adaptive-fi.md), [project graph](../validation/a3-project-graph.md), and [validation](../validation/a3-adaptive-fi.md). The [task summary](../specs/a3-adaptive-fi.md) needs no private documents.

## Reproduce browser evidence

With both dev servers running on ports 4200 and 4300:

```sh
NX_NO_CLOUD=true npx nx run web-app:browser-smoke
# Preview switching, iframe continuity and trade-entry regression:
NX_NO_CLOUD=true npx nx run web-app:preview-smoke
# Modal sizing, focus, draft recovery, navigation and cleanup:
NX_NO_CLOUD=true npx nx run web-app:modal-smoke
```

This invokes the pinned Playwright CLI 0.1.24 through npm, opens a dedicated `a3` browser session and runs `tools/a3-browser-smoke.js`. Install its supported browser using `npx --package=@playwright/cli@0.1.24 playwright-cli install-browser` if requested by the CLI. It checks real UI interactions and emits JSON results; failures are propagated to Nx even when the CLI itself exits successfully. It refreshes screenshots under `output/playwright/a3/`; review those diffs before committing new evidence. This browser target is local/manual; the checked-in CI job runs build, lint, unit tests and negative boundary checks. The modal script uses Angular dev-mode inspection only to inject a componentless destination for the real route-exit guard; no test route ships. Browser zoom and spoken screen-reader validation remain separate from the script. Close the owned test session afterward with `npx --package=@playwright/cli@0.1.24 playwright-cli -s=a3 close`.
