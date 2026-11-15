# Agent Coding Standards — Detailed Reference

Condensed reference material for AI coding agents. The always-loaded rules live in
`AGENTS.md`; this file holds the code templates and expanded conventions. Read it when
writing components, tests, or wiring configuration.

## Component Pattern

```typescript
import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

@Component({
  selector: 'app-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <p>Loading...</p>
    } @else {
      <h1>{{ title() }}</h1>
    }
  `,
})
export class ExampleComponent {
  // Use signals for reactive state
  protected readonly count = signal(0);
  protected readonly doubled = computed(() => this.count() * 2);

  protected increment() {
    this.count.update(c => c * 2);
  }
}
```

Decorator rules:

- `imports: []` in the decorator brings in dependencies (standalone, no NgModules)
- Group imports: Angular first, then third-party, then local
- Co-locate component styles as SCSS; use the `:host` selector for the component root

## Testing Pattern

Framework is Vitest (never Jest). Tests are co-located as `*.spec.ts`, use Angular
TestBed with the zoneless setup in `test-setup.ts`, and follow Arrange-Act-Assert:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

describe('ExampleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ExampleComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
```

## Signals: When to Use What

| API | Use for |
|---|---|
| `signal()` | Writable state |
| `computed()` | Derived values from signals |
| `effect()` | Side effects on signal changes (sparingly) |
| `toSignal()` | Converting observables (`@angular/core/rxjs-interop`) |
| `input()` | Component inputs as signals (Angular 21+) |
| `output()` | Component outputs (Angular 21+) |

## File Structure

```text
apps/web-app/
├── src/
│   ├── app/
│   │   ├── app.ts              # Root component
│   │   ├── app.config.ts       # App configuration with zoneless
│   │   ├── app.routes.ts       # Route configuration
│   │   ├── feature.component.ts
│   │   └── feature.component.spec.ts
│   ├── main.ts
│   └── test-setup.ts
├── project.json
├── tsconfig.json
└── vite.config.ts
```

## Naming Conventions

- Components: `example.component.ts` (lowercase, no barrel files)
- Tests: `example.component.spec.ts`
- Routes: `app.routes.ts`
- Config: `app.config.ts`

## Documentation Layout

- `docs/concepts/` — core concepts (Signals, zoneless, OnPush)
- `docs/guides/` — step-by-step guides and architecture references
- `docs/patterns/` — reusable state-management patterns
- `docs/decisions/` — architecture decision records (ADRs)

Conceptual or "why" questions belong in `docs/`; code-generation rules live in
`AGENTS.md` and `.github/skills/`.
