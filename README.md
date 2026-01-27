# angular-ngrx-signals-state-management

This is an Nx workspace that demonstrates state management in Angular using NgRx with Signals.

## Workspace Structure

This project uses [Nx](https://nx.dev) for monorepo management with the following structure:

- **apps/**: Contains Angular applications
  - `mobile-app`: An Angular Ionic Capacitor application showcasing state management
  - `web-app`: An Angular web application demonstrating state management principles
- **libs/**: Contains shared libraries and reusable code

## Technology Stack

- **Nx**: v22.4.2 - Monorepo build system
- **Angular**: v19.x - Web framework
- **TypeScript**: v5.9.3 - Programming language
- **NgRx**: State management (to be added)
- **Signals**: Angular's reactivity system

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
# Generate a new Angular application
npx nx g @nx/angular:app <app-name>

# Generate a new Angular library
npx nx g @nx/angular:lib <lib-name>

# Build an application
npx nx build <app-name>

# Serve an application
npx nx serve <app-name>

# Run tests
npx nx test <app-name>

# Lint code
npx nx lint <app-name>

# View dependency graph
npx nx graph
```

## Next Steps

- Add sample Angular applications (web-app, mobile-app)
- Implement NgRx state management patterns
- Add Signal-based state management examples
- Create shared libraries for common functionality

## License

ISC