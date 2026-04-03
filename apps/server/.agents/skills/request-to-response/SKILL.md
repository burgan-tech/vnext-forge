---
name: request-to-response-process
description: Compact guide for designing, reviewing, or debugging the full HTTP request-to-response lifecycle in this backend. Use when deciding middleware order, route flow, controller boundaries, Zod request parsing, standardized success responses, or where a concern should live in the pipeline.
---

# Request To Response Process

## Purpose

Use this skill to reason about how a request enters the backend, passes through middleware, reaches a controller, is validated with Zod, runs application logic, and leaves as either a success envelope or a standardized error response.

## Actual App Order

The current top-level app flow in `apps/server/src/index.ts` is:

1. `traceIdMiddleware`
2. `logger()`
3. `cors()`
4. route matching with `app.route(...)`
5. controller execution
6. `app.onError(errorHandler)`
7. `app.notFound(...)`

This order matters:

- `traceIdMiddleware` creates the request correlation id once, stores it on context, and adds `X-Trace-Id` to the response
- logger and downstream layers can reuse that same trace id
- route handlers stay thin; they do not own cross-cutting concerns
- `errorHandler` is the single error formatting boundary
- `notFound` is the fallback only when no route matched

## End To End Lifecycle

```text
HTTP request
  -> traceId middleware
  -> logger middleware
  -> cors middleware
  -> route match
  -> controller method
  -> parseRequest(...) with Zod schemas
  -> application service
  -> baseController success helper
  -> ApiSuccess<T> JSON response
```

If something fails:

```text
invalid request shape
  -> Zod throws ZodError
  -> errorHandler converts to VnextForgeError(API_BAD_REQUEST)
  -> ApiFailure JSON response

service or infrastructure failure
  -> throws VnextForgeError
  -> errorHandler logs and formats it
  -> ApiFailure JSON response

no matching route
  -> notFound creates VnextForgeError(API_NOT_FOUND)
  -> jsonErrorResponse returns ApiFailure JSON response
```

## Layer By Layer

## Global Middleware

Global middleware lives in `apps/server/src/middleware`.

- `trace-id.ts`
  Creates a `traceId`, stores it in Hono context, and sets `X-Trace-Id` on the response.
- `logger()`
  Handles request logging.
- `cors()`
  Handles cross-origin headers.

Global middleware should own cross-cutting concerns only. It should not contain business rules.

## Route Layer

Routes map HTTP method and path to a controller method.

Example:

```ts
projectRoutes.get('/:id', (c) => projectController.getById(c))
```

Route files should stay thin:

- no business logic
- no manual request validation
- no response shaping beyond delegating to the controller

## Controller Layer

Each controller now lives in its own folder:

- `index.ts` for the controller
- `schema.ts` for request schemas

Example structure:

```text
controllers/project/
  index.ts
  schema.ts
```

Controller responsibilities:

- receive Hono `Context`
- parse boundary input with `parseRequest(...)`
- call application services
- return success responses via `baseController`
- let validation or service errors bubble upward

Controllers should not:

- duplicate `c.req.param()` / `c.req.query()` validation logic inline
- catch `ZodError`
- construct failure responses manually
- contain business orchestration beyond straightforward delegation

## Request Parsing

Shared request parsing lives in `apps/server/src/lib/request.ts`.

`parseRequest(c, schemas, source)` can validate:

- `params`
- `query`
- `headers`
- `json`

Rules:

- define request contracts with Zod in `schema.ts`
- parse in the controller through the shared helper
- let Zod produce `ZodError` on structural validation failures
- if JSON parsing itself fails, the helper throws `VnextForgeError(API_BAD_REQUEST, ...)`

Example pattern:

```ts
const { params, json } = await parseRequest(
  c,
  projectExportRequestSchema,
  'projectController.exportProject',
)
```

This is the standard way to move from raw HTTP input to typed controller input.

## Service Layer

Services own application orchestration.

Typical controller-to-service flow:

```text
controller parses request
  -> service performs operation
  -> service may call infrastructure/domain
  -> service returns domain data
```

Services should:

- receive already-validated input
- throw `VnextForgeError` for business, application, or infrastructure failures
- propagate `traceId` downward where relevant

Services should not:

- depend on Hono `Context`
- shape HTTP success envelopes
- format `ApiFailure`

## Success Response Path

Success response shaping belongs to `baseController`.

Standard helpers:

- `ok(c, data, meta?)`
- `created(c, data, meta?)`
- `empty(c)`

These return the shared success envelope from `@vnext-studio/app-contracts`.

Success rule:

- controllers return standardized JSON success envelopes
- services return raw application/domain data

## Error Response Path

The single formatting boundary is `errorHandler` in `apps/server/src/middleware/error-handler.ts`.

It handles three cases:

1. `ZodError`
   Converts request validation failures into `VnextForgeError(ERROR_CODES.API_BAD_REQUEST, ...)` with structured `issues`.
2. `VnextForgeError`
   Logs with `toLogEntry()` and returns standardized `ApiFailure`.
3. unknown error
   Returns `internalFailure(traceId)` with HTTP 500.

Important rule:

- controllers and services throw
- middleware formats

Do not return failure payloads directly from controllers or services.

## Not Found Path

`app.notFound(...)` is the unmatched-route fallback.

It creates a transport-layer `VnextForgeError(API_NOT_FOUND)` and formats it through `jsonErrorResponse`.

This keeps 404 behavior aligned with the same public failure contract.

## Placement Rules

- global middleware: trace id, logging, CORS, request-wide concerns
- route files: path-to-controller mapping only
- controller: request parsing and success response creation
- `schema.ts`: Zod request contracts for that controller
- shared request helper: reusable transport parsing logic
- service: orchestration and application logic
- error middleware: all failure formatting

## To Do

- keep middleware order explicit and stable
- generate `traceId` once and reuse it through the request lifetime
- define request schemas beside controllers
- parse request data with `parseRequest(...)` instead of hand-written checks
- return success payloads only through `baseController`
- throw `VnextForgeError` for semantic or operational failures
- let `ZodError` reach `errorHandler`
- keep `notFound` as the single unmatched-route fallback

## Not To Do

- do not validate request shape manually in every controller method
- do not construct `ApiFailure` inside controllers or services
- do not catch `ZodError` in controllers
- do not pass Hono `Context` into services
- do not mix route mapping with business logic
- do not bypass `baseController` for standard JSON success responses unless the endpoint is intentionally raw
- do not bypass `errorHandler` for normal error responses

## Exception Case

Raw proxy endpoints may intentionally return `Response` directly instead of the shared success envelope.

Example: runtime proxy style endpoints that transparently forward upstream responses.

Even in that case:

- request validation can still use Zod
- operational failures should still become `VnextForgeError`
- unexpected errors should still flow into `errorHandler`

## Review Checklist

- Is the concern placed in the correct layer?
- Is middleware order still intentional?
- Does the route file only map paths to controllers?
- Does the controller parse input through `parseRequest(...)`?
- Is the request schema defined in the controller folder?
- Does the controller use `baseController` for success responses?
- Are services free from Hono-specific concerns?
- Does `ZodError` reach `errorHandler` instead of being remapped in controllers?
- Is `VnextForgeError` the only semantic error type crossing layers?
- Is this endpoint standard JSON or an intentional raw-response exception?
