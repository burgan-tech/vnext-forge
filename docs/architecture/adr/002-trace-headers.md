# ADR 002: Trace headers (`trace-v1`)

**Status:** Accepted

## Context

Distributed debugging requires a **stable server trace id** on every HTTP response and failure envelope, without hijacking inbound distributed-tracing headers as the authoritative id.

## Decision (`trace-v1`)

1. The server **always** generates its own `traceId` as a **UUID** per request.
2. Inbound W3C `traceparent` is **parsed only as a link**: the 32-hex trace id is stored as `linkedTraceId`. It is **never** adopted as `traceId`.
3. The response includes **`X-Trace-Id`** equal to the server `traceId` (including on errors).
4. `ApiFailure.error.traceId` is populated from request context when absent on the thrown error (see error-handler middleware).
5. Outbound **runtime-proxy** calls propagate `X-Trace-Id` when a `traceId` is supplied (see `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts`).

**Implementation reference** (`apps/server/src/shared/middleware/trace-id.ts`):

The middleware always generates a fresh UUID for `traceId`, optionally parses an inbound `traceparent` into `linkedTraceId`, and emits `X-Trace-Id` in a `finally` block so the header survives handler throws.

## Example

Request:

```http
POST /api/rpc/projects.getWorkspaceBootstrap HTTP/1.1
Host: 127.0.0.1:3001
Content-Type: application/json
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

Response:

```http
HTTP/1.1 200 OK
X-Trace-Id: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
Content-Type: application/json

{ "success": true, "data": { ... }, "meta": { "traceId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8" } }
```

On failure, the same `X-Trace-Id` matches `error.traceId` in `ApiFailure`.

**Wire path:** `traceIdMiddleware` → Hono context (`traceId`, optional `linkedTraceId`) → handlers / `VnextForgeError` (optional) → `error-handler` merges trace into `ApiFailure` → runtime-proxy outbound headers.

## Consequences

- Upstream APM trace ids remain **correlatable** via `linkedTraceId` (when wired to logs) without breaking the **single authoritative** server trace id.
- Clients must not assume `traceparent` controls `X-Trace-Id`.

## Alternatives considered

- **Adopt `traceparent` as canonical** — rejected: harder to guarantee uniqueness and consistent format across all paths; server-owned UUID is simpler.
- **Echo inbound `X-Trace-Id`** — rejected: same adoption problem as `traceparent`.
