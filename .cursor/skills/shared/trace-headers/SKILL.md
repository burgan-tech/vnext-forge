---
name: trace-headers
description: Scope is repo-wide. Implements the `trace-v1` contract for `X-Trace-Id` and `traceparent` correlation. Trigger this skill whenever editing HTTP middleware, transports, RPC clients, runtime-proxy, or anything that reads/writes trace headers anywhere in the monorepo. See ADR 002.
---

# Trace headers (`trace-v1`)

> **Scope:** Repo-wide. Authoritative ADR: [`docs/architecture/adr/002-trace-headers.md`](../../../../docs/architecture/adr/002-trace-headers.md).

## Contract summary

1. **The server is authoritative.** `apps/server` always **generates a fresh `X-Trace-Id`** (UUID v4) per inbound request. It does **not** adopt any inbound `X-Trace-Id`.
2. **Inbound `traceparent` is informational.** If present, the W3C trace ID is parsed and stored on the Hono context as `linkedTraceId`. It is logged for correlation but **never** becomes the primary `traceId`.
3. **Every response carries `X-Trace-Id`.** Set in a `finally` block in the `traceIdMiddleware` so success, validation failure, and crash paths all emit the header.
4. **`X-Trace-Id` propagates outbound.** The runtime-proxy includes the current request's `X-Trace-Id` on every outgoing call (built by `buildRuntimeProxyOutboundHeaders`).
5. **`VnextForgeError.traceId`** is set from the ambient `traceId` whenever the error is constructed inside a request.
6. **Web client** preserves `traceId` on `ApiFailure` and surfaces it in dev logs and the error fallback UI for support copy.

## Where the contract lives

- Middleware: `apps/server/src/shared/middleware/trace-id.ts`
- Outbound headers: `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts` (`buildRuntimeProxyOutboundHeaders`)
- Web ingestion: `apps/web/src/shared/api/client.ts` (preserves `traceId` from `ApiFailure`)
- Tests: `apps/server/src/__tests__/trace-id.test.ts`

## Rules (must)

- **Never** copy an inbound `X-Trace-Id` into the response.
- **Never** put untrusted external input into `X-Trace-Id`. Generate it.
- **Always** echo the server-generated `X-Trace-Id` on every response, including error responses.
- **Always** strip hop-by-hop headers when proxying; `X-Trace-Id` survives explicitly via the helper, not via blanket forwarding.
- **Log `linkedTraceId`** when present so external systems' traces can be joined out-of-band.

## Quick recipe (server middleware order)

```text
trace-id  →  request-logger  →  cors  →  body-limit  →  routes  →  error-handler
```

`trace-id` runs first so every later middleware (including error-handler) can read `c.get('traceId')`.

## Don'ts

- Don't add per-route trace-id logic; the middleware owns it.
- Don't emit `traceparent` on responses unless we adopt distributed tracing repo-wide (deferred).
- Don't mutate `X-Trace-Id` after the response leaves the handler.

## Cross-references

- [`docs/architecture/adr/002-trace-headers.md`](../../../../docs/architecture/adr/002-trace-headers.md)
- [`docs/architecture/adr/005-error-taxonomy.md`](../../../../docs/architecture/adr/005-error-taxonomy.md) — `traceId` ↔ `VnextForgeError`.
- [`docs/architecture/adr/001-trust-model.md`](../../../../docs/architecture/adr/001-trust-model.md) — why we don't trust inbound trace headers.
