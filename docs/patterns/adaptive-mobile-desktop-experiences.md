# Adaptive mobile and desktop experiences

A detail page can offer a focused mobile journey and a spacious desktop workspace while sharing the same business behavior. The useful boundary is between **capability**, **presentation**, and **layout**.

This pattern uses an instrument detail page with a synthetic order-entry form. The mobile experience opens the form in a full-page Ionic modal. The web experience embeds it beside the detail content when space permits and stacks the regions when narrow. The form's validation and draft behavior have one implementation.

## Separate experience selection from width adaptation

| Experience   | Presentation                                           | What determines it                  |
| ------------ | ------------------------------------------------------ | ----------------------------------- |
| Ionic mobile | Detail page, then an Invest action and full-page modal | The application's route composition |
| Wide web     | Main content beside an order-entry rail                | Available content width             |
| Narrow web   | The same web regions in a vertical sequence            | Available content width             |

The application selects its route component. CSS then adapts that component to its available space. A narrow browser remains the web experience; widening the Ionic application keeps its mobile flow. Resizing must preserve the selected instrument, chart range and partially typed amount.

Separate mobile and web entrypoints can isolate bootstrap, navigation lifecycle and release configuration. They also add build and integration-test work. A single app with two route compositions is a credible simpler option when those runtime boundaries can be shared. Modal versus rail presentation alone does not require a second application. Angular supports loading the selected component through [route configuration](https://angular.dev/guide/routing/loading-strategies).

## Share capabilities through small contracts

UI pieces become reusable when they accept values and emit intent without assuming a particular route, overlay or store instance. A folder called `ui` does not establish that contract by itself.

For example, an order-entry body receives a view containing the instrument, available price, raw amount, derived quantity and preview state. It emits amount changes and preview requests. The desktop host places that body in a rail; the mobile host places it inside a modal. Neither needs a second copy of amount validation.

Four library types help assign responsibilities:

| Library type  | Responsibility                               | Example                                         |
| ------------- | -------------------------------------------- | ----------------------------------------------- |
| `util`        | Pure contracts and rules                     | Parse an amount; reject an invalid price        |
| `data-access` | State and external-data access, where needed | Own the local draft; derive preview values      |
| `ui`          | Controlled presentation                      | Render fields, errors and a preview             |
| `feature`     | Coordinate a capability's interaction        | Own modal presentation or an embedded form host |

An experience wrapper composes domains through explicit inputs and outputs. Instrument state belongs to the instrument domain; draft state belongs to trading. Visual adjacency gives neither domain permission to import the other's feature or mutate its store. Enforce dependency direction and domain isolation with actual Nx projects and lint constraints.

The design principles are practical: single responsibility separates reasons to change; small contracts keep hosts replaceable; composition allows compatible pieces to be assembled differently. Share business decisions and compatible UI. Keep separate templates when forcing one template would introduce many unrelated platform branches. Introduce library boundaries for real consumers and responsibilities, rather than generating four empty projects for every domain.

## Give the design system a layout role

Your design system owns visual foundations and reusable layout behavior: gutters, width limits, spacing, containers and adaptive page patterns. The experience selects a pattern, supplies its content and owns workflow choices such as modal versus embedded presentation. Domain stores remain independent of layout.

See [design-system layout ownership](design-system-layout-ownership.md) for industry examples, an ownership map and the demo’s shared Sass contract.

## Choose layout by the relationship between regions

### Why CSS Grid fits the web composition

The main region should use the remaining space, while the order-entry region should stay within a readable width. Both regions share a gap and a transition to one column. Grid makes that relationship visible in one track definition.

Its row/column model also becomes useful if a workspace later needs aligned headers, content and supporting regions. That is a reason to choose Grid for coordinated page regions, rather than evidence that it is the best tool for every component. Our choice is a maintainability judgment; we did not measure a rendering-performance advantage over Flexbox. See the [Grid layout model](https://www.w3.org/TR/css-grid-2/#intro).

### Other good options

| Option            | Good fit                                                                    | Trade-off for this page                                                                                            |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CSS Grid          | Regions with coordinated track sizing or alignment                          | Expresses flexible content plus a constrained rail directly                                                        |
| Flexbox           | A toolbar, action row, wrapping controls or a simple row/column composition | Can implement this two-column page too; track alignment across wrapped lines needs separate consideration          |
| Normal block flow | Articles, forms and sequential sections                                     | Usually sufficient inside the main region and form body                                                            |
| Ionic Grid        | Existing Ionic layouts and regular responsive column proportions            | Useful when its row/column API already fits; adds wrappers for a rail that can be described with a direct CSS rule |
| Ionic Split Pane  | A persistent navigation menu beside main content                            | Addresses shell navigation; it does not replace the detail-page composition                                        |

[Flexbox](https://www.w3.org/TR/css-flexbox-1/#intro) distributes items along a main axis and supports wrapping; it is useful on both mobile and desktop. Ionic rows themselves use Flexbox in the [pinned implementation](https://github.com/ionic-team/ionic-framework/blob/v8.8.3/core/src/components/row/row.scss). Neither a twelve-column convention nor a framework wrapper is required for every card or form. Preserve working layouts when a replacement offers no demonstrated benefit.

### A small Grid example

This layout-only sketch shows the same container and track contract used by the demo. The application generates its grid rules through the design library’s `content-with-aside` mixin; it keeps the same region hosts mounted while changing columns.

```html
<div class="workspace">
  <div class="fi-layout">
    <section class="detail-main" aria-label="Instrument details">...</section>
    <aside class="order-entry" aria-label="Order entry">...</aside>
  </div>
</div>
```

```css
.workspace {
  container: instrument-detail / inline-size;
}

.fi-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.fi-layout > * {
  min-inline-size: 0;
}

@container instrument-detail (min-width: 56.5rem) {
  .fi-layout {
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 21rem);
  }
}
```

The parent establishes the [query container](https://www.w3.org/TR/css-contain-3/#container-queries); the descendant layout responds to its width. A sidebar can reduce the content area even when the browser window is wide. Use viewport media queries for changes governed by the whole window, and container queries for components governed by their allocated region. Neither mechanism replaces Grid or Flexbox: queries choose when styles change; layout rules arrange the content.

`minmax(0, 1fr)` permits the flexible track to shrink below its automatic content-based minimum. `min-inline-size: 0` allows the children to shrink too. Descendants still need their own overflow handling: long identifiers may need wrapping, and charts must size themselves from their actual container. These rules do not make every overflowing descendant responsive automatically.

The demo and this sketch budget a 34rem main region, the rail’s 21rem maximum and a 1.5rem gap: 56.5rem of container content width. Budgeting only for the 19rem rail minimum would overlook the space it can consume as it grows. The shared mixin derives that threshold from the experience’s region sizes and the design library’s gap, so the documentation and demo use the same budget. Recalculate the fit for the actual typography, labels and controls. Keep the one-column fallback and test the supported browser/WebView matrix.

Keep detail content before the order form in source order. Grid placement does not change screen-reader or keyboard navigation order; avoid visually moving regions into a conflicting sequence. The [Grid accessibility guidance](https://www.w3.org/TR/css-grid-2/#order-accessibility) explains this distinction.

## Make draft lifetime independent of presentation lifetime

The most important state decision is where the draft lives. Inline Ionic modal contents are normally destroyed on dismissal. Providing the draft store inside that inner form would discard the amount when the modal closes.

Use a stable feature host to own the draft and the modal declaration. The form body has no competing store provider. Keep that host outside temporary loading/loaded-content conditions: a same-instrument refresh can clear the displayed instrument before recovery, and should not accidentally destroy its trading session.

Define the lifecycle contract explicitly. This example uses:

| Event                                       | Draft and presentation behavior                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Web resize or appearance change             | Preserve raw input and current selection                                           |
| Modal close and reopen                      | Destroy/recreate the inner view; retain raw input                                  |
| Same-instrument price unavailable/recovered | Hide unavailable values, invalidate the preview, close the modal, retain raw input |
| Different instrument                        | Reset the draft and dismiss the old presentation                                   |
| Route exit or reload                        | End the local session                                                              |

Preserve raw text such as `42.` even though it is not yet a valid amount. Derive validity separately. An unavailable price is not zero and must not enable a preview from an obsolete quote. Real execution requires its own domain and server-side validation; a synthetic preview is not an order submission design.

Shared store code also does not mean a shared in-memory store across applications, tabs or devices. Choose each instance's scope deliberately. Cross-session persistence would require an explicit contract.

## Treat the modal as a presentation host

An Ionic modal owns interaction that an embedded rail does not need: presentation and dismissal, initial focus, focus containment, background isolation and return to a meaningful trigger. The shared form should not contain another `ion-content`; each active view declares its primary scroller. A full-page modal can have its own scroller while the underlying page is blocked.

Three implementation details were easy to miss:

1. **Overlay ancestry changes.** In Ionic 8.8.3, the inline overlay can move under the application root. Theme variables scoped only to the original page may stop applying. Put the semantic theme scope on the overlay or an appropriate common ancestor. Angular's logical ownership does not preserve CSS ancestry. See the pinned [framework delegate](https://github.com/ionic-team/ionic-framework/blob/v8.8.3/core/src/utils/framework-delegate.ts).
2. **Full-page sizing must be explicit.** The pinned modal styles introduce inset dimensions at larger viewports. A full-page contract needs scoped width, height, maximum dimensions and radius overrides; sheet/card configuration serves a different interaction. See the pinned [modal styles](https://github.com/ionic-team/ionic-framework/blob/v8.8.3/core/src/components/modal/modal.scss).
3. **Opening and closing are asynchronous.** Ignore repeated open taps, await presentation before dismissal, and finish cleanup before destroying the route host. A queued reopen after a user close must be canceled when a route or instrument change starts leaving the context.

The reference uses imperative `present()`/`dismiss()` promises because route exit needs awaitable cleanup. An `isOpen` binding is also a valid approach when its state is reconciled on dismissal. Choose one presentation contract and account for every dismissal source. Check the [modal API](https://ionicframework.com/docs/api/modal) against the installed version.

Focus needs real-browser testing. In the reference, restoring focus at `didDismiss` ran before Angular re-enabled Invest, so restoration moved to `afterNextRender`. Repeated Tab cycles also needed a native-control boundary wrap alongside Ionic's focus listener. These are findings from this composition, not reasons to add a second focus trap to every modal.

With a plain Angular outlet, the pinned [Ionic background-hiding helper](https://github.com/ionic-team/ionic-framework/blob/v8.8.3/core/src/utils/overlays.ts) needs a recognized view root with the presented modal outside it; verify the resulting accessibility tree rather than assuming an overlay blocks assistive navigation. Give the actual dialog an accessible name. Keep live feedback mounted while updating its text.

Browser Back needs a product contract too. This example keeps ordinary route history; query-only changes for the same instrument may leave the modal open. It does not add close-only modal history. Hardware Back, browser history and modal dismissal are distinct behaviors to validate.

## Verify the boundaries through behavior

| Boundary          | Useful check                                                          | Failure it exposes                                      |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Layout → state    | Resize wide → narrow → wide with a partial amount and chart selection | Remounted owners or duplicate interactive trees         |
| Overlay → session | Close/reopen, then inject same-instrument data loss/retry             | A store scoped to a disposable view                     |
| Context → overlay | Change instrument or leave while presentation is pending              | Old forms, scroll locks or delayed reopen               |
| Theme → overlay   | Open with each palette; inspect computed semantic tokens              | Lost theme scope after relocation                       |
| Focus → rendering | Cycle Tab/Shift+Tab, close/Escape, retry opening failures             | Missing names, escaped focus or disabled return targets |
| Page → scrolling  | Dismiss the modal, then reach page controls at a narrow width         | A restored-looking page that still cannot scroll        |
| Library → library | Deliberately attempt forbidden imports through the real lint rule     | Boundaries documented only in folder names              |

Unit tests can control external modal promises to verify coordination. They do not establish real overlay focus or accessibility behavior. Browser tests should wait for presentation/rendered state before inspecting geometry or capturing screenshots. A dispatched click is not proof that its transition has completed.

The accompanying experiment records desktop Chromium checks at narrow and wide sizes, theme/draft continuity and overlay cleanup. A browser phone frame supplies a real inner viewport; it does not simulate a physical phone, virtual keyboard or native lifecycle. Physical devices, WebKit behavior, spoken screen readers and modal-specific 200/400% zoom remain separate validation work. No performance comparison, native suitability or production readiness follows from this example.

## Explore the implementation

The pattern is portable; these optional links connect it to the runnable example:

- [Run guide and preview](../guides/adaptive-fi.md)
- [Architecture decision and trade-offs](../decisions/ADR-A3-adaptive-fi.md)
- [Shared layout primitives](../../libs/fi/design/src/layout.scss)
- [Web composition and container sizing](../../libs/fi/experience/web/src/fi-web.page.scss)
- [Mobile modal/session host](../../libs/fi/trading/feature/src/mobile-trade.component.ts)
- [Shared controlled form](../../libs/fi/trading/ui/src/order-entry.component.ts)
- [Draft owner](../../libs/fi/trading/data-access/src/trade-draft.store.ts)
- [Recorded validation and limits](../validation/a3-adaptive-fi.md)

Start with one meaningful journey, a small contract and a clear lifecycle. Retain the simplest layout and application structure that meets those requirements. Revisit the boundaries when another real consumer exposes a different responsibility.
