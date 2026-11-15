# ADR A3 — shared instrument capability, two compositions

Status: implemented experiment; adoption pending review. Base: `69c84e5719de283c0658353b41e47efbd355b78a`.

## Decision

Keep the existing browser entrypoint and add a small Ionic browser reference. Each route selects its own experience wrapper. Both consume the same instrument store and presentational components. The experience layer composes the separately owned trading capability; instrument projects cannot import trading projects.

NgRx SignalStore 21.0.1 has a peer range of Angular `^21.0.0` and RxJS `^6.5.3 || ^7.4.0`, compatible with the locked Angular 21.1.1/RxJS 7.8.2. Its explicit state/derived-state/method split is the learning subject. The trade draft is deliberately a small component-scoped Angular signals service. Neither store knows viewport width or appearance. A route-scoped FI owner cancels pending loads on symbol change/destruction and ignores late results even if a future repository ignores cancellation. Loading clears obsolete instrument values; unavailable data is not displayed as zero.

The trading library is a small capability project (`type:feature`), containing its draft owner and view. A separate UI/data-access pair would add project configuration without another consumer of those internal contracts. Experience projects are explicitly allowed to compose features; instrument and trading domain projects are forbidden from importing each other. No barrel exports or unused generated library components remain.

The mobile composition uses `ion-app`, a standard Angular router outlet, `ion-header`, and one `ion-content`. This bounded reference does not need retained Ionic page stacks. It deliberately avoids claiming Ionic navigation caching/native lifecycle coverage. Invest opens an inline disclosure panel; closing it returns focus to Invest and preserves the local amount. It is not a modal and does not trap focus.

Web uses a CSS query container with one column by default and `minmax(0,1fr) minmax(19rem,21rem)` above 55rem of **content width**. The threshold allows a 34rem chart, 19rem ticket and 1.5rem gap. Flexbox handles local wrapping; sequential research and forms use normal flow. DOM and keyboard order stay main content → trading. There are no sticky overlays or duplicate breakpoint trees.

## Alternative and cost

One bootstrap with distinct routes would be simpler to run and test. It can deliver the same responsive web layout. Two entrypoints earn their place here as a teaching comparison of shell/scroll ownership and independent route composition, at the cost of another build, serve target and browser journey. This POC does **not** demonstrate independent native releases or reduced operational cost. If those differences are not useful to a future consumer, consolidate entrypoints while retaining the domain boundaries. A platform/brand source fork is unnecessary.

Existing ticker/trade-entry components remain intact apart from a lint-required output rename. The web entrypoint restores document scrolling on all web routes, correcting Ionic global body clipping; the legacy trade-entry phone frame retains its own content scroller. Legacy Invest → Buy interaction was checked after this change. Their animation and fixed phone-frame interaction are not needed by this portable slice; extracting them would increase regression scope without serving a shared contract.

## Pressure test

| Question              | Constraint, counterexample and evidence                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome / owner       | One FI state implementation, local trading owner, two composition wrappers. A cross-domain import is rejected by the real Nx lint rule. See negative boundary target.                                                                                                                                         |
| Runtime envelope      | Two bundled fixtures × 365 points; one cancellable timeout per active route owner, zero backend requests. A 10× route-selection burst should retain only the final symbol; stale-response unit tests challenge this. No capacity or production performance claim.                                             |
| Failure / truth       | Unknown symbol and injected empty are explicit empty states; simulated failure has retry. Switching LUMA → TIDE while loading cannot publish LUMA late. Store tests cover cancellation-ignoring repositories and destruction. Reload/route exit intentionally loses local draft.                              |
| Security / evolution  | Public theme allowlist only; no session, account, credential, persistence or execution API. Invalid appearance selects Demo A. A theme change must preserve current instrument/draft. Adding a real data adapter or identity requires a new design and security review; theming is no authorization evidence. |
| Rollback / acceptance | Remove the two FI routes, mobile app and FI libraries to retire the experiment; existing demos remain. No data migration. Browser evidence and actual build/lint/unit results are in the validation record. Native suitability, spoken screen-reader use and adoption are separate human decisions.           |

## Remaining decision

Recommend **adjust/evaluate**, not production adoption: the source boundary is enforceable and the bounded browser journeys can be checked, but the extra bootstrap cost is justified only if the distinct shell composition remains useful. Independent review and Huy's acceptance decide whether this is a reference worth keeping.

The root router now selects sibling FI and legacy demo-shell routes, avoiding a URL-prefix switch and the transient legacy header on FI deep links. The two compositions share a presentational status component with a persistent live paragraph. Retry focuses its persistent visible region before the button disappears; focus remains at that meaningful point through recovery, before the loaded instrument content. Wrapper tests exercise route changes, duplicate suppression and retry separately in both runtimes.

The trade capability intentionally accepts changing symbol inputs and resets its own draft; the present wrappers also destroy unavailable content. Its input contract is tested even though today's route transition destroys the instance. Exactly one ticket is allowed in each composition; its fixed DOM IDs rely on that bounded contract. General multi-ticket rendering is out of scope. Focus on opening the disclosure uses Angular's `afterNextRender`, not a timer.

## Preview harness follow-up

The requested FI playground creates a real second consumer of phone-frame geometry. Extract a small app-local `PreviewFrameComponent` under `apps/web-app/src/app/demo-preview`, reused by FI and trade-entry. It owns viewport dimensions, chrome, overflow containment and the legacy fixed-footer containing block. It does not own routing, instrument/trade state or theme. There is no new Nx library or dependency for two consumers in the same app.

`/fi-preview` stays in the demo shell, separate from `/fi/:symbol`. One iframe loads the standalone web route; desktop/mobile-web choices change its containing width without assigning a new resource URL or destroying the document. This proves viewport-relative layout, including media queries, better than projecting the page into a narrow div. Ionic mode loads the actual mobile-reference application on the same host's port 4300, rather than recreating its bootstrap in the web app. Angular's resource-URL trust bypass is limited to these constructed application URLs; no URL input/query parameter can choose arbitrary embedded content.

Each iframe has its own application session. Changing app or reloading intentionally resets preview state; there is no cross-origin state bridge or message protocol. A stopped mobile server remains a stopped server: show run/reload/standalone instructions without claiming iframe `load` means the app is ready. Two serve processes can be started via `web-app:serve-fi-demo`; independent serves remain available. This target and the port-4300 URL are local development conveniences, not deployment routing.

Pressure-test delta: a CSS-only phone wrapper would not constrain viewport units or Ionic's full-screen shell; duplicating mobile composition inside web would conceal bootstrap differences. One iframe bounds runtime work to one active app/session. Resize tests challenge accidental reloads and duplicate trees; app switches/reload challenge session reset; stopped-server instructions provide recovery. An outer horizontal scroller preserves exact 320/390px phone width on a smaller host window without overflowing the document. Legacy Invest→Buy and outer geometry are regression checks for extraction. Rollback removes the preview route/frame and restores the legacy wrapper; domain contracts and native scope stay as before. Independent review must cover this follow-up on the final PR head.
