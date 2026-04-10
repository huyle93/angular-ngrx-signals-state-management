# AI Coding Task Instructions — Business Events Architecture

## 1) Purpose

This document is the implementation guide and mental model for the AI coding agent.

The goal is to implement a **clean, scalable, event-driven business-events architecture** for an Angular 21+ zoneless app using **Signals** and **NgRx Signals latest**, while preserving the current domain-driven SignalStore architecture.

The implementation must optimize for the following priorities, in order:

1. **Clean code space**
2. **Event-driven architecture for business events**
3. **Scalability and modularity of events**
4. **Performance**

---

## 2) Business Requirement First

Before implementing any code, understand the desired business outcome.

This architecture is **not** for generic telemetry clicks or low-level UI tracking.
This architecture is for **business-success events** and **business facts** such as:

* user linked a bank
* user completed a deposit
* user deposited more than a threshold
* user placed a trade
* user placed their first trade

These business events may later be consumed by:

* analytics
* telemetry
* martech systems
* tenant-specific integrations
* product milestone logic
* future automation and reporting

The architecture must therefore be:

* **business-first**
* **vendor-agnostic**
* **multi-tenant friendly**
* **minimal in per-domain boilerplate**

Do **not** design the system around Adobe, MoEngage, Branch, or any individual analytics vendor.
Those are downstream consumers, not the source of truth.

---

## 3) High-Level Architecture Decision

### Final architecture direction

Use **NgRx Signals Events** as a **shared business-events platform**, not as a Redux/Flux pattern to spread across every domain store.

### Architectural intent

* Keep existing **domain SignalStores** focused on domain state and domain logic
* Add only **tiny event emission** at the domain truth boundary
* Centralize **event processing**, **milestone derivation**, and **analytics routing** in a shared platform layer
* Keep vendor-specific mapping out of business domains

### Core model

**Domain emits raw business facts** -> **Central business-events platform derives milestones and routes them** -> **Analytics/telemetry adapters send to downstream systems**

---

## 4) Non-Goals

Do **not** implement the following:

* Do not turn each domain into a mini Redux module with heavy reducer/effects boilerplate
* Do not put analytics vendor logic inside business domains
* Do not use business-events as a general-purpose cross-domain event bus for all app communication
* Do not duplicate event interpretation logic in each domain
* Do not couple event names to Adobe, MoEngage, Branch, or tenant-specific vendor terminology
* Do not mirror full domain state into the business-events platform

---

## 5) Angular + NgRx Technical Ground Rules

### Angular requirements

* Angular **21+**
* **Zoneless-first** mental model
* **Signals-first** state and rendering
* Standalone APIs only
* Prefer signal-driven templates and logic
* Prefer explicit reactive state over ad hoc mutation

### NgRx requirements

Use latest stable NgRx Signals capabilities where appropriate:

* SignalStore
* NgRx Signals Events
* Custom SignalStore Features (CSF) where they create shared reusable value
* Keep store composition modular and low-noise

### TypeScript requirements

* Strict typing only
* No `any`
* Prefer exact payload types for business events
* Use narrow event contracts
* Optimize for readability and long-term maintainability

---

## 6) Architectural Principles

### Principle 1 — Business facts first

Domains emit **facts**, not interpretations.

Good:

* `depositCompleted`
* `tradeCompleted`
* `linkSucceeded`

Avoid in domain code:

* `depositOver10Tracked`
* `firstTradeAdobeConversion`
* `moengageBankLinked`
* `branchTradeEvent`

Interpretation belongs in the central business-events platform.

### Principle 2 — Smallest diff in each domain

Business domains should add as little new code as possible.

Ideal per-domain change:

1. import a shared event contract or emitter facade
2. emit one business fact at the truth boundary

That is it.

### Principle 3 — Centralize event interpretation

The following must live centrally, not in business domains:

* first-time logic
* threshold logic
* milestone derivation
* dedupe rules
* analytics routing
* tenant-specific event mapping

### Principle 4 — Vendor-agnostic source of truth

Canonical business events are the stable source of truth.
Vendors are downstream adapters.

### Principle 5 — Multi-tenant support by configuration and adapters

Keep shared business events consistent across tenants.
Allow tenant-specific routing and mapping later.
Do not fork domain event semantics per tenant unless the product behavior truly differs.

### Principle 6 — Performance-aware and zoneless-safe

Implementation must avoid unnecessary state churn, unnecessary signal writes, and overly broad reactive dependencies.

---

## 7) Recommended Library Structure

Use a shared platform library for business-events.

```txt
libs/shared/business-events/
├── contracts/
│   ├── funding.events.ts
│   ├── trading.events.ts
│   ├── bank-link.events.ts
│   ├── milestone.events.ts
│   └── analytics.events.ts
├── core/
│   ├── business-events.service.ts
│   ├── business-events.store.ts
│   ├── business-event.types.ts
│   ├── business-event.context.ts
│   └── business-events.tokens.ts
├── processors/
│   ├── with-first-time-processors.ts
│   ├── with-threshold-processors.ts
│   ├── with-milestone-processors.ts
│   ├── with-dedupe-processors.ts
│   └── with-analytics-routing.ts
├── analytics/
│   ├── analytics.adapter.ts
│   ├── telemetry.service.ts
│   ├── vendor-router.ts
│   ├── adobe.adapter.ts
│   ├── moengage.adapter.ts
│   ├── branch.adapter.ts
│   └── tenant-analytics.registry.ts
├── config/
│   ├── tenant-analytics-config.ts
│   ├── app.analytics.config.ts
│   └── money-net.analytics.config.ts
└── util/
    ├── event-name.helpers.ts
    ├── payload.helpers.ts
    └── event-matchers.ts
```

### Why this structure

* Keeps event architecture as a platform capability
* Preserves domain-driven business libraries
* Supports reuse across tenants
* Supports future integrations without polluting domain code

---

## 8) Domain Integration Rules

### Domain responsibility

Each business domain SignalStore remains responsible for:

* domain state
* repository calls
* domain logic
* state transitions

### Domain event responsibility

Emit a business fact only when domain truth is confirmed.

Examples:

* bank link success after confirmed success
* deposit completed after confirmed completion
* trade completed after confirmed completion

### Domain truth boundary rule

A business event must be emitted at the point where the domain knows the business fact is true.

Do not emit success events from raw click handlers.
Do not emit success events before the business outcome is confirmed.

### Domain boilerplate minimization rule

Prefer a single injected facade/service for emitting business events.
Avoid requiring every domain to directly manage multiple event dispatchers.

---

## 9) Event Contract Rules

### Canonical event contract style

Use typed event groups with clear domain ownership.

Examples of raw fact event names:

* `funding.depositCompleted`
* `trading.tradeCompleted`
* `bankLink.linkSucceeded`

Examples of derived milestone names:

* `funding.depositOverThresholdCompleted`
* `trading.firstTradeCompleted`
* `bankLink.firstLinkCompleted`

### Naming rules

* Use domain-first naming
* Prefer past-tense completion or success for confirmed outcomes
* Keep names stable and business-oriented
* Avoid vendor-specific words in canonical event names

### Payload rules

* Payloads must be small, typed, and business-relevant
* Include only fields needed for downstream processing
* Avoid UI-only noise
* Avoid optional ambiguity when exact contracts are better

### Example payload intent

Good:

* accountId
* amount
* currency
* orderId
* symbol
* provider

Avoid unless truly needed:

* view-only UI flags
* temporary component state
* vendor-specific keys

---

## 10) Recommended Emission API

To minimize per-domain noise, provide a shared facade service.

### Intent

Business domains should call something like:

```ts
businessEvents.fundingDepositCompleted(payload)
businessEvents.tradingTradeCompleted(payload)
businessEvents.bankLinkSucceeded(payload)
```

### Why

* keeps domain code clean
* hides NgRx events dispatch details
* reduces boilerplate
* keeps implementation swappable if needed later

The facade internally can use `injectDispatch(...)` and canonical event groups.

---

## 11) Central Business-Events Platform

Create one shared platform processor layer that reacts to raw business facts.

### Responsibilities

* listen to raw fact events
* derive milestone events
* apply threshold rules
* apply first-time logic
* dedupe when needed
* route to analytics adapters
* add shared event context when needed

### Important boundary

The platform is **not** a mirror of application business state.
It is a processor and orchestrator for business events.

---

## 12) Recommended Use of Custom SignalStore Features (CSF)

### Yes, use CSF where it provides reusable value

Use Custom SignalStore Features in the shared business-events platform for reusable processors such as:

* `withFirstTimeProcessors()`
* `withThresholdProcessors()`
* `withMilestoneProcessors()`
* `withDedupeProcessors()`
* `withAnalyticsRouting()`

### No, do not force CSF into every business domain

CSF is valuable here only when it packages reusable platform logic.
It should not be used to reintroduce ceremony into every domain store.

### Rule of thumb

If a feature is shared across many event types or tenants, CSF is a good fit.
If it only adds local noise to a single domain, avoid it.

---

## 13) Central Platform State Rules

Keep platform state minimal.

### Allowed platform state examples

* milestone completion memory
* first-time event memory
* dedupe windows
* event-processing context

### Forbidden platform state examples

* trading page view state
* account balances
* full domain entities
* temporary form state

### State design rule

Only store data required to safely derive or route business events.
Do not duplicate domain state.

---

## 14) Multi-Tenant Rules

This business-events platform must support multiple tenants / whitelabel apps.

### Shared across tenants

* canonical business event contracts
* milestone derivation concepts
* routing abstractions

### Tenant-specific

* analytics routing config
* vendor adapters enabled
* event-to-vendor mapping
* optional downstream payload transformations

### Important rule

Do not create tenant-specific business event names unless product behavior truly differs.
Prefer shared canonical events plus tenant-specific routing and adapter config.

---

## 15) Analytics and Telemetry Flexibility

The architecture must support multiple downstream consumers.
Examples:

* Adobe Analytics
* MoEngage
* Branch
* future analytics providers
* custom tenant-specific integrations

### Rules

* business-events platform must remain vendor-agnostic
* use adapters/interfaces for downstream delivery
* use tenant config or registry to determine routing
* keep downstream payload mapping outside domains

### Adapter rule

Each adapter should consume canonical business events or derived milestone events, then map them to vendor-specific shapes.

---

## 16) Performance Guidance

Performance is important, but it is the fourth priority after clean code, event-driven design, and scalability.

### Performance requirements

* avoid unnecessary signal writes
* avoid broad reactive dependencies
* keep processor state minimal
* avoid duplicate event emissions
* avoid duplicate interpretation in many places
* centralize expensive event logic instead of repeating it in domains

### Zoneless guidance

Implementation must be compatible with Angular zoneless mental model:

* use signals and explicit Angular reactivity correctly
* do not rely on ZoneJS-based assumptions
* keep reactivity explicit and predictable
* avoid patterns that depend on implicit global change detection behavior

### Template guidance

* keep UI components free from business event orchestration
* do not emit business-success events directly from presentational templates

---

## 17) Implementation Order

When implementing, follow this order:

### Phase 1 — contracts and facade

1. create canonical business event contracts
2. create shared `BusinessEventsService` facade
3. wire one or two domains to emit raw business facts only

### Phase 2 — central platform

4. create central business-events platform store/feature
5. add milestone derivation processors
6. add first-time and threshold processors

### Phase 3 — downstream routing

7. add analytics adapter interfaces
8. add tenant analytics registry/config
9. add routing to downstream telemetry systems

### Phase 4 — polish

10. reduce boilerplate
11. tighten types
12. improve naming and folder organization
13. add focused tests for event emission and derived milestones

---

## 18) Quality Bar for the AI Coding Agent

The coding agent must:

* understand the business requirement before writing code
* preserve existing clean domain-driven SignalStore architecture
* avoid over-engineering
* minimize per-domain diff
* keep event semantics business-first
* prefer central reusable processing
* maintain strong types and clarity
* keep the codebase readable for future engineers

### The agent must not:

* introduce a global event free-for-all
* spread analytics logic into feature/ui layers
* create unnecessary store boilerplate in each domain
* reintroduce full Flux/Redux style patterns across the app
* optimize for a single vendor instead of the business model

---

## 19) Final Decision Summary

### Use

* Angular 21+ zoneless-safe patterns
* Signals-first mental model
* NgRx SignalStore in business domains
* NgRx Signals Events as shared business-events platform
* Custom SignalStore Features for reusable central processors
* shared emitter facade/service
* tenant-aware analytics routing via adapters/config

### Avoid

* Redux-style ceremony in every domain
* vendor-specific business event names
* duplicated milestone logic across domains
* heavy central app-state mirroring
* UI-level business-success event orchestration

---

## 20) Expected End State

After implementation, the architecture should look like this:

### Domains

* own state and business logic
* emit raw business facts with minimal code

### Shared business-events platform

* derives milestones
* applies reusable event logic
* routes to downstream analytics/telemetry

### Downstream integrations

* subscribe through adapters
* remain replaceable and tenant-aware

This is the target architecture.
The implementation should be clean, strongly typed, event-driven, scalable, and optimized for low code noise in business domains.
