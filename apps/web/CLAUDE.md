# apps/web - Context

`apps/web` is the web client of vnext-forge. The standalone product framing belongs to the monorepo/product as a whole, not to `apps/web` as an isolated application.

## Goal

Build and evolve the web app as the primary workflow authoring interface. In the first phase, its main role is workflow design and code editing: project/workspace management, visual flow editing, component/code editors, and validation-oriented UX. It should not be framed as the place that boots or runs the external runtime.

## Direction

The current web app will be modularized under the new architecture. Move toward clear boundaries, thinner composition layers, reusable domain packages, and isolated UI responsibilities. Prefer extracting durable logic into shared packages or well-bounded modules instead of expanding page-level or route-level coupling.

## Expectation

When working in `apps/web`, optimize for a maintainable product-facing web client: strong UX, explicit boundaries, predictable state, package-first reuse, and architecture-safe incremental migration.

## Rules

Detailed implementation rules, slice constraints, and architecture-specific conventions should be referenced from dedicated rule documents once finalized.

- If a component is needed, check `shared/ui` first and use it from there when it already exists.

## API Access

All server communication goes through the Hono RPC client in `shared/api/client.ts`.

**The intended call chain is:**

```
shared/api/client.ts  (apiClient, callApi, unwrapApi)
  → entities/*/api.ts (entity service — callApi wraps the RPC call, returns Promise<ApiResponse<T>>)
  → features/* or hooks (useAsync(() => entityApi.method()))
  → UI (data, loading, error)
```

- `callApi<T>(response)` — converts Hono RPC `Response` to `Promise<ApiResponse<T>>`. Use as the async function passed to `useAsync`.
- `unwrapApi<T>(response)` — throws `VnextForgeError` on failure, returns `T` directly. For imperative use outside `useAsync`.
- Do not call `apiClient` directly from features, hooks, widgets, pages, or components. Place all `apiClient` calls in `entities/*/api.ts`.
- Do not use raw `fetch` anywhere in the web app.

## Async UI Flows

Use the shared `useAsync` hook (`shared/hooks/useAsync.ts`) for reusable async UI contracts.

- Pass entity service functions into `useAsync` — they return `Promise<ApiResponse<T>>` which is the expected signature.
- `useAsync` normalizes failures to `VnextForgeError` automatically.
- Use `options.onSuccess` / `options.onError` for side effects like navigation or notifications — keep these out of services.
- Do not invent a second async primitive alongside `useAsync`.

## Error Handling

- All errors are `VnextForgeError` from `@vnext-forge/app-contracts`.
- Use `error.toUserMessage().message` in UI — never raw `error.message`.
- Use `error.code` to branch behavior; never branch on message strings.
- `traceId` must be preserved when present.

## Logging

- In `apps/web`, do not use raw `console.log`, `console.info`, `console.warn`, or `console.error` in application code.
- Use the shared logger under `@shared/lib/logger` instead.
- Create a scoped logger with `createLogger('ScopeName')` once per module/component boundary and reuse that instance for all log calls.
- Do not call `createLogger(...)` inside hot paths or before every `debug/info/warn/error` call.
- Direct `console.*` usage is reserved for the shared logger implementation only.
