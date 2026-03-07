# Price Ticker Odometer -- Architecture Specification

## Overview

The price ticker odometer is a presentational UI component that displays a numeric value with vertically rolling digit transitions. The deliverables are:

1. **PriceTickerComponent** -- Renders the price with animated digit wheels.
2. **PriceFlashDirective** -- Optional directive that flashes text green or red on price change.
3. **Global styles** -- Bridges the flash directive classes to Ionic theme variables.

---

## Core Principles

**CSS-driven animation.** All digit movement is handled by CSS `transform` and `transition` on GPU-composited layers. No JavaScript animation loops. No `requestAnimationFrame` inside the component.

**Declarative signal pipeline.** The component is a pure function from input signals to computed template bindings: `value` input -> `formatted` string -> `segments` array -> CSS `transform` strings. No imperative state mutation in the render path.

**Presentational purity.** The component has no domain knowledge. It does not know about stock symbols, chart events, or API responses. It receives a number and an animation mode. The parent decides when to animate and when to snap.

**Layout stability.** Tabular numerals (`font-variant-numeric: tabular-nums`) ensure all digits occupy identical width. Each digit viewport uses CSS `contain: strict` to isolate layout recalculation. The component never shifts horizontally regardless of the displayed value.

---

## 1. PriceTickerComponent

### Responsibility

Accepts a numeric value, formats it as currency, and renders each digit inside a vertically scrolling strip. The CSS `transition` property handles the rolling animation. When `instant` is true, the transition duration is `0ms` (snap). When false, digits roll with a 500ms eased transition.

### API

| Input | Type | Default | Description |
|---|---|---|---|
| `value` | `number` (required) | -- | The numeric price to display |
| `instant` | `boolean` | `false` | When true, digits snap without animation |
| `currencySymbol` | `string` | `'$'` | Static prefix rendered before the digits |
| `decimals` | `number` | `2` | Number of decimal places in the formatted output |

### Implementation

```typescript
import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';

interface TickerSegment {
  isDigit: boolean;
  char: string;
  offset: string;
}

@Component({
  selector: 'app-price-ticker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sr-only">{{ formatted() }}</span>

    <div class="ticker-wrapper" aria-hidden="true">
      <span class="static-char">{{ currencySymbol() }}</span>

      @for (segment of segments(); track $index) {
        @if (segment.isDigit) {
          <div class="digit-viewport">
            <div
              class="digit-strip"
              [style.transform]="segment.offset"
              [style.transition-duration]="duration()">
              <div>0</div><div>1</div><div>2</div><div>3</div><div>4</div>
              <div>5</div><div>6</div><div>7</div><div>8</div><div>9</div>
            </div>
          </div>
        } @else {
          <span class="static-char">{{ segment.char }}</span>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      font-family: var(--ion-font-family, inherit);
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .ticker-wrapper {
      display: flex;
      align-items: center;
    }

    .static-char {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 1em;
      line-height: 1em;
    }

    .digit-viewport {
      display: inline-block;
      height: 1em;
      line-height: 1em;
      overflow: hidden;
      contain: strict;
      width: 1ch;
    }

    .digit-strip {
      display: flex;
      flex-direction: column;
      will-change: transform;
      transition-property: transform;
      transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
    }

    .digit-strip > div {
      height: 1em;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .digit-strip {
        transition-duration: 0ms !important;
      }
    }
  `]
})
export class PriceTickerComponent {
  readonly value = input.required<number>();
  readonly instant = input(false);
  readonly currencySymbol = input('$');
  readonly decimals = input(2);

  private readonly formatter = computed(() => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: this.decimals(),
    maximumFractionDigits: this.decimals(),
    useGrouping: true,
  }));

  protected readonly formatted = computed(() => this.formatter().format(this.value()));

  protected readonly duration = computed(() => this.instant() ? '0ms' : '500ms');

  protected readonly segments = computed<TickerSegment[]>(() => {
    return this.formatted().split('').map(char => {
      const isDigit = /\d/.test(char);
      const digit = isDigit ? parseInt(char, 10) : 0;
      return {
        isDigit,
        char,
        offset: isDigit ? `translate3d(0, -${digit * 10}%, 0)` : '',
      };
    });
  });
}
```

### How It Works

The `value` input receives a number. The `formatted` computed runs `Intl.NumberFormat` to produce a locale-aware string such as `"1,234.56"`.

The `segments` computed splits the formatted string into individual characters. Each character is classified as either a digit or a static character (comma, decimal point).

For each digit, a CSS `translate3d` offset is calculated. Digit 0 has offset `0%`, digit 5 has offset `-50%`, digit 9 has offset `-90%`. This positions the correct number visible within the viewport.

Each digit viewport is a fixed-size container (`1em` tall, `1ch` wide) with `overflow: hidden`. Inside it, a vertical strip contains divs for digits 0 through 9 stacked in a column.

The `transition-duration` style binding controls whether the strip slides smoothly (`500ms`) or snaps instantly (`0ms`). The `cubic-bezier(0.25, 1, 0.5, 1)` timing function produces a deceleration curve that feels mechanical -- fast initial movement, slow settle.

Because `will-change: transform` and `translate3d` are used, the browser promotes each strip to its own compositor layer. The animation runs on the GPU without triggering layout or paint on the main thread.

A screen-reader-only span contains the full formatted value for accessibility. The visual ticker is marked `aria-hidden="true"`.

To keep visual alignment stable across fonts, static characters (currency symbol, commas, decimal point) use the same `1em` box model as digits, centered with flex alignment.

For accessibility, reduced-motion users receive instant ticker updates via `@media (prefers-reduced-motion: reduce)`.

### Design Decisions

**No `symbol` input.** Earlier iterations tracked the instrument symbol to detect context switches (navigating from AAPL to BTC) and disable animation during the transition. This was removed because it placed business logic inside a presentational component and introduced an impure side effect inside a `computed()`. The parent feature component is responsible for setting `instant = true` when switching instruments.

**`track $index` in the `@for` loop.** Segments are anonymous (no stable identity). Tracking by index causes Angular to reuse existing DOM by position. When the value changes, each positional digit viewport transitions its strip to the new digit value via CSS. This is the desired behavior.

**`1ch` for digit viewport width.** The `ch` CSS unit represents the advance width of the "0" glyph. Combined with `font-variant-numeric: tabular-nums`, all digits occupy identical width. This is more adaptive to font changes than a hardcoded `em` fraction.

**`contain: strict` on digit viewport.** This tells the browser that the element's contents never affect anything outside it, and its size is independent of its children. The browser can skip layout recalculation for the viewport and its children when other parts of the DOM change.

---

## 2. PriceFlashDirective

### Responsibility

Optional directive that temporarily applies a CSS class when the bound price value changes. Green for upward movement, red for downward movement. The class is removed after 400ms.

### API

| Input | Type | Description |
|---|---|---|
| `appPriceFlash` | `number` (required) | The price value to watch for changes |

### Implementation

```typescript
import { Directive, DestroyRef, effect, inject, input, signal } from '@angular/core';

@Directive({
  selector: '[appPriceFlash]',
  host: {
    '[class.price-flash-up]': 'isUp()',
    '[class.price-flash-down]': 'isDown()',
  }
})
export class PriceFlashDirective {
  readonly appPriceFlash = input.required<number>();

  protected readonly isUp = signal(false);
  protected readonly isDown = signal(false);

  private lastValue: number | null = null;
  private flashTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const current = this.appPriceFlash();

      if (this.lastValue === null) {
        this.lastValue = current;
        return;
      }

      if (current !== this.lastValue) {
        this.isUp.set(current > this.lastValue);
        this.isDown.set(current < this.lastValue);

        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        this.flashTimeout = setTimeout(() => {
          this.isUp.set(false);
          this.isDown.set(false);
        }, 400);
      }

      this.lastValue = current;
    });

    this.destroyRef.onDestroy(() => {
      if (this.flashTimeout) clearTimeout(this.flashTimeout);
    });
  }
}
```

### How It Works

The directive uses `host` metadata to bind CSS classes declaratively. `price-flash-up` is applied when `isUp()` is true; `price-flash-down` when `isDown()` is true. No `Renderer2` or `ElementRef` is needed.

An `effect()` watches the `appPriceFlash` input signal. On the first evaluation, it stores the initial value without flashing. This prevents a color flash on page load.

On subsequent changes, it compares the new value to the previous value and sets the appropriate direction signal. The two signals are mutually exclusive.

A `setTimeout` resets both signals after 400ms. If a new price arrives before the timeout completes, the timeout is cleared and restarted. This prevents class stacking under rapid updates.

`DestroyRef.onDestroy` clears the timeout if the host component is destroyed mid-flash, preventing a dangling reference.

### Design Decisions

**`host` bindings over `Renderer2`.** Angular best practices require host bindings in the decorator `host` object rather than using `@HostBinding` or imperative `Renderer2` calls. Signal-driven host class bindings are reactive in Angular 21 and require no manual DOM access.

**`effect()` for side-effect tracking.** The flash behavior is inherently a side effect -- it reacts to a value change and imperatively toggles temporary state. `effect()` is the correct primitive. The mutable `lastValue` is private to the directive and not exposed to the template.

**400ms flash duration.** Short enough to feel responsive under rapid ticks, long enough to be visually perceptible. The timeout-based cleanup handles debouncing naturally.

---

## 3. Global Styles

Add to the application's `global.scss`. These classes bridge the directive's host class bindings to Ionic's theme variables. The colors adapt to light and dark mode automatically.

```scss
/* Price Ticker -- Flash Effects */
.price-flash-up {
  color: var(--ion-color-success) !important;
  transition: color 0s !important;
}

.price-flash-down {
  color: var(--ion-color-danger) !important;
  transition: color 0s !important;
}

app-price-ticker {
  transition: color 500ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  app-price-ticker {
    transition: color 0ms !important;
  }
}
```

The `!important` override ensures the flash color takes priority over any inherited or scoped text color. `transition: color 0s` makes the color change instant on application. The `transition: color 500ms ease-out` on the host element produces a gradual fade back to the default color when the class is removed.

The reduced-motion media query removes the color fade for motion-sensitive users.

---

## 4. Integration

### Basic Usage

```html
<app-price-ticker
  [value]="currentPrice()"
  [instant]="isScrubbing()"
  [appPriceFlash]="currentPrice()" />
```

### Crosshair Scrubbing Integration

The parent feature component manages the crosshair-to-signal pipeline. The component throttles raw crosshair events to animation frames before writing to the price signal.

```typescript
// In the feature page component
private readonly rawCrosshairPrice = signal<number | null>(null);
protected readonly isScrubbing = signal(false);

protected readonly displayPrice = computed(() => {
  return this.rawCrosshairPrice() ?? this.store.livePrice();
});

onCrosshairMove(price: number): void {
  this.rawCrosshairPrice.set(price);
  this.isScrubbing.set(true);
}

onCrosshairLeave(): void {
  this.rawCrosshairPrice.set(null);
  this.isScrubbing.set(false);
}
```

### Context Switch (Instrument Navigation)

When the displayed instrument changes, snap the price instead of animating from the old value to the new one. The parent owns this decision.

```typescript
switchInstrument(newSymbol: string): void {
  this.instant.set(true);
  this.price.set(this.getPrice(newSymbol));
  requestAnimationFrame(() => this.instant.set(false));
}
```

The component does not track instrument symbols. The parent decides when to snap.

---

## 5. File Placement

Within the Nx workspace, these files belong in the UI layer of the relevant domain:

```
libs/plynk-mobile/<domain>/ui/
  price-ticker.component.ts
  price-flash.directive.ts
```

The component and directive are presentational. They contain no API calls, no store injection, and no routing logic. They belong exclusively in the `ui/` layer per the 4-layer domain architecture.

---

## 6. Performance Characteristics

| Concern | Approach |
|---|---|
| Change detection | OnPush with signal inputs. Angular checks bindings only when input signals change. |
| Layout stability | `contain: strict` isolates each digit viewport. `tabular-nums` prevents width variation. |
| GPU compositing | `will-change: transform` and `translate3d` promote digit strips to compositor layers. |
| Animation cost | CSS transitions run on the compositor thread. No JavaScript animation frames required. |
| DOM footprint | Each digit strip contains 10 child divs. A 7-character price produces approximately 80 elements. |
| Memory | No subscriptions, no observables. The only cleanup is the flash directive timeout. |
