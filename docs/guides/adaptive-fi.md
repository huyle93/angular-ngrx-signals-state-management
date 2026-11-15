# Run the adaptive FI example

Use Node 24.11.0 and npm 11.6.1 (the tested pair). Keep `package-lock.json`.

```sh
npm ci
npx nx serve web-app --port=4200
# In another terminal:
npx nx serve mobile-reference --port=4300
```

Open `http://localhost:4200/fi/LUMA` and `http://localhost:4300/fi/LUMA`. Select TIDE for a second fictional issuer. Both pages load the same shared source; the mobile app is a browser-hosted Ionic reference. Existing web routes `/`, `/counter`, `/todo`, `/ticker`, and `/trade-entry` remain available.

Choose Demo A / Grove or Demo B / Ink using Appearance, or start with `?brand=b`. This changes visual tokens, not an account or tenant. Each new app session starts from its URL; the selection is not persisted. Theme changes and browser resize preserve the current symbol, chart range and entered amount. A different symbol, reload or leaving the FI page resets the demo trade draft. Explore data states offers deterministic loading, empty and error simulations; retry restores normal data. Simulations unmount the unavailable instrument/ticket, so keep draft testing separate from simulated data loss.

On web, choose 3M and enter `125.` without completing the amount, then narrow and widen the window. The same chart and ticket should remain, with the partial value intact. On mobile, scroll to Invest, open the panel, enter an amount, close it and reopen it. Closing returns keyboard focus to Invest. Nothing submits an order.

## Check the boundary

```sh
NX_NO_CLOUD=true npx nx run-many -t build,lint,test --projects=web-app,mobile-reference,instrument-util,instrument-data-access,instrument-ui,trading-feature,fi-web,fi-mobile,demo-design --skip-nx-cache
NX_NO_CLOUD=true npx nx run instrument-data-access:boundary-check
npx nx graph
```

`npm test` now delegates to the existing Nx web test target; use the command above for the full FI slice. The negative boundary target succeeds only when all deliberately forbidden imports produce the expected lint errors. No invalid files remain in the tree. `NX_NO_CLOUD=true` permits local validation without claiming or configuring a remote cache.

## Read the code

- `libs/fi/instrument/util`: typed instrument/series contracts and pure derivation.
- `libs/fi/instrument/data-access`: synthetic repository and route-scoped SignalStore.
- `libs/fi/instrument/ui`: price, chart, statistics/research, simulation controls; inputs/outputs only.
- `libs/fi/trading/feature`: portable demo ticket and its owned draft.
- `libs/fi/experience/{web,mobile}`: distinct assemblies, route adapters and layout.
- `libs/fi/design`: small public token map and visual selector.

Start with the [ADR](../decisions/ADR-A3-adaptive-fi.md), [project graph](../validation/a3-project-graph.md), and [validation](../validation/a3-adaptive-fi.md). The [task summary](../specs/a3-adaptive-fi.md) needs no private documents.
