---
name: async-feature-flow-web
description: Use when shaping async UI flows in the web app. This repo uses `useAsync` as the shared async primitive; pair it with owning service functions that return `Promise<ApiResponse<T>>` for clean, type-safe async UI contracts.
---

# Async Feature Flow Web

## Purpose

Use this skill to design async UI flows around the shared `useAsync` abstraction without turning it into mandatory ceremony.

## Repo Rules

- Use `useAsync` when a module needs reusable loading or error state, retry behavior, or scenario-named actions.
- Pass an owning service function into `useAsync`, usually from the module that owns the flow.
- Only lift that service into `shared/*` when the same logic is truly generic across multiple modules.
- Never call `apiClient` or `callApi` directly inside `useAsync` or a custom hook; the transport wrapping belongs in the owning service module.
- Service functions passed to `useAsync` return `Promise<ApiResponse<T>>`, which is the expected contract.
- Normalize failures into `VnextForgeError` before they reach UI code. `useAsync` handles this automatically.

## Preferred Flow

```text
1. shared/api/client.ts
   -> callApi<T>() wraps Hono RPC Response to Promise<ApiResponse<T>>

2. owning service module
   -> usually module-local
   -> calls callApi and returns Promise<ApiResponse<T>>

3. module hook or action
   -> useAsync(() => moduleApi.someMethod())

4. UI
   -> consumes { execute, data, loading, error }
   -> renders error.toUserMessage().message
```

## useAsync Contract

```ts
type AsyncFunction<T, TArgs extends unknown[]> =
  (...args: TArgs) => Promise<ApiResponse<T>>;

useAsync(asyncFunction, options?) -> { execute, retry, reset, loading, error, data, success }
```

- `execute(...args)` triggers the async call and updates loading, error, data, and success
- `retry()` re-runs with the last arguments
- `reset()` clears all state
- `error` is always `VnextForgeError | null`
- `data` is always `T | null`

## Typical Usage

```ts
// modules/project-list/project-list.api.ts
export const projectListApi = {
  list: () => callApi<ProjectInfo[]>(apiClient.api.projects.$get()),
};

// modules/project-list/use-project-list.ts
export function useProjectList() {
  const { execute, data, loading, error } = useAsync(() => projectListApi.list());

  useEffect(() => {
    execute();
  }, [execute]);

  return { projects: data ?? [], loading, error };
}
```

If that API later becomes truly generic, move the service to `shared/*` without changing the `useAsync` contract.

## Use A Hook When

- one module flow needs reusable loading and error handling
- the UI needs derived booleans or scenario-named actions
- success or failure causes local side effects owned by the module
- multiple consumers need the same async lifecycle semantics

## Keep It Simpler When

- one component can express the flow clearly with local state
- the request is one-off and does not need reusable retry or error semantics
- adding a custom hook would only move three obvious lines into another file

## Do Not Do

- Do not treat `useAsync` as a reason to create extra folders.
- Do not hide ownership by splitting one small flow into transport, hook, and state layers without a real need.
- Do not pass raw `Response`, raw `fetch`, or raw backend payloads through `useAsync`.
