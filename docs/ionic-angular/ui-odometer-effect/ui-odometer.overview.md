# Price Ticker Odometer -- Product Requirements

## 1. Business Context

The application is a high-performance hybrid mobile investing app (Angular + Ionic + Capacitor) competing with Robinhood, Webull, and Public.

Product priorities:

- Premium mobile UX with native-level responsiveness
- Perceived performance through immediate UI feedback
- Real-time interactive financial data
- Polished micro-interactions

Because all UI renders inside a WebView, animations and interactions must be carefully optimized to match native app smoothness.

---

## 2. Feature Description

The price odometer effect displays a numeric price where each digit rolls vertically when the value changes, mimicking a mechanical counter.

Primary use case: when a user drags the crosshair across a price chart on the instrument detail page (PDP), the price label updates dynamically with rolling digit transitions.

This pattern is standard in Robinhood, Webull, Coinbase, and TradingView mobile apps.

---

## 3. User Experience

When the user scrubs the chart crosshair:

1. The crosshair tracks the user's finger along the price line.
2. The chart emits the price at the current crosshair position.
3. The price label updates immediately.
4. Individual digits roll vertically instead of snapping to the new value.

Example transition:

```
$263.88 -> $263.94 -> $264.01
```

Each digit column animates independently. Static characters (comma, decimal point, currency symbol) remain fixed.

---

## 4. Product Value

### Perceived Performance

Animated digit transitions communicate responsiveness even when underlying data latency exists. This aligns with the Snappy Freshness pattern: show responsive UI immediately, fetch data in the background.

### Competitive Parity

All major trading apps provide animated price updates during chart interaction. Without this, the app appears sluggish relative to competitors.

### Interaction Quality

The motion signals that the chart is interactive, the data reflects a point in time, and the interface is responsive. This is a standard micro-interaction expectation for financial mobile apps.

---

## 5. Technical Constraints

### High-Frequency Updates

Crosshair events fire many times per second during drag gestures. The implementation must:

- Avoid triggering Angular change detection on every raw event
- Prevent layout thrashing
- Eliminate visual flicker

### Architecture Alignment

The implementation must follow project rules:

- Signal-first reactivity (no RxJS for local UI state)
- Standalone components with OnPush change detection
- Presentational components in the UI layer with no business logic
- Chart emits values, UI reacts declaratively

### Performance Budget

- Digit animation via CSS transforms on a GPU-composited layer
- No full component re-renders on value change
- No JavaScript-driven animation loops
- Updates throttled to requestAnimationFrame at the signal-update boundary

---

## 6. Data Flow

```
User drags chart
      |
TradingView crosshair event fires
      |
Feature component throttles update (requestAnimationFrame)
      |
Price signal updated
      |
PriceTickerComponent receives new value via input
      |
Computed pipeline produces new CSS transforms
      |
Browser composites digit strip transitions on GPU
```

---

## 7. Success Criteria

| Category | Requirement |
|---|---|
| Interaction | Price updates with no perceptible lag during crosshair drag |
| Animation | Digits roll smoothly with no layout shift |
| Performance | No frame drops on mid-range mobile devices |
| Performance | No unnecessary Angular change detection cycles |
| Architecture | Component lives in the UI layer with no domain dependencies |
| Architecture | Follows signal-first, OnPush, standalone component patterns |
| Accessibility | Screen reader receives the full formatted price value |
