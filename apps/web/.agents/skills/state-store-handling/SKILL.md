---
name: state-store-handling-web
description: Use when deciding where web state belongs during the architecture refactor. Prefer the narrowest owner, keep state close to the module that owns it, and use `useAsync` only when a reusable async hook contract is actually needed.
---

# State Store Handling Web

## Purpose

Use this skill to place state by ownership, lifetime, and slice responsibility without adding extra structure by reflex.

## Decision Order

1. Who reads this state
2. How long it must live
3. Which module or page owns the decision
4. Whether it must survive navigation or reload

## Default Owners

- Component state: local view state owned by one component
- Module hook or module store state: route-local or flow-local async and UI state
- Shared slice state: durable state reused inside one owning module or, if truly needed, shared infrastructure
- App state: rare cross-route state such as session, shell, or workspace-wide coordination

## Repo Rules

- Use `useAsync` when multiple screens or components benefit from the same async lifecycle contract.
- Keep shared state in the owning folder by default; a file such as `project-list.store.ts` or `use-project-list.ts` is enough.
- Do not create a `model/` folder by reflex.
- Keep request lifecycle state local unless multiple screens truly need it.
- Move only durable results upward, not transient loading or error flags.
- Keep app-wide stores narrow and intentional.

## Good Fits For Shared Store State

- session-like app state
- workspace selection reused across distant areas
- long-lived client state owned by one module
- coordination state with several real consumers in the same owner

## Keep Local

- loading, retry, and submit lifecycle state
- temporary form drafts unless they must survive route changes
- modal visibility, tabs, hover state, and one-page filters
- derived values that can be recomputed cheaply
- runtime objects such as refs, controllers, observers, and timers

## Use `useAsync` For

- reusable loading, error, and retry behavior in the same module area
- async hooks that need a stable UI-facing contract across multiple consumers
- request flows where the module should expose derived async state instead of transport details

## Do Not Use `useAsync` For

- one-off local interactions that are clearer with plain component state
- purely synchronous logic
- app-wide stores whose real problem is ownership rather than async orchestration

## Do

- Start local and promote only with a concrete ownership reason.
- Introduce `useAsync` only when reuse or consistency is real, not speculative.
- Name actions by user or domain intent.
- Keep stores small and owner-shaped.
- Separate durable domain data from temporary view flags.
- Remove global state when migration reveals a narrower owner.

## Do Not Do

- Do not create app-wide stores for page-only async state.
- Do not mirror the same value in local state and shared state.
- Do not keep transport or request mechanics in a global store.
- Do not wrap every request in `useAsync` by default.
- Do not use a store only to avoid shallow prop passing.
- Do not mix unrelated concerns in one large store.
- Do not split a small module into `model`, `hooks`, and `types` folders unless navigation has actually become hard.

## Review Standard

Raise a concern when:

- state was extracted into extra folders or layers without a clear ownership need
- transient request state was promoted into a shared store without real reuse
- app-wide state was introduced for a route-local problem
- the code hides a simple owner behind multiple abstractions
