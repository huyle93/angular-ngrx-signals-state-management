# Chart Integration Guide

> TradingView Lightweight Charts (LWC) in Angular + Ionic + Capacitor
>
> AI coding reference for the Plynk Invest (Phoenix/v2) mobile app.

---

## Table of Contents

1. [Goal](#1-goal)
2. [Component Architecture](#2-component-architecture) -- 3-tier split: Parent, lib-line-chart wrapper, LWC engine
3. [Component API and Visual States](#3-component-api-and-visual-states) -- Input contract, loading tiers (cold/warm/hot), skeleton, transitions, signal store derivation, success, empty, error
4. [Domain Architecture](#4-domain-architecture)
5. [UX Contract](#5-ux-contract)
6. [LWC Configuration Defaults](#6-lwc-configuration-defaults) -- Crosshair, Interaction Locks, Visuals, Sizing, Time Scale
7. [Series Strategy](#7-series-strategy) -- Data model by domain, Timeframe granularity, PDP gradient area, Portfolio baseline, Toggle pattern
8. [Overlay UI](#8-overlay-ui)
9. [Financial Semantics](#9-financial-semantics)
10. [Performance Rules](#10-performance-rules) -- Data Updates, Tab Switching, Data Sync, Cleanup, Lazy History
11. [Mobile Gesture Behavior](#11-mobile-gesture-behavior)
12. [Haptic Feedback](#12-haptic-feedback) -- Capacitor Haptics, scrub selection lifecycle, step policy, HapticsService
13. [Testing](#13-testing)
14. [Implementation Checklist](#14-implementation-checklist)
15. [Guardrails](#15-guardrails)

---

## 1. Goal

Build a brokerage-grade chart (Robinhood/Fidelity level) inside a hybrid mobile app. The chart must be scrub-first, incrementally updated, memory-safe on navigation, and visually consistent across web, iOS, and Android.

---

## 2. Component Architecture

The chart system is a three-tier hierarchy. Each tier has strict boundaries.

### 2.1 Parent Component (Page / Feature Layer)

The parent owns business truth: why the chart is shown and what state the data is in.

Responsibilities:

- Data source and refresh orchestration (triggers API calls on `ionViewDidEnter`, owns retry logic, backoff, caching/LKG policy).
- State decision: determines which of the four visual states applies (`loading`, `success`, `empty`, `error`).
- Defines what "empty" means for the domain (new user, no portfolio history, no trading activity for the selected range).
- Passes the chart contract inputs to the wrapper (see Section 3).

Forbidden:

- Tooltip/overlay drawing logic.
- LWC lifecycle management (chart creation, series management, resize handling).
- Any direct interaction with LWC APIs.

### 2.2 lib-line-chart Wrapper (Shared UI Layer)

Located at `libs/plynk-mobile/shared/chart-ui/lib-line-chart`. This is a reusable, presentational component shared across all domains that need a chart (portfolio, watchlist, trading, virtual portfolio).

The wrapper owns chart truth: how to render without flicker, how to overlay visual states, and how to update efficiently per LWC docs.

Responsibilities:

- Create and manage the LWC chart instance and series (single creation, never recreated on tab switch).
- Apply stable chart options (`autoSize`, crosshair, grid, interaction locks).
- Handle incremental updates (`series.update()`) vs full replace (`series.setData()`) per LWC guidance.
- Render all in-chart overlays: loading shimmer, error overlay with refresh action, empty-state flat line, scrub legend, live dot.
- Drive haptic feedback for scrub gestures via injected `HapticsService` (selection lifecycle — see Section 12).
- Handle resize safety using `autoSize: true` with a stable-height container.
- Guarantee the chart area never jumps, flickers, or resizes off-screen regardless of which visual state is active.

Forbidden:

- API calls or business logic.
- Deciding what visual state to show (that is the parent's job via the `state` input).
- Store injection.

### 2.3 LWC Engine (Library)

TradingView Lightweight Charts is the rendering engine. It is never accessed directly outside the wrapper.

Owns:

- Rendering series (area, candlestick).
- Crosshair tracking events (`subscribeCrosshairMove`).
- Coordinate conversion (`timeToCoordinate`, `priceToCoordinate`).

---

## 3. Component API and Visual States

### 3.1 Input Contract

The parent communicates with `lib-line-chart` through a defined set of inputs. The wrapper never fetches data or decides state on its own.

| Input | Type | Purpose |
|---|---|---|
| `state` | `'loading' \| 'success' \| 'empty' \| 'error'` | Determines which visual state the wrapper renders |
| `data` | `SeriesData[] \| OhlcData[]` | Chart data. Empty array is valid. |
| `timeframe` | `'1D' \| '1W' \| '1M' \| '1Y' \| '5Y'` | Active timeframe for range and bar spacing |
| `baselineValue` | `number` | Baseline for percent-change calculations |
| `placeholderFlatValue` | `number` (optional) | Value for the flat line in empty state (e.g., 0 or last known balance) |
| `lkgData` | `SeriesData[]` (optional) | Last-known-good data for instant display during loading |
| `retry` | `OutputEmitterRef<void>` (output) | Emitted when user taps the error overlay refresh button. Parent binds as `(retry)="handleRetry()"`. |

### 3.2 Visual State: Loading

Triggered when: the parent is fetching chart data for the first time (no LKG available) or after a timeframe change while fresh data is in flight.

Loading is the most UX-critical state. On high-traffic screens like the portfolio home page, the chart is the centerpiece — a blank rectangle or generic shimmer box signals "broken," not "loading." The chart must feel alive from the first frame.

There are three tiers of loading, each with distinct visual treatment:

| Tier | Condition | Visual | User Perception |
|---|---|---|---|
| Cold start | No LKG data, first visit or cleared cache | Animated chart skeleton | "A chart is about to appear" |
| Warm start | LKG data available from prior session | Real chart (cached) + subtle progress indicator | "My data is here and refreshing" |
| Hot transition | Already in `success`, background refresh in flight | No visible change — silent data patch | "Nothing happened" (ideal) |

Invariant across all tiers: the chart container renders at its final height immediately. No layout shift. No height change. No DOM addition/removal of the container element.

#### 3.2.1 Cold Start Loading (Animated Chart Skeleton)

This is the worst-case UX path: the user launches the app for the first time, taps into a chart screen, and has zero cached data. The API call is in flight. What appears in the chart container must communicate "chart" — not "empty gray box."

**Design principle:** chart-shaped skeletons, not box-shaped. The placeholder must have the visual silhouette of a chart line. Users instantly recognize the shape and understand what is loading.

**Recommended approach — CSS3 animated SVG skeleton:**

Render a lightweight SVG `<path>` element inside the chart container that traces a gentle wave shape across the full width. Apply a shimmer gradient animation that sweeps horizontally, creating the effect of a chart line "breathing" while data loads.

```html
<!-- Inside lib-line-chart wrapper, shown when state === 'loading' && !lkgData -->
<!-- Interactive demo: open chart-skeleton-demo.html in a browser -->
<div class="chart-skeleton" [class.fadeOut]="isTransitioning()">
  <svg viewBox="0 0 400 200" preserveAspectRatio="none" class="skeleton-line">
    <defs>
      <!-- Shimmer gradient — sweeps left-to-right via SVG <animate> -->
      <linearGradient id="line-shimmer" gradientUnits="userSpaceOnUse"
                      x1="-200" y1="0" x2="0" y2="0">
        <stop offset="0%"   stop-color="var(--skeleton-base)" />
        <stop offset="50%"  stop-color="var(--skeleton-highlight)" />
        <stop offset="100%" stop-color="var(--skeleton-base)" />
        <animate attributeName="x1" from="-200" to="450" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="x2" from="0"    to="650" dur="1.8s" repeatCount="indefinite" />
      </linearGradient>
      <!-- Area shimmer gradient (synchronized with line) -->
      <linearGradient id="area-shimmer" gradientUnits="userSpaceOnUse"
                      x1="-200" y1="0" x2="0" y2="0">
        <stop offset="0%"   stop-color="var(--skeleton-area)" />
        <stop offset="50%"  stop-color="var(--skeleton-area-hi)" />
        <stop offset="100%" stop-color="var(--skeleton-area)" />
        <animate attributeName="x1" from="-200" to="450" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="x2" from="0"    to="650" dur="1.8s" repeatCount="indefinite" />
      </linearGradient>
    </defs>
    <g class="skel-breathe">
      <!-- Faint area fill beneath the wave -->
      <path
        d="M0 145 C55 138 78 112 128 106 C178 100 192 118 212 113
           C232 108 258 66 292 70 C326 74 358 50 400 46 V200 H0 Z"
        fill="url(#area-shimmer)"
      />
      <!-- Wave line -->
      <path
        d="M0 145 C55 138 78 112 128 106 C178 100 192 118 212 113
           C232 108 258 66 292 70 C326 74 358 50 400 46"
        fill="none"
        stroke="url(#line-shimmer)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  </svg>
</div>
```

```scss
.chart-skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  z-index: 2; // above LWC canvas, below error overlay
  pointer-events: none;

  &.fadeOut {
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
}

.skeleton-line {
  width: 100%;
  height: 65%;
}

// Breathing pulse on the skeleton SVG group
.skel-breathe {
  animation: skeleton-breathe 3s ease-in-out infinite;
}

@keyframes skeleton-breathe {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}

// The shimmer sweep is handled by SVG <animate> on the gradient.
// No CSS keyframe animation needed for the sweep itself.
```

**Why CSS3/SVG over Lottie:**

| Approach | Pros | Cons |
|---|---|---|
| CSS3 + inline SVG | Zero dependencies, works offline, tiny payload, theme-aware via CSS custom properties | Less design flexibility for complex branded shapes |
| Lottie animation | Full designer control, complex motion, After Effects workflow | Requires `lottie-web` (~50 KB gzipped), JSON asset file, harder to theme dynamically |

Use CSS3/SVG as the default. Reserve Lottie only if the design team provides a branded animation that cannot be replicated with SVG paths. If Lottie is used, lazy-load it — never bundle it in the main chunk.

**Skeleton color theming:**

Define skeleton colors as Ionic CSS custom properties so they adapt to light/dark mode automatically:

```scss
:root {
  --skeleton-base: rgba(var(--ion-color-medium-rgb), 0.18);
  --skeleton-highlight: rgba(var(--ion-color-medium-rgb), 0.38);
  --skeleton-area: rgba(var(--ion-color-medium-rgb), 0.06);
  --skeleton-area-hi: rgba(var(--ion-color-medium-rgb), 0.15);
}

.dark {
  --skeleton-base: rgba(var(--ion-color-medium-rgb), 0.12);
  --skeleton-highlight: rgba(var(--ion-color-medium-rgb), 0.28);
  --skeleton-area: rgba(var(--ion-color-medium-rgb), 0.04);
  --skeleton-area-hi: rgba(var(--ion-color-medium-rgb), 0.10);
}
```

**Gradient area skeleton (included by default):**

The faint area fill beneath the wave line is included in the default skeleton SVG above (the `area-shimmer` gradient path). For PDP instrument charts that use gradient area fill, this previews the area shape during loading. For simpler sparkline charts that do not use area fill, remove the area `<path>` element from the skeleton and keep only the wave line.

**Component ownership:** The animated chart skeleton lives inside `lib-line-chart`. It is a visual concern — the wrapper decides how to render the loading state internally. The parent only passes `state = 'loading'` and optionally `lkgData`. The parent has no knowledge of the skeleton implementation.

#### 3.2.2 Warm Start Loading (LKG + Progress Indicator)

This is the preferred path and the most common one after the first session. The store holds last-known-good data from a prior API call (persisted in memory or cache). The chart renders it instantly with zero delay.

Wrapper behavior:

- Render the LKG series immediately using `series.setData(lkgData)` on first mount, or keep the existing series visible if the chart instance is retained.
- Show a subtle, non-blocking progress indicator that communicates "refreshing" without obscuring the chart. Options ranked by intrusiveness (least to most):
  1. **Thin animated bar at the top edge** of the chart container (2–3 px height, primary color, indeterminate progress animation). This is the recommended default — minimal, familiar, and non-distracting.
  2. **Subtle opacity pulse** on the entire series line (brief, slow pulse at 0.85–1.0 opacity). More organic but harder to distinguish from normal rendering on some devices.
  3. **Small spinner icon** anchored to a corner of the chart container. Acceptable but more visually heavy than a progress bar.
- Do **not** overlay a shimmer, skeleton, or translucent mask. The LKG chart must remain fully interactive — crosshair, scrub legend, and haptics all work normally while the background refresh is in flight.

When the refresh completes: transition smoothly to the new data (see Section 3.2.4).

#### 3.2.3 Scrub Legend Loading State

The scrub legend (fixed header above the chart) also needs a loading treatment. An empty header or "$0.00" above a loading skeleton signals "data error," not "loading."

**Cold start (no LKG):**

- Replace the value, change, and percent-change text with shimmer pill placeholders (rounded rectangles with the same shimmer-sweep animation as the chart skeleton).
- The pills match the approximate width of real values (e.g., "████" for price, "███" for change) so the header does not shift when real values arrive.
- The timestamp area shows a static "—" or similar neutral placeholder.

**Warm start (LKG available):**

- Show the LKG values immediately. No shimmer pills needed.
- When fresh data arrives, the scrub legend values update reactively via signals. No visible transition needed — the values simply change in place.

**Component ownership:** The scrub legend shimmer is part of the scrub legend component itself (shared UI). It reads the `state` input (or a derived `isLoading` signal) and conditionally renders shimmer pills via `@if`. No parent involvement.

#### 3.2.4 Skeleton-to-Data Transition

The moment data arrives is the most visible UX seam. An abrupt swap from skeleton to real chart feels jarring. A smooth crossfade makes the app feel polished and intentional.

**Transition sequence (cold start → success):**

1. Data arrives. Parent sets `state = 'success'` and `data = fullData`.
2. Wrapper calls `series.setData(fullData)` on the LWC chart instance (which was already created but had no data).
3. Wrapper sets an internal `isTransitioning` signal to `true`.
4. The skeleton overlay fades out over ~200 ms via CSS `opacity` transition (the `.fadeOut` class in Section 3.2.1).
5. Simultaneously, the real chart canvas beneath is already painted by LWC. The fade reveals it in place — no positional shift.
6. After the transition completes (CSS `transitionend` event or a `setTimeout` safety net), remove the skeleton from the DOM entirely to avoid stacking context and pointer-event issues.
7. Wrapper sets `isTransitioning` to `false`. The chart is now fully interactive.

**Transition sequence (warm start → fresh data):**

No visible transition. The data patches silently via `series.update()` or `series.setData()`. The user sees the chart update in place. At most, the thin progress bar at the top edge disappears.

**Implementation:**

```typescript
// Inside lib-line-chart wrapper
protected readonly isTransitioning = signal(false);
protected readonly showSkeleton = computed(() =>
  this.state() === 'loading' && !this.lkgData() && !this.isTransitioning()
);
protected readonly showSkeletonFadeOut = computed(() =>
  this.isTransitioning()
);
```

```html
@if (showSkeleton() || showSkeletonFadeOut()) {
  <div class="chart-skeleton" [class.fadeOut]="showSkeletonFadeOut()">
    <!-- SVG skeleton from §3.2.1 (wave + area + animated shimmer) -->
  </div>
}
```

**Timing rule:** Keep the crossfade under 250 ms. Longer feels sluggish. Shorter than 100 ms is imperceptible and wastes the effort. 200 ms is the sweet spot — fast enough to feel immediate, slow enough for the eye to register a smooth reveal.

#### 3.2.5 Signal Store Integration — Visual State Derivation

The four chart visual states (`loading`, `success`, `empty`, `error`) are never stored as raw state in the domain store. They are **derived** from the store's async data signals using `withComputed`. This follows the NgRx Signals principle: do not store derived data.

**Standard async state shape in the domain store:**

```typescript
withState({
  chartData: null as SeriesData[] | null,
  chartLoading: false,
  chartError: null as string | null,
  chartLkgData: null as SeriesData[] | null,
  selectedTimeframe: '1D' as Timeframe,
})
```

**Derived chart state via `withComputed`:**

```typescript
withComputed((store) => ({
  // The single derived signal the parent passes to lib-line-chart
  chartState: computed((): ChartVisualState => {
    if (store.chartLoading()) return 'loading';
    if (store.chartError()) return 'error';
    if (!store.chartData() || store.chartData()!.length === 0) return 'empty';
    return 'success';
  }),

  // Convenience signals for the parent template
  hasChartLkg: computed(() => !!store.chartLkgData()?.length),
}))
```

**Why derived, not stored:**

- If the store method sets `chartLoading: true` and later `chartData: [...]` + `chartLoading: false`, the computed `chartState` transitions automatically: `'loading'` → `'success'`. No extra `patchState({ chartState: 'success' })` call needed.
- If the store method sets `chartError: 'Network timeout'` + `chartLoading: false`, `chartState` becomes `'error'` automatically.
- There is exactly one source of truth. The visual state cannot drift from the underlying data signals because it is recomputed on every change.

**Store method pattern (load with tapResponse):**

```typescript
withMethods((store, repo = inject(ChartRepository)) => ({
  loadChart: rxMethod<Timeframe>((tf$) =>
    tf$.pipe(
      tap((tf) => patchState(store, {
        chartLoading: true,
        chartError: null,
        selectedTimeframe: tf,
      })),
      switchMap((tf) =>
        repo.getChartData$(tf).pipe(
          tapResponse({
            next: (data) => patchState(store, {
              chartData: data,
              chartLkgData: data, // cache as LKG for next load
            }),
            error: (e) => patchState(store, {
              chartError: normalizeError(e),
            }),
            finalize: () => patchState(store, { chartLoading: false }),
          })
        )
      )
    )
  ),
}))
```

**Parent template wiring:**

```html
<lib-line-chart
  [state]="store.chartState()"
  [data]="store.chartData() ?? []"
  [lkgData]="store.chartLkgData()"
  [timeframe]="store.selectedTimeframe()"
  [baselineValue]="store.baseline()"
  (retry)="store.loadChart(store.selectedTimeframe())"
/>
```

The parent is a thin wiring layer. It reads computed signals from the store and passes them as inputs. It does not contain state derivation logic, loading flags, or conditional checks. The store owns the async state machine; the wrapper owns the visual rendering.

### 3.3 Visual State: Success

Triggered when: API returned data and the parent set `state = 'success'`.

Wrapper behavior:

- Render the series from `data`.
- Enable crosshair, scrub legend, and live dot overlays.
- All streaming and background refresh updates arrive as `data` changes and are applied via `series.update()`.
- This is the steady-state mode. No overlays obscure the chart.

### 3.4 Visual State: Empty

Triggered when: API succeeded but returned no data points (new user, no portfolio history for the selected range).

Wrapper behavior:

- Render a flat horizontal line across the full timeframe range using `placeholderFlatValue` (or 0 if not provided).
- Implementation: synthesize two data points at range start and range end with the same value. Do not use LWC whitespace data (that creates gaps, not a flat line).
- Crosshair and scrub legend may optionally remain active on the flat line.
- The chart container maintains its full height. No collapse, no "no data" card replacing the chart area.

### 3.5 Visual State: Error

Triggered when: API call failed and the parent set `state = 'error'`.

Wrapper behavior:

- Keep the chart rendered at the same height. No layout shift.
- Show a centered overlay inside the chart area with a "Refresh" button.
- If LKG series data was previously rendered: keep it visible behind the overlay (dimmed). This is the preferred UX.
- If no prior data exists: show the overlay on a blank chart canvas.
- When the user taps "Refresh", emit `retry`. The parent handles the actual retry and updates `state` accordingly.

### 3.6 State Transition Rules

| From | To | Wrapper Action |
|---|---|---|
| `loading` (cold) | `success` | `series.setData(fullData)`, crossfade skeleton out (200 ms), reveal chart |
| `loading` (warm) | `success` | `series.setData(fullData)` or patch via `series.update()`, remove progress bar |
| `loading` | `error` | Show error overlay (over LKG if available, otherwise over skeleton) |
| `loading` | `empty` | Crossfade skeleton out, synthesize flat line |
| `success` | `loading` | Keep current series visible (warm start), show thin progress bar, no data clear |
| `success` | `error` | Show error overlay over existing series (dimmed) |
| `error` | `loading` | Show loading indicator (warm if LKG available, cold if not), keep dimmed series if available |
| Any | `success` | Apply data, clear all overlays and skeleton |

Critical rule: the chart container height is constant across all state transitions. Overlays and skeletons are absolutely positioned inside the chart container. No external layout elements (cards, banners) replace the chart area.

---

## 4. Domain Architecture

Chart code follows the standard 4-layer domain structure.

| Layer | Chart Responsibilities |
|---|---|
| `data-access/` | Chart SignalStore, baseline computation, OHLC state, repository calls |
| `feature/` | Page component (parent) that owns state decision and wires store signals to `lib-line-chart` |
| `ui/` | `lib-line-chart` wrapper (shared), scrub legend overlay, live dot overlay (presentational only) |
| `util/` | Pure functions: percent change math, time formatting, OHLC-to-area derivation, flat line synthesis |

The shared wrapper lives at `libs/plynk-mobile/shared/chart-ui/lib-line-chart` because it is used by multiple domains (portfolio, watchlist, trading). Domain-specific chart configuration (baseline rules, timeframe options) stays in each domain's `data-access/` or `util/` layer.

Rules:

- No API calls or business logic in `ui/` or `feature/`.
- Baseline computation and percent-change formulas live in `data-access/` or `util/`, never in templates.
- One SignalStore per domain. Chart state lives in the relevant domain store (e.g., portfolio balance history store).
- The wrapper component has zero knowledge of which domain is using it. It receives data and state; it renders.
- `HapticsService` lives in the shared utility layer (`libs/plynk-mobile/shared/util/haptics`). The wrapper injects it for scrub feedback; feature layers inject it for business-event haptics (timeframe tap, trade confirmation).

---

## 5. UX Contract

### 5.1 Interaction Model

- Primary gesture: tap or press-and-drag anywhere on the chart canvas to activate the crosshair. The crosshair snaps to the nearest data point on the X axis regardless of where the finger lands vertically (see Section 6.6).
- Timeframe buttons (1D, 1W, 1M, 1Y, 5Y) control the visible range.
- Pan and zoom are disabled in consumer mode. The user cannot accidentally scroll or pinch the chart.

### 5.2 Crosshair Behavior

- Crosshair snaps to real data points (Magnet mode).
- The crosshair renders as a vertical line only. It does not have a horizontal component that follows the price — the line moves left/right with the scrub position but stays full-height.
- On scrub, the scrub legend (fixed header above the chart) updates to show: price/value, absolute change, percent change vs baseline, and timestamp (ET).
- When the user lifts their finger, the scrub legend reverts to the live-edge value.
- Each bar transition during scrub fires a subtle haptic tick that reinforces the precision feel (see Section 12).

### 5.3 Streaming Indicators

- When streaming is active and the view is at live edge: show a pulsing dot at the latest data point.
- When the user scrubs to a historical point: hide or pause the pulsing dot.
- When the stream is disconnected: show a disconnected state indicator.

---

## 6. LWC Configuration Defaults

### 6.1 Crosshair

Use `CrosshairMode.Magnet` on mobile. Finger input is imprecise; snapping to real data points ensures displayed values are trustworthy.

`CrosshairMode.Magnet` snaps the crosshair's horizontal line to the close price of the nearest data point. For PDP candlestick charts, use `CrosshairMode.MagnetOHLC` instead — it snaps to the nearest OHLC field (open, high, low, or close) rather than close only.

By default, LWC only activates the crosshair when the touch point is near the series line vertically. On mobile, this means users often miss and get no crosshair response. Fix this with a custom touch handler — see Section 6.6.

### 6.2 Interaction Locks

Disable all pan and zoom interactions:

- Disable drag-to-pan and touch drag.
- Disable mouse wheel and pinch zoom.

If disabling touch drag degrades crosshair responsiveness on certain devices, use a soft lock: allow touch drag events but force the visible range back to the selected timeframe interval after the gesture ends.

### 6.3 Visual Defaults and Theming

- Grid lines: minimal or hidden.
- Price scale and time scale: readable, not busy.
- LWC does not inherit CSS variables. All colors must be passed explicitly via `createChart(container, options)` or `chart.applyOptions()`.
- Read Ionic theme color values at runtime using `getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary')` and pass them into LWC options.
- Reapply color options when the app theme changes (light/dark mode). Subscribe to the theme change event or use a `MutationObserver` on `document.body` for the `data-theme` attribute.
- For `BaselineSeries` (portfolio): set `topLineColor`, `topFillColor1`, `topFillColor2`, `bottomLineColor`, `bottomFillColor1`, `bottomFillColor2` to match the app's positive/negative brand colors. These must be updated on theme change.
- For `AreaSeries` (PDP gradient): set `lineColor`, `topColor` (semi-transparent primary), `bottomColor` (fully transparent). These must be updated on theme change. Do not retain stale gradient values after a candlestick toggle — reapply when switching back to area.

### 6.4 Sizing

Use `autoSize: true` in chart options. This delegates resize handling to a `ResizeObserver` on the container element and is the officially recommended approach.

Requirements:

- The chart container must have a stable, explicit CSS height (e.g., `height: 300px` or a flex-defined size). Without this, `autoSize` has nothing to observe.
- If `autoSize` is not used, manually call `chart.applyOptions({ width, height })` whenever the container dimensions change (Ionic keyboard open/close, header/footer visibility changes).

### 6.5 Time Scale Configuration

The visible range and spacing are controlled by `barSpacing` and `rightOffset` on the time scale.

Rules:

- Set `barSpacing` and `rightOffset` once per timeframe selection (1D, 1W, 1M, 1Y, 5Y).
- Do not reapply these values on tab re-enter or background refresh. Reapplying causes visible range jumps.
- Only modify them when the user explicitly changes timeframe.

### 6.6 Tap-Anywhere Crosshair Activation (Mobile Required)

By default, LWC only activates the crosshair when the pointer is near the series line. On mobile this feels broken — users tap the chart and get no response because their finger landed slightly above or below the line.

Fix: intercept `touchstart` and `touchmove` on the chart container, compute the time from the X coordinate, and call `chart.setCrosshairPosition()` to force the crosshair to appear regardless of the vertical tap position.

`setCrosshairPosition(price, time, series)` parameters:
- `price` — the vertical (Y) coordinate to place the crosshair. Pass any valid price; the scrub legend reads the actual data value from the `subscribeCrosshairMove` callback, not from this parameter.
- `time` — the horizontal (X) position, derived from `coordinateToTime(touchX)`.
- `series` — the reference series for the price scale.

```typescript
const container = chartEl.nativeElement;

const onTouch = (e: TouchEvent) => {
  const touch = e.touches[0];
  const rect = container.getBoundingClientRect();
  const x = touch.clientX - rect.left;

  const time = chart.timeScale().coordinateToTime(x);
  if (time === null) return; // outside visible range

  // Pass 0 as price — the actual displayed value comes from subscribeCrosshairMove
  chart.setCrosshairPosition(0, time, series);
};

container.addEventListener('touchstart', onTouch, { passive: true });
container.addEventListener('touchmove', onTouch, { passive: true });
```

This fires `subscribeCrosshairMove` with `param.seriesPrices` containing the actual series value at that time. Read the price for display from there, not from the touch Y coordinate.

On `touchend`, call `chart.clearCrosshairPosition()` to dismiss the crosshair and let the scrub legend revert to the live-edge value.

```typescript
container.addEventListener('touchend', () => {
  chart.clearCrosshairPosition();
}, { passive: true });
```

Remove all three listeners on `ionViewDidLeave` or `ngOnDestroy`.

The code above is the baseline crosshair activation pattern. Section 12.3 provides the complete implementation that extends these handlers with haptic feedback (`selectionStart`/`selectionChanged`/`selectionEnd`) and an `isScrubbing` guard. Use the Section 12.3 version as the production implementation.

---

## 7. Series Strategy

### 7.1 Data Model

The source-of-truth data shape depends on the domain:

| Domain | Source of truth | Default series type | Toggle |
|---|---|---|---|
| Portfolio balance history | `{ time, value }` — one balance per time bucket | `BaselineSeries` (green/red fill) | None |
| PDP / instrument detail (e.g., AAPL) | OHLC `{ time, open, high, low, close }` | `AreaSeries` with gradient fill | `CandlestickSeries` |
| Watchlist sparkline | `{ time, value }` (close only) | `AreaSeries` (no gradient required) | None |

For portfolio balance: there is no OHLC. The store holds `BalancePoint[]` — one value per time bucket. Do not force OHLC for domains that have no OHLC data.

For PDP instrument charts: OHLC is the source of truth even when displaying area. Area series derives `{ time, value: close }` from OHLC. This keeps the toggle to candlestick lossless.

### 7.2 Timeframe Data Granularity

Each timeframe maps to a specific bar interval. The interval determines how many data points are loaded and what `barSpacing` is appropriate.

| Timeframe | Bar Interval | Typical Point Count |
|---|---|---|
| 1D | 1 min or 5 min | 78 – 390 bars |
| 1W | 30 min or 1 hr | 65 – 130 bars |
| 1M | 1 day | ~22 bars |
| 1Y | 1 day | ~252 bars |
| 5Y | 1 week or 1 day | 260 – 1260 bars |

The repository layer is responsible for fetching data at the correct interval for the selected timeframe. The store passes the resolved dataset to the wrapper; the wrapper does not request data.

### 7.3 Gradient Area Series (PDP / Instrument Detail Charts)

The financial instrument detail page (e.g., AAPL price history) defaults to an `AreaSeries` with a gradient fill beneath the line. This is the standard brokerage PDP visual used by Robinhood, Coinbase, and Webull.

**LWC `AreaSeries` gradient options:**

| Option | Purpose |
|---|---|
| `lineColor` | The price line color. Typically the app's primary/brand color or a neutral. |
| `topColor` | Fill color at the top of the gradient area (below the line). Use semi-transparent primary color. |
| `bottomColor` | Fill color at the bottom of the gradient area. Use fully transparent (`rgba(x,x,x,0)`). |
| `lineWidth` | Line thickness. `2` is standard for mobile. |

**Dark/light mode gradient pattern:**

The gradient must adapt when the user switches themes. Define separate color sets and reapply via `series.applyOptions()` on theme change.

```
Light mode:
  lineColor:   app primary (e.g., brand blue at full opacity)
  topColor:    app primary at ~20% opacity
  bottomColor: app primary at 0% opacity (transparent)

Dark mode:
  lineColor:   app primary (same or slightly lighter)
  topColor:    app primary at ~15% opacity (reduce to avoid heavy fills on dark bg)
  bottomColor: app primary at 0% opacity (transparent)
```

Do not hardcode hex or rgba values. Derive them from Ionic CSS custom properties at runtime (see Section 6.3). Pass the resolved colors into `series.applyOptions()` whenever the theme changes.

**Implementation notes:**

- The gradient is applied by LWC internally between `topColor` and `bottomColor`. No custom canvas drawing is required.
- The area series candlestick toggle uses the remove/add series pattern described in Section 7.4. When switching back from candlestick to area, re-apply the gradient options immediately — they are not retained.
- `lineColor`, `topColor`, and `bottomColor` must all be updated together on theme change. Partial updates cause visible inconsistency.

### 7.4 Color-Coded Baseline Series (Portfolio Charts)

For portfolio balance history, the chart must color the area above the baseline green and below red — the defining visual of Robinhood/Fidelity portfolio charts.

LWC has a built-in `BaselineSeries` type designed exactly for this:

- Set `baseValue` to the baseline price or balance (see Section 9 for baseline rules).
- LWC automatically fills the area above `baseValue` with `topFillColor` (green) and below with `bottomFillColor` (red).
- The baseline is drawn as a horizontal reference line at `baseValue`.

Use `BaselineSeries` for portfolio balance. Use `AreaSeries` only for simple sparklines where color-coding is not required.

The baseline series `baseValue` must be kept in sync with the `baselineValue` input whenever the timeframe changes.

### 7.5 Switching Between Area and Candlestick (PDP Charts Only)

LWC does not support converting a series type in place. To switch:

1. Save the current visible range.
2. Remove the existing series from the chart.
3. Add a new series of the target type.
4. Set data on the new series.
5. If switching back to `AreaSeries`: immediately reapply gradient options (`lineColor`, `topColor`, `bottomColor`). LWC does not retain options from the previous series instance.
6. Restore the saved visible range to prevent a visual jump.

### 7.6 Defaults by Chart Type

| Chart | Default Series | Toggle | Gradient |
|---|---|---|---|
| Portfolio balance | `BaselineSeries` | None | Green/red fill (above/below baseline) |
| PDP instrument detail | `AreaSeries` | `CandlestickSeries` | Primary color gradient, dark/light mode aware |
| Watchlist sparkline | `AreaSeries` | None | Minimal or no gradient |

---

## 8. Overlay UI

All overlays are HTML elements absolutely positioned inside the chart container. They are managed by Angular, not by LWC. Overlays never trigger chart repaints.

### 8.1 Scrub Legend vs Floating Tooltip

These are two distinct display patterns. Choose one per domain based on the design.

**Scrub legend (recommended — Robinhood/Fidelity pattern):**

A fixed-position display anchored above the chart or at the top of the page. It updates its content as the user scrubs but does not move vertically — it stays in place regardless of where the price line is. Only the displayed date/time and value change.

- Implement as a static Angular component above the chart container. It is not positioned inside the chart canvas.
- The crosshair renders as a vertical line only (no horizontal component following price). The line moves left/right; the legend updates in sync.
- Data flow: `subscribeCrosshairMove(param)` → write values to signals → the fixed legend component reads signals and re-renders in place.
- When the user lifts their finger (`param.time` absent), revert all signals to the live-edge value.

**Floating tooltip (alternative):**

A card that repositions itself near the crosshair point, moving both horizontally and vertically as the price line moves. This is more complex and can feel cluttered on mobile.

- LWC's native tooltip is a price scale label on the right axis only — it cannot be styled into a floating card. The floating tooltip must be a custom Angular overlay.
- Position using `param.point.x` and `param.point.y` from the crosshair event, clamped to the chart container bounds.
- This pattern is not recommended for mobile-first apps where the scrub legend is the standard.

**Rule:** Pick one pattern per chart context. Do not combine a floating tooltip with a scrub legend. All display updates must be signal-driven. Do not directly manipulate DOM text content.

### 8.2 Live Pulsing Dot

LWC provides a built-in last-price animation via `LastPriceAnimationMode` on the series. Prefer this over a custom overlay.

```typescript
import { LastPriceAnimationMode } from 'lightweight-charts';

series.applyOptions({
  lastPriceAnimation: LastPriceAnimationMode.Continuous,   // pulses at all times
  // LastPriceAnimationMode.OnDataUpdate                   // pulses only on new tick
  // LastPriceAnimationMode.Disabled                       // no animation
});
```

Use `OnDataUpdate` for streaming scenarios — the pulse fires on each `series.update()` call and fades out, giving a natural "data arriving" signal without constant motion.

**When to use a custom overlay instead:**

If the design requires styling that exceeds LWC's native options (distinct color, glow ring, larger hit area), fall back to a custom HTML overlay:

- Render as an overlay `<div>` with a CSS pulse animation.
- Position using LWC coordinate conversion: `x = chart.timeScale().timeToCoordinate(lastTime)`, `y = series.priceToCoordinate(lastValue)`.
- Show only when the view is at the live edge and streaming is active.
- Hide when the user scrubs to a historical point.
- Pause animation timers on `ionViewDidLeave`; resume on `ionViewDidEnter`.

For most cases, `LastPriceAnimationMode.OnDataUpdate` is sufficient and requires no coordinate math, no DOM overlay, and no cleanup.

### 8.3 Custom Vertical Line (Optional)

If LWC crosshair line styling is insufficient (limited to color, width, dash style, label visibility), draw a custom overlay `<div>` at the crosshair x-coordinate for full visual control.

### 8.4 State Overlays (Loading, Error)

These overlays are rendered by the wrapper based on the `state` input. They are positioned inside the chart container using absolute positioning and centered with flexbox.

- **Cold start loading overlay:** animated chart skeleton (SVG wave path with shimmer gradient). See Section 3.2.1 for design, theming, and fade-out behavior. Positioned as a full-area overlay at `z-index: 2`.
- **Warm start loading indicator:** thin animated progress bar at the top edge of the chart container (2–3 px). Does not obscure the LKG series beneath. See Section 3.2.2.
- **Error overlay:** centered card with a "Refresh" button. If prior series data exists, the chart canvas behind the overlay is dimmed but visible.

Both overlays maintain the chart container height. They are shown/hidden via CSS or `@if` control flow, never by adding/removing the chart container element itself.

---

## 9. Financial Semantics

### 9.1 Universal Formula

```
percentChange  = (currentValue - baselineValue) / baselineValue
absoluteChange = currentValue - baselineValue
```

Only the baseline selection changes by timeframe.

### 9.2 Baseline Rules by Timeframe

| Timeframe | Baseline |
|---|---|
| 1D (intraday) | Previous trading session close (PrevClose) |
| 1W, 1M, 1Y, 5Y | Close at the start of the selected range window (close-to-close return) |

The baseline date must be aligned to the trading calendar (skip weekends and holidays).

### 9.3 Intraday (1D) Details

- During market hours, the default "current" value (when not scrubbing) is the last trade price.
- After market close, the default "current" is today's official close. For equities, after-hours price may optionally be shown as a separate state, but the baseline remains PrevClose.
- Crosshair at any time T compares `valueAtT` against PrevClose.

### 9.4 Multi-Range Details

- Baseline is the close on the first trading day of the selected window.
- For equities on long ranges (1Y, 5Y), decide once whether to use adjusted close (for splits/dividends) and document that decision.

### 9.5 Indices

For indices, "price" means the official index level (e.g., S&P 500 index value), not an ETF proxy (e.g., SPY).

### 9.6 Candle Field Semantics

- `open` = bar open price. This is NOT the baseline.
- `close` = bar close price. May be stale if the bar is still forming.
- Never use candle `open`/`close` fields for headline percent-change math. Always use the baseline rules above.

---

## 10. Performance Rules

### 10.1 Chart Lifecycle

- Create the chart instance once on first view enter or component mount.
- Retain the chart instance, series instance, last-known-good (LKG) data, and last visible range snapshot across tab switches.
- Never re-create the chart on timeframe switch, data refresh, or Ionic tab re-enter.

### 10.2 Data Update Rules

This is the primary rule for flicker-free charts. LWC officially recommends `series.update()` for live data and warns against using `setData()` for streaming because it replaces all series data and causes a full repaint.

| Scenario | Method | Notes |
|---|---|---|
| Initial load | `series.setData(fullData)` | One call with the complete dataset |
| Timeframe change | `series.setData(fullData)` | Full replace is expected here |
| Streaming tick | `series.update(lastBar)` | Appends or updates the last bar only |
| Background refresh (latest bar) | `series.update(latestBar)` | Preferred path for silent refreshes |
| Background refresh (tail of N bars) | Merge in memory, then `series.update()` per new bar | Avoid `setData()` for small patches |

Never call `setData()` on every tick or on every background refresh.

### 10.3 Tab Switching (Ionic Lifecycle)

Ionic tabs keep previously visited pages in the DOM. The chart must survive tab switches without flicker, zoom resets, or data loss.

**On `ionViewDidLeave` (or before applying large data updates):**

1. Snapshot the visible range: `const vr = chart.timeScale().getVisibleLogicalRange()`
2. Store `vr` in the component or store for later restoration.

**On `ionViewDidEnter` (tab re-enter):**

1. Do NOT recreate the chart or series.
2. Show LKG data immediately (already in memory and rendered).
3. Trigger a background API refresh (silent, no spinner).
4. When fresh data arrives, patch with `series.update()` (preferred) or `series.setData()` only if the full dataset changed (e.g., timeframe was switched while away).
5. Restore the visible range: `chart.timeScale().setVisibleLogicalRange(vr)`

**`fitContent()` usage:**

- Call `fitContent()` only on first render or after an explicit timeframe change.
- Never call `fitContent()` on tab re-enter. It reframes all data and feels like a zoom reset.

### 10.4 Data Sync Strategy (Snappy Freshness)

All chart data loading follows the app-wide "snappy freshness" (SWR-like) pattern:

1. Show LKG state from the store immediately. The chart renders cached data with zero delay.
2. Fire a background API fetch. No loading spinner on the chart.
3. On success: patch the chart incrementally via `series.update()`. The UI reacts automatically through signals.
4. On failure: keep LKG data visible. Show a subtle, non-blocking error indicator. Never show a full error screen for stale-data scenarios.

This two-phase approach (instant LKG, then silent refresh) is the primary data-loading pattern for all chart interactions.

### 10.5 Scrub Legend and Overlay Updates

- Drive all overlay content via Angular signals. No direct DOM manipulation.
- If overlay positioning needs smoothing, clamp position once per `requestAnimationFrame`.
- Scrub legend and overlay updates never trigger chart repaints. They operate on a separate HTML layer.

### 10.6 Cleanup (Critical in Ionic)

On navigation away (`ionViewDidLeave` or `ngOnDestroy`):

- Unsubscribe crosshair listeners.
- Stop animation timers (live dot pulse).
- Remove resize observers.
- Destroy the chart instance only if the view is fully disposed (not on tab hide).

On tab hide (view cached but not destroyed):

- Pause streaming updates.
- Snapshot visible range for restoration.
- Do NOT destroy the chart instance.

Failure to clean up causes duplicate listeners, memory leaks, and CPU drain on idle screens.

### 10.7 Lazy History Loading (Optional)

If the app supports "load more when scrolling left":

- Use `series.barsInLogicalRange(range)` to detect how many bars remain before/after the visible window.
- Subscribe to visible logical range changes via `chart.timeScale().subscribeVisibleLogicalRangeChange()`.
- Fetch older history and prepend to the dataset before the user sees empty space.

This is not required for the initial implementation but the architecture should not preclude it.

---

## 11. Mobile Gesture Behavior

Desktop hover (`mousemove`) and mobile touch (`touchstart`/`touchmove`) are fundamentally different input models.

- **Desktop Chrome:** crosshair appears on hover.
- **Chrome DevTools mobile emulation:** hover is disabled (`hover:none`, `pointer:coarse`). Crosshair appears only after tap/press, then tracks on drag. This is correct emulation behavior, not a bug.
- **Real iOS/Android device:** the custom touch handler (Section 6.6) allows any tap anywhere on the chart canvas to activate the crosshair. The finger does not need to land on or near the price line. This is the authoritative test environment.

Do not attempt to "fix" hover absence in mobile emulation. Validate tap-anywhere crosshair behavior on real devices or Xcode/Android simulators.

---

## 12. Haptic Feedback

Premium chart interactions include tactile feedback that reinforces scrubbing precision and produces a "Robinhood-like" feel. Use Capacitor's `@capacitor/haptics` plugin exclusively — never use `navigator.vibrate()` or custom vibration patterns.

### 12.1 Capacitor Haptics Primitives

The chart uses three categories of haptic feedback, matched to their intended semantics in iOS (Taptic Engine) and Android (Material haptics):

| Primitive | Capacitor Method | Chart Use Case |
|---|---|---|
| Selection lifecycle | `selectionStart()` / `selectionChanged()` / `selectionEnd()` | Chart scrubbing (continuous gesture) |
| Impact | `impact({ style: 'Light' })` | Timeframe button tap (1D, 1W, 1M, 1Y, 5Y) |
| Notification | `notification({ type })` | App-level outcomes (trade confirmed, request failed) — not chart-specific |

Design principles (Apple + Material guidelines):

- Haptics augment visuals. They never replace visual feedback. The app must be fully usable with haptics disabled.
- Use subtle, predictable patterns. Avoid jarring or long vibrations.
- Do not convey critical information solely through haptics.
- Respect system-level user preferences — the Capacitor plugin handles this automatically.

### 12.2 HapticsService (Shared Utility)

All haptic calls go through a shared `HapticsService`. Never call the Capacitor plugin directly from components.

Location: `libs/plynk-mobile/shared/util/haptics/haptics.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly isNative = Capacitor.isNativePlatform();

  selectionStart(): void {
    if (!this.isNative) return;
    Haptics.selectionStart();
  }

  selectionChanged(): void {
    if (!this.isNative) return;
    Haptics.selectionChanged();
  }

  selectionEnd(): void {
    if (!this.isNative) return;
    Haptics.selectionEnd();
  }

  impactLight(): void {
    if (!this.isNative) return;
    Haptics.impact({ style: ImpactStyle.Light });
  }

  impactMedium(): void {
    if (!this.isNative) return;
    Haptics.impact({ style: ImpactStyle.Medium });
  }

  notificationSuccess(): void {
    if (!this.isNative) return;
    Haptics.notification({ type: NotificationType.Success });
  }

  notificationWarning(): void {
    if (!this.isNative) return;
    Haptics.notification({ type: NotificationType.Warning });
  }

  notificationError(): void {
    if (!this.isNative) return;
    Haptics.notification({ type: NotificationType.Error });
  }
}
```

The `isNative` guard prevents errors on web/PWA where the haptics plugin is unavailable. All methods are fire-and-forget — haptics must never block the UI or throw exceptions. Do not `await` the underlying Capacitor Promises.

### 12.3 Chart Scrubbing — Selection Lifecycle

This is the primary haptic interaction for the chart component. It produces the subtle "precision tick" feel as the user drags across data points — the signature Robinhood scrub experience.

**Lifecycle mapping:**

| Event | Haptic Call | Trigger |
|---|---|---|
| `touchstart` on chart | `haptics.selectionStart()` | Finger down, scrub begins |
| Crosshair snaps to new bar | `haptics.selectionChanged()` | Bar index changed (detected via `subscribeCrosshairMove`) |
| `touchend` / `touchcancel` | `haptics.selectionEnd()` | Finger lifted, scrub ends |

**Step policy — fire on bar change, not on every pixel:**

`selectionChanged()` fires only when the crosshair moves to a different data point, not on every pixel of finger movement. Detect bar changes by tracking `param.time` from `subscribeCrosshairMove`. In Magnet mode, consecutive touch positions within the same bar produce the same `param.time`. When the finger crosses a bar boundary, `param.time` changes and exactly one haptic fires.

**Integration with touch handlers (Section 6.6) and crosshair callback:**

```typescript
// In the wrapper component
private lastSnappedTime: Time | null = null;
private isScrubbing = false;

// --- Touch handlers (extends Section 6.6) ---

private onTouchStart = (e: TouchEvent) => {
  this.isScrubbing = true;
  this.lastSnappedTime = null;
  this.haptics.selectionStart();
  this.handleTouchPosition(e);
};

private onTouchMove = (e: TouchEvent) => {
  this.handleTouchPosition(e);
};

private onTouchEnd = () => {
  this.chart.clearCrosshairPosition();
  this.haptics.selectionEnd();
  this.isScrubbing = false;
  this.lastSnappedTime = null;
};

private handleTouchPosition(e: TouchEvent): void {
  const touch = e.touches[0];
  const rect = this.container.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const time = this.chart.timeScale().coordinateToTime(x);
  if (time === null) return;
  this.chart.setCrosshairPosition(0, time, this.series);
}

// --- Crosshair move callback (step-policy haptics) ---

private setupCrosshairListener(): void {
  this.chart.subscribeCrosshairMove((param) => {
    // Haptic step: fire only during active scrub and only on bar change
    if (this.isScrubbing && param.time && param.time !== this.lastSnappedTime) {
      this.lastSnappedTime = param.time;
      this.haptics.selectionChanged();
    }

    // Update scrub legend signals (see Section 8.1)
    // ...
  });
}
```

**Why the `isScrubbing` guard:** `subscribeCrosshairMove` also fires during streaming data updates and programmatic crosshair moves. Without the guard, haptics would fire on incoming data ticks — not just user scrubs.

**Why this self-rate-limits:** In Magnet mode, haptic frequency is naturally bounded by data density. A 1D chart with 390 one-minute bars cannot produce more than 390 ticks across a full scrub. Most scrubs cross 20–50 bars, well within the comfortable range. No external throttle timer is needed.

### 12.4 Timeframe Button Tap

When the user taps a timeframe button (1D, 1W, 1M, 1Y, 5Y), fire a light impact for tactile confirmation:

```typescript
onTimeframeChange(tf: Timeframe): void {
  this.haptics.impactLight();
  this.store.setTimeframe(tf);
}
```

This is a parent/feature-layer responsibility. The chart wrapper has no knowledge of timeframe buttons.

### 12.5 Non-Chart Haptic Mapping (Reference)

These haptics are outside the chart wrapper's scope but are documented here for app-wide consistency:

| Event | Haptic | Owner |
|---|---|---|
| Trade submitted / order confirmed | `notification(Success)` | Trade feature layer |
| Validation warning / limit reached | `notification(Warning)` | Relevant feature layer |
| Request failed / trade rejected | `notification(Error)` | Relevant feature layer |
| Destructive action (cancel order) | `impact(Medium)` | Relevant feature layer |

Do not add these haptics in the chart wrapper. They belong in their respective domain feature layers.

### 12.6 Platform Notes

- **iOS**: Haptics available on iPhone 7+ (Taptic Engine). No runtime permission required.
- **Android**: Capacitor handles the `VIBRATE` permission automatically via the plugin's `AndroidManifest.xml` merge. No manual permission request needed.
- **Web/PWA**: The `HapticsService.isNative` guard silently no-ops. Do not fall back to `navigator.vibrate()` — it produces inferior feedback.
- **User preferences**: Both iOS and Android allow users to disable haptics system-wide. The Capacitor plugin respects these settings automatically. Do not attempt to detect or override this.

### 12.7 Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Fire `selectionChanged()` on every `touchmove` | Buzzy, unpleasant vibration; overwhelms tactile system | Step policy: fire only on bar change via `subscribeCrosshairMove` |
| Call `selectionChanged()` without `selectionStart()` | Some platforms ignore orphaned selection events | Always bracket with `selectionStart()` / `selectionEnd()` |
| Use `Haptics.vibrate()` for scrub feedback | Generic vibration feels cheap compared to selection primitives | Use `selectionStart` / `selectionChanged` / `selectionEnd` |
| `await` haptic calls in touch handler | Blocks the gesture hot path, causes stutter | Fire-and-forget (never await) |
| Direct `@capacitor/haptics` imports in components | Untestable, no platform guard, scattered imports | Route all calls through `HapticsService` |
| Haptics for business events in chart wrapper | Violates component responsibility boundary | Business-event haptics belong in parent/feature layer |

---

## 13. Testing

### 13.1 Interaction Tests (Manual)

On iOS simulator and real device:

- Verify tap-anywhere crosshair activation works across the full chart canvas height.
- Verify crosshair scrub is smooth and responsive.
- Verify no accidental panning or zooming occurs.
- Verify scrub legend updates correctly and reverts on finger lift.
- Verify haptic tick is felt on each bar transition during scrub (real device only — simulators may not reproduce haptics accurately).
- Verify haptics stop cleanly on finger lift (`selectionEnd` fires).

On Android emulator:

- Same as above, plus verify cleanup on back-navigation.

### 13.2 Correctness Tests

- Compare 1D percent change and absolute change against a known broker app for the same symbol and time.
- Compare 1Y return using baseline close exactly one trading year ago (calendar-aligned).
- Unit test baseline selection logic and percent-change formulas in `util/` or `data-access/`.

### 13.3 Memory and Performance Tests

Navigate in and out of the chart page repeatedly and verify:

- No duplicate crosshair listeners accumulate.
- CPU usage is stable while the chart is idle.
- FPS remains acceptable during active streaming.

### 13.4 Visual State Tests

- Verify cold start loading renders the animated chart skeleton (wave line with shimmer sweep) at full chart height.
- Verify warm start loading shows LKG data immediately with only a thin progress bar.
- Verify skeleton-to-data transition is a smooth 200 ms crossfade with no layout shift.
- Verify scrub legend shows shimmer pills during cold start, real LKG values during warm start.
- Verify error state keeps prior series visible (dimmed) with centered retry button.
- Verify empty state renders a flat line at the correct placeholder value.
- Verify transitions between all four states produce no flicker or height change.
- Verify skeleton theme colors adapt correctly when toggling between light and dark mode during loading.

---

## 14. Implementation Checklist

### Initial Setup

- [ ] LWC chart created once per view lifecycle inside `lib-line-chart` wrapper
- [ ] Portfolio domains use `BaselineSeries` with color-coded fills; no candlestick toggle
- [ ] PDP instrument domains use `AreaSeries` with gradient fill by default; `CandlestickSeries` toggle
- [ ] `AreaSeries` gradient colors (`lineColor`, `topColor`, `bottomColor`) derived from Ionic tokens at runtime
- [ ] `AreaSeries` gradient reapplied after every candlestick-to-area toggle (not retained)
- [ ] `BaselineSeries.baseValue` kept in sync with `baselineValue` input on timeframe change
- [ ] LWC color options read from Ionic CSS custom properties at runtime, never hardcoded
- [ ] Theme change listener (light/dark) reapplies color options for both `BaselineSeries` and `AreaSeries`
- [ ] CrosshairMode.Magnet enabled
- [ ] Tap-anywhere crosshair: `touchstart`/`touchmove` listener calls `chart.setCrosshairPosition()` using `coordinateToTime` (see Section 6.6)
- [ ] `chart.clearCrosshairPosition()` called on `touchend` to revert scrub legend to live value
- [ ] Touch listeners removed on `ionViewDidLeave` / `ngOnDestroy`
- [ ] Pan and zoom disabled

### Component Contract

- [ ] `lib-line-chart` accepts `state`, `data`, `timeframe`, `baselineValue`, `placeholderFlatValue`, `lkgData` inputs
- [ ] `lib-line-chart` emits `retry` output (Angular `output()` function) for error state
- [ ] Parent component owns state decision logic; wrapper has zero business logic
- [ ] Wrapper is domain-agnostic and reusable across portfolio, watchlist, trading

### Visual States

- [ ] Cold start loading: animated SVG chart skeleton with shimmer gradient, themed via `--skeleton-base` / `--skeleton-highlight` CSS custom properties
- [ ] Cold start skeleton adapts to light/dark mode automatically
- [ ] Warm start loading: LKG data shown instantly, thin animated progress bar at top edge, chart remains fully interactive
- [ ] Skeleton-to-data transition: 200 ms CSS opacity crossfade, skeleton removed from DOM after transition
- [ ] Scrub legend loading: shimmer pill placeholders during cold start, LKG values during warm start
- [ ] Hot transition (success → loading → success): no visible change, silent data patch
- [ ] Success: series rendered, overlays active, no obstructions
- [ ] Empty: flat line synthesized from `placeholderFlatValue` across full timeframe range
- [ ] Error: centered overlay with "Refresh" button, prior series dimmed behind overlay
- [ ] Container height constant across all state transitions

### Overlay UI

- [ ] Scrub legend or floating tooltip chosen per domain (not both)
- [ ] Scrub legend: fixed position above chart, updates via signals on `subscribeCrosshairMove`, reverts to live value on finger lift
- [ ] Crosshair configured as vertical line only (no horizontal component following price)
- [ ] Display shows: value, absolute change, percent change, timestamp (ET)
- [ ] Live pulsing dot implemented via `LastPriceAnimationMode.OnDataUpdate` on the series (preferred) or custom HTML overlay if design requires branded styling
- [ ] If custom overlay: positioned by `timeToCoordinate` / `priceToCoordinate`, hidden when user scrubs away from live edge, animation paused on `ionViewDidLeave`

### Haptic Feedback

- [ ] `HapticsService` created at `libs/plynk-mobile/shared/util/haptics/haptics.service.ts` with `isNative` platform guard
- [ ] `selectionStart()` called on `touchstart` when scrub begins
- [ ] `selectionChanged()` fired only on bar index change (step policy via `param.time` comparison in `subscribeCrosshairMove`)
- [ ] `selectionEnd()` called on `touchend` / `touchcancel`
- [ ] `isScrubbing` guard prevents haptics from firing on non-scrub crosshair events (streaming, programmatic moves)
- [ ] `impactLight()` called on timeframe button tap (in parent/feature layer, not wrapper)
- [ ] No direct `@capacitor/haptics` imports outside `HapticsService`
- [ ] All haptic calls are fire-and-forget (not awaited)
- [ ] Haptics gracefully no-op on web/PWA via `isNative` check

### Data Semantics

- [ ] Baseline selection rules implemented per timeframe
- [ ] 1D uses PrevClose as baseline
- [ ] Multi-range uses start-of-range close as baseline
- [ ] Adjusted close policy for equities on long ranges decided and documented

### Performance and Lifecycle

- [ ] Streaming updates use `series.update` (not `setData`)
- [ ] No full chart redraw on tick
- [ ] Full teardown on `ngOnDestroy`; pause-only on `ionViewDidLeave`
- [ ] No leaking subscriptions, timers, or observers

### Tab Switching and Data Sync

- [ ] Chart instance retained across tab switches (not recreated)
- [ ] Visible range snapshot saved on `ionViewDidLeave`
- [ ] Visible range restored on `ionViewDidEnter` via `setVisibleLogicalRange`
- [ ] LKG data shown immediately on re-enter (no spinner)
- [ ] Background refresh triggers `series.update`, not `setData`
- [ ] `fitContent()` called only on first render or timeframe change, never on tab re-enter

### Sizing

- [ ] `autoSize: true` enabled in chart options
- [ ] Chart container has a stable, explicit CSS height
- [ ] No canvas overflow on keyboard open/close or orientation change

### Signal Store Integration

- [ ] Chart visual state (`loading`, `success`, `empty`, `error`) is derived via `withComputed`, never stored as raw state
- [ ] Store exposes `chartState`, `chartData`, `chartLkgData`, `selectedTimeframe`, `baseline` as computed or state signals
- [ ] Parent template is thin wiring only — reads store signals and passes to `lib-line-chart` inputs
- [ ] `loadChart` method uses `tapResponse` with `finalize` to guarantee `chartLoading: false` on both success and error
- [ ] LKG data cached in store on each successful load for instant warm start on next visit

---

## 15. Guardrails

These rules prevent regressions and architectural drift.

**Responsibility boundaries:**

- The parent owns business state (`loading`, `success`, `empty`, `error`). The wrapper never decides state.
- The wrapper owns chart rendering, overlays, and LWC lifecycle. The parent never touches LWC APIs.
- `lib-line-chart` is domain-agnostic. It has no knowledge of portfolio, watchlist, or trading concepts.
- No chart business logic in `ui/` components. They render and position overlays only.
- LWC color options are never hardcoded. They are always derived from Ionic theme tokens at runtime.

**State and overlay rules:**

- The chart container height is constant across all visual states. No layout shift on state transitions.
- Cold start loading uses an animated chart skeleton (SVG wave + shimmer), never a plain gray box, generic spinner, or empty canvas.
- Warm start loading shows LKG data immediately with a non-blocking progress indicator. The chart remains fully interactive during refresh.
- Skeleton-to-data transition is a 200 ms CSS opacity crossfade. Never hard-swap from skeleton to chart.
- The skeleton is removed from the DOM after the fade-out completes. Do not leave hidden skeleton elements stacking in the DOM.
- Scrub legend shows shimmer pill placeholders during cold start, not empty text or "$0.00".
- Error and loading overlays render inside the chart container, not as external replacements.
- LKG data is always shown when available, even during loading and error states.
- Empty state uses a synthesized flat line, never an empty canvas or a "no data" card that replaces the chart.

**Signal store rules:**

- Chart visual state is always derived via `withComputed` from underlying async signals (`chartLoading`, `chartError`, `chartData`). Never store the visual state string directly.
- Always clear `chartLoading` in `finalize` of `tapResponse` to prevent stuck loading states.
- Cache successful chart data as `chartLkgData` in the store so the next load is a warm start.
- The parent component is a thin signal-wiring layer. No state derivation logic, no conditional checks, no loading flags in the parent template — those are store concerns.

**Data and update rules:**

- No baseline or percent-change logic in templates or `feature/` layer.
- Baseline semantics are centralized in `data-access/` or `util/` and covered by unit tests.
- Chart data updates are always incremental (`series.update()`), never re-initialize, except on initial load and timeframe change.
- `setData()` is for initial load and timeframe changes only. All other updates use `series.update()`.
- Never recreate the chart instance on tab re-enter. Retain instance and restore visible range.
- Never call `fitContent()` on tab re-enter. Reserve it for first render and timeframe changes.
- OHLC is the source of truth for PDP/instrument detail domains. Portfolio balance domains use `{ time, value }` as the data shape. Do not force OHLC where it does not exist.
- For PDP domains: area display is always derived from OHLC close. The OHLC record is never discarded.
- `BaselineSeries` is the correct series type for portfolio balance charts (color-coded above/below baseline). `AreaSeries` with gradient fill is the correct default for PDP instrument charts. Do not conflate them.
- Gradient fill colors (`lineColor`, `topColor`, `bottomColor`) are never hardcoded. They are derived from Ionic tokens at runtime and reapplied on every theme change and every toggle back to area from candlestick.
- The scrub legend is the preferred display pattern for mobile: fixed position, vertical crosshair only, signal-driven updates. Do not use a floating tooltip that repositions vertically with the price line unless the design explicitly requires it.
- LWC's native tooltip is a price scale label only and cannot display change data, percent return, or formatted timestamps. Any scrub display is a custom Angular component.
- Live dot should use `LastPriceAnimationMode` unless design requires branded styling beyond what LWC provides.

**Haptic feedback rules:**

- All haptic calls go through `HapticsService`. No direct `@capacitor/haptics` imports in components.
- Chart scrub haptics use the selection lifecycle (`selectionStart` / `selectionChanged` / `selectionEnd`). Never use `impact()` for continuous scrub gestures.
- `selectionChanged()` fires only on bar index change (step policy). Never fire on every pixel of finger movement or every `touchmove` event.
- Haptic calls are fire-and-forget. Never `await` them in touch handler hot paths.
- The wrapper owns scrub haptics (selection lifecycle). Business-event haptics (trade success, validation errors) belong in the parent/feature layer.
- Haptics augment visuals. Never rely on haptics alone to communicate state changes.
- Do not use `Haptics.vibrate()` for chart interactions. Use selection and impact primitives.
- Do not fall back to `navigator.vibrate()` on web. Silently no-op via `HapticsService.isNative` instead.