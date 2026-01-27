---
description: Creates a new demo component showcasing a state management pattern
---

# Create Demo Component

You are creating a new educational demo component for the Angular NgRx Signals State Management repository.

## Context

This repository demonstrates modern Angular state management patterns using:
- Angular 21.1.1 with standalone components
- Signal-based reactivity
- Zoneless change detection
- OnPush strategy
- Modern control flow syntax

## Requirements

Create a component that:

1. **Demonstrates a specific state pattern** (specify which: counter, form, async data, list management, etc.)
2. **Uses signals exclusively** for state management
3. **Includes computed values** where applicable
4. **Has clear, educational code** with comments explaining key concepts
5. **Includes comprehensive tests** with Vitest
6. **Has a clean, simple UI** that clearly shows state changes

## Component Structure

```typescript
// Pattern: [DESCRIBE PATTERN]
// Demonstrates: [KEY CONCEPTS]

@Component({
  selector: 'app-[name]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Clear UI showing state -->
  `,
  styles: [`
    /* Clean, educational styling */
  `]
})
export class [Name]Component {
  // Signal state with explanatory comments
  
  // Computed values
  
  // Actions/methods
}
```

## Steps

1. Create the component file in `apps/web-app/src/app/[name].component.ts`
2. Create comprehensive tests in `apps/web-app/src/app/[name].component.spec.ts`
3. Add route to `apps/web-app/src/app/app.routes.ts`
4. Update navigation in `apps/web-app/src/app/app.html`
5. Suggest documentation for `docs/patterns/[name]-pattern.md`

## Educational Focus

- Add comments explaining WHY, not just WHAT
- Show the signal reactivity chain clearly
- Demonstrate best practices
- Include error handling examples
- Show TypeScript typing

## Demo Pattern Ideas

- Shopping cart state
- Form with validation
- Data fetching with loading states
- Filtering and sorting
- Parent-child communication
- Optimistic updates
- Undo/redo functionality
