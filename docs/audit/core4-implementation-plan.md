# Core-4 Audit — Implementation Plan

> Scope: `apps/extension`, `apps/web`, `apps/server`, `packages/designer-ui` (other packages observed for dependency impact only).
> Audit pipeline: Stage 0 (4× explorer) → Stage 1 (backend-architect + frontend-architect proposals) → Stage 2 (architect-reviewer + code-reviewer + security-reviewer cross-review) → Stage 3 (architect rebuttal & merge) → Stage 4 (this document).
> Trust model assumption: **default deployment is single-developer workstation, server bound to loopback**. Anything that breaks this assumption (LAN bind, shared deployment) requires the items marked `BLOCKER-FOR-NON-LOOPBACK` to land first.

---

## 1. Executive summary

The codebase is structurally sound: there is one RPC dispatch surface (`packages/services-core` registry), per-shell transports (`apps/server` Hono router and `apps/extension` MessageRouter), shared contracts in `packages/app-contracts`, and a clean port-adapter pattern for notifications/log-sinks. The architectural shape does not need a rewrite.

What does need work falls into five buckets:

1. **Security posture mismatch.** Several backend surfaces (RPC method registry, `runtime.proxy`, `files.*`, LSP WebSocket) assume an authenticated/trusted caller but are reachable on a local HTTP port with permissive CORS and no body limit. Acceptable for loopback dev; **BLOCKER** for any other deployment.
2. **Contract clarity.** Error codes, env schema, trace headers, and bootstrap-null semantics live in different packages with informal conventions. Stage 3 consensus: typed contracts move into `packages/app-contracts`; `services-core` stays orchestration-only.
3. **Frontend public-surface hygiene.** One broken `package.json` export, mis-located `RuntimeHealthSync` doc, dead/orphan exports (`useEditorValidationStore`, `setTheme`), Monaco bundled inside generic `ui/`, four global save-keydown handlers, widespread `any` casts, and Turkish UI strings violating CLAUDE.md English-only policy.
4. **Cross-cutting policy.** Per-method capabilities, filesystem jail, structured logging without `params`, dependency-direction rules between `app-contracts` ↔ `services-core` ↔ `designer-ui` ↔ `apps/*` need to be documented and enforced (ESLint, CI scripts, ADRs).
5. **Supply chain.** Vite has a high-severity advisory; upgrade is blocking for any release artifact.

The plan groups all 26 backend (R-b) and 26 frontend (R-f) items plus 7 architect-reviewer additions (R-a) into **5 implementation waves** sequenced by risk and dependency.

---

## 2. Inventory of recommendations (final, after Stage 3)

### 2.1 Backend (R-b)

| Id | One-liner | Sev | Source | Wave |
|----|-----------|-----|--------|------|
| R-b1 | Enforce max RPC JSON body + stable 413 / error code | H | Stage 1 + S-5 + C-20 | W1 |
| R-b2 | Replace blanket `cors()` with explicit dev/prod origin matrix | H | Stage 1 + S-6 + C-19 | W1 |
| R-b3 | Runtime proxy: allowlist URL, normalize path, disable untrusted `runtimeUrl` in shared mode | C | Stage 1 + S-2 | W1 |
| R-b4 | Proxy headers: server-owned defaults, no hop-by-hop from params; phased caller headers | H | Stage 1 + C-21 | W3 |
| R-b5 | Keep all stable failure codes in `app-contracts` | M | Stage 1 | W2 |
| R-b6 | Single config module per shell + inject deps; no scattered env reads | M | Stage 1 + S-17 | W2 |
| R-b7 | Env/schema types in `app-contracts`; `services-core` stays orchestration-only | M | Stage 1 (pivoted) | W2 |
| R-b8 | Single LSP / installer lifecycle owner; no duplicate composition | M | Stage 1 + C-10 | W3 |
| R-b9 | Result correctness via CI golden parse (R-a2), not dev-only throws | M | Stage 1 (pivoted) | W4 |
| R-b10 | ADR: trust model, trace, health, aggregation, bootstrap | M | Stage 1 (merges into R-a3) | W5 |
| R-b11 | Version trace contract (`X-Trace-Id` v1; optional `traceparent` link later) | M | Stage 1 | W3 |
| R-b12 | Structured logs without raw `params`; bounded `details` | H | Stage 1 | W2 |
| R-b13 | New health/`degraded` states = contract + both shells + flag | M | Stage 1 | W3 |
| R-b14 | RPC access control: hide or gate registry; per-method capabilities (files, proxy, browse) | C | S-1 / S-8 | W1 (BLOCKER-FOR-NON-LOOPBACK) |
| R-b15 | Filesystem jail + symlink policy + constrained `createProject` paths | C | S-3 / S-7 / S-11 | W1 |
| R-b16 | LSP / tunnel message size, origin policy, connection limits | H | S-4 / S-14 | W3 |
| R-b17 | Minimized environment for child processes (templates/scripts) | H | S-9 | W3 |
| R-b18 | Expand Pino redaction for common secret field names | M | S-16 | W2 |
| R-b19 | HttpTransport (web): handle non-2xx before `json()`; server keeps JSON errors | M | S-15 (web side = R-f21) | W2 |

### 2.2 Frontend (R-f)

| Id | One-liner | Sev | Source | Wave |
|----|-----------|-----|--------|------|
| R-f1 | Fix or remove broken `designer-ui` `./modules/project-management` export | H | Stage 1 | W1 |
| R-f2 | Correct `RuntimeHealthSync` placement comment in barrel | L | Stage 1 | W1 |
| R-f3 | Suspense boundaries for lazy routes with real fallbacks | M | Stage 1 | W4 |
| R-f4 | Error boundaries + renamed non-React "failure panels" | M | Stage 1 | W3 |
| R-f5 | Map backend failure codes → UI severity/copy (no string-matching) | M | Stage 1 (depends on R-b5) | W2 |
| R-f6 | `useAsync` defaults + call-site sweep; unify transport vs domain errors | M | Stage 1 + C-2/C-14 | W3 |
| R-f7 | Phased `HostEditorCapabilities`; slim `lspClient` | M | Stage 1 + C-15 | W3 |
| R-f8 | Public barrels + ESLint restricted imports | M | Stage 1 + C-11 | W3 |
| R-f9 | Wire `useEditorValidationStore` with minimal Problems/count UX | M | Stage 1 stand: wire | W4 |
| R-f10 | Document `SearchPanel` as web MVP; parity in R-f13 | L | Stage 1 stand: keep | W4 |
| R-f11 | Selector hygiene in zustand consumers | M | Stage 1 | W3 |
| R-f12 | Optional thin `DesignerHostShell` composer only — else drop | L | Stage 1 (challenged) | W5 |
| R-f13 | Extension vs web parity decision doc | M | Stage 1 | W4 |
| R-f14 | Monaco subpath + Vite + extension bundler alignment | M | Stage 1 + C-12 | W3 |
| R-f15 | Single global save keydown owner | M | Stage 1 + C-13 | W3 |
| R-f16 | Deduplicate workspace double-notify | M | C-1 | W3 |
| R-f17 | English-only UI sweep or policy change + enforcement | **H (policy)** | C-3 | W2 |
| R-f18 | Reduce `as any` in workflow/canvas/Monaco | M | C-16/17/18 | W4 |
| R-f19 | Webview CSP / `unsafe-eval` risk doc + mitigation path | M | S-12 | W4 |
| R-f20 | `VsCodeTransport` `event.origin` validation | M | S-13 | W3 |
| R-f21 | `HttpTransport` (web): check `response.ok`, typed transport errors | M | S-15 | W2 |
| R-f22 | Webview `API_URL` from host injection, not hardcoded | M | S-18 | W2 |
| R-f23 | Upgrade Vite to patched version (CVE GHSA-p9ff-h696-f583) | H | S-19 | W1 |

### 2.3 Architect-reviewer additions (R-a)

| Id | One-liner | Sev | Wave |
|----|-----------|-----|------|
| R-a1 | CI script: `package.json#exports` paths must resolve to real files | H | W1 |
| R-a2 | Method registry contract tests (snapshot names + zod parse) | H | W4 |
| R-a3 | ADR / decision log (trust model, trace, health, aggregation, bootstrap, parity) | M | W5 |
| R-a4 | Written `app-contracts` ↔ `services-core` ↔ `designer-ui` dependency policy | M | W5 |
| R-a5 | Bundler alignment checklist for new exports subpaths | M | W3 (with R-f14) |
| R-a6 | ESLint: forbid `apps/web` direct import of `services-core` | L | W3 |
| R-a7 | Integration tests: body limit + proxy SSRF rejection | M | W1 (with R-b1/R-b3) |

### 2.4 Dropped / merged

- **C-23** (`React.ReactNode` without import) — handled opportunistically inside R-f8/R-f18, no standalone item.
- **C-2 / C-14** — merged into R-f6.
- **C-11** — merged into R-f8.
- **C-12** — merged into R-f14.
- **C-13** — merged into R-f15.
- **C-15** — merged into R-f7.
- **S-7 / S-11** — merged into R-b15.
- **S-8** — merged into R-b14.
- **S-10** — addressed inside R-b3/R-b4.
- **S-14** — merged into R-b16.
- **S-17 / S-18** (env reads) — merged into R-b6 / R-b7.
- **S-20** — informational; tracked in ADR (R-a3) only.

---

## 3. Wave plan (ordered execution)

Each wave is a coherent slice that can be merged independently. Items inside a wave can be parallelized unless a `↳ depends on` arrow says otherwise.

### Wave 1 — Stop the bleeding (security blockers + broken exports + CVE)

Goal: no surface that can be exploited from a non-loopback caller; nothing is shipped with a known phantom export or unpatched CVE.

| Id | What | Files (primary) | Suggested write agent |
|----|------|-----------------|-----------------------|
| R-f23 | Bump Vite ≥ 6.4.2; verify `apps/web` and extension webview build | root `package.json`, `apps/web/package.json`, `apps/extension/package.json`, lockfile | shell |
| R-f1 | Fix or delete the `./modules/project-management` subpath export | `packages/designer-ui/package.json`, `packages/designer-ui/src/index.ts` | frontend-developer |
| R-f2 | Correct `RuntimeHealthSync` placement comment | `packages/designer-ui/src/index.ts` | frontend-developer |
| R-a1 | CI script that walks every `package.json#exports` and asserts the target exists; wire into `pnpm -r lint` | `scripts/check-exports.mjs` (new), root `package.json` | shell + backend-developer |
| R-b1 | Add max-body middleware, return `ERROR_CODES.PAYLOAD_TOO_LARGE` 413 | `apps/server/src/index.ts`, `apps/server/src/rpc/rpc-router.ts`, `packages/app-contracts/src/errors/` | backend-developer |
| R-b2 | Replace permissive `cors()` with explicit allowlist driven by config; loopback default | `apps/server/src/index.ts`, `apps/server/src/shared/config/config.ts` | backend-developer |
| R-b3 | Move SSRF defense into `runtime-proxy.service.ts`: fixed base from config; URL allowlist; reject `runtimeUrl` override unless config flag enabled | `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts`, `packages/services-core/src/registry/method-registry.ts` (`runtime.proxy` handler) | backend-developer |
| R-b14 | RPC access control: drop `listMethods` from public builds (or gate behind debug); per-method capability table; reject `files.*` / `runtime.proxy` / `files.browse` from non-loopback origins by default | `apps/server/src/rpc/rpc-router.ts`, `packages/services-core/src/registry/dispatch.ts`, new `packages/services-core/src/registry/policy.ts` | backend-architect (design) → backend-developer |
| R-b15 | Filesystem jail: `realpath` + session-approved roots; reject path escapes; symlink policy; constrain `createProject.targetPath` | `packages/services-core/src/services/workspace/workspace.service.ts`, `packages/services-core/src/services/project/project.service.ts`, `packages/services-core/src/services/workspace/workspace-analyzer.ts` | backend-developer |
| R-a7 | Integration tests covering R-b1 (oversized body) and R-b3 (proxy URL not in allowlist) | `apps/server/test/` (new), `packages/services-core/test/` | backend-developer |

Exit gate: `pnpm -r build && pnpm -r lint && pnpm -r test` green; manual smoke of web + extension passes; `pnpm audit` no longer reports the Vite finding.

---

### Wave 2 — Contracts, config, English-only, transport hygiene

Goal: every cross-shell concern (env, errors, logs, response handling, copy) has one canonical home.

| Id | What | Files (primary) | Agent |
|----|------|-----------------|-------|
| R-b7 | Move env schema/types into `packages/app-contracts/src/env/`; both shells + server import from there; `services-core` stays orchestration-only | `packages/app-contracts/src/env/`, `apps/server/src/shared/config/config.ts`, `apps/web/src/shared/config/config.ts`, `apps/extension/src/shared/config/` | backend-architect → backend-developer |
| R-b6 | Per-shell config module is the single env reader; remove ad hoc `process.env.VNEXT_RUNTIME_URL` from extension; everything injected via composition root | `apps/extension/src/extension.ts`, `apps/extension/src/shared/config/`, server already done | backend-developer |
| R-b5 | Extend `ERROR_CODES` to cover every backend domain class so frontend can switch on `code` | `packages/app-contracts/src/errors/codes.ts`, callsites in `services-core` services | backend-developer |
| R-b12 | Logger: never log `params`; only `method`, `traceId`, `durationMs`, `code`, bounded `details` | `apps/server/src/shared/middleware/logger.ts`, `packages/services-core/src/registry/dispatch.ts` | backend-developer |
| R-b18 | Expand Pino `redact` paths (`*token*`, `*apiKey*`, `authorization`, `cookie`, etc.) | `apps/server/src/shared/logger/`, optional `packages/app-contracts/src/logging/redact-paths.ts` | backend-developer |
| R-b19 | Server side of HttpTransport contract: every error path returns JSON `ApiResponse` (already mostly true; verify and add tests) | `apps/server/src/shared/middleware/error-handler.ts`, tests | backend-developer |
| R-f5 | UI maps `error.code` → severity/copy/recovery via single typed map; remove string-matching | `packages/designer-ui/src/notifications/`, `packages/designer-ui/src/lib/error/` | frontend-developer ↳ depends on R-b5 |
| R-f17 | English-only UI sweep: replace Turkish literals in `apps/web` and `packages/designer-ui` user-visible strings; ESLint or CI grep enforcement; CLAUDE.md updated only if product decides Turkish stays | `apps/web/src/**`, `packages/designer-ui/src/**`, `eslint.config.mjs` | frontend-developer + ui-ux-designer (copy review) |
| R-f21 | `HttpTransport`: check `response.ok` before `.json()`; map non-2xx to typed transport error consumed by R-f5 | `packages/designer-ui/src/api/HttpTransport.ts` (or wherever the web transport lives), `apps/web/src/shared/transport/` | frontend-developer |
| R-f22 | Replace hardcoded `API_URL: 'https://localhost/api'` with host-injected base URL passed at webview boot | `apps/extension/src/panels/DesignerPanel.ts` (`buildWebviewConfig`), webview-ui boot | frontend-developer |

Exit gate: build/lint/test green; manual matrix — runtime offline, runtime online, invalid project — produces correct `code` + correct UI severity; no Turkish strings remain in user-visible UI; `process.env` only read inside config modules.

---

### Wave 3 — Structural depth (transports, boundaries, observability)

Goal: long-term shape is correct — clean module boundaries, single-owner side effects, hardened bridges.

| Id | What | Files (primary) | Agent |
|----|------|-----------------|-------|
| R-b4 | Phase 1 of proxy headers: server-owned `Content-Type` (not always JSON), no hop-by-hop from params; integration tests | `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts` | backend-developer |
| R-b8 | Single LSP / installer lifecycle owner; remove duplicate `createOmniSharpInstaller`; document chosen owner in ADR | `apps/extension/src/extension.ts`, `apps/extension/src/lsp/`, `packages/lsp-core/` | backend-architect → backend-developer |
| R-b11 | Trace header contract version `trace-v1`; emit `X-Trace-Id`; accept inbound `traceparent` only as link; ADR section | `apps/server/src/shared/middleware/trace-id.ts`, `packages/services-core/src/services/runtime-proxy/`, ADR | backend-developer |
| R-b13 | If `degraded` state lands, ship parser change + UI handling + feature flag in same PR | `packages/services-core/src/services/runtime-proxy/`, `packages/designer-ui/src/modules/workflow-execution/` | backend-developer + frontend-developer |
| R-b16 | LSP WebSocket: origin check (where applicable), max message size, connection limits, optional shared secret for non-loopback | `packages/lsp-core/`, `apps/server/src/lsp/` (if applicable), `apps/extension/src/lsp/` | backend-developer |
| R-b17 | Spawn template/script children with explicit env allowlist (not full `process.env`) | `packages/services-core/src/services/template/`, `packages/services-core/src/services/scripts/` | backend-developer |
| R-f4 | Add React error boundaries at route + critical feature scope; rename non-React designer panels (e.g. "Runtime failure panel", "Workspace operation error") to avoid term collision | `apps/web/src/app/`, `packages/designer-ui/src/notifications/`, route files | frontend-developer |
| R-f6 | `useAsync`: call-site sweep; classify each consumer (workspace/editor/passive); flip defaults only after sweep; merge C-2/C-14 here | `packages/designer-ui/src/hooks/useAsync*`, every `useAsync(` consumer | frontend-developer |
| R-f7 | Phased extraction: define `HostEditorCapabilities` interface → web adapter (no-op) → extension adapter with `event.origin` validation (R-f20) → delete probing branch from `lspClient` | `packages/designer-ui/src/lsp/lspClient.ts`, `apps/web/src/shared/host/`, `apps/extension/webview-ui/src/host/` | frontend-architect → frontend-developer |
| R-f8 | Public barrels + ESLint `no-restricted-imports` between feature modules; agree exception list before flipping | `packages/designer-ui/src/index.ts`, `packages/designer-ui/src/modules/*/index.ts`, `eslint.config.mjs` | frontend-developer |
| R-a6 | Same ESLint rule extended: `apps/web/**` cannot import from `packages/services-core/**` | `eslint.config.mjs` | frontend-developer |
| R-f11 | Zustand selector hygiene sweep — replace whole-store reads with selector functions in `apps/web` workspace pages | `apps/web/src/modules/project-workspace/`, store consumers | frontend-developer |
| R-f14 | Move Monaco out of generic `ui/`; new export subpath; align Vite `optimizeDeps` and extension bundler config; update R-a5 checklist | `packages/designer-ui/src/ui/JsonCodeField.tsx`, new `packages/designer-ui/src/editor/`, `packages/designer-ui/package.json`, `apps/web/vite.config.ts`, `apps/extension/esbuild.config.*` | frontend-developer |
| R-a5 | Document the bundler alignment checklist beside `package.json#exports` editing instructions | `docs/architecture/bundler-checklist.md` (new) | frontend-developer |
| R-f15 | Consolidate four global save-keydown handlers into one owner via existing `useSaveFile` / command layer | `apps/web/src/**`, `packages/designer-ui/src/**` (search `Ctrl+S` / `meta+s`) | frontend-developer |
| R-f16 | Single notification path per workspace mutation (drop validation+onError double toast); add a no-double-toast test/manual matrix | `apps/web/src/modules/project-workspace/`, `packages/designer-ui/src/notifications/` | frontend-developer |
| R-f20 | `VsCodeTransport`: validate `MessageEvent.origin` against host-supplied allowlist; merges with R-f7 phase 3 | `packages/designer-ui/src/api/VsCodeTransport.ts`, `apps/extension/webview-ui/src/host/` | frontend-developer |

Exit gate: `pnpm -r build && pnpm -r lint && pnpm -r test` green; manual matrix — extension save and web save both work via single command path; web app opens runtime offline cleanly; extension webview rejects cross-origin `postMessage`.

---

### Wave 4 — Polish, dead-code resolution, type safety, contract tests

Goal: remove ambiguous public surfaces, increase type safety, add CI signal for contract drift.

| Id | What | Files | Agent |
|----|------|-------|-------|
| R-f9 | Wire `useEditorValidationStore` to Monaco `onDidChangeMarkers`; surface error/warning counts in editor chrome / Problems badge (MVP) | `packages/designer-ui/src/store/useEditorValidationStore.ts`, `packages/designer-ui/src/modules/code-editor/`, consumer UI | frontend-developer |
| R-f10 | Document `SearchPanel` scope as "web designer scoped text search"; cross-link to R-f13 parity doc | `apps/web/src/modules/project-search/`, `docs/architecture/web-extension-parity.md` | frontend-developer |
| R-f13 | Parity decision doc: search, save, LSP, notifications, validation — what is web-only, extension-only, shared | `docs/architecture/web-extension-parity.md` (new) | frontend-architect |
| R-f3 | Suspense boundaries with deliberate skeleton fallbacks for lazy routes | `apps/web/src/app/`, route registry | frontend-developer |
| R-f18 | Reduce `as any` in workflow/canvas/Monaco; narrow `unknown` at IO boundaries; enable `@typescript-eslint/no-explicit-any` per touched folder | `packages/designer-ui/src/modules/workflow-canvas/**` and similar | frontend-developer |
| R-f19 | Document webview CSP `'unsafe-eval'` risk acceptance + mitigation path (Monaco constraint) | `docs/security/webview-csp.md` (new) | security-reviewer + frontend-architect |
| R-b9 | Add CI golden-test pass: every registered RPC method has fixture(s) where `paramsSchema.parse` and `resultSchema.parse` succeed; no prod runtime cost | `packages/services-core/test/registry/contract.test.ts` (new) | backend-developer |
| R-a2 | Snapshot test for the method-name list: any add/remove/rename surfaces in PR diff | same file as R-b9 | backend-developer |

Exit gate: lint denies new `any` in touched folders; contract tests fail when a method is renamed without updating snapshot; parity doc reviewed by both architect roles.

---

### Wave 5 — Documentation, dependency policy, optional shell

Goal: capture the trust model and boundaries so future contributors do not erode them.

| Id | What | Files | Agent |
|----|------|-------|-------|
| R-a3 / R-b10 | ADR set: `001-trust-model.md`, `002-trace-headers.md`, `003-runtime-health-degraded.md`, `004-bootstrap-aggregation.md`, `005-error-taxonomy.md` | `docs/architecture/adr/` (new) | backend-architect + frontend-architect |
| R-a4 | Dependency policy: `app-contracts` (wire DTOs/errors/env/health), `services-core` (dispatch + services, no env parsing), `designer-ui` (UI ports, no server secrets), `apps/*` (composition + shell-specific) | `docs/architecture/dependency-policy.md` (new) | backend-architect |
| R-f12 | Optional thin `getDesignerRootProviders(children)` exporter — only if it stays a pure ordered composer with zero new providers; otherwise document provider order in ADR-006 and DROP | `packages/designer-ui/src/app/` | frontend-architect (decision) → frontend-developer (impl or DROP) |

Exit gate: ADR set merged; dependency policy referenced from `CLAUDE.md`; R-f12 decision recorded one way or the other.

---

## 4. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Wave-1 access-control changes break existing local workflows because UI silently relies on `files.*` from any origin | Med | High | Default policy = loopback-allowed; ship feature flag for non-loopback bind; extension webview uses an authenticated channel separate from public RPC |
| 2 | Wave-2 env-schema move causes circular dep between `app-contracts` and `services-core` | Med | Med | Place env in a thin sub-export under `app-contracts/env`; do not let `services-core` consume the runtime, only the type |
| 3 | R-f6 `useAsync` default flip silently swallows or doubles toasts | High | Med | Mandatory call-site sweep before flip; merge C-2/C-14 evidence; add a no-double-toast test in R-f16 |
| 4 | R-f14 Monaco subpath split breaks extension webview bundle | Med | High | R-a5 checklist must be executed in same PR; add CI smoke `vite build` + `extension package` |
| 5 | R-b14 capability gating accidentally locks out `apps/web` in non-loopback dev | Med | High | Loopback bind = default permissive; capability denial returns clear `ApiFailure` with `ERROR_CODES.UNAUTHORIZED`, not 404 |
| 6 | R-f17 English-only sweep regresses Turkish documentation tooling | Low | Low | Sweep targets user-visible UI strings only; docs/comments/test names exempt |
| 7 | R-b3 SSRF allowlist too narrow → breaks legitimate runtime-proxy paths | Med | Med | Allowlist comes from config, default mirrors today's runtime URL; integration test covers happy path |
| 8 | Vite upgrade (R-f23) breaks `vite-tsconfig-paths` or React plugin combos | Low | Med | Upgrade in Wave 1 with explicit smoke build; revert isolated if needed |

---

## 5. Sequencing constraints

```
R-b5 ──► R-f5
R-b7 ──► R-b6, R-f5 (env types)
R-b1 ──► R-a7 (test target)
R-b3 ──► R-a7 (test target)
R-b14 ──► R-b15 (policy precedes implementation of jail)
R-f7  ──► R-f20 (extension adapter is the natural home for origin check)
R-f8  ──► R-f11 (selector sweep happens after public barrels are stable)
R-f14 ──► R-a5 (checklist applied during the move)
R-b9  ──► R-a2 (same test file)
R-a3  ──► R-b10, R-f13, R-b13 (ADRs are the contract-of-record)
```

If any item must slip across waves, it slips together with whatever the arrow points at.

---

## 6. Suggested implementation pipeline

For each wave, the recommended subagent dispatch pattern:

1. **`backend-architect`** / **`frontend-architect`** — produce the wave-specific design notes (ADR drafts, capability tables, env schema shape, ESLint rule diff, etc.). Read-only.
2. **`backend-developer`** / **`frontend-developer`** — implement the items in parallel where the file sets do not overlap.
3. **`code-reviewer`** + **`security-reviewer`** (Wave 1 + Wave 3 only) — review the diff before merge.
4. **`shell`** — run `pnpm -r build && pnpm -r lint && pnpm -r test`, `pnpm audit`, and the new export-graph + contract tests.

Wave-2 R-f17 (English sweep) and Wave-4 R-f13 (parity doc) additionally pull in **`ui-ux-designer`** for copy / parity review.

---

## 7. Out-of-scope (intentionally not in this plan)

- LSP server feature work beyond hardening (R-b16) and lifecycle clean-up (R-b8).
- Other workspace packages (`packages/lsp-core`, `packages/vnext-types`, `packages/app-contracts` beyond what is named) — observed for dependency impact only.
- Multi-tenant or SaaS deployment of the server. The plan covers the loopback dev posture and identifies the items required to lift the loopback assumption later (`BLOCKER-FOR-NON-LOOPBACK` markers).
- Telemetry/metrics product (only structured logging + trace headers are in scope).
- Renovate / Dependabot setup beyond R-f23.

---

## 8. Acceptance for the audit

This audit is considered "closed" when:

- All Wave 1 items merged and exit gate passes.
- ADR set (Wave 5 R-a3) at least includes 001-trust-model and 005-error-taxonomy.
- `CLAUDE.md` updated with the dependency policy reference (R-a4) and the trust-model note.
- A follow-up issue exists for any item that was DROP-ed (R-f12 if the team chose drop, R-b9 if the team chose CI-only).
