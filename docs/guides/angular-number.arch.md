# Task Instructions: Number Truncation Display Architecture

## Objective

Implement a centralized numeric display architecture for the trading app that follows the product team's truncation policy and sample outputs.

This task is **not** about inventing the business rule. The exact truncation behavior and expected examples will be provided separately by Product and must be implemented exactly as specified.

Your job is to implement the architecture, integration pattern, and test coverage so the app has:

- one single source of truth for numeric display formatting
- optional Angular pipes for template ergonomics
- no duplicated formatting logic
- strong unit test coverage for all product-provided examples
- performance-safe usage in an Angular 21 zoneless signal application

---

## Core Mental Model

This is a fintech/trading app. Numeric display is a **trust-sensitive UI policy**, not random formatting sugar.

Treat numeric formatting as:

- **Display policy only**
- **Never business truth**
- **Never calculation input**
- **Never state mutation logic**

### Architecture principles

1. **Raw values remain raw**
   - Domain state, repository models, and store state must keep original numeric values unchanged.
   - Do not store formatted strings in SignalStore.
   - Do not truncate values before business logic, calculations, comparisons, charting, aggregation, or order-related flows.

2. **Display values are derived**
   - Numeric display strings are derived for UI only.
   - Truncation/formatting must happen in a shared pure utility layer.

3. **Single source of truth**
   - All display logic must live in one shared utility module.
   - Angular pipes may wrap the utility for template convenience.
   - Pipes must not introduce separate logic.

4. **Product policy is authoritative**
   - Product team examples and truncation rules are the source of truth.
   - Implement exactly what Product provides, even if prior discussion or assumptions differ.

---

## Required Architecture

## 1) Shared utility is the primary implementation

Create a shared pure utility module as the **primary** home of the numeric display rules.

Recommended path:

```text
libs/plynk-mobile/shared/util/number-format.util.ts
```

This utility is the single source of truth for:

- currency display formatting
- quantity display formatting
- internal truncation helpers
- safe handling for invalid inputs
- string shaping for UI output

### Why utility-first

The formatting policy must be reusable from:

- template rendering
- computed view models
- presenter/adapters
- future reusable UI models
- unit tests

This logic must not be locked inside Angular-only primitives.

---

## 2) Pipes are optional wrappers only

If template ergonomics are helpful, add standalone pipes that delegate to the utility.

Recommended path:

```text
libs/plynk-mobile/shared/ui/pipes/
  currency-display.pipe.ts
  quantity-display.pipe.ts
```

Rules:

- pipe logic must be thin
- pipe must call the shared utility
- pipe must not implement its own regex/math/policy logic
- pipe must not diverge from the utility behavior

### Correct role of the pipe

The pipe is a presentation adapter for templates, not the source of truth.

Good:

```html
{{ value() | currencyDisplay }}
{{ quantity() | quantityDisplay }}
```

Bad:

- custom formatting logic inside the pipe
- separate behavior between pipe and utility
- multiple pipes implementing competing number rules

---

## 3) No formatting logic in component/store templates

Do not place truncation/formatting logic in:

- components
- templates
- SignalStore state
- repository mapping as business truth
- ad hoc helper files per domain

Forbidden patterns:

- `toFixed()` directly in template/component
- inline regex/string slicing in components
- formatting inside store state as canonical value
- duplicate helper logic across portfolio / positions / order-review / detail pages

---

## Angular 21 + Zoneless + Signal Guidance

This app is zoneless and signal-first. Implementation must be optimized for predictable reactive rendering.

### Use pure functions

The shared formatting functions must be:

- synchronous
- deterministic
- side-effect free
- allocation-conscious where practical
- easy to test

### Prefer derived display values

For repeated rendering in complex screens, prefer building display-ready view models in `computed()` instead of repeatedly composing formatting expressions across many bindings.

Example pattern:

```ts
readonly positionVm = computed(() => {
  const position = this.position();

  return {
    marketValueDisplay: formatCurrencyDisplay(position?.marketValue),
    quantityDisplay: formatQuantityDisplay(position?.quantity),
  };
});
```

Use pipes for simple template usage. Use computed view models when:

- a card or row has multiple derived display fields
- repeated template transformations reduce readability
- you want clearer UI state mapping

### Avoid template-call anti-patterns

Do not call arbitrary component methods from the template for numeric formatting.

Prefer:

- utility in computed view model
- or thin standalone pipe

This keeps zoneless rendering predictable and avoids accidental repeated work.

---

## Performance Guidance

Numeric formatting will likely appear in lists such as:

- positions
- watchlist rows
- portfolio summaries
- order review rows

Implementation must consider rendering scale.

### Performance rules

1. **Single centralized implementation**
   - avoids duplicated logic and inconsistencies

2. **Pure and lightweight helpers**
   - no unnecessary object churn
   - no side effects
   - no hidden state

3. **Do not recompute more than needed**
   - if a row model already exists, derive display strings once in the computed view model
   - avoid formatting the same value multiple times in the same render path

4. **No async formatting**
   - formatting must be synchronous and local

5. **No locale/business-policy mixing unless explicitly required**
   - keep the task focused on truncation and expected display output
   - do not introduce unnecessary abstraction layers unless needed by existing architecture

6. **Do not over-engineer**
   - do not introduce a service unless there is a real dependency need
   - a shared pure utility is the preferred architecture

---

## Recommended Utility API Shape

The exact names may vary slightly to fit existing conventions, but the structure should be similar to this:

```ts
export type NumericInput = number | null | undefined;

export function formatCurrencyDisplay(value: NumericInput): string;
export function formatQuantityDisplay(value: NumericInput): string;
```

The utility may also include internal helpers such as:

```ts
function isValidNumber(value: NumericInput): value is number;
function normalizeNegativeZero(value: number): number;
function truncateByPolicy(value: number, policy: TruncatePolicy): number | string;
```

Important:
- keep internals private unless there is a real reuse case
- public API should be small and explicit
- do not create a generic “formatNumberEverything” function with ambiguous flags

### Preferred design approach

Use:

- small public API
- clear semantic functions
- private internal helpers

Avoid:

- giant configurable formatter with too many boolean flags
- vague naming like `formatNumber(value, type, useThing, mode, options)`

---

## Business Logic Placeholder

The exact truncation logic will be supplied separately by Product.

You must implement the architecture so the business logic can cleanly live in the shared utility without changing component/store/template structure later.

### Placeholder expectation

Implement the utility to support at least these semantic categories:

- **currency display**
- **quantity display**

Each category must apply its own Product-defined truncation/display rule.

Do not hardcode assumptions from old discussions if Product examples differ.

The Product-provided truncation examples are the acceptance criteria.

---

## Input Handling Expectations

The formatter utilities are for **display output**, not user typing/input parsing.

This task should not redesign order-entry input behavior unless explicitly requested.

Therefore:

- assume input is already a numeric domain value or nullable numeric value
- return display-safe strings
- safely handle nullish/invalid values with a defined fallback
- do not mutate caller data

If the existing app already has a standard fallback token such as `--`, use that convention consistently.

---

## Edge Cases You Must Handle

The exact output must follow Product samples, but the implementation and tests must explicitly consider:

- positive values
- zero
- negative values
- negative zero normalization
- null
- undefined
- non-finite values if relevant to current codebase (`NaN`, `Infinity`, `-Infinity`)
- large values
- tiny fractional values
- whole-number currency
- whole-number quantity
- values exactly on truncation boundaries
- values with more decimals than display allows

Do not let `-0`, `-0.00`, or equivalent misleading output leak to the UI unless Product explicitly wants that behavior.

---

## Testing Requirements

Create focused unit tests for the shared utility and thin sanity tests for the pipes if pipes are added.

### Required utility test coverage

At minimum, include:

1. **All Product-provided samples**
   - every example given by Product must be encoded as tests
   - these are the highest-priority acceptance tests

2. **Boundary cases**
   - exact cutoff values
   - one digit beyond cutoff
   - many digits beyond cutoff

3. **Nullish and invalid inputs**
   - `null`
   - `undefined`
   - `NaN`
   - `Infinity`
   - `-Infinity` if relevant

4. **Negative values**
   - including tiny negative values
   - ensure negative-zero normalization behavior is correct

5. **Regression-oriented examples**
   - cases likely to break if someone changes truncation math later

### Pipe tests

If pipes are added:

- keep tests minimal
- verify they delegate correctly to the utility
- do not duplicate the full business-logic matrix in pipe tests

### Testing mindset

This is fintech UI behavior. A one-digit mismatch matters.

Tests should be written in a way that makes future regressions obvious and reviewable.

---

## Suggested File Targets

Recommended implementation targets:

```text
libs/plynk-mobile/shared/util/number-format.util.ts
libs/plynk-mobile/shared/util/number-format.util.spec.ts
libs/plynk-mobile/shared/ui/pipes/currency-display.pipe.ts
libs/plynk-mobile/shared/ui/pipes/currency-display.pipe.spec.ts
libs/plynk-mobile/shared/ui/pipes/quantity-display.pipe.ts
libs/plynk-mobile/shared/ui/pipes/quantity-display.pipe.spec.ts
```

Adjust paths if the current workspace naming conventions differ, but preserve the architecture:

- utility in shared util
- pipes in shared UI
- tests beside implementation or per workspace convention

---

## Implementation Standards

Follow best practices for TypeScript and Angular 21.

### TypeScript expectations

- strict typing
- no `any`
- narrow public API
- explicit input/output types
- helper names should express domain meaning
- keep code readable over clever
- avoid hidden coercion

### Angular expectations

- standalone pipes only
- no NgModule-based pipe declarations
- zoneless-safe usage
- signal-friendly composition
- no service unless truly necessary

### Code quality expectations

- dry but not over-abstracted
- easy for product/engineering to reason about
- easy to extend for future numeric categories
- easy to test
- avoid accidental behavior differences across app surfaces

---

## Non-Goals

Do **not** do the following unless explicitly required by the task:

- redesign input parsing UX
- add internationalization/localization features beyond current scope
- move business logic into services
- store formatted strings in domain state
- create a highly generic formatting framework
- invent new business rules that Product did not specify

---

## Expected Outcome

The completed implementation should give the app:

- one trusted truncation/display source of truth
- clean reuse across templates and computed view models
- strong confidence through tests
- minimal performance overhead
- maintainable architecture aligned with Angular zoneless signal patterns

---

## Final Implementation Rule

Implement the architecture first, then implement the exact Product truncation policy inside the shared utility, and finally encode every Product example as tests.

If any ambiguity exists, Product examples win.
