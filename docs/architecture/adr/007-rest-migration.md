# ADR 007: Per-method REST surface + dispatch bridge

**Status:** Accepted

## Context

The standalone web server previously exposed a single `POST /api/rpc` entry that accepted `{ method, params }`. The VS Code extension continues to use `postMessage` with the same logical method ids. We need first-class HTTP routes for the web shell without duplicating validation (single Zod parse in `dispatchMethod`) and without changing extension host code.

## Decision

1. **Routes:** Replace `/api/rpc` with explicit REST endpoints under `/api/v1/<methodId>`, where `methodId` uses slash notation (e.g. `files/read`). HTTP verbs and param placement (query vs JSON body) are defined in `@vnext-forge/app-contracts` as `METHOD_HTTP_METADATA` / `getMethodHttpSpec`.
2. **Registry:** `packages/services-core` method registry and capability policy use the same slash ids as the only wire keys (single source of truth). Handlers and Zod schemas are unchanged.
3. **Bridge:** `apps/server` implements `createDispatchHelper`, which parses transport input (query or JSON), calls `dispatchMethod` with the same `caller` trust context as the former RPC router (`isLoopbackHost`, `Origin`, `corsAllowedOrigins`), and maps success to `ok` / `created` using `successStatus` from `getMethodHttpSpec`.
4. **CORS:** `allowMethods` includes `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS` to match the verb mix on `/api/v1/*`.
5. **Web ↔ server typing:** `apps/web` may depend on `apps/server` **only** via `import type { AppType }` in the HTTP transport (or a single API shell module). No runtime imports from the server into the web bundle.

**Architecture exception rationale:** pnpm must see `@vnext-forge/server` in `dependencies` or `devDependencies` so the workspace link resolves; that is orthogonal to runtime bundling. `import type` is erased by `tsc -b`, so no server code is emitted into the web bundle. ESLint `no-restricted-imports` in `apps/web` still blocks other `apps/server` imports unless narrowed for `apps/web/src/shared/api/**` (or the single transport module). `apps/web/tsconfig.json` `references` keep composite project build order consistent with that edge.

## Consequences

- Web and extension share semantics through the registry; the web transport URL shape changes and must be updated in the frontend phase.
- Drift between HTTP metadata and registry keys is caught by a parity test in `packages/services-core`.
- Extension host sources stay unchanged; webview payloads must use slash ids once the designer-ui migration lands.

## Alternatives considered

- **Per-route controllers with duplicate Zod** — rejected: two parsers would diverge.
- **Keep dotted ids in the registry** — rejected: path-shaped ids align URLs, metadata, and logs.
