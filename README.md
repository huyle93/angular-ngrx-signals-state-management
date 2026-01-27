# angular-ngrx-signals-state-management

<blockquote>
⚠️ <strong>Cutting-Edge Repository</strong> - This workspace uses the latest, most modern Angular features and libraries. All code follows Angular's newest best practices including zoneless applications, Signals, and modern testing frameworks.
</blockquote>

This is an Nx workspace that demonstrates state management in Angular using NgRx with Signals. This repository serves the purpose of experimental, educational, demo playground for exploring state management techniques, best-practices, and patterns in Angular applications.

## Workspace Structure

This project uses [Nx](https://nx.dev) for monorepo management with the following structure:

- **apps/**: Contains Angular applications (currently in development)
- **libs/**: Contains shared libraries and reusable code (to be added)
- **web-app/**: Desktop web application showcasing modern Angular state management

## Technology Stack

### Core Technologies

- **Nx**: v22.4.2 - Monorepo build system with advanced caching
- **Angular**: v21.1.1 - Latest web framework with Signals
- **TypeScript**: v5.9.3 - Strict mode enabled
- **Node.js**: 24.x - Runtime environment
- **npm**: 11.x - Package manager

### State Management

- **Signals**: Angular's modern reactivity system (`signal()`, `computed()`)
- **NgRx Store**: Redux-inspired state management (to be added)
- **Zoneless Angular**: Uses `provideExperimentalZonelessChangeDetection()` for better performance

### Testing & Quality

- **Vitest**: Modern, fast unit testing framework
- **@nx/vite**: Nx executor for Vitest
- **@analogjs/vite-plugin-angular**: Angular support for Vite/Vitest
- **ESLint**: v9.39.2 - Code linting
- **Prettier**: Code formatting

### Build & Development

- **esbuild**: Fast bundler for development and production
- **SCSS**: Styling preprocessor
- **Angular Devkit**: Official Angular build tools

### Key Features

✨ **Modern Angular Patterns**
- Standalone components (no NgModules)
- OnPush change detection strategy
- Modern control flow syntax (`@if`, `@for`, `@switch`)
- Signal-based reactivity

✨ **Developer Experience**
- Angular CLI MCP server integration
- Fast builds with esbuild
- Instant test feedback with Vitest
- Nx computation caching

## Development Setup

### Prerequisites

- Node.js 24.x or higher
- npm 11.x or higher

### Installation

```bash
npm install
```

### Available Commands

```bash
# Serve the web application
npx nx serve web-app
# Open http://localhost:4200/

# Build for production
npx nx build web-app

# Run tests with Vitest
npx nx test web-app

# Lint code
npx nx lint web-app

# View dependency graph
npx nx graph
```

## Applications

### web-app

Desktop web application demonstrating modern Angular state management patterns:

- **Home Page**: Overview of the technology stack
- **Counter Demo**: Simple signal-based state with `signal()` and `computed()`
- **Todo App**: Complex state management with multiple coordinated signals

**Features:**
- Zoneless change detection
- Signal-based reactivity
- OnPush strategy on all components
- Modern control flow (`@if`, `@for`)
- Standalone components
- Type-safe routing

## Current Status

✅ **Completed:**
- Nx workspace initialized
- web-app with three demo pages
- Signal-based state management examples
- Zoneless Angular configuration
- Vitest testing framework
- Modern build pipeline with esbuild

🚧 **In Progress:**
- Writing unit tests for components
- Adding NgRx Store examples

📋 **Planned:**
- NgRx Store integration
- Shared state libraries
- Advanced state patterns
- Performance optimizations

## Learning Resources

This repository demonstrates:

1. **Signal Patterns**: Using `signal()`, `computed()`, `effect()` for reactive state
2. **Zoneless Angular**: Better performance without zone.js overhead
3. **Modern Testing**: Vitest for fast unit tests
4. **Monorepo Management**: Nx for scalable architecture
5. **Best Practices**: Latest Angular coding standards and conventions

## License

ISC