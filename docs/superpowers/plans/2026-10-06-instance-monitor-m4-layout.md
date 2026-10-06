# Instance Monitor M4 (Review fixes + layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two bugs found in user testing (correlation tree flips to an error after the runtime version is known; a second monitor tab misbehaves in the web shell) and give the Monitor and Quick Run an IDE-grade layout: visibly separate panels, a resizable right panel and bottom panel, IDE-style panel toggles, and a richer bottom "Path" rail.

**Architecture:** Fixes land where the faults are (services-core correlation fallback, web route→tab sync, monitor correlation empty state). Layout pieces are shared: Quick Run's `ResizableHandle` grows a row orientation + keyboard support; a new `usePanelLayout` hook keeps sizes / open state per screen in `localStorage` (try/catch, safe defaults); a `PanelToggleButton` renders the IDE icons. The Monitor shell is restructured into canvas | right panel over a bottom panel; the path strip is replaced by a `PathRail` driven by a pure `pathRailSteps` model.

**Tech Stack:** React 19, TypeScript, Tailwind v4, lucide-react, vitest SSR tests.

**Spec:** user test findings + the approved design plan (chat, 2026-10-06): surfaces use VS Code tokens — canvas `--vscode-editor-background`; right panel `--vscode-sideBar-background` with a left `--vscode-sideBar-border` / `--vscode-panel-border`; bottom panel `--vscode-panel-background` with a top `--vscode-panel-border`; panel header strip `--vscode-sideBarSectionHeader-background`, active tab underline `--vscode-panelTitle-activeBorder`; tab style matches Quick Run's ContextPanel tabs; trigger colours reuse Quick Run's history palette (manual blue, automatic grey, scheduled orange, event purple); sentence-case copy ("Follow latest", "Show failed only").

## Global Constraints

- All user-visible strings are **English**, sentence case.
- Colours only via `var(--vscode-*, <fallback>)` tokens (no new palette); every token gets a fallback so the web shell renders.
- The monitor never drives the instance and never writes files; `localStorage` access is wrapped in try/catch and the UI works without it.
- Buttons get `cursor-pointer`, an `aria-label`, and a `title`; resize handles are focusable separators operable with arrow keys (`role="separator"`, `aria-orientation`, `aria-valuenow`).
- Respect `prefers-reduced-motion` for any scroll/transition added.
- Quick Run's existing behaviour must not change except the added toggles / auto-open.
- Tests are `*.vitest.test.ts(x)`; run with `pnpm --filter <pkg> exec vitest run <path>`. `grep` is aliased to ugrep — use `command grep` / `rg`.
- Commit after every task on `f/instance-monitor`; every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Bug fixes — correlation tree fallback and monitor tab route sync

**Files:**
- Modify: `packages/services-core/src/services/quickrun/quickrun.service.ts` (`getCorrelationTree`, ~l.780) + its service test
- Modify: `apps/web/src/modules/project-workspace/editorTabRouteSync.ts` (+ create `editorTabRouteSync.vitest.test.ts` only if apps/web has vitest; otherwise put the matching logic under test where a runner exists — see Step 2)
- Modify: `packages/designer-ui/src/modules/instance-monitor/components/CorrelationsPanel.tsx`, `components/MonitorShell.tsx` (keep last tree)

**Root causes (verified against the local runtime):**
1. The local runtime reports `/health` version `0.0.98.0` but serves `functions/instance-correlation` (built from master before the version bump). `runtimeSupportsCorrelationTree('0.0.98.0') === false` → Forge calls `functions/hierarchy` → 404 "Function not found". The first load (version still unknown) works, the version-triggered refresh fails, so the tree "sometimes" turns into an error.
2. `activeTabIdFromPathname` has no `monitor/:group/:name/:instanceId` case, so the active tab is `null` on every monitor route; monitor tabs never become active and switching between two monitors misbehaves.

- [ ] **Step 1: Failing tests** — services-core: with `runtimeVersion: '0.0.98.0'`, a 404 from `hierarchy` falls back to `instance-correlation` (and vice versa with `'0.0.99'` when `instance-correlation` 404s) and returns `source` of the endpoint that answered; both 404 → `RUNTIME_NOT_FOUND`. Route sync: `activeTabIdFromPathname('p1', '/project/p1/monitor/loan/loan-flow/abc-123')` → `monitorTabId('p1', 'abc-123')`.
- [ ] **Step 2: Run → FAIL.** (apps/web has no vitest setup: if so, move the pure path matcher into a function exported from designer-ui's `modules/code-editor/` next to `monitorTabId` — e.g. `monitorTabIdFromPath(projectId, pathname)` — test it there, and call it from `editorTabRouteSync.ts`.)
- [ ] **Step 3: Implement**
  - `getCorrelationTree`: try the version-preferred endpoint; on 404 try the other one **regardless of version**; throw the second failure.
  - Route sync: add the monitor match before the component kinds loop.
  - `CorrelationsPanel`: when `correlation` is null render a neutral empty state — "No correlation tree for this instance." with a **Retry** button (`onRefresh`) — not `CorrelationTreeView`'s error banner.
  - `MonitorShell`: keep the last non-null correlation per instance id (ref) and show it when a refresh returns null.
- [ ] **Step 4: Run** services-core tests, designer-ui tests + build, web build → green.
- [ ] **Step 5: Commit** — `fix(instance-monitor): correlation tree falls back on 404 either way; monitor tabs sync with the route`.

---

### Task 2: Shared layout primitives

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/components/ResizableHandle.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/components/PanelToggleButton.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/hooks/usePanelLayout.ts`
- Create: `packages/designer-ui/src/modules/quick-run/hooks/panelLayout.ts` (pure) + `panelLayout.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/layout.vitest.test.tsx`

**Interfaces:**
- `ResizableHandle({ onResize, direction?, orientation?: 'vertical' | 'horizontal', valueNow?: number, label?: string })` — `orientation='vertical'` (default, today's column handle, `col-resize`, `w-[5px]`); `'horizontal'` = row handle (`row-resize`, `h-[5px]`, delta from `clientY`). Focusable (`tabIndex=0`); ArrowLeft/Right (vertical) or ArrowUp/Down (horizontal) call `onResize(±16)` honouring `direction`; `aria-valuenow` when given. Existing call sites keep working unchanged.
- `PanelToggleButton({ side: 'left' | 'right' | 'bottom', open: boolean, onToggle: () => void, label: string })` — lucide `PanelLeft`/`PanelLeftClose`, `PanelRight`/`PanelRightClose`, `PanelBottom`/`PanelBottomClose`; `aria-pressed={open}`, `aria-label`/`title` = `${open ? 'Hide' : 'Show'} ${label}`.
- `panelLayout.ts`: `interface PanelLayoutState { [panel: string]: { size: number; open: boolean } }`; `clampSize(size, min, max)`; `resizeBy(state, panel, delta, { min, max })`; `parseStoredLayout(raw: string | null, defaults): PanelLayoutState` (ignores malformed / unknown keys, clamps).
- `usePanelLayout(storageKey: string, defaults: Record<string, { size: number; open: boolean; min: number; max: number }>)` → `{ size(panel), isOpen(panel), resize(panel, delta), setOpen(panel, open), toggle(panel) }`; persists to `localStorage[storageKey]` (try/catch) on change.

- [ ] **Step 1: Failing tests** — `panelLayout`: clamping, resize keeps within bounds, malformed JSON → defaults, unknown panels ignored, booleans/size types validated. SSR: `ResizableHandle orientation="horizontal"` renders `aria-orientation="horizontal"`, `tabindex="0"`, `cursor-row-resize`; `PanelToggleButton` renders the right `aria-label` / `aria-pressed` for open and closed.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (keyboard handler: `onKeyDown` on the separator).
- [ ] **Step 4: Run** quick-run suite + designer-ui build → green.
- [ ] **Step 5: Commit** — `feat(quick-run): row/keyboard resize handle, panel toggle button and persisted panel layout`.

---

### Task 3: Monitor layout — separate surfaces, resizable right and bottom panels, toggles

**Files:**
- Modify: `packages/designer-ui/src/modules/instance-monitor/components/MonitorShell.tsx`
- Modify: `packages/designer-ui/src/modules/instance-monitor/components/components.vitest.test.tsx`

**Behaviour:**
- Layout: header; body = column [ row [ canvas (flex-1) | handle | right panel (width from layout) ] | horizontal handle | bottom panel (height from layout) ].
- `usePanelLayout('vnext-forge.monitor.layout', { right: { size: 340, open: true, min: 260, max: 640 }, bottom: { size: 132, open: true, min: 88, max: 360 } })`.
- Surfaces per the spec tokens; the right panel's tab strip and the bottom panel's header strip use `--vscode-sideBarSectionHeader-background` and the Quick Run ContextPanel tab style (active tab underline `--vscode-panelTitle-activeBorder`, fallback `--vscode-focusBorder`).
- Header right side: Refresh, Pause/Resume, then `PanelToggleButton side="right" label="details panel"` and `side="bottom" label="path panel"`.
- Auto-open: any selection change to non-null (canvas node/edge, path step, incident "Show on canvas", correlation drill) opens the right panel if closed.
- Hidden panels unmount their content but keep state that lives in MonitorShell (selection, data hook).
- The canvas cell keeps `relative overflow-hidden [contain:layout]` (toolbar containment from M1).

- [ ] **Step 1: Failing SSR tests** — the ready view renders both toggle buttons with "Hide details panel" / "Hide path panel"; a `role="separator"` with `aria-orientation="vertical"` and one with `"horizontal"`; the right panel container carries the sideBar background token class; with layout `{ right: { open: false } }` (inject via a `layout` prop or initial state on `MonitorShellView` for testability) the right panel content is absent and the button reads "Show details panel".
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — make `MonitorShellView` take the layout API as a prop (`layout`) so SSR tests can inject it; `MonitorShell` passes `usePanelLayout(...)`.
- [ ] **Step 4: Run** instance-monitor suite + designer-ui build → green.
- [ ] **Step 5: Commit** — `feat(instance-monitor): separate, resizable and toggleable panels`.

---

### Task 4: Path rail (bottom panel)

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/model/pathRail.ts` (+ `pathRail.vitest.test.ts`)
- Create: `packages/designer-ui/src/modules/instance-monitor/components/PathRail.tsx` (+ SSR tests in `components/pathRail.vitest.test.tsx`)
- Modify: `components/MonitorShell.tsx` (replace `PathTimeline` in the bottom panel), delete `components/PathTimeline.tsx` and its tests if nothing else uses them

**Interfaces:**
- `interface PathRailStep { order: number; historyId: string; transitionKey: string; label: string; fromState: string; toState: string; startedAt: string; durationMs: number | null; trigger: 'manual' | 'automatic' | 'scheduled' | 'event' | 'other'; failedTasks: number; wroteData: boolean }`
- `pathRailSteps(history, { tasks, vm, rowsByFiring? }): PathRailStep[]` — oldest first; `label` via `pickLabel(findTransition(vm, key)?.labels, key)`; `durationMs` from `durationSeconds * 1000` when present; `trigger` normalised from `triggerType` (case-insensitive: manual / automatic|auto / scheduled|timer / event|signal / else other); `failedTasks` = task-journal rows of that firing (`transitionKey === key && fromState === from && (toState ?? to) === to` and started within the firing window) whose `resolveTaskOutcome` is `'failed'`; `wroteData` = `rowsByFiring.get(historyId)?.length > 0`.
- `railSummary(steps): { count: number; totalMs: number | null; failedSteps: number }`.
- `PathRail({ steps, currentState, selectedKey, onSelect, filter, onFilterChange, follow, onFollowChange })`:
  - Header strip: "Path" + summary ("12 steps · 4m 12s" via `formatDurationMs`), a two-option segmented control "All" / "Show failed only" (disabled when no failed steps), a "Follow latest" toggle.
  - Rail: horizontal scroll; a 2px connector line (`--vscode-panel-border`); each step = a round node with the order number filled with the trigger colour (manual `--vscode-charts-blue,#3794ff`, automatic `--vscode-descriptionForeground,#9d9d9d`, scheduled `--vscode-charts-orange,#d18616`, event `--vscode-charts-purple,#b180d7`, other `--vscode-foreground`), under it the label, `from → to`, time + duration, and markers: ⚠ with count when `failedTasks > 0` (`--vscode-errorForeground`), a data icon (lucide `Database`) when `wroteData`; ends with a diamond node "Now in {currentState}" (outlined, `--vscode-focusBorder`).
  - Each step is a `button` (`aria-pressed` when selected, `aria-label` "Step {n}: {label}, {from} to {to}"); selected step gets a `--vscode-focusBorder` ring and is scrolled into view (`scrollIntoView({ inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })`); with `follow` on, the newest step is scrolled into view whenever the step count grows.
  - Empty: "No transitions yet — the path appears here as the instance moves."
- Filter "Show failed only" hides steps with `failedTasks === 0` (the rail keeps the "Now in" end node).

- [ ] **Step 1: Failing tests** — model: trigger normalisation, duration, failed-task count per firing (two firings of the same key counted separately by window), `wroteData`, summary; SSR: steps render with order numbers, labels, "Now in review", ⚠ count, data marker, selected `aria-pressed`, filter hides non-failed steps, empty copy.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**; wire into MonitorShell's bottom panel (pass `rowsByFiring` from the data hook when loaded; filter / follow state in MonitorShell with follow default on).
- [ ] **Step 4: Run** instance-monitor suite + designer-ui build → green.
- [ ] **Step 5: Commit** — `feat(instance-monitor): path rail with triggers, failures and data writes`.

---

### Task 5: Quick Run panel toggles and auto-open

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunShell.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts` only if a "reveal context panel" signal is needed (prefer a small shell-level callback)
- Modify: the Quick Run components where a component click should reveal the context panel (correlation rows / history rows / task rows that open details, and AvailableTransitions' info actions if they set the context tab) — find them via `setContextPanelTab` call sites.
- Test: `packages/designer-ui/src/modules/quick-run/components/layout.vitest.test.tsx` (extend) or a new SSR test of the shell toolbar if feasible.

**Behaviour:**
- Replace the shell's `leftWidth` / `rightWidth` state with `usePanelLayout('vnext-forge.quickrun.layout', { left: { size: 220, open: true, min: 160, max: 400 }, right: { size: 320, open: true, min: 200, max: 560 } })`.
- Toolbar right side (before the `domain/flow` label): `PanelToggleButton side="left" label="instances panel"` and `side="right" label="context panel"`.
- Hidden panel → its column and its handle are not rendered; the dashboard takes the space.
- Auto-open: any call of the store's `setContextPanelTab(...)` (the existing way components bring a context tab forward) opens the right panel if closed — implement by subscribing in the shell (`useEffect` on `contextPanelTab` changes) or by a `revealContextPanel` callback; do not change what the tabs show.
- The panel separation uses the same tokens as the monitor (sidebar / panel backgrounds + borders) so the two screens match.

- [ ] **Step 1: Failing tests** — the pure parts (layout defaults, auto-open predicate if extracted) and an SSR render of the toolbar toggles if the shell can be rendered in tests; otherwise extract the toolbar into `QuickRunToolbar` and test it.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** quick-run suite + designer-ui build → green.
- [ ] **Step 5: Commit** — `feat(quick-run): toggleable instances and context panels with persisted sizes`.

---

### Task 6: Verification

- [ ] designer-ui, services-core, extension, server tests + `pnpm -w turbo run build` → green.
- [ ] Manual (if the preview launcher works): web shell — open two monitors for two instances, switch between their tabs; correlation tab stays populated after the version-triggered refresh; resize / hide / show right and bottom panels and reload (sizes kept); select on canvas with the right panel hidden → it opens; path rail selection syncs with canvas and inspector; Quick Run toggles. Record what ran and what did not.
