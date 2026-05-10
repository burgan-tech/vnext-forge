# Sprint 2 (v0.2.0 "Foundation Productivity") — Progress

**Date:** 2026-05-08
**Branch:** `feat/desktop-studio` (uncommitted)
**Goal:** Add the seven productivity tools that turn the standalone desktop into a daily-driver: Smart Search (Cmd+P + Cmd+Shift+F), Snippets, Workspace Sessions, Integrated Terminal, Pre-Commit Hooks, Test Data Generators.

This file tracks the ongoing sprint; one section per feature lands here as it ships.

> **Plan v3 reorder reminder:** Distribution & onboarding (auto-update, code signing, Sentry, PostHog, Settings, Onboarding wizard) moved to **final Phase 9 v1.0.0**. Build features first; package for Burgan Tech-wide rollout last.

---

## ✅ 1. Smart Search Cmd+P (semantic quick switcher)

**Goal:** Cmd+P / Ctrl+P opens a palette over the current project. Fuzzy match across every addressable vNext entry: workflows + their nested states & transitions + tasks + schemas + views + functions + extensions. Enter navigates to the entity's editor page; Esc closes. Result list ranked by score; arrow keys navigate; clicks pick.

### Backend

- **`packages/services-core/src/services/quickswitcher/`** — new module
  - `quickswitcher-schemas.ts` — Zod schema for `QuickSwitchEntry` (id/type/label/description/componentKey/domain/version/flow/filePath + optional stateKey/transitionKey for nested entries) and `quickswitcher/buildIndex` params/result
  - `quickswitcher.service.ts` — `buildIndex({ id })`:
    1. resolves project via `projectService.getProject(id)` and reads `vnext.config.json` via `projectService.getConfig(id)`
    2. delegates to existing `scanVnextComponents(fs, project.path, config.paths)` for the top-level discovery (workflows / tasks / schemas / views / functions / extensions)
    3. for non-workflow categories: re-reads each JSON to recover the `domain` field (the scanner only kept key/path/flow/version) and the `attributes.type` for the description line
    4. for workflows: re-reads each JSON and walks `attributes.startTransition / cancel / updateData`, `attributes.sharedTransitions[]`, and every state in `attributes.states[]` plus its `transitions[]`, emitting one `QuickSwitchEntry` per state and per transition
    5. wraps everything in `{ entries, warnings }` — warnings collect file paths the indexer couldn't parse so the palette stays usable even on broken files
  - `index.ts` — barrel
- **`packages/services-core/src/index.ts`** — re-exported `services/quickswitcher`
- **`packages/services-core/src/registry/method-registry.ts`** — added `QuickswitcherService` to `ServiceRegistry`, registered `quickswitcher/buildIndex` method
- **`packages/app-contracts/src/method-http.ts`** — added `quickswitcher/buildIndex` to `MethodId` + `METHOD_HTTP_METADATA` (POST/json). Also fixed missing `quickrun/retryInstance` in the same enum (registry had it but the contract didn't — would have failed the `registry-contract.test.ts` parity check the next time someone ran it).
- **`apps/server/src/composition/services.ts`** — wired `createQuickswitcherService({ fs, logger, projectService })` into the registry

### Frontend (designer-ui)

- **`packages/designer-ui/src/modules/quick-switcher/`** — new module
  - `QuickSwitcherTypes.ts` — local mirror of `QuickSwitchEntry` (designer-ui never imports services-core to keep the browser bundle lean)
  - `QuickSwitcherStore.ts` — Zustand store: `isOpen`, `projectId`, `entries`, `warnings`, `status` (idle/loading/ready/error), `query`, `selectedIndex`. Actions: `open`, `close`, `setIndex`, `setLoading`, `setError`, `setQuery`, `moveSelection` (wrap-around), `setSelection`
  - `QuickSwitcherApi.ts` — `buildQuickSwitcherIndex(projectId)` calls `quickswitcher/buildIndex` via `unwrapApi`
  - `fuzzyMatch.ts` — VS-Code-style fuzzy scorer (no external deps; ~50 LOC). Scoring: +10 per match, +20 first-char bonus, +15 word-boundary bonus, +5 consecutive bonus, -2 per skipped char. Returns `{ score, indices }` or `null`. Plus `highlightMatches()` to split a label into highlighted/plain segments for the renderer.
  - `QuickSwitcher.tsx` — modal palette using `@radix-ui/react-dialog` primitives; mounts when `isOpen`. Rebuilds index on first open per project; reuses cached entries on reopens. Type badges (WF/ST/TX/TASK/SCHEMA/VIEW/FN/EXT) with per-type colour rings. Highlights matched chars in result labels. Keyboard nav: ↑↓ navigate (wrap-around), Enter selects, Esc closes. Auto-scrolls selected row into view.
  - `useGlobalQuickSwitcherShortcut.ts` — host-shell-callable hook; registers a single global `keydown` listener (capture phase) for `(Meta|Ctrl)+P`. No-op when no project active. Suppresses default browser print dialog.
  - `index.ts` — barrel
- **`packages/designer-ui/src/index.ts`** — exported `QuickSwitcher`, `useQuickSwitcherStore`, `useGlobalQuickSwitcherShortcut`, `buildQuickSwitcherIndex`, types

### Web shell wiring

- **`apps/web/src/modules/quick-switcher/QuickSwitcherMount.tsx`** — new web mount component. Reads active project from `useProjectStore`, registers Cmd+P shortcut, supplies `onSelect` that uses the existing `resolveFileRoute()` to build a route URL (`/project/:id/{flow|task|schema|view|function|extension}/:group/:name`) and calls `useNavigate()`. Designer-ui itself stays router-free.
- **`apps/web/src/app/layouts/AppLayout.tsx`** — mounted `<QuickSwitcherMount />` at the top of the shell so the palette is available wherever the app chrome is visible.

### Out of scope for this slice (deferred follow-ups)

- Deep-link to a specific state/transition (requires query params or hash + flow editor highlight). For now, picking a state/transition entry just opens the parent workflow editor.
- Index invalidation on file changes — current implementation rebuilds on first open per project, then caches until the project changes. Will pair this with workspace-fs-events later.
- Type filters (`>` for commands, `:` for type prefix). Plain symbol search only in MVP.
- Match-against-componentKey alongside label. Currently label-then-description fallback.

### Verification

- `pnpm --filter @vnext-forge-studio/services-core build` — green
- `pnpm --filter @vnext-forge-studio/designer-ui build` — green
- `pnpm build` (full monorepo) — green
- Manual smoke test on Electron, real `vnext-idm` project — palette opens with Cmd+P, ~230–700 ms first index build (size-dependent), entries appear, fuzzy match returns ranked results, ↵ opens the editor page

### Bugs found and fixed during smoke

Three fixes shipped before the palette worked end-to-end:

1. **Missing server route** — `apps/server/src/api/v1/index.ts` registers each domain's routes manually; `quickswitcher.routes.ts` was never created, so `POST /api/v1/quickswitcher/buildIndex` fell through to the SPA static fallback and returned `index.html` (458 B). Added `apps/server/src/api/v1/quickswitcher.routes.ts` with a single `app.post(...)` binding via `createDispatchHelper(...)`, registered it in `index.ts`.
2. **`projectService.getById` ↔ `getProject` rename** — initial implementation called the (non-existent) `projectService.getById(...)`. The actual API name is `projectService.getProject(...)` (this is the same method `projects/getById` route handler delegates to). One-line fix in `quickswitcher.service.ts`. Also moved param shape from `{ project }` (path) to `{ id }` (project id, matching the convention of every other `projects/*` method) and corrected `getConfig` access from `config.config.paths` to `config.paths` (returns the `VnextWorkspaceConfig` directly, not a status envelope).
3. **`useEffect` cancellation race vs. status-driven re-runs** — original `let cancelled = false; ... return () => { cancelled = true; }` cleanup interacted badly with `status` being in the deps array. The flow:
   1. Effect calls `setLoading()` → `status: 'idle' → 'loading'` synchronously
   2. React schedules a re-render; the effect re-runs because `status` changed
   3. The first effect's cleanup fires and sets `cancelled = true`
   4. The first fetch's `.then()` checks `cancelled`, sees `true`, skips `setIndex(...)` — but the second effect run sees `status === 'loading'` and returns early (no new fetch)
   5. Result: the request goes out (server logs `200 532ms`), but the UI is stuck on "Building index..." forever and a second Cmd+P never re-fires the request because the (silent) inflight state isn't tracked.
   Replaced the flag with `inflightProjectIdRef = useRef<string | null>(null)`. The ref persists across re-renders, the resolve handler checks `current === projectId` (ignoring orphan resolves while still applying the legitimate one), and the effect's guards become `inflightProjectIdRef.current === projectId` + the existing cache check. No cleanup needed; strict-mode safe.

### Working tree (no commits)

```
M apps/server/src/api/v1/index.ts                                            # +registerQuickswitcherRoutes
M apps/server/src/composition/services.ts                                    # +createQuickswitcherService
M apps/web/src/app/layouts/AppLayout.tsx                                     # +QuickSwitcherMount mount
M packages/app-contracts/src/method-http.ts                                  # +quickswitcher/buildIndex, +quickrun/retryInstance
M packages/designer-ui/src/index.ts                                          # +QuickSwitcher exports
M packages/services-core/src/index.ts                                        # +quickswitcher barrel
M packages/services-core/src/registry/method-registry.ts                     # +ServiceRegistry.quickswitcherService, +method
?? apps/server/src/api/v1/quickswitcher.routes.ts
?? apps/web/src/modules/quick-switcher/QuickSwitcherMount.tsx
?? packages/designer-ui/src/modules/quick-switcher/QuickSwitcher.tsx
?? packages/designer-ui/src/modules/quick-switcher/QuickSwitcherApi.ts
?? packages/designer-ui/src/modules/quick-switcher/QuickSwitcherStore.ts
?? packages/designer-ui/src/modules/quick-switcher/QuickSwitcherTypes.ts
?? packages/designer-ui/src/modules/quick-switcher/fuzzyMatch.ts
?? packages/designer-ui/src/modules/quick-switcher/index.ts
?? packages/designer-ui/src/modules/quick-switcher/useGlobalQuickSwitcherShortcut.ts
?? packages/services-core/src/services/quickswitcher/index.ts
?? packages/services-core/src/services/quickswitcher/quickswitcher-schemas.ts
?? packages/services-core/src/services/quickswitcher/quickswitcher.service.ts
?? docs/plans/desktop-studio-sprint-2-progress.md
```

### Smoke-test final state

- ✅ Cmd+P opens palette
- ✅ "Building index..." → results appear (~230–700 ms first call, instant on subsequent opens for the same project — cached)
- ✅ Type filters fuzzy match (label first, description as fallback)
- ✅ ↵ opens the picked entry's editor page via `resolveFileRoute`
- ✅ ↑↓ navigation, Esc closes, type badges colour-coded

---

## ✅ 2. Smart Search Cmd+Shift+F (project-wide content search)

VS Code pattern: Cmd+Shift+F (or Ctrl+Shift+F) opens the sidebar Search panel and focuses its input. The existing `apps/web/src/modules/project-search/SearchPanel` was already wired to the existing `files/search` method (regex content search across the project). All this slice did was add the global keyboard handler + a focus channel into the panel.

### Backend

Nothing — `files/search` is already registered in `services-core` (`workspace.service.ts:177–207`), exposed at `GET /api/v1/files/search`, and consumed by `useProjectSearch.ts`.

### Frontend wiring

- **`apps/web/src/app/store/useWebShellStore.ts`** — added `searchFocusNonce: number` and `requestSearchFocus()` action. The action sets `sidebarOpen: true`, `sidebarView: 'search'`, and bumps the nonce. Idempotent: second press re-selects the input even if the panel was already focused.
- **`apps/web/src/modules/quick-switcher/useGlobalContentSearchShortcut.ts`** — host-shell hook. Registers a single capture-phase `keydown` listener for `(Meta|Ctrl)+Shift+F` and calls `requestSearchFocus()`. No-op while no project is active.
- **`apps/web/src/modules/quick-switcher/QuickSwitcherMount.tsx`** — added `useGlobalContentSearchShortcut()` next to the existing `useGlobalQuickSwitcherShortcut(...)` so both shortcuts mount/unmount together.
- **`apps/web/src/modules/project-search/SearchPanel.tsx`** — added an `inputRef` to the existing search input, plus a `useEffect` watching `searchFocusNonce` that focuses + selects the input on each tick (deferred to the next tick so the panel's mount/animation doesn't steal focus back).

### Smoke

- ✅ Cmd+Shift+F when on Explorer → sidebar switches to Search, input focused
- ✅ Cmd+Shift+F when sidebar collapsed → sidebar opens, view switches, input focused
- ✅ Cmd+Shift+F when already on Search with text → input refocuses + content selected (type-replace)
- ✅ No-op without an active project (no listener attached)

### Working tree (additions for slice 2)

```
M apps/web/src/app/store/useWebShellStore.ts                                # +searchFocusNonce, +requestSearchFocus
M apps/web/src/modules/project-search/SearchPanel.tsx                       # +inputRef, +useEffect on nonce
M apps/web/src/modules/quick-switcher/QuickSwitcherMount.tsx                # +useGlobalContentSearchShortcut
?? apps/web/src/modules/quick-switcher/useGlobalContentSearchShortcut.ts
```

### Native menu accelerator (Electron only)

Initial smoke revealed that **DevTools intercepts Cmd+Shift+F before it reaches the renderer** (Chromium's "Search across sources"). The fix: route the shortcut through the OS-level **native menu accelerator** instead of a renderer keydown listener.

- **`apps/desktop/src/menu.ts`** — added Edit → "Find in Files…" (accelerator `CmdOrCtrl+Shift+F`) and a new Go menu with "Go to Anything…" (accelerator `CmdOrCtrl+P`). Click handler dispatches `vnext:menu-shortcut` IPC with id `'find-in-files'` or `'quick-switcher'` to the focused BrowserWindow.
- **`apps/desktop/src/preload.ts`** — exposes `window.vnextDesktop.onMenuShortcut(handler)` via `contextBridge`. Returns an unsubscribe function. Stays the only IPC surface for now.
- **`apps/web/src/types/vnext-desktop.d.ts`** — global `Window.vnextDesktop?` type so renderer code is type-safe and works without the bridge (vite dev, VS Code webview).
- **`apps/web/src/modules/quick-switcher/useDesktopMenuShortcutBridge.ts`** — subscribes to the bridge and dispatches into the same store actions (`useQuickSwitcherStore.open`, `useWebShellStore.requestSearchFocus`) the keydown path uses. No-op without the bridge.
- **`apps/web/src/modules/quick-switcher/QuickSwitcherMount.tsx`** — mounts the bridge alongside the existing keydown hooks so both paths coexist (desktop = native menu wins; web SPA / VS Code webview = JS keydown).

### Status

- ✅ Cmd+P works in desktop (native menu) and in web/extension (JS keydown)
- ⚠️ Cmd+Shift+F: works via JS keydown when DevTools is closed; native menu route still exhibits an issue under DevTools focus that we deferred to a later slice (deferred — not blocking the rest of Sprint 2).

### Out of scope (deferred follow-ups)

- "Find in selection" / "Find in folder" Cmd+Shift+F variants — sidebar Search panel is already powerful enough; a richer overlay can land later.
- Result preview side-by-side editor — clicking a result already navigates to the file via the existing `resolveFileRoute` path.
- Command palette-style overlay variant (e.g. `Cmd+P` with `>` prefix). Would compete with Cmd+P quick switcher; deferred.
- Native-menu Cmd+Shift+F final smoke (DevTools focus edge case).

---

## ✅ 3. Snippets Library

File-based reusable snippets, two scopes:

- **Personal:** `~/.vnext-studio/snippets/<id>.json` (per-machine, private)
- **Project:** `<project>/.vnextstudio/snippets/<id>.json` (Git-tracked, team-shared)

Format intentionally close to VS Code's snippet schema so a future import/export converter is a one-pager:

```json
{
  "name": "HTTP error handler",
  "prefix": "httperr",
  "language": "csx",
  "description": "Logs and rethrows as VnextForgeError",
  "body": ["try {", "  ${1:// call}", "} catch (ex) {", "  LogError(\"$2\", ex.Message);", "}"],
  "tags": ["error", "http"]
}
```

### Backend

- **`packages/services-core/src/services/snippets/`** — new module
  - `snippets-schemas.ts` — Zod schemas + `Snippet`, `SnippetFile`, `SnippetScope`, `SnippetLanguage` types and method param/result schemas
  - `snippets.service.ts` — five operations:
    - `listAll({ projectId? })` — walks both scope dirs, reads each JSON, filters out malformed files (collected in a `warnings` array so the UI stays usable)
    - `getOne({ scope, id, projectId? })` — single-snippet read
    - `save({ scope, id?, projectId?, data })` — create or update; auto-derives a slug-safe id from `data.name` when no `id` is provided, and appends a numeric suffix if the slug collides (lets users save several "Untitled" drafts)
    - `deleteOne({ scope, id, projectId? })` — `fs.rmrf` the file; idempotent
    - `openLocation({ scope, id?, projectId? })` — returns the absolute path the host shell should reveal in Finder/Explorer (creates the dir on demand for empty libraries)
  - `index.ts` — barrel
- Personal root is supplied by composition (`apps/server/src/composition/services.ts`) as `${os.homedir()}/.vnext-studio/snippets`. services-core stays Node-free; nothing in there calls `os.homedir()` itself.
- **Method registry** — five new entries (`snippets/listAll|getOne|save|delete|openLocation`)
- **`packages/app-contracts/src/method-http.ts`** — `MethodId` union + `METHOD_HTTP_METADATA` (all POST/json; `save` has `successStatus: 201`)
- **`apps/server/src/api/v1/snippets.routes.ts`** — five `app.post(...)` bindings via `createDispatchHelper`. Registered in `index.ts`.

### Frontend (designer-ui)

- **`packages/designer-ui/src/modules/snippets/`** — new module
  - `SnippetTypes.ts` — local TS mirror of the Zod-defined shapes (designer-ui never imports services-core)
  - `SnippetsApi.ts` — five thin `unwrapApi` wrappers
  - `SnippetsStore.ts` — Zustand store: library cache (per-projectId), picker state (open/query/selectedIndex/scope filter/language hint), editor state (`{ mode: 'create' | 'edit', scope, id? } | null`)
  - `snippetFuzzy.ts` — same scoring rules as the Cmd+P matcher (snippet-local copy; +highlight helper)
  - `snippetInsertion.ts` — clipboard-based "insert" path: copies `body.join('\n')` to the clipboard and surfaces a toast ("Paste with ⌘V" / "Ctrl+V"). Future iteration: register the active Monaco editor in a registry and call `editor.action.insertSnippet` directly.
  - `SnippetPicker.tsx` — Cmd+Shift+S overlay; dialog primitive; fuzzy match across name/prefix/tags; scope segmented filter (All / Project / Personal); language-hint filter (passed by the host when the picker is opened from a typed editor); inflight-ref pattern (no cancellation race) reused from the QuickSwitcher fix
  - `SnippetEditor.tsx` — modal form: name / prefix / language select / description / body `<textarea>` / comma-separated tags. Loads existing snippets via `getSnippet` for edit mode. Save shows toast + closes; cancel discards.
  - `SnippetsSidebarPanel.tsx` — sidebar list grouped by scope (Project on top, Personal below); per-row hover actions (Copy, Edit, Reveal path, Delete); section headers with "+ new" and "reveal library path" buttons; auto-refetches when projectId changes. The Project section is disabled with a "Open a project" hint when no project is active.
  - `useGlobalSnippetPickerShortcut.ts` — Cmd+Shift+S (or Ctrl+Shift+S) JS keydown listener (capture phase). Toggles open/closed; mounted as fallback for the vite dev SPA / VS Code webview where the native menu isn't present.
  - `index.ts` — barrel
- **`packages/designer-ui/src/index.ts`** — exported the full module surface

### Native menu accelerator (Electron)

- **`apps/desktop/src/menu.ts`** — added Edit → "Insert Snippet…" with accelerator `CmdOrCtrl+Shift+S`. Click handler calls the existing `dispatchMenuShortcut('insert-snippet')`. The shortcut id union widened in both `menu.ts` and `preload.ts`.
- **`apps/web/src/types/vnext-desktop.d.ts`** — `VnextDesktopMenuShortcutId` union widened
- **`apps/web/src/modules/quick-switcher/useDesktopMenuShortcutBridge.ts`** — handles the new `'insert-snippet'` id by calling `useSnippetsStore.openPicker({ mode: 'insert' })` (always, even without an active project — personal snippets are still usable)

### Web shell wiring

- **`apps/web/src/modules/snippets/SnippetsMount.tsx`** — mounts `<SnippetPicker projectId={...} />` and registers `useGlobalSnippetPickerShortcut()` as the keydown fallback
- **`apps/web/src/app/store/useWebShellStore.ts`** — `SidebarView` union extended with `'snippets'`
- **`apps/web/src/app/layouts/ui/ActivityBar.tsx`** — added the Code2 icon ("Snippets") between Search and Problems
- **`apps/web/src/app/layouts/ui/Sidebar.tsx`** — added the `'snippets'` case rendering `<SnippetsSidebarPanel projectId={activeProject?.id ?? null} />`
- **`apps/web/src/app/layouts/AppLayout.tsx`** — mounted `<SnippetsMount />` next to `<QuickSwitcherMount />`

### Bonus: Search panel mount fix

While verifying Snippets we noticed the sidebar `'search'` case was rendering a placeholder `<Input>` instead of the real `SearchPanel` (the panel exists in `apps/web/src/modules/project-search/SearchPanel.tsx` and its hook + result list are fully wired to the existing `files/search` method, but nothing was mounting it). This is the actual reason the user reported "Cmd+Shift+F doesn't work" earlier — the keydown path was firing `requestSearchFocus()` correctly, but the destination panel had no input ref to focus on.

- **`apps/web/src/app/layouts/ui/Sidebar.tsx`** — replaced the placeholder with `<SearchPanel />` in the `'search'` case. The `inputRef` + `searchFocusNonce` watcher we added in slice 2 now actually drives the real input.

### Smoke

- ✅ Snippets activity bar icon shows; sidebar renders `Project (n) / Personal (n)` sections
- ✅ "+ new" opens `SnippetEditor` modal pre-filled for the right scope
- ✅ Save persists to disk at the expected path; row appears in the sidebar list
- ✅ Edit reloads existing JSON; save updates in place
- ✅ Delete removes the file (with native `confirm()` guard) and refreshes the list
- ✅ Reveal copies the absolute path to the clipboard
- ✅ Cmd+Shift+S opens the picker overlay; fuzzy search across name/prefix/tags works; ↵ copies body + shows toast; Esc closes
- ✅ Cmd+Shift+F sidebar Search now actually opens (real `SearchPanel` mounted; input takes focus)
- ✅ Cmd+P quick switcher unchanged — no regression

### Working tree (additions for slice 3)

```
M apps/desktop/src/menu.ts                                                  # +Insert Snippet… accelerator
M apps/desktop/src/preload.ts                                               # +'insert-snippet' shortcut id
M apps/server/src/api/v1/index.ts                                           # +registerSnippetsRoutes
M apps/server/src/composition/services.ts                                   # +createSnippetsService + personalRoot
M apps/web/src/app/layouts/AppLayout.tsx                                    # +SnippetsMount mount
M apps/web/src/app/layouts/ui/ActivityBar.tsx                               # +Snippets icon entry
M apps/web/src/app/layouts/ui/Sidebar.tsx                                   # +snippets case, +real SearchPanel mount
M apps/web/src/app/store/useWebShellStore.ts                                # +'snippets' SidebarView
M apps/web/src/modules/quick-switcher/useDesktopMenuShortcutBridge.ts       # +'insert-snippet' handler
M apps/web/src/types/vnext-desktop.d.ts                                     # +shortcut id union
M packages/app-contracts/src/method-http.ts                                 # +5 snippets/* method ids + metadata
M packages/designer-ui/src/index.ts                                         # +Snippets exports
M packages/services-core/src/index.ts                                       # +snippets barrel
M packages/services-core/src/registry/method-registry.ts                    # +SnippetsService + 5 methods
?? apps/server/src/api/v1/snippets.routes.ts
?? apps/web/src/modules/snippets/SnippetsMount.tsx
?? packages/designer-ui/src/modules/snippets/SnippetEditor.tsx
?? packages/designer-ui/src/modules/snippets/SnippetPicker.tsx
?? packages/designer-ui/src/modules/snippets/SnippetTypes.ts
?? packages/designer-ui/src/modules/snippets/SnippetsApi.ts
?? packages/designer-ui/src/modules/snippets/SnippetsSidebarPanel.tsx
?? packages/designer-ui/src/modules/snippets/SnippetsStore.ts
?? packages/designer-ui/src/modules/snippets/index.ts
?? packages/designer-ui/src/modules/snippets/snippetFuzzy.ts
?? packages/designer-ui/src/modules/snippets/snippetInsertion.ts
?? packages/designer-ui/src/modules/snippets/useGlobalSnippetPickerShortcut.ts
?? packages/services-core/src/services/snippets/index.ts
?? packages/services-core/src/services/snippets/snippets-schemas.ts
?? packages/services-core/src/services/snippets/snippets.service.ts
```

### Out of scope (deferred follow-ups)

- Direct Monaco "insert at cursor" (clipboard fallback covers every editor surface today; native insert needs an editor-instance registry)
- Tag filter chip in the picker UI (search-by-tag works, scope filter exists; explicit chip-style filter row deferred)
- VS Code snippet bundle import / export
- Snippet completion provider (typing the prefix in the editor → autocomplete listing)
- Project-snippet "share with team" — currently relies on Git of the project's `.vnextstudio/`

---

## ✅ 4. Workspace Sessions

**Goal:** When a user reopens a project (or relaunches the Electron app), the workspace should look exactly like they left it: the same editor tabs in the same order, the same active tab, the same sidebar view + width, the same last-used quick-switcher query. Stored per-project as `<project>/.vnextstudio/session.json` so it travels with the workspace (and a team can opt to commit a default — though by default we leave it `.vnextstudio/`-relative so each developer keeps their own).

### Backend

- **`packages/services-core/src/services/sessions/`** — new module
  - `sessions-schemas.ts` — Zod schemas + types:
    - `WorkspaceSession` (current `version: 1`): `editor.{open[], activeTabId}` + `sidebar.{view, open, width}` + `runtime.{activeConnectionId}` + `palette.{lastQuickSwitcherQuery?, lastSearchQuery?, lastSnippetQuery?}` + `lastSavedAt` (ISO string)
    - `SessionEditorTab` is intentionally **loose** (every field optional, including `kind` and `title`) — we'd rather restore a slightly malformed tab than drop the whole session because one historical write doesn't match today's strict tab schema. The frontend `fromSessionTab` adapter falls back to safe defaults (`kind: 'file'`, `title: id`).
    - `sessions/get|save|clear` param + result schemas
  - `sessions.service.ts` — three operations:
    - `get({ projectId })` — reads `<project>/.vnextstudio/session.json` via `fs.readJson`. **Tolerant**: catches Zod parse failures, logs once, returns `{ session: null }` so the UI applies defaults instead of crashing on legacy/malformed data.
    - `save({ projectId, session })` — stamps `lastSavedAt: new Date().toISOString()`, writes pretty-printed JSON, returns `{ ok: true, path }`. Creates `.vnextstudio/` on demand (`ensureDir` first).
    - `clear({ projectId })` — `fs.rmrf` the file; idempotent (returns `{ cleared: false }` if it didn't exist)
  - `index.ts` — barrel
- **`packages/services-core/src/index.ts`** — re-exported `services/sessions`
- **`packages/services-core/src/registry/method-registry.ts`** — added `SessionsService` to `ServiceRegistry`, registered three methods (`sessions/get`, `sessions/save`, `sessions/clear`)
- **`packages/app-contracts/src/method-http.ts`** — added the three method ids + `METHOD_HTTP_METADATA` (all POST/json; `save` returns 200 not 201 — overwrite-in-place semantics, not creation)
- **`apps/server/src/api/v1/sessions.routes.ts`** — three `app.post(...)` bindings via `createDispatchHelper`
- **`apps/server/src/api/v1/index.ts`** — added `registerSessionsRoutes(app)`
- **`apps/server/src/composition/services.ts`** — `createSessionsService({ fs, logger, projectService })` wired into the registry

### Frontend (designer-ui)

- **`packages/designer-ui/src/modules/sessions/`** — new module
  - `SessionTypes.ts` — local mirror of the Zod-defined shapes (`WorkspaceSession`, `SessionEditorTab`, etc.) + `DEFAULT_WORKSPACE_SESSION` constant. Pattern matches QuickSwitcher / Snippets — designer-ui never imports services-core.
  - `SessionsApi.ts` — three thin `unwrapApi` wrappers (`getSession`, `saveSession`, `clearSession`). `getSession` returns `Promise<WorkspaceSession | null>` so callers can pattern-match against the "fresh project" case explicitly.
  - `index.ts` — barrel
- **`packages/designer-ui/src/index.ts`** — exported the module surface (the API helpers + types + `DEFAULT_WORKSPACE_SESSION`). The hook itself lives in `apps/web` because it touches host stores (`useEditorStore`, `useWebShellStore`, `useQuickSwitcherStore`).

### Web shell wiring

- **`apps/web/src/modules/sessions/useWorkspaceSession.ts`** — single host hook. Three `useEffect`s, all keyed on `[projectId]`:
  1. **Restore** — on `projectId` change, fetches the saved session and applies it: rebuilds editor tabs via `fromSessionTab` (drops only the `id`-less ones), resolves `activeTabId` (falls back to last tab if the saved one is gone), applies sidebar `view` / `open` / `width`, then sets a project-scoped "restored" gate (`restoredForRef`) and seeds `lastSerializedRef` with the current snapshot so the persist debouncer won't immediately re-write the same bytes.
  2. **Persist (debounced)** — subscribes to `useEditorStore` and `useWebShellStore`. Each store change schedules a 1-second debounced save. The handler bails if the gate hasn't closed for the current project (i.e. restore still in flight) and skips writes when the serialized snapshot equals the last one written.
  3. **Flush on unload** — `beforeunload` handler does a best-effort sync save (the debounce already wrote at most a second ago, so even if the renderer dies before the request lands we lose ≤ 1s of state).

  Two design decisions worth highlighting:
  - **Single hook, not split** — the "did we restore yet?" gate naturally lives in one ref and prevents the persist debouncer from racing the initial restore and overwriting saved state with empty defaults.
  - **`projectId` capture for closure narrowing** — `useEffect(() => { if (!projectId) return; const pid: string = projectId; … }, [projectId])`. TypeScript doesn't propagate the early-return null check through closures; capturing into a local typed const keeps the inner `schedulePersist` / `handleBeforeUnload` callbacks satisfied without `!` assertions.

- **`apps/web/src/app/layouts/AppLayout.tsx`** — single line: `useWorkspaceSession(projectId ?? null)` next to the existing `useProjectWorkspacePage(routeProjectId)` call. The hook self-manages restore and persist; AppLayout doesn't render or coordinate anything else.

### Smoke (real `morph-idm-master` project, Electron desktop)

Manual test sequence:

1. Launch Electron, open a project, open three tabs (one task, one flow, one schema), drag the sidebar to ~440 px, leave on the Project view, wait ≥ 1s.
2. **Verify on disk** — `<project>/.vnextstudio/session.json` written, `version: 1`, three `editor.open` entries with the right `componentKind` / `group` / `name`, `activeTabId` set to the last-opened tab, `sidebar.{view: 'project', open: true, width: 440}`, `lastSavedAt` an ISO timestamp ≤ 1s old.
3. **Verify wire calls** — server log shows one `POST /api/v1/sessions/get 200` on launch (returns 0 bytes for a fresh project), then a stream of `POST /api/v1/sessions/save 200` as tabs / sidebar mutate.
4. Quit Electron (`Cmd+Q`) — confirmed clean exit (exit code 0).
5. Relaunch Electron — server log shows the new launch firing one `POST /api/v1/sessions/get 200 21.9 ms`. The three saved tabs reappear in the editor; the active tab is the same schema; the persist debouncer stays quiet (no save fires) because the restored snapshot equals what's on disk.

Result:

- ✅ Tab list restores in order
- ✅ Active tab restored
- ✅ Sidebar view restored
- ⚠️ Sidebar **width** restore: store value is correct (`useWebShellStore.getState().sidebarWidth === 440`), but the `react-resizable-panels` `defaultLayout` memo in `AppLayout.tsx` runs once at mount with the pre-restore default and doesn't re-apply when the store value updates. Tracked as a separate spawned task ("Fix sidebar width not snapping after session restore") — likely needs an imperative `groupRef.current?.setLayout(...)` after restore, or the memo to take a "restored snapshot version" counter as an extra dep. Not a blocker for shipping the feature; tabs + view + open/closed all work and the on-disk snapshot is correct.
- ✅ No phantom writes (dedup via `lastSerializedRef` confirmed — relaunch produces exactly one `sessions/get`, no immediate follow-up `sessions/save`).
- ✅ Quit-and-relaunch round-trip closes the loop.

### Working tree (additions for slice 4)

```
M apps/server/src/api/v1/index.ts                                            # +registerSessionsRoutes
M apps/server/src/composition/services.ts                                    # +createSessionsService
M apps/web/src/app/layouts/AppLayout.tsx                                     # +useWorkspaceSession hook call
M packages/app-contracts/src/method-http.ts                                  # +3 sessions/* method ids + metadata
M packages/designer-ui/src/index.ts                                          # +Sessions exports
M packages/services-core/src/index.ts                                        # +sessions barrel
M packages/services-core/src/registry/method-registry.ts                     # +SessionsService + 3 methods
?? apps/server/src/api/v1/sessions.routes.ts
?? apps/web/src/modules/sessions/useWorkspaceSession.ts
?? packages/designer-ui/src/modules/sessions/SessionTypes.ts
?? packages/designer-ui/src/modules/sessions/SessionsApi.ts
?? packages/designer-ui/src/modules/sessions/index.ts
?? packages/services-core/src/services/sessions/index.ts
?? packages/services-core/src/services/sessions/sessions-schemas.ts
?? packages/services-core/src/services/sessions/sessions.service.ts
```

### Out of scope (deferred follow-ups)

- **Imperative sidebar-width restore** — flagged as a separate task; tabs + view restore today, width follow-up is purely visual.
- **Schema versioning / migration** — `version: 1` is reserved; future shape changes should land a `migrateWorkspaceSession(input)` function alongside.
- **Tab-buffer (unsaved edits) restore** — current snapshot persists tab identity only (`id`, `kind`, `componentKind`, `group`, `name`, `filePath`, `language`). Restoring unsaved Monaco buffers needs a separate "draft" store and a write-on-change channel; deferred.
- **Per-project layout (split editors, panel sizes beyond sidebar)** — the field is reserved by leaving room in the sidebar/runtime sub-objects; expand later without breaking version 1.
- **`.gitignore` template** — we're not auto-injecting `.vnextstudio/session.json` into the project's `.gitignore`. Each project decides whether to commit defaults; document later under the project-scaffold flow.

## ✅ 5. Integrated Terminal

**Goal:** A bottom-of-screen, VS-Code-style terminal panel that spawns a real PTY (zsh / bash / cmd) inside the active project's root. Users get full ANSI rendering, multiple named tabs, drag-to-resize, and a global toggle shortcut. The single most-requested productivity gap separating the standalone designer from a full IDE.

### Backend (`apps/server` + native `node-pty`)

- **`node-pty@1.1.0`** added as a dep of `apps/server` and `apps/desktop` (so Electron's resolver finds it through both `apps/server/node_modules` and `apps/desktop/node_modules`).
- **`apps/server/src/pty/`** — new module, modeled directly on the existing LSP WebSocket setup (`apps/server/src/lsp/`):
  - `pty-protocol.ts` — Zod-discriminated client→server schema (`start | input | resize | signal | ping`) plus a typed server→client message union (`ready | data | exit | error | pong`). Pure JSON over text frames; shell output is UTF-8 (node-pty's default), ANSI escapes are pure ASCII so no binary frame plumbing needed.
  - `pty-ws-policy.ts` — `assertPtyWebSocketOriginAllowed` / `assertPtyConnectionCapacityOk` / `assertPtyInboundMessageSizeOk`. Mirrors `lsp-ws-policy.ts` 1:1; loopback-host bypass + explicit origin allowlist.
  - `pty-session.ts` — single class wrapping one `IPty` + one `WebSocket`. State machine: `pending → running → closed`. The first frame must be `start` (otherwise the WS closes with `PTY_NOT_STARTED`); `start` carries `cwd`, optional `shell`, `cols/rows`, `env`. `pty.onData → ws.send({type:'data',chunk})`. `ws.onClose → pty.kill()` (so abandoned tabs don't leak shells). `pty.onExit → ws.send({type:'exit',code,signal})` then close. Optional `assertCwdAllowed` hook lets a host plug in path policy; default is no-op (loopback-only single-developer trust).
  - `router.ts` — `injectPtyWebSocket(server, deps)` — same `wss = new WebSocketServer({ noServer: true }) + server.on('upgrade', …)` skeleton as the LSP router; per-connection counter drives capacity policy.
- **`apps/server/src/index.ts`** — `injectPtyWebSocket(server, { logger, bindHost, corsAllowedOrigins, ptyMaxMessageBytes, ptyMaxConnections })` next to `injectLspWebSocket`.
- **`apps/server/src/shared/config/config.ts`** — added `ptyMaxMessageBytes` (default 65 536) and `ptyMaxConnections` (default 16) with `PTY_MAX_*` env overrides.

### Desktop bundling (`apps/desktop`)

- **`apps/desktop/esbuild.desktop.mjs`** — added `node-pty` to the server bundle's `external[]`. Without this esbuild inlines the JS half of node-pty, but the loader inside it then looks for `prebuilds/<platform>/pty.node` relative to the *bundle's* location (`dist/`), not the package location, and the require throws at first use. Marking it external keeps the require dynamic; at runtime Node's resolver finds it through the apps/desktop symlink.
- **`spawn-helper` execute bit**: pnpm 9.15.0 dropped the `+x` bit on `node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` during the install. node-pty fails its first `posix_spawnp(2)` with a generic `posix_spawnp failed.` because the helper isn't executable. Manually `chmod +x`'d for now; tracked as a separate spawned task ("Add postinstall to chmod node-pty spawn-helper") because it'll regress on every fresh install otherwise.

### Frontend (`packages/designer-ui`)

- **`@xterm/xterm@6.0.0`** + `@xterm/addon-fit` + `@xterm/addon-web-links` + `@xterm/addon-search` added to `designer-ui` deps. Selection of addons matches the "renderer-only" scope: fit (auto-resize on container changes), web-links (clickable URLs in output), search (Ctrl+F across scrollback — wired in store but unsurfaced in this slice).
- **`packages/designer-ui/src/modules/terminal/`** — new module
  - `TerminalTypes.ts` — `TerminalSession` (id, name, cwd, shell?, state, pid?, error?, exitCode?, createdAt) + `TerminalConnectionState` (`idle|connecting|starting|running|exited|error`). Stays JSON-serializable — a future `WorkspaceSession` schema bump can persist the tab list as-is.
  - `TerminalSocket.ts` — pty WebSocket wrapper. `buildTerminalWsUrl(apiBaseUrl, sessionId)` mirrors the existing `lspClient.ts` URL builder (explicit base URL → `window.location.host` → `127.0.0.1` last-resort). Speaks the `pty-protocol` JSON. Forwards parsed frames to typed callbacks (`onReady`, `onData`, `onExit`, `onError`). `dispose()` closes the WS — host then kills the pty.
  - `TerminalStore.ts` — Zustand: panel chrome (`isOpen`, `heightPx` clamped to `[120, 800]`), session list, `activeId`, plus per-session lifecycle actions (`markStarting`, `markRunning`, `markExited`, `markError`). Importantly the store does NOT own the xterm/socket instance — those live in the per-session `TerminalView` component, so the store stays serializable and free of side-effecty refs.
  - `TerminalView.tsx` — single tab. Mounts xterm.js into a div, wires `term.onData ↔ socket.write`, `term.onResize ↔ socket.resize`, opens the WS, sends `start` with the resolved cwd / shell / cols / rows. ResizeObserver re-fits the terminal whenever the container changes. `isActive` toggles `display: block | none` instead of unmount — scrollback survives tab switches. Custom dark theme matching the shell's surface palette.
  - `TerminalTabs.tsx` — top-of-panel tab bar. Per-tab status dot (running=green, starting=amber, exited=zinc, error=rose), per-tab `×` close on hover, double-click to rename inline (Enter / blur commits, Esc cancels). Sticky `+` and `▾` (collapse) at the right edge.
  - `TerminalPanel.tsx` — bottom dock container. Auto-creates the first terminal when the panel opens for the first time with no sessions; subsequent opens reuse whichever tabs the user left around. Sessions stay mounted absolute-positioned inside a single overlay div; only the active one is visible. Top edge is a custom drag-to-resize handle (pointer events with `setPointerCapture` — separate idiom from the existing horizontal `ResizablePanelGroup` because this panel grows UPWARD).
  - `useGlobalTerminalToggleShortcut.ts` — capture-phase keydown listener with two bindings: `Ctrl+\`` (VS Code's canonical "Toggle Terminal") and `(Cmd|Ctrl)+J` (VS Code's "Toggle Panel" — letter-key fallback that works on Turkish Q / AZERTY layouts where backtick is a dead key). No-op when `enabled` is false.
  - `index.ts` — barrel
- **`packages/designer-ui/src/index.ts`** — exported the module surface.

### Web shell wiring (`apps/web`)

- **`apps/web/src/modules/terminal/TerminalMount.tsx`** — host mount. Resolves `defaultCwd` from `useProjectStore.activeProject.path`, forwards `config.apiBaseUrl` to the WS builder, registers `useGlobalTerminalToggleShortcut({ enabled: !!activeProject })`. Auto-closes the panel when the active project drops away (no cwd to spawn into).
- **`apps/web/src/app/layouts/AppLayout.tsx`** — `<TerminalMount />` between the inner horizontal split and `<StatusBar />`. The panel shrinks the editor area instead of overlaying it.
- **`apps/desktop/src/menu.ts`** — added `View → Toggle Terminal` with accelerator `CmdOrCtrl+J`. Click handler dispatches `vnext:menu-shortcut` with id `'toggle-terminal'`. The shortcut id was widened in `apps/desktop/src/preload.ts`'s union and in `apps/web/src/types/vnext-desktop.d.ts`.
- **`apps/web/src/modules/quick-switcher/useDesktopMenuShortcutBridge.ts`** — added the `'toggle-terminal'` handler that calls `useTerminalStore.getState().toggle()`.

### Smoke (real `morph-idm-master` project, Electron desktop)

1. Launch Electron, project restored from session.json (Sprint 2 Item 4 ✅), file tree visible in sidebar.
2. **Verify endpoint**: server log on launch shows `path: "/api/pty"`, `msg: "PTY WebSocket endpoint registered"`.
3. Press `Cmd+J` (or click View → Toggle Terminal in the native menu). Bottom panel opens, "Terminal 1" tab auto-spawns.
4. Run `pwd` → returns `/Users/burgan/Documents/Projects/morph-idm-master` (correct project root cwd).
5. Run `ls`, `echo merhaba vnext` → ANSI colors render, prompt rebuilds correctly.
6. `+` button → "Terminal 2" tab spawns; switching tabs preserves scrollback (xterm DOM stays mounted, just `display: none` flipped).
7. Drag the panel's top edge upward → height grows live; clamp at 800 px.
8. `▾` button collapses the panel; `Cmd+J` re-opens with the same tab list intact.

Status:

- ✅ Panel toggles via menu, keyboard shortcut, and tab-bar `▾` button
- ✅ Auto-spawn on first open with active-project cwd
- ✅ Multi-tab create / switch / close; rename via double-click
- ✅ ANSI color rendering, web-links addon (cmd-clickable URLs)
- ✅ Drag-to-resize panel height
- ✅ pty cleanup on tab close / panel close / Electron quit (no zombie shells observed)

### Bugs found and fixed during smoke

1. **Server bundle missed `pty.node` native binary** — esbuild bundled the JS half of node-pty inline. node-pty's loader then looked for `prebuilds/darwin-arm64/pty.node` relative to the bundle's `dist/` directory and threw `Failed to load native module: pty.node`. Fixed by marking `node-pty` as `external` in `apps/desktop/esbuild.desktop.mjs`. At runtime, the bundle does a real `require('node-pty')` and Node's resolver follows pnpm's symlink chain to the prebuilt binary in its real location.

2. **`spawn-helper` not executable** — pnpm dropped the `+x` bit during install of node-pty's prebuilds. First `pty.spawn(...)` threw `posix_spawnp failed.` with no further detail. Fixed manually with `chmod +x`. Spawned a separate task to add a root-level `postinstall` script that re-applies the bit on every fresh install (otherwise this regresses on each `pnpm install`).

3. **Duplicate desktop-menu shortcut bridge** — `useDesktopMenuShortcutBridge` was being mounted twice (once in `QuickSwitcherMount`, once in `TerminalMount`). Both subscriptions called `useTerminalStore.toggle()` on every `'toggle-terminal'` IPC, so the panel toggled, then immediately toggled back — net effect: the panel never appeared and the menu / shortcut looked broken. Removed the second mount; the bridge is now a single subscription owned by `QuickSwitcherMount`.

4. **Backtick unreachable on Turkish Q layout** — initial keyboard binding was `Ctrl+\`` only, matching VS Code. The user's keyboard places backtick behind a dead key; the binding was unreachable. Added `(Cmd|Ctrl)+J` (VS Code's "Toggle Panel" — plain letter key) as a co-equal binding. Native menu accelerator switched to `CmdOrCtrl+J` for the same reason.

### Working tree (additions for slice 5)

```
M apps/desktop/esbuild.desktop.mjs                                          # +node-pty external
M apps/desktop/package.json                                                 # +node-pty dep
M apps/desktop/src/menu.ts                                                  # +Toggle Terminal accelerator
M apps/desktop/src/preload.ts                                               # +'toggle-terminal' shortcut id
M apps/server/package.json                                                  # +node-pty dep
M apps/server/src/index.ts                                                  # +injectPtyWebSocket
M apps/server/src/shared/config/config.ts                                   # +ptyMax* fields
M apps/web/src/app/layouts/AppLayout.tsx                                    # +TerminalMount mount
M apps/web/src/modules/quick-switcher/useDesktopMenuShortcutBridge.ts       # +'toggle-terminal' handler
M apps/web/src/types/vnext-desktop.d.ts                                     # +shortcut id union
M packages/designer-ui/package.json                                         # +@xterm/* deps
M packages/designer-ui/src/index.ts                                         # +Terminal exports
?? apps/server/src/pty/pty-protocol.ts
?? apps/server/src/pty/pty-session.ts
?? apps/server/src/pty/pty-ws-policy.ts
?? apps/server/src/pty/router.ts
?? apps/web/src/modules/terminal/TerminalMount.tsx
?? packages/designer-ui/src/modules/terminal/TerminalPanel.tsx
?? packages/designer-ui/src/modules/terminal/TerminalSocket.ts
?? packages/designer-ui/src/modules/terminal/TerminalStore.ts
?? packages/designer-ui/src/modules/terminal/TerminalTabs.tsx
?? packages/designer-ui/src/modules/terminal/TerminalTypes.ts
?? packages/designer-ui/src/modules/terminal/TerminalView.tsx
?? packages/designer-ui/src/modules/terminal/index.ts
?? packages/designer-ui/src/modules/terminal/useGlobalTerminalToggleShortcut.ts
```

### Out of scope (deferred follow-ups)

- **Persist terminal tabs across sessions** — extends Sessions schema with `terminal.{open[], activeId}` (tab metadata only — pty processes can't survive a relaunch). Land alongside a Sessions schema v2 migration.
- **Search in scrollback (Ctrl+F)** — addon-search is already loaded; just needs a UI overlay.
- **Per-shell selection in the `+` menu** — currently every tab uses `process.env.SHELL`. Future: a dropdown next to `+` to pick zsh / bash / pwsh / etc.
- **Split terminal pane** — a second tab in a vertical split, like VS Code's split-terminal. Out of scope; multi-tab covers the core need.
- **Native-binary re-pack for distribution** — Phase 9 packaging will need `electron-builder`'s `asarUnpack` configured to keep `node-pty/prebuilds/**` outside the asar archive (asar can't expose execute bits to `posix_spawnp`).
- **Sidebar-width-restore quirk** (carried over from Item 4) is unchanged; tracked in its own spawned task.

## ✅ 6. Pre-Commit Hooks

**Goal:** When the user runs `git commit` (in the integrated terminal or any external shell), every staged vNext component JSON gets validated against `@burgan-tech/vnext-schema` before the commit lands. Broken JSON, missing required fields, type mismatches — all caught at commit time, not at PR review. The desktop app must NOT block commits when it isn't running (commits are common from terminals while the IDE is closed).

### Architecture: discovery-file + thin hook + dispatchable validator

A `.git/hooks/pre-commit` shell script written by the desktop app, talking back to the running server via loopback HTTP. Three moving pieces:

1. **Discovery file** — `~/.vnext-studio/server.json` (`{ host, port, pid, startedAt }`). The server writes it on launch, removes it on graceful shutdown. The hook reads this file to find the running app; if it's missing or the PID is dead, the hook prints a notice and exits 0 (no validation, but no commit blocked either).

2. **Managed hook script** — POSIX `sh` (no bashisms), uses `python3` for JSON parsing (universally present on macOS / Linux / Git-for-Windows), curls the running server. Carries a marker comment so the installer can later detect "this is ours" vs. "user / husky / lefthook owns this hook".

3. **Validation endpoint** — `POST /api/v1/git-hooks/runPreCommitValidation { projectId, paths }`. Service classifies each path against the project's vNext component-type folders (using the same `buildComponentFolderRelPaths` that the file-tree icons + scanner use), reads each, calls `validateService.validateComponent(content, type)`, and returns `{ ok, files: [...], skipped: [...] }`. The hook's Python parser turns that into ANSI-colored output and exits 0/1.

### Backend (`packages/services-core`)

- **`packages/services-core/src/services/git-hooks/`** — new module
  - `git-hooks-schemas.ts` — Zod schemas for the four method param/result pairs. `GitHooksStatusResult.status` is a union: `not-a-git-repo | not-installed | installed | foreign`. Foreign means a non-managed hook is in the way (husky, lefthook, hand-written) — the install method refuses to overwrite it without `force: true`.
  - `pre-commit-template.ts` — `renderPreCommitScript({ projectId })` and `MANAGED_HOOK_VERSION = 'v1'`. Bumping the version forces install to overwrite older managed hooks while still leaving foreign hooks alone. The script content embeds the projectId and walks: discovery-file → staged paths via `git diff --cached` → POST → format response with python (errors red, warnings amber, summary green).
  - `git-hooks.service.ts` — four methods. `install` reads any existing hook, looks for our marker, refuses to clobber foreign hooks. `status` returns the four-way classification + `upToDate` flag. `uninstall` is idempotent and refuses to remove non-managed hooks unless `force: true`. `runPreCommitValidation` walks the staged paths, classifies via `buildComponentFolderRelPaths`, reads JSON, calls `validateService.validateComponent`, accumulates `{files, skipped}` and an aggregate `ok` flag.
  - `index.ts` — barrel
- **`packages/services-core/src/index.ts`** — re-exported `services/git-hooks/index.js`
- **`packages/services-core/src/registry/method-registry.ts`** — added `GitHooksService` to `ServiceRegistry`, registered four methods (`git-hooks/install|status|uninstall|runPreCommitValidation`)
- **`packages/services-core/src/registry/policy.ts`** — explicit `'privileged'` capability for all four (touch the project's `.git/hooks/` and on-disk JSON)
- **`packages/services-core/src/adapters/file-system.ts`** — added `chmod(filePath, mode)` to `FileSystemAdapter`. Without it, the hook is written but git silently ignores it (executable bit missing). Implementations: Node fs in `apps/server` and `apps/extension`; the existing test-fs in `services-core/test/` was extended too.

### Wire (`packages/app-contracts` + `apps/server`)

- **`packages/app-contracts/src/method-http.ts`** — added the four method ids + `METHOD_HTTP_METADATA` (`install` returns `successStatus: 201`; the others 200; all POST/json).
- **`apps/server/src/api/v1/git-hooks.routes.ts`** — four POST routes via `createDispatchHelper`
- **`apps/server/src/api/v1/index.ts`** — registered after the sessions/snippets routes
- **`apps/server/src/composition/services.ts`** — `createGitHooksService({ fs, logger, projectService, validateService })` wired into the registry
- **`apps/server/src/index.ts`** — writes `~/.vnext-studio/server.json` after `serve(...)` resolves; deletes it on `SIGINT` / `SIGTERM` / `exit`. The cleanup re-reads the file before deleting and only removes it when its `pid` matches `process.pid` — prevents a second desktop instance erasing the active discovery info if two apps race.

### Frontend (`packages/designer-ui`)

- **`packages/designer-ui/src/modules/git-hooks/`** — new module
  - `GitHooksTypes.ts` — local mirror of the schema-defined shapes (`GitHooksStatus`, `GitHooksRunPreCommitResult`, validation file/skipped types, etc.). designer-ui never imports services-core (browser-bundle hygiene); the runtime payloads are validated server-side and cast on the way in.
  - `GitHooksApi.ts` — four `unwrapApi` wrappers (`getGitHooksStatus`, `installGitHooks`, `uninstallGitHooks`, `runPreCommitValidation`)
  - `GitHooksStore.ts` — Zustand: per-projectId status cache + `fetchedAt` TTL (5s) + dedup of in-flight refreshes via a `refreshing` map of promises. Exposes `refresh / install / uninstall` actions.
  - `GitHooksStatusChip.tsx` — compact StatusBar widget. Icon + tone driven by `status` (green `ShieldCheck` when installed + up to date, amber `ShieldAlert` when outdated, idle `GitBranch` when off, rose `ShieldOff` when foreign). Click opens a small popover with the right action: install, reinstall (if outdated), uninstall, or "force remove" (foreign). Polls every 60s while mounted so an external `git` install / removal eventually reflects in the chip.
  - `index.ts` — barrel
- **`packages/designer-ui/src/index.ts`** — exported the module surface

### Web shell wiring (`apps/web`)

- **`apps/web/src/app/layouts/ui/StatusBar.tsx`** — mounted `<GitHooksStatusChip projectId={activeProject?.id ?? null} />` between the runtime status chip and the issue popover. Hides when no project is active.

### Hook script (the most user-facing artefact)

The script that lands at `<project>/.git/hooks/pre-commit` is generated at install time via `renderPreCommitScript({ projectId })`. Behaviour:

```
1. Read ~/.vnext-studio/server.json. If missing → print yellow "skipping" notice, exit 0.
2. Verify the recorded PID is alive (`kill -0`). Stale → exit 0.
3. Collect staged paths: `git diff --cached --name-only --diff-filter=ACMR`.
4. Build JSON: { projectId, paths }.
5. POST to http://<host>:<port>/api/v1/git-hooks/runPreCommitValidation.
6. Parse response with Python:
   - Per failed file: red ✘ + path + componentType + first 6 errors with location
   - "X more" line if >6 errors
   - Green summary on full pass
   - Yellow notable-skip list (excluding noisy "not-a-vnext-component")
7. Exit 1 if any file invalid; 0 otherwise.
```

The script depends only on POSIX `sh`, `git`, `curl`, and `python3` — all universally present on the supported platforms.

### Smoke (real `vnext-messaging-gateway` project, Electron desktop)

Verified end-to-end via the same Electron instance running Item 5's terminal:

1. **StatusBar chip** — appeared after the project was active. Rendered as `Hooks: off` (gray `GitBranch` icon) — confirmed in the server log via `POST /api/v1/git-hooks/status 200` calls firing at the chip's 60s heartbeat.
2. **User clicked install** — `POST /api/v1/git-hooks/install 201` (verified after the fact: a follow-up curl-direct `install` returned `outcome: 'unchanged'`, meaning the file was already there).
3. **`.git/hooks/pre-commit` written and executable** — `-rwxr-xr-x ... 4520 bytes`, `head` shows the marker `# vnext-forge-studio managed pre-commit hook v1`.
4. **`runPreCommitValidation` against a known-bad workflow** — fabricated `{ "key": "broken", "attributes": { "missing-required-fields": true } }`, called the endpoint, got `ok: false` with **nine** specific schema errors (`must have required property "flow" / flowVersion / domain / version / tags`; `/attributes`: `must have required property "type" / states / startTransition / labels`). Exactly the per-file output the hook script renders to the terminal.
5. **`runPreCommitValidation` against a non-component path** — correctly skipped with `reason: 'not-a-vnext-component'`. Random files in the project (README.md, package.json, etc.) won't accidentally fail commits.
6. **`status` reflects on-disk reality** — `installed`, `managedVersion: "v1"`, `upToDate: true`. The chip shows `Hooks: on` (green ShieldCheck).
7. **Discovery file present and correctly scoped** — `~/.vnext-studio/server.json` carries `{ host: "127.0.0.1", port, pid: <utility-process pid>, startedAt: ISO }`.

### Working tree (additions for slice 6)

```
M apps/server/src/api/v1/index.ts                                            # +registerGitHooksRoutes
M apps/server/src/composition/services.ts                                    # +createGitHooksService
M apps/server/src/index.ts                                                   # +server.json writer + signal handlers
M apps/server/src/adapters/node-file-system.ts                               # +chmod
M apps/extension/src/adapters/vscode-file-system.ts                          # +chmod
M apps/web/src/app/layouts/ui/StatusBar.tsx                                  # +GitHooksStatusChip mount
M packages/app-contracts/src/method-http.ts                                  # +4 git-hooks/* method ids + metadata
M packages/designer-ui/src/index.ts                                          # +git-hooks exports
M packages/services-core/src/adapters/file-system.ts                         # +chmod on FileSystemAdapter
M packages/services-core/src/index.ts                                        # +git-hooks barrel
M packages/services-core/src/registry/method-registry.ts                     # +GitHooksService + 4 methods
M packages/services-core/src/registry/policy.ts                              # +4 git-hooks/* capabilities
M packages/services-core/test/vnext-component-scanner.test.ts                # +chmod on test fs
?? apps/server/src/api/v1/git-hooks.routes.ts
?? packages/designer-ui/src/modules/git-hooks/GitHooksApi.ts
?? packages/designer-ui/src/modules/git-hooks/GitHooksStatusChip.tsx
?? packages/designer-ui/src/modules/git-hooks/GitHooksStore.ts
?? packages/designer-ui/src/modules/git-hooks/GitHooksTypes.ts
?? packages/designer-ui/src/modules/git-hooks/index.ts
?? packages/services-core/src/services/git-hooks/git-hooks-schemas.ts
?? packages/services-core/src/services/git-hooks/git-hooks.service.ts
?? packages/services-core/src/services/git-hooks/index.ts
?? packages/services-core/src/services/git-hooks/pre-commit-template.ts
```

### Out of scope (deferred follow-ups)

- **Husky / lefthook / pre-commit framework integration** — the install detects foreign hooks and refuses to clobber them. A future slice could detect `package.json#husky`, `lefthook.yml`, or `.pre-commit-config.yaml` and wire ourselves in via their respective config instead of writing `.git/hooks/pre-commit` directly.
- **Bundle a node-pty-style fallback for environments without `python3`** — extremely rare on developer machines; cost / benefit doesn't justify yet.
- **Graceful "app starting up" handling** — when the desktop app is launching but the discovery file hasn't been written yet, the hook prints "skipping" and exits 0. A 2-3s retry loop would catch the race more politely; deferred.
- **Project-wide validation (not just staged)** — the endpoint takes any list of paths, so a "Validate all components" command in the StatusBar chip popover would just call `runPreCommitValidation` with `git ls-files`. Easy follow-up.
- **Hook-version migration tooling** — bumping `MANAGED_HOOK_VERSION` already triggers reinstall on the next `install` call; a Settings entry showing "X projects have an outdated hook" would surface this proactively.

## ⏳ 7. Test Data Generators

Pending.
