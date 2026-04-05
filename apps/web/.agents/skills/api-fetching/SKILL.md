---
name: api-fetching
description: Use when implementing or refactoring web API access in this repo. Web code must route requests through the shared Hono RPC client and entity-level service functions; raw `fetch` and direct `apiClient` calls are forbidden outside `entities/*/api.ts`.
---

# API Fetching Web

## Purpose

Use this skill to keep data access aligned with the target web architecture.

The intended flow is:

1. `shared/api/client.ts` — Hono RPC client (`hc<AppType>('/')`) + `callApi` / `unwrapApi` helpers
2. `entities/*/api.ts` — entity-level service: wraps `callApi`, returns `Promise<ApiResponse<T>>`
3. `features/*/` — user-action flows that call entity services, use `useAsync`
4. UI — consumes scenario-named actions and derived state

## Repo Rules

- Use the shared Hono RPC client for all web API access.
- Do not call `apiClient` directly from pages, widgets, components, or hooks.
- All direct `apiClient` calls live in `entities/*/api.ts` or `features/*/api.ts`.
  - Use `entities/*/api.ts` for calls that belong to a single business concept.
  - Use `features/*/api.ts` for calls that span multiple entities or are tightly tied to one user-action flow.
- Keep transport details (Hono RPC, `callApi`, `unwrapApi`) inside `shared/api`, entity service files, and feature service files.
- Return `ApiResponse<T>` from entity and feature service functions so `useAsync` can consume them without extra wrapping.
- All server responses are wrapped in `ApiResponse<T>` from `@vnext-forge/app-contracts`.

## Helpers in `shared/api/client.ts`

```ts
// For use with useAsync — returns ApiResponse<T>
callApi<T>(response: Response | Promise<Response>): Promise<ApiResponse<T>>

// For imperative use outside useAsync — throws VnextForgeError on failure, returns T
unwrapApi<T>(response: Response | Promise<Response>, fallbackMessage?: string): Promise<T>
```

## Entity Service Pattern

Each business concept owns an `api.ts` file in its entity slice:

```ts
// entities/project/api.ts
import { apiClient, callApi } from '@shared/api/client';

export const projectApi = {
  list: () => callApi<ProjectInfo[]>(apiClient.api.projects.$get()),
  getById: (id: string) => callApi<ProjectInfo>(apiClient.api.projects[':id'].$get({ param: { id } })),
  create: (body: CreateProjectDto) => callApi<ProjectInfo>(apiClient.api.projects.$post({ json: body })),
  remove: (id: string) => callApi<void>(apiClient.api.projects[':id'].$delete({ param: { id } })),
};
```

Features and hooks then consume the entity service. The `callApi` wrapping stays inside the service — the hook never touches `apiClient` or `callApi` directly:

```ts
// features/project-management/hooks/useProjectList.ts
// CORRECT — service owns the callApi wrapping
const { execute, data, loading, error } = useAsync(() => projectApi.list());

// WRONG — callApi/apiClient must not appear at the call site
// const { execute } = useAsync(() => callApi(apiClient.api.projects.$get()));
```

## Response Handling

Every `callApi` call returns `ApiResponse<T>`. Use helpers from `@vnext-forge/app-contracts`:

- `isSuccess(res)` / `isFailure(res)` — type-narrowing guards
- `fold(res, onSuccess, onFailure)` — exhaustive two-branch handling
- `getData(res)` / `getError(res)` — safe field accessors
- `unwrap(res)` — throws `VnextForgeError` on failure
- `unwrapOr(res, fallback)` — returns fallback on failure

Failure branches must produce a `VnextForgeError`. Do not pass raw `ApiFailure` objects to UI.

## Placement Rules

- `shared/api`: RPC client, `callApi`, `unwrapApi`, transport normalization only.
- `entities/*/api.ts`: endpoint calls that belong to one business concept.
- `features/*/api.ts`: endpoint calls that span entities or are owned by one user-action flow.
- `features/*`: user-action flows that consume entity or feature services via `useAsync`.
- `widgets/*`: page-section composition only, not transport orchestration.
- `pages/*`: route assembly only, not endpoint logic.

## Do

- Place all `apiClient` calls inside `entities/*/api.ts` or `features/*/api.ts`.
- Return `Promise<ApiResponse<T>>` from entity and feature service functions so they plug directly into `useAsync`.
- Use `unwrapApi` only in imperative contexts outside `useAsync` (e.g. init scripts, event handlers that don't need loading state).
- Convert `ApiResponse<T>` into feature-meaningful results using the provided helpers.
- Reuse shared package helpers where they already exist.

## Do Not Do

- Do not call `apiClient` or `callApi` directly from JSX, hooks, widgets, or pages — these belong exclusively in service files (`entities/*/api.ts` or `features/*/api.ts`).
- Do not inline `callApi(apiClient.xxx)` at the `useAsync` call site; move it into the service layer first.
- Do not use raw `fetch` anywhere in the web app.
- Do not leak RPC or HTTP vocabulary into presentational props.
- Do not make widgets or pages decode raw `ApiResponse<T>` envelopes.
- Do not scatter endpoint definitions across the app — one entity, one `api.ts`.
- Do not manually check `res.success` when a helper covers the pattern.

## Review Standard

Flag the implementation if:

- `apiClient` is called outside `entities/*/api.ts` or `features/*/api.ts` (pages, widgets, hooks, components — all forbidden)
- a component or page calls `fetch` directly
- request code lives in `pages` or `widgets` without a migration-only reason
- the UI must understand transport failures to render
- one feature invents a local response envelope that bypasses `ApiResponse<T>`
- services perform UI effects such as notifications or navigation
- `ApiFailure` reaches JSX without being normalized into `VnextForgeError`
