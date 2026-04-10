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
  - [12. Android Keyboard Issue -- Diagnosis and Fix](#12-android-keyboard-issue----diagnosis-and-fix)
    - [12.1 Symptoms](#121-symptoms)
    - [12.2 Root Cause](#122-root-cause)
    - [12.3 Strategy: Platform Split](#123-strategy-platform-split)
    - [12.4 Fix: Android Native Soft Input Override](#124-fix-android-native-soft-input-override)
    - [12.5 Fix: CSS Viewport Lock](#125-fix-css-viewport-lock)
    - [12.6 Fix: Disable Ionic scrollAssist](#126-fix-disable-ionic-scrollassist)
    - [12.7 CSS Anti-Patterns to Audit](#127-css-anti-patterns-to-audit)
    - [12.8 Android Verification](#128-android-verification)
  - [13. iOS Accessory Bar Removal](#13-ios-accessory-bar-removal)
  - [14. Keyboard Auto-Focus Behavior](#14-keyboard-auto-focus-behavior)
  - [15. Input Handling](#15-input-handling)
  - [16. QA Acceptance Criteria](#16-qa-acceptance-criteria)
    - [iOS](#ios)
    - [Android](#android)
    - [Functional (both platforms)](#functional-both-platforms)
    - [Consistency (across pages)](#consistency-across-pages)
  - [17. Common Mistakes](#17-common-mistakes)

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

**Platform-split strategy:** On Android, `resize: 'none'` does not reliably report keyboard
height (see Section 12). The fix uses `adjustResize` at the native Android level, combined
with a CSS viewport lock to prevent content shift. The service detects the platform and
adjusts `ctaBottomOffset()` accordingly. iOS behavior remains unchanged.

---

## 4. Scope Boundaries

### In scope

- Install and configure `@capacitor/keyboard` at the app level.
- Create `KeyboardLayoutService` in `libs/invest-app/shared/util/`.
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
    },
  },
};

export default config;
```

**Configuration rationale:**

| Key | Value | Why |
|---|---|---|
| `resize` | `'none'` | Prevents the Capacitor plugin from programmatically resizing `document.body` or adjusting Ionic layout. On iOS, this also sets the WebView to not resize (keeping the viewport stable). On Android, the native `windowSoftInputMode` is overridden separately (see Section 12.4). |

> **Removed:** `resizeOnFullScreen: true` was previously set here. It has been removed
> because it conflicts with deterministic keyboard behavior on Android. It toggled the soft
> input mode at runtime to detect keyboard events, causing layout flicker. See Section 12.2.

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
libs/invest-app/shared/
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
| `util/` layer: no Angular UI dependencies | `KeyboardLayoutService` imports only `@angular/core`, `@capacitor/core` (platform detection), and `@capacitor/keyboard`. No Ionic, no template, no DOM. |
| No domain state leakage | Keyboard signals are transient UI state in the service, not stored in any domain SignalStore. |
| Feature layer owns wiring | Each page's `ionViewDidEnter` / `ionViewDidLeave` calls `attach()` / `detach()`. The service does not auto-activate. |

---

## 8. Implementation: KeyboardLayoutService

This is the complete service. It manages the Capacitor Keyboard plugin lifecycle and exposes
reactive signals that consuming pages bind to in their templates.

```typescript
// libs/invest-app/shared/util/keyboard-layout/keyboard-layout.service.ts

import { Injectable, signal, computed } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardInfo, PluginListenerHandle } from '@capacitor/keyboard';

/**
 * Manages native keyboard lifecycle for pages with fixed-bottom CTA bars.
 *
 * Platform behavior:
 *   - iOS: resize 'none' keeps the viewport full-size. CTA offset via ctaBottomOffset().
 *   - Android: native adjustResize shrinks the viewport. position: fixed handles CTA.
 *     A CSS variable --keyboard-safe-height is set to lock page content height.
 *
 * Usage:
 *   1. Inject into a page component.
 *   2. Call attach() in ionViewDidEnter.
 *   3. Call detach() in ionViewDidLeave.
 *   4. Bind keyboardVisible() and ctaBottomOffset() in template.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardLayoutService {
  private readonly isAndroid = Capacitor.getPlatform() === 'android';

  // -- Public signals (read by consuming pages) --

  readonly keyboardVisible = signal(false);
  readonly keyboardHeight = signal(0);

  /**
   * CSS bottom value for a fixed CTA bar.
   *
   * iOS:     Returns '{height}px' when keyboard is open (manual offset needed).
   * Android: Returns '0px' always (adjustResize shrinks viewport; fixed positioning handles it).
   */
  readonly ctaBottomOffset = computed(() => {
    if (!this.keyboardVisible()) return '0px';

    // On Android with adjustResize, the viewport already shrinks above the keyboard.
    // position: fixed; bottom: 0 is correct without additional offset.
    if (this.isAndroid) return '0px';

    // On iOS with resize: 'none', the viewport stays full size.
    // Manually offset the CTA by the keyboard height.
    return `${this.keyboardHeight()}px`;
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

    // Android: capture viewport height before keyboard opens.
    // Pages use var(--keyboard-safe-height) to lock their height.
    if (this.isAndroid) {
      document.documentElement.style.setProperty(
        '--keyboard-safe-height',
        `${window.innerHeight}px`,
      );
    }

    // Hide iOS accessory bar (best-effort; no-op on Android and unsupported platforms)
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

    // Android: remove viewport lock
    if (this.isAndroid) {
      document.documentElement.style.removeProperty('--keyboard-safe-height');
    }

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
- **Platform split:** On iOS, `resize: 'none'` keeps the viewport full-size, so the CTA
  needs manual offset (`ctaBottomOffset` returns `'{height}px'`). On Android, `adjustResize`
  shrinks the viewport above the keyboard, so `position: fixed; bottom: 0` already places
  the CTA correctly (`ctaBottomOffset` returns `'0px'`). See Section 12 for full diagnosis.
- **Viewport lock (Android):** `attach()` captures `window.innerHeight` before the keyboard
  opens and sets `--keyboard-safe-height` on `<html>`. Pages use this CSS variable to lock
  their height, preventing content from reflowing when the viewport shrinks.

---

## 9. Implementation: keyboardCta SCSS Mixin

A reusable SCSS mixin ensures all consuming pages apply identical CTA bar positioning,
safe-area handling, and transition behavior. No page should hand-write these styles.

```scss
// libs/invest-app/shared/ui/styles/_keyboard-cta.scss

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

import { KeyboardLayoutService } from '@invest-app/shared/util/keyboard-layout';

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
@use '@invest-app/shared/ui/styles/keyboard-cta' as kbd;

:host {
  // On Android, --keyboard-safe-height locks the page to its pre-keyboard height.
  // On iOS, the variable is unset and the fallback (100%) applies.
  height: var(--keyboard-safe-height, 100%);
  overflow: hidden;

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
libs/invest-app/trading/feature/trade-ticket.page.ts
```

It has a decimal amount input that opens the native keyboard, and a fixed-bottom CTA bar
with the "Review" button. The page currently uses the default Capacitor keyboard behavior
(WebView resizes on keyboard open). This section describes only what to add.

### 11.1 Changes to trade-ticket.page.ts

Add the `KeyboardLayoutService` injection and lifecycle calls. Do not modify existing
business logic, form setup, or store interactions.

```typescript
import { KeyboardLayoutService } from '@invest-app/shared/util/keyboard-layout';

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
@use '@invest-app/shared/ui/styles/keyboard-cta' as kbd;

:host {
  display: block;
  height: var(--keyboard-safe-height, 100%);
  overflow: hidden;

  @include kbd.keyboard-cta-content-padding(88px);
}

.trade-ticket-cta {
  @include kbd.keyboard-cta();

  // Keep all existing CTA-internal layout styles (flexbox, gap, typography) as-is.
  // Only remove hand-written position/bottom/transition/safe-area styles -- the mixin owns those.
}
```

---

## 12. Android Keyboard Issue -- Diagnosis and Fix

### 12.1 Symptoms

On Android (particularly Google Pixel running Android 12+), when the keyboard opens on a
money-movement screen:

- The entire page/modal content shifts upward toward the top of the screen.
- The CTA bar may not position correctly above the keyboard, or may stay behind it.
- The layout "jumps" or "pushes up" instead of remaining stable.
- `keyboardHeight` may be reported as `0`, leaving the CTA hidden behind the keyboard.

This does NOT happen on iOS where the same code works correctly.

### 12.2 Root Cause

The issue has three interacting root causes in the Capacitor + Ionic + Android stack:

**1. `resize: 'none'` does not reliably report keyboard height on Android.**

Capacitor's `resize: 'none'` sets `windowSoftInputMode` to `adjustNothing` on Android. The
plugin detects keyboard height by comparing `getWindowVisibleDisplayFrame()` to the screen
height. With `adjustNothing`, the visible frame does not change when the keyboard opens, so
`keyboardHeight` is reported as `0`. The CTA stays at `bottom: 0px` -- behind the keyboard.

**2. On some Android versions, `adjustNothing` is not fully respected.**

On Android 12+ with edge-to-edge display, gesture navigation, or certain OEM WebView builds
(particularly on Google Pixel devices), the WebView may partially resize even with
`adjustNothing`. This creates an unpredictable hybrid state: the viewport partially shifts
(causing content to jump) while keyboard height is still reported incorrectly.

**3. `resizeOnFullScreen: true` creates conflicting resize signals.**

This flag enables a workaround for keyboard detection in fullscreen mode. On Android, it can
temporarily toggle the soft input mode to detect keyboard events, then toggle back. During
this switching, the WebView receives mixed resize signals, causing visible flicker and
content displacement. In combination with Ionic's fullscreen modal structure, this amplifies
the layout instability.

### 12.3 Strategy: Platform Split

The iOS and Android WebView keyboard models are fundamentally different. Rather than forcing
a single approach that fails on one platform, the fix uses a platform-aware strategy:

| Platform | Capacitor `resize` | Android `windowSoftInputMode` | CTA positioning |
|---|---|---|---|
| iOS | `'none'` | N/A | Manual offset via `ctaBottomOffset()` using keyboard height from plugin events. Viewport stays full size. |
| Android | `'none'` (plugin config) | `adjustResize` (native override) | Viewport shrinks above keyboard. `position: fixed; bottom: 0` places CTA correctly. `ctaBottomOffset()` returns `'0px'`. |

**Why `adjustResize` on Android:**

- It is the only `windowSoftInputMode` that reliably triggers keyboard height detection in
  the Capacitor Keyboard plugin on Android.
- The plugin detects keyboard via `getWindowVisibleDisplayFrame()`, which only changes with
  `adjustResize`. This means `keyboardWillShow` fires with an accurate `keyboardHeight`.
- Combined with CSS viewport locking, it prevents visual content shift while allowing the
  CTA to position correctly.
- It is the most widely tested mode in the Capacitor/Ionic ecosystem on Android.

**Why `resize: 'none'` is kept in the Capacitor config:**

The `resize` config controls the plugin's **JS-side behavior** (whether it programmatically
resizes `document.body` or adjusts Ionic's layout). Setting it to `'none'` prevents the
plugin from making any JS-side layout changes. The Android-native `adjustResize` is set
separately in the native project, giving us OS-level viewport resize (reliable keyboard
detection) without plugin-driven body/ionic resizing.

### 12.4 Fix: Android Native Soft Input Override

The Capacitor Keyboard plugin programmatically sets `windowSoftInputMode` to
`adjustNothing` based on `resize: 'none'`. Override this at the native Android level by
setting `adjustResize` in the main activity **after** the Capacitor bridge initializes.

```java
// android/app/src/main/java/.../MainActivity.java

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Override Capacitor Keyboard plugin's adjustNothing.
        // adjustResize is required for reliable keyboard height detection on Android.
        // The plugin's resize: 'none' config still prevents JS-side body/ionic resizing.
        getWindow().setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );
    }
}
```

After this change, rebuild the Android project. The plugin's event detection (based on
`getWindowVisibleDisplayFrame()`) works because the viewport frame now changes with
`adjustResize`.

### 12.5 Fix: CSS Viewport Lock

With `adjustResize` active, the Android WebView viewport shrinks when the keyboard opens.
Without intervention, `ion-content` and any element using `height: 100%` or `100vh` would
shrink with it, causing the visible content shift.

**Solution:** The `KeyboardLayoutService` captures the initial viewport height before the
keyboard opens and sets it as a CSS custom property `--keyboard-safe-height`. Consuming
pages lock their host element to this height.

**Service side** (already included in the updated service in Section 8):

```typescript
// In attach(), before registering listeners:
if (this.isAndroid) {
  document.documentElement.style.setProperty(
    '--keyboard-safe-height',
    `${window.innerHeight}px`,
  );
}
```

**Page SCSS side** (add to every consuming page's `:host`):

```scss
:host {
  // On Android, locks the page to its pre-keyboard height so content does not shift.
  // On iOS, the CSS variable is unset and the fallback (100%) applies normally.
  height: var(--keyboard-safe-height, 100%);
  overflow: hidden;
}
```

**Why this works:**

- `position: fixed` elements are positioned relative to the **viewport**, not the host
  element. When `adjustResize` shrinks the viewport, `fixed; bottom: 0` sits above the
  keyboard automatically.
- The host element stays at its original height (locked by the CSS variable), so its content
  does not reflow or shift.
- Content that extends below the visible viewport (behind the keyboard) is clipped by
  `overflow: hidden`. This is acceptable because the input field is near the top of the page.

### 12.6 Fix: Disable Ionic scrollAssist

Ionic has a built-in `scrollAssist` feature that auto-scrolls content when the keyboard
opens to keep the focused input visible. On money-movement screens where the input is near
the top of the page, this auto-scroll causes unnecessary content displacement on Android.

Disable it in the Ionic provider configuration:

```typescript
// app.config.ts (or wherever provideIonicAngular is called)
provideIonicAngular({
  scrollAssist: false,
  // ... other Ionic config
}),
```

**Trade-off:** If other screens in the app rely on `scrollAssist` (e.g., long forms where
the input is below the fold), disable it selectively. On `ion-content`, set the attribute
`[scrollAssist]="false"` per-page instead of globally.

For trade ticket and money-movement modals, `scrollAssist` is not needed because the decimal
input field is always visible without scrolling.

### 12.7 CSS Anti-Patterns to Audit

Audit the trade ticket page, modal containers, and any wrapper components for these CSS
patterns that amplify the Android keyboard layout shift:

| Anti-pattern | Why it causes problems | Fix |
|---|---|---|
| `height: 100vh` on modal/page root | On Android, `100vh` can change when the viewport resizes. The container resizes with the keyboard. | Use `var(--keyboard-safe-height, 100%)`. |
| `min-height: 100vh` on modal wrappers | Same issue. Flex containers redistribute space when min-height changes. | Use `var(--keyboard-safe-height, 100%)`. |
| `height: 100%` chains from `html` to `ion-app` to modal | If any ancestor resizes, all descendants resize. | Break the chain at the page level with the CSS variable lock. |
| Flex containers with `justify-content: center` on the page root | When the container shrinks, centered content shifts upward visually. | Use `justify-content: flex-start` on page roots. |
| `overflow: auto` or `overflow: scroll` on the modal wrapper | Creates a secondary scroll container that Android WebView may scroll unexpectedly on keyboard open. | Use `overflow: hidden` on the page wrapper. Only `ion-content` should scroll. |
| `transform` or `will-change: transform` on modal ancestors | Creates a new containing block for `position: fixed` children, breaking fixed-viewport positioning. | Remove transforms from modal ancestor chain or move the CTA outside the transformed container. |

### 12.8 Android Verification

After applying all fixes (12.4 native override, 12.5 CSS viewport lock, 12.6 scrollAssist,
updated service from Section 8, updated SCSS from Sections 10.4 / 11.3), verify on a
physical Android device (Google Pixel preferred):

1. Run `npx cap sync` after all config changes.
2. Rebuild the Android project via Android Studio (or `npx cap run android`).
3. Open the trade ticket. Tap the amount input.
4. **Content stability:** Page content does NOT shift upward. Only the CTA bar repositions.
5. **CTA position:** CTA bar sits directly above the keyboard with no gap and no overlap.
6. **Keyboard height:** Add a temporary `console.log` in the `keyboardWillShow` listener to
   confirm `keyboardHeight` is a positive number (not `0`).
7. **Dismiss:** Tap outside the input to dismiss keyboard. CTA returns to resting position.
8. **Rapid cycles:** Tap in/out of the input 5+ times rapidly. No layout corruption.
9. **Rotation:** Rotate the device with keyboard open, close keyboard, verify layout recovery.
10. **Navigation:** Leave the page and return. No stale keyboard offset or viewport lock.
11. **Compare iOS:** Run the same flow on iOS. Both platforms produce a stable, consistent
    experience (CTA above keyboard, content stable).

---

## 13. iOS Accessory Bar Removal

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

## 14. Keyboard Auto-Focus Behavior

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

## 15. Input Handling

The decimal input mode on existing pages is already implemented and functioning. The native
keyboard shows a decimal number pad.

**Rules for this task:**

- Do not modify any input element, its `type`, `inputmode`, or formatting logic on any page.
- Do not add a custom digit engine or formatting pipeline.
- Focus exclusively on keyboard lifecycle events, CTA positioning, and accessory bar removal.
- If a bug is found in existing input behavior during integration, file it separately. Do not
  scope-creep the keyboard integration work.

---

## 16. QA Acceptance Criteria

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

- [ ] `keyboardHeight` is reported as a positive number (not `0`) in `keyboardWillShow`.
- [ ] Page content does NOT shift upward when the keyboard opens (viewport lock working).
- [ ] CTA bar sits directly above the keyboard with no gap.
- [ ] Keyboard close/open restores layout cleanly, no residual offset.
- [ ] No overlap between CTA and bottom navigation bar or system gesture area.
- [ ] `--keyboard-safe-height` CSS variable is set on `<html>` when keyboard attaches.
- [ ] `--keyboard-safe-height` is removed when page detaches (no stale locks).
- [ ] Ionic `scrollAssist` is disabled (content does not auto-scroll on input focus).
- [ ] Fullscreen modal does not exhibit different behavior from a routed page.
- [ ] Google Pixel (primary Android test device) shows stable behavior.

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

## 17. Common Mistakes

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
| Using `resize: 'native'` or `resize: 'body'` in Capacitor config for Android | The plugin's JS-side resize logic fights with the native `adjustResize` override and causes unpredictable body/ionic adjustments. | Keep `resize: 'none'` in Capacitor config. Override `adjustResize` only at the native Android level in `MainActivity`. |
| Removing the `adjustResize` override in Android `MainActivity` | Reverts to `adjustNothing`, breaking keyboard height detection. `keyboardHeight` returns `0`. | The `adjustResize` override in `onCreate()` is required for Android. Do not remove it. |
| Applying `ctaBottomOffset` manually on Android | With `adjustResize`, the viewport already shrinks. Adding offset double-moves the CTA. | The service returns `'0px'` on Android automatically. Do not override per-page. |
| Using `100vh` or `100%` instead of `var(--keyboard-safe-height, 100%)` on page hosts | On Android, viewport height changes with `adjustResize`, causing the page to shrink and content to shift. | Use `var(--keyboard-safe-height, 100%)` on pages using `KeyboardLayoutService`. |
| Forgetting to disable Ionic `scrollAssist` | Ionic auto-scrolls content on input focus, fighting the viewport lock and causing content shift on Android. | Set `scrollAssist: false` globally or per-page for money-movement screens. |
