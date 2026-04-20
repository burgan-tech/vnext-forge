# vnext-forge - Project Context

Workflow designer delivered as a **VS Code extension**. React webview (Vite) + Monaco editor in the webview; Node.js extension host replaces the former BFF server. Monorepo with pnpm workspaces + Turborepo.

## Workspace-specific context (CLAUDE.\*.md)

This file is the repo-wide context. Workspace-specific context lives next to it as
`CLAUDE.<WORKSPACE>.md` files at the repo root. When working inside a given workspace,
also load the matching file:

- **`apps/web/`** → see [`./CLAUDE.WEB.md`](./CLAUDE.WEB.md)
  Web client (React 19 + Vite 6) architecture, module-based vertical slice rules,
  API access via Hono RPC client, `useAsync` async flows, error handling, logging.
- **`apps/server/`** → see [`./CLAUDE.SERVER.md`](./CLAUDE.SERVER.md)
  Active Hono RPC backend for the web shell. Loopback-bound by default; hardened
  with body limit, CORS allowlist, capability policy, runtime-proxy SSRF defense,
  filesystem jail, LSP WebSocket policy, child-env allowlist (Wave 1–3).
- **`apps/extension/`** → see [`./CLAUDE.EXTENSION.md`](./CLAUDE.EXTENSION.md)
  VS Code extension host (esbuild bundle) and webview composition; per-shell
  config, runtime-proxy URL allowlist, LSP installer ownership.
- **`packages/designer-ui/`** → see [`./CLAUDE.DESIGNER-UI.md`](./CLAUDE.DESIGNER-UI.md)
  Shared React UI library (canvas, editor, hooks, host adapters, notification
  port). Public barrels + `./editor` subpath; single global save shortcut owner;
  HostEditorCapabilities; postMessage origin validation.
- **`packages/services-core/`** → see [`./CLAUDE.SERVICES-CORE.md`](./CLAUDE.SERVICES-CORE.md)
  RPC method registry, dispatch, services. Per-method capability policy;
  runtime-proxy URL allowlist; child-env helper. Imports `@vnext-forge/app-contracts` only.
- **`packages/lsp-core/`** → see [`./CLAUDE.LSP-CORE.md`](./CLAUDE.LSP-CORE.md)
  Shared LSP wiring; single extension-host LSP stack factory; consumed by
  `apps/extension` and `apps/server`.
- **`packages/app-contracts/`**, **`packages/vnext-types/`** — covered in the
  "Shared Packages" section below; pure types/schemas, no per-package file.

Skills (auto-loaded by Cursor) live under [`./.cursor/skills/*/SKILL.md`](./.cursor/skills).
Each skill's frontmatter declares its scope (web, server, or repo-wide); follow only the
skills whose scope matches the workspace you are editing.

## Architecture references

- [Dependency policy](./docs/architecture/dependency-policy.md)
- [ADR 001 — Trust model](./docs/architecture/adr/001-trust-model.md)
- [ADR 002 — Trace headers (`trace-v1`)](./docs/architecture/adr/002-trace-headers.md)
- [ADR 003 — Runtime health (`degraded` deferred)](./docs/architecture/adr/003-runtime-health-degraded.md)
- [ADR 004 — Workspace bootstrap aggregation](./docs/architecture/adr/004-bootstrap-aggregation.md)
- [ADR 005 — Error taxonomy](./docs/architecture/adr/005-error-taxonomy.md)
- [ADR 006 — Designer root provider order (R-f12 dropped)](./docs/architecture/adr/006-provider-order.md)
- [Web vs extension parity](./docs/architecture/web-extension-parity.md)
- [Bundler alignment checklist](./docs/architecture/bundler-checklist.md)

Default deployment is single-developer workstation, server bound to loopback. See [`docs/architecture/adr/001-trust-model.md`](./docs/architecture/adr/001-trust-model.md) for the items required to lift that assumption.

## Conditional rules and skills

In addition to the always-on rules under `.cursor/rules/*.mdc` (subagent dispatch, plan-mode policy), the following **auto-trigger** based on file globs or task content. Read them when their scope matches.

| Type | Path | Auto-trigger | Purpose |
|------|------|--------------|---------|
| Rule | `.cursor/rules/config-singleton.mdc` | files matching `**/shared/config/config.ts` or `**/shared/config.ts` | `process.env` / `import.meta.env` only inside the config module |
| Rule | `.cursor/rules/server-hardening.mdc` | `apps/server/src/**` | Body limit, CORS allowlist, capability policy, error-handler invariants must stay intact |
| Rule | `.cursor/rules/rpc-method-policy.mdc` | `packages/services-core/src/registry/**`, `apps/server/src/rpc/**` | Every new RPC method has `paramsSchema`, `resultSchema`, capability tag, fixture (R-b9/R-a2) |
| Skill | `.cursor/skills/shared/error-taxonomy/SKILL.md` | any error/handler/throw work | `ERROR_CODES`, `VnextForgeError`, `error-presentation` mapping |
| Skill | `.cursor/skills/shared/trace-headers/SKILL.md` | any HTTP/transport/middleware work | `trace-v1` contract; never adopt `traceparent` |
| Skill | `.cursor/skills/shared/dependency-policy/SKILL.md` | any cross-package import or barrel change | Allowed import directions, ESLint enforcements |

## Project Goal

The main purpose of this project is to provide the **workflow design and management interface** for the vnext engine ecosystem, packaged as a VS Code extension (`burgan-tech.vnext-forge`). It is intentionally built and delivered as an independent product — not a library or embedded widget.

The UI covers end-to-end workflow management: creating and editing workflow definitions in JSON, visual canvas design, Monaco-based code editing, real-time validation, runtime connection, simulation, and project scaffolding.

### User-visible language (English only — strict)

All **end-user-facing** and **integrator-facing** text in this repository must be written in **English (US style is fine)**. Treat this as a non-negotiable product contract, not a preference.

**In scope (must be English):**

- UI copy: labels, buttons, menus, dialogs, drawers, tabs, panel and sidebar titles, section headings, empty states, placeholders, tooltips, and similar chrome.
- Feedback: toasts, snackbars, banners, inline alerts, success and confirmation messages.
- Errors shown to humans: `VnextForgeError.toUserMessage()`, `ApiFailure.error.message`, validation messages returned to the client, Monaco/editor diagnostics titles or descriptions that surface in the product UI, and any other string intended for display in the app.
- Naming that users see: wizard and dialog titles, step names, list column headers, status bar text, and feature names when they appear as UI strings (file and symbol names in code may follow existing code conventions; **visible** names stay English).
- Accessible strings tied to the UI: `aria-label`, `aria-description`, live region text, and visible `title` attributes when they convey UI meaning.

**Out of scope (not governed by this rule):**

- Team communication, ad-hoc notes, or docs outside the shipped product unless a doc is explicitly meant as end-user documentation (keep that English too).
- Log-only diagnostic text may stay English for consistency with code and tooling; do not route raw internal errors to the UI.

When adding or changing strings, default to English. Do not ship Turkish or other locale strings in UI, API user messages, or user-visible panel names unless the project later adds a formal i18n layer and this rule is explicitly revised.

---

### Cross-platform setup (macOS, Linux, Windows)

The repo is intended to run the same way on macOS, Linux, and Windows.

**Toolchain**

- Install a current **Node.js LTS** (align major versions across the team when debugging native or tooling issues).
- Use **pnpm** at the version pinned in the root `package.json` (`packageManager` field). Prefer enabling it with **Corepack** (`corepack enable` then `corepack prepare pnpm@<pinned> --activate`) so everyone gets the same package manager.
- Run installs and scripts from the **repository root** (`pnpm install`, `pnpm build`) so Turborepo sees all workspaces.

**Dev workflow**

- `apps/web` (Vite dev server): default port **3000** — used for isolated UI development only. In extension mode the webview is served from `dist/webview-ui/`, not this server.
- `apps/extension` (esbuild watch): `pnpm --filter vnext-forge dev` — rebuilds extension host on save.
- For a full development loop, build the web bundle once (`pnpm --filter @vnext-forge/web build`) and then use extension host watch mode.

**Environment variables & runtime config**

Each app workspace has a single `.env` file (no mode-specific `.env.dev` /
`.env.prod` variants) and a single Zod-validated `config` singleton. Defaults
live in the schema, so a missing `.env` is never fatal — the app boots, logs
a warning, and uses the built-in defaults.

- All `.env*` files are **git-ignored** (root `.gitignore`). Treat each `.env`
  as a per-developer override file; commit the defaults to the schema instead.
- The `config` object is a module-level singleton: importing it from anywhere
  yields the same validated instance. It is also attached to
  `globalThis.__vnextConfig` (i.e. `window.__vnextConfig` in the browser) for
  dev-tools / REPL inspection — application code must always go through the
  import.
- To add a new setting: extend `ConfigSchema` (with default), wire it from
  `process.env` / `import.meta.env` inside `loadConfig()`, and document it in
  the workspace `.env` file.

| Workspace             | Config module                              | `.env` location          | Default loader                                  |
| --------------------- | ------------------------------------------ | ------------------------ | ----------------------------------------------- |
| `apps/server`         | `src/shared/config/config.ts`              | `apps/server/.env`       | `tsx watch --env-file-if-exists=.env src/index.ts` |
| `apps/web`            | `src/shared/config/config.ts`              | `apps/web/.env`          | Vite (only `VITE_*` keys reach the bundle)      |
| `apps/extension`      | runtime config injected via `window.__VNEXT_CONFIG__` from `DesignerPanel`; no `.env` file (no HTTP server, no `PORT`). Logs go to the VS Code Output Channel (`vnext-forge`). |

Read settings via `import { config } from '@/shared/config/config'`; do not
read `process.env` / `import.meta.env` directly outside the config module.

**Filesystem and paths**

- **Case sensitivity**: Linux (and macOS on typical APFS) can be case-sensitive. Import paths and filenames must match **exact casing** everywhere; a rename that only changes case can break CI or another OS.
- **Project paths**: the extension host resolves workspace paths via Node.js APIs; use `path.join` / `path.normalize` when composing filesystem paths — never assume `\` vs `/`.
- **Line endings**: prefer consistent LF. If Git rewrites line endings on Windows, watch for issues with shell scripts.

**Windows-specific notes**

- Use **PowerShell** or **Git Bash** for bash-style snippets. The `clean` scripts use `rm -rf` which requires a Unix shell or WSL on Windows.
- If installs fail with path-length errors, enable long paths in Windows or clone to a shorter path.

**macOS / Linux notes**

- Ensure Node/pnpm are on `PATH` for both terminal and IDE integrated terminals.
- Native addons may need Xcode Command Line Tools (macOS) or `build-essential` (Debian/Ubuntu).

---

### Shared Packages

#### `packages/vnext-types` → `@vnext-forge/vnext-types`

Domain model types. Workflow, State, Transition, Task, Schema, View, Function, Extension, Diagram, and Config types, plus constants (state-types, trigger-types, task-types) and utilities (csx-codec, version).

**Workspace config canonical types** (`types/config.ts`): The single source of truth for the `vnext.config.json` shape. All layers import these types from here or through a re-export.

- `VnextWorkspaceConfig` — full normalized config
- `VnextWorkspacePaths`, `VnextWorkspaceExports`, `VnextWorkspaceExportsMeta`, `VnextWorkspaceDependencies`, `VnextWorkspaceReferenceResolution` — sub-shapes

Do not duplicate these types in app-local code. Extension handler files import them via `@workspace/types.js`; web consumer files import them via `@vnext-forge/app-contracts`.

- Depends on no other package (leaf node)
- Used by `apps/web` and `apps/extension`

---

#### `packages/app-contracts` → `@vnext-forge/app-contracts`

Shared contracts used by both the web app and the extension host.

**1. ApiResponse<T>** (`response/envelope.ts`):

```ts
ApiSuccess<T>  -> { success: true; data: T }
ApiFailure     -> { success: false; error: { code, message, traceId } }
```

Every handler response is wrapped in this envelope. The web layer performs a discriminated union check via `response.success`. The same envelope is used for both HTTP (legacy) and `postMessage` transport.

**2. VnextForgeError** (`error/vnext-error.ts`):
The shared error type used across all application layers. Every `throw` should be a `VnextForgeError`.

- `code: ErrorCode` — `FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`
- `context.source` — which function threw the error, e.g. `"FileService.writeFile"`
- `context.layer` — `presentation | feature | domain | infrastructure | transport`
- `toLogEntry()` — plain object for logging (extension Output Channel)
- `toUserMessage()` — message safe to show to the user (raw `.message` must never be shown)

**3. Workspace config builder** (`vnext-workspace-defaults.ts`):
Version constants and `buildVnextWorkspaceConfig()` factory. Also re-exports all canonical workspace config types from `@vnext-forge/vnext-types`.

- Depends on `@vnext-forge/vnext-types`

---

### Current Ownership

Business logic that formerly lived in `apps/server` now lives in `apps/extension/src/handlers/`:

- `handlers/project/*` — project list, create, delete, import
- `handlers/workspace/*` — workspace path resolution, config reading, file tree, file I/O
- `handlers/validate/*` — workflow and component validation (wraps `@burgan-tech/vnext-schema` via AJV)
- `handlers/template/*` — project scaffolding via `@burgan-tech/vnext-template`
- `handlers/runtime-proxy/*` — proxies requests to the external vnext runtime engine

Web-side module ownership is unchanged:

- `apps/web/src/modules/project-management/*` — project list, create/import/delete, project-facing API/state flows
- `apps/web/src/modules/project-workspace/*` — active workspace, file tree, workspace orchestration, sidebar state
- `apps/web/src/modules/code-editor/*` — Monaco setup, editor-side context handling, workflow context bridges
- `apps/web/src/modules/workflow-validation/*` — client-side validation UX and editor feedback
- `apps/web/src/modules/canvas-interaction/*`, `workflow-execution/*`, `save-workflow/*`, `save-component/*` — remaining workflow editing and execution flows

Shared packages are listed below. See [`./docs/architecture/dependency-policy.md`](./docs/architecture/dependency-policy.md) for the canonical rules and Mermaid diagram.

**Package dependency flow (allowed directions only):**

```text
vnext-types (leaf, no deps)
  └─> app-contracts (Zod schemas, ApiResponse, ErrorCode, env primitives)
        ├─> services-core (RPC registry, dispatch, runtime-proxy, child-env)
        │     └─> apps/server, apps/extension
        ├─> lsp-core (extension-host LSP stack factory)
        │     └─> apps/server, apps/extension
        ├─> designer-ui (React UI library; ./editor subpath; HostEditorCapabilities)
        │     └─> apps/web, apps/extension/webview-ui
        └─> apps/web, apps/extension
```

**Forbidden directions** (enforced by ESLint where possible):

- `apps/web` must **not** import `@vnext-forge/services-core` or any deep path under it.
- `apps/web` must **not** import from `@vnext-forge/designer-ui/dist/**`.
- `apps/*` must not import each other.
- `packages/*` must not import `apps/*`.

---

### apps/extension

VS Code extension. esbuild bundles the extension host as a single CommonJS file (`dist/extension.js`).

```text
src/
  extension.ts              -> Activation entry point; wires detector, commands, LSP bootstrap
  commands.ts               -> VS Code commands (open, openDesigner, createProject, createComponent)
  workspace-detector.ts     -> Detects vnext.config.json roots; owns the `vnextForge.isVnextWorkspace` context key
  file-router.ts            -> Host-side file → designer-route resolver (mirror of web FileRouter.ts)
  lsp-bootstrap.ts          -> Background LSP install on activation (progress + autoInstall setting)
  MessageRouter.ts          -> Dispatches postMessage requests to handlers; routes LSP events

  handlers/
    project/                -> Project CRUD operations
    workspace/              -> File I/O, workspace config, file tree, path resolution
    validate/               -> Workflow/component validation (AJV + @burgan-tech/vnext-schema)
    template/               -> Project scaffolding (executes @burgan-tech/vnext-template/init.js)
    runtime-proxy/          -> HTTP proxy to external vnext runtime engine

  lsp/
    lsp-bridge.ts           -> OmniSharp session lifecycle (connect / message / disconnect)
    lsp-workspace.ts        -> Workspace path helpers for OmniSharp
    omnisharp-installer.ts  -> Lazy download of OmniSharp binaries
    omnisharp-process.ts    -> OmniSharp process management
    WebviewLspManager.ts    -> Bridges LSP socket events to webview postMessage

  panels/
    DesignerPanel.ts        -> Creates/reveals the designer webview panel; serves webview HTML;
                               injects window.__VNEXT_CONFIG__; rewrites asset URIs;
                               forwards host-originated `open-editor` messages to the webview UI
    lsp-transport.ts        -> Per-session postMessage transport bridging the host's LspBridge
                               to the webview UI's LSP client

  shared/
    logger.ts               -> VS Code OutputChannel logger (replaces pino)
```

**Activation events** (in `apps/extension/package.json`):
- `workspaceContains:vnext.config.json` — auto-activate when the user opens a vnext project.
- `onCommand:vnextForge.open | openDesigner | createProject | createComponent`.

**Contributed commands**: `vnextForge.open`, `vnextForge.openDesigner` (bound to
`explorer/context` and `editor/title/context` menus for `.json` files when
`vnextForge.isVnextWorkspace`), `vnextForge.createProject`, `vnextForge.createComponent`.

**Build:**
- esbuild bundles `src/extension.ts` → `dist/extension.js` (CJS, Node 18, minified in production)
- `vscode` is external (provided by VS Code at runtime)
- `@burgan-tech/vnext-schema` is bundled (plain CJS module)
- `@burgan-tech/vnext-template` is external (must be on disk); the build plugin copies it from `node_modules/` to `dist/vendor/` with `dereference: true` so pnpm symlinks are resolved to real files

**dist/ layout after full build:**
```text
dist/
  extension.js         -> extension host bundle
  vendor/
    @burgan-tech/
      vnext-template/  -> real copy of the template package (init.js run as child process)
  webview/             -> React app bundle (output of apps/web Vite build)
    index.html
    assets/
```

**Error flow:** handler throws `new VnextForgeError(...)` → `MessageRouter.dispatch()` catches it → logs with `toLogEntry()` to OutputChannel → returns `toUserMessage()` + `traceId` to the webview as `ApiFailure`.

---

### apps/web

React 19 + Vite 6. The web app uses a simple module-based vertical slice structure. The Vite build outputs to `../extension/dist/webview-ui/` so the extension can serve it as the webview content.

The active structure is `app / pages / modules / shared`.

- Start with the narrowest owner and the shallowest folder that keeps the code understandable.
- Default structure: `app -> pages -> modules -> shared`.
- `pages` owns route entry and route composition.
- `modules` owns business UI, module state, and module-local services.
- `shared` stays narrow and generic.
- If unsure, choose `modules`.
- Do not create `model`, `ui`, `hooks`, or `types` subfolders by reflex. Colocate files in the owning folder until extra structure is justified.
- `packages/*` may be imported from any layer.
- Use path aliases/path mappings instead of deep relative imports.
- Utility/helper-style infrastructure files under areas such as `api`, `config`, or `lib` should start with a lowercase letter, for example `client.ts`, `env.ts`, `logger.ts`, or `vNextErrorHelpers.ts`.
- When a file name starts with the product prefix, write it as `vNext`, not `Vnext` or `vnext`. If `vnext` appears later in the name, keep normal word casing for that position, for example `ErrorVnextHelper.ts`.

```text
app/
  providers/          -> ReactFlowProvider, QueryClientProvider
  routes/             -> Route definitions

pages/                -> route entry and page composition only

modules/              -> user-facing business modules with local UI/state/services
  project-management/ -> project list, create/import/delete, project-facing services
  project-workspace/  -> workspace shell data, file tree, active file coordination
  canvas-interaction/ -> custom nodes/edges, edge actions, auto-layout, canvas persistence
  workflow-validation/-> validation flows, badges, realtime validation, validation adapters
  workflow-execution/ -> execution controls, timelines, simulator/executor flows
  code-editor/        -> editor-facing flows and workflow context bridges
  save-workflow/      -> save workflow behavior
  save-component/     -> save component behavior
  task-editor/        -> task editor behavior and UI ownership
  function-editor/    -> function editor behavior and UI ownership
  extension-editor/   -> extension editor behavior and UI ownership
  schema-editor/      -> schema editor behavior and UI ownership
  view-editor/        -> view editor behavior and UI ownership

shared/
  ui/                 -> generic primitives
  api/                -> postMessage transport client (client.ts, vscodeTransport.ts)
  config/             -> config.ts (Zod-validated singleton; reads import.meta.env / .env, falls back to baked-in defaults)
  lib/                -> logger, error helpers, utility modules
```

Pages should stay thin. Business logic should usually live in the owning module.

Current guidance:

- Keep new business code in `src/modules/*` and route entry in `src/pages/*`.
- Keep `shared` narrow; do not move project/workspace/editor business logic into `shared`.
- Do not reintroduce FSD aliases such as `@entities`, `@features`, or `@widgets`.
- Do not add new top-level `src/stores/*`, `src/hooks/*`, or `src/components/*` owners.
- Treat any remaining `legacy-*` module area as temporary migration quarantine, not as a destination pattern.

---

### Web ↔ Extension Host Communication (postMessage)

There is **no HTTP server**. The webview calls `sendToHost({ method, params })` in `shared/api/vscodeTransport.ts`. The extension host's `MessageRouter` receives the message, calls the matching handler, and replies with an `ApiResponse<T>`.

```ts
// web side — shared/api/client.ts
export async function callApi<T>(request: ApiRequest): Promise<ApiResponse<T>>
export async function unwrapApi<T>(request: ApiRequest, fallbackMessage?: string): Promise<T>

// message shape (web → host)
{ requestId: string; type: 'api'; method: string; params: unknown }

// reply shape (host → web)
{ requestId: string; response: ApiResponse<T> }
```

**Method naming convention:** `<domain>.<action>`, for example `projects.list`, `workspace.getConfig`, `validate.workflow`, `files.write`.

**LSP messages** use a separate type field:
```ts
// web → host
{ type: 'lsp'; event: 'connect' | 'message' | 'disconnect'; sessionId: string; data?: unknown }

// host → web
{ type: 'lsp'; event: 'message' | 'close'; sessionId: string; data?: unknown }
```

When adding new capabilities, add a handler in `apps/extension/src/handlers/<domain>/` and register the method string in `MessageRouter.handle()`. Add the corresponding `callApi` call in the appropriate web module's `*Api.ts` file.

**Host → Webview push messages** (not tied to a `requestId`):
```ts
// 'navigate' — fired by vnextForge.openDesigner / createComponent
{ type: 'navigate'; route: FileRoute; projectId: string; projectPath: string }
```
The webview listens for these in `apps/web/src/shared/api/HostNavigationBridge.tsx`,
hydrates the active project in `useProjectStore`, and drives React Router. On
mount the webview posts `{ type: 'webview-ready' }` so the host can flush any
navigation queued before the UI finished loading.

**Webview shell (in extension mode)**: the React app no longer renders its own
Explorer / Search / Problems / Settings sidebar or status bar. File browsing
and project selection happen in the native VS Code Explorer; the webview only
renders the designer that corresponds to the active route.

---

### Web Logging

- In `apps/web`, do not add raw `console.log`, `console.info`, `console.warn`, or `console.error` calls in application code.
- Route logs through the shared logger in `@shared/lib/logger`.
- Create scoped loggers with `createLogger('ModuleName')` so log output stays attributable.
- The shared logger is the only place allowed to talk directly to `console.*`.

---

### apps/server (active Hono RPC backend)

`apps/server` is the **active Hono RPC backend** for the web shell. It exposes a single `/api/rpc` endpoint backed by `packages/services-core`'s method registry, plus auxiliary `/api/health` and LSP WebSocket routes.

The server is **bound to loopback by default** and is hardened with:

- Body limit + JSON parse middleware (`apps/server/src/shared/middleware/body-limit.ts`)
- Explicit CORS allowlist (`apps/server/src/shared/middleware/cors.ts`)
- Per-method capability policy (read-only / writes-files / spawns-process / talks-runtime)
- Runtime-proxy URL allowlist (SSRF defense; `packages/services-core/src/services/runtime-proxy/`)
- Filesystem jail (realpath + approved roots; symlinks rejected)
- LSP WebSocket policy (max message bytes, max connections, origin check)
- `trace-v1` header contract — server always generates its own `X-Trace-Id`; inbound `traceparent` is recorded as `linkedTraceId` only

When changing anything under `apps/server/src/**`, the **`server-hardening.mdc` rule** auto-loads. See [`./CLAUDE.SERVER.md`](./CLAUDE.SERVER.md) for the full server playbook.

`apps/extension/src/handlers/*` exists in parallel for the VS Code `postMessage` path and shares the same `services-core` registry where possible.
