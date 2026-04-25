# Server Instructions

> **Scope:** `apps/server` (active Hono REST backend serving the web shell). Load alongside the repo-wide [`./CLAUDE.md`](./CLAUDE.md) when editing this workspace. The conditional rule [`.cursor/rules/server-hardening.mdc`](./.cursor/rules/server-hardening.mdc) auto-loads on edits under `apps/server/src/**`. For errors, traces, and imports, read [`.cursor/skills/shared/error-taxonomy/SKILL.md`](./.cursor/skills/shared/error-taxonomy/SKILL.md), [`.cursor/skills/shared/trace-headers/SKILL.md`](./.cursor/skills/shared/trace-headers/SKILL.md), and [`.cursor/skills/shared/dependency-policy/SKILL.md`](./.cursor/skills/shared/dependency-policy/SKILL.md).

## Goal

Keep `apps/server` a **thin transport layer**: HTTP REST routing, WebSocket, middleware, and composition. **Business logic and methods** live in [`packages/services-core`](./packages/services-core) and are invoked through `dispatchMethod` from a small per-route bridge (`createDispatchHelper`). Default deployment binds the server to **loopback**; lifting that assumption requires the trust-model checklist.

## Trust model summary

Full detail: [`./docs/architecture/adr/001-trust-model.md`](./docs/architecture/adr/001-trust-model.md).

- **Loopback bind by default** — non-loopback needs explicit config and the `BLOCKER-FOR-NON-LOOPBACK` items in ADR 001.
- **CORS** — explicit allowlist only; never `*`. `allowMethods` covers `GET/POST/PUT/DELETE/OPTIONS`.
- **Body limit** — oversize requests fail as `ApiFailure` with `API_PAYLOAD_TOO_LARGE`.
- **Capability policy** — per-method capabilities enforced in the dispatcher (`reads-files`, `writes-files`, `spawns-process`, `talks-runtime`).
- **Runtime-proxy URL allowlist** — SSRF defense in `services-core`; no passthrough for arbitrary URLs.
- **Filesystem jail** — workspace-scoped paths; escapes via symlinks are rejected.
- **LSP WebSocket policy** — max message size, max connections, origin check when not loopback.
- **Child process environment** — `buildChildEnv()` allowlist; never spread full `process.env`.
- **Trace (`trace-v1`)** — server-owned `X-Trace-Id`; inbound `traceparent` is linkage only.
- **Structured logging** — Pino with redaction; no raw `console.*` in application code.

## Middleware pipeline

Order (Hono):

```text
trace-id → request-logger → cors → body-limit → routes → error-handler
```

`trace-id` runs **first** so every request (including failures before or inside later middleware) gets a stable correlation id and response header. `error-handler` is **last** and is the **only** place that turns `ZodError` / `VnextForgeError` into `ApiResponse<never>` (with `traceId` from context).

## Routing layout

REST routes are mounted under `/api/v1/<domain>/<action>` and registered through the per-domain router factories in [`apps/server/src/api/v1/`](./apps/server/src/api/v1/). Each route is a thin handler that delegates to `createDispatchHelper` (`apps/server/src/api/v1/lib/dispatch-helper.ts`), which builds the trusted `caller` context, extracts params from query or JSON body per [`MethodHttpSpec`](./packages/app-contracts/src/method-http.ts), calls `dispatchMethod`, and maps success to `ok` / `created` based on `successStatus`.

| Path | Verb | Role |
|------|------|------|
| `/api/v1/files/<action>` | mixed | Workspace file I/O bridged to `services-core/services/workspace`. |
| `/api/v1/projects/<action>` | mixed | Project lifecycle + workspace bootstrap aggregator. |
| `/api/v1/validate/<action>` | mixed | Workflow / component validation via `services-core/services/validate`. |
| `/api/v1/templates/<action>` | mixed | Project scaffolding via `services-core/services/template`. |
| `/api/v1/runtime/<action>` | POST | Runtime proxy (SSRF-allowlisted). |
| `/api/v1/health` | GET | Binary health (no `degraded`; see ADR 003). |
| WebSocket `/api/lsp` | — | LSP transport; policy in [`./apps/server/src/lsp/router.ts`](./apps/server/src/lsp/router.ts) + [`./apps/server/src/lsp/lsp-ws-policy.ts`](./apps/server/src/lsp/lsp-ws-policy.ts). |

There is no longer a single `/api/rpc` entry — the per-method routes are the authoritative HTTP surface for the web shell. The verb / param-source / success-status binding for each method id lives in `packages/app-contracts/src/method-http.ts`; both server registration and the web `HttpTransport` consume it. A contract test in `packages/services-core` enforces parity between this metadata and the registry.

## Adding a new method (route + registry + metadata)

1. Add the registry entry (`paramsSchema`, `resultSchema`, `capabilities`, `handler`) to [`packages/services-core/src/registry/method-registry.ts`](./packages/services-core/src/registry/method-registry.ts) using the slash-form id `<domain>/<action>`.
2. Add a `MethodHttpSpec` entry (verb, paramSource, successStatus) to [`packages/app-contracts/src/method-http.ts`](./packages/app-contracts/src/method-http.ts) and update the `MethodId` union.
3. Add the route in [`apps/server/src/api/v1/<domain>.routes.ts`](./apps/server/src/api/v1/) — a one-line `app.<verb>('/<domain>/<action>', (c) => dispatch(c, '<domain>/<action>', { source: '<query|json>' }))`.
4. Add a JSON fixture under `packages/services-core/test/fixtures/<domain>/<action>.json` and update the registry snapshot in the same PR.
5. Add a typed wrapper in `apps/web/src/services/<domain>.service.ts` for web callers.

Full enforcement: [`.cursor/rules/rpc-method-policy.mdc`](./.cursor/rules/rpc-method-policy.mdc) and [`./CLAUDE.SERVICES-CORE.md`](./CLAUDE.SERVICES-CORE.md). Do not duplicate the registry contract here.

## Config

Single Zod-validated singleton: [`./apps/server/src/shared/config/config.ts`](./apps/server/src/shared/config/config.ts). Read [`.cursor/rules/config-singleton.mdc`](./.cursor/rules/config-singleton.mdc). Defaults live in the schema; a missing `.env` logs a warning and the process continues with defaults. Reuses primitives from `@vnext-forge/app-contracts/env/common` (`LogLevelSchema`, `NodeEnvSchema`, `coercedBool`, `csvList`, `isLoopbackHost`).

## Logging

- Do **not** call `console.log`, `console.error`, `console.warn`, or other `console.*` from application code.
- All logs go through the **central logger**: inside a request use `c.get('logger')` (or the project’s `getRequestLogger(...)` helper if present); outside request scope use `baseLogger`.
- Controller-level logs should be **short and orchestration-focused**; rely on the **error-handler** for centralized error logging where appropriate.

## Workspace config types

- Canonical workspace config types (`VnextWorkspaceConfig` and related) live in **`@vnext-forge/vnext-types`**.
- `apps/server/src/slices/workspace/types.ts` re-exports those types via `export type { ... } from '@vnext-forge/vnext-types'`. Server-only types (`IWorkspace`, `WorkspaceAnalysisResult`, `SearchResult`, `DirectoryEntry`, etc.) stay in that same file.
- When importing workspace config types in `apps/server`, prefer the **`@workspace/types.js`** path alias over importing `@vnext-forge/vnext-types` directly so server-only and canonical types share one entry point.
- Do **not** define a parallel local interface for workspace config; use the canonical / re-exported types.

## Tests

Families under [`./apps/server/src/__tests__/`](./apps/server/src/__tests__/) include the middleware/policy suites — `trace-id.test.ts`, `lsp-ws-policy.test.ts`, `error-handler.test.ts`, `body-limit.test.ts`, `capability-policy.test.ts`, `runtime-proxy-allowlist.test.ts` — and the per-domain REST integration suites under `__tests__/api/`: `health.test.ts`, `files.test.ts`, `projects.test.ts`, `validate.test.ts`, `templates.test.ts`, `runtime.test.ts`. Integration tests cover happy paths, validation errors, and capability-denied (403) cases against the real middleware chain via Hono's `app.request()`.

Run:

```bash
pnpm --filter @vnext-forge/server test
```

Write tests against the **real middleware chain**; do not disable middleware “just for tests.”

## Don'ts

- Do not regress hardening invariants from [`.cursor/rules/server-hardening.mdc`](./.cursor/rules/server-hardening.mdc): loopback default, CORS allowlist, body limit, trace contract, single error-handler boundary, capability policy, runtime-proxy allowlist, FS jail, LSP WS policy, child-env allowlist, structured logging only.
- Do not use `cors({ origin: '*' })` even temporarily.
- Do not treat inbound `X-Trace-Id` as authoritative; inbound `traceparent` is `linkedTraceId` only.
- Do not bypass the registry’s capability check from a service or route.

## Cross-references

- ADRs: [`001-trust-model`](./docs/architecture/adr/001-trust-model.md), [`002-trace-headers`](./docs/architecture/adr/002-trace-headers.md), [`003-runtime-health-degraded`](./docs/architecture/adr/003-runtime-health-degraded.md), [`004-bootstrap-aggregation`](./docs/architecture/adr/004-bootstrap-aggregation.md), [`005-error-taxonomy`](./docs/architecture/adr/005-error-taxonomy.md), [`006-provider-order`](./docs/architecture/adr/006-provider-order.md), [`007-rest-migration`](./docs/architecture/adr/007-rest-migration.md)
- Skills: [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md)
- Rules: [server-hardening](./.cursor/rules/server-hardening.mdc), [rpc-method-policy](./.cursor/rules/rpc-method-policy.mdc), [config-singleton](./.cursor/rules/config-singleton.mdc)
- [Web vs extension parity](./docs/architecture/web-extension-parity.md), [Bundler checklist](./docs/architecture/bundler-checklist.md)
