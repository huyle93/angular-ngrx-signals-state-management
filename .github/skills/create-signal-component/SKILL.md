---
name: create-signal-component
description: Creates a new Angular component with signal-based state management, following repository patterns including standalone components, OnPush change detection, and modern control flow syntax. Use when generating new components that need reactive state.
---

# Create Signal Component Skill

This skill generates Angular components following the repository's modern patterns with signal-based state management.

## When to Use

Use this skill when creating:
- New feature components with local state
- Demo components showcasing state patterns
- Components that need reactive data
- UI components with computed values

## Component Pattern

All components must follow these patterns:

### 1. Component Structure

```typescript
import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';

@Component({
  selector: 'app-component-name',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Use modern control flow -->
    @if (condition()) {
      <div>Content</div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ComponentNameComponent {
  // Signal state
  protected readonly state = signal<Type>(initialValue);
  
  // Computed values
  protected readonly computed = computed(() => this.state());
  
  // Actions
  protected updateState() {
    this.state.update(prev => newValue);
  }
}
```

### 2. Naming Conventions

- File: `component-name.component.ts` (lowercase with hyphens)
- Class: `ComponentNameComponent` (PascalCase)
- Selector: `app-component-name`
- Test file: `component-name.component.spec.ts`

### 3. Signal Guidelines

- Use `protected readonly` for template-exposed signals
- Use `private readonly` for internal signals
- Initialize with appropriate types
- Use `.set()` for replacing values
- Use `.update()` for transforming values

### 4. Modern Control Flow

Replace old syntax with modern:
- `@if` instead of `*ngIf`
- `@for` instead of `*ngFor`
- `@switch` instead of `*ngSwitch`

### 5. Test File Structure

```typescript
import { TestBed } from '@angular/core/testing';
import { ComponentNameComponent } from './component-name.component';

describe('ComponentNameComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentNameComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ComponentNameComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should initialize signals', () => {
    const fixture = TestBed.createComponent(ComponentNameComponent);
    const component = fixture.componentInstance;
    expect(component.state()).toBeDefined();
  });
});
```

## Steps to Create Component

1. Create component file: `apps/web-app/src/app/[name].component.ts`
2. Create test file: `apps/web-app/src/app/[name].component.spec.ts`
3. Add route to `apps/web-app/src/app/app.routes.ts` if needed
4. Update navigation in `apps/web-app/src/app/app.html` if needed

## Example Request

"Create a user profile component with loading, user data, and error states"

This should generate a component with:
- `loading` signal for loading state
- `user` signal for user data
- `error` signal for error messages
- Computed properties like `hasUser`, `displayName`
- Methods for fetching and updating user data
