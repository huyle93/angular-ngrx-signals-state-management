Acme Corporation Demo Build (WebView) - Spec Driven Development

Executive Context

Leadership has intentionally separated the initiative into two tracks:

Factory (Future)

Long-term White Label / Multi-Tenant Platform.

Examples:

* Tenant management
* Runtime tenant configuration
* Tenant-specific authentication
* Tenant-specific APIs
* Tenant-specific routing
* Tenant-specific content
* Tenant-specific feature flags
* Tenant operations tooling

This initiative is NOT part of the current effort.

⸻

Car (Now)

Immediate client-facing Acme Corporation branded application.

Objective:

Deliver a Acme Corporation branded application to TestFlight as quickly as possible.

Client is comfortable using:

* Existing Phoenix functionality
* Existing Phoenix authentication
* Existing Phoenix APIs
* Existing Phoenix backend
* Existing business logic

The primary goal is visual branding and executive/client demonstration.

⸻

Mission

Create a Acme Corporation branded version of the Phoenix WebView application.

Success means:

* App visually presents as Acme Corporation
* Core functionality remains unchanged
* Minimal engineering risk
* Minimal implementation time
* Preserves a clean path toward future White Label architecture

⸻

Business Goals

Primary Goal

Provide leadership and Acme Corporation a branded application that can be installed and evaluated in TestFlight.

Secondary Goal

Avoid creating throwaway demo code.

Implementation should serve as a potential foundation for future White Label efforts without over-engineering.

Constraints

* Derek owns native shell, deployment, app icon, splash screen, and TestFlight deployment.
* This effort is WebView only.
* Speed is the highest priority.
* Delivery target is effectively a 24-hour hackathon execution model.

⸻

Architecture Strategy

Smart-Fast Approach

Build a Thin Brand Layer.

Do NOT:

* Hardcode branding throughout the application
* Scatter color overrides across pages
* Build a full multi-tenant platform
* Build runtime tenant switching
* Build tenant infrastructure

Do:

* Centralize brand identity
* Centralize theme ownership
* Reuse existing PDS architecture
* Keep implementation small and reviewable

⸻

Architecture Principles

Principle 1

This is a branded build.

Not a tenant platform.

⸻

Principle 2

Brand ownership should be centralized.

Avoid:

page-a.scss
page-b.scss
page-c.scss

containing Acme Corporation-specific styling.

Prefer:

BrandConfig
BrandService
PDS Theme Layer

⸻

Principle 3

PDS owns design tokens.

Application owns:

* Active brand
* Logo
* Wordmark
* Display name

PDS owns:

* Color system
* Semantic tokens
* Token mapping
* Dark mode variants

⸻

Principle 4

Optimize for executive demo impact.

Visible branding is more important than architectural completeness.

⸻

Principle 5

A CSS boundary is worth a thousand component overrides.

Prefer:

body.brand-money-net {
  ...
}

over:

button.scss
card.scss
header.scss
...

⸻

Execution Plan

Phase 0 - Discovery (Required)

Goal:

Understand current architecture before modifying anything.

Deliverables

AI agent must generate a Brand Impact Report.

Identify:

1. Existing theme/token architecture
2. PDS token ownership hierarchy
3. App shell/root component
4. Logo and asset locations
5. Existing dark mode implementation
6. Visible pynk branding locations
7. Estimated files requiring modification

Output

Produce:

Brand Impact Report

before implementation begins.

⸻

Phase 1 - Brand Foundation

Goal:

Establish centralized brand identity.

Deliverables

Create:

libs/pynk-mobile/core/brand/

Files:

brand-config.model.ts
brand.service.ts
brand-config.pynk.ts
brand-config.money-net.ts

Example:

export interface BrandConfig {
  id: string;
  appName: string;
  displayName: string;
  logoAsset: string;
  wordmarkAsset?: string;
  themeClass: string;
}

Acme Corporation config:

export const MONEY_NET_BRAND_CONFIG: BrandConfig = {
  id: 'money-net',
  appName: 'Acme Corporation',
  displayName: 'Acme Corporation',
  logoAsset: 'assets/brands/money-net/logo.svg',
  wordmarkAsset: 'assets/brands/money-net/wordmark.svg',
  themeClass: 'brand-money-net',
};

BrandService:

@Injectable({ providedIn: 'root' })
export class BrandService {
  readonly brand = signal(MONEY_NET_BRAND_CONFIG);
}

Rules

* No runtime loading
* No HTTP
* No backend integration
* No tenant lookup
* No feature flags

Acceptance Criteria

* Brand model exists
* Brand service exists
* Acme Corporation config exists
* Branding information is centralized

⸻

Phase 2 - Theme System

Goal:

Transform Phoenix visual identity into Acme Corporation visual identity through token replacement.

⸻

Ownership

Theme implementation belongs inside:

shared/pds-styles

Do NOT dump theme implementation into:

apps/.../styles.scss

except for minimal imports.

⸻

Recommended Structure

shared/pds-styles/
  brands/
    _brand-pynk.scss
    _brand-money-net.scss
  _brand-theme.scss

⸻

Theme Activation

For speed and zero flicker:

Use static activation.

Example:

<body class="brand-money-net">

Reason:

* Dedicated Acme Corporation branch
* No runtime switching needed
* No flash of pynk branding
* Fastest implementation

⸻

Acme Corporation Token Strategy

Acme Corporation currently provides a limited brand palette.

Use their official primary blue as the source of truth.

Create derived tokens.

Example:

--brand-primary
--brand-primary-hover
--brand-primary-pressed
--brand-primary-soft

Map into PDS semantic tokens.

Example:

--pds-color-brand-primary
--pds-color-brand-primary-hover
--pds-color-brand-primary-pressed

Bridge into Ionic.

Example:

--ion-color-primary

⸻

Example Structure

body.brand-money-net {
  // source brand tokens
  --brand-primary: #0057ff;
  --brand-secondary: #0b1f3a;
  --brand-accent: #38bdf8;
  // derived tokens
  --brand-primary-hover: #004be0;
  --brand-primary-pressed: #003fbf;
  --brand-primary-soft: #eaf1ff;
  // PDS semantic mapping
  --pds-color-brand-primary: var(--brand-primary);
  --pds-color-brand-primary-hover: var(--brand-primary-hover);
  --pds-color-brand-primary-pressed: var(--brand-primary-pressed);
  // Ionic bridge
  --ion-color-primary: var(--brand-primary);
}

⸻

Dark Mode

Maintain existing dark mode.

Do not redesign dark mode.

Use:

body.brand-money-net.dark

or existing dark selectors.

Adjust only necessary brand tokens.

⸻

Acceptance Criteria

* Major application color system appears Acme Corporation
* Existing components inherit theme automatically
* Minimal component-level styling changes
* No visible flicker
* Dark mode remains functional

⸻

Phase 3 - Visible Branding Replacement

Goal:

Remove visible pynk identity.

⸻

Search

Run:

grep -R "pynk\|pynk\|pynk" apps libs

Classify findings.

⸻

Replace

Replace visible references:

* Logo
* Wordmark
* Welcome screens
* Login screens
* Onboarding
* Headers
* Page titles
* Empty states
* Visible legal/help references

⸻

Do Not Replace

Leave untouched:

* Package names
* Nx library names
* API routes
* Analytics events
* Backend identifiers
* Comments
* Internal documentation
* Tests

Unless user-visible.

⸻

Acceptance Criteria

Client should experience the application as Acme Corporation.

No obvious pynk branding should remain in user-facing experiences.

⸻

Out of Scope

Not allowed:

* Multi-tenant runtime switching
* Tenant management
* Tenant configuration APIs
* Tenant auth abstraction
* Consumer API abstraction
* Tenant routing
* Tenant content management
* Backend changes
* Native changes
* Feature flag framework changes
* White Label platform implementation

⸻

AI Agent Guardrails

Before implementation:

1. Inspect existing theme architecture.
2. Inspect PDS token hierarchy.
3. Inspect app shell/root component.
4. Inspect dark mode architecture.
5. Generate Brand Impact Report.

During implementation:

1. Prefer token mapping over component overrides.
2. Prefer centralized ownership.
3. Keep diff minimal.
4. Keep implementation reviewable.
5. Follow Angular signal-first architecture.
6. Respect Nx boundaries.
7. Avoid introducing technical debt.

⸻

Deliverables Checklist

Brand Foundation

* BrandConfig model
* pynk brand config
* Acme Corporation brand config
* BrandService

Theme System

* Acme Corporation theme file
* Theme registration
* PDS token mapping
* Ionic token bridge
* Dark mode support

Branding

* Logo replacement
* Wordmark replacement
* Visible text replacement
* Brand audit completed

Validation

* Main tabs verified
* Login flow verified
* Portfolio screens verified
* Watchlist verified
* Search verified
* Dark mode verified

⸻

Definition of Done

The build is successful when:

* Acme Corporation branding is clearly visible.
* Existing Phoenix functionality behaves unchanged.
* Existing Phoenix authentication behaves unchanged.
* Existing APIs behave unchanged.
* TestFlight deployment can proceed.
* No broad hardcoding exists.
* PDS remains token owner.
* Future White Label implementation remains possible.

⸻

Engineering Message

This implementation intentionally delivers:

A branded demo car, not the full White Label factory.

The solution optimizes for:

* Speed
* Executive visibility
* Client validation
* Low implementation risk

while preserving a future migration path toward a true multi-tenant platform.