# Extension Instructions

> **Scope:** `apps/extension` (VS Code extension host + webview composition). Load alongside [`./CLAUDE.md`](./CLAUDE.md). [`.cursor/rules/config-singleton.mdc`](./.cursor/rules/config-singleton.mdc) auto-loads when editing `apps/extension/src/shared/config.ts`. Shared skills: [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md).

## Goal

VS Code extension that **hosts the designer webview**, runs the **shared LSP stack**, and exposes **file / runtime** capabilities to the webview via `services-core`, with per-shell config and hardening consistent with the trust model.

## Composition root

`src/composition/services.ts` constructs services from **`@vnext-forge/services-core`**, wired with **`extensionConfig`** from the extension's validated singleton. This is the composition root for service lifetime and dependencies. `src/MessageRouter.ts` then bridges webview `postMessage` requests to **`dispatchMethod`** using the same registry consumed by `apps/server` — there is no per-method switch case in the extension shell. Method ids on the wire use the canonical slash-form `<domain>/<action>` (e.g. `projects/list`, `files/read`).

## Per-shell config

`src/shared/config.ts` — **Zod-validated singleton**. Source priority:

1. VS Code settings — `vscode.workspace.getConfiguration('vnextForge')`
2. `process.env`
3. Built-in defaults

New user-facing settings need a matching entry under `contributes.configuration.properties` in **`apps/extension/package.json`** (source of truth for schema and defaults).

## Settings catalog

Orientation only — **`apps/extension/package.json`** is authoritative.

| Setting key | Role |
|-------------|------|
| `vnextForge.vnextRuntimeUrl` | Default runtime base URL for the runtime-proxy service; may be overridden by `VNEXT_RUNTIME_URL` env where documented. |
| `vnextForge.runtimeAllowedBaseUrls` | Extra base URLs allowed for runtime-proxy; default runtime URL remains implicitly allowed. |
| `vnextForge.allowRuntimeUrlOverride` | When `true`, callers may override proxy target via request parameter (off by default — SSRF-style misuse). |
| `vnextForge.runtimeRevalidationMinIntervalSeconds` | Minimum seconds between background runtime revalidation requests in the designer UI; surfaces to webview (e.g. `RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS` in injected config). |
| `vnextForge.lsp.autoInstall` | Auto-install C# language server when a vnext workspace is detected. |

## LSP wiring

`src/extension.ts` uses **`createExtensionHostLspStack`** from **`@vnext-forge/lsp-core`** — **single LSP installer owner** for the extension host. Details: [`./CLAUDE.LSP-CORE.md`](./CLAUDE.LSP-CORE.md).

## Webview composition

- `src/panels/DesignerPanel.ts` creates the webview, injects **`window.__VNEXT_CONFIG__`** (includes **`POST_MESSAGE_ALLOWED_ORIGINS`** and runtime revalidation interval).
- Webview UI is the **built `apps/web` bundle**, output to **`apps/extension/dist/webview-ui/`** (Vite build from the web app).
- CSP includes **`'unsafe-eval'`** for Monaco; risks and mitigations: [`./docs/security/webview-csp.md`](./docs/security/webview-csp.md).

## Child processes

`src/adapters/vscode-process.ts` uses **`buildChildEnv`** from `@vnext-forge/services-core/lib/child-env`. **Never** spread full `process.env` into children.

## Activation events + commands

From `apps/extension/package.json`:

- **Activation:** `workspaceContains:vnext.config.json`, `onCommand:vnextForge.open`, `onCommand:vnextForge.openDesigner`, `onCommand:vnextForge.createProject`, `onCommand:vnextForge.createComponent`.
- **Commands:** `vnextForge.open`, `vnextForge.openDesigner`, `vnextForge.createProject`, `vnextForge.createComponent` (see contributes.commands and menus).

## Build

- **Extension host:** esbuild bundles `src/extension.ts` → **`dist/extension.js`** (CJS, Node 18). **`vscode`** is external.
- **`@burgan-tech/vnext-template`:** external; build copies it to **`dist/vendor/`** with **`dereference: true`** so pnpm symlinks resolve to real files.
- **Webview:** Vite build of **`apps/web`** → **`apps/extension/dist/webview-ui/`**.

## Error / trace contract

Method handlers throw **`VnextForgeError`**; **`MessageRouter`** catches via `dispatchMethod` and serializes failures to **`ApiFailure`** including **`traceId`** (extension-side trace id source per [`./docs/architecture/adr/002-trace-headers.md`](./docs/architecture/adr/002-trace-headers.md)). See [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md) and [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md).

## Dependency boundaries

[Dependency policy skill](./.cursor/skills/shared/dependency-policy/SKILL.md). Allowed packages include `@vnext-forge/app-contracts`, `@vnext-forge/vnext-types`, `@vnext-forge/services-core`, `@vnext-forge/lsp-core`; webview imports **`@vnext-forge/designer-ui`**. **`apps/extension`** is the natural place that combines **`services-core`**, **`lsp-core`**, and the **`vscode`** API.

## Don'ts

- No direct **`process.env`** reads outside **`src/shared/config.ts`** (and the config singleton pattern).
- No **`process.env`** spread into child processes.
- Do not add **per-page Ctrl+S** listeners — **designer-ui** owns global save.
- Do not **bypass** the webview **postMessage origin** check.

## Cross-references

- ADRs: [`001-trust-model`](./docs/architecture/adr/001-trust-model.md), [`002-trace-headers`](./docs/architecture/adr/002-trace-headers.md), [`005-error-taxonomy`](./docs/architecture/adr/005-error-taxonomy.md)
- [`./docs/security/webview-csp.md`](./docs/security/webview-csp.md)
- [`./docs/architecture/web-extension-parity.md`](./docs/architecture/web-extension-parity.md)
- [`./CLAUDE.LSP-CORE.md`](./CLAUDE.LSP-CORE.md), [`./CLAUDE.SERVICES-CORE.md`](./CLAUDE.SERVICES-CORE.md)
