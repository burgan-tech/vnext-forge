# ADR 001: Trust model for the deprecated Hono server (`apps/server`)

**Status:** Accepted

## Context

The monorepo still ships a Node HTTP server (`apps/server`) used as a reference / local RPC surface. The product's **default posture** is a **single-developer workstation**: the server binds **loopback** by default, and several controls only become strict when leaving loopback.

## Decision

Document the shipped controls and classify what must change before **binding to a non-loopback interface** (LAN / container bridge / public).

**Implemented controls (ground truth):**

| Control | Where it lives | Behavior (summary) |
|--------|----------------|--------------------|
| Bind host default loopback | `apps/server/src/shared/config/config.ts` (`host` default `127.0.0.1`) | Process listens on configured host only. |
| CORS allowlist | Same file (`corsAllowedOrigins`) | Browser origins must match allowlist. |
| Per-method capability policy | `packages/services-core/src/registry/policy.ts` + server enforcement | Methods are `public` / `privileged` / etc.; denies are explicit `ApiFailure` (e.g. `UNAUTHORIZED`), not silent 404. |
| Filesystem jail | `workspaceAllowedRoots` in server config | Empty list = **open mode** (warning, `..` traversal gated only) — acceptable locally, not for shared hosts. |
| Runtime proxy SSRF defenses | `vnextRuntimeUrl`, `runtimeAllowedBaseUrls`, `allowRuntimeUrlOverride` (default `false`) | Default URL always allowed; extra bases configurable; per-request `runtimeUrl` override is **off** by default. |
| RPC body limit | `maxRequestBodyBytes` default `1_048_576` (1 MiB) + `bodyLimitMiddleware` | Oversize requests fail before handler work. |
| Webview `postMessage` origin checks | `apps/extension/webview-ui/src/VsCodeTransport.ts` + `host/webviewMessageOrigins.ts` | Frames from unexpected origins are ignored (logged). |
| LSP WebSocket policy | `apps/server/src/lsp/lsp-ws-policy.ts` | Origin check (loopback bind bypasses origin requirement), max message bytes, max connections (`lspMaxMessageBytes`, `lspMaxConnections` in config). |

**BLOCKER-FOR-NON-LOOPBACK** — must be addressed in the **same change** that exposes the server beyond loopback:

1. **Set `workspaceAllowedRoots`** to real jail roots (no "open mode") and verify all file RPC paths canonicalize under them.
2. **Review `corsAllowedOrigins`** for every browser shell that will talk to the server (web app, any hosted webview, dev proxies).
3. **LSP WebSocket**: with non-loopback bind, missing / untrusted `Origin` must be rejected — rely on `corsAllowedOrigins` + tests; do not assume loopback leniency.
4. **Runtime proxy**: keep `allowRuntimeUrlOverride` off unless the deployment is fully trusted; expand `RUNTIME_ALLOWED_BASE_URLS` deliberately.
5. **Threat model**: add authentication / network policy (reverse proxy, mTLS, VPN) — **out of scope** of today's defaults; loopback binding is not a substitute for auth on exposed networks.

## Consequences

- Contributors have a single place to learn **why** loopback is default and **what breaks** if they "just bind `0.0.0.0`".
- Any non-loopback deployment requires an explicit checklist, not incremental drift.

## Alternatives considered

- **"Secure by default" with strict jail and auth on first commit** — rejected for local-dev ergonomics; instead we use loopback default + explicit blockers list.
- **Single global policy module** — partially implemented across config + policy + middleware; full consolidation deferred.
