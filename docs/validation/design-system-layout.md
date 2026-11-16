# Design-system layout validation

Observed 2026-11-16, on the layout follow-up to base `15a8dc48666cd1b437cf1d99bd7bfbdab8c60e64`. This is browser-demo evidence, not native or production acceptance.

## Change and boundary

The design library now implements shared container sizing and a content-with-aside Sass pattern. The web experience supplies the content-fit dimensions; Ionic page/modal hosts select reading/form width tokens. The web transition changed from 55rem to **56.5rem of container content width** to budget the aside's maximum. Domain code, markup, routes, store providers and overlay lifecycle are unchanged.

| Question                | Evidence and trade-off                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome and owner       | One shared layout implementation, selected by experience styles. Keeping page-local CSS and sharing only tokens would be simpler for one isolated page; the container already has three consumers. The two-region pattern is a small teaching contract, with one current web consumer.                                  |
| Runtime envelope        | Sass emits CSS at build time; no new resize observer, subscription, network request or state owner. Browser checks challenge repeated resize and a wide window with constrained content. No performance improvement claim.                                                                                              |
| Failure and recovery    | One column is the default. Below the measured fit threshold, regions stack without remounting the chart or ticket. Same-symbol data recovery, modal reopen and context-exit checks still pass.                                                                                                                          |
| Evolution and isolation | Content-fit values stay in the experience; shared styles contain no domain selectors or route decisions. Real lint rejects ten forbidden imports. The Sass contract requires a named ancestor and compatible rem lengths; it does not enforce arbitrary future stylesheet imports or validate every consumer's content. |
| Rollback and acceptance | Revert the layout extraction and its consumers to restore the earlier CSS; no data migration or dependency changes. Keep the corrected maximum-aside budget if retaining the two-column layout. Additional platforms remain separate acceptance work.                                                                   |

## Executed checks

```sh
NX_NO_CLOUD=true npx nx run-many -t build,lint,test --projects=web-app,mobile-reference,instrument-util,instrument-data-access,instrument-ui,trading-feature,trading-ui,trading-data-access,trading-util,fi-web,fi-mobile,demo-design --skip-nx-cache
NX_NO_CLOUD=true npx nx run instrument-data-access:boundary-check
NX_NO_CLOUD=true npx nx run web-app:browser-smoke
NX_NO_CLOUD=true npx nx run web-app:modal-smoke
NX_NO_CLOUD=true npx nx run web-app:preview-smoke
```

Both production builds, all 12 lint targets and **42 tests across 14 files passed**. The boundary target passed ten deliberate rejection probes. Existing non-null assertion lint warnings and web bundle/style budget warnings remain. The web initial bundle is 653.34kB against a 500kB warning budget; the existing welcome style is 7.04kB against a 4kB warning budget. Neither exceeds its error budget. No package or lockfile changes.

All three Chromium browser targets passed. [Layout and journey results](design-system-layout-browser-results.json), [modal results](design-system-layout-modal-results.json), [preview results](design-system-layout-preview-results.json).

| Case                                                     | Measured result                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1440px viewport / 1184px content                         | 824px main + 24px gap + 336px aside                                                |
| 983px / 904.36px content                                 | Two columns; main remains at least 544px (34rem)                                   |
| 982px / 903.44px content                                 | One column                                                                         |
| 1440px viewport, content constrained to 903px then 904px | One column, then 544px main + 24px gap + 336px aside                               |
| Root text enlarged to 20px                               | At 1229px viewport, 680.688px main + 30px gap + 420px aside; at 1228px, one column |
| 320px viewport at 16px and 20px root text                | One column, no document overflow                                                   |

Each layout check preserved the same chart/ticket elements, one of each, main-before-ticket source order, selected 3M range and partial `125.` amount. Changing root text size is **not** browser zoom evidence.

Ionic checks covered 390×844, 320×640, 1024×768 and 844×390. The modal filled its viewport; the page/form widths stayed within 48rem/40rem. The short landscape modal had 528px of scrollable content in a 320px content viewport. Its preview action was scrolled into view and clicked successfully. No horizontal overflow or document scrolling appeared. [Landscape screenshot](../../output/playwright/a3/modal-844-a.png).

Theme inheritance after overlay relocation, background isolation, focus cycles, Escape/focus return, partial-draft reopen, quote-loss/retry, instrument/history reset and route cleanup passed. The race action sequence proves observed cleanup, not coverage of every internal Ionic interleaving. Preview checks preserved the live web iframe through size switches, switched to the separate Ionic app, reset on reload, and retained the legacy trade-entry interaction/geometry. No page runtime errors were recorded.

## Independent review

A separate read-only Codex reviewer inspected the changed sources, both compositions, primary research pages and the recorded checks. It found no blocking issue and accepted the bounded layout design. The reviewer verified the 14-file source/docs digest `2d4309186c1163acb1b80d779c57a1316ed7f0000001654f55f55517286042bd` against the base above. It inspected the execution receipts; it did not run the runtime checks itself.

## Limits

The shared mixin is demonstrated for this content and its horizontal writing mode. Localization, alternative content budgets and unsupported browser fallbacks need their own checks. Physical-device behavior, virtual keyboards, safe areas, native Back, WebKit focus, spoken screen readers and modal-specific 200/400% zoom were not verified in this follow-up. Earlier evidence and broader limits remain in the [experiment record](a3-adaptive-fi.md).
