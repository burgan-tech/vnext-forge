# vnext-forge

Workflow designer and management interface for the vnext engine ecosystem — delivered as a **VS Code extension**.

## What is it?

A Visual Studio Code extension that gives developers and business analysts a first-class UI for the vnext workflow engine, directly inside their editor:

- Create and manage projects / domains
- Design workflows visually on a React Flow canvas
- Edit tasks, states, transitions, schemas, views, functions, and extensions in a Monaco editor
- Validate workflow definitions in real time
- Connect to a local vnext runtime for testing and simulation
- Export projects in the vnext structure (TFS/Git compatible)

## Architecture

The product is a VS Code extension built as a monorepo:

```
apps/
  extension/   # VS Code extension (extension host + bundled business logic)
  web/         # React UI — runs in two modes:
               #   - extension webview (Vite → bundled into extension/dist/webview-ui/)
               #   - standalone browser SPA against apps/server (local dev)
  server/      # Hono REST backend (apps/web shell talks to it on :3001)

packages/
  vnext-types/       # Shared domain model types (@vnext-forge/vnext-types)
  app-contracts/     # ApiResponse envelope, VnextForgeError, config builder
```

### How it works

The extension has two runtime contexts:

| Context | Technology | Role |
|---|---|---|
| Extension Host | Node.js (CommonJS, esbuild bundle) | File I/O, validation, template scaffolding, LSP bridge |
| Webview | Sandboxed Chromium (Vite bundle) | React UI — React Flow canvas + Monaco editor |

The webview communicates with the extension host exclusively via VS Code's `postMessage` API. There is no HTTP server. All API calls that previously went over Hono RPC now go through `postMessage`, routed by `MessageRouter` in the extension host.

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

## Getting Started

### Prerequisites

- Node.js LTS
- pnpm (see `packageManager` in root `package.json` — enable with Corepack)
- Visual Studio Code ≥ 1.85

### Install dependencies

```bash
pnpm install
```

### Build for development (extension host only, watch mode)

```bash
pnpm --filter vnext-forge dev
```

### Full build (web UI + extension host)

```bash
# 1. Build the React webview — outputs to apps/extension/dist/webview-ui/
pnpm --filter @vnext-forge/web build

# 2. Build the extension host (also copies vnext-template vendor to dist/vendor/)
pnpm --filter vnext-forge build
```

Or via Turborepo (handles ordering automatically):

```bash
pnpm build
```

### Package the extension as a .vsix

```bash
pnpm --filter vnext-forge package
# → apps/extension/vnext-forge-0.1.0.vsix
```

### Install the .vsix in VS Code

```bash
code --install-extension apps/extension/vnext-forge-0.1.0.vsix
```

## Run the web shell locally (browser + Hono backend)

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
pnpm --filter @vnext-forge/server dev

# terminal 2 — web shell
pnpm --filter @vnext-forge/web dev
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
- **Command Palette → vnext-forge: Open Designer** — opens (or reveals) the
  webview panel.
- **Command Palette → vnext-forge: Create vnext Project** — scaffolds a new
  project in a folder of your choice via `@burgan-tech/vnext-template`.
- **Command Palette → vnext-forge: Create vnext Component** — interactively
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
