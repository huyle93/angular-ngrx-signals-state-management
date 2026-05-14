<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# Agent Guidelines

## Nx Commands

- Always run tasks through `nx` (e.g., `pnpm nx test`, `npm exec nx build`)
- Use `nx-workspace` skill to explore workspace structure
- Use `nx-generate` skill for scaffolding tasks
- Check `nx_docs` or `--help` before using unfamiliar flags

## Available Tasks

```bash
pnpm nx serve web-app        # Dev server at localhost:4200
pnpm nx build web-app        # Production build
pnpm nx lint web-app         # ESLint
pnpm nx test web-app         # Vitest (inferred via @nx/vitest)
pnpm nx graph                # Dependency visualization
```

## Angular 21 Conventions

- **Zoneless**: Use `provideZonelessChangeDetection()` in `app.config.ts`
- **Standalone**: No NgModules; use `standalone: true` and `imports: []`
- **Control flow**: Use `@if`, `@for`, `@switch` (not `*ngIf`, etc.)
- **Signals**: Use `signal()`, `computed()`, `effect()` for state; never mutate directly
- **Testing**: Vitest with Angular TestBed; tests are co-located as `*.spec.ts`

## What NOT to Use

- NgModules, zone.js, `*ngIf`/`*ngFor`, Jest, barrel files (`index.ts`)

## Documentation

- `docs/` - human learning (concepts, guides, patterns)
- `.github/copilot-instructions.md` - code generation rules
- `.github/skills/` - agent task skills

<!-- nx configuration end-->
