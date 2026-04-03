---
name: errors-and-error-handling-mechanism
description: Use when designing, reviewing, or implementing error contracts in this backend. Domain and service failures must throw `VnextForgeError`; request validation must use Zod; the error-handler middleware owns the single translation boundary from `ZodError` or `VnextForgeError` to `ApiResponse<never>`.
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
)
```

Key fields:

- `code: ErrorCode` - stable machine-readable identifier from `ERROR_CODES` (`FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`)
- `context.source` - fully qualified function name (`"FileService.readWorkflow"`)
- `context.layer: ErrorLayer` - architectural layer that threw (`transport | presentation | feature | entity | application | domain | infrastructure`)
- `context.details` - optional debug data, server-side only, never sent to client
- `traceId` - request correlation ID, attach when available

## Error Flow

```text
request schemas validate with Zod
  -> Zod throws ZodError on invalid input
  -> error-handler middleware converts ZodError to VnextForgeError(API_BAD_REQUEST)
  -> ApiFailure sent to client

service/domain throws VnextForgeError
  -> propagates up without re-catching
  -> error-handler middleware catches it
  -> calls error.toLogEntry()     -> structured server log
  -> calls error.toUserMessage()  -> ApiFailure sent to client
```

`toLogEntry()` contains: `code`, `message`, `source`, `layer`, `traceId`, `details`, `stack`.
`toUserMessage()` contains: `code`, safe user-facing `message`, `traceId`. Raw `.message` is never sent.

## Layer Responsibility

- `infrastructure` - detects fs, HTTP, provider, and integration failures; translates third-party errors into `VnextForgeError`
- `application` - rejects impossible or disallowed actions; orchestrates domain + infrastructure
- `domain` - protects business invariants (`packages/workflow-system`)
- `transport` - request parsing and error-handler middleware; request shape is validated with Zod here; `ZodError` is converted to `VnextForgeError`; transport remains the single formatting boundary

## What This Skill Says

- treat errors as part of the system contract, not as incidental strings
- request validation lives in Zod schemas close to the controller, not in ad hoc `if` checks
- every non-validation `throw` must be `VnextForgeError` - no raw strings, no generic `Error`
- decide `ErrorCode` and `ErrorLayer` at the point of throw
- translate third-party failures inward before they cross layer boundaries
- translate `ZodError` and `VnextForgeError` to `ApiResponse<never>` at one boundary only
- log with `toLogEntry()`, send with `toUserMessage()`

## Request Validation Rule

- define controller request contracts with Zod schemas, typically in the controller folder next to the controller implementation
- parse `params`, `query`, `headers`, and `json` through a shared transport helper instead of repeating `c.req.*` validation inline
- let Zod throw `ZodError` for invalid request shapes
- convert `ZodError` to `VnextForgeError(ERROR_CODES.API_BAD_REQUEST, ...)` only in the error-handler middleware
- use manual `VnextForgeError` throws in controllers only for semantic failures that are not structural request validation

## Adding A New Error Type

When a failure scenario requires a new error code:

1. Add the code to the correct category constant in `packages/app-contracts/src/error/error-codes.ts`
2. Add a safe, user-facing message for that code in `packages/app-contracts/src/error/user-messages.ts`
3. Throw the new code with `VnextForgeError` from the correct layer

Never hardcode a new error string inline. If a fitting `ErrorCode` does not exist, extend `error-codes.ts` first.

## To Do

- use `ERROR_CODES` from `@vnext-forge/app-contracts` for all error codes
- set `context.layer` to the layer that discovered the failure
- set `context.source` to the exact function (`"ClassName.methodName"`)
- attach `traceId` when a request correlation ID exists
- put debug data in `context.details`, not in the error message
- keep request validation schemas beside controllers and parse through the shared request parser
- map `ZodError` to `API_BAD_REQUEST` in error middleware with structured `issues`
- translate infrastructure provider errors into `VnextForgeError` at the infrastructure boundary
- keep `ErrorCode` values stable once clients depend on them

## Not To Do

- do not throw raw `Error`, strings, or custom error classes
- do not hand-write repetitive controller validation with `if (!body.foo)` style checks when Zod can express the contract
- do not catch `ZodError` inside controllers to rethrow another transport error
- do not invent `ErrorCode` values inside controllers or route handlers - define in `ERROR_CODES`
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
- controller request parsing is implemented with repeated manual checks instead of Zod schemas
- `ZodError` is handled anywhere other than the error middleware
- `toLogEntry()` or `toUserMessage()` is called outside error-handler middleware
- a route handler or service formats its own error response instead of throwing
- `traceId` is dropped when it exists in the request context
