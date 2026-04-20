# services-core Instructions

> **Scope:** `packages/services-core` (RPC method registry, dispatcher, services, child-env helpers; consumed by `apps/server` and `apps/extension`). [`.cursor/rules/rpc-method-policy.mdc`](./.cursor/rules/rpc-method-policy.mdc) auto-loads when editing registry or server RPC wiring. Skills: [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md).

## Goal

One **declarative method registry** and **transport-agnostic** services layer that **both shells** (`apps/server`, `apps/extension`) call through `dispatchMethod`. No duplicate RPC contracts per host.

## Folder layout

```text
packages/services-core/src/
  registry/          # method-registry.ts, dispatch.ts
  services/        # domain services (e.g. runtime-proxy/, files/, …)
  lib/             # child-env.ts and other shared helpers
```

## Method registry contract

Each method is declared in `registry/method-registry.ts` with the fields below. Full enforcement (fixtures, snapshots, capability rules) is in [`.cursor/rules/rpc-method-policy.mdc`](./.cursor/rules/rpc-method-policy.mdc).

| Field | Purpose |
|-------|---------|
| `name` | Stable string `<domain>.<action>` (e.g. `projects.list`, `projects.getWorkspaceBootstrap`, `runtime.proxy`, `files.read`). |
| `paramsSchema` | Zod schema for input validation. |
| `resultSchema` | Zod schema for output validation. |
| `capabilities` | `('reads-files' \| 'writes-files' \| 'spawns-process' \| 'talks-runtime')[]`; **empty** = capability-free (“pure”). |
| `handler` | Implementation invoked after validation and capability check. |
| `description` | Human-oriented summary for docs and tooling. |

## Dispatch + capability policy

`dispatchMethod(name, params, ctx)` (see `registry/dispatch.ts`):

- Resolves the method by `name`; **unknown** methods throw `VnextForgeError` with code **`API_NOT_FOUND`**.
- Enforces **capabilities** before the handler runs; callers cannot skip this by importing handlers directly for RPC-shaped calls.

## Aggregator pattern

`projects.getWorkspaceBootstrap` consolidates many initial workspace fetches into one RPC. When to extend it vs add a new method: see [`./docs/architecture/adr/004-bootstrap-aggregation.md`](./docs/architecture/adr/004-bootstrap-aggregation.md). Prefer extending the aggregator when the payload is still “initial shell bootstrap”; add a separate method when the use case is unrelated or would bloat the bootstrap contract.

## Runtime-proxy

`services/runtime-proxy/runtime-proxy.service.ts` exposes **`proxy(...)`** and **`buildRuntimeProxyOutboundHeaders(...)`**.

- The **URL allowlist** is enforced by the **factory** (SSRF defense); no unbounded forward. Trust model: [`./docs/architecture/adr/001-trust-model.md`](./docs/architecture/adr/001-trust-model.md).
- **Hop-by-hop** headers are stripped (`connection`, `keep-alive`, `proxy-authenticate`, etc.).
- **`Content-Type: application/json`** is set only for non-GET/HEAD requests that carry a body.
- **`X-Trace-Id`** is forwarded on outbound calls per [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md) / [`ADR 002`](./docs/architecture/adr/002-trace-headers.md).

## child-env helper

- **`buildChildEnv(allowlist, overrides)`** — builds a safe environment for child processes.
- **`DEFAULT_CHILD_PROCESS_ENV_ALLOWLIST`** — shared default allowlist constant (`lib/child-env.ts`).
- **Required** whenever spawning subprocesses from server or extension adapters: use this helper; **never** spread full `process.env`.

## Contract tests

- **`packages/services-core/test/registry-contract.test.ts`** — snapshot of sorted method names; per-method validation against `paramsSchema` and `resultSchema` using JSON fixtures under **`packages/services-core/test/fixtures/`**.
- **New methods** MUST add a fixture and update the snapshot in the **same PR**.

## Dependency policy

This package may depend on **`@vnext-forge/app-contracts`** only. No imports from `apps/*` or other workspace packages. Details: [dependency-policy skill](./.cursor/skills/shared/dependency-policy/SKILL.md).

## Don'ts

- No **`apps/*`** (or other workspace package) imports.
- No **direct `process.env` reads** inside service implementations — configuration is supplied through the shell’s composition / context.
- No **bypass** of the dispatcher’s capability check (e.g. calling handlers directly from transport code for RPC-shaped entry points).

## Cross-references

- ADRs: [`001-trust-model`](./docs/architecture/adr/001-trust-model.md), [`002-trace-headers`](./docs/architecture/adr/002-trace-headers.md), [`004-bootstrap-aggregation`](./docs/architecture/adr/004-bootstrap-aggregation.md), [`005-error-taxonomy`](./docs/architecture/adr/005-error-taxonomy.md)
- [Dependency policy (doc)](./docs/architecture/dependency-policy.md)
- Consumers: [`./CLAUDE.SERVER.md`](./CLAUDE.SERVER.md), [`./CLAUDE.EXTENSION.md`](./CLAUDE.EXTENSION.md)
