TypeScript Coding Rules

Principles
- Correctness, type safety, and simplicity first
- Prefer clarity and maintainability over clever abstractions
- Avoid unnecessary boilerplate or over-engineering

Type Safety
- Never use `any`
- Prefer `unknown` at boundaries and narrow with guards
- Prefer strict domain types, unions, and narrow types
- Define explicit return types for public functions
- Prefer discriminated unions for state and branching logic
- Prefer `type` for unions and aliases; use `interface` for object shapes meant to be extended or implemented
- Prefer string literal unions over enums unless runtime enum behavior is required

Immutability
- Prefer immutable data
- Use `readonly` for class properties that should not change
- Use `readonly` arrays (`readonly T[]`) for shared inputs and returned collections
- Do not mutate function parameters
- Use `as const` for stable literal values when it improves type precision

Visibility
- Declare access modifiers explicitly on class members
- Use the narrowest visibility needed
- Expose only what is part of the public API
- Use `private readonly` for injected dependencies

Class Structure
- Keep classes small and single responsibility
- Avoid public mutable state
- Prefer functions and plain objects unless a class is justified
- Prefer pure functions where possible
- Avoid side effects unless required for state or effects

Null Safety
- Prefer `undefined` over `null`
- Use type narrowing and guards instead of non-null assertions (`!`)
- Only use optional chaining when the value is legitimately optional

Inference and Assertions
- Prefer inference for local variables when the type is obvious
- Avoid unsafe type assertions (`as`); model the type correctly or narrow first
- Use `satisfies` when validating object shapes without widening useful literal types

Code Quality
- Avoid unnecessary abstraction for single-use logic
- Write small, focused functions
- Comments explain intent, not what the code already shows