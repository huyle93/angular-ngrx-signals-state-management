# Who owns adaptive layout?

**Your design system should own shared layout standards and reusable layout behavior. Each experience chooses the composition that serves its workflow.** Layout belongs in the design system alongside color, typography and accessibility; it is more than application-specific styling.

For example, a design system can provide a content-with-aside pattern. A detail page decides what goes in each region and how much room those contents need. The mobile experience can instead open the same form in a full-page modal. Neither choice belongs in the domain store.

## What established design systems teach us

These are useful industry examples, not a universal standard or a requirement to adopt their dimensions:

| Source                                                                                            | What it governs                                                                                                                    | Lesson for your design system                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Carbon 2x Grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview) | Grid geometry, spacing relationships and fixed, fluid or hybrid layouts                                                            | A design system can describe how whole layouts behave, beyond individual controls |
| [Atlassian grid](https://atlassian.design/foundations/grid)                                       | Main-content columns, gutters, margins, width limits and viewport breakpoints; navigation and panels have separate layout guidance | Govern shared foundations while allowing local layout choices                     |
| [USWDS layout grid](https://designsystem.digital.gov/utilities/layout-grid/)                      | Responsive containers, rows, columns, gutters and configurable settings                                                            | Layout guidance can ship as reusable code; its grid uses Flexbox                  |

A **design grid** is an alignment convention. **CSS Grid** is one implementation tool. A design system can use CSS Grid for coordinated page regions, Flexbox for wrapping action rows and normal block flow for articles or forms. These tools work together. See [layout choices and trade-offs](adaptive-mobile-desktop-experiences.md#choose-layout-by-the-relationship-between-regions).

Keep documentation, shipped components and application adoption distinct. A published layout guideline does not prove that a framework package implements it, or that every application uses it.

## Assign ownership by the reason to change

| Owner                            | Owns                                                                                       | Example                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Design-system foundations        | Spacing, gutters, content-width limits, density and shared breakpoint conventions          | A reading-width container and a standard region gap                 |
| Design-system patterns           | Reusable containers, stacks, grids and page/pane templates, including their adaptive rules | Stack content and aside until both regions fit                      |
| App shell                        | Bootstrap, navigation, routes, platform integration and outer scroll ownership             | Select the web or Ionic composition                                 |
| Feature / experience with design | Content priority, pattern selection, content-fit budgets and workflow presentation         | Place a ticket beside a chart on web; open it from Invest on mobile |
| Domain libraries                 | Business rules, data and session state                                                     | Validate an amount and preserve the draft through resize            |

The design system may own a complete reusable page template when several journeys need the same behavior. The experience supplies content and intent through explicit contracts. Avoid putting instrument names, account rules or route decisions inside a generic layout pattern.

The Lego analogy is useful: compatible pieces have clear connection points. A spacing token is a foundation; a container or content-with-aside pattern is a building block; the experience is the assembly. Reusability comes from those contracts, not from making every page identical.

## Separate shared breakpoints from local content fit

Use window-level rules for the app shell and region-level rules for content constrained by a sidebar or pane. A wide browser can still contain a narrow workspace. A local container query can therefore stack a form while the outer navigation remains expanded.

Atlassian explicitly defines its default grid breakpoints against the **viewport**, and notes that app-specific grid values can differ. That convention does not require every nested component to change at the same number. Establish shared defaults, then document a local transition when the content needs it. [Source: grid breakpoints](https://atlassian.design/foundations/grid).

Device names alone are insufficient. Available height also matters for short landscape windows and overlays. Android's [window-size guidance](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) classifies available width and height separately. The transferable idea is to design for usable space; its numeric platform breakpoints are not web CSS defaults.

For a flexible main region plus a bounded aside, budget:

```text
two-column threshold = minimum usable main + maximum aside + gap
                     = 34rem + 21rem + 1.5rem
                     = 56.5rem of container content width
```

Using the aside's 19rem minimum would under-budget the space it can actually consume. Outer padding is excluded from the queried content width. Treat these values as a contract for this example, then validate them against your own labels, typography, localization and controls.

## How the demo implements this boundary

The existing [design library](../../libs/fi/design/src/layout.scss) contains two small Sass mixins. `page-container` applies shared width, gutter and centering rules. `content-with-aside` implements the one-column fallback, shrinkable tracks, region gap and named container query. It derives the transition from its arguments, keeping the rendered gap and width budget together.

The [web experience](../../libs/fi/experience/web/src/fi-web.page.scss) selects and configures that pattern:

```scss
@use '../../../design/src/layout';

.workspace {
  @include layout.page-container;
  container: instrument-detail / inline-size;
}

.fi-layout {
  @include layout.content-with-aside(
    $container: instrument-detail,
    $main-min: 34rem,
    $aside-min: 19rem,
    $aside-max: 21rem
  );
}
```

The import above is relative to the demo's web stylesheet. The named container must be an ancestor of the layout. Keep exactly two regions in main-then-aside source order; do not reorder them visually against keyboard order. Use compatible `rem` lengths for the mixin's sizing arguments. Configure the gap through the mixin instead of overriding the emitted CSS and leaving its threshold stale.

The [semantic tokens](../../libs/fi/design/src/tokens.scss) provide the page, reading and form width limits, page gutter and spacing. Both the [Ionic page](../../libs/fi/experience/mobile/src/fi-mobile.page.scss) and the [modal body](../../libs/fi/trading/feature/src/mobile-trade.component.scss) use `page-container` with their chosen tokens. The primitive adds no scroller. Ionic retains its page/modal scroll ownership, and the feature retains presentation, focus and draft lifecycle.

This is a small implemented pattern, not a complete design-system package. Reusing a Sass contract is sufficient here: layout needs no additional Angular component, resize subscription or device flag. CSS changes the existing regions without destroying their state owners. The four domain library roles remain as described in [adaptive experiences](adaptive-mobile-desktop-experiences.md#share-capabilities-through-small-contracts).

## Verify the contract, then expand only when needed

Test just below and at the content-fit boundary, not only common device widths. Constrain the content inside a wide viewport to prove that the correct container controls the transition. Change the root text size to challenge the relative width budget. In each case, check overflow, source/focus order, component identity, chart selection and partial draft continuity.

For the mobile composition, widen to tablet and use a short landscape viewport: Invest should still open the full-page modal, and its controls should remain reachable through the owned scroller. A phone frame is a browser viewport aid, not physical-device evidence.

Follow the [run guide](../guides/adaptive-fi.md) to try Desktop web, Mobile web and Ionic mobile in the same preview. The [layout validation record](../validation/design-system-layout.md) separates measured behavior from remaining device/accessibility work. Promote another pattern only when a real consumer needs its contract; a consistent design system does not require a universal page engine.
