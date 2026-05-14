# Angular Forms Bible

## Architect Mindset

When building or reviewing forms in the app, act as an Angular Mobile Architect, not a form coder.

Forms must be:
- Reactive, typed, and scalable
- Mobile-first for Ionic UX
- Domain-boundary compliant in Nx
- MVVM-aligned: factory -> presentational UI -> store
- DRY, modular, testable
- Designed for future Signal Forms migration without requiring rewrites

This is a high-performance hybrid mobile app. Apply the app's signal-first, domain-driven, mobile-first architecture to every form decision.

---

## Default Form Technology

Use Angular 21 typed Reactive Forms as the production standard.

Use:
- `FormControl<T>`
- `FormGroup<T>`
- `FormArray<T>`
- `FormRecord<T>`
- `NonNullableFormBuilder`
- Sync and async validators
- Group-level validators for cross-field rules

Do not use:
- Template-driven forms
- Untyped forms (no `any`)
- Form logic scattered across templates
- Business validation inside UI-only components

---

## Reactive Forms Building Blocks

### FormControl\<T\>

The atomic unit of a form. Always use the non-nullable variant unless the field can genuinely be null.

```ts
import { FormControl, Validators } from '@angular/forms';

// Non-nullable string field
const name = new FormControl('', {
  nonNullable: true,
  validators: [Validators.required, Validators.minLength(2)],
});

// Nullable with async validator; updateOn prevents HTTP call on every keystroke
const username = new FormControl<string | null>(null, {
  asyncValidators: [uniqueUsernameValidator],
  updateOn: 'blur',
});
```

`updateOn` options:
- `'change'` (default): validates on every keystroke
- `'blur'`: validates when the user leaves the field — use for async validators to reduce API calls
- `'submit'`: validates only on form submission — use for non-critical fields

### FormGroup\<T\>

Groups related controls. Prefer explicit generic typing for full type safety.

```ts
import { FormGroup, FormControl, Validators } from '@angular/forms';

export type AddressForm = FormGroup<{
  street: FormControl<string>;
  city: FormControl<string>;
  zip: FormControl<string>;
}>;

export function createAddressForm(): AddressForm {
  return new FormGroup({
    street: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    zip: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
    }),
  });
}
```

Pass group-level validators as the second argument for cross-field rules:

```ts
const form = new FormGroup(
  {
    password: new FormControl('', { nonNullable: true }),
    confirmPassword: new FormControl('', { nonNullable: true }),
  },
  { validators: [passwordMatchValidator] },
);
```

### FormArray\<T\>

For dynamic lists of controls (beneficiaries, phone numbers, documents).

```ts
import { FormArray, FormControl, Validators } from '@angular/forms';

export type PhoneListForm = FormArray<FormControl<string>>;

export function createPhoneListForm(): PhoneListForm {
  return new FormArray([
    new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  ]);
}

function addPhone(form: PhoneListForm): void {
  form.push(new FormControl('', { nonNullable: true, validators: [Validators.required] }));
}
```

**Zoneless note**: Mutating a FormArray (push, removeAt) does not automatically schedule change detection in zoneless apps. When the template depends on `controls.length` or structural iteration over `controls`, bridge the valueChanges observable to `ChangeDetectorRef.markForCheck()`:

```ts
import { ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class BeneficiaryPage {
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cdr.markForCheck());
  }
}
```

### FormRecord\<T\>

Use when the set of keys is dynamic and all values share the same type. Alternative to `FormGroup` for map-like structures.

```ts
import { FormRecord, FormControl } from '@angular/forms';

const permissionsForm = new FormRecord<FormControl<boolean>>({});

permissionsForm.addControl('canTrade', new FormControl(false, { nonNullable: true }));
permissionsForm.removeControl('canTrade');
```

### NonNullableFormBuilder

Prefer `NonNullableFormBuilder` (inject via DI) over manual `new FormControl()` inside factories to reduce boilerplate. Always expose a factory function — never construct inline in a component.

```ts
import { inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';

export function createTradeForm() {
  const fb = inject(NonNullableFormBuilder);
  return fb.group({
    symbol: fb.control('', [Validators.required]),
    quantity: fb.control(0, [Validators.required, Validators.min(1)]),
    orderType: fb.control<'market' | 'limit'>('market'),
  });
}
```

When factories are pure functions without DI (preferred for testability), use `new FormControl()` with `{ nonNullable: true }` explicitly.

---

## Form State API

### Control State Properties

| Property | Meaning |
|---|---|
| `dirty` | User has changed the value |
| `pristine` | Value has not been changed by the user |
| `touched` | User has focused and blurred the field |
| `untouched` | Field has not been interacted with |
| `pending` | Async validation is running |
| `valid` | All validators pass |
| `invalid` | At least one validator fails |
| `disabled` | Control excluded from form value and validation |

Use `getRawValue()` instead of `.value` when you need the value of disabled controls included in the output.

### Programmatic State Management

Always call these before displaying errors or blocking submit:

```ts
// Show all errors on failed submit attempt
onSubmit(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }
  this.store.submit(this.form.getRawValue());
}

// Reset after successful save
onSaveSuccess(): void {
  this.form.markAsPristine();
  this.form.markAsUntouched();
}

// Mark programmatically patched data as dirty
loadDraft(data: TradeFormValue): void {
  this.form.patchValue(data, { emitEvent: false });
  this.form.markAllAsDirty();
}
```

State methods reference:
- `markAsTouched()` — single control or group
- `markAllAsTouched()` — entire form tree, triggers all error displays
- `markAsPristine()` — after successful save
- `markAsDirty()` — after programmatic data load
- `markAllAsDirty()` — after importing external data
- `markAsUntouched()` — after reset

### Unified Events Stream (Angular 21)

All form controls expose a single `events` observable on `AbstractControl`. Use it instead of subscribing to multiple observables.

```ts
import {
  ValueChangeEvent,
  StatusChangeEvent,
  PristineChangeEvent,
  TouchedChangeEvent,
  FormResetEvent,
  FormSubmittedEvent,
} from '@angular/forms';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

this.form.events
  .pipe(takeUntilDestroyed())
  .subscribe((e) => {
    if (e instanceof StatusChangeEvent && e.status === 'VALID') {
      this.enableSubmit();
    }
    if (e instanceof FormSubmittedEvent) {
      this.onSubmit();
    }
  });

// Targeted subscription using a type guard filter
this.form.events
  .pipe(
    filter((e): e is StatusChangeEvent => e instanceof StatusChangeEvent),
    takeUntilDestroyed(),
  )
  .subscribe((e) => console.log('Status:', e.status));
```

Event types:
- `ValueChangeEvent` — control value changed
- `StatusChangeEvent` — VALID, INVALID, PENDING, DISABLED
- `PristineChangeEvent` — pristine/dirty state toggled
- `TouchedChangeEvent` — touched/untouched state toggled
- `FormResetEvent` — form was reset
- `FormSubmittedEvent` — form was submitted

### Controlling Propagation and Emission

```ts
// Suppress events during bulk patch (avoids triggering auto-save)
this.form.patchValue(savedDraft, { emitEvent: false });

// Update only this control; do not cascade to parent FormGroup
control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
```

`patchValue` vs `setValue`:
- `setValue()` — replaces the full value; throws if structure mismatches
- `patchValue()` — ignores missing keys; safe for partial updates

---

## Validator Architecture

### Sync Validators

Pure functions that return `ValidationErrors | null`. Rules:
- Stateless and pure — no side effects
- Typed with `ValidatorFn`
- Generic (format/length/pattern) live in `shared/forms/validators/`
- Domain-specific (eligibility, business rules) live in `domain/util/validators/`
- Composable with `Validators.compose()`

```ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Generic -> libs/app/shared/forms/validators/
export function requiredTrimmedValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value?.trim().length > 0 ? null : { requiredTrimmed: true };
}

// Domain-specific -> domain/util/validators/
export function validTickerSymbolValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value?.toUpperCase();
    return /^[A-Z]{1,5}$/.test(value) ? null : { invalidTicker: true };
  };
}
```

### Cross-Field Validators

Attach at the `FormGroup` level. Never on individual controls.

```ts
export const passwordMatchValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
};

const form = new FormGroup(
  {
    password: new FormControl('', { nonNullable: true }),
    confirmPassword: new FormControl('', { nonNullable: true }),
  },
  { validators: [passwordMatchValidator] },
);
```

Display group-level errors in the template:

```html
@if (form.hasError('passwordMismatch') && (form.touched || form.dirty)) {
  <ion-note color="danger">Passwords do not match.</ion-note>
}
```

### Async Validators

For server-side checks: uniqueness, existence, eligibility. Rules:
1. Async validators run only after all sync validators pass
2. Use `updateOn: 'blur'` on the control to prevent requests on every keystroke
3. Return a finite observable — always pipe through `take(1)` or `first()`
4. Return `null` on network error — do not block submission for infrastructure failures

```ts
import { inject, Injectable } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { AccountService } from '../data-access/account.service';

@Injectable({ providedIn: 'root' })
export class UniqueEmailValidator {
  private readonly accountService = inject(AccountService);

  validate(): AsyncValidatorFn {
    return (control: AbstractControl<string>): Observable<ValidationErrors | null> =>
      this.accountService.isEmailTaken(control.value).pipe(
        map((taken) => (taken ? { emailTaken: true } : null)),
        catchError(() => of(null)), // never block on infrastructure failure
        take(1),                   // always complete the observable
      );
  }
}
```

Apply to a control:

```ts
const emailValidator = inject(UniqueEmailValidator);

const email = new FormControl('', {
  nonNullable: true,
  validators: [Validators.required, Validators.email],
  asyncValidators: [emailValidator.validate()],
  updateOn: 'blur',
});
```

### Dynamic Validators

Add, remove, or replace validators at runtime. Always call `updateValueAndValidity()` after modification.

```ts
onAccountTypeChange(type: 'individual' | 'joint'): void {
  const ssnControl = this.form.get('ssn');
  if (!ssnControl) return;

  if (type === 'individual') {
    ssnControl.setValidators([Validators.required, ssnFormatValidator()]);
  } else {
    ssnControl.clearValidators();
  }
  ssnControl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
}
```

Dynamic validator methods:
- Sync: `setValidators`, `addValidators`, `removeValidators`, `clearValidators`
- Async: `setAsyncValidators`, `addAsyncValidators`, `removeAsyncValidators`, `clearAsyncValidators`
- Always follow with: `updateValueAndValidity()`

### Type Guard Utilities (Angular 21)

```ts
import {
  AbstractControl,
  isFormArray,
  isFormControl,
  isFormGroup,
  isFormRecord,
} from '@angular/forms';

export function positiveAllValues(control: AbstractControl): ValidationErrors | null {
  if (!isFormArray(control)) return null;
  return control.controls.some((c) => isFormControl(c) && c.value < 0)
    ? { positiveValues: true }
    : null;
}
```

---

## Factory Pattern (Migration-Ready Architecture)

Form creation must always be isolated in factory functions inside the `util` layer. Never construct forms inline in a component.

```
domain/util/
  trade-form.factory.ts     <- form creation + domain mapper
  trade-form.validators.ts  <- validators only
  trade-form.types.ts       <- TypeScript interfaces for form values and domain objects
```

### Typed Form Factory

```ts
// trade-form.types.ts
export interface TradeFormValue {
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice: number | null;
}

export interface PlaceOrderRequest {
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
}

// trade-form.factory.ts
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { PlaceOrderRequest, TradeFormValue } from './trade-form.types';
import { validTickerSymbolValidator } from './trade-form.validators';

export type TradeForm = FormGroup<{
  symbol: FormControl<string>;
  quantity: FormControl<number>;
  orderType: FormControl<'market' | 'limit'>;
  limitPrice: FormControl<number | null>;
}>;

export function createTradeForm(): TradeForm {
  return new FormGroup({
    symbol: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validTickerSymbolValidator()],
    }),
    quantity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    orderType: new FormControl<'market' | 'limit'>('market', { nonNullable: true }),
    limitPrice: new FormControl<number | null>(null),
  });
}

// Domain mapper — keeps the store free of form types
export function mapTradeFormToOrder(value: TradeFormValue): PlaceOrderRequest {
  return {
    symbol: value.symbol.toUpperCase(),
    quantity: value.quantity,
    orderType: value.orderType,
    limitPrice: value.orderType === 'limit' ? (value.limitPrice ?? undefined) : undefined,
  };
}
```

---

## Signal Forms Awareness (Experimental)

**Current status**: Signal Forms (`@angular/forms/signals`) are available in Angular 21 but marked **experimental**. Do not use in production features. Use Reactive Forms for all production code.

### Why Architecture Decisions Must Consider Signal Forms Now

The migration path from Reactive Forms to Signal Forms is vastly simpler when:
- Form creation lives in isolated factories (not inline in components)
- Validators are pure functions with no framework coupling
- UI components receive the form as `input()` rather than creating it
- RxJS orchestration around form observables is minimal

These rules are already enforced for other reasons — Signal Forms readiness is a secondary benefit.

### Signal Forms API Overview (For Awareness Only)

```ts
// Import from @angular/forms/signals (experimental — do not use in production)
import { form, FormField, required, email, minLength, validateHttp } from '@angular/forms/signals';

@Component({
  imports: [FormField],
  template: `
    <input [formField]="registrationForm.username" />
    @if (registrationForm.username().pending()) {
      <span>Checking availability...</span>
    }
    @if (registrationForm.username().invalid()) {
      @for (error of registrationForm.username().errors(); track $index) {
        <span>{{ error.message }}</span>
      }
    }
  `,
})
export class RegistrationPage {
  private readonly model = signal({ username: '', email: '' });

  protected readonly registrationForm = form(this.model, (s) => {
    required(s.username);
    minLength(s.username, 3);
    required(s.email);
    email(s.email);

    validateHttp(s.username, {
      debounce: 300,
      request: ({ value }) => {
        const u = value();
        return u ? `/api/users/check?username=${u}` : undefined;
      },
      onSuccess: (res) =>
        res.available ? null : { kind: 'usernameTaken', message: 'Username taken' },
      onError: () => ({ kind: 'serverError', message: 'Could not verify username' }),
    });
  });
}
```

### Reactive Forms vs Signal Forms Comparison

| Concern | Reactive Forms | Signal Forms |
|---|---|---|
| Form creation | `new FormGroup()` / factory | `form(model, schema)` |
| Data model | Separate from component state | Bound to a `signal()` |
| Control binding | `formControlName`, `[formControl]` | `[formField]` directive |
| Field state access | `.touched`, `.valid`, `.pending` | `.touched()`, `.valid()`, `.pending()` |
| Validation | `ValidatorFn`, `AsyncValidatorFn` | Schema functions: `required()`, `validateHttp()` |
| Async validation | Observable-based, manual debounce | `validateHttp()` with built-in debounce and cancel |
| Cross-field rules | Group-level `ValidatorFn` | Schema-level rules over multiple paths |
| Change detection | Requires observable subscriptions | Reactive by default via signals |

### Migration Readiness Checklist

When Signal Forms exit experimental status:
- Form factories -> become `form(model, schema)` calls
- Pure `ValidatorFn` functions -> become schema rule functions
- UI components receiving form via `input()` -> receive a signal form reference
- Store submit state -> no change, SignalStore is already signal-native
- Async validators -> replaced by `validateHttp()` or `validateAsync()`

---

## Nx Placement Rules

### Domain-Specific Forms

Place all form logic inside the owning domain:

```txt
libs/app/<domain>/
├── data-access/    <- SignalStore, repository, API services
├── feature/        <- page-level orchestration, submit handling
├── ui/             <- presentational form components
└── util/           <- factories, validators, types, mappers
```

Concrete example:

```txt
libs/app/account-opening/
├── feature/
│   └── account-opening.page.ts
├── ui/
│   └── components/
│       └── personal-info-form.component.ts
└── util/
    ├── personal-info-form.factory.ts     <- createPersonalInfoForm()
    ├── personal-info-form.validators.ts  <- domain-specific ValidatorFn functions
    └── personal-info-form.types.ts       <- PersonalInfoFormValue, interfaces
```

### Shared Reusable Form Utilities

Place generic, cross-domain building blocks in:

```txt
libs/app/shared/forms/
├── validators/
│   ├── required-trimmed.validator.ts
│   ├── phone-format.validator.ts
│   └── date-range.validator.ts
├── errors/
│   └── validation-error-message.util.ts
├── ui/
│   └── form-field-error.component.ts
└── util/
    ├── mark-form-touched.util.ts
    └── form-value-changes.util.ts
```

**Rule**: Nothing domain-specific goes in `shared/forms`. Shared validators must be generic (format, length, pattern). Domain eligibility rules belong in the domain's `util/validators/`.

---

## Layer Rules

### feature

Owns:
- Page-level orchestration (create form, inject store)
- Submit handling (`markAllAsTouched()`, `getRawValue()`, store method calls)
- Navigation after success
- Mapping form output to domain models via mapper functions

Forbidden:
- Raw API calls
- Inline form construction (`new FormGroup({...})` directly in component)
- Validation logic

### ui

Owns:
- Presentational form rendering with Ionic components
- `input()` / `output()` for form and events
- Error display based on control state
- Ionic UX: keyboard types, accessibility

Forbidden:
- Store injection
- API calls
- Business validation
- Form creation

### util

Owns:
- Form factories (`createXxxForm()`)
- Domain validators (`ValidatorFn` pure functions)
- Type interfaces (`XxxFormValue`, domain request/response types)
- Domain mappers (`mapXxxFormToRequest()`)

Forbidden:
- Side effects
- API calls
- Angular DI (unless async validator service is needed)

### data-access

Owns:
- SignalStore (`withState`, `withMethods`, `withComputed`)
- Repository and API service calls
- Submit/save/load orchestration
- Domain state signals

Forbidden:
- Ionic UI imports
- Form rendering concerns

---

## MVVM Form Pattern

The complete architecture with full code examples.

### Feature Page (Orchestrator)

```ts
// account-opening.page.ts (feature layer)
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { PersonalInfoFormComponent } from '../ui/components/personal-info-form.component';
import { createPersonalInfoForm } from '../util/personal-info-form.factory';
import { mapPersonalInfoFormToRequest } from '../util/personal-info-form.factory';
import { AccountOpeningStore } from '../data-access/account-opening.store';

@Component({
  selector: 'app-account-opening-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PersonalInfoFormComponent],
  template: `
    <app-personal-info-form
      [form]="form"
      (formSubmit)="onSubmit()"
    />
  `,
})
export class AccountOpeningPage {
  protected readonly store = inject(AccountOpeningStore);
  protected readonly form = createPersonalInfoForm();

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const request = mapPersonalInfoFormToRequest(this.form.getRawValue());
    this.store.submit(request);
  }
}
```

### UI Form Component (Presentational)

```ts
// personal-info-form.component.ts (ui layer)
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  IonItem,
  IonLabel,
  IonInput,
  IonNote,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import { PersonalInfoForm } from '../../util/personal-info-form.factory';

@Component({
  selector: 'app-personal-info-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonLabel, IonInput, IonNote, IonButton, IonSpinner],
  template: `
    <form [formGroup]="form()" (ngSubmit)="formSubmit.emit()">
      <ion-item>
        <ion-label position="stacked">First Name</ion-label>
        <ion-input
          formControlName="firstName"
          type="text"
          autocomplete="given-name"
        />
        @if (form().get('firstName')?.invalid && form().get('firstName')?.touched) {
          <ion-note slot="error" color="danger">First name is required.</ion-note>
        }
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Email</ion-label>
        <ion-input
          formControlName="email"
          type="email"
          inputmode="email"
          autocomplete="email"
        />
        @if (form().get('email')?.hasError('required') && form().get('email')?.touched) {
          <ion-note slot="error" color="danger">Email is required.</ion-note>
        }
        @if (form().get('email')?.hasError('email') && form().get('email')?.touched) {
          <ion-note slot="error" color="danger">Enter a valid email address.</ion-note>
        }
        @if (form().get('email')?.pending) {
          <ion-spinner name="crescent" slot="end" />
        }
      </ion-item>

      <ion-button expand="block" type="submit">
        Submit
      </ion-button>
    </form>
  `,
})
export class PersonalInfoFormComponent {
  protected readonly form = input.required<PersonalInfoForm>();
  protected readonly formSubmit = output<void>();
}
```

### SignalStore (Data-Access)

```ts
// account-opening.store.ts (data-access layer)
import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { AccountOpeningRepository } from './account-opening.repository';
import { PersonalInfoRequest } from '../util/personal-info-form.types';

type AccountOpeningState = {
  submitting: boolean;
  error: string | null;
  success: boolean;
};

export const AccountOpeningStore = signalStore(
  { providedIn: 'root' },
  withState<AccountOpeningState>({
    submitting: false,
    error: null,
    success: false,
  }),
  withMethods((store, repo = inject(AccountOpeningRepository)) => ({
    submit(request: PersonalInfoRequest): void {
      patchState(store, { submitting: true, error: null, success: false });
      repo.submit(request).subscribe({
        next: () => patchState(store, { submitting: false, success: true }),
        error: (err: unknown) =>
          patchState(store, {
            submitting: false,
            error: err instanceof Error ? err.message : 'Submission failed.',
          }),
      });
    },
  })),
);
```

Submit guard in the page (computed signal blocking double-submit):

```ts
protected readonly canSubmit = computed(
  () => this.form.valid && !this.store.submitting(),
);
```

---

## Validation Display Rules

### When to Show Errors

Only display errors after:
1. The control has been `touched` (user blurred the field), or
2. `markAllAsTouched()` has been called (submit attempt)

Never show errors while the user is actively typing for the first time.

### Template Pattern

```html
@if (form.get('email')?.invalid && form.get('email')?.touched) {
  @if (form.get('email')?.hasError('required')) {
    <ion-note slot="error" color="danger">Email is required.</ion-note>
  }
  @if (form.get('email')?.hasError('email')) {
    <ion-note slot="error" color="danger">Enter a valid email address.</ion-note>
  }
  @if (form.get('email')?.hasError('emailTaken')) {
    <ion-note slot="error" color="danger">This email is already registered.</ion-note>
  }
}
@if (form.get('email')?.pending) {
  <ion-spinner name="crescent" />
}
```

### Shared FormFieldErrorComponent

Extract repetitive error display to `shared/forms/ui/form-field-error.component.ts`:

```ts
@Component({
  selector: 'app-form-field-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonNote],
  template: `
    @if (control() && control()!.invalid && control()!.touched) {
      @for (error of errorMessages(); track $index) {
        <ion-note slot="error" color="danger">{{ error }}</ion-note>
      }
    }
  `,
})
export class FormFieldErrorComponent {
  protected readonly control = input<AbstractControl | null>(null);
  protected readonly errorMap = input<Record<string, string>>({});

  protected readonly errorMessages = computed(() => {
    const ctrl = this.control();
    const map = this.errorMap();
    if (!ctrl?.errors) return [];
    return Object.keys(ctrl.errors)
      .map((key) => map[key])
      .filter(Boolean);
  });
}
```

---

## Ionic Mobile UX Rules

### Ionic Standalone Imports

Always import Ionic components individually (standalone):

```ts
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonRadioGroup,
  IonRadio,
  IonDatetime,
  IonButton,
  IonNote,
  IonSpinner,
} from '@ionic/angular/standalone';
```

### Input Type and Inputmode

| Field type | `type=` | `inputmode=` |
|---|---|---|
| Email address | `email` | `email` |
| Phone number | `tel` | `tel` |
| Integer quantity | `number` | `numeric` |
| Currency / decimal | `text` | `decimal` |
| Search query | `search` | `search` |
| URL | `url` | `url` |

**Currency rule**: Use `type="text"` with `inputmode="decimal"` for currency fields. `type="number"` causes UX issues with mobile keyboards for formatted decimal values.

### Error Display Rules

- Show errors only after `touched` or after `markAllAsTouched()` is called
- Never show errors while the user is actively typing for the first time
- For async validators, show a spinner in the `slot="end"` position while `pending`
- Use `ion-note` with `slot="error"` for inline field errors
- Preserve user input on validation failure — never clear the field

### Submit Button Rules

- Disable the submit button when `form.invalid || store.submitting()`
- Show `ion-spinner` inside the button while `store.submitting()`
- Use `expand="block"` for full-width submit buttons
- Use `type="submit"` on the button inside a `<form>` tag

```html
<ion-button
  expand="block"
  type="submit"
  [disabled]="form.invalid || store.submitting()"
>
  @if (store.submitting()) {
    <ion-spinner name="crescent" />
  } @else {
    Submit
  }
</ion-button>
```

---

## Anti-Patterns

```ts
// ❌ Untyped form — never use any
const form = new FormGroup<any>({});

// ❌ Missing nonNullable — control value can be null unexpectedly
const name = new FormControl('', [Validators.required]); // BAD
const name = new FormControl('', { nonNullable: true, validators: [Validators.required] }); // GOOD

// ❌ Using .value instead of .getRawValue() when controls may be disabled
const data = this.form.value;         // BAD: disabled fields return undefined
const data = this.form.getRawValue(); // GOOD: always includes disabled fields

// ❌ Not calling markAllAsTouched() before showing errors on submit
onSubmit() {
  if (this.form.invalid) return; // BAD: errors won't show to the user
}
onSubmit() {
  if (this.form.invalid) {
    this.form.markAllAsTouched(); // GOOD: shows all errors immediately
    return;
  }
}

// ❌ Business validation inside a component method (not a validator)
if (this.form.value.age < 18) { /* show error manually */ }

// ❌ API call from a UI component
this.http.post('/submit', this.form.getRawValue());

// ❌ Store injected into a presentational form UI component
private readonly store = inject(AccountOpeningStore);

// ❌ Template-driven form
[(ngModel)]="name"

// ❌ Missing take(1) on async validator — observable never completes
return this.accountService.isEmailTaken(value); // BAD
return this.accountService.isEmailTaken(value).pipe(take(1)); // GOOD

// ❌ Dynamic validator change without updateValueAndValidity
control.setValidators([Validators.required]); // BAD: validator added but not applied
control.setValidators([Validators.required]);
control.updateValueAndValidity({ emitEvent: false }); // GOOD

// ❌ FormArray mutation without markForCheck in zoneless
this.form.push(new FormControl('', { nonNullable: true }));
// Missing: this.cdr.markForCheck();

// ❌ Constructing form inline in a component
@Component({...})
export class MyPage {
  // BAD: form construction coupled to the component, breaks migration readiness
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
  });
}

// ❌ Domain-specific validators placed in shared/forms
// BAD: libs/app/shared/forms/validators/trade-eligible.validator.ts
// GOOD: libs/app/trading/util/validators/trade-eligible.validator.ts

// ❌ Validators defined inside component files
@Component({...})
export class MyPage {
  private readonly myValidator: ValidatorFn = (control) => { ... }; // BAD
}
```

---

## Required AI Behavior

When generating form code for this app:

1. **Identify the owning domain** and place all artifacts in the correct Nx layer
2. **Always use typed Reactive Forms** — `FormControl<T>`, `FormGroup<T>`, `FormArray<T>`, `FormRecord<T>`
3. **Always set `nonNullable: true`** on every control (or use `NonNullableFormBuilder`)
4. **Always use a factory function** — never construct forms inline in component class
5. **Always use `getRawValue()`** when reading form values for submission
6. **Always call `markAllAsTouched()`** before short-circuiting on invalid state
7. **Always use `updateOn: 'blur'`** on controls with async validators
8. **Always pipe async validators through `take(1)`** to ensure completion
9. **Always call `updateValueAndValidity({ emitEvent: false })`** after dynamic validator changes
10. **Always call `ChangeDetectorRef.markForCheck()`** after `FormArray` mutations in zoneless apps
11. **Keep UI components presentational** — receive form via `input()`, emit submit via `output()`
12. **Use SignalStore** for submit/save/load state — not component-level signals
13. **Use Ionic standalone imports** — never import from `@ionic/angular` module
14. **Place generic validators** in `shared/forms/validators/`; **domain validators** in `domain/util/validators/`
15. **Include a domain mapper function** in the factory file (`mapXxxFormToRequest()`)
16. **Do not place domain-specific validators** in `shared/forms`
17. **Do not define validators inside component files**
18. **Use Angular 21 unified events stream** (`form.events`) instead of separate `valueChanges` / `statusChanges` subscriptions when reacting to multiple change types
19. **Always use `standalone: true`** and `ChangeDetectionStrategy.OnPush` on all form components
20. **Do not use Signal Forms** (`@angular/forms/signals`) in production code — they are experimental

Default architecture for any new form feature:

```txt
domain/feature/page.ts
  creates form from domain/util/factory
  passes form to domain/ui/form.component via input()
  handles submit event from output()
  calls domain/data-access/store method

domain/ui/form.component.ts
  receives form as input()
  renders Ionic controls
  emits formSubmit via output()
  displays validation errors

domain/util/form.factory.ts
  createXxxForm() -> FormGroup<T>
  mapXxxFormToRequest() -> DomainRequest

domain/data-access/store.ts
  SignalStore with submitting/error/success signals
  calls repository on submit
```
