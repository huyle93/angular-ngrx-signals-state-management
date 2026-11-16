# Documentation

Welcome to the documentation for the Angular NgRx Signals State Management project. This documentation serves as a comprehensive learning resource for understanding modern Angular state management patterns, architectural decisions, and best practices.

## Purpose

This documentation is designed for **human learning** and provides in-depth explanations of concepts, patterns, and architectural decisions used in this repository. It complements the `.github/` directory, which contains AI instructions for GitHub Copilot.

## Documentation Structure

### Docs folder purpose

- All docs are shared for more than just this repository as this is an experimental, research, demo repository.
- The docs includes for human reading, AI coding assistance like vscode copilot, coding agents, etc.
- The docs are not only for this repository but also for other repositories, so avoid repository-specific details.
- The docs are not for code generation instructions, those belong in the `.github/` folder.
- The docs may include setup for other repositories, avoid repository-specific setup.

### 📚 [Concepts](./concepts/)

Core concepts and technologies used in this project:

- **Signals**: Angular's reactive primitives (`signal()`, `computed()`, `effect()`)
- **Zoneless Angular**: Understanding `provideZonelessChangeDetection()` and its benefits
- **OnPush Change Detection**: How it works and why we use it
- **Standalone Components**: Modern Angular architecture without NgModules
- **Modern Control Flow**: `@if`, `@for`, `@switch` vs legacy directives

### 📖 [Guides](./guides/)

Step-by-step tutorials and how-to guides:

- Getting started with the workspace
- Creating your first signal-based component
- Building complex state management with multiple signals
- Testing signal-based components with Vitest
- Debugging zoneless applications

### 🎯 [Patterns](./patterns/)

State management patterns and best practices:

- Local component state patterns
- Shared state patterns (planned with NgRx Store)
- Signal composition patterns
- Async state management with `toSignal()`
- Performance optimization techniques

### 🏛️ [Decisions](./decisions/)

Architectural Decision Records (ADR) documenting key technical decisions:

- Why we chose Vitest over Jest
- Zoneless Angular: rationale and tradeoffs
- Signals vs Observables: when to use each
- Nx monorepo structure decisions
- Testing strategy and patterns

## Quick Links

- [Project README](../README.md) - Workspace overview and setup
- [AGENTS.md](../AGENTS.md) - AI coding rules (all agents)
- [Agent Coding Standards](guides/agent-coding-standards.md) - code templates and expanded conventions
- [Nx Documentation](https://nx.dev) - Monorepo management
- [Angular Documentation](https://angular.dev) - Official Angular docs

## Contributing

When adding new documentation:

1. **Concepts**: Explain _what_ something is and _why_ it matters
2. **Guides**: Show _how_ to do something step-by-step
3. **Patterns**: Document reusable solutions to common problems
4. **Decisions**: Record _why_ we made specific technical choices

Keep documentation:

- Clear and concise
- Up-to-date with the codebase
- Focused on learning and understanding
- Rich with code examples

## Documentation vs .github/

| Directory  | Purpose         | Audience       | Content Type                    |
| ---------- | --------------- | -------------- | ------------------------------- |
| `docs/`    | Human learning  | Developers     | Concepts, tutorials, reasoning  |
| `.github/` | AI instructions | GitHub Copilot | Code generation rules, patterns |

Both are essential but serve different purposes. The `.github/` directory teaches the AI _how to generate code_, while `docs/` teaches humans _concepts and reasoning_.

## Adaptive FI reference

[Run both apps](guides/adaptive-fi.md) · [Task](specs/a3-adaptive-fi.md) · [ADR](decisions/ADR-A3-adaptive-fi.md) · [Validation](validation/a3-adaptive-fi.md) · [Graph](validation/a3-project-graph.md)
