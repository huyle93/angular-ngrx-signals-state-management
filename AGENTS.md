<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# Agent Guidelines

## Nx Commands

- Always run tasks through `nx` (e.g., `npx nx test`, `npm exec nx build`)
- Use `nx-workspace` skill to explore workspace structure
- Use `nx-generate` skill for scaffolding tasks
- Check `nx_docs` or `--help` before using unfamiliar flags

## Available Tasks

```bash
npx nx serve web-app        # Dev server at localhost:4200
npx nx build web-app        # Production build
npx nx lint web-app         # ESLint
npx nx test web-app         # Vitest (inferred via @nx/vitest)
npx nx graph                # Dependency visualization
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
- `AGENTS.md` - agent rules (this file); `docs/guides/agent-coding-standards.md` - code templates
- `.github/skills/` - agent task skills

## Commit Hygiene

No app/brand names, business-specific naming, or external-context content in any committed
file, doc, or commit message. Enforcement: `.githooks/` pre-commit/commit-msg scan against
the gitignored deny-list `external-context/forbidden-terms.pattern` (installed via the
`prepare` npm script). If the hook blocks you, reword to neutral naming
(e.g. `example app`, `mobile-app`); never use `--no-verify`. Never commit the deny-list
itself — it contains the forbidden terms.

<!-- nx configuration end-->

## Project Overview

Nx monorepo demonstrating state management with Angular Signals and NgRx:
Angular 21 (zoneless), TypeScript strict, Vitest, SCSS. Also a local workspace for
the owner's external app experiments.

## Workspace Rules

- Buildable code lives in `apps/` and `libs/`. Domain library projects must not import
  one another; experience wrappers compose domains.
- `external-context/` is gitignored. External app context (app names, business naming,
  project material) stays on the local machine and must never be committed anywhere in
  this repo — code, docs, or commit messages.
- `docs/` is human-learning material; `.github/skills/` are agent task skills readable
  by all agents.

## Coding Standards (Hard Rules)

- Standalone components only (no NgModules); `provideZonelessChangeDetection()` in
  `app.config.ts`; `ChangeDetectionStrategy.OnPush` on every component.
- Control flow: `@if`, `@for`, `@switch` — never `*ngIf`/`*ngFor`/`*ngSwitch`.
- Signals for state: `signal()`, `computed()`, `effect()`, `toSignal()`;
  `input()`/`output()` (Angular 21+). Never mutate a signal directly (use
  `.set()`/`.update()`).
- Tests: Vitest (never Jest), co-located `*.spec.ts`, TestBed with zoneless setup.
- TypeScript strict mode; no `any`; prefer `protected readonly` for template-facing
  members; SCSS styles with `:host` for the component root.
- Naming: `example.component.ts` / `example.component.spec.ts`; `app.routes.ts`;
  `app.config.ts`; no barrel `index.ts` files.
- Code templates and expanded conventions: `docs/guides/agent-coding-standards.md`.

## Agent Guidance

| Need                            | Where                                                 |
| ------------------------------- | ----------------------------------------------------- |
| Commands, workspace structure   | this file, `nx-workspace` skill                       |
| Component / test code templates | `docs/guides/agent-coding-standards.md`               |
| Concepts, patterns, decisions   | `docs/concepts/`, `docs/patterns/`, `docs/decisions/` |
| Task skills                     | `.github/skills/`                                     |
| Commit rules                    | Commit Hygiene (below) and `.githooks/`               |

## Commit Hygiene

No app/brand names, business-specific naming, or external-context content in any committed
file, doc, or commit message. Enforcement: `.githooks/` pre-commit/commit-msg scan against
the gitignored deny-list `external-context/forbidden-terms.pattern` (installed via the
`prepare` npm script). If the hook blocks you, reword to neutral naming
(e.g. `example app`, `mobile-app`); never use `--no-verify`. Never commit the deny-list
itself — it contains the forbidden terms.

## A3 adaptive FI slice

Use npm and the checked-in package-lock. Read [the local task](docs/specs/a3-adaptive-fi.md), [ADR](docs/decisions/ADR-A3-adaptive-fi.md), and [run guide](docs/guides/adaptive-fi.md). No private source access is needed.

`apps/mobile-reference` is an Ionic **browser** reference on port 4300; `web-app` remains the web entrypoint. `/fi/:symbol` resolves a different composition per app. `libs/fi/instrument` owns FI models/state/UI; `libs/fi/trading/{feature,ui,util,data-access}` separate presentation hosts, form UI, pure contracts and the host-scoped draft. Experience wrappers compose domains; domain projects must not import one another. `libs/fi/design` owns public visual foundations and reusable layout primitives only; experiences choose patterns and content-fit budgets. `eslint.config.cjs` is the canonical lint/boundary config. No viewport/theme flags in domain stores.

Validate both builds, all affected lint/test targets, and `npx nx run instrument-data-access:boundary-check`; see the guide for the complete command. Record real results in `docs/validation/`. Keep synthetic data and original visuals only. No native, tenant-security, trading or production claim. A3 is an experiment pending human review, not permission to rename/publish/merge.
