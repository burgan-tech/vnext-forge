---
name: errors-and-error-handling-mechanism
description: Use when designing, reviewing, or implementing error contracts in this backend. Every throw must be a `VnextForgeError` with a typed `ErrorCode` and `ErrorLayer`. The error-handler middleware owns the single translation boundary from `VnextForgeError` to `ApiResponse<never>`.
---

# Errors And Error Handling Mechanism

## Purpose

Keep error design explicit, stable, and easy to operate. Define what an error means, where it is created, how it moves across layers, what the client sees, and what stays internal.

## Repo Contract

The shared error type is `VnextForgeError` from `@vnext-forge/app-contracts`.

```ts
throw new VnextForgeError(
  ERROR_CODES.FILE_NOT_FOUND,
  'Workflow file not found at path: /projects/foo/workflow.json',
  { source: 'FileService.readWorkflow', layer: 'infrastructure' },
  traceId,
);
```

Key fields:

- `code: ErrorCode` — stable machine-readable identifier from `ERROR_CODES` (`FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`)
- `context.source` — fully qualified function name (`"FileService.readWorkflow"`)
- `context.layer: ErrorLayer` — architectural layer that threw (`transport | presentation | feature | entity | application | domain | infrastructure`)
- `context.details` — optional debug data, server-side only, never sent to client
- `traceId` — request correlation ID, attach when available

## Error Flow

```
service/domain throws VnextForgeError
  → propagates up without re-catching
  → error-handler middleware catches it
  → calls error.toLogEntry()     → structured server log
  → calls error.toUserMessage()  → ApiFailure sent to client
```

`toLogEntry()` contains: `code`, `message`, `source`, `layer`, `traceId`, `details`, `stack`.
`toUserMessage()` contains: `code`, safe user-facing `message`, `traceId`. Raw `.message` is never sent.

## Layer Responsibility

- `infrastructure` — detects fs, HTTP, provider, and integration failures; translates third-party errors into `VnextForgeError`
- `application` — rejects impossible or disallowed actions; orchestrates domain + infrastructure
- `domain` — protects business invariants (packages/workflow-system)
- `transport` — error-handler middleware; the single translation boundary; never throws, only formats

## What This Skill Says

- treat errors as part of the system contract, not as incidental strings
- every `throw` must be `VnextForgeError` — no raw strings, no generic `Error`
- decide `ErrorCode` and `ErrorLayer` at the point of throw
- translate third-party failures inward before they cross layer boundaries
- translate `VnextForgeError` to `ApiResponse<never>` at one boundary only
- log with `toLogEntry()`, send with `toUserMessage()`

## Adding A New Error Type

When a failure scenario requires a new error code:

1. Add the code to the correct category constant in `packages/app-contracts/src/error/error-codes.ts`
   - `FILE_ERRORS`, `PROJECT_ERRORS`, `WORKFLOW_ERRORS`, `RUNTIME_ERRORS`, `SIMULATION_ERRORS`, `GIT_ERRORS`, `API_ERRORS`, or `INTERNAL_ERRORS`
   - Use the category prefix (`FILE_`, `WORKFLOW_`, etc.) to keep the taxonomy stable
2. Add a safe, user-facing message for that code in `packages/app-contracts/src/error/user-messages.ts`
   - The message must be safe to show end users — no internal detail, no stack info
   - If no user-facing message is appropriate, map it to `DEFAULT_USER_MESSAGE`
3. Throw the new code with `VnextForgeError` from the correct layer

Never hardcode a new error string inline. If a fitting `ErrorCode` does not exist, extend `error-codes.ts` first.

## To Do

- use `ERROR_CODES` from `@vnext-forge/app-contracts` for all error codes
- set `context.layer` to the layer that discovered the failure
- set `context.source` to the exact function (`"ClassName.methodName"`)
- attach `traceId` when a request correlation ID exists
- put debug data in `context.details`, not in the error message
- translate infrastructure provider errors into `VnextForgeError` at the infrastructure boundary
- keep `ErrorCode` values stable once clients depend on them

## Not To Do

- do not throw raw `Error`, strings, or custom error classes
- do not invent `ErrorCode` values inside controllers or route handlers — define in `ERROR_CODES`
- do not call `toLogEntry()` or `toUserMessage()` outside the error-handler middleware
- do not leak `context.details`, `stack`, or raw `.message` to the client
- do not let multiple layers remap the same failure with different codes
- do not use `INTERNAL_UNEXPECTED` for known, expected failure conditions
- do not log the same failure repeatedly across layers

## Review Standard

Flag the implementation if:

- a `throw new Error(...)` or raw string throw appears
- an `ErrorCode` is hardcoded outside `ERROR_CODES`
- `context.source` is missing or vague (`"unknown"`, `"handler"`)
- `context.layer` is incorrect for where the error is thrown
- `toLogEntry()` or `toUserMessage()` is called outside error-handler middleware
- a route handler or service formats its own error response instead of throwing
- `traceId` is dropped when it exists in the request context
