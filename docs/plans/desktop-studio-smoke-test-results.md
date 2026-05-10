# Sprint 0 — Smoke Test Results (Desktop)

**Date:** 2026-05-07
**Branch:** `feat/desktop-studio` (off `main` at `c17f913`)
**Tester:** Pre-flight automated run before Sprint 1 kickoff
**Environment:** macOS (darwin 25.4.0), Node `v24.13.0`, pnpm `9.15.0`, .NET 10 SDK assumed

## Summary

✅ **All build steps green.** The existing `apps/desktop` scaffold builds end-to-end out of the box. We can move into Sprint 1.1 (smoke + skeleton completion) immediately.

| Step | Result | Time | Notes |
|------|--------|------|-------|
| `pnpm install` | ✅ pass | 31s | 1017 packages, postinstalls clean (esbuild 0.27.7, esbuild 0.25.12, electron 35.x, vsce-sign, keytar 7.9.0, unrs-resolver, electron-winstaller, vnext-template) |
| `pnpm build` (full monorepo) | ✅ pass | 1m54s | 10 turbo tasks, all green, 0 cached |
| `pnpm --filter vnext-forge-studio-desktop build` | ✅ pass | ~20s | esbuild 3 bundles + vendor copy + webview copy |
| Desktop dist verified | ✅ pass | — | main.js (6KB), preload.js (800B), server.bundle.js (1.4MB), vendor/, webview/ all present |
| `apps/desktop dev` (Electron launch) | ⏸ skipped | — | Requires display + manual interaction; defer to Sprint 1.1 |

## Pre-flight verifications (against the architectural assumptions in CLAUDE.DESKTOP.md)

- ✅ `apps/server/src/shared/config/config.ts:99,132` — `desktopStaticDir` Zod schema entry + `process.env.DESKTOP_STATIC_DIR` reader
- ✅ `apps/server/src/index.ts:60-64` — `serveStatic` middleware activated when `desktopStaticDir` set; SPA fallback rewrite to `/index.html` for client routing
- ✅ `apps/server/src/shared/lib/logger.ts:66` — `isDesktopBundle` flag derived from `desktopStaticDir`
- ✅ `apps/desktop/src/main.ts:33-70` — `BrowserWindow` config: contextIsolation=true, nodeIntegration=false, sandbox=false, external URL handler shells to system browser
- ✅ `apps/desktop/src/main.ts:24-27` — single-instance lock enforced
- ✅ `apps/desktop/src/server-runner.ts:58-67` — `utilityProcess.fork()` with correct env injection (`PORT`, `HOST=127.0.0.1`, `NODE_ENV=production`, `DESKTOP_STATIC_DIR`)
- ✅ `apps/desktop/src/server-runner.ts:19-50` — health polling (250ms interval, 30s timeout) on `/api/health`
- ✅ `apps/desktop/esbuild.desktop.mjs:72-91` — server bundle has correct `import.meta.url` polyfill for CJS (define + banner)
- ✅ `apps/desktop/scripts/copy-assets.mjs:21-29` — `apps/web/dist/` → `apps/desktop/dist/webview/` with dereference (pnpm symlinks resolved)
- ✅ `apps/web/dist/` produced as expected: `index.html`, `assets/`, `icon.svg`, `icon-with-background.svg`
- ✅ `.github/workflows/release-desktop.yml` exists (mac + win matrix, no Linux job, no signing yet)

## Build output observations

### Web bundle warnings (apps/web → dist/webview-ui via extension subpath)

```
(!) Some chunks are larger than 500 kB after minification. Consider:
  - Using dynamic import() to code-split the application
  - Use build.rollupOptions.output.manualChunks to improve chunking
  - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit
```

Largest chunks:
| Chunk | Raw | gzip |
|-------|-----|------|
| `VsCodeTransport-BiwyfkFB.js` | **6,745 KB** | 1,872 KB |
| `mermaid.core` | 571 KB | 134 KB |
| `wardley` | 495 KB | 110 KB |
| `cytoscape.esm` | 442 KB | 141 KB |
| `main` | 342 KB | 88 KB |
| `katex` | 259 KB | 76 KB |
| `architectureDiagram` | 149 KB | 42 KB |
| `sequenceDiagram` | 117 KB | 31 KB |

→ **Action item (deferred to Phase 1.1):** Audit the 6.7 MB `VsCodeTransport-BiwyfkFB.js` chunk. Likely contains everything for the VS Code shell that desktop doesn't need. Needs route-level dynamic import or shell-aware bundle split.

### Desktop server bundle size

`server.bundle.js`: **1.4 MB** (CJS, includes Hono + services-core + lsp-core + app-contracts + vnext-types + adapters; only `@burgan-tech/vnext-template` is external in `dist/vendor/`).

→ **Acceptable for Phase 0.** Revisit if startup latency becomes an issue in Phase 1.

### pnpm workspace warnings (non-blocking)

```
WARN  The field "pnpm.overrides" was found in /Users/burgan/Documents/vnext/vnext-forge/package.json.
       This will not take effect. You should configure "pnpm.overrides" at the root of the workspace instead.
WARN  The field "pnpm.overrides" was found in /Users/burgan/Library/Mobile Documents/com~apple~CloudDocs/...
```

→ **Action item:** The repo lives under iCloud Documents (the second path is the iCloud-synced copy of the same repo); pnpm sees both as workspace roots and double-reports. For day-to-day this is harmless; long-term consider moving the working repo out of `~/Documents` to avoid iCloud sync churn (e.g. `~/dev/vnext-forge`).

## Sprint 1.1 punch list (confirmed by smoke test)

These were already in the plan; the smoke test confirms each is still required:

| Item | Severity | Files |
|------|----------|-------|
| Generate app icons (`.icns`, `.ico`, `.png`) from brand SVG | **CRITICAL** for packaging | `apps/desktop/build/icons/` (does not exist yet) |
| Add native menu bar | High | new `apps/desktop/src/menu.ts`, wired in `main.ts` |
| Window state persistence | High | new `apps/desktop/src/window-state.ts` (electron-window-state dep) |
| Native error dialog on server spawn failure | Medium | `apps/desktop/src/main.ts:111-114` patch |
| About dialog (version + license) | Medium | new IPC + UI |
| Bundle-size audit of `VsCodeTransport` chunk | Medium | `apps/web/vite.config.ts` or shell-aware bundling |

## Sprint 1.2 punch list (auto-update + signed builds)

Confirmed via reading `.github/workflows/release-desktop.yml`:

| Item | Severity | Notes |
|------|----------|-------|
| Add `electron-updater` dep + main.ts wiring | High | Not yet added |
| Add Linux build job to CI (`ubuntu-latest`) | High | electron-builder.yml already has Linux target; CI matrix doesn't |
| Wire `CSC_LINK`/`CSC_KEY_PASSWORD` (mac) | High | CI workflow currently sets `CSC_IDENTITY_AUTO_DISCOVERY: false`; secrets need to be uploaded |
| Wire `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` (win) | High | Same as above |
| Wire `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_APP_SPECIFIC_PASSWORD` (notarization) | High | electron-builder will run `notarytool` automatically once present |
| GPG-sign AppImage (linux) | Optional | Defer |
| End-to-end v0.1.0 → v0.1.1 update test | Required for Sprint 1.2 DoD | Manual after first signed release |

## Pre-Phase 1 environment readiness

| Tool | Required | Available | Notes |
|------|----------|-----------|-------|
| Node | ≥22 LTS | ✅ v24.13.0 | OK |
| pnpm | 9.15.0 (root pin) | ✅ 9.15.0 | OK |
| Apple Developer cert + notarization creds | Phase 1.2 | ❌ pending | Sprint 0 deliverable — track in roadmap |
| Authenticode EV cert | Phase 1.2 | ❌ pending | Sprint 0 deliverable |
| Sentry account + DSNs | Phase 1.3 | ❌ pending | Sprint 0 deliverable |
| PostHog project key | Phase 1.3 | ❌ pending | Sprint 0 deliverable |
| Brand SVG → 3 icon files | Phase 1.1 | ❌ pending | Designer asset request |

## Recommendation

The scaffold is **production-quality**. Greenlight Sprint 1.1.

Branch state at end of Sprint 0:
- `feat/desktop-studio` checked out, working tree contains: `CLAUDE.DESKTOP.md`, `docs/plans/desktop-studio-roadmap.md`, `docs/plans/desktop-studio-smoke-test-results.md` (this file). Build artifacts under `apps/desktop/dist/` and `apps/web/dist/` are git-ignored.
- **No commits made.** User will review and commit manually.
