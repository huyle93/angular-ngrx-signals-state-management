# A3 — adaptive instrument detail

Build one fictional instrument capability in two independently runnable Angular applications. Preserve the existing demos. This is a public architecture learning example, with original synthetic data and semantic themes; no real quotes, accounts or orders.

## Scope and acceptance

- **A0 baseline:** record base commit, Node/npm and locked versions; install, serve, build, lint and tests. Separate existing defects from new ones.
- **Two compositions:** `/fi/:symbol` uses a web page in `web-app` and an Ionic page in `mobile-reference`. No viewport-based route selection.
- **Shared capability:** one instrument store/repository implementation and typed presentation components; a separately owned local trading draft. State instances are per route/app, not shared between tabs.
- **Adaptive web:** flexible main region and constrained ticket rail above the measured content-fit threshold; one column below it. Resize preserves symbol, selected chart range, partial draft and component identity.
- **Themes:** Demo A / Grove and Demo B / Ink share semantic roles. `?brand=a` or `?brand=b` selects startup appearance. The selector changes appearance only, never user/tenant identity.
- **Quality:** 320 CSS pixels, 200/400% zoom, keyboard/focus order, accessible chart values, touch targets, loading/empty/error/retry and route-parameter changes. Only one chart and ticket; mobile has one scroll owner.
- **Boundaries:** actual Nx projects tagged by scope, type and domain; lint rejects reverse-layer and cross-domain imports and UI/native dependencies in pure logic. Include negative proof.
- **Evidence:** unit tests, both builds, lint, browser smoke results, project graph, screenshots, short ADR and self-contained run instructions.

## Non-goals and review

No native host, Capacitor, broker integration, authentication, tenant isolation, repository rename, generic design system, broad migration or framework upgrade. Browser evidence says nothing about native safe areas, system back gestures or app stores. Prepare an unmerged PR; human review decides whether to keep this experiment. Do not label production readiness from a screenshot or passing unit tests.

See [decision](../decisions/ADR-A3-adaptive-fi.md), [validation](../validation/a3-adaptive-fi.md), and [guide](../guides/adaptive-fi.md).

## Preview follow-up

Provide `/fi-preview` in the existing demo shell with Desktop web, Mobile web and Ionic mobile choices. Use one live iframe: web size changes preserve the same document and session; Ionic loads the separately served mobile-reference app. Offer 320px/390px phone sizes, reload and standalone links, and instructions for a stopped mobile server. Extract only the demo viewport chrome for reuse by FI and legacy trade-entry. Preserve trade-entry interactions and its 390×750 outer geometry. No preview flags or frame CSS enter domain state/UI. Keep standalone FI routes available. The phone frame is a browser viewport aid, not device emulation.

## Order-entry presentation follow-up

Keep the desktop order-entry rail. On the Ionic browser app, Invest opens a full-page modal at phone and tablet widths. Reuse one controlled order-entry body and one local draft implementation through trading `feature`, `ui`, `data-access`, and `util` libraries. Close/Escape restore focus and preserve the raw amount; same-symbol retry retains it while invalidating the preview; instrument changes, route exit and reload reset it. Browser Back keeps normal route navigation. Verify theme inheritance after overlay relocation, background accessibility isolation, keyboard focus cycles, one modal/form/scroller, rapid interactions and route cleanup. No real order submission or native-device claim.
