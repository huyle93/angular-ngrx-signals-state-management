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
