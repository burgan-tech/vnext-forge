# Instance Monitor (local development)

**Date:** 2026-10-06
**Status:** Draft — awaiting user review
**Branch:** `f/instance-monitor` (cut from `f/quickrun-context-panels-ux`; rebase onto `main` once PR #73 merges — the monitor reuses its panel kit and correlation tree)

## Context

Forge lets a developer design a workflow and drive an instance with QuickRunner, but there is no screen that shows **where an instance has been**: which states it visited, which transitions fired with what input, which tasks ran, how its data changed, and which incidents it hit. QuickRunner's History / Tasks / Correlations panels answer parts of this as lists; none of them shows the path on the flow.

The Instance Monitor is a **local-development** tool, not environment-wide monitoring (that is `apps/monitoring`, a separate track on the monitor API). It opens beside QuickRunner: the developer advances the instance on the left and watches the canvas and panels update on the right. Because it is local, the canvas is drawn from the **workspace's own component files** — so state types, roles, rules and views come from the definition, and every referenced component opens in its designer with one click.

### What already exists (verified 2026-10-06)

- `FlowCanvas` (`canvas-interaction/FlowCanvas.tsx`) supports `mode="instance-view"` with `executionOverlay = { traversedTransitions[], currentState }`: current / visited / unreachable node styles and traversed / untaken edge styles (`StateNodeBase.tsx`, `TransitionEdge.tsx`, `canvas-overrides.css`). It needs a `ReactFlowProvider` and still reads `useWorkflowStore` for selection.
- Read-only inspectors (`canvas-interaction/readonly/`): `StateInspector`, `TransitionInspector`, `WorkflowMetadataInspector`, with a `children` slot for execution content; `normalizeDefinition`, `findState`, `findTransition`, and `toFlowCanvasJson`, which also accepts a flat `states[] + transitions[]` shape.
- The designer layout is stored in `{workflowsRoot}/{group}/.meta/{name}.diagram.json` (`flow-editor/useFlowEditorDocument.ts`); `loadFlowEditorDocument` reads workflow + diagram (falls back to `{nodePos:{}}` → auto-layout). The monitor must not call `ensureDiagramInfrastructure` (it writes).
- QuickRun RPCs already cover history (`…/instances/{id}/transitions`), the task journal (`functions/tasks`), the raw instance, incidents (active + paged), the correlation tree (`instance-correlation` / `hierarchy` fallback), and transition / state metrics (runtime ≥ 0.0.99).
- QuickRun panel kit (PR #73): `PanelRow`, `StatusIcon`, `DetailsDialog`, `DetailsList`, `PanelSummary`, `TransitionExecutionsView`, `StateVisitsView`, `CorrelationTreeView`, `IncidentSection`.
- `apps/monitoring` holds reusable pure logic over a timeline (visit counts, first entry / last exit in `InstanceStatePanel` / `InstanceTransitionPanel`) and a `DataDiffView`, but it is bound to react-query, react-router and the monitor API.
- "Open in designer" exists only for workflows (`useWorkflowFileResolver` → `onOpenSubFlowTarget` → `host:open-designer` → `vnextForge.openDesigner`). Views are resolved by key only for rendering (`pseudo-ui/resolveComponentFile.ts`).

### Runtime gaps (verified in `vnext` master `f03463e8`)

- **No data-history read.** Every data write appends an `InstanceData` row (`Version`, `VersionNo`, `EnteredAt`, `ETag`, `DataHash`, `IsLatest`), but no endpoint lists the rows; `…/data?version=` resolves a semantic version, not a row. Rows carry no link to the transition that wrote them.
- **`functions/actions` has no data.** The function exists since v0.0.93, but nothing constructs an `InstanceAction`, so it always returns an empty list.

## Decisions

| # | Decision |
|---|---|
| D1 | **Separate editor tab.** The monitor is its own webview panel (`ViewColumn.Beside`), one per instance, re-revealed when already open. Not a mode inside QuickRun. |
| D2 | **Approach A:** a new designer-ui module `instance-monitor` with a `MonitorShell` mounted by both shells. Definition and layout come from **local files**; the path overlay comes from the runtime. Pure logic is ported out of `apps/monitoring` into designer-ui. `apps/monitoring` is not embedded. |
| D3 | **Data history needs a runtime endpoint** (separate PR in `vnext`). Forge gates it as "try, hide on 404" until the shipping version is known. |
| D4 | **SubFlows drill down with a breadcrumb** in the same panel (`login-flow › contract-flow › online-flow`). One root instance per panel. |
| D5 | **Refresh = event + light polling.** QuickRun publishes instance changes; the monitor also polls while the instance is active and the panel is visible. Manual Refresh and Pause. |
| D6 | **Both shells:** extension webview panel and a web-shell route. |
| D7 | The monitor **never drives** the instance. Retry / cancel / transitions stay in QuickRun; the monitor links there ("Retry from QuickRun", "Open in QuickRun"). |
| D8 | When the local definition is missing, the canvas draws a **history-only graph** (states and transitions seen in history, auto-layout) instead of a deployed definition — Forge has no deployed-definition read. When the local version differs from the instance's `flowVersion`, the canvas uses the local file and shows a **drift warning**. |
| D9 | Out of scope: the task **Actions** tab (runtime writes no action rows — add when it does); driving the instance from the monitor; environment-wide monitoring; a `transitionRecordId` on data rows (open question Q1). |

---

## 1. Layout

```
┌ Monitor — login-flow · order-4711 ───────────────────── [Pause][⟳] ┐
│ login-flow › contract-flow › online-flow        ● Active · pre-fin │  breadcrumb + status
│ ⚠ Local definition 1.2.0 ≠ instance 1.1.0                          │  drift warning (when any)
├─────────────────────────────────────┬──────────────────────────────┤
│                                     │ [Inspector] [Instance] [Data]│
│   FlowCanvas (instance-view)        │ [Correlations] [Incidents ●2]│
│   current state pulsing             │                              │
│   visited states, ×N visit badge    │  selected state / transition │
│   taken edges + order numbers       │  or the instance-level tab   │
│   faulted state red                 │                              │
│   [Fit] [Path only] [Legend]        │                              │
├─────────────────────────────────────┴──────────────────────────────┤
│ ▸ Timeline: $start → init → kyc ×2 → approval → …   (click selects) │  collapsible path strip
└────────────────────────────────────────────────────────────────────┘
```

- **Canvas additions** to the existing overlay: a visit-count badge (×N) on states, path order numbers on traversed edges, a **faulted** style (red ring) for states with an incident or failed task, and a ⚠ badge for an active incident. Nodes gain small **role / rule / view** indicators read from the definition.
- **Path only** toggle: fades unvisited states further and shows order numbers.
- **Right panel tabs:** Inspector (selection) · Instance (metadata) · Data (current + history + diff) · Correlations (tree) · Incidents (badge = open count, red).
- **Timeline strip:** chronological chips of the path; clicking a chip selects that state / transition. Canvas, inspector and strip share one selection.
- **Entry points:** a **Monitor** button in the QuickRun instance header and a **Monitor** action in the instance-list row menu.

## 2. Inspector and "open in designer"

The Inspector has two layers: **Definition** (local file) and **Execution** (runtime). It uses the QuickRun panel kit for rows, status icons and dialogs.

### State inspector

- **Header:** label (key as tooltip), type and subtype badges, visit summary ("Visited 2× · now here" / "Not visited").
- **Definition:**
  - **View** — reference with ↗ (View designer) and an inline Preview for pseudo-ui views.
  - **Tasks** — onEntry / onExit in `order`, with `variableKey` when set; ↗ Task designer; mapping scripts open in the editor.
  - **Roles** — `queryRoles` and other grants, including All of / Any of groups, read-only.
  - **Transitions** — outgoing, with trigger badges and rule (↗ opens the `.csx`); taken ones highlighted.
  - **SubFlow** — target flow (↗ designer) and **Drill into child instance** (pushes a breadcrumb level).
  - **Timeout, error boundary** — when defined.
- **Execution:**
  - Runtime ≥ 0.0.99: one card per visit from state metrics (entered, stayed, onEntry / onExit tasks by phase) — reuse `StateVisitsView`.
  - Older runtimes: the same cards built from the task journal filtered by `fromState` / `toState`.
  - A task row opens the task details dialog (Overview / Error).

### Transition inspector

- **Header:** label, from → to, trigger, "Fired 3×".
- **Definition:** executionType (Sync / Async / Inherit), rule (↗ `.csx`), roles, input schema (↗ Schema designer), onExecute tasks (↗ Task designer), view, and a shared / cancel / exit / timeout badge.
- **Execution:** one card per firing, with tabs:
  - **Overview** — who, when, duration.
  - **Input** — request body and headers from the history row, annotated with field titles from the input schema.
  - **Tasks** — Before (onExit) / During (onExecute) / After (onEntry), via `TransitionExecutionsView` (≥ 0.0.99) or the task journal.
  - **Data change** — diff of the data rows written in this firing's window (§3). Hidden when data history is unavailable.

### Open in designer

- **`useComponentFileResolver(category, key, domain?)`** next to `useWorkflowFileResolver`: resolves tasks / views / schemas / functions / extensions / workflows through `discoverVnextComponentsByCategory`, cached per category.
- **`ComponentRefLink`**: key + ↗. Resolved → opens it; unresolved (other domain, not in workspace) → disabled with tooltip "Not in this workspace".
- Scripts (`.csx` / `location`) open in the text editor via `host:open-workspace-file`.
- Host adapter **`onOpenComponent({ category, key, filePath })`** — the extension maps it to `host:open-designer`, the web shell to route navigation, tests to a spy (same pattern as `onOpenSubFlowTarget`).

### Breadcrumb

Drilling in (SubFlow inspector, correlation-tree node) pushes `{ domain, workflowKey, instanceId }`; a breadcrumb click pops back. Each level keeps its own selection and loaded data.

## 3. Data, Instance, Incidents, Correlations

### Runtime endpoint (separate `vnext` PR)

```
GET /api/v1/{domain}/workflows/{workflow}/instances/{instance}/data/history
    ?page=1&pageSize=20&includeData=true
→ { items: [{ id, version, versionNo, enteredAt, etag, isLatest, data? }],
    page, pageSize, hasNext }

GET …/instances/{instance}/data/history/{rowId}   → one row with data
```

- Newest first by `enteredAt`. `includeData=false` returns the list only.
- **Must apply the same caller-role pruning as the `data` function** (x-roles fields removed, x-masking applied, x-encryption never decrypted), via the same `callerRoleResolver` and pruning pipeline. A data-history read must not become a side door.
- Unit tests: paging, ordering, pruning per role.

**Row → transition attribution (Forge):** a row whose `enteredAt` falls inside a firing's `[startedAt, finishedAt]` belongs to that firing; rows outside every window are labelled **Other write** (updateData, subflow, …). An open window (no `finishedAt`) extends to now.

### Data tab

- **Current:** latest data as a JSON tree (CopyableJsonBlock) with its ETag; optional field titles from the master schema.
- **Versions:** timeline rows `#7 · 14:02:11 · after approve (approval → done)` with a "3 fields changed" summary.
- **Row click:** diff against the previous row. **Compare:** tick two rows. The diff is a client-side JSON-path diff (added / removed / changed), ported from `apps/monitoring`'s `DataDiffView`; the transition inspector's Data change tab uses the same component.

### Instance tab

From the raw instance (`getInstance`, `InstanceMetadataDto`), as DetailsList groups:

- **Identity:** key, id (copy), flow, domain, flowVersion vs local version (drift), tags.
- **Status:** status / effectiveStatus, currentState / effectiveState (with a note when the effective state is inside a subflow), state type / subtype, stage.
- **Timing:** createdAt, modifiedAt, completedAt, duration.
- **Who:** createdBy / onBehalfOf, modifiedBy / onBehalfOf.
- **Attributes / extensions:** collapsible JSON.
- **Links:** Open in QuickRun (focuses the instance's tab), Open flow in designer.

### Incidents tab

- `getActiveIncident` + paged `getIncidents`, rendered with `IncidentSection`.
- Active incident card: message, errorCode / layer, statusCode, state / transition / task, boundary action and level, retryCount, traceId (copy).
- Resolved incidents as rows; details in a DetailsDialog.
- **Show on canvas** selects the incident's state or transition. Faulted styling and the ⚠ badge come from this data.
- No retry here (D7): the card links "Retry from QuickRun".

### Correlations tab

`CorrelationTreeView` as is; in the monitor a node click **drills in**. "Open Runner" and "Open in Designer" stay in the row menu.

## 4. Data flow, refresh, hosting, errors, testing

### State

- **`useMonitorStore`** (zustand), one per panel (per webview / per web route): the breadcrumb stack `[{ domain, workflowKey, instanceId, workflowFilePath?, selection }]` and the active level's definition, diagram, history, tasks, instance, incidents and data-history list. Metrics load lazily for the selected element.
- **`deriveInstanceOverlay(history, tasks, incidents)`** — pure: visit counts per state, firing counts per transition, path order, faulted states, current state. Replaces the inline calculations in `apps/monitoring`.
- **Definition source:** local workflow file + `.diagram.json` (read-only, `files/read`) → otherwise the history-only graph via `toFlowCanvasJson` (flat shape) with a "Local definition not found" notice.

### Refresh

- **`InstanceChangeBus`** port in designer-ui: `publish({ domain, instanceId, modifiedAt })` / `subscribe`. QuickRun publishes after start, transition, retry, cancel, and when its polling sees a state change.
  - **Extension:** QuickRun webview → host → `MonitorPanelRegistry` → `monitor:instance-changed` to every panel whose breadcrumb contains that id.
  - **Web:** `BroadcastChannel('vnext-forge-instance')` (QuickRun and Monitor may be separate browser tabs).
- **Polling:** only while the active level's instance is Active or Busy **and** the panel is visible: `getInstance` every 3 s, backing off to 10 s after 60 s without change; stops on terminal status (Completed / Faulted / Cancelled) and when hidden (`onDidChangeViewState` / `visibilitychange`).
- **On change** (`modifiedAt` differs): refetch history, tasks, instance, incidents and the data-history list; invalidate the selected element's metrics.
- Header: Pause / Resume, Refresh, "Updated 3 s ago".

### Hosting

- **Extension:** `apps/extension/src/panels/MonitorPanel.ts` (QuickRunPanel pattern): `createWebviewPanel('vnextForgeMonitor', 'Monitor — {flow} · {key}', ViewColumn.Beside, { retainContextWhenHidden: true })`, keyed `${domain}:${instanceId}`. New Vite input `monitor` → `monitor.html` → `webview-ui/src/monitor/MonitorApp.tsx` (`webview-ready` / `monitor:context`). Command `vnextForge.openInstanceMonitor(domain, workflowKey, instanceId, environment)`; the environment and runtime URL are those of the opening QuickRun panel. Messages: `host:open-designer`, `host:open-workspace-file`, new `monitor:open-quickrun` (reveal the QuickRun panel and focus the instance tab). API calls go through `MessageRouter.attach(panel)`.
- **Web:** route `monitor/:group/:name/:instanceId?env=…`, opened from QuickRunPage with `window.open`; `onOpenComponent` → route navigation.
- **New RPC:** `quickrun/getDataHistory` (list and single row), with the full `rpc-method-policy` set: registry entry, policy, `METHOD_HTTP_METADATA`, server route, fixture + snapshot, `QuickRunApi` wrapper. A 404 maps to "feature unavailable".

### Error and empty states

| Situation | Behaviour |
|---|---|
| Runtime unreachable | `RuntimeErrorBanner` with Retry; last data stays visible with a **Stale** badge |
| Instance not found (404) | Empty state "Instance not found in {environment}" + back to QuickRun |
| Local definition missing | History-only graph + notice |
| Local version ≠ instance version | Drift warning on the canvas and in the Instance tab |
| Feature unavailable (old runtime, data-history 404) | Tab / section hidden; tooltip "Requires runtime ≥ x" |
| Reference not in workspace | ↗ disabled, tooltip "Not in this workspace" |

### Testing

- **designer-ui vitest (pure):** `deriveInstanceOverlay` (visits, order, faulted); row → transition attribution (same-millisecond, open window, other writes); JSON diff; `useComponentFileResolver`; breadcrumb stack; polling backoff and stop rules.
- **SSR tests:** state / transition inspectors (both layers), Data / Instance / Incidents tabs, error and empty states.
- **services-core:** registry ↔ metadata parity, fixture snapshots, 404 → unavailable.
- **Runtime PR:** endpoint unit tests including x-roles pruning and paging.
- **E2E** against a local runtime with vnext-example labs: SubflowOrchestration (drill-down, breadcrumb), TimeoutLab, an incident lab (faulted styling), a lab with view / schema references (↗ opens the designer).
- **Manual:** web shell and Extension Development Host, QuickRun and Monitor side by side.

## Delivery phases

| Phase | Scope | Depends on |
|---|---|---|
| **M1 — Skeleton** | `instance-monitor` module, `MonitorShell`, hosting in both shells + entry points, canvas with overlay additions, definition layer of the inspectors, `useComponentFileResolver` / `ComponentRefLink`, Instance tab, error / empty states | — |
| **M2 — Execution** | Execution layer (metrics / task journal), Incidents tab + faulted styling, Correlations drill-down + breadcrumb, `InstanceChangeBus` + polling | M1 |
| **M3 — Data history** | `vnext` runtime PR → `quickrun/getDataHistory`, Data tab, Data change tab, row attribution | runtime PR |

M1 and M2 do not depend on the runtime; M3 waits for the runtime PR. Each phase gets its own implementation plan and commit group on `f/instance-monitor`.

## Open questions

- **Q1** — Should the runtime stamp `transitionRecordId` on data rows (needs a migration)? It would replace time-window attribution. Not in the first runtime PR.
- **Q2** — Which runtime version ships data history? Until known, Forge gates on "try, hide on 404".
- **Q3** — When the runtime starts writing `InstanceAction` rows, add the task **Actions** tab (`functions/actions`, available since v0.0.93).
