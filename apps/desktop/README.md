# vnext-forge-studio Desktop App

Standalone desktop application for Windows and macOS. Packages the same React
UI (`apps/web`) and Hono backend (`apps/server`) into a single Electron shell —
no VS Code or browser required.

## How it works

```
Electron Main Process
  ├── Finds a free loopback port
  ├── Spawns apps/server bundle as a utilityProcess child
  │     ├── GET /api/v1/*  →  services-core method registry
  │     ├── GET /api/health → health check
  │     ├── WS  /api/lsp/csharp → OmniSharp LSP bridge
  │     └── GET /*  →  serveStatic (apps/web production build)
  └── Opens BrowserWindow → http://127.0.0.1:<port>/
```

The server and the React SPA share the same origin, so there are no CORS
restrictions. The web app's production build already uses same-origin API calls
(`apiBaseUrl = ''`), so no runtime configuration injection is needed.

LSP (OmniSharp) works automatically — the server wires `composeLspBridge` and
`injectLspWebSocket`. The web app's LSP client derives `ws://127.0.0.1:<port>/api/lsp/csharp`
from `window.location`, which is already the correct address.

---

## Prerequisites

- Node.js 20 LTS or newer
- pnpm (see root `package.json` → `packageManager`; enable with Corepack)
- **macOS packaging only**: Xcode Command Line Tools
- **Windows packaging only**: run from a Windows machine (or use the GitHub
  Actions workflow — it builds on `windows-latest` automatically)

---

## Development workflow

### 1. First-time setup

```bash
# From the monorepo root
pnpm install
```

### 2. Build everything

The desktop build depends on `apps/web` and all shared packages being compiled
first. Run this once, and again after changing code in `apps/web` or `packages/*`:

```bash
pnpm build
```

### 3. Build the desktop bundles

```bash
pnpm --filter vnext-forge-studio-desktop build
```

This runs two steps:
1. `esbuild.desktop.mjs` — compiles `src/main.ts` → `dist/main.js`, `src/preload.ts` → `dist/preload.js`, and bundles the Hono server → `dist/server.bundle.js`; copies `@burgan-tech/vnext-template` into `dist/vendor/`
2. `scripts/copy-assets.mjs` — copies `apps/web/dist/` → `dist/webview/`

### 4. Launch

```bash
pnpm --filter vnext-forge-studio-desktop dev
# equivalent to: cd apps/desktop && electron dist/main.js
```

The app window opens and **DevTools detach automatically** in development mode
(`app.isPackaged === false`).

### Iterative development cycle

When you change TypeScript source in `apps/desktop/src/`:

```bash
# Rebuild only the desktop bundles (fast, skips web + packages)
pnpm --filter vnext-forge-studio-desktop build
# then relaunch
pnpm --filter vnext-forge-studio-desktop dev
```

When you change `apps/web` source:

```bash
pnpm --filter @vnext-forge-studio/web build
pnpm --filter vnext-forge-studio-desktop build  # re-copies webview assets
pnpm --filter vnext-forge-studio-desktop dev
```

---

## Debugging

### Option A — VS Code launch configs (recommended)

Open the monorepo root in VS Code. Three launch configurations are available
(`.vscode/launch.json`):

| Config | What it does |
|---|---|
| **Desktop: Main Process** | Launches Electron with `--remote-debugging-port=9223`; breakpoints in `main.ts`, `server-runner.ts`, `find-free-port.ts` work |
| **Desktop: Renderer (attach)** | Attaches a Chrome debugger to port 9223; breakpoints in React source work |
| **Desktop: Main + Renderer** (compound) | Launches both configs together |

> The `"Desktop: Main Process"` config runs `Desktop: Build` automatically as a
> pre-launch task. For faster iteration use `"Desktop: Build (incremental)"` in
> `tasks.json` after the first full build.

### Option B — Standalone Electron with inspect flag

```bash
# In apps/desktop/
node_modules/.bin/electron --inspect=5858 dist/main.js
```

Then attach any Node.js debugger (VS Code, Chrome `chrome://inspect`) to
`localhost:5858`.

### Renderer DevTools

In development mode (`app.isPackaged === false`) DevTools open automatically in
a detached window. In any mode you can open them manually:

- **macOS**: `Cmd+Option+I`
- **Windows / Linux**: `F12` or `Ctrl+Shift+I`

### Server child process logs

The server's `stdout` and `stderr` are piped to the Electron main process and
prefixed with `[server]`. They appear in:

- The terminal where you ran `electron dist/main.js`
- The Debug Console when launched via VS Code

---

## Build commands reference

| Command | Description |
|---|---|
| `pnpm build` | Build all packages + web app + desktop bundles (from monorepo root) |
| `pnpm --filter vnext-forge-studio-desktop build` | Build only the desktop bundles (requires packages + web already built) |
| `pnpm --filter vnext-forge-studio-desktop build:watch` | esbuild in watch mode (re-bundles on source change; does **not** re-copy web assets) |
| `pnpm --filter vnext-forge-studio-desktop dev` | Launch Electron against the built `dist/` |
| `pnpm --filter vnext-forge-studio-desktop package` | Package for the current platform |
| `pnpm --filter vnext-forge-studio-desktop package:mac` | Package macOS DMG only |
| `pnpm --filter vnext-forge-studio-desktop package:win` | Package Windows NSIS installer only |
| `pnpm --filter vnext-forge-studio-desktop clean` | Delete `dist/` |

---

## Packaging (local)

> Packaging for macOS requires a macOS machine. Packaging for Windows requires
> a Windows machine. Use the GitHub Actions workflow for cross-platform builds.

### macOS

```bash
# Build everything first
pnpm build && pnpm --filter vnext-forge-studio-desktop build

# Package
pnpm --filter vnext-forge-studio-desktop package:mac
# → apps/desktop/dist/release/vnext-forge-studio-0.1.0-x64.dmg  (Intel)
# → apps/desktop/dist/release/vnext-forge-studio-0.1.0-arm64.dmg (Apple Silicon)
```

Open the `.dmg`, drag the app to `/Applications`, and launch it.

### Windows

```bash
pnpm build && pnpm --filter vnext-forge-studio-desktop build
pnpm --filter vnext-forge-studio-desktop package:win
# → apps/desktop/dist/release/vnext-forge-studio-Setup-0.1.0.exe
```

Run the installer. The NSIS installer lets you choose the installation directory
(`oneClick: false`).

### Unsigned builds

By default `electron-builder` skips code signing (the CI workflow sets
`CSC_IDENTITY_AUTO_DISCOVERY=false`). Unsigned builds work but show an OS-level
warning:

- **macOS Gatekeeper**: right-click the app → Open to bypass the first-launch
  warning, or `xattr -cr vnext-forge-studio.app` from the terminal.
- **Windows SmartScreen**: click "More info" → "Run anyway".

For signed production builds, set the signing secrets described in the
[Release workflow section](#automated-releases-github-actions) below.

---

## Automated releases — GitHub Actions

The workflow at `.github/workflows/release-desktop.yml` builds on both
`macos-latest` and `windows-latest` in parallel.

### Trigger a release

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow:
1. Installs dependencies with `pnpm install --frozen-lockfile`
2. Builds all packages (`pnpm build`)
3. Builds the desktop app (`pnpm --filter vnext-forge-studio-desktop build`)
4. Packages with `electron-builder`
5. Uploads `.dmg` and `.exe` as GitHub Actions artifacts
6. Creates a **draft** GitHub Release with the artifacts attached

You can also trigger it manually from the GitHub Actions tab without a tag.

### Code signing secrets (optional)

Add these as repository secrets for signed production builds:

| Secret | Platform | Description |
|---|---|---|
| `CSC_LINK` | macOS | Base64-encoded `.p12` certificate |
| `CSC_KEY_PASSWORD` | macOS | Certificate password |
| `APPLE_ID` | macOS | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App-specific password |
| `WIN_CSC_LINK` | Windows | Base64-encoded `.p12` certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows | Certificate password |

---

## App icons

The packager expects icon files under `build/icons/`:

| File | Format | Used for |
|---|---|---|
| `build/icons/icon.icns` | macOS ICNS (256×256 or 512×512) | macOS DMG + dock |
| `build/icons/icon.ico` | Windows ICO (multi-size: 16, 32, 48, 256 px) | Windows installer + taskbar |
| `build/icons/icon.png` | PNG 512×512 | Linux / fallback |

Generate from `media/forge-tools.svg`:

```bash
# macOS — using librsvg + iconutil
rsvg-convert -w 1024 -h 1024 media/forge-tools.svg -o icon-1024.png
# ... create iconset, run iconutil -c icns ...

# Cross-platform — using ImageMagick
convert -background none media/forge-tools.svg -resize 512x512 \
  apps/desktop/build/icons/icon.png

# Windows ICO (multi-size)
convert icon.png -define icon:auto-resize=256,48,32,16 \
  apps/desktop/build/icons/icon.ico
```

The icons are not required for a local `dev` launch but are required for
`electron-builder package`.

---

## dist/ layout after build

```
apps/desktop/dist/
  main.js           # Electron main process bundle (inside asar)
  preload.js        # Preload script (asarUnpack'd — real file on disk)
  server.bundle.js  # Bundled Hono server (asarUnpack'd)
  vendor/
    @burgan-tech/
      vnext-template/  # Template package files (asarUnpack'd, for child process)
  webview/          # React SPA production build (asarUnpack'd, served over HTTP)
    index.html
    assets/
  release/          # Created by electron-builder
    *.dmg / *.exe
```
