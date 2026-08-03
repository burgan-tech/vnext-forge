# vnext-forge-studio

Workflow designer and management interface for the vnext engine ecosystem — delivered as a **VS Code extension** and a **standalone desktop app** (Windows / macOS), plus a **runtime monitoring web app** for observing live workflow execution.

## What is it?

A Visual Studio Code extension that gives developers and business analysts a first-class UI for the vnext workflow engine, directly inside their editor:

- Create and manage projects / domains
- Design workflows visually on a React Flow canvas
- Edit tasks, states, transitions, schemas, views, functions, and extensions in a Monaco editor
- Validate workflow definitions in real time
- Connect to a local vnext runtime for testing and simulation
- Export projects in the vnext structure (TFS/Git compatible)

Alongside the designer, `apps/monitoring` is a separate browser SPA that reads
the vnext runtime's **monitor API** to observe what a deployed domain is
actually doing: dashboards, component definitions, workflow instances and their
timelines, scheduled jobs, faults, and runtime configuration. It is read-only —
it never writes workflow definitions.

## Architecture

The product is built as a monorepo with three designer delivery shells that all
share the same React UI (`apps/web`) and business logic
(`packages/services-core`), plus a standalone monitoring SPA:

```
apps/
  extension/   # VS Code extension (extension host + bundled business logic)
  desktop/     # Electron desktop app (Windows / macOS)
  web/         # React UI — shared across all designer shells:
               #   extension webview  → bundled into extension/dist/webview-ui/
               #   desktop renderer   → served by embedded Hono server
               #   standalone browser → against apps/server (local dev only)
  server/      # Hono REST backend — used by web shell (dev) and desktop shell
  monitoring/  # Runtime monitoring SPA (React + Vite) — talks directly to the
               # vnext runtime monitor API; no services-core, no BFF

packages/
  vnext-types/       # Shared domain model types (@vnext-forge-studio/vnext-types)
  app-contracts/     # ApiResponse envelope, VnextForgeError, METHOD_HTTP_METADATA
  services-core/     # Method registry, dispatch, all services (file, project, LSP…)
  designer-ui/       # Shared React component library
  lsp-core/          # OmniSharp / csharp-ls wiring (shared by server + extension)
```

### Shell comparison

| Shell | Transport | How services run |
|---|---|---|
| **VS Code Extension** | `postMessage` (acquireVsCodeApi) | Extension host Node.js process; `MessageRouter` dispatches to `services-core` |
| **Desktop (Electron)** | HTTP REST (same-origin `http://127.0.0.1:<port>`) | Hono server spawned as `utilityProcess`; React SPA served from same port |
| **Web (browser)** | HTTP REST (`http://127.0.0.1:3001`) | `apps/server` Hono process; CORS allows `localhost:3000` |
| **Monitoring (browser)** | HTTP REST (`/api/v1.0/monitor/*`) | No forge backend — requests go straight to the vnext runtime monitor API (dev: Vite proxy → `http://localhost:4203`) |

### VS Code Extension — how it works

The extension has two runtime contexts:

| Context | Technology | Role |
|---|---|---|
| Extension Host | Node.js (CommonJS, esbuild bundle) | File I/O, validation, template scaffolding, LSP bridge |
| Webview | Sandboxed Chromium (Vite bundle) | React UI — React Flow canvas + Monaco editor |

The webview communicates with the extension host exclusively via VS Code's `postMessage` API. There is no HTTP server in extension mode.

```
Webview (React)
  │  sendToHost({ method, params })  →  vscodeTransport.ts
  │                                      postMessage / acquireVsCodeApi()
  ▼
Extension Host
  MessageRouter.dispatch()
    ├── projects.*      → handlers/project/
    ├── workspace.*     → handlers/workspace/
    ├── files.*         → handlers/workspace/
    ├── validate.*      → handlers/validate/
    ├── template.*      → handlers/template/
    ├── runtime.proxy   → handlers/runtime-proxy/
    └── lsp.*           → lsp/WebviewLspManager (OmniSharp bridge)
```

### Desktop (Electron) — how it works

```
Electron Main Process
  ├── Finds a free loopback port
  ├── Spawns apps/server bundle (utilityProcess)
  │     ├── GET /api/v1/*         →  services-core method registry
  │     ├── GET /api/health       →  health check
  │     ├── WS  /api/lsp/csharp  →  OmniSharp LSP bridge
  │     └── GET /*                →  serveStatic (apps/web production build)
  └── Opens BrowserWindow → http://127.0.0.1:<port>/
```

### Monitoring app — how it works

The monitoring SPA has no backend of its own. Every request is a plain REST call
to the runtime's monitor API, scoped by the configured domain:

```
Browser (React + TanStack Query)
  │  domainGet('/workflows')      →  shared/api/monitoring-api.ts
  │  workflowGet(wf, '/instances')    builds /api/v1.0/monitor/<domain>/...
  │  instanceGet(wf, id, '/timeline')
  │  monitorGet('config')             (endpoints without a domain scope)
  ▼
shared/api/api-client.ts  (MonitoringHttpClient)
  ├── injects X-Trace-Id + traceparent   (shared/api/trace-headers.ts)
  ├── 30s timeout
  └── normalizes every reply into ApiResponse<T>  (shared/api/api-envelope.ts)
  ▼
vnext runtime monitor API
  dev  → relative /api/* rewritten by the Vite proxy to http://localhost:4203
  prod → absolute VITE_MONITORING_API_BASE_URL
```

Two deliberate departures from the designer shells (see
[`apps/monitoring/docs/CLAUDE.md`](apps/monitoring/docs/CLAUDE.md)):

- **No `DesignerUiProvider`.** It carries forge-only dependencies (LSP
  capabilities, Monaco loader, forge `ApiTransport`). The monitoring app imports
  from `designer-ui` selectively instead: `/ui` primitives, `/hooks`,
  `DocumentThemeSync` for theming, `registerNotificationSink` + sonner for
  toasts, and `styles.css` from `index.css`.
- **No `ApiTransport` / method registry.** The monitor API is endpoint-based, not
  method-id based, so `MonitoringHttpClient` talks in paths. The
  `ApiResponse<T>` envelope from `@vnext-forge-studio/app-contracts` is still the
  shared contract.

## Getting Started

### Prerequisites

- Node.js LTS (20 or newer)
- pnpm (see `packageManager` in root `package.json` — enable with Corepack)
- Visual Studio Code ≥ 1.85 (for the extension shell)
- A reachable vnext runtime exposing the monitor API (for `apps/monitoring`;
  dev default `http://localhost:4203`)

### Install dependencies

```bash
pnpm install
```

---

## VS Code Extension

### Build for development (extension host watch mode)

```bash
pnpm --filter vnext-forge-studio dev
```

### Full build (web UI + extension host)

```bash
# Build everything in dependency order (recommended)
pnpm build

# Or step by step:
# 1. Build shared packages
# 2. Build the React webview → apps/extension/dist/webview-ui/
pnpm --filter @vnext-forge-studio/web build
# 3. Build the extension host (also copies vnext-template vendor to dist/vendor/)
pnpm --filter vnext-forge-studio build
```

### Package the extension as a .vsix

```bash
pnpm --filter vnext-forge-studio package
# → apps/extension/vnext-forge-studio-0.1.0.vsix
```

### Install the .vsix in VS Code

```bash
code --install-extension apps/extension/vnext-forge-studio-0.1.0.vsix
```

---

## Desktop App (Electron)

> Full documentation: [apps/desktop/README.md](apps/desktop/README.md)

### Quick start

```bash
# 1. Build everything (packages + web + desktop bundles)
pnpm build && pnpm --filter vnext-forge-studio-desktop build

# 2. Launch
pnpm --filter vnext-forge-studio-desktop dev
# DevTools open automatically in development mode
```

### Package for distribution

```bash
# macOS (run on a macOS machine)
pnpm --filter vnext-forge-studio-desktop package:mac
# → apps/desktop/dist/release/vnext-forge-studio-0.1.0-arm64.dmg  (Apple Silicon)
# → apps/desktop/dist/release/vnext-forge-studio-0.1.0-x64.dmg    (Intel)

# Windows (run on a Windows machine)
pnpm --filter vnext-forge-studio-desktop package:win
# → apps/desktop/dist/release/vnext-forge-studio-Setup-0.1.0.exe
```

### Automated CI release (GitHub Actions)

Tag a commit to trigger a multi-platform build on `macos-latest` + `windows-latest`:

```bash
git tag v0.1.0
git push origin v0.1.0
# → .github/workflows/release-desktop.yml creates a draft GitHub Release with DMG + EXE
```

Trigger manually from the GitHub Actions tab without a tag as well.

---

## Web Shell (browser + Hono backend)

The React UI in `apps/web` can also run as a standalone browser SPA against
the `apps/server` Hono backend. Use this mode when you want to iterate on the
UI without packaging the VS Code extension.

| App | URL | Purpose |
|---|---|---|
| `apps/server` (Hono REST) | `http://127.0.0.1:3001` | Bound to loopback by default. Exposes `/api/v1/*`, `/api/health`, and the LSP WebSocket at `/api/lsp/csharp`. |
| `apps/web` (Vite dev server) | `http://localhost:3000` | Hot-reloading SPA that talks to the server above. CORS allowlist already includes `:3000`. |

### Start both processes

In two separate terminals:

```bash
# terminal 1 — backend
pnpm --filter @vnext-forge-studio/server dev

# terminal 2 — web shell
pnpm --filter @vnext-forge-studio/web dev
```

Then open <http://localhost:3000> in a browser. The web shell will issue REST
calls against `http://127.0.0.1:3001/api/v1/*` (default; configurable via
`apps/web/.env` → `VITE_API_BASE_URL`). C# script (`.csx`) IntelliSense uses
the `/api/lsp/csharp` WebSocket on the same host.

### Smoke check

```bash
curl http://127.0.0.1:3001/api/health
# → {"success":true,"data":{"status":"ok","traceId":"..."},"error":null}
```

### Optional configuration

Both apps boot with sane defaults from their Zod schemas — no `.env` is
required. To override:

```bash
# apps/server/.env  (copy any keys you want to change)
PORT=3001
HOST=127.0.0.1
VNEXT_RUNTIME_URL=http://localhost:4201
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# apps/web/.env  (only VITE_*-prefixed keys reach the browser bundle)
VITE_API_BASE_URL=http://localhost:3001
```

`.env` files are git-ignored. Restart the dev process after changing them.

### Stop the processes

`Ctrl+C` in each terminal. Both processes are watch-mode (`tsx watch` /
Vite HMR) and will reload on source changes.

---

## Monitoring App (runtime observability SPA)

`apps/monitoring` (`@vnext-forge-studio/monitoring`) is an independent React 19 +
Vite 6 browser app. It does **not** need `apps/server`, the extension host, or a
`vnext.config.json` workspace — it needs a reachable vnext runtime.

### Project structure

```
apps/monitoring/
  index.html
  vite.config.ts          # @monitoring alias → ./src, dev port 3100, /api proxy
  vitest.config.ts
  docs/                   # design notes + per-feature docs (CLAUDE.md, features/)
  src/
    main.tsx              # React root
    App.tsx               # AppProviders + AppRouter
    index.css             # Tailwind 4 entry; imports designer-ui/styles.css
    app/                  # application shell (no business logic)
      AppProviders.tsx    #   QueryClientProvider, theme sync, notification sink
      AppRouter.tsx       #   route table (react-router-dom 7)
      RouteErrorBoundary.tsx
      layout/             #   AppShell, Sidebar, Topbar
      favorites/          #   favorites store + breadcrumb helpers
      notifications/      #   SonnerProvider (registerNotificationSink)
    pages/                # route entry + composition only
      DashboardPage, DefinitionsPage, ComponentDetailPage,
      InstanceDetailPage, JobsPage, FaultsPage, ConfigPage,
      NotFoundPage
                          # (HomePage.tsx and InstanceListPage.tsx exist but are
                          #  not wired into AppRouter yet)
    modules/              # vertical slices — never import each other
      dashboard/          #   KPIs, charts, recent faults
      definitions/        #   component lists + per-type detail
                          #   (workflow/task/function/mapping/extension/schema/view)
      instances/          #   instance lists, timelines, incident periods
      jobs/               #   scheduled jobs
      faults/             #   fault list + detail
      config/             #   runtime configuration view
    shared/
      api/                #   api-client.ts (MonitoringHttpClient), monitoring-api.ts
                          #   (domainGet/workflowGet/instanceGet/monitorGet),
                          #   api-envelope.ts, trace-headers.ts, query-client.ts
      components/         #   DataTable, filters, generic monitoring widgets
      config/config.ts    #   the only place import.meta.env is read
      time-range/         #   app-wide time range filter
      lib/                #   helpers
      types/              #   shared types
```

Layering follows the same rule as `apps/web`: `app → pages → modules → shared`.
Business logic belongs in `modules/`; pages stay thin; slices share code only
through `shared/`.

### Routes

| Route | Page |
|---|---|
| `/` | Dashboard |
| `/definitions/:type` | Component definitions list — `:type` is singular: `workflow`, `task`, `function`, `view`, `extension`, `schema`, `mapping` |
| `/definitions/:type/:id` | Component detail — read-only **Designer** tab (shared forge designer forms, non-editable) + raw **Definition** tab |
| `/definitions/workflows/:wfId/instances/:instanceId` | Instance detail (timeline, incidents, permissions) |
| `/jobs` | Scheduled jobs |
| `/faults` | Faults |
| `/config` | Runtime configuration |

### Run in development

```bash
pnpm --filter @vnext-forge-studio/monitoring dev
```

Then open <http://localhost:3100>. Vite proxies `/api/*` to
`http://localhost:4203`, so a runtime listening there needs no CORS setup and no
extra configuration.

> `pnpm install` at the repo root is enough — the workspace packages are consumed
> from source (`designer-ui` exports `./src/*`), so no pre-build step is needed
> for dev.

### Run from VS Code

The repo ships launch configurations and tasks for the monitoring app:

| Where | Entry | What it does |
|---|---|---|
| Run and Debug (`F5`) | **Monitoring: Dev Server + Chrome** | Starts Vite on 3100 and opens Chrome with source-mapped breakpoints once the server is ready |
| Run and Debug | **Monitoring: Chrome (server already running)** | Attaches a debuggable Chrome to an already-running `http://localhost:3100` |
| Terminal → Run Task | **Monitoring: Dev Server** | Dev server only, in its own terminal panel |
| Terminal → Run Task | **Monitoring: Build** | `tsc -b` + `vite build` with the `$tsc` problem matcher |

### Build for production

```bash
# monitoring only (tsc -b type check, then vite build)
pnpm --filter @vnext-forge-studio/monitoring build
# → apps/monitoring/dist/

# or as part of the whole monorepo, in dependency order
pnpm build
```

Serve the built bundle locally to verify it:

```bash
pnpm --filter @vnext-forge-studio/monitoring preview
```

The output in `apps/monitoring/dist/` is a static SPA — host it behind any web
server or CDN. Configure the host to rewrite unknown paths to `index.html`
(client-side routing), and point the app at the runtime with
`VITE_MONITORING_API_BASE_URL` at build time, because there is no Vite proxy in
production.

### Configuration

`apps/monitoring/.env` (git-ignored; only `VITE_*` keys reach the bundle):

```bash
# Absolute monitor API base URL. Leave empty in dev to use the Vite proxy.
VITE_MONITORING_API_BASE_URL=https://runtime.example.com

# Domain to monitor — used in /api/v1.0/monitor/<domain>/... (default: core)
VITE_MONITORING_DOMAIN=banking
```

Both keys have defaults, so a missing `.env` is never fatal: the app boots
against the proxy and logs a warning when `VITE_MONITORING_DOMAIN` is unset.
Read them via `import { config } from '@monitoring/shared/config/config'` — never
touch `import.meta.env` elsewhere.

### Lint and test

```bash
pnpm --filter @vnext-forge-studio/monitoring lint
pnpm --filter @vnext-forge-studio/monitoring test   # vitest run
pnpm --filter @vnext-forge-studio/monitoring clean  # remove dist/
```

## Using the extension

The extension activates automatically when you open a folder that contains a
`vnext.config.json` file at its root.

Once activated, the following entry points are available:

- **Right-click** any `.json` file in the Explorer (or from the editor tab) and
  choose **Open Designer** to jump to the matching designer view (workflow,
  task, schema, view, function, extension, or raw JSON editor).
- **Command Palette → vnext-forge-studio: Open Designer** — opens (or reveals) the
  webview panel.
- **Command Palette → vnext-forge-studio: Create vnext Project** — scaffolds a new
  project in a folder of your choice via `@burgan-tech/vnext-template`.
- **Command Palette → vnext-forge-studio: Create vnext Component** — interactively
  picks type + group + key, writes a minimal stub JSON into the right folder
  (resolved from `vnext.config.json` paths), and opens the designer.

### Language server

The C# language server (`csharp-ls` or OmniSharp) is prepared in the background
on activation. This can be disabled by setting `vnextForge.lsp.autoInstall` to
`false` in VS Code settings.

## Supported vnext-runtime Components

- **Workflow Types**: Flow (F), SubFlow (S), SubProcess (P), Core (C)
- **State Types**: Initial (1), Intermediate (2), Final (3), SubFlow (4), Wizard (5)
- **State SubType**: None, Success, Error, Terminated, Suspended, Busy, Human
- **Transition Types**: Manual (0), Automatic (1), Scheduled (2), Event (3)
- **Task Types**: Http (6), DaprPubSub (4), DaprService (3), DaprBinding (7), Script (5), Start (11), DirectTrigger (12), GetInstanceData (13), SubProcess (14), GetInstances (15), HumanTask
- **Mapping Interfaces**: IMapping, IConditionMapping, ITimerMapping, ITransitionMapping, ISubFlowMapping, ISubProcessMapping
- **View Strategies**: full-page, popup, bottom-sheet, top-sheet, drawer, inline
- **Extension Types**: Global, GlobalAndRequested, DefinedFlows, DefinedFlowAndRequested
- **Function Scopes**: Instance (I), Workflow (F), Domain (D)
- **Error Boundary**: Abort, Retry, Rollback, Ignore, Log, Notify

## Related Projects

| Project | Description |
|---|---|
| vnext-runtime | Workflow engine runtime |
| vnext-messaging-gateway | Example domain project |
| morph-idm-master | Example domain project (complex) |
