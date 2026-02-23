# Implementation Instruction: Global Toast Service
## Signal-first · Ionic-native · Keyboard-aware · PDS-governed

> **Status:** Approved for Implementation — 2026-02-23
> **Supersedes:** ADR: Global Toast Service (Signal-first, Keyboard-aware)
> **Audience:** Developers & AI coding agents

---

## 0. Quick Rules (AI Agent: Read First)

| Rule | Constraint |
|------|-----------|
| ONE file | `toast.service.ts` only — no store, no event bus, no component |
| DO use | `inject()`, `signal()`, `computed()`, `DestroyRef`, `ToastController` from `@ionic/angular/standalone` |
| DO NOT use | Constructor injection, `ngOnDestroy`, `Subject`, `BehaviorSubject`, `NgZone`, `NgModule` |
| Keyboard | `@capacitor/keyboard` listeners ONLY — no DOM keyboard events |
| Styling | `cssClass` array only — no inline styles, no hardcoded colors in the service. Refer to **PDS README** for class names and tokens |
| Queue | Sequential presentation — never show two toasts simultaneously |
| `standalone: true` | **OMIT** — it is the default in Angular v20+ |

---

## 1. Context

The mobile application (Angular + Ionic + Capacitor) requires a unified toast notification mechanism that:
- Displays at the bottom of any page
- Works consistently across tabs, modals, and routed pages
- Adjusts automatically when the mobile keyboard is visible
- Is callable from feature components, feature services, and NgRx SignalStore domains
- Follows Ionic `ToastController` best practices
- Avoids boilerplate and over-engineering
- Maintains high performance and minimal reactive overhead
- Aligns with PDS (Phoenix Design System) styling tokens

The application is hybrid (WebView inside native shell). Therefore:
- Keyboard events MUST be handled via `@capacitor/keyboard`
- Safe-area handling MUST respect iOS `env(safe-area-inset-bottom)`
- The solution MUST NOT depend on per-page layout hacks

---

## 2. Why Not Alternatives (Non-negotiable)

| Alternative | Rejected reason |
|-------------|----------------|
| `<ion-toast>` in individual components | Duplication, inconsistent styling, no keyboard awareness |
| Dedicated NgRx/SignalStore for toasts | Over-engineering — toast is ephemeral UI, not business state |
| Event-bus / message broker | Adds indirection, increases debug complexity |
| Custom overlay component | Reinvents Ionic, more maintenance surface |
| Multiple simultaneous toasts | Poor UX — creates visual chaos |

**Do not revisit these.** The architectural decision is final.

---

## 3. File & Location

```
src/
└── app/
    └── core/
        └── toast/
            ├── toast.service.ts        ← implementation lives here ONLY
            └── toast.service.spec.ts   ← tests
```

**No barrel files. No index.ts. Import directly.**

---

## 4. Types

Define these in `toast.service.ts` (no separate types file — keep it co-located and DRY):

```typescript
export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  duration?: number;   // ms — defaults to 3000
  icon?: string;       // ionicon name e.g. 'checkmark-circle'
  actionText?: string; // label for the action button
  onAction?: () => void;
}

interface AppToast extends ToastOptions {
  message: string;
  kind: ToastKind;
}
```

`AppToast` is internal — never export it.

---

## 5. Service Implementation

### 5.1 Full Implementation

```typescript
// src/app/core/toast/toast.service.ts
import { Injectable, DestroyRef, computed, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { Keyboard } from '@capacitor/keyboard';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  duration?: number;
  icon?: string;
  actionText?: string;
  onAction?: () => void;
}

interface AppToast extends ToastOptions {
  message: string;
  kind: ToastKind;
}

const BASE_MARGIN_PX = 16;
const DEFAULT_DURATION_MS = 3000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  // ── dependencies ──────────────────────────────────────────────────────────
  private readonly toastController = inject(ToastController);
  private readonly destroyRef = inject(DestroyRef);

  // ── internal signals ──────────────────────────────────────────────────────
  private readonly queue = signal<AppToast[]>([]);
  private readonly presenting = signal(false);
  private readonly keyboardHeightPx = signal(0);

  // ── derived state ─────────────────────────────────────────────────────────
  /** Total bottom offset written to the CSS variable. */
  private readonly bottomOffsetPx = computed(
    () => this.keyboardHeightPx() + BASE_MARGIN_PX,
  );

  private activeToast: HTMLIonToastElement | undefined;

  constructor() {
    this.registerKeyboardListeners();
  }

  // ── public API ────────────────────────────────────────────────────────────

  info(message: string, options?: ToastOptions): void {
    this.enqueue({ message, kind: 'info', ...options });
  }

  success(message: string, options?: ToastOptions): void {
    this.enqueue({ message, kind: 'success', ...options });
  }

  warning(message: string, options?: ToastOptions): void {
    this.enqueue({ message, kind: 'warning', ...options });
  }

  error(message: string, options?: ToastOptions): void {
    this.enqueue({ message, kind: 'error', ...options });
  }

  async dismissAll(): Promise<void> {
    this.queue.set([]);
    await this.activeToast?.dismiss();
    this.activeToast = undefined;
    this.presenting.set(false);
  }

  // ── private queue logic ───────────────────────────────────────────────────

  private enqueue(toast: AppToast): void {
    this.queue.update((q) => [...q, toast]);
    if (!this.presenting()) {
      void this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    const next = this.queue()[0];
    if (!next) {
      this.presenting.set(false);
      return;
    }

    this.presenting.set(true);
    this.applyBottomOffset();

    const buttons = next.actionText
      ? [
          {
            text: next.actionText,
            handler: () => {
              next.onAction?.();
              return true;
            },
          },
        ]
      : [];

    const toast = await this.toastController.create({
      message: next.message,
      duration: next.duration ?? DEFAULT_DURATION_MS,
      position: 'bottom',
      cssClass: ['pds-toast', `pds-toast--${next.kind}`],
      icon: next.icon,
      buttons,
    });

    this.activeToast = toast;
    await toast.present();
    await toast.onDidDismiss();

    this.activeToast = undefined;
    this.queue.update((q) => q.slice(1));
    await this.processNext();
  }

  // ── keyboard handling ─────────────────────────────────────────────────────

  private registerKeyboardListeners(): void {
    // Guard: Capacitor Keyboard is only available in native shell
    if (!this.isCapacitorAvailable()) return;

    const showHandler = Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      this.keyboardHeightPx.set(keyboardHeight);
      this.applyBottomOffset();
    });

    const hideHandler = Keyboard.addListener('keyboardWillHide', () => {
      this.keyboardHeightPx.set(0);
      this.applyBottomOffset();
    });

    // Clean up listeners when service is destroyed (HMR-safe)
    this.destroyRef.onDestroy(async () => {
      (await showHandler).remove();
      (await hideHandler).remove();
    });
  }

  private applyBottomOffset(): void {
    document.documentElement.style.setProperty(
      '--pds-toast-bottom-offset',
      `${this.bottomOffsetPx()}px`,
    );
  }

  private isCapacitorAvailable(): boolean {
    return typeof (window as Record<string, unknown>)['Capacitor'] !== 'undefined';
  }
}
```

### 5.2 Key Design Decisions in Code

| Decision | Implementation |
|----------|----------------|
| No constructor injection | `inject()` function only |
| No `ngOnDestroy` | `DestroyRef.onDestroy()` callback |
| No `Observable` / `Subject` | All state is `signal()` / `computed()` |
| No inline style | CSS variable `--pds-toast-bottom-offset` set on `:root` |
| Queue processing | Recursive `async/await` with `onDidDismiss()` — no polling |
| Web fallback | `isCapacitorAvailable()` guard — works in browser without Keyboard plugin |

---

## 6. CSS Implementation (PDS Responsibility)

> **AI Agent & Developer:** Do NOT invent or guess PDS class names or CSS token names.
> Refer to the **PDS (Phoenix Design System) README** for the correct class names, token names, and usage patterns.

The service's only CSS contract with PDS is:

```typescript
cssClass: ['pds-toast', `pds-toast--${next.kind}`]
```

And one CSS variable it controls at runtime:

```
--pds-toast-bottom-offset
```

set via:

```typescript
document.documentElement.style.setProperty(
  '--pds-toast-bottom-offset',
  `${this.bottomOffsetPx()}px`,
);
```

The CSS that consumes this variable belongs in the **global stylesheet** and must follow PDS conventions — see **PDS README** for the correct token names, class structure, and `ion-toast` part selectors.

**Rules:**
- The service NEVER hardcodes colors, spacing, or visual tokens
- The service only writes `--pds-toast-bottom-offset` (keyboard offset) to `:root`
- All visual styling (colors, shadows, radius, width) is owned and defined by PDS
- Use the PDS README as the single source of truth for class and token names

---

## 7. Usage Examples

### 7.1 From a Feature Component

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '@app/core/toast/toast.service';

@Component({
  selector: 'app-watchlist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button (click)="addItem()">Add</button>`,
})
export class WatchlistComponent {
  private readonly toast = inject(ToastService);

  addItem(): void {
    // ... business logic ...
    this.toast.success('Item added to watchlist');
  }

  onLimitReached(): void {
    this.toast.warning('Watchlist is full. Remove an item to continue.');
  }
}
```

### 7.2 From an NgRx SignalStore

```typescript
import { signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { ToastService } from '@app/core/toast/toast.service';

export const WatchlistStore = signalStore(
  { providedIn: 'root' },
  withState({ items: [] as WatchlistItem[] }),
  withMethods((store) => {
    const toast = inject(ToastService);

    return {
      removeItem(id: string): void {
        // ... update state ...
        toast.info('Item removed');
      },

      handleSaveError(): void {
        // Only for actionable errors — not silent background failures
        toast.error('Failed to save. Please try again.');
      },
    };
  }),
);
```

### 7.3 With Action Button

```typescript
this.toast.error('Upload failed', {
  actionText: 'Retry',
  onAction: () => this.uploadService.retry(),
  duration: 5000,
});
```

---

## 8. UX Governance — What Toast Is For

### Use Toast for:
- User-triggered action confirmations (add, remove, save, delete)
- Explicit errors that require user acknowledgment
- Limit boundaries (e.g., "Watchlist is full")
- Success feedback after async operations

### Never Use Toast for:
- Background polling failures
- Silent auto-refresh failures
- Telemetry or debug messages
- Any notification that does not result from a direct user action

### SignalStore Rule:
Only trigger toast for **actionable failures**. Prefer reactive UI state (loading/error signals in the view) for non-critical states.

---

## 9. Edge Cases & How They Are Handled

| Edge case | Solution |
|-----------|----------|
| Multiple rapid calls | All enqueued in `queue` signal; processed sequentially |
| `dismissAll()` called mid-queue | Clears queue array + calls `.dismiss()` on active toast |
| Keyboard opens while toast is visible | `keyboardWillShow` updates signal → CSS variable recalculates immediately |
| iOS safe area | `env(safe-area-inset-bottom)` added on top of dynamic offset in CSS |
| Web / browser (no Capacitor) | `isCapacitorAvailable()` guard skips keyboard listeners; base margin applies |
| HMR / dev reload | `DestroyRef.onDestroy()` removes all Capacitor listeners cleanly |
| Action button not provided | `buttons` array is empty; no action UI is rendered |

---

## 10. What NOT to Implement

Do **not** add any of the following without a new ADR approval:

- `replaceCurrent()` — not in scope
- Debounce for duplicate messages — not in scope
- Haptics integration — future facade (`UxFeedbackService` will handle this)
- Global error handler auto-toast — violates UX governance rules
- Toast stack / multi-toast — rejected architectural pattern
- Centralized toast store — rejected as over-engineering

---

## 11. Performance Notes

- Signals are read/written only on user-triggered events — negligible overhead
- No `setInterval`, no polling, no observable chains
- `ToastController` uses Ionic's native overlay engine — no Angular CD impact
- Capacitor keyboard listeners are native bridge calls — minimal WebView cost
- `DestroyRef` guarantees listener cleanup at service destroy — no memory leaks

This implementation is safe and appropriate for enterprise-scale mobile applications.

---

## 12. Checklist Before Opening a PR

- [ ] Service is `providedIn: 'root'` — singleton confirmed
- [ ] All state uses `signal()` / `computed()` — no `BehaviorSubject` or `ReplaySubject`
- [ ] `inject()` used for all dependencies — no constructor parameters
- [ ] `DestroyRef` used for cleanup — no `ngOnDestroy`
- [ ] `processNext()` is fully sequential — no concurrent toasts possible
- [ ] CSS variable `--pds-toast-bottom-offset` is initialized with default `16px` in global stylesheet
- [ ] Keyboard listeners are guarded by `isCapacitorAvailable()`
- [ ] `dismissAll()` clears queue AND active toast
- [ ] Service contains zero color/spacing hardcoding — PDS CSS classes only (refer to PDS README)
- [ ] `AppToast` interface is NOT exported from the service
- [ ] Tests cover: enqueue, sequential presentation, `dismissAll`, keyboard offset, web fallback
