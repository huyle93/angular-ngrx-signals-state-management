# PDP Footer Stacked Trade Entry Actions

Implementation spec for a stacked micro-motion trade entry CTA in the Product Detail Page footer. The PDP footer shows a single "Invest" toggle button. Tapping it reveals a vertical stack of trade entry actions (Buy, Recurring Buy, Sell) with staggered CSS slide-up animation. Actions are dynamic -- determined by business rules in the parent page, not the child component.

Stack: Angular 21 standalone, signal-first, Ionic 8 standalone primitives, CSS-only animation, OnPush, zoneless.

---

## 1. Business Context

### 1.1 Product Goal

The footer CTA must feel premium, compact, intentional, mobile-native, and fast. It must match the emotional quality of top-tier brokerage apps.

Goals beyond functional exposure:
- Reduce footer clutter
- Emphasize the primary action
- Keep trade entry discoverable
- Deliver a polished motion moment without slowing interaction

### 1.2 Problem

Without this pattern the footer requires multiple buttons at once, creating crowded CTA regions, conditionally shifting layouts, and poor hierarchy between entry actions.

### 1.3 Solution

Present one strong primary affordance ("Invest"). Progressively reveal secondary trade entry options only when the user expresses intent by tapping.

---

## 2. UX Specification

### 2.1 Initial State (Collapsed)

- Footer shows only the primary toggle button labeled "Invest" (solid fill)
- No secondary trade actions are visible

### 2.2 Expanded State

Tap "Invest" to expand. Actions animate upward above the Invest button.

Visual order top-to-bottom when expanded (3 actions shown):

```
  [ Sell           ]     <- highest (index 2)
  [ Recurring Buy  ]     <- index 1
  [ Buy            ]     <- closest above Invest (index 0)
  [ X (close)      ]     <- Invest button, now outline fill
```

- Each button has ~5px vertical gap
- Invest button remains visually anchored in the footer
- Invest button fill transitions from solid to outline; label transitions from "Invest" to an X close icon
- Use `flex-direction: column-reverse` so array index 0 renders closest to Invest

### 2.3 Collapse Triggers

Stack collapses when:
- User taps the X (Invest button) again
- User selects an action
- Parent page collapses it (navigation, modal launch, lifecycle)

### 2.4 Action Execution

On action tap:
1. Stack collapses immediately
2. Selected action is emitted to parent
3. Parent launches trade ticket modal with normalized trade intent

### 2.5 Motion Requirements

**Action button animation -- slot-based slide-up:**

Each action button lives inside an `.action-slot` wrapper with `overflow: hidden`. This creates a clipping pocket from which the button emerges.

- Collapsed state: `transform: translateY(100%)` -- button is fully below its slot, hidden by `overflow: hidden`
- Expanded state: `transform: translateY(0)` -- button slides up into view
- Expand easing: `cubic-bezier(0.22, 1, 0.36, 1)` (snappy spring deceleration, 260ms)
- Collapse easing: `cubic-bezier(0.55, 0, 1, 0.45)` (quick snap-back, 160ms with no per-button delay)

Stagger on expand: `[style.transition-delay]="expanded() ? (i * 55) + 'ms' : '0ms'"` bound directly on each `ion-button`. Inline styles override CSS and cross web component boundaries reliably.
- Item 0 (Buy): 0ms delay -- appears first
- Item 1 (Recurring Buy): 55ms
- Item 2 (Sell): 110ms

Do not use CSS custom properties (`var(--i)`) for stagger timing on Ionic web components. Custom property inheritance through shadow DOM boundaries is unreliable in this context.

Stagger on collapse: all buttons collapse simultaneously (no delay), shortest duration.

**Toggle button label animation:**

The toggle button label overlays two elements in the same grid cell:
- `span.label-invest`: fades in/out with `opacity` only (no transform, no bounce)
- `ion-icon.label-close`: fades in and rotates in from `-90deg` with a spring bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 300ms)

**Toggle button fill animation:**

`[fill]` binding changes between `solid` (closed) and `outline` (open). Transition is applied via `::part(native)` to reach Ionic's shadow DOM:
- `background`, `color`, `box-shadow` transition at 250ms on `cubic-bezier(0.4, 0, 0.2, 1)`

Use CSS transitions only. No animation libraries. No JS-driven per-frame animation. No `height: auto` animation. No layout reflow animation.

### 2.6 Reduced Motion

When `prefers-reduced-motion: reduce` is active, all transition durations and delays are forced to `0ms`. This applies to action buttons, toggle label, and toggle fill via `!important` overrides in the media query block.

---

## 3. Architecture Rules

### 3.1 Layering

- Feature/page layer owns orchestration, business rules, and flow control
- UI component is presentational only -- no API access, no store injection, no business rule ownership
- Signal-first Angular. Ionic primitives for mobile UI. Lightweight rendering.

### 3.2 Ownership Split

**Parent page owns:**
- Ticker context, account context, position existence
- Whether sell is allowed, whether recurring buy is supported
- Final visible action list (computed signal)
- Expanded/collapsed state (writable signal)
- Action selection handling and modal launching

**Child UI component owns:**
- Rendering stacked buttons from provided actions
- Toggle button presentation (label, icon, fill state)
- Motion styling
- Emitting `toggle` and `actionSelected` events

The child never decides which actions are visible. The child never opens modals.

### 3.3 Modal Launch

Modal opening is parent page responsibility. Child emits the selected action. Parent interprets and launches the trade ticket modal with a normalized intent.

### 3.4 Critical: Ionic Layout Containment Constraint

`ion-footer` and `ion-toolbar` apply `contain: paint` in their shadow DOM. This clips any `position: absolute` or `position: fixed` child that attempts to overflow above the toolbar. The action stack must overflow upward, so it **cannot live inside `ion-footer`**.

**Solution:** The component's `:host` is `position: fixed` and acts as the root layout container. The action stack is `position: absolute; bottom: 100%` relative to `:host` -- a sibling to `ion-footer`, not a child of it.

```
:host (position: fixed, bottom: 0)
├── .trade-entry-stack-actions (position: absolute, bottom: 100%)
│   └── .action-slot[]  ← overflow: hidden clips the button during animation
│       └── ion-button.trade-entry-action-btn
└── ion-footer
    └── ion-toolbar
        └── .trade-entry-toolbar-inner
            └── ion-button.trade-entry-toggle-btn
```

Never move the action stack inside `ion-footer` or `ion-toolbar`.

> **Demo / constrained frames only:** `position: fixed` escapes any CSS frame mockup and anchors to the viewport. To contain it, apply `transform: translateZ(0)` on the frame element. In a full-screen Capacitor app this is not needed.

---

## 4. File Placement

Place inside the PDP domain under the Nx library structure:

```
libs/<mobile-scope>/<pdp-domain>/
  data-access/
    store.ts
    repository.ts
    models.ts          <- TradeEntryAction, TradeIntent types here
  feature/
    pdp.page.ts        <- parent page with state + handlers
  ui/
    components/
      footer-trade-entry-stack/
        footer-trade-entry-stack.component.ts
        footer-trade-entry-stack.component.scss
```

The stack component lives in `ui/components/`, never in `feature/`.

---

## 5. Data Contract

### 5.1 Types

```typescript
export type TradeIntent = 'buy' | 'recurring-buy' | 'sell';

export interface TradeEntryAction {
  readonly id: TradeIntent;
  readonly label: string;
  readonly disabled?: boolean;
}
```

Rules:
- `id` is the stable domain identity used to route modal intent
- `label` is display text
- Do not add modal config, routes, callbacks, service references, or visual styling hints to this model

### 5.2 Modal Boundary

The modal input type belongs to the modal feature, not this component. This component emits a `TradeEntryAction` and the parent converts `action.id` to whatever the modal accepts. Do not import or reference modal types inside `FooterTradeEntryStackComponent` or its models file.

---

## 6. Child Component Contract

### Input Mental Model

Inputs fall into two categories. Do not add inputs outside these categories.

| Category | What belongs here | What does NOT belong here |
|---|---|---|
| **Content** | Action list, toggle button label | Icon names, color tokens, individual action styles |
| **Behavior** | Expanded/collapsed state | Animation duration, easing, padding, border radius |

The component owns all visual and motion implementation. The parent owns all business content and state. This boundary keeps the component reusable across different PDP contexts (different tickers, account types, locales) without requiring a configuration surface.

### 6.1 Inputs

```typescript
readonly actions = input.required<readonly TradeEntryAction[]>();
readonly expanded = input(false);
readonly toggleLabel = input('Invest');
```

- `actions`: pre-filtered, ordered list from parent. Child renders exactly what it receives.
- `expanded`: behavioral state owned by parent. Child reflects it.
- `toggleLabel`: the CTA label text. Defaults to `'Invest'`. Pass a different value for different contexts (e.g. `'Trade'`, `'Open Position'`).

### 6.2 Outputs

```typescript
readonly toggle = output<void>();
readonly actionSelected = output<TradeEntryAction>();
```

- `toggle`: fires only after the double-tap guard clears. The component throttles this to one emission per `TOGGLE_GUARD_MS` (350ms).
- `actionSelected`: fires only after `actionsInteractive` settles (post-animation). Never fires while buttons are still sliding in.

### 6.3 Ionic Standalone Imports

Import all Ionic components individually from `@ionic/angular/standalone`. Register icons in the constructor via `addIcons` from `ionicons`.

```typescript
import { IonFooter, IonToolbar, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

constructor() {
  addIcons({ closeOutline });
}
```

Provide `provideIonicAngular({ mode: 'ios' })` in the app config. Do not use `IonicModule`.

### 6.4 Template Structure

```html
<!-- Action stack: OUTSIDE ion-footer to avoid contain:paint clipping -->
<div
  class="trade-entry-stack-actions"
  id="trade-entry-stack"
  [class.expanded]="expanded()"
>
  @for (action of actions(); track action.id; let i = $index) {
    <div class="action-slot">
      <ion-button
        expand="block"
        fill="solid"
        color="primary"
        class="trade-entry-action-btn"
        [style.transition-delay]="expanded() ? (i * 55) + 'ms' : '0ms'"
        [disabled]="action.disabled ?? false"
        [attr.tabindex]="expanded() ? 0 : -1"
        (click)="actionSelected.emit(action)"
      >
        {{ action.label }}
      </ion-button>
    </div>
  }
</div>

<ion-footer>
  <ion-toolbar>
    <div class="trade-entry-toolbar-inner">
      <ion-button
        expand="block"
        color="primary"
        [fill]="expanded() ? 'outline' : 'solid'"
        class="trade-entry-toggle-btn"
        [class.is-open]="expanded()"
        [attr.aria-expanded]="expanded()"
        aria-controls="trade-entry-stack"
        (click)="toggle.emit()"
      >
        <span class="toggle-label">
          <span class="label-invest">{{ toggleLabel() }}</span>
          <ion-icon name="close-outline" class="label-close" aria-hidden="true" />
        </span>
      </ion-button>
    </div>
  </ion-toolbar>
</ion-footer>
```

### 6.5 SCSS

```scss
// :host is the fixed container. Action stack overflows upward from here.
// It must NOT live inside ion-footer due to Ionic's contain:paint clipping.
:host {
  display: block;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

// column-reverse: index 0 (Buy) renders nearest to Invest.
.trade-entry-stack-actions {
  display: flex;
  flex-direction: column-reverse;
  gap: 5px;
  position: absolute;
  bottom: 100%;
  left: 16px;
  right: 16px;
  padding-bottom: 6px;
  pointer-events: none;

  &.expanded {
    pointer-events: auto;
  }
}

// Each slot clips the button during animation (the "pocket" effect).
.action-slot {
  overflow: hidden;
  border-radius: 14px;

  ion-button.trade-entry-action-btn {
    transform: translateY(100%); // fully below slot, hidden by overflow:hidden
    transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
    // Stagger delay is bound inline via [style.transition-delay] -- do not set delay here
    --border-radius: 14px;
    margin: 0;
  }
}

// Expand: slide up, staggered by --i index
.trade-entry-stack-actions.expanded .action-slot ion-button.trade-entry-action-btn {
  transform: translateY(0);
}

// Collapse: all snap back uniformly. [style.transition-delay] is 0ms when collapsed.
.trade-entry-stack-actions:not(.expanded) .action-slot ion-button.trade-entry-action-btn {
  transition-duration: 160ms;
  transition-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
}

ion-footer {
  ion-toolbar {
    --padding-start: 16px;
    --padding-end: 16px;
    --padding-top: 8px;
    --padding-bottom: 12px;
    --background: #fafafa;
    --border-color: #e0e0e0;
  }
}

.trade-entry-toolbar-inner {
  max-width: 420px;
  margin: 0 auto;
}

ion-button.trade-entry-toggle-btn {
  --border-radius: 14px;

  // Smooth fill -> outline via Ionic's shadow DOM part
  &::part(native) {
    transition:
      background 250ms cubic-bezier(0.4, 0, 0.2, 1),
      color      250ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// Both label layers share grid cell. Transitions are split per element.
.toggle-label {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;

  .label-invest,
  ion-icon.label-close {
    grid-area: 1 / 1;
  }

  // Invest: plain opacity fade, no transform (enterprise feel)
  .label-invest {
    opacity: 1;
    transition: opacity 180ms ease;
  }

  // X icon: spring spin-in for personality, spring spin-out on close
  ion-icon.label-close {
    font-size: 22px;
    opacity: 0;
    transform: scale(0.4) rotate(-90deg);
    transition:
      transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity   200ms ease;
  }
}

  // Open state: swap label layers
ion-button.trade-entry-toggle-btn.is-open .toggle-label {
  .label-invest {
    opacity: 0;
  }

  ion-icon.label-close {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-slot ion-button.trade-entry-action-btn {
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
  }

  .toggle-label .label-invest,
  .toggle-label ion-icon.label-close {
    transition-duration: 0ms !important;
  }

  ion-button.trade-entry-toggle-btn::part(native) {
    transition-duration: 0ms !important;
  }
}
```

---

## 7. Parent Page Contract

### 7.1 State

```typescript
readonly investExpanded = signal(false);
```

### 7.2 Dynamic Actions (computed)

```typescript
readonly tradeEntryActions = computed<readonly TradeEntryAction[]>(() => {
  const actions: TradeEntryAction[] = [
    { id: 'buy', label: 'Buy' },
  ];

  if (this.supportsRecurringBuy()) {
    actions.push({ id: 'recurring-buy', label: 'Recurring Buy' });
  }

  if (this.hasPosition()) {
    actions.push({ id: 'sell', label: 'Sell' });
  }

  return actions;
});
```

Note: `tone` is optional metadata. Omit it when not needed by downstream analytics or future conditional logic.

### 7.3 Event Handlers

```typescript
onInvestToggle(): void {
  this.investExpanded.update((v) => !v);
}

async onTradeEntryActionSelected(action: TradeEntryAction): Promise<void> {
  this.investExpanded.set(false);
  await this.openTradeTicketModal(action.id);
}
```

### 7.4 Modal Launcher

```typescript
private async openTradeTicketModal(intent: TradeIntent): Promise<void> {
  // open modal with { intent, symbol: this.symbol(), accountNumber: this.accountNumber() }
}
```

One method. Normalized intent. No separate launcher per action.

### 7.5 Parent Template Usage

```html
@if (tradeEntryActions().length > 0) {
  <app-footer-trade-entry-stack
    [actions]="tradeEntryActions()"
    [expanded]="investExpanded()"
    (toggle)="onInvestToggle()"
    (actionSelected)="onTradeEntryActionSelected($event)"
  />
}
```

Hide the component entirely when no actions are available.

---

## 8. Business Rules for Action Visibility

All rules live in parent page computed state. Never in the child.

| Action | Condition |
|---|---|
| Buy | Buy flow allowed for current ticker/account context |
| Recurring Buy | Instrument supports recurring AND account supports recurring AND product allows it |
| Sell | User has position on the ticker AND account context is valid for selling |

Parent resolves these before passing actions to child. Child receives final render-ready list only.

---

## 8. Reliability and WebView Compatibility

This is a trade entry flow. Animation glitches or accidental taps have direct user trust consequences. Four protections are in place:

### 8.1 Double-tap Toggle Guard

Rapid double-taps on the toggle button are blocked at the component level. Only one `toggle` emission is allowed per `TOGGLE_GUARD_MS` (350ms). Subsequent taps within that window are silently dropped.

```typescript
const TOGGLE_GUARD_MS = 350;

protected onToggleTap(): void {
  if (this.toggleGuardActive) return;
  this.toggleGuardActive = true;
  this.toggleGuardTimer = setTimeout(() => {
    this.toggleGuardActive = false;
    this.toggleGuardTimer = null;
  }, TOGGLE_GUARD_MS);
  this.toggle.emit();
}
```

350ms covers the full animation window (260ms slide + 110ms max stagger) and matches the perceived animation duration for any number of actions up to the expected maximum.

### 8.2 Mid-Animation Action Tap Guard

`pointer-events: auto` is set on the stack container the instant `.expanded` is applied, before any button is visually in its final position. Without a guard, a tap at 50ms could register on a half-visible button — an accidental trade action selection.

`actionsInteractive` is a `signal(false)` that goes `true` only after the last button's animation settles:

```typescript
const settleMs = 260 + (this.actions().length - 1) * 55 + 20; // duration + stagger + buffer
this.settleTimer = setTimeout(() => this.actionsInteractive.set(true), settleMs);
```

All action tap handlers check this gate:

```typescript
protected onActionTap(action: TradeEntryAction): void {
  if (!this.actionsInteractive()) return;
  this.actionSelected.emit(action);
}
```

On collapse, `actionsInteractive` is set to `false` immediately — not after the collapse animation.

### 8.3 Timer Cleanup on Destroy

Both timers (`settleTimer`, `toggleGuardTimer`) are tracked and cancelled on component destroy via `DestroyRef`:

```typescript
this.destroyRef.onDestroy(() => {
  if (this.settleTimer !== null) clearTimeout(this.settleTimer);
  if (this.toggleGuardTimer !== null) clearTimeout(this.toggleGuardTimer);
});
```

This prevents stale callbacks from firing if the user navigates away during animation.

### 8.4 GPU Compositing for WebView

`will-change: transform` is declared on action button elements. This hints iOS WKWebView and Android WebView to pre-promote these elements to a GPU compositing layer before the first animation, preventing the CPU-path jank that can occur on first open in a hybrid Capacitor app.

```scss
ion-button.trade-entry-action-btn {
  will-change: transform;
  // ... other rules
}
```

---

## 9. Accessibility

- Invest/close button: `[attr.aria-expanded]="expanded()"` and `aria-controls="trade-entry-stack"`
- Close icon: `aria-hidden="true"` (decorative; button label text provides the accessible name)
- Collapsed actions: `tabindex="-1"`, `pointer-events: none` -- not keyboard-reachable, not clickable
- Action labels: direct text content -- "Buy", "Recurring Buy", "Sell"
- Reduced motion: all transitions disabled via `prefers-reduced-motion` media query

---

## 10. Edge Cases

| Case | Behavior |
|---|---|
| Zero actions available | Parent hides the stack component entirely via `@if` |
| One action only | Stack still works. Single button reveals on expand. |
| Modal launch failure | Stack is already collapsed. Parent handles error. Child is uninvolved. |
| Context changes while expanded | Parent recomputes `tradeEntryActions`. Child re-renders. Parent may collapse. |
| Component rendered in a constrained frame | Apply `transform: translateZ(0)` on the frame to scope fixed positioning. See section 3.5. |

---

## 11. Performance Rules

Required:
- CSS `transform` only for action button animation (GPU-composited, no layout reflow)
- `overflow: hidden` on `.action-slot` for clip-based reveal -- do not add `opacity` animation to action buttons

Forbidden:
- JS-driven per-frame animation on action buttons
- Layout measurements (`getBoundingClientRect`, `offsetHeight`) in the animation path

---

## 12. Testing Requirements

### Child Component Tests

- Renders only the actions passed via input
- Emits `toggle` when Invest/close button is tapped
- Emits `actionSelected` with the correct action object when an action is tapped
- Applies `expanded` class on `.trade-entry-stack-actions` when `expanded` input is true
- Applies `is-open` class on toggle button when `expanded` is true
- Collapsed state: action buttons have `tabindex="-1"`
- Each `.action-slot` receives the correct `--i` CSS custom property value

### Parent Page Tests

- `tradeEntryActions` computes sell only when `hasPosition()` is true
- `tradeEntryActions` computes recurring buy only when `supportsRecurringBuy()` is true
- `onTradeEntryActionSelected` sets `investExpanded` to false
- `onTradeEntryActionSelected` calls `openTradeTicketModal` with correct intent

### Interaction Tests

- Tap Invest toggles expanded state
- Tap action collapses stack and triggers modal launch flow
- Buttons appear in correct visual order (Buy nearest Invest, Sell highest)

### Accessibility Tests

- `aria-expanded` reflects expanded state on the toggle button
- Reduced motion media query disables all transitions
- Collapsed actions are not focusable

---

## 13. Implementation Sequence

**Phase 1 -- Structure**
1. Create `TradeEntryAction` and `TradeIntent` types in domain models
2. Create `FooterTradeEntryStackComponent` in `ui/components/`
3. Wire `input()` and `output()` contract
4. Render static action stack with Ionic primitives (outside `ion-footer`)
5. Implement expand/collapse via `.expanded` CSS class toggle

**Phase 2 -- Integration**
1. Parent page computes dynamic actions from store/page context
2. Parent page handles toggle and action selection events
3. Parent page launches normalized trade ticket modal

**Phase 3 -- Motion**
1. Wrap each action button in `.action-slot` with `overflow: hidden`
2. Apply `translateY(100%)` collapsed state; `translateY(0)` expanded state
3. Bind `--i` CSS custom property per slot for stagger
4. Add toggle label overlay (grid, `.label-invest` + `.label-close` icon)
5. Add `[fill]` binding + `::part(native)` transition for solid/outline switch
6. Add `prefers-reduced-motion` block

**Phase 4 -- Tests**
1. Unit tests for child component
2. Unit tests for parent page computed state and handlers
3. Interaction and accessibility tests

---

## 14. Constraints

Do not implement:
- Outside-tap-to-close backdrop
- Dimmed screen backdrop
- Haptic feedback
- Spring animation library (use CSS `cubic-bezier` only)
- Business analytics wiring inside child component
- Multi-level nested action menus

---

## 15. Agent Directives

When implementing this feature, follow these rules without exception:

1. Use signal `input()` and `output()` APIs for all component I/O.
2. Child component is presentational only. No store injection. No modal opening. No business logic.
3. Parent page owns expanded state (`signal`), action list (`computed`), toggle label text, and modal launch.
4. **Input discipline:** only add inputs for business content (`actions`, `toggleLabel`) and key behavioral state (`expanded`). Do not add inputs for visual/motion implementation details (colors, animation timing, padding, icon names). The component owns those.
5. Import Ionic components from `@ionic/angular/standalone` only. Register icons via `addIcons`. Do not use `IonicModule`.
6. Action stack must be placed OUTSIDE `ion-footer` in the template. See section 3.4.
7. Animate action buttons with CSS `transform: translateY` inside `overflow: hidden` slots. No JS animation. No `height: auto`. No opacity animation on action buttons.
8. Toggle button label uses CSS grid overlay: `.label-invest` (opacity fade only) and `.label-close` icon (spring spin-in). Do not apply rotation or transform to `.label-invest`.
9. Toggle button fill changes via `[fill]` binding + `::part(native)` CSS transition.
10. Respect `prefers-reduced-motion` with `!important` overrides covering all three animation surfaces.
11. Block interaction on collapsed actions: `pointer-events: none` on container, `tabindex="-1"` and JS guard on buttons.
12. **Reliability — toggle guard:** wrap toggle emission in `onToggleTap()` with a boolean lock and `TOGGLE_GUARD_MS` (350ms) timeout. Never bind `(click)` directly to `toggle.emit()`.
13. **Reliability — action guard:** use `actionsInteractive = signal(false)` gated by `effect()` + `setTimeout` to enable action taps only after expand animation fully settles. Wrap action emission in `onActionTap()`. Never bind `(click)` directly to `actionSelected.emit()`.
14. **Reliability — cleanup:** always inject `DestroyRef` and cancel all `setTimeout` handles in `onDestroy`. Any component using timers must have this.
15. **Reliability — WebView GPU:** declare `will-change: transform` on `ion-button.trade-entry-action-btn` to pre-promote composited layers in WKWebView/Android WebView.
16. Normalize modal launch through a single `TradeIntent`-based method in the parent.
17. Keep the model serializable -- no callbacks, services, or routes in `TradeEntryAction`.
