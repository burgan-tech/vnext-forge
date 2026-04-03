---
name: response-standardization
description: Use when creating, reviewing, or refactoring API responses in this backend. All responses must use `ApiResponse<T>` from `@vnext-forge/app-contracts`. Success responses are `ApiSuccess<T>`, failures are `ApiFailure`. The error-handler middleware owns failure formatting; route handlers own success formatting.
---

# Response Standardization

## Purpose

Keep all API responses predictable and consistent using the shared `ApiResponse<T>` contract from `@vnext-forge/app-contracts`.

## Repo Contract

```ts
// From @vnext-forge/app-contracts
type ApiSuccess<T, M extends ResponseMeta = ResponseMeta> = {
  success: true;
  data: T;
  error: null;
  meta?: M;            // populated only for paginated responses
};

type ApiFailure = {
  success: false;
  data: null;
  error: ResponseError; // { code: ErrorCode; message: string; traceId?: string }
  meta?: never;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

The web layer discriminates on `response.success`. Do not change this shape.

## Ownership

- **Route handlers** — construct `ApiSuccess<T>` for normal results
- **Error-handler middleware** — constructs `ApiFailure` from `VnextForgeError.toUserMessage()`; owns all failure formatting
- **`ResponseMeta`** — used only for paginated collection responses; contains `total`, `page`, `pageSize`, `totalPages`

Route handlers must never format `ApiFailure` manually. Throw `VnextForgeError` and let the middleware handle it.

## Response Rules

### Success

- always set `success: true`
- put business payload inside `data`
- include `meta` only for paginated collections
- use `error: null` — never omit it

### Failure

- never format `ApiFailure` in a route handler — throw `VnextForgeError` instead
- the `error.code` field must be a typed `ErrorCode` value
- `error.message` must come from `VnextForgeError.toUserMessage()` — never raw `.message`
- include `traceId` when available

### Pagination

- use `ResponseMeta` for collection responses that page
- place pagination in `meta` only — never in `data`
- return paginated shape only when the endpoint actually pages

## To Do

- import `ApiResponse`, `ApiSuccess`, `ApiFailure`, `ResponseMeta` from `@vnext-forge/app-contracts`
- construct success responses as `{ success: true, data, error: null }`
- include `meta` only when the response is paginated
- throw `VnextForgeError` for all failure cases; never construct `ApiFailure` inline
- keep `data` typed — use `ApiResponse<T>` with a concrete `T`

## Not To Do

- do not handcraft `ApiFailure` objects inside route handlers or services
- do not invent new top-level keys beside `success`, `data`, `error`, `meta`
- do not add pagination fields to `data`
- do not use `success: false` with a non-null `data`
- do not send raw exception messages in `error.message`
- do not omit `error: null` from success responses
- do not return untyped `ApiResponse<unknown>` when a concrete type is available

## Review Checklist

1. Does the response use `ApiResponse<T>` from `@vnext-forge/app-contracts`?
2. Is business payload inside `data` only?
3. Is `meta` present only for paginated responses and typed as `ResponseMeta`?
4. Are all failures routed through `VnextForgeError` → error-handler middleware?
5. Is `error.code` a typed `ErrorCode` value?
6. Does `error.message` come from `toUserMessage()`, not raw `.message`?
7. Is `traceId` preserved when available?
