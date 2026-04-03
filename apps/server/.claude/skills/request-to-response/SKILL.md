---
name: request-to-response-process
description: Compact guide for designing, reviewing, or debugging the full HTTP request-to-response lifecycle in this backend. Use when deciding middleware order, route flow, controller boundaries, standardized success or error responses using `ApiResponse<T>`, or where a concern should live in the request pipeline.
---

# Request To Response Process

## Purpose

Use this skill to reason about how a request enters the backend, passes through middleware and route logic, reaches application code, and leaves as `ApiResponse<T>`.

## Default Lifecycle

1. request enters global middleware (logging, CORS, body parsing, `traceId` injection)
2. request is routed
3. route-level guards run (auth, rate limiting)
4. controller validates boundary input
5. application logic executes (services, domain)
6. handler returns `ApiSuccess<T>` — `{ success: true, data, error: null }`
7. error-handler middleware catches any `VnextForgeError` → returns `ApiFailure`
8. fallback handles unmatched routes

## Response Contract

All responses use `ApiResponse<T>` from `@vnext-forge/app-contracts`.

- success: handler returns `{ success: true, data: T, error: null, meta?: ResponseMeta }`
- failure: handler throws `VnextForgeError` → error-handler formats `ApiFailure` via `toUserMessage()`

**Never construct `ApiFailure` inline in a handler.** Throw `VnextForgeError` and let the middleware format it.

## Error Flow

```
service throws new VnextForgeError(ERROR_CODES.X, msg, { source, layer })
  → error-handler middleware catches
  → error.toLogEntry()     → logger (server-side only)
  → error.toUserMessage()  → ApiFailure sent to client
```

`traceId` must be attached to `VnextForgeError` when it is available on the request context.

## Placement Rules

### Global Middleware

- request identification and `traceId` generation
- logging, CORS, security headers, body parsing

### Route-Level Middleware

- authentication, authorization, rate limiting for a route group

### Controller / Handler

- parse and validate input
- call application service
- return `ApiSuccess<T>` on success
- **throw `VnextForgeError` on failure** — never return `ApiFailure` manually

### Application Service (`services/*`)

- business orchestration
- throws `VnextForgeError` with `layer: 'application'`

### Domain / Infrastructure

- `domain` throws with `layer: 'domain'`
- `infrastructure` translates provider failures into `VnextForgeError` with `layer: 'infrastructure'`

## To Do

- keep middleware order explicit and stable
- validate external input at the controller boundary
- run authentication before authorization
- construct `traceId` once in global middleware; pass it down
- attach `traceId` to every `VnextForgeError`
- keep `ApiSuccess<T>` construction in handlers
- keep `ApiFailure` construction in error-handler middleware only

## Not To Do

- do not construct `ApiFailure` inside handlers or services
- do not throw raw `Error` or strings — always `VnextForgeError`
- do not put business rules in controllers
- do not duplicate error-formatting logic outside the error-handler
- do not let unmatched-route behavior compete with handled-error behavior
- do not bypass the standard response path without a deliberate contract reason

## Review Checklist

- Does this concern belong in global middleware, route middleware, handler, or service?
- Is middleware order still intentional after the change?
- Does boundary validation happen before business logic?
- Does the handler return `ApiSuccess<T>` and throw `VnextForgeError` for failures?
- Does every `VnextForgeError` carry `ErrorCode`, `ErrorLayer`, `source`, and `traceId`?
- Is error-handler middleware the only place `ApiFailure` is constructed?
- Is the fallback path singular and unambiguous?
