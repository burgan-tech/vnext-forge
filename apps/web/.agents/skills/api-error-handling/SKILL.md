---
name: api-error-handling
description: Use when implementing or reviewing web error handling in this repo. The web app must normalize failures into the shared repo contract built around `VnextForgeError`, `ErrorCode`, `ErrorLayer`, `traceId`, and `ApiResponse<T>`.
---

# API Error Handling

## Purpose

Use this skill to keep every web error flow aligned with the target architecture.

The goal is simple:

- one shared error contract (`VnextForgeError` from `@vnext-forge/app-contracts`)
- no raw transport errors in UI
- no ad hoc feature-specific error shapes
- deterministic branching based on structured fields

## Repo Contract

The shared error type is `VnextForgeError` from `@vnext-forge/app-contracts`.

Key fields:

- `code: ErrorCode` — machine-readable, stable identifier (e.g. `FILE_NOT_FOUND`, `WORKFLOW_INVALID`)
- `context.layer: ErrorLayer` — where the error originated (`transport | presentation | feature | entity | application | domain | infrastructure`)
- `context.source` — which function threw (`"FileService.readWorkflow"`)
- `traceId` — correlation ID from the backend, preserve it always
- `toUserMessage()` — safe string to show the user; never use raw `.message` in UI
- `toLogEntry()` — structured log payload for server-side logging only

Failure responses from the server arrive as `ApiFailure` inside `ApiResponse<T>`:

```ts
import { isFailure, fold, getError } from '@vnext-forge/app-contracts';
```

Use `isSuccess` / `isFailure` for branching, `fold` for exhaustive handling, `unwrap` / `unwrapOr` when a default fallback is acceptable.

## Error Flow

```
Hono RPC Response
  → callApi<T>()           (shared/api/client.ts) — parse JSON, throw on network/parse error
  → entity service api.ts  — returns ApiResponse<T>, no throw
  → useAsync               — calls isFailure, converts to VnextForgeError, sets error state
  → UI                     — renders error.toUserMessage().message
```

`callApi` handles network and parse-level failures, converting them to `VnextForgeError` immediately.
Entity services do not throw — they return `ApiResponse<T>` and let `useAsync` handle the failure branch.
`unwrapApi` is for imperative paths (outside `useAsync`) and throws `VnextForgeError` directly on failure.

## Where Errors Belong

1. `shared/api/client.ts` — `callApi` / `unwrapApi`: transport normalization and first-pass `VnextForgeError` construction
2. `entities/*/api.ts` — entity services: return `ApiResponse<T>`, no error interpretation
3. Features / `useAsync` — translate normalized error into scenario meaning, set error state
4. UI — renders `error.toUserMessage().message`; never inspects `.code` to build message strings

## Do

- Normalize unknown transport failures into `VnextForgeError`.
- Preserve `traceId` whenever the backend provides one.
- Use `error.code` to branch behavior (retry, redirect, show specific UI state).
- Use `error.toUserMessage().message` at the presentation edge — never raw `.message`.
- Keep the same `VnextForgeError` shape across pages, widgets, features, and entities.

## Do Not Do

- Do not return raw `Error`, raw HTTP responses, or raw backend payloads to components.
- Do not branch on `message.includes(...)`.
- Do not create per-feature error classes for ordinary API failures.
- Do not store a second UI-only error object when `VnextForgeError` already exists.
- Do not make components aware of status codes, fetch exceptions, or RPC internals.
- Do not show `error.message` directly in UI — always use `toUserMessage()`.

## Adding A New Error Type

When a new failure scenario needs a dedicated error code:

1. Add the code to the correct category in `packages/app-contracts/src/error/error-codes.ts`
2. Add a safe user-facing message in `packages/app-contracts/src/error/user-messages.ts`
3. Both server and web immediately gain the new code — no local additions needed

Never add a local error code or message string in the web app. If the needed `ErrorCode` does not exist in `@vnext-forge/app-contracts`, extend `error-codes.ts` and `user-messages.ts` first.

## Review Standard

Flag the implementation if:

- UI code catches and interprets transport errors directly.
- A service invents a custom error shape that bypasses `VnextForgeError`.
- A page decides behavior from string messages.
- `traceId` is dropped even though it exists upstream.
- A failure path cannot be traced to a specific `ErrorCode`.
- `error.message` is rendered in JSX instead of `error.toUserMessage().message`.
- An entity service throws instead of returning `ApiResponse<T>`.
