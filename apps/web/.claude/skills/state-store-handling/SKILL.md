---
name: state-store-handling-web
description: Use when deciding where web state belongs during the architecture refactor. Prefer the narrowest owner, place shared state in the owning FSD slice, and use `useAsync` when a reusable async hook contract is actually needed.
---

# State Store Handling Web

## Purpose

Use this skill to place state by ownership, lifetime, and FSD slice.

## Decision Order

1. Who reads this state
2. How long it must live
3. Which slice owns the decision
4. Whether it must survive navigation or reload

## Default Owners

- Component state: local view state owned by one component
- Page or feature hook state: route-local or flow-local async and UI state
- Slice model state: shared state inside one `entity`, `feature`, or `widget`
- App state: rare cross-route state such as session, shell, or workspace-wide coordination

## Repo Rules

- Use `useAsync` when multiple screens or components benefit from the same async lifecycle contract.
- Put shared state in the owning slice's `model/` directory.
- Keep request lifecycle state local unless multiple screens truly need it.
- Move only durable results upward, not transient loading or error flags.
- Keep app-wide stores narrow and intentional.

## Good Fits For Shared Store State

- session-like app state
- workspace selection reused across distant areas
- long-lived client state owned by one entity or feature
- coordination state with several real consumers in the same slice

## Keep Local

- loading, retry, and submit lifecycle state
- temporary form drafts unless they must survive route changes
- modal visibility, tabs, hover state, and one-page filters
- derived values that can be recomputed cheaply
- runtime objects such as refs, controllers, observers, and timers

## Use `useAsync` For

- reusable loading, error, and retry behavior in the same feature area
- async hooks that need a stable UI-facing contract across multiple consumers
- request flows where the feature should expose derived async state instead of transport details

## Do Not Use `useAsync` For

- one-off local interactions that are clearer with plain component state
- purely synchronous logic
- app-wide stores whose real problem is ownership rather than async orchestration

## Do

- Start local and promote only with a concrete ownership reason.
- Introduce `useAsync` only when reuse or consistency is real, not speculative.
- Name actions by user or domain intent.
- Keep stores small and slice-shaped.
- Separate durable domain data from temporary view flags.
- Remove global state when migration reveals a narrower owner.

## Do Not Do

- Do not create app-wide stores for page-only async state.
- Do not mirror the same value in local state and shared state.
- Do not keep transport or request mechanics in a global store.
- Do not wrap every request in `useAsync` by default.
- Do not use a store only to avoid shallow prop passing.
- Do not mix unrelated concerns in one large store.

## Review Standard

Flag the implementation if:

- temporary state survives longer than the owning screen or feature
- a store spans multiple concerns with no clear slice owner
- loading and error flags are global without a real product need
- `useAsync` is added where plain local state would be simpler
- a model folder is missing even though shared slice state clearly exists
