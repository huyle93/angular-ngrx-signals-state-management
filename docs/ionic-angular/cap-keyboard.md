# Capacitor Keyboard Integration -- AI Agent Instructions

> Authoritative implementation reference for native keyboard behavior across the app.
> Any screen with a decimal/currency input and a fixed-bottom CTA bar must use the shared
> keyboard utility defined here. The trade ticket is the first consumer; all money-movement
> screens (deposit, withdraw, transfer, recurring investment) follow the same pattern.

---

## Table of Contents

- [Capacitor Keyboard Integration -- AI Agent Instructions](#capacitor-keyboard-integration----ai-agent-instructions)
  - [Table of Contents](#table-of-contents)
  - [1. Business Context](#1-business-context)
  - [2. Desired User Experience](#2-desired-user-experience)
  - [3. Technical Decision](#3-technical-decision)
  - [4. Scope Boundaries](#4-scope-boundaries)
    - [In scope](#in-scope)
    - [Out of scope -- do not implement](#out-of-scope----do-not-implement)
  - [5. Technology and Dependencies](#5-technology-and-dependencies)
  - [6. Capacitor Keyboard Configuration](#6-capacitor-keyboard-configuration)
    - [6.1 Install](#61-install)
    - [6.2 Update capacitor.config.ts](#62-update-capacitorconfigts)
    - [6.3 Re-sync after config change](#63-re-sync-after-config-change)
  - [7. Architecture: Shared Keyboard Utility](#7-architecture-shared-keyboard-utility)
    - [7.1 Placement in the Nx workspace](#71-placement-in-the-nx-workspace)
    - [7.2 Why a service, not a directive or base class](#72-why-a-service-not-a-directive-or-base-class)
    - [7.3 Layer rule compliance](#73-layer-rule-compliance)
  - [8. Implementation: KeyboardLayoutService](#8-implementation-keyboardlayoutservice)
  - [9. Implementation: keyboardCta SCSS Mixin](#9-implementation-keyboardcta-scss-mixin)
  - [10. Integration: Consuming Pages](#10-integration-consuming-pages)
    - [10.1 Integration checklist](#101-integration-checklist)
    - [10.2 Page component pattern](#102-page-component-pattern)
    - [10.3 Page template pattern](#103-page-template-pattern)
    - [10.4 Page SCSS pattern](#104-page-scss-pattern)
  - [11. Integration: Trade Ticket Page](#11-integration-trade-ticket-page)
    - [11.1 Changes to trade-ticket.page.ts](#111-changes-to-trade-ticketpagets)
    - [11.2 Changes to trade-ticket.page.html](#112-changes-to-trade-ticketpagehtml)
    - [11.3 Changes to trade-ticket.page.scss](#113-changes-to-trade-ticketpagescss)
  - [12. iOS Accessory Bar Removal](#12-ios-accessory-bar-removal)
  - [13. Keyboard Auto-Focus Behavior](#13-keyboard-auto-focus-behavior)
  - [14. Input Handling](#14-input-handling)
  - [15. QA Acceptance Criteria](#15-qa-acceptance-criteria)
    - [iOS](#ios)
    - [Android](#android)
    - [Functional (both platforms)](#functional-both-platforms)
    - [Consistency (across pages)](#consistency-across-pages)
  - [16. Common Mistakes](#16-common-mistakes)

---

## 1. Business Context

Multiple screens in the app share the same interaction pattern: the user taps a decimal
currency input, the native keyboard opens, and a fixed-bottom CTA bar must reposition above
the keyboard without disturbing the page layout.

**Screens that share this pattern:**

| Screen | Domain | CTA Label |
|---|---|---|
| Trade ticket | trading | "Review" |
| Deposit | transfers | "Continue" |
| Withdraw | transfers | "Continue" |
| Transfer | transfers | "Continue" |
| Recurring investment setup | trading | "Confirm" |

The keyboard behavior must be consistent and predictable across all of these. A user
switching from the trade ticket to the deposit screen should see identical keyboard-to-CTA
interaction. Inconsistent behavior undermines trust on money-movement screens.

**Business constraints:**

- Use the native keyboard with Capacitor plugin integration. Do not build a custom keypad.
- The decimal input mode on existing pages is already implemented. Do not modify input
  behavior or formatting logic.
- A full custom keypad (Robinhood-style) may be evaluated post-release. This architecture
  must not create coupling that blocks that future option.

---

## 2. Desired User Experience

The following behaviors define the target UX. They apply to every screen that uses the
shared keyboard utility.

| # | Behavior | Detail |
|---|---|---|
| 1 | Page stability | When the keyboard opens, the page content must NOT push upward or resize. The layout remains visually fixed. |
| 2 | CTA above keyboard | The fixed-bottom CTA bar must reposition to sit directly above the native keyboard. |
| 3 | Only CTA moves | No other element on the page translates, scales, or repositions in response to keyboard events. |
| 4 | iOS accessory bar hidden | The iOS keyboard accessory bar (the gray/translucent strip with "Done" and navigation arrows) must be hidden on screens using this utility. |
| 5 | Clean dismiss | When the keyboard closes, the CTA bar must return to its default fixed-bottom position with no residual offset, flicker, or animation artifacts. |
| 6 | Safe area correctness | The CTA bar must respect safe-area-inset-bottom when the keyboard is closed. When the keyboard is open, the keyboard occupies the safe area, so the CTA must not double-pad. |
| 7 | Cross-platform | Must work on iOS and Android. iOS is the primary target. Android must not break. |
| 8 | Consistency | All money-movement screens must exhibit identical keyboard-to-CTA behavior. No per-screen variation in animation timing, offset logic, or safe-area handling. |

---

## 3. Technical Decision

**Use:** Capacitor Keyboard plugin (`@capacitor/keyboard`) with `resize: 'none'`.

**Rationale:**

- `resize: 'none'` prevents iOS from resizing or scrolling the WebView when the keyboard
  appears. This is the only resize mode that achieves behavior #1 (page stability).
- The plugin provides `keyboardWillShow` and `keyboardWillHide` events with
  `keyboardHeight` in pixels, which consuming pages use to offset their CTA bar.
- The plugin exposes `setAccessoryBarVisible()` for hiding the iOS accessory bar.
- This approach requires no custom keyboard UI, no digit engine, and no input model changes.

**Architecture decision:** Because multiple screens share the identical keyboard-CTA
pattern, the lifecycle management (listen, track, teardown) and the CTA styling live in a
shared utility. Pages inject the service and bind to its signals. This follows DRY and the
project's modular Nx library structure.

---

## 4. Scope Boundaries

### In scope

- Install and configure `@capacitor/keyboard` at the app level.
- Create `KeyboardLayoutService` in `libs/plynk-mobile/shared/util/`.
- Create a reusable SCSS mixin for keyboard-aware CTA bars.
- Integrate the service into the existing trade ticket page (first consumer).
- Document the integration pattern so future money-movement pages adopt it.
- Hide iOS accessory bar on all money-movement screens.
- Clean up all listeners on page leave/destroy.

### Out of scope -- do not implement

- Custom keypad UI or custom keyboard buttons.
- Input `type`, `inputmode`, or formatting changes on any existing page.
- Robinhood-style keyboard parity.
- `Keyboard.show()` usage (Android-only API, unreliable for cross-platform).
- Modifying the trade ticket page layout, form fields, or business logic.

---

## 5. Technology and Dependencies

| Dependency | Constraint |
|---|---|
| `@capacitor/keyboard` | Install via npm. Sync via `npx cap sync`. |
| Angular | 20+ standalone components, signal-first, `ChangeDetectionStrategy.OnPush` |
| Ionic | All imports from `@ionic/angular/standalone` |
| TypeScript | Strict mode, no `any` |
| SCSS | Domain-scoped, `:host` selector for component root |

---

## 6. Capacitor Keyboard Configuration

### 6.1 Install

```bash
npm install @capacitor/keyboard
npx cap sync
```

If native projects (Xcode, Android Studio) are already open, close and re-run
`npx cap sync` after install.

### 6.2 Update capacitor.config.ts

Add the Keyboard plugin configuration to the existing Capacitor config. Do not replace other
plugin entries. This configuration is app-wide -- it applies to all screens.

```typescript
/// <reference types="@capacitor/keyboard" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ... existing appId, appName, webDir, etc.
  plugins: {
    // ... existing plugin entries
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
```

**Configuration rationale:**

| Key | Value | Why |
|---|---|---|
| `resize` | `'none'` | Prevents iOS from resizing or scrolling the WebView when the keyboard appears. Required for page stability across all screens. |
| `resizeOnFullScreen` | `true` | Android workaround: ensures resize events fire correctly when the app runs in fullscreen or has status-bar overlay. |

### 6.3 Re-sync after config change

```bash
npx cap sync
```

Rebuild and run on simulator/device to verify the config takes effect.

---

## 7. Architecture: Shared Keyboard Utility

### 7.1 Placement in the Nx workspace

The keyboard utility is a cross-domain concern. It does not belong to the trading domain or
any single domain. It lives in the shared utility layer.

```
libs/plynk-mobile/shared/
  util/
    keyboard-layout/
      keyboard-layout.service.ts       <-- KeyboardLayoutService
      keyboard-layout.service.spec.ts  <-- unit tests
      index.ts                         <-- public API (single re-export)
  ui/
    styles/
      _keyboard-cta.scss               <-- reusable SCSS mixin
```

### 7.2 Why a service, not a directive or base class

| Alternative | Rejection reason |
|---|---|
| Base class | Angular discourages inheritance for components. It couples layout assumptions and prevents composition. |
| Directive on `<ion-content>` | The CTA bar lives outside `<ion-content>`. A directive on content cannot control a sibling element. |
| Directive on the CTA element | Viable future option, but adds template complexity for the same result. The service is simpler for now. |
| Inline per-page logic | Violates DRY. Every money-movement page would duplicate identical listener setup, teardown, and signal management. |

The service owns the Capacitor Keyboard lifecycle. Pages inject it, call `attach()` /
`detach()`, and bind to its signals. The service holds no page-specific knowledge (no CTA
markup, no domain state).

### 7.3 Layer rule compliance

| Rule | How it is satisfied |
|---|---|
| `util/` layer: no Angular UI dependencies | `KeyboardLayoutService` imports only `@angular/core` and `@capacitor/keyboard`. No Ionic, no template, no DOM. |
| No domain state leakage | Keyboard signals are transient UI state in the service, not stored in any domain SignalStore. |
| Feature layer owns wiring | Each page's `ionViewDidEnter` / `ionViewDidLeave` calls `attach()` / `detach()`. The service does not auto-activate. |

---

## 8. Implementation: KeyboardLayoutService

This is the complete service. It manages the Capacitor Keyboard plugin lifecycle and exposes
reactive signals that consuming pages bind to in their templates.

```typescript
// libs/plynk-mobile/shared/util/keyboard-layout/keyboard-layout.service.ts

import { Injectable, signal, computed } from '@angular/core';
import { Keyboard, KeyboardInfo, PluginListenerHandle } from '@capacitor/keyboard';

/**
 * Manages native keyboard lifecycle for pages with fixed-bottom CTA bars.
 *
 * Usage:
 *   1. Inject into a page component.
 *   2. Call attach() in ionViewDidEnter.
 *   3. Call detach() in ionViewDidLeave.
 *   4. Bind keyboardVisible() and ctaBottomOffset() in template.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardLayoutService {
  // -- Public signals (read by consuming pages) --

  readonly keyboardVisible = signal(false);
  readonly keyboardHeight = signal(0);

  /**
   * CSS bottom value for a fixed CTA bar.
   * Returns '{height}px' when keyboard is open, '0px' when closed.
   */
  readonly ctaBottomOffset = computed(() => {
    return this.keyboardVisible() ? `${this.keyboardHeight()}px` : '0px';
  });

  // -- Internal listener tracking --

  private listeners: PluginListenerHandle[] = [];
  private attached = false;

  /**
   * Start listening to keyboard events and hide the iOS accessory bar.
   * Call this in ionViewDidEnter of the consuming page.
   * Safe to call multiple times -- subsequent calls are no-ops if already attached.
   */
  async attach(): Promise<void> {
    if (this.attached) {
      return;
    }
    this.attached = true;

    // Hide iOS accessory bar (best-effort; no-op on unsupported platforms)
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
    } catch {
      // Unsupported platform or device -- safe to ignore
    }

    this.listeners.push(
      await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
        this.keyboardVisible.set(true);
        this.keyboardHeight.set(info.keyboardHeight);
      }),
      await Keyboard.addListener('keyboardWillHide', () => {
        this.keyboardVisible.set(false);
        this.keyboardHeight.set(0);
      }),
    );
  }

  /**
   * Remove all keyboard listeners and reset state.
   * Call this in ionViewDidLeave of the consuming page.
   */
  async detach(): Promise<void> {
    if (!this.attached) {
      return;
    }

    await Promise.all(this.listeners.map((listener) => listener.remove()));
    this.listeners = [];
    this.keyboardVisible.set(false);
    this.keyboardHeight.set(0);
    this.attached = false;
  }
}
```

**Design notes:**

- `providedIn: 'root'` makes the service a singleton. Because it manages a single global
  resource (the Capacitor Keyboard plugin), a singleton is correct. Only one page is visible
  at a time in an Ionic tab/stack navigation, so there is no contention.
- The `attached` guard prevents duplicate listeners if `attach()` is called multiple times
  (e.g., rapid page re-entry).
- `keyboardWillShow` / `keyboardWillHide` (not `Did` variants) ensure the CTA repositions
  in sync with the keyboard animation, not after it.
- The service holds zero page-specific knowledge. It does not know about CTA markup, trade
  tickets, or deposits. Pages own their own templates and bind to the service signals.

---

## 9. Implementation: keyboardCta SCSS Mixin

A reusable SCSS mixin ensures all consuming pages apply identical CTA bar positioning,
safe-area handling, and transition behavior. No page should hand-write these styles.

```scss
// libs/plynk-mobile/shared/ui/styles/_keyboard-cta.scss

/// Applies fixed-bottom CTA bar behavior that responds to native keyboard events.
/// The consuming component must:
///   1. Apply this mixin to the CTA container class.
///   2. Bind [style.bottom] to KeyboardLayoutService.ctaBottomOffset().
///   3. Bind [class.keyboard-open] to KeyboardLayoutService.keyboardVisible().
///
/// @param {Length} $cta-height - The resting height of the CTA bar (used for content padding).
///   Defaults to 88px.
@mixin keyboard-cta($cta-height: 88px) {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;

  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--ion-background-color);
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  transition: bottom 180ms ease;
  will-change: bottom;

  // When keyboard is open, the keyboard itself covers the safe area.
  // Remove safe-area bottom padding to prevent double-spacing between CTA and keyboard.
  &.keyboard-open {
    padding-bottom: 12px;
  }
}

/// Adds bottom padding to ion-content so scrollable content is not occluded by
/// the fixed CTA bar.
///
/// @param {Length} $cta-height - Must match the $cta-height passed to keyboard-cta().
@mixin keyboard-cta-content-padding($cta-height: 88px) {
  ion-content::part(scroll) {
    padding-bottom: calc(#{$cta-height} + env(safe-area-inset-bottom));
  }
}
```

**Mixin rationale:**

- Encapsulates the safe-area toggle, transition timing, and `will-change` hint in one place.
  If the animation timing or z-index needs adjustment, change it once.
- The `$cta-height` parameter supports pages with different CTA heights while keeping the
  offset logic consistent.
- Pages `@use` the mixin and apply it to their own CTA class name. The mixin does not
  impose a class naming convention.

---

## 10. Integration: Consuming Pages

This section defines the exact steps to integrate keyboard behavior into any existing page.
The page already exists with its own template, styles, and business logic. These steps add
keyboard-aware CTA positioning without modifying existing page structure.

### 10.1 Integration checklist

For any page that has a decimal input and a fixed-bottom CTA bar:

1. **Inject** `KeyboardLayoutService` into the page component.
2. **Call** `this.keyboardLayout.attach()` in `ionViewDidEnter`.
3. **Call** `this.keyboardLayout.detach()` in `ionViewDidLeave`.
4. **Bind** `[style.bottom]="keyboardLayout.ctaBottomOffset()"` on the CTA container.
5. **Bind** `[class.keyboard-open]="keyboardLayout.keyboardVisible()"` on the CTA container.
6. **Apply** the `keyboard-cta` SCSS mixin to the CTA container class.
7. **Apply** the `keyboard-cta-content-padding` SCSS mixin to the host or page wrapper.
8. **Verify** the CTA bar is a sibling of `<ion-content>`, NOT nested inside it.

### 10.2 Page component pattern

```typescript
// In the existing page component -- add these members, do not restructure the class.

import { KeyboardLayoutService } from '@plynk-mobile/shared/util/keyboard-layout';

// Inside the component class:
protected readonly keyboardLayout = inject(KeyboardLayoutService);

async ionViewDidEnter(): Promise<void> {
  // ... existing ionViewDidEnter logic, if any
  await this.keyboardLayout.attach();
}

ionViewDidLeave(): void {
  // ... existing ionViewDidLeave logic, if any
  void this.keyboardLayout.detach();
}
```

### 10.3 Page template pattern

The CTA container already exists in the page template. Add the two bindings:

```html
<!-- Existing CTA container -- add [style.bottom] and [class.keyboard-open] -->
<div
  class="some-page-cta"
  [style.bottom]="keyboardLayout.ctaBottomOffset()"
  [class.keyboard-open]="keyboardLayout.keyboardVisible()"
>
  <!-- existing CTA content unchanged -->
</div>
```

### 10.4 Page SCSS pattern

```scss
@use '@plynk-mobile/shared/ui/styles/keyboard-cta' as kbd;

:host {
  @include kbd.keyboard-cta-content-padding(88px);
}

.some-page-cta {
  @include kbd.keyboard-cta();
}
```

---

## 11. Integration: Trade Ticket Page

The trade ticket page already exists at:

```
libs/plynk-mobile/trading/feature/trade-ticket.page.ts
```

It has a decimal amount input that opens the native keyboard, and a fixed-bottom CTA bar
with the "Review" button. The page currently uses the default Capacitor keyboard behavior
(WebView resizes on keyboard open). This section describes only what to add.

### 11.1 Changes to trade-ticket.page.ts

Add the `KeyboardLayoutService` injection and lifecycle calls. Do not modify existing
business logic, form setup, or store interactions.

```typescript
import { KeyboardLayoutService } from '@plynk-mobile/shared/util/keyboard-layout';

// Add to existing component class:
protected readonly keyboardLayout = inject(KeyboardLayoutService);

// If ionViewDidEnter already exists, add the attach call at the end:
async ionViewDidEnter(): Promise<void> {
  // ... existing logic
  await this.keyboardLayout.attach();
}

// If ionViewDidLeave already exists, add the detach call at the end:
ionViewDidLeave(): void {
  // ... existing logic
  void this.keyboardLayout.detach();
}
```

### 11.2 Changes to trade-ticket.page.html

Locate the existing CTA container (the div or wrapper that holds the "Review" button and
account/buying-power metadata). Add the two attribute bindings. Do not restructure the
template.

```html
<!-- Find the existing CTA container and add these two bindings: -->
<div
  class="trade-ticket-cta"
  [style.bottom]="keyboardLayout.ctaBottomOffset()"
  [class.keyboard-open]="keyboardLayout.keyboardVisible()"
>
  <!-- existing CTA markup (account info, buying power, Review button) unchanged -->
</div>
```

Confirm that this CTA container is a sibling of `<ion-content>`, not nested inside it. If it
is nested, move it to be a sibling. This is the only structural change that may be required.

### 11.3 Changes to trade-ticket.page.scss

Replace any existing CTA positioning styles with the shared mixin. Remove hand-written
`position: fixed`, `bottom`, `transition`, `will-change`, and safe-area padding from the
CTA class -- the mixin provides all of these.

```scss
@use '@plynk-mobile/shared/ui/styles/keyboard-cta' as kbd;

:host {
  display: block;

  @include kbd.keyboard-cta-content-padding(88px);
}

.trade-ticket-cta {
  @include kbd.keyboard-cta();

  // Keep all existing CTA-internal layout styles (flexbox, gap, typography) as-is.
  // Only remove hand-written position/bottom/transition/safe-area styles -- the mixin owns those.
}
```

---

## 12. iOS Accessory Bar Removal

The iOS keyboard accessory bar is the translucent strip above the keyboard containing
"Done", tab navigation arrows, and (on newer iOS versions) the autocomplete/password bar.
On money-movement screens, this bar wastes vertical space and conflicts with the CTA bar
positioning.

**Implementation:** `KeyboardLayoutService.attach()` calls
`Keyboard.setAccessoryBarVisible({ isVisible: false })` automatically. No per-page action
is needed.

**Platform behavior:**

| Platform | Result |
|---|---|
| iPhone (physical device) | Accessory bar is hidden. |
| iOS Simulator | Accessory bar is hidden (verify on target iOS version). |
| Android | No-op. Android does not have this accessory bar concept. |
| Web (browser) | No-op. Capacitor keyboard plugin is native-only. |

**Constraints:**

- This API is best-effort. Certain iOS versions or configurations may not fully hide the bar.
- The try/catch in the service handles the case where the API is unavailable.
- Always verify on a physical iPhone running the target iOS version before release.

---

## 13. Keyboard Auto-Focus Behavior

**Rule:** Do not programmatically call `Keyboard.show()`. It is Android-only and
unsupported on iOS.

**Expected behavior:**

- If the page flow allows it, auto-focus the decimal input field when the page enters. This
  triggers the native keyboard to open automatically on both platforms.
- If auto-focus is not appropriate (e.g., the user must select an asset or account first),
  let the user tap the input field naturally. The keyboard opens on tap, and the CTA
  repositions via the service listener.
- Do not design around "always open" keyboard on iOS. The user can dismiss the keyboard by
  tapping outside the input, and the CTA must return to its resting position cleanly.
- Auto-focus decisions are page-specific. The `KeyboardLayoutService` does not manage focus.
  Each consuming page decides whether to auto-focus its own input.

---

## 14. Input Handling

The decimal input mode on existing pages is already implemented and functioning. The native
keyboard shows a decimal number pad.

**Rules for this task:**

- Do not modify any input element, its `type`, `inputmode`, or formatting logic on any page.
- Do not add a custom digit engine or formatting pipeline.
- Focus exclusively on keyboard lifecycle events, CTA positioning, and accessory bar removal.
- If a bug is found in existing input behavior during integration, file it separately. Do not
  scope-creep the keyboard integration work.

---

## 15. QA Acceptance Criteria

Every item must pass on every page that integrates `KeyboardLayoutService` before the
implementation is considered complete.

### iOS

- [ ] Keyboard opens and the page content does NOT push upward or resize.
- [ ] CTA bar repositions to sit directly above the keyboard with no gap.
- [ ] iOS accessory bar (Done/arrows bar) is hidden.
- [ ] Safe-area bottom spacing is correct when keyboard is closed.
- [ ] No double-spacing between CTA and keyboard when open (safe-area padding removed).
- [ ] No visual flicker on input focus or blur.
- [ ] Closing the keyboard returns the CTA to its resting bottom position cleanly.
- [ ] Navigating away and returning does not leave stale keyboard offset.

### Android

- [ ] CTA bar appears above the keyboard when it opens.
- [ ] No fullscreen or status-bar overlay resize issue.
- [ ] Keyboard close/open restores layout cleanly.
- [ ] No overlap between CTA and bottom navigation bar or system gesture area.

### Functional (both platforms)

- [ ] Decimal input still works correctly (number pad with decimal point).
- [ ] CTA submit button remains tappable when keyboard is open.
- [ ] Scrolling content is not blocked or clipped unexpectedly.
- [ ] Leaving the page and returning does not retain stale keyboard state.
- [ ] Multiple rapid focus/blur cycles do not cause layout corruption.

### Consistency (across pages)

- [ ] Trade ticket and deposit screens show identical keyboard-to-CTA animation timing.
- [ ] Safe-area handling is identical across all consuming pages.
- [ ] No page has hand-written CTA positioning that deviates from the shared mixin.

---

## 16. Common Mistakes

These are errors to avoid. If an AI agent generates code that matches any of these patterns,
it must be corrected.

| Mistake | Why it is wrong | Correct approach |
|---|---|---|
| Duplicating keyboard listener logic in each page | Violates DRY. Every page gets its own copy of identical setup/teardown/signal code. | Inject `KeyboardLayoutService`. Call `attach()` / `detach()`. Bind to its signals. |
| Hand-writing CTA positioning styles per page | Leads to inconsistent animation timing, safe-area handling, or z-index across pages. | Use the `keyboard-cta` SCSS mixin. |
| Using `translateY(-keyboardHeight)` on the CTA | Compounds with `safe-area-inset-bottom` padding, creating a gap between CTA and keyboard. | Use `bottom: keyboardHeight` via `ctaBottomOffset()` and toggle safe-area padding off via `.keyboard-open` class. |
| Storing keyboard state in a domain SignalStore | Keyboard visibility is transient UI state, not domain data. Pollutes the store. | `KeyboardLayoutService` owns the signals. They are not persisted or shared as domain state. |
| Using `keyboardDidShow` instead of `keyboardWillShow` | The CTA repositions after the keyboard animation finishes, causing a visible gap. | Use `keyboardWillShow` (already handled by the service). |
| Nesting the CTA bar inside `<ion-content>` | The CTA scrolls with content instead of staying fixed at the viewport bottom. | Place the CTA as a sibling of `<ion-content>`, outside the scrollable area. |
| Calling `Keyboard.show()` for iOS | `Keyboard.show()` is Android-only. Throws or no-ops on iOS. | Use input auto-focus to trigger keyboard on page entry. |
| Forgetting `detach()` in `ionViewDidLeave` | Causes stale listeners. On re-entry, `attach()` is a no-op (guard), but the old listeners still fire, leading to unpredictable state. | Always pair `attach()` in `ionViewDidEnter` with `detach()` in `ionViewDidLeave`. |
| Keeping safe-area padding when keyboard is open | Creates a visible gap between the CTA bottom edge and the keyboard top edge. | The mixin handles this via `.keyboard-open` class. Ensure the page binds `[class.keyboard-open]`. |
| Creating the service per-page with `providedIn: 'any'` or per-component providers | Multiple instances fight over the same global Capacitor plugin resource. | Use `providedIn: 'root'` (singleton). Only one Ionic page is active at a time. |
| Modifying existing page structure or form logic during integration | Scope creep. The keyboard integration touches only lifecycle hooks, CTA bindings, and SCSS. | Add only the `KeyboardLayoutService` injection, the two template bindings, and the SCSS mixin. Leave everything else untouched. |
