# Copilot Instructions for Angular NgRx Signals State Management

## Project Overview

This is a cutting-edge Angular monorepo demonstrating modern state management with Signals and NgRx. All code must follow the latest Angular best practices and modern patterns. This project is also an experimental space for the user to develop external applications, such as the ***Name-Hidden*** mobile app, using Angular and Ionic. The `external-context/` directory is a local workspace for the user to store all relevant information, code, and documentation related to their work on external apps. This allows the user to have a centralized location for all their work on external apps, and easily access and manage their projects.

## Workspace Structure

- **Nx Monorepo**: Apps in `apps/`, shared libraries in `libs/`
- **Angular 21.1.1**: Latest version with Signal Forms and zoneless support
- **TypeScript 5.9.3**: Strict mode enabled
- **Testing**: Vitest with @nx/vitest inferred tasks
- **Documentation**: Comprehensive docs in `docs/` for human learning, `.github/` for AI instructions
- **External Context**: `external-context/` for user-specific app development (gitignored). Prevent sensitive such as app name, business naming specfic to be committed. Only store technical information, architectural decisions, and code snippets that are not sensitive to serve the intent of technical reference for the user, common technical patterns, and architectural decisions. Do not store any business-specific information, naming conventions, or any other sensitive information that should not be shared publicly. The user can create subfolders for each app they are working on, and store all relevant information, code, and documentation in those subfolders. This allows the user to have a centralized location for all their work on external apps, and easily access and manage their projects.

## Core Principles

### 1. Angular Architecture

- **Standalone Components Only**: Never use NgModules
- **Zoneless Angular**: Always use `provideZonelessChangeDetection()` in app.config.ts
- **OnPush Change Detection**: All components must use `ChangeDetectionStrategy.OnPush`
- **Signal-Based Reactivity**: Use `signal()`, `computed()`, `effect()` for all state management

### 2. Modern Syntax

- **Control Flow**: Use `@if`, `@for`, `@switch` - never `*ngIf`, `*ngFor`, `*ngSwitch`
- **Signals**: Prefer signals over observables for local state
- **Typed Forms**: When forms are needed, use Angular's typed forms

### 3. Component Patterns

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
    this.count.update(c => c + 1);
  }
}
```

### 4. State Management

- **Local State**: Use `signal()` and `computed()`
- **Component State**: Keep state close to where it's used
- **Shared State**: Will use NgRx Store (to be implemented)
- **Async State**: Use `toSignal()` from `@angular/core/rxjs-interop`

### 5. Testing

- **Framework**: Vitest, not Jest
- **Location**: Co-located `.spec.ts` files
- **Setup**: Use Angular TestBed with zoneless setup in `test-setup.ts`
- **Pattern**: Arrange-Act-Assert

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

### 6. File Structure

```
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

### 7. Naming Conventions

- Components: `example.component.ts` (lowercase, no barrel files)
- Tests: `example.component.spec.ts`
- Routes: `app.routes.ts`
- Config: `app.config.ts`

### 8. Imports

- Always use standalone: `imports: [CommonModule, FormsModule]` in component decorator
- Use proper paths from tsconfig
- Group imports: Angular, third-party, local

### 9. Styling

- Use SCSS
- Component styles co-located
- Use `:host` selector for component root styling

### 10. Code Quality

- Prefer `protected readonly` for component properties exposed to templates
- Use TypeScript strict mode
- No `any` types
- Implement proper error handling
- Keep components focused and small

## What NOT to Do

❌ Don't use NgModules
❌ Don't use `*ngIf`, `*ngFor`, `*ngSwitch`
❌ Don't use Jest (use Vitest)
❌ Don't use zone.js change detection
❌ Don't use Default change detection strategy
❌ Don't use barrel index files
❌ Don't mutate signals directly (use `.set()` or `.update()`)

## When to Use What

- **`signal()`**: Writable state that can change
- **`computed()`**: Derived values from signals
- **`effect()`**: Side effects based on signal changes (use sparingly)
- **`toSignal()`**: Convert observables to signals
- **`input()`**: Component inputs as signals (Angular 21+)
- **`output()`**: Component outputs (Angular 21+)

## Documentation Structure

### docs/ Directory (Human Learning)

The `docs/` directory contains comprehensive documentation for **human developers** to learn concepts and understand architectural decisions:

- **docs/concepts/**: Core concepts (Signals, Zoneless Angular, OnPush, etc.)
- **docs/guides/**: Step-by-step tutorials and how-to guides
- **docs/patterns/**: Reusable state management patterns and best practices
- **docs/decisions/**: Architectural Decision Records (ADR) explaining technical choices

**When to reference docs/:**
- When a user asks "what is..." or "why do we..." → Point them to relevant concept or decision doc
- When explaining architectural rationale → Reference the appropriate ADR
- When teaching patterns → Link to pattern documentation

### .github/ Directory (AI Instructions)

This directory (where this file lives) contains instructions for **AI code generation**:

- **copilot-instructions.md**: Auto-applied coding standards (this file)
- **skills/\*/SKILL.md**: Agent skills for specific tasks (create components, add tests)
- **prompts/\*.prompt.md**: Reusable prompts for common workflows
- **agents/\*.agent.md**: Custom agents for specialized workflows (planned)
- **instructions/\*.instructions.md**: Additional context-specific instructions (planned)

**Key Difference**: `docs/` teaches concepts and reasoning; `.github/` provides code generation rules.

## Current Implementation Status

✅ Zoneless Angular configured
✅ Vitest testing setup
✅ Three demo components: Home, Counter, Todo
✅ Signal-based state management examples
✅ Documentation structure (docs/) for human learning
✅ GitHub Copilot workspace features configured
🚧 NgRx Store integration (planned)
🚧 Shared state libraries (planned)

## Remember

This repository demonstrates **modern, cutting-edge Angular**. Always prefer the newest APIs and patterns. Check Angular 21 documentation for the latest features.

When users ask conceptual questions, guide them to the `docs/` directory. When generating code, follow the patterns defined in this file and the `.github/skills/` directory.
