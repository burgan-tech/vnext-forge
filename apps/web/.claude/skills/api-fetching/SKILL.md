---
name: api-fetching
description: Use when implementing or refactoring web API access in this repo. Web code must route requests through the shared Hono RPC client, keep transport details in `shared/api`, and remove raw `fetch` from pages, widgets, features, and entities.
---

# API Fetching Web

## Purpose

Use this skill to keep data access aligned with the target web architecture.

The intended flow is:

1. shared API client
2. slice service or action
3. optional hook
4. UI

## Repo Rules

- Use the shared Hono RPC client for web API access.
- Do not add raw `fetch` to route files, components, hooks, widgets, features, or entities.
- Keep transport details in `shared/api`.
- Keep feature meaning in the owning FSD slice.
- Return normalized success and error shapes before rendering code sees them.

## Placement Rules

- `shared/api`: RPC client, request helpers, transport normalization.
- `entities/*`: entity-specific reads, writes, and mappers that belong to one business concept.
- `features/*`: user-action flows that coordinate one or more entities.
- `widgets/*`: page-section composition only, not transport orchestration.
- `pages/*`: route assembly only, not endpoint logic.

## Do

- Keep request construction and response mapping near the owning slice.
- Convert transport output into feature-meaningful results.
- Use a hook only when a reusable UI-facing async contract is needed.
- Let UI consume scenario-named actions and derived state.
- Reuse shared package contracts where they already exist.

## Do Not Do

- Do not call endpoints directly from JSX or route components.
- Do not leak RPC or HTTP vocabulary into presentational props.
- Do not make widgets or pages decode raw response envelopes.
- Do not scatter endpoint strings across the app.
- Do not keep a legacy `fetch` call just because the surrounding file has not been migrated yet.

## Review Standard

Flag the implementation if:

- a component or page calls `fetch`
- request code lives in `pages` or `widgets` without a strong migration-only reason
- the UI must understand transport failures to render
- one feature invents a local response envelope that bypasses `ApiResponse<T>`
- services perform UI effects such as notifications or navigation
