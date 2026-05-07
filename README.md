# vnext-forge-studio

Workflow designer and management interface for the vnext engine ecosystem — delivered as a **VS Code extension** and a **standalone desktop app** (Windows / macOS).

## What is it?

A Visual Studio Code extension that gives developers and business analysts a first-class UI for the vnext workflow engine, directly inside their editor:

- Create and manage projects / domains
- Design workflows visually on a React Flow canvas
- Edit tasks, states, transitions, schemas, views, functions, and extensions in a Monaco editor
- Validate workflow definitions in real time
- Connect to a local vnext runtime for testing and simulation
- Export projects in the vnext structure (TFS/Git compatible)

## Architecture

The product is built as a monorepo with three delivery shells that all share the
same React UI (`apps/web`) and business logic (`packages/services-core`):

```
apps/
  extension/   # VS Code extension (extension host + bundled business logic)
  desktop/     # Electron desktop app (Windows / macOS)
  web/         # React UI — shared across all shells:
               #   extension webview  → bundled into extension/dist/webview-ui/
               #   desktop renderer   → served by embedded Hono server
               #   standalone browser → against apps/server (local dev only)
  server/      # Hono REST backend — used by web shell (dev) and desktop shell

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

## Getting Started

### Prerequisites

- Node.js LTS (20 or newer)
- pnpm (see `packageManager` in root `package.json` — enable with Corepack)
- Visual Studio Code ≥ 1.85 (for the extension shell)

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
