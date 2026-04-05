---
name: async-feature-flow-web
description: Use when shaping async UI flows in the web app. This repo uses `useAsync` as the shared async primitive; pair it with entity service functions that return `Promise<ApiResponse<T>>` for clean, type-safe async UI contracts.
---

# Async Feature Flow Web

## Purpose

Use this skill to design async UI flows around the shared `useAsync` abstraction without turning it into mandatory ceremony.

## Repo Rules

- Use `useAsync` when a feature needs reusable loading/error state or scenario-named actions.
- Always pass a service function from `entities/*/api.ts` or `features/*/api.ts` into `useAsync`.
- Never call `apiClient` or `callApi` directly inside `useAsync` or a custom hook — the `callApi` wrapping belongs in the service layer, not at the call site.
- Entity and feature services return `Promise<ApiResponse<T>>` — this is exactly what `useAsync` expects.
- Normalize failures into `VnextForgeError` before they reach UI code. `useAsync` handles this automatically.

## Preferred Flow

```
1. shared/api/client.ts
     └─ callApi<T>() — wraps Hono RPC Response → Promise<ApiResponse<T>>

2. entities/*/api.ts  OR  features/*/api.ts
     └─ service — calls callApi, returns Promise<ApiResponse<T>>
        Use entities for single-concept calls, features for cross-entity or flow-owned calls

3. features/* or hooks
     └─ useAsync(() => entityApi.someMethod())
        useAsync(() => featureApi.someAction())

4. UI
     └─ { execute, data, loading, error } from useAsync
        error.toUserMessage().message for display
```

## useAsync Contract

```ts
type AsyncFunction<T, TArgs extends unknown[]> = (...args: TArgs) => Promise<ApiResponse<T>>;

useAsync(asyncFunction, options?) → { execute, retry, reset, loading, error, data, success }
```

- `execute(...args)` — triggers the async call, sets loading/error/data/success
- `retry()` — re-runs with the last arguments
- `reset()` — clears all state
- `error` is always `VnextForgeError | null`
- `data` is always `T | null`

## Typical Usage

```ts
// entities/project/api.ts
export const projectApi = {
  list: () => callApi<ProjectInfo[]>(apiClient.api.projects.$get()),
};

// features/project-management/hooks/useProjectList.ts
export function useProjectList() {
  const { execute, data, loading, error } = useAsync(() => projectApi.list());

  useEffect(() => { execute(); }, [execute]);

  return { projects: data ?? [], loading, error };
}

// UI
const { projects, loading, error } = useProjectList();
```

## Use a Hook When

- one feature flow needs reusable loading and error handling
- the UI needs derived booleans or scenario-named actions
- success or failure causes local side effects owned by the feature
- multiple consumers need the same async lifecycle semantics

## Keep It Out Of a Hook When

- the work is synchronous
- the logic is a one-off local interaction
- the page can call an entity service or `execute` directly without losing clarity
- the hook would only wrap one function and re-export the same transport vocabulary

## Do

- Pass entity or feature service functions into `useAsync` — the service owns the `callApi` wrapping, not the hook or component.
- Build on `useAsync` instead of inventing a parallel async pattern.
- Return scenario names instead of transport names from hooks.
- Keep UI declarative: bind to `data`, `loading`, `error`.
- Surface errors as `VnextForgeError`; use `toUserMessage()` at the render edge.
- Use `options.onSuccess` / `options.onError` for side effects (navigation, notifications) — keep them out of services.

## Do Not Do

- Do not call `apiClient` or `callApi` directly inside `useAsync` or a hook — go through a service function in `entities/*/api.ts` or `features/*/api.ts`. The `callApi` wrapping is the service's responsibility.
- Do not introduce a second async primitive next to `useAsync`.
- Do not use `useAsync` just to standardize loading state where local state is simpler.
- Do not let components inspect raw `ApiResponse<T>` envelopes.
- Do not return `ApiFailure` or raw `Error` from a hook — `useAsync` normalizes to `VnextForgeError`.
- Do not put notifications or navigation in entity services — use `onSuccess`/`onError` callbacks.

## Review Standard

Flag the implementation if:

- `apiClient` or `callApi` is called directly inside `useAsync` or a custom hook instead of through a service function
- a second generic async abstraction appears next to `useAsync`
- a hook merely re-exports transport behavior
- `useAsync` is used where no meaningful reuse or UI contract exists
- JSX branches on backend or transport details
- feature async logic leaks into pages or widgets
- `error.message` is rendered directly instead of `error.toUserMessage().message`
