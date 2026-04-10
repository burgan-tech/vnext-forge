---
name: api-fetching
description: Use when implementing or refactoring web API access in this repo. Web code must route requests through the shared Hono RPC client and an owning service module; raw `fetch` and direct `apiClient` calls are forbidden in UI code.
---

# API Fetching Web

## Purpose

Use this skill to keep data access aligned with the simplified web architecture.

The intended flow is:

1. `shared/api/client.ts` -> Hono RPC client (`hc<AppType>('/')`) plus `callApi` and `unwrapApi`
2. owning service module -> usually module-local, wraps `callApi`, returns `Promise<ApiResponse<T>>`
3. `modules/*` hooks or actions -> orchestrate the user flow
4. UI -> consumes scenario-named actions and derived state

## Repo Rules

- Use the shared Hono RPC client for all web API access.
- Do not call `apiClient` directly from pages, components, or hooks.
- Keep direct `apiClient` calls in the owning service module, usually inside the module that owns the workflow.
- Lift service code into `shared/*` only when the same logic is truly generic and stable across multiple modules.
- Keep transport details (Hono RPC, `callApi`, `unwrapApi`) inside `shared/api` and owning service modules.
- Return `ApiResponse<T>` from service functions so `useAsync` can consume them without extra wrapping.
- All server responses are wrapped in `ApiResponse<T>` from `@vnext-forge/app-contracts`.
- Do not use raw `fetch` anywhere in the web app.
- Legacy `entities/*/api` locations are obsolete; new endpoint access belongs in the owning module service file.

## Helpers in `shared/api/client.ts`

```ts
// For use with useAsync; returns ApiResponse<T>
callApi<T>(response: Response | Promise<Response>): Promise<ApiResponse<T>>

// For imperative use outside useAsync; throws VnextForgeError on failure, returns T
unwrapApi<T>(response: Response | Promise<Response>, fallbackMessage?: string): Promise<T>
```

## Default Service Pattern

Keep the service close to the owning module unless it is clearly shared:

```ts
// modules/project-management/project-api.ts
import { apiClient, callApi } from '@shared/api/client';

export const projectApi = {
  list: () => callApi<ProjectInfo[]>(apiClient.api.projects.$get()),
  remove: (id: string) =>
    callApi<void>(apiClient.api.projects[':id'].$delete({ param: { id } })),
};
```

Hooks and actions consume the service. The `callApi` wrapping stays inside the service; the hook never touches `apiClient` or `callApi` directly:

```ts
// modules/project-management/use-project-management.ts
const { execute, data, loading, error } = useAsync(() => projectApi.list());

// Wrong: transport helpers must not appear at the call site
// const { execute } = useAsync(() => callApi(apiClient.api.projects.$get()));
```

If the same logic becomes truly generic across modules, move it into `shared/*` and keep the same contract.

Current owner examples:

- project CRUD, import, and listing -> `modules/project-management/project-api.ts`
- workspace tree and file operations -> `modules/project-workspace/workspace-api.ts`
- editor save or workflow save flows -> owning module service such as `modules/save-workflow/*` or `modules/code-editor/*`

## Response Handling

Every `callApi` call returns `ApiResponse<T>`. Use helpers from `@vnext-forge/app-contracts`:

- `isSuccess(res)` and `isFailure(res)` for type-safe branching
- `fold(res, onSuccess, onFailure)` for exhaustive handling
- `getData(res)` and `getError(res)` for safe field access
- `unwrap(res)` to throw `VnextForgeError` on failure
- `unwrapOr(res, fallback)` to return a fallback on failure

Failure branches must produce a `VnextForgeError`. Do not pass raw `ApiFailure` objects to UI.

## Placement Rules

- A module-owned request stays in that module by default.
- Shared transport stays in `shared/api/client.ts`.
- Only promote a service to `shared/*` when reuse is real and stable.
- Pages compose module APIs; they do not own transport code.
- `pages/*` route files should not become transport owners just because a request is route-scoped.

## Do

- Keep request code close to the module that owns the scenario.
- Name service functions by business intent, not HTTP verbs alone.
- Use `unwrapApi` for imperative flows that should throw on failure.
- Keep response-envelope knowledge out of presentational components.

## Do Not Do

- Do not centralize every request under `shared/*` by default.
- Do not place `apiClient` calls directly in JSX, page files, or ad hoc hooks.
- Do not create a second wrapper layer if one owning service file already keeps the code readable.
- Do not return raw `Response`, raw `fetch`, or raw backend payloads to UI code.

## Review Standard

Raise a concern when:

- a request was lifted into a separate layer without clear reuse
- UI code calls `apiClient`, `callApi`, or `fetch` directly
- service placement follows folder ideology instead of actual ownership
- a module-local API was spread across multiple files without improving clarity
