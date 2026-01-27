---
name: add-vitest-tests
description: Adds comprehensive Vitest tests for Angular components with signal-based state. Generates test files following repository patterns including TestBed setup, signal testing, computed property validation, and template rendering checks. Use when adding tests to existing components.
---

# Add Vitest Tests Skill

This skill generates comprehensive Vitest tests for Angular components with signal-based state management.

## When to Use

Use this skill when:
- Adding tests to existing components
- Creating test coverage for signal state
- Testing computed properties and reactivity
- Validating template rendering
- Testing user interactions

## Test Structure

### Basic Test Setup

```typescript
import { TestBed } from '@angular/core/testing';
import { ComponentName } from './component-name.component';

describe('ComponentName', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentName],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ComponentName);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
```

## Test Patterns

### 1. Signal State Tests

Test signal initialization and updates:

```typescript
describe('Signal State', () => {
  it('should initialize count to 0', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    expect(component.count()).toBe(0);
  });

  it('should update count using set', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    
    component.count.set(5);
    
    expect(component.count()).toBe(5);
  });

  it('should update count using update', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    
    component.count.update(c => c + 1);
    
    expect(component.count()).toBe(1);
  });
});
```

### 2. Computed Property Tests

Test computed reactivity:

```typescript
describe('Computed Properties', () => {
  it('should compute doubled value', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    
    component.count.set(5);
    
    expect(component.doubled()).toBe(10);
  });

  it('should react to signal changes', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    
    component.count.set(3);
    expect(component.doubled()).toBe(6);
    
    component.count.update(c => c + 1);
    expect(component.doubled()).toBe(8);
  });
});
```

### 3. Template Rendering Tests

Test template bindings:

```typescript
describe('Template Rendering', () => {
  it('should render initial count', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Count: 0');
  });

  it('should update template on state change', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    
    component.increment();
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Count: 1');
  });
});
```

### 4. User Interaction Tests

Test event handlers:

```typescript
describe('User Interactions', () => {
  it('should increment on button click', () => {
    const fixture = TestBed.createComponent(CounterComponent);
    fixture.detectChanges();
    
    const button = fixture.nativeElement.querySelector('button');
    button?.click();
    fixture.detectChanges();
    
    const component = fixture.componentInstance;
    expect(component.count()).toBe(1);
  });
});
```

## Important Guidelines

1. **Access Signals**: Use `component.signal()` with parentheses, not `component.signal`
2. **Change Detection**: Call `fixture.detectChanges()` after state changes, even with OnPush
3. **Arrange-Act-Assert**: Follow this pattern for clear test structure
4. **Test Coverage**: Include initialization, updates, computed values, and rendering
5. **Descriptive Names**: Use clear, specific test names that explain what's being tested

## Common Patterns

### Testing Async Operations

```typescript
it('should handle async data loading', async () => {
  const fixture = TestBed.createComponent(DataComponent);
  const component = fixture.componentInstance;
  
  component.loadData();
  expect(component.loading()).toBe(true);
  
  await fixture.whenStable();
  
  expect(component.loading()).toBe(false);
  expect(component.data()).toBeDefined();
});
```

### Testing Error States

```typescript
it('should handle errors', () => {
  const fixture = TestBed.createComponent(DataComponent);
  const component = fixture.componentInstance;
  
  component.error.set('Failed to load');
  
  expect(component.hasError()).toBe(true);
  expect(component.errorMessage()).toBe('Failed to load');
});
```

## Example Request

"Add tests for CounterComponent"

This should generate tests for:
- Component creation
- Count signal initialization
- Increment/decrement methods
- Doubled computed property
- Template rendering
- Button click interactions
