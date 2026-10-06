# Instance Monitor M2 (Execution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Instance Monitor its execution layer — per-visit / per-firing tasks and inputs in the inspector, an Incidents tab with faulted styling on the canvas, a Correlations tab with breadcrumb drill-down into child instances, and live refresh (Quick Run change events + light polling) — plus the M1 leftovers (focus the instance in Quick Run, full Instance tab, Monitor entry in the instance list).

**Architecture:** Everything builds on the M1 module `packages/designer-ui/src/modules/instance-monitor`. The level loader grows to also fetch the task journal, the active incident and the correlation tree (each non-fatal). Pure model functions derive faulted states, child instances and the poll schedule. A small `instanceChangeBus` in designer-ui carries "instance changed" events: Quick Run's store publishes, the monitor subscribes; the extension relays between webviews, the web shell uses `BroadcastChannel`. Existing Quick Run views (`StateVisitsView`, `TransitionExecutionsView` via `transitionDetailTabs`, `IncidentEntryCard`, `CorrelationTreeView`) are reused, not copied.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `@xyflow/react`, zustand (Quick Run store), vitest SSR tests, VS Code webview API, React Router.

**Spec:** `docs/superpowers/specs/2026-10-06-instance-monitor-design.md` (phase M2, plus M1 refinements deferred to M2).

## Global Constraints

- All user-visible strings (labels, buttons, tooltips, `aria-label`, `title`) are **English**.
- The monitor **never drives** the instance: no start / transition / retry / cancel calls (spec D7). It may only read and navigate.
- The monitor must **not write files**.
- `apps/web` must not import `@vnext-forge-studio/services-core`; `packages/*` must not import `apps/*`.
- Quick Run / monitor colours use `var(--vscode-*, <fallback>)`.
- Buttons and clickable rows get `cursor-pointer`.
- Webview → extension-host messages are a trust boundary: validate in a `vscode`-free helper with a vitest (pattern: `apps/extension/src/panels/monitor-messages.ts`).
- Designer-mode canvas output must not change; new canvas markers render only when an execution overlay is present.
- Tests are `*.vitest.test.ts(x)` next to the code; run with `pnpm --filter <pkg> exec vitest run <path>`.
- `grep` in this shell is aliased to ugrep; use `command grep` or `rg`.
- Commit after every task; every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `f/instance-monitor`.
- Lint only touched files; package-wide `eslint .` is already red.

### Decisions taken while planning

| Topic | Decision | Why |
|---|---|---|
| Runtime version in the monitor | The monitor calls `checkRuntimeHealth(runtimeUrl)` itself (`workflow-execution/WorkflowExecutionApi.ts:21`) | It has no Quick Run store; the same call Quick Run makes |
| Incidents tab | A monitor-specific `IncidentsTab` that reuses `IncidentEntryCard` and `createIncidentLoaders` | `IncidentSection` is a meta-dialog block without a "Show on canvas" hook; changing it would ripple into Quick Run |
| Faulted states | Union of the active incident's state and states of failed task-journal rows | Matches spec "faulted styling from incidents and tasks" without extra reads |
| Correlation drill-down | New optional `onDrillNode` prop on `CorrelationTreeView` (row menu item + details-dialog action "Monitor this instance") | Keeps Quick Run's behaviour unchanged when the prop is absent |
| Child workflow file | Resolved with the M1 component index (`lookupComponent(index, 'workflows', node.flow)`) | Works in both shells; the extension monitor has no project store |
| Web-shell relay | `BroadcastChannel` + in-window delivery | Quick Run and Monitor are never mounted together in one window (single `<Outlet/>`), so in-window events alone would never meet; polling covers that case |
| Instance list entry | A hover Monitor icon as a **sibling** of the row button (no nested buttons) on the Active and Recent rows | Fixes the M1 deferral without invalid HTML |

---

## File Structure

**designer-ui — instance-monitor (modify / create)**
- `types.ts` — `MonitorLevelData` gains `tasks`, `activeIncident`, `correlation`; stack types.
- `data/loadMonitorLevel.ts` — extra non-fatal loads; `runtimeVersion` option.
- `hooks/useRuntimeVersion.ts` *(create)* — health check → version.
- `model/faultedStates.ts` *(create)*, `model/correlation.ts` *(create)*, `model/pollSchedule.ts` *(create)*.
- `model/monitorReducer.ts` — level stack, drill / pop, paused.
- `hooks/useMonitorController.ts` — current level, drill, pop, pause, change-bus + polling.
- `bus/instanceChangeBus.ts` *(create)* — publish / subscribe / relay port.
- `components/StateExecution.tsx`, `components/TransitionExecution.tsx`, `components/IncidentsTab.tsx`, `components/CorrelationsPanel.tsx`, `components/Breadcrumb.tsx` *(create)*.
- `components/MonitorInspector.tsx`, `components/MonitorShell.tsx`, `components/MonitorCanvas.tsx`, `components/InstanceTab.tsx` — wire the above.
- `index.ts` — export the bus API for hosts.

**designer-ui — canvas / quick-run (modify)**
- `canvas-interaction/context/CanvasModeContext.tsx`, `utils/executionOverlay.ts`, `components/nodes/StateNodeBase.tsx`, `canvas-overrides.css` — faulted / incident markers.
- `quick-run/components/CorrelationTree.tsx` — `onDrillNode`.
- `quick-run/store/quickRunStore.ts` — publish on state updates.
- `quick-run/QuickRunApi.ts` — `InstanceDetailResponse` gains `completedAt`, `duration`, `attributes`, `extensions`.
- `quick-run/QuickRunShell.tsx`, `components/QuickRunSidebar.tsx`, `components/InstanceListPanel.tsx` — `focusInstanceId`, list Monitor icon.
- `packages/services-core/src/services/quickrun/quickrun-schemas.ts` — informational schema fields.

**extension / web (modify / create)**
- `apps/extension/src/panels/monitor-messages.ts` (+ test) — new message parsers.
- `apps/extension/src/panels/MonitorPanel.ts`, `QuickRunPanel.ts`, `apps/extension/src/extension.ts` — relay + focus commands.
- `apps/extension/webview-ui/src/quickrun/QuickRunApp.tsx`, `webview-ui/src/monitor/MonitorApp.tsx` — bus relay, focus.
- `apps/web/src/pages/quickrun/QuickRunPage.tsx`, `apps/web/src/pages/monitor/MonitorPage.tsx` — focus via `?instance=`.

---

### Task 1: Level data — tasks, incident, correlation tree, runtime version, full instance fields

**Files:**
- Modify: `packages/designer-ui/src/modules/instance-monitor/types.ts`
- Modify: `packages/designer-ui/src/modules/instance-monitor/data/loadMonitorLevel.ts`
- Modify: `packages/designer-ui/src/modules/instance-monitor/data/loadMonitorLevel.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/hooks/useRuntimeVersion.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts:241-269` (`InstanceDetailResponse`)
- Modify: `packages/services-core/src/services/quickrun/quickrun-schemas.ts:524-557`
- Modify: `packages/designer-ui/src/modules/instance-monitor/hooks/useMonitorController.ts` (pass `runtimeVersion`)

**Interfaces:**
- Consumes: `QuickRunApi.getTaskHistory(params: InstanceScopedParams): ApiResponse<{ items: TaskHistoryItem[] }>`, `QuickRunApi.getActiveIncident(params): ApiResponse<{ incident: IncidentEntry | null }>`, `QuickRunApi.getCorrelationTree(params & { runtimeVersion?: string }): ApiResponse<CorrelationTreeResponse>`, `checkRuntimeHealth(runtimeUrl?): ApiResponse<{ version?: string }>`.
- Produces: `MonitorLevelData { instance; history; definition; loadedAt; tasks: TaskHistoryItem[]; activeIncident: IncidentEntry | null; correlation: CorrelationTreeResponse | null }`; `MonitorLoaders` gains `getTaskHistory`, `getActiveIncident`, `getCorrelationTree`; `loadMonitorLevel(target, headers, loaders?, options?: { runtimeVersion?: string })`; `useRuntimeVersion(runtimeUrl?: string): string | null`; `InstanceDetailResponse.metadata.completedAt?: string`, `.metadata.duration?: number`, `.attributes?: Record<string, unknown>`, `.extensions?: Record<string, unknown>`.

- [ ] **Step 1: Write the failing tests** — extend `loadMonitorLevel.vitest.test.ts`:

```ts
const TASKS = { items: [{ id: 't1', taskKey: 'notify', transitionKey: 'start', fromState: '$start', toState: 'review', triggerType: 'manual', status: 'Failed', businessStatus: 'Failed', startedAt: 'x' }] };
const INCIDENT = { incident: { id: 'in1', createdAt: 'x', state: 'review', transition: 'submit', message: 'boom', isResolved: false, retryCount: 0 } };
const TREE = { source: 'instance-correlation', root: { id: 'i1', flow: 'loan', domain: 'core', resolved: true, children: [] } };

// add to loaders(): getTaskHistory, getActiveIncident, getCorrelationTree resolving the fixtures above

it('loads the task journal, the active incident and the correlation tree', async () => {
  const l = loaders();
  const r = await loadMonitorLevel(TARGET, {}, l, { runtimeVersion: '0.0.99' });
  expect(r.ok && r.data.tasks.map((t) => t.id)).toEqual(['t1']);
  expect(r.ok && r.data.activeIncident?.id).toBe('in1');
  expect(r.ok && r.data.correlation?.root.id).toBe('i1');
  expect(l.getCorrelationTree).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'i1', runtimeVersion: '0.0.99' }));
});

it('treats a failed secondary read as empty, not as a load failure', async () => {
  const fail = vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_EXECUTION_FAILED', message: 'x', traceId: 't' } }));
  const r = await loadMonitorLevel(TARGET, {}, loaders({
    getTaskHistory: fail as unknown as MonitorLoaders['getTaskHistory'],
    getActiveIncident: fail as unknown as MonitorLoaders['getActiveIncident'],
    getCorrelationTree: fail as unknown as MonitorLoaders['getCorrelationTree'],
  }));
  expect(r.ok).toBe(true);
  expect(r.ok && r.data).toMatchObject({ tasks: [], activeIncident: null, correlation: null });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor/data`
Expected: FAIL (`getTaskHistory` not on `MonitorLoaders` / `tasks` undefined).

- [ ] **Step 3: Implement**

`types.ts` — add imports of `TaskHistoryItem`, `CorrelationTreeResponse` (`../quick-run/types/quickrun.types`) and `IncidentEntry` (`../quick-run/QuickRunApi`), and extend `MonitorLevelData`:

```ts
  /** Task journal (`functions/tasks`), oldest first; empty when unavailable. */
  tasks: TaskHistoryItem[];
  /** Newest unresolved incident; null when none or unavailable. */
  activeIncident: IncidentEntry | null;
  /** Correlation tree rooted at the root instance; null when unavailable. */
  correlation: CorrelationTreeResponse | null;
```

`loadMonitorLevel.ts`:
- `MonitorLoaders` gains `getTaskHistory: typeof QuickRunApi.getTaskHistory; getActiveIncident: typeof QuickRunApi.getActiveIncident; getCorrelationTree: typeof QuickRunApi.getCorrelationTree;` and `defaultMonitorLoaders` wires them.
- Signature: `loadMonitorLevel(target, headers, loaders = defaultMonitorLoaders, options: { runtimeVersion?: string } = {})`; `loadMonitorLevelSafe` forwards `options`.
- Run the three extra reads in the same `Promise.all` as the instance / history / definition reads. Each extra result maps to its empty value when `!res.success`:

```ts
const tasks = tasksRes.success ? tasksRes.data.items ?? [] : [];
const activeIncident = incidentRes.success ? incidentRes.data.incident ?? null : null;
const correlation = treeRes.success ? treeRes.data : null;
```

- `getCorrelationTree` gets `{ ...scope, ...(options.runtimeVersion ? { runtimeVersion: options.runtimeVersion } : {}) }`.

`hooks/useRuntimeVersion.ts`:

```ts
import { useEffect, useState } from 'react';

import { checkRuntimeHealth } from '../../workflow-execution/WorkflowExecutionApi';

/** The runtime's reported version (`/health`), or null while unknown / unreachable. */
export function useRuntimeVersion(runtimeUrl: string | undefined): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setVersion(null);
    void checkRuntimeHealth(runtimeUrl)
      .then((res) => {
        if (!cancelled && res.success) setVersion(res.data.version ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runtimeUrl]);
  return version;
}
```

`useMonitorController` — add a `runtimeVersion?: string | null` parameter (after `headers`) and pass `{ runtimeVersion: runtimeVersion ?? undefined }` to `loadMonitorLevelSafe`; include it in the reload key. `MonitorShell` calls `useRuntimeVersion(target.runtimeUrl)` and passes it.

`QuickRunApi.ts` `InstanceDetailResponse`: add top-level `attributes?: Record<string, unknown>; extensions?: Record<string, unknown>;` and in `metadata` `completedAt?: string; duration?: number;` (doc: `/** Seconds, as the runtime reports it. */`).

`quickrun-schemas.ts`: add the same optional fields to `quickrunGetInstanceResult` (`attributes: z.record(z.unknown()).optional()`, `extensions: z.record(z.unknown()).optional()`) and to `getInstanceMetadataSchema` (`completedAt: z.string().optional()`, `duration: z.number().optional()`). If services-core has a fixture / snapshot for `quickrun/getInstance`, update it (`command grep -rln "getInstance" packages/services-core/test`).

- [ ] **Step 4: Run tests and builds**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor && pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS / success.

- [ ] **Step 5: Commit** — `feat(instance-monitor): load the task journal, active incident and correlation tree per level`

---

### Task 2: Faulted states on the canvas

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/model/faultedStates.ts` (+ `model/faultedStates.vitest.test.ts`)
- Modify: `packages/designer-ui/src/modules/canvas-interaction/context/CanvasModeContext.tsx` (`ExecutionOverlay`)
- Modify: `packages/designer-ui/src/modules/canvas-interaction/utils/executionOverlay.ts` (+ its test)
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeBase.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/canvas-overrides.css`
- Modify: `packages/designer-ui/src/modules/instance-monitor/model/monitorPath.ts` (`toExecutionOverlay`), `components/MonitorCanvas.tsx`

**Interfaces:**
- Produces: `ExecutionOverlay.faultedStates?: string[]`, `ExecutionOverlay.incidentStates?: string[]`; node data `faulted?: true`, `hasActiveIncident?: true`; `faultedStatesOf(tasks, activeIncident): { faulted: string[]; incident: string[] }`; `toExecutionOverlay(history, currentState, pathOnly, focus?, faults?: { faulted: string[]; incident: string[] })`.

- [ ] **Step 1: Failing tests**

`faultedStates.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { faultedStatesOf } from './faultedStates';

const task = (over: Record<string, unknown>) => ({ id: 'x', taskKey: 'k', transitionKey: 't', fromState: 'a', toState: 'b', triggerType: 'manual', status: 'Completed', businessStatus: 'Success', startedAt: 's', ...over }) as never;

describe('faultedStatesOf', () => {
  it('marks the state a failed task ran for', () => {
    expect(faultedStatesOf([task({ status: 'Failed', hook: 'onEntry', toState: 'review' })], null).faulted).toEqual(['review']);
    expect(faultedStatesOf([task({ status: 'Failed', hook: 'onExit', fromState: 'init' })], null).faulted).toEqual(['init']);
    expect(faultedStatesOf([task({ status: 'Failed', toState: undefined, fromState: 'init' })], null).faulted).toEqual(['init']);
  });
  it('ignores successful tasks and de-duplicates', () => {
    const r = faultedStatesOf([task({}), task({ status: 'Failed', toState: 'b' }), task({ status: 'Failed', toState: 'b' })], null);
    expect(r.faulted).toEqual(['b']);
  });
  it('adds the active incident state to both lists', () => {
    const r = faultedStatesOf([], { state: 'review' } as never);
    expect(r).toEqual({ faulted: ['review'], incident: ['review'] });
  });
});
```

Add to `executionOverlay.vitest.test.ts`:

```ts
describe('faults', () => {
  it('flags faulted and incident states only when listed', () => {
    const o: ExecutionOverlay = { ...LOOP, faultedStates: ['init'], incidentStates: ['init'] };
    const visits = stateVisitCounts(o);
    expect(nodeExecutionData('init', o, visits)).toMatchObject({ faulted: true, hasActiveIncident: true });
    expect(nodeExecutionData('review', o, visits)).not.toHaveProperty('faulted');
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor/model/faultedStates.vitest.test.ts src/modules/canvas-interaction/utils/executionOverlay.vitest.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`faultedStates.ts`:

```ts
import type { IncidentEntry } from '../../quick-run/QuickRunApi';
import { resolveTaskOutcome } from '../../quick-run/components/panel-kit';
import type { TaskHistoryItem } from '../../quick-run/types/quickrun.types';

/**
 * States to draw as faulted: where a task failed (an onExit task belongs to the
 * state it left, anything else to the state it ran for), plus the active
 * incident's state, which also gets the incident marker.
 */
export function faultedStatesOf(
  tasks: readonly TaskHistoryItem[],
  activeIncident: Pick<IncidentEntry, 'state'> | null,
): { faulted: string[]; incident: string[] } {
  const faulted = new Set<string>();
  for (const t of tasks) {
    if (resolveTaskOutcome(t.status, t.businessStatus) !== 'failed') continue;
    const state = t.hook === 'onExit' ? t.fromState : (t.toState ?? t.fromState);
    if (state) faulted.add(state);
  }
  const incident = activeIncident?.state ? [activeIncident.state] : [];
  for (const s of incident) faulted.add(s);
  return { faulted: [...faulted], incident };
}
```

Check `resolveTaskOutcome`'s return values (`panel-kit/taskOutcome.ts`) — use its failed outcome literal exactly.

`CanvasModeContext.tsx` `ExecutionOverlay` gains:

```ts
  /** States where a task failed or an incident was raised. */
  faultedStates?: string[];
  /** States with an unresolved incident (⚠ marker). */
  incidentStates?: string[];
```

`executionOverlay.ts`: `NodeExecutionData` gains `faulted?: true; hasActiveIncident?: true;`; in `nodeExecutionData` spread `...(overlay.faultedStates?.includes(nodeId) ? { faulted: true as const } : {})` and `...(overlay.incidentStates?.includes(nodeId) ? { hasActiveIncident: true as const } : {})`.

`StateNodeBase.tsx`: read `const faulted = d.faulted === true; const hasActiveIncident = d.hasActiveIncident === true;`; append ` vf-node-faulted` to the root class when `faulted`; next to the ×N badge render, when `hasActiveIncident`:

```tsx
        {hasActiveIncident && (
          <span className="text-final-error shrink-0" title="Active incident" aria-label="Active incident">
            <AlertTriangle size={13} strokeWidth={2.25} />
          </span>
        )}
```

`canvas-overrides.css` after `.vf-node-off-path`:

```css
.vf-node-faulted {
  box-shadow: 0 0 0 2px var(--color-final-error), 0 0 0 5px color-mix(in srgb, var(--color-final-error) 25%, transparent);
}
.vf-node-current.vf-node-faulted {
  animation: none;
}
```

(check `--color-final-error` exists: `command grep -rn "color-final-error" packages/designer-ui/src/*.css packages/designer-ui/src/**/*.css | head -3`; use the token the `text-final-error` utility maps to.)

`monitorPath.ts` `toExecutionOverlay`: add the optional `faults` parameter and set `faultedStates: faults?.faulted ?? []`, `incidentStates: faults?.incident ?? []`. `MonitorCanvas` gains props `tasks` and `activeIncident`, computes `faultedStatesOf` in its `useMemo`, and passes it; `MonitorShellView` passes `data.tasks` and `data.activeIncident`.

- [ ] **Step 4: Run tests + build** (canvas-interaction + instance-monitor suites, designer-ui build) → PASS.
- [ ] **Step 5: Commit** — `feat(instance-monitor): faulted and incident markers on the canvas`

---

### Task 3: Execution layer in the inspector

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/components/StateExecution.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/TransitionExecution.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/execution.vitest.test.tsx`
- Modify: `components/MonitorInspector.tsx`, `components/MonitorShell.tsx`

**Interfaces:**
- Consumes: `MetricsTab`, `StateVisitsView`, `type ElementMetricsLoader` (`quick-run/components/ElementMetrics.tsx`); `transitionDetailTabs(t, { loadMetrics, tasks })` (`quick-run/components/HistoryTab.tsx`); `DetailsBody`, `PanelRow`, `StatusIcon`, `describeTaskPhase`, `resolveTaskOutcome` (`quick-run/components/panel-kit`); `formatDurationMs` (`quick-run/utils/taskHistory`); `runtimeSupports(version, 'elementMetrics')` (`quick-run/utils/runtimeFeatures.ts`); `QuickRunApi.getTransitionMetrics` / `getStateMetrics`.
- Produces: `StateExecution({ stateKey, tasks, loadMetrics? })`, `TransitionExecution({ firings, tasks, loadMetrics?, transitionLabel? })`; `MonitorInspectorProps` gains `tasks: TaskHistoryItem[]`, `loadMetrics?: ElementMetricsLoader`.

- [ ] **Step 1: Failing tests** (`execution.vitest.test.tsx`, SSR):

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateExecution } from './StateExecution';
import { TransitionExecution } from './TransitionExecution';

const task = (id: string, over: Record<string, unknown>) => ({ id, taskKey: `task-${id}`, transitionKey: 'submit', fromState: 'init', toState: 'review', triggerType: 'manual', status: 'Completed', businessStatus: 'Success', startedAt: '2026-10-06T10:00:00Z', ...over }) as never;
const firing = (id: string) => ({ id, transitionId: 'submit', fromState: 'init', toState: 'review', startedAt: '2026-10-06T10:00:00Z', triggerType: 'manual', createdAt: 'x', body: { amount: 5 } }) as never;

describe('StateExecution', () => {
  it('lists the tasks that ran for the state from the journal', () => {
    const html = renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [task('1', { hook: 'onEntry' }), task('2', { hook: 'onExit', fromState: 'review', toState: 'done' }), task('3', { toState: 'other', fromState: 'x' })] }));
    expect(html).toContain('task-1');
    expect(html).toContain('task-2');
    expect(html).not.toContain('task-3');
  });
  it('says when no task ran', () => {
    expect(renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [] }))).toContain('No tasks ran in this state');
  });
  it('defers to metrics when the runtime has them', () => {
    const html = renderToStaticMarkup(h(StateExecution, { stateKey: 'review', tasks: [], loadMetrics: async () => ({ success: false, error: { message: 'x' } }) }));
    expect(html).toContain('Loading');
  });
});

describe('TransitionExecution', () => {
  it('numbers each firing and shows the request input', () => {
    const html = renderToStaticMarkup(h(TransitionExecution, { firings: [firing('a'), firing('b')], tasks: [] }));
    expect(html).toContain('Firing 1 of 2');
    expect(html).toContain('Firing 2 of 2');
  });
  it('says when it never fired', () => {
    expect(renderToStaticMarkup(h(TransitionExecution, { firings: [], tasks: [] }))).toContain('This transition has not fired');
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`StateExecution.tsx`:

```tsx
import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import { MetricsTab, StateVisitsView } from '../../quick-run/components/ElementMetrics';
import { PanelRow, StatusIcon, describeTaskPhase, resolveTaskOutcome } from '../../quick-run/components/panel-kit';
import type { TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { formatDurationMs } from '../../quick-run/utils/taskHistory';

/** Tasks that belong to a state: its entry tasks (arriving) and exit tasks (leaving). */
export function tasksForState(tasks: readonly TaskHistoryItem[], stateKey: string): TaskHistoryItem[] {
  return tasks.filter((t) =>
    t.hook === 'onExit' ? t.fromState === stateKey : t.hook === 'onEntry' ? t.toState === stateKey : t.toState === stateKey,
  );
}

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Execution of one state: per-visit metrics on runtime ≥ 0.0.99, else the task journal rows. */
export function StateExecution({ stateKey, tasks, loadMetrics }: { stateKey: string; tasks: readonly TaskHistoryItem[]; loadMetrics?: ElementMetricsLoader }) {
  return (
    <section className="flex flex-col gap-1 border-t border-[var(--vscode-panel-border,#3c3c3c)] p-3 text-[11px]">
      <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Execution</h3>
      {loadMetrics ? (
        <MetricsTab load={loadMetrics} kind="state" elementKey={stateKey}>
          {(m) => <StateVisitsView metrics={m} stateKey={stateKey} />}
        </MetricsTab>
      ) : (
        <TaskRows tasks={tasksForState(tasks, stateKey)} empty="No tasks ran in this state." />
      )}
    </section>
  );
}

export function TaskRows({ tasks, empty }: { tasks: readonly TaskHistoryItem[]; empty: string }) {
  if (tasks.length === 0) return <p className={muted}>{empty}</p>;
  return (
    <div className="flex flex-col">
      {tasks.map((t) => (
        <PanelRow
          key={t.id}
          leading={<StatusIcon outcome={resolveTaskOutcome(t.status, t.businessStatus)} size={12} />}
          title={<span className="font-mono">{t.taskKey}</span>}
          subtitle={describeTaskPhase(t.hook, t.fromState, t.toState) ?? undefined}
          trailing={formatDurationMs(t.durationMs) ?? ''}
        >
          {t.error && <div className="truncate text-[10px] text-[var(--vscode-errorForeground,#f48771)]" title={t.error}>{t.error.split('\n')[0]}</div>}
        </PanelRow>
      ))}
    </div>
  );
}
```

`TransitionExecution.tsx`:

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import { transitionDetailTabs } from '../../quick-run/components/HistoryTab';
import { DetailsBody } from '../../quick-run/components/panel-kit';
import type { HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Every firing of a transition, each expandable into Quick Run's history detail tabs (Overview / Executions / Tasks / Request). */
export function TransitionExecution({ firings, tasks, loadMetrics }: { firings: readonly HistoryTransition[]; tasks: readonly TaskHistoryItem[]; loadMetrics?: ElementMetricsLoader }) {
  const [open, setOpen] = useState<string | null>(firings.length === 1 ? (firings[0]?.id ?? null) : null);
  return (
    <section className="flex flex-col gap-1 border-t border-[var(--vscode-panel-border,#3c3c3c)] p-3 text-[11px]">
      <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Execution</h3>
      {firings.length === 0 && <p className={muted}>This transition has not fired on this instance.</p>}
      {firings.map((f, i) => {
        const expanded = open === f.id;
        return (
          <div key={f.id} className="rounded border border-[var(--vscode-panel-border,#3c3c3c)]">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : f.id)}
              className="flex w-full cursor-pointer items-center gap-1 px-2 py-1 text-left hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]"
            >
              {expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
              <span className="font-medium">Firing {i + 1} of {firings.length}</span>
              <span className={`ml-auto ${muted}`}>{new Date(f.startedAt).toLocaleTimeString()}</span>
            </button>
            {expanded && (
              <div className="border-t border-[var(--vscode-panel-border,#3c3c3c)] p-2">
                <DetailsBody tabs={transitionDetailTabs(f, { ...(loadMetrics ? { loadMetrics } : {}), tasks })} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

`MonitorInspector`: add props `tasks: TaskHistoryItem[]` and `loadMetrics?: ElementMetricsLoader`; render `<StateExecution stateKey={state.key} tasks={tasks} {...(loadMetrics ? { loadMetrics } : {})} />` as the `children` of `StateInspector`, and `<TransitionExecution firings={transitionFirings(history, selection.key)} tasks={tasks} {...} />` as the children of `TransitionInspector`. Update the existing MonitorInspector tests' props (add `tasks: []`).

`MonitorShell`: build the loader once per level (memo on target, headers, runtime version):

```ts
const loadMetrics = useMemo<ElementMetricsLoader | undefined>(() => {
  if (!runtimeSupports(runtimeVersion, 'elementMetrics')) return undefined;
  return (kind, key) => {
    const params = { domain: level.domain, workflowKey: level.workflowKey, instanceId: level.instanceId, key, headers, ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}) };
    return kind === 'transition' ? QuickRunApi.getTransitionMetrics(params) : QuickRunApi.getStateMetrics(params);
  };
}, [runtimeVersion, level, headers]);
```

(`level` is the current level's target — before Task 5 lands it is `target`.) Pass `loadMetrics` and `data.tasks` through `MonitorShellView` to `MonitorInspector` (`MonitorShellViewProps.loadMetrics?`).

- [ ] **Step 4: Run tests + build → PASS.**
- [ ] **Step 5: Commit** — `feat(instance-monitor): per-visit and per-firing execution in the inspector`

---

### Task 4: Incidents tab

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/components/IncidentsTab.tsx` (+ `IncidentsTab.vitest.test.tsx`)
- Modify: `components/MonitorShell.tsx` (third tab, badge, show-on-canvas)

**Interfaces:**
- Consumes: `IncidentEntryCard({ entry, heading? })`, `createIncidentLoaders(ctx)`, `type IncidentLoaders` (`quick-run/components/IncidentSection.tsx`); `PanelRow`, `DetailsDialog`, `StatusIcon` (panel-kit); `RuntimeErrorBanner`.
- Produces: `IncidentsTab({ active: IncidentEntry | null; loaders?: IncidentLoaders; onShowOnCanvas: (entry: IncidentEntry) => void; onOpenQuickRun?: () => void })`.

- [ ] **Step 1: Failing tests** (SSR):

```tsx
const ENTRY = { id: 'in1', createdAt: '2026-10-06T10:00:00Z', state: 'review', transition: 'submit', task: 'notify', message: 'Gateway timeout', errorCode: 'Task:500', isResolved: false, retryCount: 1 } as never;

it('shows the active incident with show-on-canvas and a Quick Run link', () => {
  const html = renderToStaticMarkup(h(IncidentsTab, { active: ENTRY, onShowOnCanvas: () => {}, onOpenQuickRun: () => {} }));
  for (const t of ['Active incident', 'Gateway timeout', 'Show on canvas', 'Retry from Quick Run']) expect(html).toContain(t);
});
it('says when nothing is open', () => {
  expect(renderToStaticMarkup(h(IncidentsTab, { active: null, onShowOnCanvas: () => {} }))).toContain('No open incident');
});
it('offers the history only when loaders exist', () => {
  expect(renderToStaticMarkup(h(IncidentsTab, { active: null, onShowOnCanvas: () => {} }))).not.toContain('Load incident history');
  expect(renderToStaticMarkup(h(IncidentsTab, { active: null, onShowOnCanvas: () => {}, loaders: { loadActive: async () => ({ success: true, data: { incident: null } }), loadHistory: async () => ({ success: true, data: { hasActiveIncident: false, items: [], page: 1, pageSize: 20, hasNext: false } }) } }))).toContain('Load incident history');
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `IncidentsTab.tsx`**

- Active section: heading "Active incident"; when `active`: its `message` in bold, `<IncidentEntryCard entry={active} />`, then a row with buttons **Show on canvas** (`onShowOnCanvas(active)`) and, when `onOpenQuickRun`, **Retry from Quick Run** (navigates only). When `active` is null: "No open incident."
- History section (only when `loaders`): a **Load incident history** button that calls `loaders.loadHistory(1)`; then rows (`PanelRow`, leading `StatusIcon outcome={e.isResolved ? 'success' : 'failed'}` — use the outcome literals from `taskOutcome.ts`), title = message, subtitle = `${e.state} · ${e.transition}`, trailing = time; activating a row opens a `DetailsDialog` with one "Overview" tab rendering `<IncidentEntryCard entry={e} />` plus a **Show on canvas** button; **Load more** while `hasNext`. Errors render `RuntimeErrorBanner` with title "Incident history request failed". Exclude the active incident from history rows by id.

`MonitorShell`:
- Build loaders: `const incidentLoaders = useMemo(() => createIncidentLoaders({ domain: level.domain, workflowKey: level.workflowKey, instanceId: level.instanceId, headers, ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}) }), [level, headers]);` and pass via `MonitorShellViewProps.incidentLoaders?`.
- Add a third `DetailsBody` tab `{ id: 'incidents', label: data.activeIncident ? 'Incidents (1)' : 'Incidents', render: () => <IncidentsTab … /> }`.
- `onShowOnCanvas(e)` → `onSelect({ kind: 'state', key: e.state })` (the inspector tab then opens, because the right pane is keyed on the selection).

- [ ] **Step 4: Run tests + build → PASS.**
- [ ] **Step 5: Commit** — `feat(instance-monitor): incidents tab with show-on-canvas`

---

### Task 5: Correlations tab and breadcrumb drill-down

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/model/correlation.ts` (+ test)
- Modify: `packages/designer-ui/src/modules/instance-monitor/model/monitorReducer.ts` (+ `model/state.vitest.test.ts`)
- Modify: `packages/designer-ui/src/modules/instance-monitor/hooks/useMonitorController.ts`
- Create: `components/Breadcrumb.tsx`, `components/CorrelationsPanel.tsx`
- Modify: `components/MonitorShell.tsx`, `components/MonitorInspector.tsx`, `components/components.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/CorrelationTree.tsx` (+ its test)

**Interfaces:**
- Produces:
  - `findCorrelationNode(tree, instanceId): CorrelationTreeNode | null` (depth-first by `id`).
  - `childInstancesOf(tree, instanceId, stateKey): CorrelationTreeNode[]` — children of that node whose `parentState === stateKey`.
  - `childTarget(parent: MonitorTarget, node: CorrelationTreeNode, workflowFilePath?: string): MonitorTarget` — `{ ...parent, domain: node.domain, workflowKey: node.flow, instanceId: node.id, workflowFilePath }` (drop `workflowFilePath` when undefined).
  - Reducer: `MonitorState` gains `stack: Array<{ target: MonitorTarget; selection: MonitorSelection }>` (index 0 = root) and `paused: boolean`; actions `{ type: 'reset'; target }`, `{ type: 'drill'; target }`, `{ type: 'pop-to'; index }`, `{ type: 'paused'; value }`. `select` writes the selection of the top entry; `selection` getter = top entry's.
  - `useMonitorController(...)` returns additionally `levels: MonitorTarget[]`, `level: MonitorTarget`, `drill(target)`, `popTo(index)`, `paused`, `setPaused(v)`.
  - `CorrelationTreeViewProps.onDrillNode?: (node: CorrelationTreeNode) => void`.

- [ ] **Step 1: Failing tests**

`model/correlation.vitest.test.ts`:

```ts
const TREE = { source: 'instance-correlation', root: { id: 'r', flow: 'login', domain: 'core', resolved: true, children: [
  { id: 'c1', flow: 'contract', domain: 'core', parentState: 'sign', resolved: true, children: [
    { id: 'g1', flow: 'online', domain: 'core', parentState: 'invoke', resolved: true, children: [] } ] },
  { id: 'c2', flow: 'kyc', domain: 'core', parentState: 'check', resolved: true, children: [] } ] } } as never;

it('finds nodes at any depth', () => { expect(findCorrelationNode(TREE, 'g1')?.flow).toBe('online'); expect(findCorrelationNode(TREE, 'zz')).toBeNull(); });
it('lists the children started from a state', () => {
  expect(childInstancesOf(TREE, 'r', 'sign').map((n) => n.id)).toEqual(['c1']);
  expect(childInstancesOf(TREE, 'c1', 'invoke').map((n) => n.id)).toEqual(['g1']);
  expect(childInstancesOf(null, 'r', 'sign')).toEqual([]);
});
it('builds a child target that keeps the environment', () => {
  const parent = { domain: 'core', workflowKey: 'login', instanceId: 'r', runtimeUrl: 'http://rt', environmentName: 'Local', projectId: 'p', workflowFilePath: '/a.json' };
  expect(childTarget(parent, findCorrelationNode(TREE, 'c1')!, '/c.json')).toEqual({ ...parent, workflowKey: 'contract', instanceId: 'c1', workflowFilePath: '/c.json' });
  expect(childTarget(parent, findCorrelationNode(TREE, 'c1')!)).not.toHaveProperty('workflowFilePath');
});
```

`state.vitest.test.ts` additions:

```ts
it('drills into a child and pops back with each level keeping its selection', () => {
  const root = { domain: 'core', workflowKey: 'a', instanceId: '1' };
  const child = { domain: 'core', workflowKey: 'b', instanceId: '2' };
  let s = monitorReducer(initialMonitorState(root), { type: 'select', selection: { kind: 'state', key: 'x' } });
  s = monitorReducer(s, { type: 'drill', target: child });
  expect(s.stack.map((e) => e.target.instanceId)).toEqual(['1', '2']);
  expect(s.stack[1].selection).toBeNull();
  expect(s.load).toEqual({ kind: 'loading' });
  s = monitorReducer(s, { type: 'pop-to', index: 0 });
  expect(s.stack).toHaveLength(1);
  expect(s.stack[0].selection).toEqual({ kind: 'state', key: 'x' });
});
it('pauses and resumes', () => {
  expect(monitorReducer(initialMonitorState({ domain: 'd', workflowKey: 'w', instanceId: 'i' }), { type: 'paused', value: true }).paused).toBe(true);
});
```

`initialMonitorState` becomes a function `initialMonitorState(target: MonitorTarget): MonitorState`; update the existing reducer tests to call it.

`CorrelationTree.vitest.test.tsx` addition:

```ts
it('offers "Monitor this instance" only when the host can drill', () => {
  expect(render({ onOpenNode: () => {} })).not.toContain('Monitor this instance');
  expect(render({ onOpenNode: () => {}, onDrillNode: () => {} })).toContain('Monitor this instance');
});
```

(Radix dropdown content is not rendered in SSR; if the item is inside `DropdownMenuContent`, assert on the `CorrelationNodeDetails` dialog body instead — render `CorrelationNodeDetails` with `onDrillNode` and assert the action text there.)

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`model/correlation.ts` — the three functions above (iterative DFS; `childInstancesOf` returns `[]` for a null tree or unknown id).

Reducer — `MonitorState = { load; stack; paused; pathOnly }`, `selection` derived by the hook from `stack.at(-1)`. `load-start` resets the top selection; `refresh-start` keeps it; `drill` pushes `{ target, selection: null }` and sets `load: { kind: 'loading' }`; `pop-to` slices to `index + 1` and sets `load: { kind: 'loading' }`; `reset` replaces the stack with `[{ target, selection: null }]` (used when the root target prop changes).

`useMonitorController(rootTarget, headers, runtimeVersion, loaders?)` — reducer init `initialMonitorState(rootTarget)`; dispatch `reset` when the root target key changes; the load effect keys on the **top** level's target key; expose `levels`, `level`, `drill`, `popTo`, `paused`, `setPaused`.

`CorrelationTree.tsx` — add `onDrillNode?` to `CorrelationTreeViewProps`, thread it into `RowMenu` and `CorrelationNodeDialog`/`CorrelationNodeDetails`; render a **Monitor this instance** `DropdownMenuItem` / `DialogAction` first when present. Render `RowMenu` when `onOpenNode || onDrillNode`. No change when the prop is absent.

`Breadcrumb.tsx`:

```tsx
import type { MonitorTarget } from '../types';

/** `root › child › grandchild`; earlier levels are buttons that pop back. */
export function Breadcrumb({ levels, onPopTo }: { levels: readonly MonitorTarget[]; onPopTo: (index: number) => void }) {
  if (levels.length <= 1) return null;
  return (
    <nav aria-label="Instance levels" className="flex min-w-0 items-center gap-1 truncate text-[11px]">
      {levels.map((l, i) => (
        <span key={`${l.instanceId}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="opacity-60">›</span>}
          {i < levels.length - 1 ? (
            <button type="button" onClick={() => onPopTo(i)} className="cursor-pointer underline-offset-2 hover:underline">{l.workflowKey}</button>
          ) : (
            <span className="font-semibold" aria-current="page">{l.workflowKey}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

`CorrelationsPanel.tsx` — renders `<CorrelationTreeView tree={correlation} loading={false} error={correlation ? null : 'Correlation tree is not available for this instance.'} onRefresh={onRefresh} onDrillNode={onDrill} />`.

`MonitorShell`:
- Header shows `<Breadcrumb levels={levels} onPopTo={popTo} />` above the title row when there is more than one level.
- `drillInto(node)` = `drill(childTarget(level, node, lookupComponent(index, 'workflows', node.flow) ?? undefined))`; ignore when `node.id === level.instanceId`.
- Fourth `DetailsBody` tab `{ id: 'correlations', label: 'Correlations', render: () => <CorrelationsPanel … /> }`.
- `MonitorInspector` gains `childInstances?: CorrelationTreeNode[]` and `onDrill?: (node) => void`; for a state selection pass `childInstancesOf(data.correlation, level.instanceId, state.key)`. When non-empty, render above `StateExecution` a "Child instances" list with one **Drill into** button per child (`${node.flow} · ${node.ownState ?? node.currentState ?? ''}`).
- Every load / metrics / incident loader uses `level` (top of stack), not the root target.

- [ ] **Step 4: Run tests + build → PASS** (instance-monitor, quick-run CorrelationTree tests, build).
- [ ] **Step 5: Commit** — `feat(instance-monitor): correlations tab and breadcrumb drill-down into child instances`

---

### Task 6: Live refresh — change bus, polling, extension relay

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/bus/instanceChangeBus.ts` (+ `bus/instanceChangeBus.vitest.test.ts`)
- Create: `packages/designer-ui/src/modules/instance-monitor/model/pollSchedule.ts` (+ test)
- Modify: `packages/designer-ui/src/modules/instance-monitor/hooks/useMonitorController.ts`, `components/MonitorShell.tsx`, `index.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts` (`updateInstanceState`, `updateInstanceStatus`)
- Modify: `apps/extension/src/panels/monitor-messages.ts` (+ test), `MonitorPanel.ts`, `QuickRunPanel.ts`, `apps/extension/src/extension.ts`
- Modify: `apps/extension/webview-ui/src/quickrun/QuickRunApp.tsx`, `apps/extension/webview-ui/src/monitor/MonitorApp.tsx`

**Interfaces:**
- Produces (designer-ui, exported from `@vnext-forge-studio/designer-ui/monitor`):
  - `interface InstanceChangeEvent { domain: string; instanceId: string; status?: string; state?: string }`
  - `publishInstanceChange(event: InstanceChangeEvent, options?: { relay?: boolean }): void` — delivers to local subscribers, posts on the BroadcastChannel (when available) and, when `relay !== false`, calls the registered relay.
  - `subscribeInstanceChanges(listener: (e: InstanceChangeEvent) => void): () => void`
  - `registerInstanceChangeRelay(relay: ((e: InstanceChangeEvent) => void) | null): void`
  - `nextPollDelay(input: { status: string | undefined; unchangedForMs: number; visible: boolean; paused: boolean }): number | null` — `null` = do not poll; 3000 while changes are recent, 10000 after 60 s unchanged; `null` for terminal statuses (`C`, `F`, `X`, `T` and any status that is not `A`/`B`), when hidden or paused.
- Extension messages: webview→host `quickrun:instance-changed { domain, instanceId, status?, state? }`; host→monitor webview `monitor:instance-changed` (same fields).

- [ ] **Step 1: Failing tests**

`bus/instanceChangeBus.vitest.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishInstanceChange, registerInstanceChangeRelay, subscribeInstanceChanges } from './instanceChangeBus';

afterEach(() => registerInstanceChangeRelay(null));

describe('instanceChangeBus', () => {
  it('delivers to local subscribers until they unsubscribe', () => {
    const fn = vi.fn();
    const off = subscribeInstanceChanges(fn);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    off();
    publishInstanceChange({ domain: 'core', instanceId: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ domain: 'core', instanceId: 'a' });
  });
  it('relays unless told not to', () => {
    const relay = vi.fn();
    registerInstanceChangeRelay(relay);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    publishInstanceChange({ domain: 'core', instanceId: 'b' }, { relay: false });
    expect(relay).toHaveBeenCalledTimes(1);
  });
  it('keeps delivering when a listener throws', () => {
    const good = vi.fn();
    const offBad = subscribeInstanceChanges(() => { throw new Error('x'); });
    const offGood = subscribeInstanceChanges(good);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    expect(good).toHaveBeenCalled();
    offBad(); offGood();
  });
});
```

`model/pollSchedule.vitest.test.ts`:

```ts
it.each([
  [{ status: 'A', unchangedForMs: 0, visible: true, paused: false }, 3000],
  [{ status: 'B', unchangedForMs: 59_999, visible: true, paused: false }, 3000],
  [{ status: 'A', unchangedForMs: 60_000, visible: true, paused: false }, 10_000],
  [{ status: 'C', unchangedForMs: 0, visible: true, paused: false }, null],
  [{ status: 'F', unchangedForMs: 0, visible: true, paused: false }, null],
  [{ status: undefined, unchangedForMs: 0, visible: true, paused: false }, null],
  [{ status: 'A', unchangedForMs: 0, visible: false, paused: false }, null],
  [{ status: 'A', unchangedForMs: 0, visible: true, paused: true }, null],
])('nextPollDelay(%o) = %s', (input, expected) => {
  expect(nextPollDelay(input)).toBe(expected);
});
```

`monitor-messages.vitest.test.ts` additions:

```ts
describe('parseInstanceChangedMessage', () => {
  it('accepts a quickrun:instance-changed event', () => {
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', domain: 'core', instanceId: 'a1', status: 'A', state: 'review' }))
      .toEqual({ domain: 'core', instanceId: 'a1', status: 'A', state: 'review' });
  });
  it('rejects bad ids, missing domain and other types', () => {
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', domain: 'core', instanceId: '../x' })).toBeNull();
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', instanceId: 'a1' })).toBeNull();
    expect(parseInstanceChangedMessage({ type: 'other', domain: 'core', instanceId: 'a1' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`bus/instanceChangeBus.ts`:

```ts
export interface InstanceChangeEvent {
  domain: string;
  instanceId: string;
  status?: string;
  state?: string;
}

type Listener = (event: InstanceChangeEvent) => void;

const listeners = new Set<Listener>();
let relay: Listener | null = null;
const CHANNEL = 'vnext-forge-instance';
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  channel?.addEventListener('message', (e: MessageEvent<InstanceChangeEvent>) => deliver(e.data));
  return channel;
}

function deliver(event: InstanceChangeEvent): void {
  for (const l of [...listeners]) {
    try {
      l(event);
    } catch {
      /* one bad listener must not stop the others */
    }
  }
}

/**
 * "This instance changed" — Quick Run publishes, the Instance Monitor
 * listens. Local subscribers get it synchronously, other browser tabs via
 * BroadcastChannel, and other webviews through the host relay.
 */
export function publishInstanceChange(event: InstanceChangeEvent, options: { relay?: boolean } = {}): void {
  deliver(event);
  try {
    getChannel()?.postMessage(event);
  } catch {
    /* channel closed */
  }
  if (options.relay !== false) relay?.(event);
}

export function subscribeInstanceChanges(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Host shells forward events to other webviews (extension) — null to unregister. */
export function registerInstanceChangeRelay(next: Listener | null): void {
  relay = next;
}
```

`model/pollSchedule.ts`:

```ts
const LIVE = new Set(['A', 'B']);
export const POLL_FAST_MS = 3000;
export const POLL_SLOW_MS = 10_000;
export const POLL_BACKOFF_AFTER_MS = 60_000;

/** Delay before the next freshness check, or null when the monitor should not poll. */
export function nextPollDelay(input: { status: string | undefined; unchangedForMs: number; visible: boolean; paused: boolean }): number | null {
  if (input.paused || !input.visible || !input.status || !LIVE.has(input.status)) return null;
  return input.unchangedForMs >= POLL_BACKOFF_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
}
```

`quickRunStore.ts`: import `publishInstanceChange` from `../../instance-monitor/bus/instanceChangeBus`; after the `set(...)` in `updateInstanceState` publish `{ domain: existing.domain, instanceId, status: stateResponse.status, state: stateResponse.state }` only when an existing instance was updated **and** its status or state changed; same for `updateInstanceStatus` with `{ status, state: currentState }`. Restructure each action as `const existing = get().instances.get(instanceId); set(...); if (changed) publishInstanceChange(...)` so the publish happens outside the `set` callback.

`useMonitorController` additions:
- Subscribe to the bus: on an event whose `instanceId` is any id in `levels`, call `refresh()` (debounce 300 ms).
- Polling: keep `lastModifiedAt` / `lastChangeAt` refs from the ready data (`data.instance.metadata.modifiedAt`, `data.loadedAt`); a `setTimeout` loop computes `nextPollDelay({ status: data.instance.metadata.status, unchangedForMs: now - lastChangeAt, visible: document.visibilityState !== 'hidden', paused })`; on tick call `QuickRunApi.getInstance(scope)`; if its `metadata.modifiedAt` differs from `lastModifiedAt`, `refresh()`; reschedule. Re-arm on `visibilitychange`. Clear on unmount / level change. Guard `typeof document` for SSR.
- `paused` / `setPaused` come from the reducer (Task 5).

`MonitorShell` header: a **Pause** / **Resume** toggle button (`aria-pressed={paused}`, title "Pause live updates" / "Resume live updates") next to Refresh.

`index.ts`: `export { publishInstanceChange, subscribeInstanceChanges, registerInstanceChangeRelay, type InstanceChangeEvent } from './bus/instanceChangeBus';`

Extension:
- `monitor-messages.ts`: `parseInstanceChangedMessage(raw): InstanceChangeEvent | null` — type `quickrun:instance-changed`, `domain` non-empty string ≤ 100 chars, `instanceId` matching `ID_PATTERN`, optional `status` / `state` strings ≤ 200 chars.
- `MonitorPanel.notifyInstanceChanged(event)`: post `{ type: 'monitor:instance-changed', ...event }` to every ready panel whose `ctx.domain === event.domain` (the webview filters by its own levels).
- `QuickRunPanel`: in `onDidReceiveMessage`, `const changed = parseInstanceChangedMessage(raw); if (changed) { void vscode.commands.executeCommand('vnextForge.notifyInstanceChanged', changed); return; }`.
- `extension.ts`: register (not contribute) `vnextForge.notifyInstanceChanged` → `monitorPanel.notifyInstanceChanged(arg)` after a shape check.
- `QuickRunApp.tsx`: on mount `registerInstanceChangeRelay((e) => api.postMessage({ type: 'quickrun:instance-changed', ...e }))`, unregister on unmount.
- `MonitorApp.tsx`: on `monitor:instance-changed` (origin-checked) call `publishInstanceChange({ domain, instanceId, status?, state? }, { relay: false })`.

- [ ] **Step 4: Run tests + builds** — designer-ui instance-monitor + quick-run suites, `pnpm --filter vnext-forge-studio test`, designer-ui build, `pnpm --filter vnext-forge-studio build` → PASS.
- [ ] **Step 5: Commit** — `feat(instance-monitor): live refresh from Quick Run events and light polling`

---

### Task 7: Focus the instance in Quick Run, full Instance tab, Monitor entry in the instance list

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunShell.tsx` (`focusInstanceId`), `components/QuickRunSidebar.tsx`, `components/InstanceListPanel.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/hooks/useFocusInstance.ts` (+ test of its pure part)
- Modify: `packages/designer-ui/src/modules/instance-monitor/components/InstanceTab.tsx` (+ test), `components/MonitorShell.tsx` (`onOpenQuickRun(instanceId)`)
- Modify: `apps/extension/src/panels/monitor-messages.ts` (+ test), `MonitorPanel.ts`, `QuickRunPanel.ts`, `apps/extension/src/extension.ts`, `webview-ui/src/quickrun/QuickRunApp.tsx`, `webview-ui/src/monitor/MonitorApp.tsx`
- Modify: `apps/web/src/pages/quickrun/QuickRunPage.tsx`, `apps/web/src/pages/monitor/MonitorPage.tsx`

**Interfaces:**
- Produces: `QuickRunShellProps.focusInstanceId?: string`; `MonitorShellProps.onOpenQuickRun?: (instanceId: string) => void` (was `() => void`); `targetFromInstanceDetail(detail: InstanceDetailResponse, domain, workflowKey): OpenInstanceTarget`; message `monitor:open-quickrun { instanceId }` (validated) and host→Quick Run webview `quickrun:focus-instance { instanceId }`; `QuickRunPanel.focusInstance(domain, workflowKey, instanceId)`; `InstanceListPanel` / `QuickRunSidebar` accept `onOpenMonitor?: (target: OpenMonitorTarget) => void`.

- [ ] **Step 1: Failing tests**

- `useFocusInstance.vitest.test.ts`: `targetFromInstanceDetail(DETAIL, 'core', 'loan')` → `{ id, key, domain: 'core', workflowKey: 'loan', status: metadata.status, effectiveStatus, currentState: metadata.currentState, startedAt: metadata.createdAt }`.
- `monitor-messages.vitest.test.ts`: `parseOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun', instanceId: 'a1' })` → `{ instanceId: 'a1' }`; `{ type: 'monitor:open-quickrun' }` → `{}` (still reveals the panel); bad id → `{}` (id dropped, not rejected). Replace `isOpenQuickRunFromMonitorMessage` with this parser (return `null` for other types).
- `InstanceTab` SSR: with `metadata.completedAt` and `duration: 125.4` shows "Completed" + a formatted duration ("2m 5s" via `formatDurationMs(125.4 * 1000)`), and with `attributes` shows an "Attributes" section.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`useFocusInstance.ts`:

```ts
import { useEffect } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import type { InstanceDetailResponse } from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import type { OpenInstanceTarget } from '../utils/instanceTarget';
import { useOpenInstance } from './useOpenInstance';

export function targetFromInstanceDetail(detail: InstanceDetailResponse, domain: string, workflowKey: string): OpenInstanceTarget {
  return {
    id: detail.id,
    key: detail.key,
    domain,
    workflowKey,
    status: detail.metadata.status as OpenInstanceTarget['status'],
    ...(detail.metadata.effectiveStatus ? { effectiveStatus: detail.metadata.effectiveStatus } : {}),
    currentState: detail.metadata.currentState,
    startedAt: detail.metadata.createdAt,
  };
}

/** Bring an instance into focus by id: switch to its tab, or fetch it and open one. */
export function useFocusInstance(instanceId: string | undefined, headers: Record<string, string>, runtimeUrl: string | undefined): void {
  const openInstance = useOpenInstance();
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  useEffect(() => {
    if (!instanceId || !domain || !workflowKey) return;
    const state = useQuickRunStore.getState();
    if (state.instances.has(instanceId)) {
      state.setActiveTab(instanceId);
      return;
    }
    let cancelled = false;
    void QuickRunApi.getInstance({ domain, workflowKey, instanceId, headers, ...(runtimeUrl ? { runtimeUrl } : {}) }).then((res) => {
      if (!cancelled && res.success) openInstance(targetFromInstanceDetail(res.data, domain, workflowKey));
    });
    return () => {
      cancelled = true;
    };
    // headers intentionally read at focus time only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, domain, workflowKey, runtimeUrl, openInstance]);
}
```

Verify `OpenInstanceTarget` field names and the `instances` container type (`Map`) against `utils/instanceTarget.ts` / the store before writing; adapt names, not behaviour.

`QuickRunShell`: add `focusInstanceId?: string` (doc: "Instance to bring into focus after mount — e.g. from the monitor's Open in Quick Run"), and call `useFocusInstance(focusInstanceId, <merged headers used by the shell>, environmentUrl)` after `setWorkflowContext` has run (place the hook below the workflow-context effect).

`InstanceListPanel` / `QuickRunSidebar`: thread `onOpenMonitor?` from `QuickRunShell` (`<QuickRunSidebar … {...(onOpenMonitor ? { onOpenMonitor } : {})} />`). In the **Active** and **Recent** lists wrap each row button in `<div className="group relative">` and add, as a sibling after the button, when `onOpenMonitor`:

```tsx
<span className="absolute right-9 top-1/2 hidden -translate-y-1/2 group-hover:block group-focus-within:block">
  <OpenMonitorButton onClick={() => onOpenMonitor({ domain, workflowKey, instanceId: <row id>, instanceKey: <row key> })} />
</span>
```

(`domain` / `workflowKey` from the store; pick `right-*` so it sits left of the status badge.)

`InstanceTab`: in "Timing" add `!!m.completedAt && { label: 'Completed', value: when(m.completedAt) }` and `m.duration != null && { label: 'Duration', value: formatDurationMs(m.duration * 1000) ?? '—' }`; after "Who", when `instance.attributes` / `instance.extensions` have keys, collapsible sections "Attributes" / "Extensions" rendering `<CopyableJsonBlock value={…} />` (`quick-run/components/CopyableJsonBlock.tsx`).

`MonitorShell`: `onOpenQuickRun` now receives the current level's instance id (`props.onOpenQuickRun?.(level.instanceId)`), for the Instance tab button, the not-found "Back to Quick Run" link and the incidents "Retry from Quick Run" button.

Extension:
- `MonitorApp.tsx`: `onOpenQuickRun={(instanceId) => api.postMessage({ type: 'monitor:open-quickrun', instanceId })}`.
- `MonitorPanel`: on `parseOpenQuickRunFromMonitorMessage(raw)` → `executeCommand('vnextForge.openQuickRunFromFile', Uri.file(ctx.workflowFilePath))`, then, when `instanceId`, `executeCommand('vnextForge.focusQuickRunInstance', { domain: ctx.domain, workflowKey: ctx.workflowKey, instanceId })`. Child levels: the monitor only knows the root context on the host, so the host always uses the **root** workflow file; for a child level, the webview sends the child's id but the host must not open the root's Quick Run with a foreign id — `MonitorApp` therefore sends `instanceId` only when it equals the root target's id (pass a flag from MonitorShell: `onOpenQuickRun(instanceId, isRoot)`; send `{}` otherwise). Keep this rule in the MonitorShell/MonitorApp boundary.
- `QuickRunPanel.focusInstance(domain, workflowKey, instanceId)`: find the entry by `keyFor`; post `{ type: 'quickrun:focus-instance', instanceId }` (queue it until `webviewReady`).
- `extension.ts`: register `vnextForge.focusQuickRunInstance` (not contributed) with a shape + `ID_PATTERN` check → `quickRunPanel.focusInstance(...)`.
- `QuickRunApp.tsx`: keep `focusInstanceId` state; set it from origin-checked `quickrun:focus-instance`; pass to `QuickRunShell`; also wire `onOpenMonitor` into the sidebar via the existing `QuickRunShell` prop (already passed).

Web:
- `MonitorPage`: `onOpenQuickRun={(instanceId, isRoot) => navigate(\`/project/${id}/quickrun/${g}/${n}${isRoot ? \`?instance=${encodeURIComponent(instanceId)}\` : ''}\`)}`.
- `QuickRunPage`: read `useSearchParams().get('instance') ?? undefined` and pass as `focusInstanceId`.

Make `MonitorShellProps.onOpenQuickRun` `(instanceId: string, isRoot: boolean) => void`.

- [ ] **Step 4: Run tests + builds** (designer-ui, extension tests, designer-ui / web / extension builds) → PASS.
- [ ] **Step 5: Commit** — `feat(instance-monitor): focus the instance in Quick Run, full Instance tab, monitor entry in the instance list`

---

### Task 8: Verification

- [ ] **Step 1:** `pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter vnext-forge-studio test && pnpm --filter @vnext-forge-studio/server test && pnpm -w turbo run build` → all green.
- [ ] **Step 2:** lint the touched files of each package; no new errors in new files.
- [ ] **Step 3: Web shell** (local runtime): open a monitor for an instance with tasks and an incident → faulted ring + ⚠ on the incident state; Incidents tab shows the active incident, **Show on canvas** selects the state; inspector state shows tasks (or per-visit metrics on 0.0.99), transition shows "Firing n of m" with Overview / Request tabs; Correlations tab lists the tree, **Monitor this instance** drills in, breadcrumb pops back with the old selection; a SubFlow state lists **Drill into**; advance the instance from Quick Run in another browser tab → the monitor refreshes within ~3 s (BroadcastChannel / polling); Pause stops it; **Open in Quick Run** lands on the instance's tab; the Recent list shows the Monitor icon on hover; the Instance tab shows Completed / Duration on a finished instance.
- [ ] **Step 4: Extension Development Host:** Quick Run beside Monitor — firing a transition in Quick Run refreshes the monitor immediately (relay); **Open in Quick Run** focuses the instance tab.
- [ ] **Step 5:** record what ran and what did not.
