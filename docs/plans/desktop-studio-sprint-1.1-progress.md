# Sprint 1.1 — Smoke + Skeleton Completion (Progress)

**Date:** 2026-05-07
**Branch:** `feat/desktop-studio` (uncommitted)
**Goal:** Close the punch list discovered in `desktop-studio-smoke-test-results.md` so the Electron shell has parity expectations met before Sprint 1.2 (auto-update + signed builds).

## Done

### 1. App icons (CRITICAL gap closed)

- **`apps/web/public/icon-with-background.svg`** chosen as canonical source: gradient background + 3-circle / tools glyph already in product chrome.
- **`apps/desktop/scripts/generate-icons.mjs`** — renders SVG → PNG with `sharp` at 384 DPI density, then:
  - macOS: builds an iconset (16/32/64/128/256/512/1024 + retina pairs) and runs `iconutil -c icns` to produce `icon.icns`
  - Windows: renders 16/24/32/48/64/128/256 PNGs, packs into multi-res `icon.ico` via `png-to-ico` (pure JS, no ImageMagick)
  - Linux: 512×512 `icon.png`
  - On non-darwin hosts the macOS step warns and skips `iconutil` (still produces ico + png)
- **`apps/desktop/scripts/ensure-icons.mjs`** — idempotent wrapper run from `pnpm --filter vnext-forge-studio-desktop build`. If all three icons exist, skips. Otherwise re-renders. Means a fresh checkout builds cleanly without manual setup, and `build/icons/` stays git-ignored (root `.gitignore` excludes `build/`).
- **`apps/desktop/build/icons/`** locally produced: `icon.icns` 339 KB, `icon.ico` 364 KB, `icon.png` 22 KB.

### 2. Window-state persistence

- **`apps/desktop/src/window-state.ts`** — wraps `electron-window-state@^5.0.3` (CJS, no @types — declared minimal local types).
  - Defaults: 1440×900, min 900×600
  - State file location: OS user-data dir (`~/Library/Application Support/<appName>/window-state.json` etc.) so it survives reinstalls
  - `WindowState.windowOptions` merged into `BrowserWindow` constructor; `WindowState.manage(window)` subscribes to resize/move/close

### 3. Native menu bar

- **`apps/desktop/src/menu.ts`** — platform-aware template:
  - macOS: App / File / Edit / View / Window / Help (with hide / hideOthers / unhide / services in App menu)
  - Win/Linux: File / Edit / View / Window / Help
  - Standard `role`-based items where possible (cut / copy / paste / undo / redo / minimize / zoom / togglefullscreen / toggleDevTools / reload / forceReload / resetZoom / zoomIn / zoomOut)
  - Help → "Documentation" + "Report an Issue" (open in system browser via `shell.openExternal`)
  - macOS About lives in App menu; Win/Linux About in Help menu

### 4. About dialog

- **`apps/desktop/src/about.ts`** — `showAboutDialog()`:
  - macOS: registers `app.setAboutPanelOptions(...)` then calls `app.showAboutPanel()` so the OS-managed pane stays consistent
  - Win/Linux: `dialog.showMessageBox` with multi-line detail (version, Electron, Chromium, Node.js, platform, copyright)

### 5. Native error dialog on server spawn failure

- **`apps/desktop/src/main.ts:reportFatalStartupError`** — replaces previous "log + quit". Now uses `dialog.showErrorBox()` (synchronous, works before any window exists) with the user-facing message + stack trace, then quits. Users on first-run never see a silent dock-icon-then-disappear failure.

### 6. main.ts wiring

- `BrowserWindow` now receives `windowState.windowOptions`, calls `windowState.manage(...)`, defers `show()` until `ready-to-show` (avoids unstyled flash)
- `installApplicationMenu()` invoked once on `app.whenReady()`
- `setWindowOpenHandler` made non-throwing (`shell.openExternal(...).catch(...)`)

### 7. Linux package script

- Added `package:linux` script in `apps/desktop/package.json` for symmetry with `package:mac` / `package:win`. CI Linux job will be added in Sprint 1.2.

## Verified

- `pnpm install` clean (24s, 11 new packages: sharp + png-to-ico + electron-window-state + transitive deps)
- `pnpm --filter vnext-forge-studio-desktop build` clean (~5s when icons cached, ~7s when regenerating)
- `apps/desktop/dist/main.js`: 47 KB (was 6 KB) — bundled menu + window-state + about + electron-window-state runtime
- `apps/desktop/dist/preload.js`: 800 B (unchanged, intentionally minimal)
- `apps/desktop/dist/server.bundle.js`: 1.3 MB (unchanged)
- Verified ensure-icons idempotency on both paths (icons present → skip; icons removed → regenerate)
- Verified main.js bundle contains `installApplicationMenu`, `createWindowState`, `showAboutDialog` symbols

## Not Yet Done in Sprint 1.1 (deferred to later sprints by design)

- **Bundle audit of `VsCodeTransport-BiwyfkFB.js` 6.7 MB chunk** — surfaced in smoke test but doesn't block Sprint 1.1. Belongs in Sprint 1.4 (Foundation Productivity) or as a separate optimisation pass when desktop-only routes are split out from the VS Code shell-specific code.
- **Electron live-launch verification** (`pnpm --filter vnext-forge-studio-desktop dev`) — needs interactive shell + display. User to run locally.

## Open follow-ups for Sprint 1.2

1. Add `electron-updater` dep + main.ts wiring (GitHub Releases feed)
2. Add Linux build to `.github/workflows/release-desktop.yml` matrix (Mac + Win + Linux on ubuntu-latest)
3. Wire code-signing secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`
4. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` once macOS cert is in place
5. End-to-end v0.1.0 → v0.1.1 update test

## Working tree state (no commits made)

```
M  apps/desktop/package.json                          # +scripts: icons, icons:check, package:linux; +deps: sharp, png-to-ico, electron-window-state
M  apps/desktop/src/main.ts                           # +menu install, +window-state, +error dialog, +ready-to-show
M  pnpm-lock.yaml                                     # +sharp, png-to-ico, electron-window-state
?? CLAUDE.DESKTOP.md                                  # (Sprint 0)
?? apps/desktop/scripts/generate-icons.mjs            # SVG → icns/ico/png
?? apps/desktop/scripts/ensure-icons.mjs              # idempotent build hook
?? apps/desktop/src/about.ts                          # About dialog
?? apps/desktop/src/menu.ts                           # native menu template
?? apps/desktop/src/window-state.ts                   # electron-window-state wrapper
?? docs/plans/desktop-studio-roadmap.md               # (Sprint 0)
?? docs/plans/desktop-studio-smoke-test-results.md    # (Sprint 0)
?? docs/plans/desktop-studio-sprint-1.1-progress.md   # this file
```

`apps/desktop/build/icons/` exists locally with all three icon files; not in `git status` because root `.gitignore` excludes `build/`. Regenerated automatically by `pnpm --filter vnext-forge-studio-desktop build`.
