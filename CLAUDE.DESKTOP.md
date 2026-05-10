# vnext-forge-studio-desktop — Workspace Context

This file is the workspace-specific context for `apps/desktop/`. Read it together with the repo-wide `CLAUDE.md`.

## Mission

Ship `vnext-forge-studio` as a standalone Electron desktop application for macOS, Windows, and Linux. Burgan Tech-wide (200+ developers) target. Single-tenant. Same codebase as the VS Code extension — different shell.

The Electron shell is a thin wrapper around the existing `apps/web` (React 19 + Vite 6) and `apps/server` (Hono REST). The renderer loads the web bundle from a loopback HTTP server (`127.0.0.1:<random-port>`) hosted by the bundled server running as a `utilityProcess`. No CORS. LSP works automatically over the same origin.

## Architectural decisions (locked for v1.x)

1. **Distribution:** GitHub Releases (private repo) + electron-updater. Apple notarization for macOS, Authenticode signing for Windows, GPG-signed AppImage for Linux (optional).
2. **Single-tenant:** Each developer's machine is the boundary. No shared backend. Settings local to OS user profile.
3. **English-only UI:** Same rule as the rest of the repo (see root `CLAUDE.md`). No Turkish strings in the desktop shell.
4. **Server:** Bundle the existing `apps/server` (`apps/server/src/index.ts`) as a Node CJS bundle (`server.bundle.js`) and run it as `utilityProcess.fork()` in the Electron main process. Set `DESKTOP_STATIC_DIR` env var so the server also serves the web SPA from the same origin.
5. **Renderer:** Build `apps/web` to `apps/web/dist/`, copy into `apps/desktop/dist/webview/`, served as static files by the bundled server. The renderer loads `http://127.0.0.1:<port>/` in `BrowserWindow`.
6. **New features land in `packages/designer-ui` + `packages/services-core`** (NOT in `apps/desktop/`) so the existing VS Code extension benefits too. Treat the desktop shell as a transport host: it should not contain product features.
7. **IPC surface minimal:** preload exposes nothing by default. Add `contextBridge.exposeInMainWorld(...)` channels only for native-only features (file dialog, system tray, deep link, OS notifications, native menu shortcuts).
8. **Code signing:** mandatory before Burgan Tech-wide rollout. CI uses secrets `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `CSC_LINK`, `CSC_KEY_PASSWORD` (mac), `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (win).
9. **Telemetry:** PostHog SDK (opt-in toggle in Settings). Typed events only, never PII or project content.
10. **Crash reporting:** Sentry (main + renderer + utility process), opt-in.
11. **Logs:** local file in OS-specific log dir (`~/Library/Logs/vnext-forge-studio/` on macOS, `%APPDATA%\vnext-forge-studio\logs\` on Windows, `~/.config/vnext-forge-studio/logs/` on Linux). Pino + 10 MB rotation, 30-day retention.
12. **Plugin system NOT in v1.x.** Design extension points (custom widgets, custom validators, custom task types) as public APIs in `packages/designer-ui` + `packages/services-core` so plugins can be added later without breaking changes.

## Branch & PR strategy

- Long-lived branch: `feat/desktop-studio` (off `main`, weekly rebase from main).
- Sub-branches per phase: `feat/desktop/phase-N-<slug>` → squash-merge PR into `feat/desktop-studio`.
- Phase merges into `main` only when DoD passes and changelog updated.
- Never break `main` — extension still ships from there.

## Security boundaries

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (preload needs Node APIs).
- Renderer never has direct file system or network access — all goes through HTTP to the loopback server, which already enforces CORS allowlist, body limit, capability policy, FS jail, SSRF allowlist, child-env safety, LSP WebSocket policy.
- `BrowserWindow.webContents.setWindowOpenHandler`: only `127.0.0.1` and `localhost` URLs open in-app; everything else shells to system browser.
- Single-instance lock enforced; second launch focuses existing window.
- Secrets stored in OS keychain via `keytar`. No fallback to plaintext.

## Key files

| Path | Purpose |
|------|---------|
| `apps/desktop/src/main.ts` | Electron main process; window creation, single-instance lock, server spawn, lifecycle |
| `apps/desktop/src/preload.ts` | Preload script; intentionally minimal, expand only for native-only features |
| `apps/desktop/src/server-runner.ts` | Spawns `server.bundle.js` via `utilityProcess.fork()`, polls `/api/health` |
| `apps/desktop/src/find-free-port.ts` | OS-assigned free loopback port |
| `apps/desktop/esbuild.desktop.mjs` | Builds 3 outputs: main, preload, server.bundle |
| `apps/desktop/scripts/copy-assets.mjs` | Copies `apps/web/dist/` → `apps/desktop/dist/webview/` |
| `apps/desktop/electron-builder.yml` | macOS DMG + Windows NSIS + Linux AppImage configs |
| `apps/desktop/build/icons/` | App icons (`icon.icns`, `icon.ico`, `icon.png`) — required for packaging |
| `apps/server/src/shared/config/config.ts` | Reads `DESKTOP_STATIC_DIR` env var |
| `apps/server/src/index.ts` | Adds `serveStatic` middleware when `DESKTOP_STATIC_DIR` set |

## Build pipeline

```bash
# Full build (run once or after package changes)
pnpm install
pnpm build                                              # turbo: builds all packages + web + extension
pnpm --filter vnext-forge-studio-desktop build          # esbuild 3 bundles + copy-assets
pnpm --filter vnext-forge-studio-desktop dev            # launch Electron, auto-DevTools

# Iterative dev
pnpm --filter vnext-forge-studio-desktop build:watch    # auto-rebuild on save
pnpm --filter @vnext-forge-studio/web build && \
pnpm --filter vnext-forge-studio-desktop build          # web changed → rebuild + recopy

# Packaging
pnpm --filter vnext-forge-studio-desktop package:mac    # → dist/release/*.dmg
pnpm --filter vnext-forge-studio-desktop package:win    # → dist/release/*Setup*.exe
pnpm --filter vnext-forge-studio-desktop package        # all platforms (CI only)
```

## Environment variables (set by main process for utility-process server)

| Var | Value | Purpose |
|-----|-------|---------|
| `PORT` | dynamic free port | server listen port |
| `HOST` | `127.0.0.1` | loopback only |
| `NODE_ENV` | `production` | enables prod logging + minification paths |
| `DESKTOP_STATIC_DIR` | absolute path to `dist/webview/` | server serves SPA from here |

## Definition of done — Sprint 0

- ✅ Branch `feat/desktop-studio` created and checked out
- ✅ Plan saved (memory + `docs/plans/desktop-studio-roadmap.md`)
- ✅ This file (`CLAUDE.DESKTOP.md`) committed
- ✅ Smoke test results documented (`docs/plans/desktop-studio-smoke-test-results.md`)
- ✅ Initial commit on `feat/desktop-studio` pushed (with user confirmation)

## What NOT to do

- ❌ Don't fork or duplicate `apps/web` code into desktop. The web bundle is reused as-is.
- ❌ Don't add Express/Fastify. Hono + utilityProcess works.
- ❌ Don't add IPC channels speculatively. Each new channel needs a documented native-only use case.
- ❌ Don't carry anything from `vnext-flow-studio-web` (older repo). It's a subset.
- ❌ Don't break `apps/extension` builds when changing shared packages (`designer-ui`, `services-core`, `lsp-core`, `app-contracts`, `vnext-types`). Both shells must keep working.
- ❌ Don't ship without code signing for production releases (Burgan Tech-wide).
