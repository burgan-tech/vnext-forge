---
name: api-error-handling
description: Scope is apps/web (web frontend). Use when implementing or reviewing web error handling in this repo. The web app must normalize failures into the shared repo contract built around `VnextForgeError`, `ErrorCode`, `ErrorLayer`, `traceId`, and `ApiResponse<T>`. Trigger this skill for any error-handling work under `apps/web`.
---

# API Error Handling

> **Scope:** `apps/web` (web frontend). This skill applies only to code under `apps/web` and is intended to trigger when editing or reviewing web error-handling code.

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

- `code: ErrorCode` - machine-readable, stable identifier such as `FILE_NOT_FOUND` or `WORKFLOW_INVALID`
- `context.layer: ErrorLayer` - where the error originated
- `context.source` - which function threw
- `traceId` - correlation ID from the backend; preserve it always
- `toUserMessage()` - safe string to show the user; never use raw `.message` in UI
- `toLogEntry()` - structured log payload for server-side logging only

Failure responses from the server arrive as `ApiFailure` inside `ApiResponse<T>`:

```ts
import { isFailure, fold, getError } from '@vnext-forge/app-contracts';
```

Use `isSuccess` and `isFailure` for branching, `fold` for exhaustive handling, and `unwrap` or `unwrapOr` when a default fallback is acceptable.

## Error Flow

```text
Hono RPC Response
  -> callApi<T>()         (shared/api/client.ts) parses JSON and normalizes network or parse failures
  -> owning service module returns ApiResponse<T>, no throw on normal failure branch
  -> useAsync             converts ApiFailure into VnextForgeError and sets error state
  -> UI                   renders error.toUserMessage().message
```

`callApi` handles network and parse-level failures, converting them to `VnextForgeError` immediately.
Owning service modules do not reinterpret the error; they return `ApiResponse<T>` and let `useAsync` handle the failure branch.
`unwrapApi` is for imperative paths outside `useAsync` and throws `VnextForgeError` directly on failure.

## Where Errors Belong

1. `shared/api/client.ts` - `callApi` and `unwrapApi`: transport normalization and first-pass `VnextForgeError` construction
2. Owning service module - return `ApiResponse<T>`, no UI-specific error interpretation
3. Modules and `useAsync` - translate normalized error into scenario meaning and set error state
4. UI - render `error.toUserMessage().message`; never inspect transport details to build message strings

## Do

- Normalize unknown transport failures into `VnextForgeError`.
- Preserve `traceId` whenever the backend provides one.
- Use `error.code` to branch behavior such as retry, redirect, or specific empty states.
- Use `error.toUserMessage().message` at the presentation edge; never raw `error.message`.
- Keep the same `VnextForgeError` shape across pages, modules, and shared modules.

## Do Not Do

- Do not return raw `Error`, raw HTTP responses, or raw backend payloads to components.
- Do not branch on `message.includes(...)`.
- Do not create per-feature error classes for ordinary API failures.
- Do not store a second UI-only error object when `VnextForgeError` already exists.
- Do not make components aware of status codes, fetch exceptions, or RPC internals.
- Do not show `error.message` directly in UI; always use `toUserMessage()`.

## Adding A New Error Type

When a new failure scenario needs a dedicated error code:

1. add the code to `@vnext-forge/app-contracts`
2. normalize it in the server or transport boundary where the failure is first understood
3. branch on `error.code` in the module only if behavior must differ
4. keep presentation text flowing through `toUserMessage()`

## Review Standard

Raise a concern when:

- UI code sees raw transport errors or backend payloads
- a service layer invents a second error contract
- components branch on message text instead of `error.code`
- error handling assumes every request must live in a shared layer by default
