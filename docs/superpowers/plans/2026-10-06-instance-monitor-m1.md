# Instance Monitor M1 (Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a read-only Instance Monitor beside Quick Run that draws the instance's path on the local flow canvas, with a definition inspector whose component references open their designers, an Instance tab, a path timeline and manual refresh — in both the VS Code extension and the web shell.

**Architecture:** A new designer-ui module `instance-monitor` (exported as `@vnext-forge-studio/designer-ui/monitor`) owns loading, state and UI. It reuses `FlowCanvas` in `instance-view` mode (extended with visit counts, path order and a path-only mode), the read-only inspectors (extended with a component-link context) and the Quick Run API (`getInstance`, `getHistory`). The definition comes from the local workflow file plus its `.meta/*.diagram.json`; without one, a history-only graph is drawn. Each shell mounts `MonitorShell`: the extension in a new `MonitorPanel` webview, the web shell as a `monitor` editor tab route.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `@xyflow/react`, vitest (SSR via `renderToStaticMarkup`), VS Code webview API, Vite multi-page build, React Router.

**Spec:** `docs/superpowers/specs/2026-10-06-instance-monitor-design.md` (phase M1).

## Global Constraints

- All user-visible strings (labels, buttons, tooltips, `aria-label`, `title`) are **English**.
- The monitor **never drives** the instance: no start / transition / retry / cancel calls (spec D7).
- The monitor must **not write files**: never call `ensureDiagramInfrastructure`, `saveFlowEditorDocument` or any `files/write`.
- `apps/web` must not import `@vnext-forge-studio/services-core`; `packages/*` must not import `apps/*`.
- Quick Run / monitor colours use `var(--vscode-*, <fallback>)` so they also render in the web shell.
- Buttons and clickable rows get `cursor-pointer`.
- Tests are `*.vitest.test.ts(x)` next to the code; run with `pnpm --filter <pkg> exec vitest run <path>`.
- `grep` in this shell is aliased to ugrep; use `command grep` or `rg` when searching.
- Commit after every task with a Conventional Commit message ending in the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `f/instance-monitor`.
- Lint only touched files (`pnpm --filter <pkg> exec eslint <files>`); package-wide `eslint .` is already red.

### Refinements to the spec for M1 (decided while planning)

| Spec says | M1 does | Why |
|---|---|---|
| Monitor entry in the instance-list row menu | Header button only | List rows are `<button>`s with no menu; a nested button is invalid HTML. Revisit in M2. |
| Web shell opens the monitor with `window.open` | Opens a `monitor` editor tab via route navigation | Matches how Quick Run opens the Function Runner in the web shell; M2's `BroadcastChannel` works within one window too. |
| `useMonitorStore` (zustand) | `useMonitorController` (reducer hook) | State lives per mounted shell, which is exactly "per panel"; a module-level zustand store would be shared by two web tabs. |
| Instance tab shows completedAt / duration / attributes / extensions | Not shown | `quickrun/getInstance`'s result schema strips them (`quickrun-schemas.ts:527`). Extend the schema in M2. |
| "Open in QuickRun" focuses the instance tab | Reveals the workflow's Quick Run panel | Focusing a tab needs the M2 change bus. |
| Headers | Tool-wide (Forge Tools) headers only | Same as the Function Runner; per-workflow Quick Run headers stay in Quick Run. |

---

## File Structure

**designer-ui — canvas (modify)**
- `packages/designer-ui/src/modules/canvas-interaction/utils/executionOverlay.ts` *(create)* — pure overlay math: visit counts, path order per edge, node/edge execution data.
- `…/canvas-interaction/context/CanvasModeContext.tsx` — `ExecutionOverlay.pathOnly`.
- `…/canvas-interaction/FlowCanvas.tsx` — uses `executionOverlay.ts`.
- `…/canvas-interaction/utils/Conversion.ts` — node `hasQueryRoles`, edge `hasRule`.
- `…/canvas-interaction/components/nodes/StateNodeBase.tsx` — ×N badge, roles icon (read-only modes).
- `…/canvas-interaction/components/edges/TransitionEdge.tsx` — path order chip, rule marker, path-only dimming.
- `…/canvas-interaction/canvas-overrides.css` — path-only node style.

**designer-ui — read-only inspectors (modify)**
- `…/canvas-interaction/readonly/ComponentLinkContext.tsx` *(create)* — optional handlers for ↗ links.
- `…/canvas-interaction/components/panels/tabs/PropertyPanelShared.tsx` — `ResourceRef` `category` + ↗; `CodePreview` "Open script".
- `…/readonly/StateInspector.tsx`, `TransitionFields.tsx`, `TransitionInspector.tsx`, `WorkflowMetadataInspector.tsx` — pass categories; `summary` slot under the header.
- `…/readonly/index.ts` — export the context.

**designer-ui — instance-monitor (create)**
- `packages/designer-ui/src/modules/instance-monitor/types.ts` — shared types.
- `…/instance-monitor/model/monitorPath.ts` — overlay from history, visit/firing summaries, label pick, path steps.
- `…/instance-monitor/model/historyGraph.ts` — history-only definition.
- `…/instance-monitor/model/definitionDrift.ts` — version drift, diagram path.
- `…/instance-monitor/model/componentIndex.ts` — key → file index per category.
- `…/instance-monitor/model/monitorReducer.ts` — load / selection / path-only state.
- `…/instance-monitor/data/loadMonitorLevel.ts` — parallel load of instance, history, definition.
- `…/instance-monitor/hooks/useMonitorController.ts`, `hooks/useComponentIndex.ts`.
- `…/instance-monitor/components/MonitorCanvas.tsx`, `PathTimeline.tsx`, `MonitorInspector.tsx`, `InstanceTab.tsx`, `MonitorShell.tsx`.
- `…/instance-monitor/index.ts`; `packages/designer-ui/package.json` export `./monitor`.

**designer-ui — Quick Run entry (modify)**
- `…/quick-run/types/quickrun.types.ts` — `OpenMonitorTarget`.
- `…/quick-run/components/OpenMonitorButton.tsx` *(create)*.
- `…/quick-run/components/InstanceDashboard.tsx`, `…/quick-run/QuickRunShell.tsx` — `onOpenMonitor` prop.

**extension**
- `apps/extension/src/panels/monitor-messages.ts` *(create)* — validate webview messages.
- `apps/extension/src/panels/webview-html.ts` *(create)* — HTML/CSP builder for the monitor page.
- `apps/extension/src/panels/MonitorPanel.ts` *(create)*.
- `apps/extension/src/panels/QuickRunPanel.ts` — handle `quickrun:open-monitor`.
- `apps/extension/src/extension.ts` — `MonitorPanel` instance + `vnextForge.openInstanceMonitor`.
- `apps/extension/webview-ui/monitor.html`, `webview-ui/src/monitor-main.tsx`, `webview-ui/src/monitor/MonitorApp.tsx` *(create)*; `webview-ui/vite.config.ts` input; `webview-ui/src/quickrun/QuickRunApp.tsx` wiring.

**web**
- `packages/designer-ui/src/modules/code-editor/EditorStore.ts`, `EditorTabLabel.tsx`, `editorTabPresentation.ts` — `monitor` tab kind.
- `apps/web/src/modules/project-workspace/editorTabNavigation.ts` — monitor tab path.
- `apps/web/src/pages/quickrun/workflowFilePath.ts` *(create)* — shared path helper.
- `apps/web/src/pages/monitor/MonitorPage.tsx` *(create)*; `apps/web/src/app/AppRouter.tsx` route; `apps/web/src/pages/quickrun/QuickRunPage.tsx` wiring.

---

### Task 1: Canvas overlay — visit counts, path order, path-only, role and rule markers

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/utils/executionOverlay.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/utils/executionOverlay.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/context/CanvasModeContext.tsx:11-14`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/FlowCanvas.tsx:381-421`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts:219-290`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeBase.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/edges/TransitionEdge.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/canvas-overrides.css:443-462`

**Interfaces:**
- Produces: `ExecutionOverlay.pathOnly?: boolean`, `ExecutionOverlay.focus?: { kind: 'state' | 'transition'; key: string } | null`; `stateVisitCounts(overlay): Map<string, number>`; `RUNTIME_START_STATE = '$start'`; node data `visitCount`, `pathOnly`, `hasQueryRoles`, `spotlight` (when focused); edge data `pathOrder: number[]`, `pathOnly`, `hasRule`, `spotlight` (when focused). `spotlight` reuses the canvas' existing pulse styling, so a selection made outside the canvas (the path timeline) shows on it.

- [ ] **Step 1: Write the failing test**

```ts
// executionOverlay.vitest.test.ts
import { describe, expect, it } from 'vitest';

import type { ExecutionOverlay } from '../context/CanvasModeContext';
import { edgeExecutionData, edgePathOrders, nodeExecutionData, stateVisitCounts } from './executionOverlay';

const overlay = (
  rows: Array<[from: string, key: string, to: string]>,
  currentState: string | null = null,
  pathOnly = false,
): ExecutionOverlay => ({
  traversedTransitions: rows.map(([fromState, transitionId, toState]) => ({ fromState, transitionId, toState })),
  currentState,
  pathOnly,
});

const LOOP = overlay(
  [
    ['$start', 'start', 'init'],
    ['init', 'submit', 'review'],
    ['review', 'reject', 'init'],
    ['init', 'submit', 'review'],
  ],
  'review',
);

describe('stateVisitCounts', () => {
  it('counts every entry, loops included', () => {
    const counts = stateVisitCounts(LOOP);
    expect(counts.get('init')).toBe(2);
    expect(counts.get('review')).toBe(2);
    expect(counts.has('$start')).toBe(false);
  });

  it('counts a state the path leaves but never enters once', () => {
    const counts = stateVisitCounts(overlay([['a', 'go', 'b']]));
    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(1);
  });
});

describe('nodeExecutionData', () => {
  const visits = stateVisitCounts(LOOP);
  it('marks current, visited and unreachable states', () => {
    expect(nodeExecutionData('review', LOOP, visits)).toEqual({ executionStatus: 'current', visitCount: 2, pathOnly: false });
    expect(nodeExecutionData('init', LOOP, visits)?.executionStatus).toBe('visited');
    expect(nodeExecutionData('done', LOOP, visits)).toEqual({ executionStatus: 'unreachable', visitCount: 0, pathOnly: false });
  });
  it('leaves the start and workflow-level nodes alone', () => {
    expect(nodeExecutionData('__start__', LOOP, visits)).toBeNull();
    expect(nodeExecutionData('__wf_cancel', LOOP, visits)).toBeNull();
  });
  it('carries path-only through', () => {
    const o = { ...LOOP, pathOnly: true };
    expect(nodeExecutionData('done', o, stateVisitCounts(o))?.pathOnly).toBe(true);
  });
});

describe('edgeExecutionData', () => {
  const orders = edgePathOrders(LOOP);
  it('numbers each firing of an edge, oldest first', () => {
    expect(edgeExecutionData('init', 'submit', orders, LOOP)).toEqual({ executionStatus: 'traversed', pathOrder: [2, 4], pathOnly: false });
  });
  it('maps the runtime $start row onto the start edge', () => {
    expect(edgeExecutionData('__start__', 'start', orders, LOOP).pathOrder).toEqual([1]);
  });
  it('does not light up the same key leaving another state', () => {
    expect(edgeExecutionData('review', 'submit', orders, LOOP).executionStatus).toBe('untaken');
  });
  it('matches workflow-level edges by key alone', () => {
    const o = overlay([['review', 'cancel', 'cancelled']]);
    expect(edgeExecutionData('__wf_cancel', 'cancel', edgePathOrders(o), o).pathOrder).toEqual([1]);
  });
  it('treats an edge without a key as untaken', () => {
    expect(edgeExecutionData('init', undefined, orders, LOOP)).toEqual({ executionStatus: 'untaken', pathOrder: [], pathOnly: false });
  });
});

describe('focus', () => {
  it('spotlights the focused state and only that one', () => {
    const o: ExecutionOverlay = { ...LOOP, focus: { kind: 'state', key: 'init' } };
    const visits = stateVisitCounts(o);
    expect(nodeExecutionData('init', o, visits)?.spotlight).toBe(true);
    expect(nodeExecutionData('review', o, visits)).not.toHaveProperty('spotlight');
  });
  it('spotlights every edge of the focused transition key', () => {
    const o: ExecutionOverlay = { ...LOOP, focus: { kind: 'transition', key: 'submit' } };
    expect(edgeExecutionData('init', 'submit', edgePathOrders(o), o).spotlight).toBe(true);
    expect(edgeExecutionData('review', 'reject', edgePathOrders(o), o)).not.toHaveProperty('spotlight');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils/executionOverlay.vitest.test.ts`
Expected: FAIL — cannot resolve `./executionOverlay`.

- [ ] **Step 3: Add `pathOnly` to the overlay type**

In `CanvasModeContext.tsx` replace the `ExecutionOverlay` interface:

```ts
export interface ExecutionOverlay {
  /** Oldest first — the order is the path order shown on edges. */
  traversedTransitions: CanvasTraversedTransition[];
  currentState: string | null;
  /** Fade everything off the path further and show path order on edges. */
  pathOnly?: boolean;
  /** Element selected outside the canvas (e.g. a path timeline chip); pulses like a search hit. */
  focus?: { kind: 'state' | 'transition'; key: string } | null;
}
```

- [ ] **Step 4: Write `executionOverlay.ts`**

```ts
import type { ExecutionOverlay } from '../context/CanvasModeContext';

export const START_NODE_ID = '__start__';
/** `fromState` of the start transition's history row (runtime ≥ 0.0.99). */
export const RUNTIME_START_STATE = '$start';

export type NodeExecutionStatus = 'current' | 'visited' | 'unreachable';
export type EdgeExecutionStatus = 'traversed' | 'untaken';

export interface NodeExecutionData {
  executionStatus: NodeExecutionStatus;
  visitCount: number;
  pathOnly: boolean;
  /** Present (and true) only when focused — never overrides a search spotlight with `false`. */
  spotlight?: true;
}

export interface EdgeExecutionData {
  executionStatus: EdgeExecutionStatus;
  /** 1-based positions of this edge in the path, oldest first. */
  pathOrder: number[];
  pathOnly: boolean;
  spotlight?: true;
}

export interface EdgePathOrders {
  bySource: Map<string, number[]>;
  byKey: Map<string, number[]>;
}

/** Canvas node id a history `fromState` leaves from. */
export function canvasSourceId(fromState: string): string {
  return fromState === RUNTIME_START_STATE ? START_NODE_ID : fromState;
}

export function overlayEdgeKey(sourceId: string, transitionKey: string): string {
  return `${sourceId}::${transitionKey}`;
}

/**
 * How many times each state was entered. A state the path leaves but never
 * enters (the first state of a history without a `$start` row) counts once.
 */
export function stateVisitCounts(overlay: ExecutionOverlay): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of overlay.traversedTransitions) counts.set(t.toState, (counts.get(t.toState) ?? 0) + 1);
  for (const t of overlay.traversedTransitions) {
    if (t.fromState !== RUNTIME_START_STATE && !counts.has(t.fromState)) counts.set(t.fromState, 1);
  }
  return counts;
}

/** Path positions per edge: by source + key, and by key alone for workflow-level edges. */
export function edgePathOrders(overlay: ExecutionOverlay): EdgePathOrders {
  const bySource = new Map<string, number[]>();
  const byKey = new Map<string, number[]>();
  overlay.traversedTransitions.forEach((t, i) => {
    const sourceKey = overlayEdgeKey(canvasSourceId(t.fromState), t.transitionId);
    bySource.set(sourceKey, [...(bySource.get(sourceKey) ?? []), i + 1]);
    byKey.set(t.transitionId, [...(byKey.get(t.transitionId) ?? []), i + 1]);
  });
  return { bySource, byKey };
}

export function nodeExecutionData(
  nodeId: string,
  overlay: ExecutionOverlay,
  visits: Map<string, number>,
): NodeExecutionData | null {
  if (nodeId.startsWith(START_NODE_ID) || nodeId.startsWith('__wf_')) return null;
  const visitCount = visits.get(nodeId) ?? 0;
  const executionStatus: NodeExecutionStatus =
    overlay.currentState === nodeId ? 'current' : visitCount > 0 ? 'visited' : 'unreachable';
  const focused = overlay.focus?.kind === 'state' && overlay.focus.key === nodeId;
  return { executionStatus, visitCount, pathOnly: overlay.pathOnly === true, ...(focused ? { spotlight: true as const } : {}) };
}

/**
 * Workflow-level edges (cancel / exit / timeout / updateData / shared) start at
 * a `__wf_*` node the runtime never names, so they match by key alone.
 */
export function edgeExecutionData(
  source: string,
  transitionKey: string | undefined,
  orders: EdgePathOrders,
  overlay: ExecutionOverlay,
): EdgeExecutionData {
  const pathOrder = !transitionKey
    ? []
    : (orders.bySource.get(overlayEdgeKey(source, transitionKey)) ??
      (source.startsWith('__wf_') ? orders.byKey.get(transitionKey) : undefined) ??
      []);
  const focused = !!transitionKey && overlay.focus?.kind === 'transition' && overlay.focus.key === transitionKey;
  return {
    executionStatus: pathOrder.length > 0 ? 'traversed' : 'untaken',
    pathOrder,
    pathOnly: overlay.pathOnly === true,
    ...(focused ? { spotlight: true as const } : {}),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils/executionOverlay.vitest.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Use the helpers in `FlowCanvas.tsx`**

Add to the imports (next to the other `./utils/*` imports):

```ts
import { edgeExecutionData, edgePathOrders, nodeExecutionData, stateVisitCounts } from './utils/executionOverlay';
```

Replace the whole block from `const visitedStates = useMemo<Set<string>>(() => {` through the end of the `finalEdges` `useMemo` (lines 381–421) with:

```ts
  const visitCounts = useMemo(
    () => (executionOverlay ? stateVisitCounts(executionOverlay) : new Map<string, number>()),
    [executionOverlay],
  );

  const pathOrders = useMemo(
    () => (executionOverlay ? edgePathOrders(executionOverlay) : null),
    [executionOverlay],
  );

  const finalNodes = useMemo(() => {
    if (!executionOverlay) return decoratedNodes;
    return decoratedNodes.map((n) => {
      const exec = nodeExecutionData(n.id, executionOverlay, visitCounts);
      return exec ? { ...n, data: { ...n.data, ...exec } } : n;
    });
  }, [decoratedNodes, executionOverlay, visitCounts]);

  const finalEdges = useMemo(() => {
    if (!executionOverlay || !pathOrders) return decoratedEdges;
    return decoratedEdges.map((e) => {
      const transitionKey = (e.data as Record<string, unknown> | undefined)?.transitionKey as string | undefined;
      return { ...e, data: { ...e.data, ...edgeExecutionData(e.source, transitionKey, pathOrders, executionOverlay) } };
    });
  }, [decoratedEdges, executionOverlay, pathOrders]);
```

Run `command grep -n "visitedStates\|traversedTransitionKeys" packages/designer-ui/src/modules/canvas-interaction/FlowCanvas.tsx` — expected: no output.

- [ ] **Step 7: Carry roles and rules into node / edge data (`Conversion.ts`)**

In `workflowToReactFlow`, in the state node `data` object after `hasErrorBoundary: !!state.errorBoundary,` add:

```ts
        hasQueryRoles: Array.isArray(state.queryRoles) && state.queryRoles.length > 0,
```

In both state-transition edge `data` objects (the self-loop one and the `else if (target)` one), after `triggerKind: t.triggerKind || 0,` add:

```ts
              hasRule: Boolean(t.rule),
```

If TypeScript reports that `queryRoles` or `rule` is not on the state / transition type, read them through `(state as { queryRoles?: unknown[] }).queryRoles` and `(t as { rule?: unknown }).rule` — the types live in `@vnext-forge-studio/vnext-types` and both fields exist in the schema.

- [ ] **Step 8: Node badge and roles icon (`StateNodeBase.tsx`)**

Add `ShieldCheck` to the `lucide-react` import. Extend `StateNodeData`:

```ts
  hasQueryRoles?: boolean;
  visitCount?: number;
  pathOnly?: boolean;
```

Replace the `executionCls` computation with:

```ts
  const pathOnly = d.pathOnly === true;
  const executionCls =
    executionStatus === 'current' ? 'vf-node-current' :
    executionStatus === 'visited' ? 'vf-node-visited' :
    executionStatus === 'unreachable' ? (pathOnly ? 'vf-node-off-path' : 'vf-node-unreachable') :
    '';
  const visitCount = typeof d.visitCount === 'number' ? d.visitCount : 0;
```

In the header row (`<div className="flex items-center gap-3 px-3.5 pt-3 pb-2">`), directly after the `<div className="min-w-0 flex-1">…</div>` block, add:

```tsx
        {visitCount > 1 && (
          <span
            className="bg-action/10 text-action shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            title={`Entered ${visitCount} times`}
            aria-label={`Entered ${visitCount} times`}
          >
            ×{visitCount}
          </span>
        )}
```

Change the stats-row guard to also show for roles in read-only modes:

```tsx
      {statsAllowed && (totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow || d.hasLongPoll || (!isEditable && d.hasQueryRoles)) && (
```

and add, right after the `{d.hasSubFlow && (…)}` icon:

```tsx
            {!isEditable && d.hasQueryRoles && (
              <span className="text-initial inline-flex items-center" title="Has query roles" aria-label="Has query roles">
                <ShieldCheck size={11} strokeWidth={2.25} />
              </span>
            )}
```

- [ ] **Step 9: Edge order chip, rule marker and path-only dimming (`TransitionEdge.tsx`)**

Replace the execution opacity / stroke block with:

```ts
  const pathOrder = Array.isArray(d.pathOrder) ? (d.pathOrder as number[]) : [];
  const pathOnly = d.pathOnly === true;
  // Execution overlay — adjust opacity/stroke width based on traversal status.
  const executionOpacity =
    executionStatus === 'untaken' ? (pathOnly ? 0.08 : 0.3) :
    1;
  const executionStrokeWidth =
    executionStatus === 'traversed' ? Math.max(strokeWidth, 2.5) :
    strokeWidth;
```

Add to `TransitionEdgeData`:

```ts
  hasRule?: boolean;
  pathOrder?: number[];
  pathOnly?: boolean;
```

Inside the label pill, directly after the `{badge.label && (…)}` span, add:

```tsx
            {!isEditable && d.hasRule && (
              <span className="ml-1 text-[8px] font-semibold uppercase text-muted-foreground shrink-0" title="Guarded by a rule">
                rule
              </span>
            )}
            {pathOrder.length > 0 && (
              <span
                className="bg-action text-action-foreground ml-1 shrink-0 rounded-full px-1.5 text-[9px] font-semibold tabular-nums"
                title={`Step ${pathOrder.join(', ')} of the path`}
              >
                {pathOrder.join(' · ')}
              </span>
            )}
```

- [ ] **Step 10: Path-only node style (`canvas-overrides.css`)**

After the `.vf-node-unreachable` rule add:

```css
.vf-node-off-path {
  opacity: 0.12;
  filter: grayscale(1);
}
```

- [ ] **Step 11: Typecheck and run the canvas tests**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction`
Expected: build succeeds; all canvas-interaction tests PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction
git commit -m "feat(canvas): visit counts, path order and path-only in the instance overlay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Component links in the read-only inspectors

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/readonly/ComponentLinkContext.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/readonly/ComponentLinkContext.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/PropertyPanelShared.tsx:126-170`
- Modify: `…/readonly/StateInspector.tsx`, `…/readonly/TransitionFields.tsx`, `…/readonly/TransitionInspector.tsx`, `…/readonly/WorkflowMetadataInspector.tsx`, `…/readonly/index.ts`

**Interfaces:**
- Produces: `ComponentLinkProvider({ value: ComponentLinkHandlers, children })`, `useComponentLinks()`, `ComponentLinkHandlers { resolveComponent?(category, ref): string | null | undefined; openComponent?(category, ref): void; openScript?(location): void }`; `ResourceRef({ resource, category? })`; `StateInspectorProps.summary?: ReactNode`; `TransitionInspectorProps.summary?: ReactNode`.

- [ ] **Step 1: Write the failing test**

```tsx
// ComponentLinkContext.vitest.test.tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CodePreview, ResourceRef } from '../components/panels/tabs/PropertyPanelShared';
import { ComponentLinkProvider, type ComponentLinkHandlers } from './ComponentLinkContext';
import { StateInspector } from './StateInspector';
import type { StateView } from './view-types';

const REF = { key: 'approve-view', domain: 'core', version: '1.0.0', flow: 'sys-views' };

const withLinks = (value: ComponentLinkHandlers, child: ReturnType<typeof h>) =>
  renderToStaticMarkup(h(ComponentLinkProvider, { value }, child));

describe('ResourceRef links', () => {
  it('renders no open button without a provider', () => {
    expect(renderToStaticMarkup(h(ResourceRef, { resource: REF, category: 'views' }))).not.toContain('Open approve-view');
  });

  it('offers to open a resolved reference', () => {
    const html = withLinks(
      { resolveComponent: () => '/ws/core/Views/approve-view.json', openComponent: () => {} },
      h(ResourceRef, { resource: REF, category: 'views' }),
    );
    expect(html).toContain('Open approve-view in its designer');
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it('disables the button for a reference outside the workspace', () => {
    const html = withLinks(
      { resolveComponent: () => null, openComponent: () => {} },
      h(ResourceRef, { resource: REF, category: 'views' }),
    );
    expect(html).toContain('Not in this workspace');
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it('needs a category to link', () => {
    const html = withLinks({ openComponent: () => {} }, h(ResourceRef, { resource: REF }));
    expect(html).not.toContain('in its designer');
  });
});

describe('CodePreview script link', () => {
  it('offers to open the script file', () => {
    const html = withLinks({ openScript: () => {} }, h(CodePreview, { code: '', location: './src/Gate.csx' }));
    expect(html).toContain('Open script');
  });
});

describe('StateInspector summary slot', () => {
  it('renders the summary under the header', () => {
    const html = renderToStaticMarkup(
      h(StateInspector, { state: { key: 's1', stateType: 2, transitions: [] } as StateView, summary: 'Visited 2× · now here' }),
    );
    expect(html).toContain('Visited 2× · now here');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/readonly/ComponentLinkContext.vitest.test.tsx`
Expected: FAIL — cannot resolve `./ComponentLinkContext`.

- [ ] **Step 3: Write `ComponentLinkContext.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';

import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import type { ComponentRef } from './view-types';

/**
 * Optional "open in designer" wiring for the read-only inspectors. Absent by
 * default, so the monitoring app and the designer render no link buttons; the
 * instance monitor provides it.
 */
export interface ComponentLinkHandlers {
  /** File behind a reference: a path, `null` when it is not in this workspace, `undefined` while resolving. */
  resolveComponent?: (category: VnextExportCategory, ref: ComponentRef) => string | null | undefined;
  openComponent?: (category: VnextExportCategory, ref: ComponentRef) => void;
  /** Open a script by its `location` as written in the definition. */
  openScript?: (location: string) => void;
}

const ComponentLinkContext = createContext<ComponentLinkHandlers>({});

export function ComponentLinkProvider({ value, children }: { value: ComponentLinkHandlers; children: ReactNode }) {
  return <ComponentLinkContext.Provider value={value}>{children}</ComponentLinkContext.Provider>;
}

export function useComponentLinks(): ComponentLinkHandlers {
  return useContext(ComponentLinkContext);
}
```

- [ ] **Step 4: Link buttons in `PropertyPanelShared.tsx`**

Add imports:

```ts
import { ArrowUpRight } from 'lucide-react';
import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';
import { useComponentLinks } from '../../../readonly/ComponentLinkContext';
```

(merge `ArrowUpRight` into the existing `lucide-react` import.)

Replace `ResourceRef` with:

```tsx
function OpenRefButton({ category, resource }: { category: VnextExportCategory; resource: { key?: string } }) {
  const { resolveComponent, openComponent } = useComponentLinks();
  if (!openComponent || !resource?.key) return null;
  const path = resolveComponent ? resolveComponent(category, resource as { key: string }) : '';
  const disabled = path === null || path === undefined;
  const title =
    path === null ? 'Not in this workspace' : path === undefined ? 'Resolving…' : `Open ${resource.key} in its designer`;
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={() => openComponent(category, resource as { key: string })}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowUpRight size={12} aria-hidden />
      Open
    </button>
  );
}

export function ResourceRef({ resource, category }: { resource: any; category?: VnextExportCategory }) {
  return (
    <div className="space-y-1">
      {category && (
        <div className="flex justify-end">
          <OpenRefButton category={category} resource={resource} />
        </div>
      )}
      <InfoRow label="Key" value={resource.key || '\u2014'} mono copyable />
      <InfoRow label="Domain" value={resource.domain || '\u2014'} mono />
      <InfoRow label="Version" value={resource.version || '\u2014'} mono />
      <InfoRow label="Flow" value={resource.flow || '\u2014'} mono />
    </div>
  );
}
```

In `CodePreview`, read the context at the top (`const { openScript } = useComponentLinks();`) and replace the `{location && (…)}` block with:

```tsx
      {location && (
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground">
          <IconFile />
          <span className="font-mono">{location}</span>
          {openScript && (
            <button
              type="button"
              onClick={() => openScript(location)}
              className="text-secondary-icon hover:text-secondary-foreground ml-auto inline-flex cursor-pointer items-center gap-0.5 font-medium"
              title={`Open ${location}`}
            >
              <ArrowUpRight size={12} aria-hidden />
              Open script
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 5: Pass categories at every read-only call site**

- `StateInspector.tsx` `TaskRefRow`: `<ResourceRef resource={task.ref} category="tasks" />`; views: `<ResourceRef resource={state.view.view} category="views" />` and `<ResourceRef key={i} resource={v.view} category="views" />`; subflow: `<ResourceRef resource={state.subFlowProcess} category="workflows" />`.
- `TransitionFields.tsx`: `ViewBindingRows` → `category="views"`; `TaskRefRow` → `category="tasks"`; schema → `category="schemas"`.
- `WorkflowMetadataInspector.tsx`: change `RefList` to `function RefList({ refs, category }: { refs: ComponentRef[]; category: VnextExportCategory })` rendering `<ResourceRef resource={r} category={category} />`; call sites `<RefList refs={w.functions} category="functions" />`, `<RefList refs={w.extensions} category="extensions" />`; schema `<ResourceRef resource={w.schema} category="schemas" />`. Import `type VnextExportCategory` from `@vnext-forge-studio/app-contracts`.

- [ ] **Step 6: `summary` slot on both inspectors**

`StateInspector.tsx`: add `summary?: ReactNode;` to `StateInspectorProps` (doc: `/** One line of execution context under the header (instance view). */`), destructure it, and after `<HeaderLabels labels={state.labels} />` (still inside the header `div`) add:

```tsx
        {summary && <div className="text-foreground mt-1 text-[11px] font-medium">{summary}</div>}
```

`TransitionInspector.tsx`: add the same prop; render it as the first child of the scrolling body, before the `from …` line:

```tsx
        {summary && <div className="text-foreground text-[11px] font-medium">{summary}</div>}
```

- [ ] **Step 7: Export the context**

Append to `readonly/index.ts`:

```ts
export { ComponentLinkProvider, useComponentLinks, type ComponentLinkHandlers } from './ComponentLinkContext';
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/readonly`
Expected: PASS (new file + existing `StateInspector.vitest.test.tsx`).

- [ ] **Step 9: Typecheck and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build` — expected: success.

```bash
git add packages/designer-ui/src/modules/canvas-interaction
git commit -m "feat(canvas): open-in-designer links and a summary slot in the read-only inspectors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Monitor model — types, path, history graph, drift

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/types.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/model/monitorPath.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/model/historyGraph.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/model/definitionDrift.ts`
- Test: `packages/designer-ui/src/modules/instance-monitor/model/model.vitest.test.ts`

**Interfaces:**
- Consumes: `stateVisitCounts`, `RUNTIME_START_STATE` (Task 1); `HistoryTransition` (`quick-run/types/quickrun.types.ts:338`); `InstanceDetailResponse` (`quick-run/QuickRunApi.ts:241`); `RuntimeErrorLike` (`quick-run/components/RuntimeErrorBanner.tsx:15`); `WorkflowViewModel`, `LabelView` (`canvas-interaction/readonly/view-types.ts`).
- Produces: the types below; `toExecutionOverlay(history, currentState, pathOnly)`, `summarizeState(history, stateKey, currentState)`, `describeStateVisits(summary)`, `describeFirings(count)`, `transitionFirings(history, key)`, `pathSteps(history)`, `pickLabel(labels, fallback)`, `buildHistoryOnlyDefinition(workflowKey, history)`, `artifactVersion(v)`, `definitionDrift(local, instance)`, `diagramPathFor(workflowFilePath)`.

- [ ] **Step 1: Write `types.ts`**

```ts
import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import type { WorkflowViewModel } from '../canvas-interaction/readonly/view-types';
import type { InstanceDetailResponse } from '../quick-run/QuickRunApi';
import type { RuntimeErrorLike } from '../quick-run/components/RuntimeErrorBanner';
import type { HistoryTransition } from '../quick-run/types/quickrun.types';

/** Which instance a monitor shows and where its definition lives. */
export interface MonitorTarget {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** Absolute path of the local workflow JSON. Absent → history-only graph. */
  workflowFilePath?: string;
  /** Project id for component discovery (extension: the workspace folder path). */
  projectId?: string;
  environmentName?: string;
  runtimeUrl?: string;
}

export type DefinitionSource = 'local' | 'history';

export interface MonitorDefinition {
  source: DefinitionSource;
  vm: WorkflowViewModel;
  diagram: Record<string, unknown>;
  /** `version` of the local workflow file, when loaded from disk. */
  localVersion?: string;
}

export interface MonitorLevelData {
  instance: InstanceDetailResponse;
  /** Oldest first. */
  history: HistoryTransition[];
  definition: MonitorDefinition;
  loadedAt: number;
}

export type MonitorSelection = { kind: 'state'; key: string } | { kind: 'transition'; key: string } | null;

export type MonitorLoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; error: RuntimeErrorLike }
  | { kind: 'ready'; data: MonitorLevelData; refreshing: boolean; staleError: RuntimeErrorLike | null };

/** A resolved component reference the host should open in its designer. */
export interface OpenComponentTarget {
  category: VnextExportCategory;
  key: string;
  filePath: string;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// model/model.vitest.test.ts
import { describe, expect, it } from 'vitest';

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { artifactVersion, definitionDrift, diagramPathFor } from './definitionDrift';
import { buildHistoryOnlyDefinition } from './historyGraph';
import {
  describeFirings,
  describeStateVisits,
  pathSteps,
  pickLabel,
  summarizeState,
  toExecutionOverlay,
  transitionFirings,
} from './monitorPath';

const row = (i: number, fromState: string, transitionId: string, toState: string): HistoryTransition => ({
  id: `h${i}`,
  transitionId,
  fromState,
  toState,
  startedAt: `2026-10-06T10:00:0${i}Z`,
  triggerType: 'manual',
  createdAt: `2026-10-06T10:00:0${i}Z`,
});

const HISTORY = [
  row(1, '$start', 'start', 'init'),
  row(2, 'init', 'submit', 'review'),
  row(3, 'review', 'reject', 'init'),
  row(4, 'init', 'submit', 'review'),
];

describe('monitorPath', () => {
  it('turns history into an ordered overlay', () => {
    const o = toExecutionOverlay(HISTORY, 'review', true, { kind: 'state', key: 'init' });
    expect(o.traversedTransitions.map((t) => t.transitionId)).toEqual(['start', 'submit', 'reject', 'submit']);
    expect(o).toMatchObject({ currentState: 'review', pathOnly: true, focus: { kind: 'state', key: 'init' } });
  });

  it('summarizes visits', () => {
    expect(describeStateVisits(summarizeState(HISTORY, 'review', 'review'))).toBe('Visited 2× · now here');
    expect(describeStateVisits(summarizeState(HISTORY, 'done', 'review'))).toBe('Not visited');
    expect(describeStateVisits(summarizeState([], 'init', 'init'))).toBe('Now here');
    expect(describeStateVisits(summarizeState([row(1, '$start', 'start', 'init')], 'init', null))).toBe('Visited once');
  });

  it('counts firings', () => {
    expect(transitionFirings(HISTORY, 'submit')).toHaveLength(2);
    expect(describeFirings(0)).toBe('Not fired');
    expect(describeFirings(1)).toBe('Fired once');
    expect(describeFirings(3)).toBe('Fired 3×');
  });

  it('numbers path steps from 1', () => {
    expect(pathSteps(HISTORY)[3]).toMatchObject({ order: 4, transitionKey: 'submit', fromState: 'init', toState: 'review' });
  });

  it('prefers the en-US label, then the first, then the fallback', () => {
    expect(pickLabel([{ language: 'tr-TR', label: 'Onay' }, { language: 'en-US', label: 'Approve' }], 'k')).toBe('Approve');
    expect(pickLabel([{ language: 'tr-TR', label: 'Onay' }], 'k')).toBe('Onay');
    expect(pickLabel(undefined, 'k')).toBe('k');
  });
});

describe('buildHistoryOnlyDefinition', () => {
  it('draws the states and transitions seen in history', () => {
    const vm = normalizeDefinition(buildHistoryOnlyDefinition('loan', HISTORY));
    expect(vm.states.map((s) => s.key)).toEqual(['init', 'review']);
    expect(vm.states[0].stateType).toBe(1);
    expect(vm.states[0].transitions.map((t) => `${t.key}->${t.target}`)).toEqual(['submit->review']);
    expect(vm.states[1].transitions.map((t) => `${t.key}->${t.target}`)).toEqual(['reject->init']);
  });

  it('falls back to the first fromState as the start when history has no $start row', () => {
    const vm = normalizeDefinition(buildHistoryOnlyDefinition('loan', [row(1, 'a', 'go', 'b')]));
    expect(vm.states.find((s) => s.key === 'a')?.stateType).toBe(1);
  });
});

describe('definitionDrift', () => {
  it('compares artifact versions only', () => {
    expect(artifactVersion('1.2.0-pkg.1.17.0+core')).toBe('1.2.0');
    expect(definitionDrift('1.2.0', '1.2.0-pkg.1.17.0+core')).toBeNull();
    expect(definitionDrift('1.2.0', '1.1.0-pkg.1.16.0+core')).toEqual({ localVersion: '1.2.0', instanceVersion: '1.1.0' });
    expect(definitionDrift(undefined, '1.1.0')).toBeNull();
  });

  it('derives the diagram path next to the workflow', () => {
    expect(diagramPathFor('/ws/core/Workflows/loan/loan-flow.json')).toBe('/ws/core/Workflows/loan/.meta/loan-flow.diagram.json');
    expect(diagramPathFor('C:\\ws\\Workflows\\a.json')).toBe('C:/ws/Workflows/.meta/a.diagram.json');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor/model/model.vitest.test.ts`
Expected: FAIL — cannot resolve `./definitionDrift`.

- [ ] **Step 4: Write `model/monitorPath.ts`**

```ts
import type { ExecutionOverlay } from '../../canvas-interaction/context/CanvasModeContext';
import type { LabelView } from '../../canvas-interaction/readonly/view-types';
import { stateVisitCounts } from '../../canvas-interaction/utils/executionOverlay';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

export function toExecutionOverlay(
  history: readonly HistoryTransition[],
  currentState: string | null,
  pathOnly: boolean,
  focus: ExecutionOverlay['focus'] = null,
): ExecutionOverlay {
  return {
    traversedTransitions: history.map((t) => ({ transitionId: t.transitionId, fromState: t.fromState, toState: t.toState })),
    currentState,
    pathOnly,
    focus,
  };
}

export interface StateVisitSummary {
  visits: number;
  isCurrent: boolean;
}

export function summarizeState(
  history: readonly HistoryTransition[],
  stateKey: string,
  currentState: string | null,
): StateVisitSummary {
  const visits = stateVisitCounts(toExecutionOverlay(history, currentState, false)).get(stateKey) ?? 0;
  return { visits, isCurrent: currentState === stateKey };
}

export function describeStateVisits({ visits, isCurrent }: StateVisitSummary): string {
  if (visits === 0) return isCurrent ? 'Now here' : 'Not visited';
  const base = visits === 1 ? 'Visited once' : `Visited ${visits}×`;
  return isCurrent ? `${base} · now here` : base;
}

export function transitionFirings(history: readonly HistoryTransition[], transitionKey: string): HistoryTransition[] {
  return history.filter((t) => t.transitionId === transitionKey);
}

export function describeFirings(count: number): string {
  if (count === 0) return 'Not fired';
  return count === 1 ? 'Fired once' : `Fired ${count}×`;
}

export interface PathStep {
  order: number;
  transitionKey: string;
  fromState: string;
  toState: string;
  startedAt: string;
}

export function pathSteps(history: readonly HistoryTransition[]): PathStep[] {
  return history.map((t, i) => ({
    order: i + 1,
    transitionKey: t.transitionId,
    fromState: t.fromState,
    toState: t.toState,
    startedAt: t.startedAt,
  }));
}

/** en-US first, then the first label, then the fallback — Quick Run's rule. */
export function pickLabel(labels: readonly LabelView[] | undefined, fallback: string): string {
  if (!labels?.length) return fallback;
  return labels.find((l) => l.language === 'en-US')?.label || labels[0].label || fallback;
}
```

- [ ] **Step 5: Write `model/historyGraph.ts`**

```ts
import { RUNTIME_START_STATE } from '../../canvas-interaction/utils/executionOverlay';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

/**
 * A minimal definition drawn from history alone, for when the local workflow
 * file is missing: every state and transition the instance went through, in
 * the semi-flat shape `toFlowCanvasJson` accepts. The start state is the
 * `$start` row's target, or else the first state the path leaves.
 */
export function buildHistoryOnlyDefinition(
  workflowKey: string,
  history: readonly HistoryTransition[],
): Record<string, unknown> {
  const order: string[] = [];
  const transitions = new Map<string, Map<string, string>>();
  const touch = (state: string) => {
    if (state && state !== RUNTIME_START_STATE && !order.includes(state)) order.push(state);
  };

  for (const t of history) {
    touch(t.fromState);
    touch(t.toState);
    if (t.fromState === RUNTIME_START_STATE) continue;
    const out = transitions.get(t.fromState) ?? new Map<string, string>();
    if (!out.has(t.transitionId)) out.set(t.transitionId, t.toState);
    transitions.set(t.fromState, out);
  }

  const startState =
    history.find((t) => t.fromState === RUNTIME_START_STATE)?.toState ?? history[0]?.fromState ?? order[0];

  return {
    key: workflowKey,
    states: order.map((key) => ({
      key,
      stateType: key === startState ? 1 : 2,
      transitions: [...(transitions.get(key) ?? new Map<string, string>())].map(([tKey, target]) => ({
        key: tKey,
        target,
        triggerType: 0,
      })),
    })),
  };
}
```

- [ ] **Step 6: Write `model/definitionDrift.ts`**

```ts
/** `1.2.0-pkg.1.17.0+core` → `1.2.0`: the artifact part the designer writes. */
export function artifactVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.split('+')[0].split('-pkg.')[0] || undefined;
}

export interface DefinitionDrift {
  localVersion: string;
  instanceVersion: string;
}

/** `null` when either side is unknown or both name the same artifact version. */
export function definitionDrift(localVersion?: string, instanceFlowVersion?: string): DefinitionDrift | null {
  const local = artifactVersion(localVersion);
  const instance = artifactVersion(instanceFlowVersion);
  if (!local || !instance || local === instance) return null;
  return { localVersion: local, instanceVersion: instance };
}

/** `<dir>/<name>.json` → `<dir>/.meta/<name>.diagram.json`, as the flow editor stores it. */
export function diagramPathFor(workflowFilePath: string): string {
  const p = workflowFilePath.replace(/\\/g, '/');
  const slash = p.lastIndexOf('/');
  const dir = slash >= 0 ? p.slice(0, slash) : '';
  const name = (slash >= 0 ? p.slice(slash + 1) : p).replace(/\.json$/i, '');
  return `${dir}/.meta/${name}.diagram.json`;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor/model/model.vitest.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/designer-ui/src/modules/instance-monitor
git commit -m "feat(instance-monitor): path, history graph and drift model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Loading, state and component index

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/data/loadMonitorLevel.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/model/monitorReducer.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/model/componentIndex.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/hooks/useMonitorController.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/hooks/useComponentIndex.ts`
- Test: `packages/designer-ui/src/modules/instance-monitor/data/loadMonitorLevel.vitest.test.ts`
- Test: `packages/designer-ui/src/modules/instance-monitor/model/state.vitest.test.ts`

**Interfaces:**
- Consumes: Task 3 types and model; `QuickRunApi.getInstance` / `getHistory` (`quick-run/QuickRunApi.ts`); `loadFlowEditorDocument` (`flow-editor/FlowEditorApi.ts:44`); `normalizeDefinition` (`canvas-interaction/readonly/normalize.ts`); `summarizeRuntimeError` (`quick-run/components/RuntimeErrorBanner.tsx:118`); `discoverVnextComponentsByCategory` (`vnext-workspace/vnextComponentDiscovery.ts:67`).
- Produces: `loadMonitorLevel(target, headers, loaders?) → Promise<MonitorLoadResult>`; `MonitorLoaders`; `monitorReducer`, `initialMonitorState`, `MonitorState`; `useMonitorController(target, headers) → { load, selection, pathOnly, refresh(), select(selection), setPathOnly(value) }`; `MONITOR_LINK_CATEGORIES`, `buildComponentIndex`, `lookupComponent`, `ComponentIndex`; `useComponentIndex(projectId?) → ComponentIndex`.

- [ ] **Step 1: Write the failing tests**

```ts
// data/loadMonitorLevel.vitest.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { MonitorLoaders } from './loadMonitorLevel';
import { loadMonitorLevel } from './loadMonitorLevel';

const INSTANCE = {
  id: 'i1', key: 'order-1', flow: 'loan', domain: 'core', flowVersion: '1.0.0',
  metadata: { currentState: 'review', effectiveState: 'review', status: 'A', createdAt: '2026-10-06T10:00:00Z' },
};
const HISTORY = { transitions: [{ id: 'h1', transitionId: 'start', fromState: '$start', toState: 'review', startedAt: 'x', triggerType: 'manual', createdAt: 'x' }] };
const WORKFLOW = { key: 'loan', version: '1.0.0', attributes: { states: [{ key: 'review', stateType: 2, transitions: [] }] } };

function loaders(over: Partial<MonitorLoaders> = {}): MonitorLoaders {
  return {
    getInstance: vi.fn(async () => ({ success: true, data: INSTANCE })) as unknown as MonitorLoaders['getInstance'],
    getHistory: vi.fn(async () => ({ success: true, data: HISTORY })) as unknown as MonitorLoaders['getHistory'],
    loadDefinition: vi.fn(async () => ({ success: true, data: { workflow: WORKFLOW, diagram: { nodePos: { review: { x: 1, y: 2 } } } } })) as unknown as MonitorLoaders['loadDefinition'],
    now: () => 42,
    ...over,
  };
}

const TARGET = { domain: 'core', workflowKey: 'loan', instanceId: 'i1', workflowFilePath: '/ws/Workflows/loan.json', runtimeUrl: 'http://localhost:4201' };

describe('loadMonitorLevel', () => {
  it('uses the local definition and its diagram', async () => {
    const l = loaders();
    const r = await loadMonitorLevel(TARGET, { 'x-a': '1' }, l);
    expect(r.ok && r.data.definition.source).toBe('local');
    expect(r.ok && r.data.definition.localVersion).toBe('1.0.0');
    expect(r.ok && r.data.definition.diagram).toEqual({ nodePos: { review: { x: 1, y: 2 } } });
    expect(l.loadDefinition).toHaveBeenCalledWith({ workflowFilePath: '/ws/Workflows/loan.json', diagramFilePath: '/ws/Workflows/.meta/loan.diagram.json' });
    expect(l.getInstance).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'i1', headers: { 'x-a': '1' }, runtimeUrl: 'http://localhost:4201' }));
    expect(r.ok && r.data.loadedAt).toBe(42);
  });

  it('falls back to the history-only graph when the local file cannot be read', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      loadDefinition: vi.fn(async () => ({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'nope', traceId: 't' } })) as unknown as MonitorLoaders['loadDefinition'],
    }));
    expect(r.ok && r.data.definition.source).toBe('history');
    expect(r.ok && r.data.definition.vm.states.map((s) => s.key)).toEqual(['review']);
  });

  it('skips the file read without a workflow path', async () => {
    const l = loaders();
    const r = await loadMonitorLevel({ ...TARGET, workflowFilePath: undefined }, {}, l);
    expect(l.loadDefinition).not.toHaveBeenCalled();
    expect(r.ok && r.data.definition.source).toBe('history');
  });

  it('reports a 404 instance as not found', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      getInstance: vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_PROXY_ERROR', message: 'Not found', traceId: 't', details: { httpStatus: 404 } } })) as unknown as MonitorLoaders['getInstance'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: true });
  });

  it('reports other failures as errors', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      getHistory: vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_UNREACHABLE', message: 'down', traceId: 't' } })) as unknown as MonitorLoaders['getHistory'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: false, error: { message: 'down' } });
  });
});
```

```ts
// model/state.vitest.test.ts
import { describe, expect, it } from 'vitest';

import type { MonitorLevelData } from '../types';
import { buildComponentIndex, lookupComponent } from './componentIndex';
import { initialMonitorState, monitorReducer } from './monitorReducer';

const DATA = { loadedAt: 1 } as MonitorLevelData;
const ERR = { code: 'X', message: 'down' };

describe('monitorReducer', () => {
  it('goes ready on a successful load', () => {
    const s = monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: true, data: DATA } });
    expect(s.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: null });
  });

  it('keeps the data and flags it stale when a refresh fails', () => {
    const ready = monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: true, data: DATA } });
    const refreshing = monitorReducer(ready, { type: 'refresh-start' });
    expect(refreshing.load).toMatchObject({ kind: 'ready', refreshing: true });
    const failed = monitorReducer(refreshing, { type: 'load-done', result: { ok: false, notFound: false, error: ERR } });
    expect(failed.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: ERR });
  });

  it('maps a first-load failure to not-found or error', () => {
    expect(monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: false, notFound: true, error: ERR } }).load).toEqual({ kind: 'not-found' });
    expect(monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: false, notFound: false, error: ERR } }).load).toEqual({ kind: 'error', error: ERR });
  });

  it('clears the selection on a new target, keeps it on refresh', () => {
    const selected = monitorReducer(initialMonitorState, { type: 'select', selection: { kind: 'state', key: 'a' } });
    expect(monitorReducer(selected, { type: 'refresh-start' }).selection).toEqual({ kind: 'state', key: 'a' });
    expect(monitorReducer(selected, { type: 'load-start' }).selection).toBeNull();
  });

  it('toggles path-only', () => {
    expect(monitorReducer(initialMonitorState, { type: 'path-only', value: true }).pathOnly).toBe(true);
  });
});

describe('componentIndex', () => {
  const index = buildComponentIndex([
    ['views', [{ key: 'approve-view', path: '/ws/Views/approve-view.json', flow: 'sys-views' }]],
    ['tasks', []],
  ]);
  it('finds a file by category and key', () => {
    expect(lookupComponent(index, 'views', 'approve-view')).toBe('/ws/Views/approve-view.json');
  });
  it('says null for a loaded category without the key, undefined for an unloaded one', () => {
    expect(lookupComponent(index, 'tasks', 'missing')).toBeNull();
    expect(lookupComponent(index, 'schemas', 'any')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor`
Expected: FAIL — cannot resolve `./loadMonitorLevel`, `./componentIndex`, `./monitorReducer`.

- [ ] **Step 3: Write `data/loadMonitorLevel.ts`**

```ts
import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import { loadFlowEditorDocument, type LoadFlowEditorResult } from '../../flow-editor/FlowEditorApi';
import * as QuickRunApi from '../../quick-run/QuickRunApi';
import { summarizeRuntimeError, type RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { diagramPathFor } from '../model/definitionDrift';
import { buildHistoryOnlyDefinition } from '../model/historyGraph';
import type { MonitorDefinition, MonitorLevelData, MonitorTarget } from '../types';

/** Injected so the loader can be tested without a transport. */
export interface MonitorLoaders {
  getInstance: typeof QuickRunApi.getInstance;
  getHistory: typeof QuickRunApi.getHistory;
  loadDefinition: typeof loadFlowEditorDocument;
  now: () => number;
}

export const defaultMonitorLoaders: MonitorLoaders = {
  getInstance: QuickRunApi.getInstance,
  getHistory: QuickRunApi.getHistory,
  loadDefinition: loadFlowEditorDocument,
  now: () => Date.now(),
};

export type MonitorLoadResult =
  | { ok: true; data: MonitorLevelData }
  | { ok: false; notFound: boolean; error: RuntimeErrorLike };

/**
 * Loads one monitor level: the instance, its transition history and its
 * definition, in parallel. Read-only — the diagram file is read, never created.
 */
export async function loadMonitorLevel(
  target: MonitorTarget,
  headers: Record<string, string>,
  loaders: MonitorLoaders = defaultMonitorLoaders,
): Promise<MonitorLoadResult> {
  const scope = {
    domain: target.domain,
    workflowKey: target.workflowKey,
    instanceId: target.instanceId,
    headers,
    ...(target.runtimeUrl ? { runtimeUrl: target.runtimeUrl } : {}),
  };

  const [instanceRes, historyRes, definitionRes] = await Promise.all([
    loaders.getInstance(scope),
    loaders.getHistory(scope),
    target.workflowFilePath
      ? loaders.loadDefinition({
          workflowFilePath: target.workflowFilePath,
          diagramFilePath: diagramPathFor(target.workflowFilePath),
        })
      : Promise.resolve(null),
  ]);

  if (!instanceRes.success) {
    return {
      ok: false,
      notFound: summarizeRuntimeError(instanceRes.error).httpStatus === 404,
      error: instanceRes.error,
    };
  }
  if (!historyRes.success) return { ok: false, notFound: false, error: historyRes.error };

  const history = historyRes.data.transitions ?? [];
  return {
    ok: true,
    data: {
      instance: instanceRes.data,
      history,
      definition: toDefinition(target.workflowKey, history, definitionRes),
      loadedAt: loaders.now(),
    },
  };
}

function toDefinition(
  workflowKey: string,
  history: HistoryTransition[],
  res: ApiResponse<LoadFlowEditorResult> | null,
): MonitorDefinition {
  if (res?.success) {
    const version = res.data.workflow.version;
    return {
      source: 'local',
      vm: normalizeDefinition(res.data.workflow),
      diagram: res.data.diagram,
      ...(typeof version === 'string' ? { localVersion: version } : {}),
    };
  }
  return {
    source: 'history',
    vm: normalizeDefinition(buildHistoryOnlyDefinition(workflowKey, history)),
    diagram: { nodePos: {} },
  };
}
```

If `getInstance`'s params type is not exported or differs from `scope`, keep the object literal and let TypeScript check it against `Parameters<typeof QuickRunApi.getInstance>[0]` — both take `domain, workflowKey, instanceId, headers?, runtimeUrl?`.

- [ ] **Step 4: Write `model/monitorReducer.ts`**

```ts
import type { MonitorLoadResult } from '../data/loadMonitorLevel';
import type { MonitorLoadState, MonitorSelection } from '../types';

export interface MonitorState {
  load: MonitorLoadState;
  selection: MonitorSelection;
  pathOnly: boolean;
}

export const initialMonitorState: MonitorState = { load: { kind: 'loading' }, selection: null, pathOnly: false };

export type MonitorAction =
  | { type: 'load-start' }
  | { type: 'refresh-start' }
  | { type: 'load-done'; result: MonitorLoadResult }
  | { type: 'select'; selection: MonitorSelection }
  | { type: 'path-only'; value: boolean };

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case 'load-start':
      return { ...state, load: { kind: 'loading' }, selection: null };
    case 'refresh-start':
      return state.load.kind === 'ready'
        ? { ...state, load: { ...state.load, refreshing: true } }
        : { ...state, load: { kind: 'loading' } };
    case 'load-done': {
      const r = action.result;
      if (r.ok) return { ...state, load: { kind: 'ready', data: r.data, refreshing: false, staleError: null } };
      if (state.load.kind === 'ready') return { ...state, load: { ...state.load, refreshing: false, staleError: r.error } };
      return { ...state, load: r.notFound ? { kind: 'not-found' } : { kind: 'error', error: r.error } };
    }
    case 'select':
      return { ...state, selection: action.selection };
    case 'path-only':
      return { ...state, pathOnly: action.value };
  }
}
```

- [ ] **Step 5: Write `model/componentIndex.ts`**

```ts
import type { DiscoveredVnextComponent, VnextExportCategory } from '@vnext-forge-studio/app-contracts';

/** Categories a monitor reference can point at. */
export const MONITOR_LINK_CATEGORIES = [
  'workflows',
  'tasks',
  'views',
  'schemas',
  'functions',
  'extensions',
] as const satisfies readonly VnextExportCategory[];

export type ComponentIndex = Partial<Record<VnextExportCategory, ReadonlyMap<string, string>>>;

/** key → file path per category; the first file wins, as in `useWorkflowFileResolver`. */
export function buildComponentIndex(
  entries: ReadonlyArray<readonly [VnextExportCategory, readonly DiscoveredVnextComponent[]]>,
): ComponentIndex {
  const index: ComponentIndex = {};
  for (const [category, components] of entries) {
    const byKey = new Map<string, string>();
    for (const c of components) if (!byKey.has(c.key)) byKey.set(c.key, c.path);
    index[category] = byKey;
  }
  return index;
}

/** A path; `null` when the category is loaded without that key; `undefined` while it is still loading. */
export function lookupComponent(index: ComponentIndex, category: VnextExportCategory, key: string): string | null | undefined {
  const byKey = index[category];
  if (!byKey) return undefined;
  return byKey.get(key) ?? null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor`
Expected: PASS.

- [ ] **Step 7: Write the hooks**

`hooks/useMonitorController.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { defaultMonitorLoaders, loadMonitorLevel, type MonitorLoaders } from '../data/loadMonitorLevel';
import { initialMonitorState, monitorReducer } from '../model/monitorReducer';
import type { MonitorSelection, MonitorTarget } from '../types';

/** Load / refresh / selection state for one mounted monitor. */
export function useMonitorController(
  target: MonitorTarget,
  headers: Record<string, string>,
  loaders: MonitorLoaders = defaultMonitorLoaders,
) {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const targetRef = useRef(target);
  targetRef.current = target;
  const seq = useRef(0);

  const targetKey = [target.domain, target.workflowKey, target.instanceId, target.workflowFilePath ?? '', target.runtimeUrl ?? ''].join('|');

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++seq.current;
      dispatch({ type: mode === 'initial' ? 'load-start' : 'refresh-start' });
      const result = await loadMonitorLevel(targetRef.current, headersRef.current, loaders);
      if (id === seq.current) dispatch({ type: 'load-done', result });
    },
    [loaders],
  );

  useEffect(() => {
    void run('initial');
  }, [run, targetKey]);

  return {
    load: state.load,
    selection: state.selection,
    pathOnly: state.pathOnly,
    refresh: useCallback(() => void run('refresh'), [run]),
    select: useCallback((selection: MonitorSelection) => dispatch({ type: 'select', selection }), []),
    setPathOnly: useCallback((value: boolean) => dispatch({ type: 'path-only', value }), []),
  };
}
```

`hooks/useComponentIndex.ts`:

```ts
import { useEffect, useState } from 'react';

import type { DiscoveredVnextComponent, VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import { createLogger } from '../../../lib/logger/createLogger';
import { discoverVnextComponentsByCategory } from '../../vnext-workspace/vnextComponentDiscovery';
import { buildComponentIndex, MONITOR_LINK_CATEGORIES, type ComponentIndex } from '../model/componentIndex';

const logger = createLogger('instance-monitor/useComponentIndex');

/**
 * Discovers every linkable component of the project once. A category that
 * fails to load is indexed empty, so its links read "Not in this workspace"
 * instead of spinning forever.
 */
export function useComponentIndex(projectId: string | undefined): ComponentIndex {
  const [index, setIndex] = useState<ComponentIndex>({});

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void Promise.all(
      MONITOR_LINK_CATEGORIES.map(async (category): Promise<readonly [VnextExportCategory, DiscoveredVnextComponent[]]> => {
        try {
          return [category, await discoverVnextComponentsByCategory(projectId, category)];
        } catch (err) {
          logger.warn(`Component discovery failed for ${category}`, err);
          return [category, []];
        }
      }),
    ).then((entries) => {
      if (!cancelled) setIndex(buildComponentIndex(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return index;
}
```

Check the logger path with `command grep -rn "export function createLogger" packages/designer-ui/src/lib` and adjust the import if it differs (FlowEditorApi imports it as `../../lib/logger/createLogger`).

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build` — expected: success.

```bash
git add packages/designer-ui/src/modules/instance-monitor
git commit -m "feat(instance-monitor): level loader, monitor state and component index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Monitor UI — canvas, timeline, inspector, Instance tab, shell

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/components/MonitorCanvas.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/PathTimeline.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/MonitorInspector.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/InstanceTab.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/MonitorShell.tsx`
- Create: `packages/designer-ui/src/modules/instance-monitor/index.ts`
- Modify: `packages/designer-ui/package.json` (`exports`)
- Test: `packages/designer-ui/src/modules/instance-monitor/components/components.vitest.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–4; `FlowCanvas` (`canvas-interaction/FlowCanvas.tsx`), `StateInspector` / `TransitionInspector` with `summary` (Task 2), `ComponentLinkProvider` (Task 2), `findState` / `findTransition` (`readonly/normalize.ts`), `DetailsBody`, `DetailsList` (`quick-run/components/panel-kit`), `RuntimeErrorBanner`, `StatusBadge` (`quick-run/components`), `resolveWorkflowScriptAbsolutePath` (`code-editor/createWorkflowScriptFile.ts:47`).
- Produces: `MonitorShell(props: MonitorShellProps)`; `MonitorShellProps { target; headers?; onOpenComponent?(t: OpenComponentTarget); onOpenScript?(absolutePath: string); onOpenQuickRun?(); onOpenFlowDesigner?() }`; barrel `@vnext-forge-studio/designer-ui/monitor` exporting `MonitorShell`, `MonitorShellProps`, `MonitorTarget`, `OpenComponentTarget`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/components.vitest.test.tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./MonitorCanvas', () => ({ MonitorCanvas: () => h('div', { 'data-testid': 'canvas' }, 'canvas') }));

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import type { MonitorLevelData } from '../types';
import { InstanceTab } from './InstanceTab';
import { MonitorInspector } from './MonitorInspector';
import { MonitorShellView } from './MonitorShell';
import { PathTimeline } from './PathTimeline';

const row = (i: number, fromState: string, transitionId: string, toState: string): HistoryTransition => ({
  id: `h${i}`, transitionId, fromState, toState, startedAt: `2026-10-06T10:00:0${i}Z`, triggerType: 'manual', createdAt: 'x',
});
const HISTORY = [row(1, '$start', 'start', 'init'), row(2, 'init', 'submit', 'review'), row(3, 'review', 'reject', 'init'), row(4, 'init', 'submit', 'review')];
const VM = normalizeDefinition({
  key: 'loan',
  version: '1.2.0',
  attributes: {
    states: [
      { key: 'init', stateType: 1, transitions: [{ key: 'submit', target: 'review', labels: [{ language: 'en-US', label: 'Submit' }] }] },
      { key: 'review', stateType: 2, transitions: [{ key: 'reject', target: 'init' }] },
    ],
  },
});
const INSTANCE = {
  id: 'i1', key: 'order-4711', flow: 'loan', domain: 'core', flowVersion: '1.1.0-pkg.1.0.0+core', tags: ['vip'],
  metadata: { currentState: 'review', effectiveState: 'kyc-sub', status: 'A', createdAt: '2026-10-06T10:00:00Z', createdBy: 'tester' },
} as MonitorLevelData['instance'];
const DATA: MonitorLevelData = {
  instance: INSTANCE, history: HISTORY, loadedAt: 1,
  definition: { source: 'local', vm: VM, diagram: { nodePos: {} }, localVersion: '1.2.0' },
};
const TARGET = { domain: 'core', workflowKey: 'loan', instanceId: 'i1', environmentName: 'Local' };

describe('PathTimeline', () => {
  it('lists the path in order with labels', () => {
    const html = renderToStaticMarkup(h(PathTimeline, { history: HISTORY, vm: VM, selectedKey: 'submit', onSelect: () => {} }));
    expect(html).toContain('4 transitions');
    expect(html).toContain('Submit');
    expect(html).toContain('aria-pressed="true"');
  });
  it('says when nothing happened yet', () => {
    expect(renderToStaticMarkup(h(PathTimeline, { history: [], vm: VM, selectedKey: null, onSelect: () => {} }))).toContain('No transitions yet');
  });
});

describe('MonitorInspector', () => {
  it('prompts for a selection', () => {
    expect(renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: null, onClose: () => {} }))).toContain('Select a state or transition');
  });
  it('shows a state with its visit summary', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: { kind: 'state', key: 'review' }, onClose: () => {} }));
    expect(html).toContain('Visited 2× · now here');
  });
  it('shows a transition with its firing count', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: { kind: 'transition', key: 'submit' }, onClose: () => {} }));
    expect(html).toContain('Fired 2×');
  });
  it('explains a key missing from the definition', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: null, selection: { kind: 'state', key: 'ghost' }, onClose: () => {} }));
    expect(html).toContain('not in the local definition');
  });
});

describe('InstanceTab', () => {
  it('shows identity, drift and the subflow note', () => {
    const html = renderToStaticMarkup(h(InstanceTab, { instance: INSTANCE, localVersion: '1.2.0', environmentName: 'Local' }));
    for (const text of ['order-4711', 'i1', 'core/loan', '1.1.0', 'local 1.2.0', 'inside a subflow', 'vip', 'tester', 'Local']) {
      expect(html).toContain(text);
    }
  });
});

describe('MonitorShellView', () => {
  const base = { target: TARGET, selection: null, pathOnly: false, onRefresh: () => {}, onSelect: () => {}, onPathOnly: () => {}, links: {} };
  it('shows loading', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'loading' } }))).toContain('Loading instance');
  });
  it('shows not found with the environment', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'not-found' } }))).toContain('Instance not found in Local');
  });
  it('shows a load error', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'error', error: { code: 'X', message: 'Runtime down' } } }))).toContain('Runtime down');
  });
  it('renders the ready layout with drift, stale and history-only notices', () => {
    const html = renderToStaticMarkup(h(MonitorShellView, {
      ...base,
      load: { kind: 'ready', data: { ...DATA, definition: { ...DATA.definition } }, refreshing: false, staleError: { code: 'X', message: 'down' } },
    }));
    for (const text of ['order-4711', 'canvas', 'Local definition 1.2.0', 'instance 1.1.0', 'Stale', 'Inspector', 'Instance', 'Path only']) {
      expect(html).toContain(text);
    }
    const historyOnly = renderToStaticMarkup(h(MonitorShellView, {
      ...base,
      load: { kind: 'ready', data: { ...DATA, definition: { ...DATA.definition, source: 'history', localVersion: undefined } }, refreshing: false, staleError: null },
    }));
    expect(historyOnly).toContain('Local definition not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor/components`
Expected: FAIL — cannot resolve `./InstanceTab`.

- [ ] **Step 3: Write `MonitorCanvas.tsx`**

```tsx
import { useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { FlowCanvas } from '../../canvas-interaction/FlowCanvas';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { toExecutionOverlay } from '../model/monitorPath';
import type { MonitorSelection } from '../types';

export interface MonitorCanvasProps {
  vm: WorkflowViewModel;
  diagram: Record<string, unknown>;
  history: readonly HistoryTransition[];
  currentState: string | null;
  pathOnly: boolean;
  /** Shared selection — spotlighted on the canvas when it came from elsewhere. */
  selection: MonitorSelection;
  onSelect: (selection: MonitorSelection) => void;
}

/** The flow in `instance-view`: the path on top of the local (or history-only) definition. */
export function MonitorCanvas({ vm, diagram, history, currentState, pathOnly, selection, onSelect }: MonitorCanvasProps) {
  const overlay = useMemo(
    () => toExecutionOverlay(history, currentState, pathOnly, selection),
    [history, currentState, pathOnly, selection],
  );
  return (
    <ReactFlowProvider>
      <FlowCanvas
        workflowJson={vm.workflowJson}
        diagramJson={diagram}
        mode="instance-view"
        executionOverlay={overlay}
        onNodeSelect={(key) => onSelect(key && key !== '__start__' ? { kind: 'state', key } : null)}
        onEdgeSelect={(key) => onSelect(key ? { kind: 'transition', key } : null)}
      />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 4: Write `PathTimeline.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { findTransition } from '../../canvas-interaction/readonly/normalize';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { pathSteps, pickLabel } from '../model/monitorPath';
import type { MonitorSelection } from '../types';

export interface PathTimelineProps {
  history: readonly HistoryTransition[];
  vm: WorkflowViewModel;
  selectedKey: string | null;
  onSelect: (selection: MonitorSelection) => void;
}

/** The path as chips, oldest first; a chip selects its transition on the canvas. */
export function PathTimeline({ history, vm, selectedKey, onSelect }: PathTimelineProps) {
  const [open, setOpen] = useState(true);
  const steps = pathSteps(history);
  return (
    <section className="border-t border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-[11px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1 text-[var(--vscode-descriptionForeground,#9d9d9d)]"
      >
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        Path · {steps.length} {steps.length === 1 ? 'transition' : 'transitions'}
      </button>
      {open && (
        <ol className="mt-1 flex max-h-20 flex-wrap items-center gap-1 overflow-y-auto">
          {steps.length === 0 ? (
            <li className="text-[var(--vscode-descriptionForeground,#9d9d9d)]">No transitions yet</li>
          ) : (
            steps.map((s) => {
              const label = pickLabel(findTransition(vm, s.transitionKey)?.labels, s.transitionKey);
              const selected = selectedKey === s.transitionKey;
              return (
                <li key={s.order}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect({ kind: 'transition', key: s.transitionKey })}
                    title={`${s.fromState} → ${s.toState} · ${new Date(s.startedAt).toLocaleTimeString()}`}
                    className={`flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 ${
                      selected
                        ? 'border-[var(--vscode-focusBorder,#007fd4)] bg-[var(--vscode-list-activeSelectionBackground,#04395e)]'
                        : 'border-[var(--vscode-panel-border,#3c3c3c)] hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]'
                    }`}
                  >
                    <span className="tabular-nums opacity-70">{s.order}</span>
                    <span>{label}</span>
                    <span className="text-[var(--vscode-descriptionForeground,#9d9d9d)]">→ {s.toState}</span>
                  </button>
                </li>
              );
            })
          )}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Write `MonitorInspector.tsx`**

```tsx
import { findState, findTransition } from '../../canvas-interaction/readonly/normalize';
import { StateInspector } from '../../canvas-interaction/readonly/StateInspector';
import { TransitionInspector } from '../../canvas-interaction/readonly/TransitionInspector';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { describeFirings, describeStateVisits, summarizeState, transitionFirings } from '../model/monitorPath';
import type { MonitorSelection } from '../types';

export interface MonitorInspectorProps {
  vm: WorkflowViewModel;
  history: readonly HistoryTransition[];
  currentState: string | null;
  selection: MonitorSelection;
  onClose: () => void;
}

const hint = (text: string) => (
  <p className="px-3 py-8 text-center text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)]">{text}</p>
);

/** Definition layer of the selected element, with one line of execution context. */
export function MonitorInspector({ vm, history, currentState, selection, onClose }: MonitorInspectorProps) {
  if (!selection) return hint('Select a state or transition on the canvas or in the path.');

  if (selection.kind === 'state') {
    const state = findState(vm, selection.key);
    if (!state) return hint(`State ${selection.key} is not in the local definition.`);
    return (
      <StateInspector
        state={state}
        onClose={onClose}
        summary={describeStateVisits(summarizeState(history, state.key, currentState))}
      />
    );
  }

  const transition = findTransition(vm, selection.key);
  if (!transition) return hint(`Transition ${selection.key} is not in the local definition.`);
  return (
    <TransitionInspector
      transition={transition}
      onClose={onClose}
      summary={describeFirings(transitionFirings(history, selection.key).length)}
    />
  );
}
```

- [ ] **Step 6: Write `InstanceTab.tsx`**

```tsx
import type { ReactNode } from 'react';

import type { InstanceDetailResponse } from '../../quick-run/QuickRunApi';
import { DetailsList } from '../../quick-run/components/panel-kit';
import { artifactVersion, definitionDrift } from '../model/definitionDrift';

export interface InstanceTabProps {
  instance: InstanceDetailResponse;
  localVersion?: string;
  environmentName?: string;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground,#9d9d9d)]">{title}</h3>
      {children}
    </section>
  );
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : undefined);

/** Instance metadata, grouped. Read-only; actions only navigate. */
export function InstanceTab({ instance, localVersion, environmentName, onOpenQuickRun, onOpenFlowDesigner }: InstanceTabProps) {
  const m = instance.metadata;
  const drift = definitionDrift(localVersion, instance.flowVersion);
  const version = artifactVersion(instance.flowVersion) ?? instance.flowVersion ?? '—';
  return (
    <div className="flex flex-col gap-3 p-3 text-[11px]">
      <Group title="Identity">
        <DetailsList
          rows={[
            { label: 'Key', value: instance.key, copy: instance.key, mono: true },
            { label: 'Id', value: instance.id, copy: instance.id, mono: true },
            { label: 'Flow', value: `${instance.domain}/${instance.flow}` },
            { label: 'Flow version', value: drift ? `${version} (local ${drift.localVersion})` : version },
            !!environmentName && { label: 'Environment', value: environmentName },
            !!instance.tags?.length && { label: 'Tags', value: instance.tags.join(', ') },
          ]}
        />
      </Group>
      <Group title="Status">
        <DetailsList
          rows={[
            { label: 'Status', value: m.status },
            !!m.effectiveStatus && m.effectiveStatus !== m.status && { label: 'Effective status', value: m.effectiveStatus },
            { label: 'Current state', value: m.currentState, mono: true },
            !!m.effectiveState && m.effectiveState !== m.currentState && {
              label: 'Effective state',
              value: `${m.effectiveState} (inside a subflow)`,
              mono: true,
            },
            !!m.currentStateType && {
              label: 'State type',
              value: m.currentStateSubType ? `${m.currentStateType} · ${m.currentStateSubType}` : m.currentStateType,
            },
            !!m.stage && { label: 'Stage', value: m.stage },
          ]}
        />
      </Group>
      <Group title="Timing">
        <DetailsList
          rows={[
            { label: 'Created', value: when(m.createdAt) ?? '—' },
            !!m.modifiedAt && { label: 'Modified', value: when(m.modifiedAt) },
          ]}
        />
      </Group>
      <Group title="Who">
        <DetailsList
          rows={[
            !!m.createdBy && { label: 'Created by', value: m.createdBy },
            !!m.createdByBehalfOf && { label: 'On behalf of', value: m.createdByBehalfOf },
            !!m.modifiedBy && { label: 'Modified by', value: m.modifiedBy },
            !!m.modifiedByBehalfOf && { label: 'Modified on behalf of', value: m.modifiedByBehalfOf },
          ]}
        />
      </Group>
      {(onOpenQuickRun || onOpenFlowDesigner) && (
        <div className="flex flex-wrap gap-2">
          {onOpenQuickRun && (
            <button type="button" onClick={onOpenQuickRun} className="cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]">
              Open in Quick Run
            </button>
          )}
          {onOpenFlowDesigner && (
            <button type="button" onClick={onOpenFlowDesigner} className="cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]">
              Open flow in designer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `MonitorShell.tsx`**

```tsx
import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import { ComponentLinkProvider, type ComponentLinkHandlers } from '../../canvas-interaction/readonly/ComponentLinkContext';
import { resolveWorkflowScriptAbsolutePath } from '../../code-editor/createWorkflowScriptFile';
import { DetailsBody } from '../../quick-run/components/panel-kit';
import { RuntimeErrorBanner } from '../../quick-run/components/RuntimeErrorBanner';
import { StatusBadge } from '../../quick-run/components/StatusBadge';
import type { InstanceStatus } from '../../quick-run/types/quickrun.types';
import { useComponentIndex } from '../hooks/useComponentIndex';
import { useMonitorController } from '../hooks/useMonitorController';
import { lookupComponent } from '../model/componentIndex';
import { definitionDrift } from '../model/definitionDrift';
import type { MonitorLoadState, MonitorSelection, MonitorTarget, OpenComponentTarget } from '../types';
import { InstanceTab } from './InstanceTab';
import { MonitorCanvas } from './MonitorCanvas';
import { MonitorInspector } from './MonitorInspector';
import { PathTimeline } from './PathTimeline';

export interface MonitorShellProps {
  target: MonitorTarget;
  headers?: Record<string, string>;
  onOpenComponent?: (target: OpenComponentTarget) => void;
  /** Absolute path of a script file to open in the editor. */
  onOpenScript?: (absolutePath: string) => void;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

const EMPTY_HEADERS: Record<string, string> = {};

/** Wires loading and component links, then renders `MonitorShellView`. */
export function MonitorShell({ target, headers = EMPTY_HEADERS, onOpenComponent, onOpenScript, onOpenQuickRun, onOpenFlowDesigner }: MonitorShellProps) {
  const controller = useMonitorController(target, headers);
  const index = useComponentIndex(target.projectId);

  const links = useMemo<ComponentLinkHandlers>(() => {
    const handlers: ComponentLinkHandlers = {};
    if (onOpenComponent) {
      handlers.resolveComponent = (category, ref) => lookupComponent(index, category, ref.key);
      handlers.openComponent = (category, ref) => {
        const filePath = lookupComponent(index, category, ref.key);
        if (filePath) onOpenComponent({ category, key: ref.key, filePath });
      };
    }
    if (onOpenScript && target.workflowFilePath) {
      const dir = target.workflowFilePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
      handlers.openScript = (location) => onOpenScript(resolveWorkflowScriptAbsolutePath(dir, location));
    }
    return handlers;
  }, [index, onOpenComponent, onOpenScript, target.workflowFilePath]);

  return (
    <MonitorShellView
      target={target}
      load={controller.load}
      selection={controller.selection}
      pathOnly={controller.pathOnly}
      onRefresh={controller.refresh}
      onSelect={controller.select}
      onPathOnly={controller.setPathOnly}
      links={links}
      {...(onOpenQuickRun ? { onOpenQuickRun } : {})}
      {...(onOpenFlowDesigner ? { onOpenFlowDesigner } : {})}
    />
  );
}

export interface MonitorShellViewProps {
  target: MonitorTarget;
  load: MonitorLoadState;
  selection: MonitorSelection;
  pathOnly: boolean;
  onRefresh: () => void;
  onSelect: (selection: MonitorSelection) => void;
  onPathOnly: (value: boolean) => void;
  links: ComponentLinkHandlers;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Props-only layout so the SSR tests can render every state. */
export function MonitorShellView(props: MonitorShellViewProps) {
  const { target, load, selection, pathOnly, onRefresh, onSelect, onPathOnly, links } = props;

  if (load.kind === 'loading') {
    return <p className={`py-12 text-center text-xs ${muted}`}>Loading instance…</p>;
  }
  if (load.kind === 'not-found') {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-xs">
        <p>Instance not found in {target.environmentName ?? 'this environment'}.</p>
        {props.onOpenQuickRun && (
          <button type="button" onClick={props.onOpenQuickRun} className="cursor-pointer underline">
            Back to Quick Run
          </button>
        )}
      </div>
    );
  }
  if (load.kind === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <RuntimeErrorBanner title="Could not load the instance" error={load.error} />
        <button type="button" onClick={onRefresh} className="mx-2 cursor-pointer self-start rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-xs">
          Retry
        </button>
      </div>
    );
  }

  const { data, refreshing, staleError } = load;
  const { instance, history, definition } = data;
  const currentState = instance.metadata.currentState || null;
  const drift = definition.source === 'local' ? definitionDrift(definition.localVersion, instance.flowVersion) : null;
  const status = (instance.metadata.effectiveStatus ?? instance.metadata.status) as InstanceStatus;

  return (
    <ComponentLinkProvider value={links}>
      <div className="flex h-full min-h-0 flex-col text-[var(--vscode-foreground,#cccccc)]">
        <header className="flex items-center gap-2 border-b border-[var(--vscode-panel-border,#3c3c3c)] px-3 py-1.5 text-xs">
          <span className="truncate font-semibold">
            {target.workflowKey} · <span className="font-mono">{instance.key}</span>
          </span>
          <StatusBadge status={status} />
          <span className={`truncate ${muted}`}>{currentState}</span>
          <span className="ml-auto flex items-center gap-2">
            {staleError && (
              <span className="rounded bg-[var(--vscode-inputValidation-warningBackground,#352a05)] px-1.5 text-[10px]" title={staleError.message}>
                Stale
              </span>
            )}
            <span className={`text-[10px] ${muted}`}>Updated {new Date(data.loadedAt).toLocaleTimeString()}</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              title="Refresh"
              className="cursor-pointer rounded p-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)] disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            </button>
          </span>
        </header>

        {drift && (
          <p role="status" className="border-b border-[var(--vscode-panel-border,#3c3c3c)] bg-[var(--vscode-inputValidation-warningBackground,#352a05)] px-3 py-1 text-[11px]">
            Local definition {drift.localVersion} ≠ instance {drift.instanceVersion} — the canvas may differ from what ran.
          </p>
        )}
        {definition.source === 'history' && (
          <p role="status" className={`border-b border-[var(--vscode-panel-border,#3c3c3c)] px-3 py-1 text-[11px] ${muted}`}>
            Local definition not found — showing only the states and transitions this instance went through.
          </p>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          <div className="relative min-h-0">
            <MonitorCanvas
              vm={definition.vm}
              diagram={definition.diagram}
              history={history}
              currentState={currentState}
              pathOnly={pathOnly}
              selection={selection}
              onSelect={onSelect}
            />
            <label className="absolute left-2 top-2 z-10 flex cursor-pointer items-center gap-1 rounded bg-[var(--vscode-editor-background,#1e1e1e)] px-2 py-1 text-[11px] shadow">
              <input type="checkbox" checked={pathOnly} onChange={(e) => onPathOnly(e.target.checked)} className="cursor-pointer" />
              Path only
            </label>
          </div>
          <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-[var(--vscode-panel-border,#3c3c3c)] text-[11px]">
            <DetailsBody
              key={selection ? `${selection.kind}:${selection.key}` : 'none'}
              initialTab={selection ? 'inspector' : 'instance'}
              tabs={[
                {
                  id: 'inspector',
                  label: 'Inspector',
                  render: () => (
                    <MonitorInspector
                      vm={definition.vm}
                      history={history}
                      currentState={currentState}
                      selection={selection}
                      onClose={() => onSelect(null)}
                    />
                  ),
                },
                {
                  id: 'instance',
                  label: 'Instance',
                  render: () => (
                    <InstanceTab
                      instance={instance}
                      {...(definition.localVersion ? { localVersion: definition.localVersion } : {})}
                      {...(target.environmentName ? { environmentName: target.environmentName } : {})}
                      {...(props.onOpenQuickRun ? { onOpenQuickRun: props.onOpenQuickRun } : {})}
                      {...(props.onOpenFlowDesigner ? { onOpenFlowDesigner: props.onOpenFlowDesigner } : {})}
                    />
                  ),
                },
              ]}
            />
          </aside>
        </div>

        <PathTimeline
          history={history}
          vm={definition.vm}
          selectedKey={selection?.kind === 'transition' ? selection.key : null}
          onSelect={onSelect}
        />
      </div>
    </ComponentLinkProvider>
  );
}
```

`StatusBadge` takes an `InstanceStatus`; if `STATUS_CONFIG[status]` would be undefined for an unexpected runtime value, guard with `STATUS_CONFIG` keys — check `command grep -n "STATUS_CONFIG" -A12 packages/designer-ui/src/modules/quick-run/components/StatusBadge.tsx` and fall back to rendering `<span>{status}</span>` when the status is not a key.

- [ ] **Step 8: Barrel and package export**

`packages/designer-ui/src/modules/instance-monitor/index.ts`:

```ts
export { MonitorShell, type MonitorShellProps } from './components/MonitorShell';
export type { MonitorTarget, OpenComponentTarget } from './types';
```

In `packages/designer-ui/package.json` `exports`, after `"./quickrun": …` add:

```json
    "./monitor": "./src/modules/instance-monitor/index.ts",
```

If `apps/extension/webview-ui/tsconfig.json` or `apps/web/tsconfig*.json` map designer-ui subpaths under `paths`, add the same `./monitor` mapping next to `./quickrun` (`command grep -rn "designer-ui/quickrun" apps/*/tsconfig*.json apps/extension/webview-ui/tsconfig.json apps/*/vite.config.ts apps/extension/webview-ui/vite.config.ts`).

- [ ] **Step 9: Run tests and typecheck**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/instance-monitor && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add packages/designer-ui/src/modules/instance-monitor packages/designer-ui/package.json
git commit -m "feat(instance-monitor): monitor shell with canvas, inspector, instance tab and path

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Quick Run entry point

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts` (after `OpenSubFlowTarget`, line ~336)
- Create: `packages/designer-ui/src/modules/quick-run/components/OpenMonitorButton.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/OpenMonitorButton.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx:59-65` and the header near line 496
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunShell.tsx:32-71` and where `InstanceDashboard` is rendered

**Interfaces:**
- Produces: `OpenMonitorTarget { domain: string; workflowKey: string; instanceId: string; instanceKey?: string }`; `QuickRunShellProps.onOpenMonitor?: (target: OpenMonitorTarget) => void`.

- [ ] **Step 1: Write the failing test**

```tsx
// OpenMonitorButton.vitest.test.tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OpenMonitorButton } from './OpenMonitorButton';

describe('OpenMonitorButton', () => {
  it('renders an accessible pointer button', () => {
    const html = renderToStaticMarkup(h(OpenMonitorButton, { onClick: () => {} }));
    expect(html).toContain('aria-label="Monitor this instance"');
    expect(html).toContain('cursor-pointer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/OpenMonitorButton.vitest.test.tsx`
Expected: FAIL — cannot resolve `./OpenMonitorButton`.

- [ ] **Step 3: Add the target type**

After `OpenSubFlowTarget` in `quickrun.types.ts`:

```ts
/** Open the Instance Monitor for a running instance (host decides panel vs route). */
export interface OpenMonitorTarget {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** Business key, for the panel title. */
  instanceKey?: string;
}
```

- [ ] **Step 4: Write `OpenMonitorButton.tsx`**

```tsx
import { Activity } from 'lucide-react';

/** Header action next to "Instance Details". */
export function OpenMonitorButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex cursor-pointer items-center rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
      title="Monitor this instance"
      aria-label="Monitor this instance"
      onClick={onClick}
    >
      <Activity size={12} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 5: Wire it through the dashboard and the shell**

`InstanceDashboard.tsx`: add to `InstanceDashboardProps`

```ts
  /** See `QuickRunShellProps.onOpenMonitor`. */
  onOpenMonitor?: (target: OpenMonitorTarget) => void;
```

destructure `onOpenMonitor`, import `OpenMonitorButton` and `type OpenMonitorTarget`, and directly after the "Instance Details" `<button …>…</button>` (around line 496–504) add:

```tsx
              {onOpenMonitor && (
                <OpenMonitorButton
                  onClick={() =>
                    onOpenMonitor({ domain, workflowKey, instanceId: activeInstance.id, instanceKey: activeInstance.key })
                  }
                />
              )}
```

`QuickRunShell.tsx`: add to `QuickRunShellProps`

```ts
  /**
   * Open the Instance Monitor for the active instance. Host split as for
   * `onOpenFunctionRun`: the extension opens a panel, the web shell a route.
   * When omitted the Monitor button is hidden.
   */
  onOpenMonitor?: (target: OpenMonitorTarget) => void;
```

destructure it and pass it to `<InstanceDashboard … {...(onOpenMonitor ? { onOpenMonitor } : {})} />` (find the render with `command grep -n "<InstanceDashboard" packages/designer-ui/src/modules/quick-run/QuickRunShell.tsx`).

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): Monitor button on the instance header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Extension — MonitorPanel, command and webview entry

**Files:**
- Create: `apps/extension/src/panels/monitor-messages.ts`
- Test: `apps/extension/src/panels/monitor-messages.vitest.test.ts`
- Create: `apps/extension/src/panels/webview-html.ts`
- Create: `apps/extension/src/panels/MonitorPanel.ts`
- Modify: `apps/extension/src/panels/QuickRunPanel.ts` (message routing at ~line 125, new handler)
- Modify: `apps/extension/src/extension.ts:320-330` and the command list (~line 641)
- Create: `apps/extension/webview-ui/monitor.html`, `apps/extension/webview-ui/src/monitor-main.tsx`, `apps/extension/webview-ui/src/monitor/MonitorApp.tsx`
- Modify: `apps/extension/webview-ui/vite.config.ts:32-35`, `apps/extension/webview-ui/src/quickrun/QuickRunApp.tsx`

**Interfaces:**
- Consumes: `OpenMonitorTarget` (Task 6), `MonitorShell` from `@vnext-forge-studio/designer-ui/monitor` (Task 5), `QuickRunContext` (`QuickRunPanel.ts:13`).
- Produces: `parseOpenMonitorMessage(raw) → { instanceId, instanceKey? } | null`; `isOpenQuickRunFromMonitorMessage(raw): boolean`; `MonitorContext`; command `vnextForge.openInstanceMonitor(ctx: MonitorContext)` (registered, not contributed).

- [ ] **Step 1: Write the failing test**

```ts
// monitor-messages.vitest.test.ts
import { describe, expect, it } from 'vitest';

import { isOpenQuickRunFromMonitorMessage, parseOpenMonitorMessage } from './monitor-messages';

describe('parseOpenMonitorMessage', () => {
  it('accepts an instance id and an optional key', () => {
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: 'a1', instanceKey: 'order-1' })).toEqual({ instanceId: 'a1', instanceKey: 'order-1' });
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: 'a1' })).toEqual({ instanceId: 'a1' });
  });
  it('rejects other messages and bad ids', () => {
    expect(parseOpenMonitorMessage({ type: 'other', instanceId: 'a1' })).toBeNull();
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: '' })).toBeNull();
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: '../x' })).toBeNull();
    expect(parseOpenMonitorMessage(null)).toBeNull();
  });
});

describe('isOpenQuickRunFromMonitorMessage', () => {
  it('recognises the message', () => {
    expect(isOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun' })).toBe(true);
    expect(isOpenQuickRunFromMonitorMessage({ type: 'quickrun:open-monitor' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/panels/monitor-messages.vitest.test.ts`
Expected: FAIL — cannot resolve `./monitor-messages`.

- [ ] **Step 3: Write `monitor-messages.ts`**

```ts
/**
 * Webview → host messages for the Instance Monitor. Kept free of `vscode` so
 * they can be unit tested. The instance id is webview input that ends up in a
 * runtime URL path, so only id-like values pass.
 */
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export interface OpenMonitorRequest {
  instanceId: string;
  instanceKey?: string;
}

/** `quickrun:open-monitor` from a Quick Run panel; workflow identity comes from that panel's context. */
export function parseOpenMonitorMessage(raw: unknown): OpenMonitorRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (msg.type !== 'quickrun:open-monitor') return null;
  const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : '';
  if (!ID_PATTERN.test(instanceId)) return null;
  const instanceKey = typeof msg.instanceKey === 'string' && msg.instanceKey.length > 0 ? msg.instanceKey.slice(0, 200) : undefined;
  return { instanceId, ...(instanceKey ? { instanceKey } : {}) };
}

/** `monitor:open-quickrun` from a monitor panel; the host already knows which workflow. */
export function isOpenQuickRunFromMonitorMessage(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'monitor:open-quickrun';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter vnext-forge-studio exec vitest run src/panels/monitor-messages.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `webview-html.ts`**

```ts
import * as fs from 'node:fs';
import * as vscode from 'vscode';

/**
 * Loads a built webview page, rewrites its asset URLs and injects the CSP and
 * `window.__VNEXT_CONFIG__`. Same policy as `QuickRunPanel.buildHtml`, minus
 * the pseudo-ui tenant stylesheet the monitor does not render.
 */
export function buildWebviewHtml(
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  htmlFile: string,
  config: Record<string, unknown>,
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview-ui');
  let html = fs.readFileSync(vscode.Uri.joinPath(distPath, htmlFile).fsPath, 'utf8');

  html = html.replace(/((?:src|href)=")(\.?\/?assets\/[^"]+)(")/g, (_m, prefix, assetPath, suffix) => {
    const clean = (assetPath as string).replace(/^\.?\/?/, '');
    return `${prefix}${webview.asWebviewUri(vscode.Uri.joinPath(distPath, clean)).toString()}${suffix}`;
  });

  const nonce = generateNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
    `worker-src ${webview.cspSource} blob:`,
    `font-src ${webview.cspSource} data:`,
    `img-src ${webview.cspSource} data:`,
    `connect-src ${webview.cspSource}`,
  ].join('; ');

  html = html.replace(/<script(\s[^>]*)?>/g, (match: string, attrs?: string) =>
    (attrs ?? '').includes('nonce=') ? match : `<script${attrs ?? ''} nonce="${nonce}">`,
  );
  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    `<script nonce="${nonce}">\n  window.__VNEXT_CONFIG__ = ${JSON.stringify(config)};\n</script>`,
  ].join('\n');
  return html.replace('</head>', `${head}\n</head>`);
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}
```

- [ ] **Step 6: Write `MonitorPanel.ts`**

```ts
import * as vscode from 'vscode';

import type { MessageRouter } from '../MessageRouter';
import type { ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';
import { isOpenQuickRunFromMonitorMessage } from './monitor-messages.js';
import { buildWebviewHtml } from './webview-html.js';

export interface MonitorContext {
  domain: string;
  workflowKey: string;
  instanceId: string;
  instanceKey?: string;
  projectId: string;
  /** Absolute path of the local workflow JSON (Quick Run's `projectPath`). */
  workflowFilePath: string;
  environmentName?: string;
  environmentUrl?: string;
}

interface PanelEntry {
  panel: vscode.WebviewPanel;
  webviewReady: boolean;
  ctx: MonitorContext;
  disposables: vscode.Disposable[];
}

/** One read-only Instance Monitor panel per `${domain}:${instanceId}`, opened beside Quick Run. */
export class MonitorPanel {
  private readonly panels = new Map<string, PanelEntry>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly router: MessageRouter,
    private readonly forgeToolsSettings?: ForgeToolsSettingsService,
  ) {}

  open(ctx: MonitorContext): void {
    const key = `${ctx.domain}:${ctx.instanceId}`;
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      existing.ctx = ctx;
      if (existing.webviewReady) void this.sendContext(existing);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vnextForgeMonitor',
      `Monitor — ${ctx.workflowKey} · ${ctx.instanceKey ?? ctx.instanceId.slice(0, 8)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview-ui')],
      },
    );
    const entry: PanelEntry = { panel, webviewReady: false, ctx, disposables: [] };
    this.panels.set(key, entry);

    entry.disposables.push(this.router.attach(panel));
    entry.disposables.push(
      panel.webview.onDidReceiveMessage((raw: unknown) => {
        if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'webview-ready') {
          entry.webviewReady = true;
          void this.sendContext(entry);
          return;
        }
        if (isOpenQuickRunFromMonitorMessage(raw)) {
          void vscode.commands.executeCommand('vnextForge.openQuickRunFromFile', vscode.Uri.file(entry.ctx.workflowFilePath));
        }
      }),
    );
    if (this.forgeToolsSettings) {
      entry.disposables.push(
        this.forgeToolsSettings.onDidChangeQuickRunSettings(() => {
          if (entry.webviewReady) void this.sendContext(entry);
        }),
      );
    }

    panel.onDidDispose(() => {
      for (const d of entry.disposables) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      entry.disposables.length = 0;
      this.panels.delete(key);
    });

    panel.webview.html = buildWebviewHtml(this.context.extensionUri, panel.webview, 'monitor.html', {
      POST_MESSAGE_ALLOWED_ORIGINS: ['vscode-webview:', 'vscode-file://vscode-app'],
    });
  }

  dispose(): void {
    for (const entry of [...this.panels.values()]) entry.panel.dispose();
  }

  private async sendContext(entry: PanelEntry): Promise<void> {
    let globalHeaders: Record<string, string> = {};
    if (this.forgeToolsSettings) {
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      globalHeaders = Object.fromEntries(qr.globalHeaders.map((h) => [h.name, h.value]));
    }
    void entry.panel.webview.postMessage({ type: 'monitor:context', ...entry.ctx, globalHeaders });
  }
}
```

- [ ] **Step 7: Route the Quick Run message**

In `QuickRunPanel.ts` import `parseOpenMonitorMessage` from `./monitor-messages.js`; in `onDidReceiveMessage`, after `if (this.handleOpenSubFlowRunMessage(raw)) return;` add `if (this.handleOpenMonitorMessage(entry, raw)) return;`; add the method:

```ts
  /**
   * `quickrun:open-monitor` — the instance header's Monitor button. Only the
   * instance id comes from the webview; the workflow identity, file and
   * environment are this panel's own context.
   */
  private handleOpenMonitorMessage(entry: PanelEntry, raw: unknown): boolean {
    const request = parseOpenMonitorMessage(raw);
    if (!request) return false;
    const ctx = entry.ctx;
    void vscode.commands.executeCommand('vnextForge.openInstanceMonitor', {
      domain: ctx.domain,
      workflowKey: ctx.workflowKey,
      instanceId: request.instanceId,
      ...(request.instanceKey ? { instanceKey: request.instanceKey } : {}),
      projectId: ctx.projectId,
      workflowFilePath: ctx.projectPath,
      ...(ctx.environmentName ? { environmentName: ctx.environmentName } : {}),
      ...(ctx.environmentUrl ? { environmentUrl: ctx.environmentUrl } : {}),
    });
    return true;
  }
```

- [ ] **Step 8: Register the panel and command (`extension.ts`)**

Import `MonitorPanel, type MonitorContext` from `./panels/MonitorPanel`. After the `functionQuickRunPanel` lines (~329–330):

```ts
  const monitorPanel = new MonitorPanel(context, router, forgeToolsSettings);
  context.subscriptions.push({ dispose: () => monitorPanel.dispose() });
```

In the command list, next to `vnextForge.openFunctionQuickRunForInstance`:

```ts
    /**
     * Internal bridge for Quick Run's Monitor button. Registered but not
     * contributed — it takes a structured context. `QuickRunPanel` validates
     * the webview payload before getting here.
     */
    vscode.commands.registerCommand('vnextForge.openInstanceMonitor', safeAsync(async (arg) => {
      const ctx = arg as MonitorContext | undefined;
      if (!ctx?.domain || !ctx.workflowKey || !ctx.instanceId || !ctx.workflowFilePath) return;
      monitorPanel.open(ctx);
    })),
```

- [ ] **Step 9: Webview entry**

`apps/extension/webview-ui/monitor.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>vNext Forge — Monitor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/monitor-main.tsx"></script>
  </body>
</html>
```

`apps/extension/webview-ui/src/monitor-main.tsx`: copy `quickrun-main.tsx` exactly, replacing the `QuickRunApp` import and element with `import { MonitorApp } from './monitor/MonitorApp';` and `<MonitorApp api={vsCodeApi} />`.

`apps/extension/webview-ui/src/monitor/MonitorApp.tsx`:

```tsx
import { useEffect, useState } from 'react';

import { isMessageOriginAllowed, useToolHeadersStore } from '@vnext-forge-studio/designer-ui';
import { MonitorShell, type MonitorTarget } from '@vnext-forge-studio/designer-ui/monitor';

import { resolveWebviewPostMessageAllowedOrigins } from '../host/webviewMessageOrigins';
import type { VsCodeWebviewApi } from '../VsCodeTransport';

function readStringRecord(value: unknown): Record<string, string> {
  if (value == null || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export function MonitorApp({ api }: { api: VsCodeWebviewApi }) {
  const [target, setTarget] = useState<MonitorTarget | null>(null);
  const headers = useToolHeadersStore((s) => s.headers);

  useEffect(() => {
    const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();
    function handleMessage(event: MessageEvent) {
      if (!isMessageOriginAllowed(event.origin, allowedOrigins)) return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.type !== 'monitor:context') return;
      setTarget({
        domain: String(data.domain),
        workflowKey: String(data.workflowKey),
        instanceId: String(data.instanceId),
        workflowFilePath: String(data.workflowFilePath),
        projectId: String(data.projectId),
        ...(typeof data.environmentName === 'string' ? { environmentName: data.environmentName } : {}),
        ...(typeof data.environmentUrl === 'string' ? { runtimeUrl: data.environmentUrl } : {}),
      });
      useToolHeadersStore.getState().setHeaders(readStringRecord(data.globalHeaders));
    }
    window.addEventListener('message', handleMessage);
    api.postMessage({ type: 'webview-ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [api]);

  if (!target) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--vscode-descriptionForeground)]">
        <p>Waiting for instance context...</p>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <MonitorShell
        target={target}
        headers={headers}
        onOpenComponent={(t) => api.postMessage({ type: 'host:open-designer', absolutePath: t.filePath })}
        onOpenScript={(absolutePath) => api.postMessage({ type: 'host:open-workspace-file', absolutePath })}
        onOpenQuickRun={() => api.postMessage({ type: 'monitor:open-quickrun' })}
        {...(target.workflowFilePath
          ? { onOpenFlowDesigner: () => api.postMessage({ type: 'host:open-designer', absolutePath: target.workflowFilePath }) }
          : {})}
      />
    </div>
  );
}
```

Confirm `useToolHeadersStore` exposes `headers` and `setHeaders` (`command grep -rn "export const useToolHeadersStore" -A12 packages/designer-ui/src`); adjust the selector name if it differs.

`vite.config.ts` `input`: add `monitor: path.resolve(__dirname, 'monitor.html'),`.

`QuickRunApp.tsx`: pass to `QuickRunShell`

```tsx
      onOpenMonitor={(target) => {
        // The host fills in the workflow, file and environment from this
        // panel's own context; only the instance travels.
        api.postMessage({ type: 'quickrun:open-monitor', instanceId: target.instanceId, instanceKey: target.instanceKey });
      }}
```

- [ ] **Step 10: Build and test the extension**

Run: `pnpm --filter vnext-forge-studio test && pnpm --filter vnext-forge-studio build`
Expected: tests PASS; `dist/webview-ui/monitor.html` exists (`ls apps/extension/dist/webview-ui/monitor.html`).

- [ ] **Step 11: Commit**

```bash
git add apps/extension
git commit -m "feat(extension): Instance Monitor panel opened from Quick Run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web shell — monitor tab and route

**Files:**
- Modify: `packages/designer-ui/src/modules/code-editor/EditorStore.ts:3-11` and after line 60
- Modify: `packages/designer-ui/src/modules/code-editor/EditorTabLabel.tsx:38-42`
- Modify: `packages/designer-ui/src/modules/code-editor/editorTabPresentation.ts:42-48`
- Modify: `apps/web/src/modules/project-workspace/editorTabNavigation.ts:22-29`
- Create: `apps/web/src/pages/quickrun/workflowFilePath.ts`
- Test: `apps/web/src/pages/quickrun/workflowFilePath.vitest.test.ts` (only if `apps/web` has a vitest setup — check `command grep -n '"test"' apps/web/package.json`; otherwise put the test next to the helper in designer-ui is not possible, so rely on typecheck and the manual check)
- Create: `apps/web/src/pages/monitor/MonitorPage.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx` (lazy import ~line 64, route ~line 157)
- Modify: `apps/web/src/pages/quickrun/QuickRunPage.tsx`

**Interfaces:**
- Consumes: `MonitorShell` (Task 5), `OpenMonitorTarget` (Task 6), `resolveFileRoute` (`apps/web/src/modules/project-workspace/FileRouter.ts:27`).
- Produces: `EditorTabKind 'monitor'`; `monitorTabId(projectId, instanceId)`; `workflowFilePathFor(projectPath, paths, group, name)`; route `/project/:id/monitor/:group/:name/:instanceId`.

- [ ] **Step 1: Tab kind**

`EditorStore.ts`: add to `EditorTabKind`

```ts
  /** Instance Monitor for one running instance (`:group/:name/:instanceId`). */
  | 'monitor';
```

(move the `;` from `'functionrun-instance'`). After `functionRunInstanceTabId` add:

```ts
export function monitorTabId(projectId: string, instanceId: string): string {
  return `${projectId}:monitor:${instanceId}`;
}
```

Export `monitorTabId` wherever `functionRunInstanceTabId` is exported from the package root (`command grep -n "functionRunInstanceTabId" packages/designer-ui/src/index.ts`).

`EditorTabLabel.tsx`: import `Activity` from `lucide-react` and add before the closing of the `if` chain:

```tsx
  } else if (tab.kind === 'monitor') {
    leading = <Activity className="text-primary size-4 shrink-0" aria-hidden />;
```

`editorTabPresentation.ts`: add `tab.kind === 'monitor' ||` to the condition that returns `tab.title`.

`editorTabNavigation.ts`: after the `functionrun-instance` branch add

```ts
  if (tab.kind === 'monitor' && tab.group && tab.name && tab.search) {
    // `search` holds the instance id: `/monitor/:group/:name/:instanceId`.
    return `/project/${projectId}/monitor/${encodeURIComponent(tab.group)}/${encodeURIComponent(tab.name)}/${encodeURIComponent(tab.search)}`;
  }
```

- [ ] **Step 2: Shared workflow path helper**

`apps/web/src/pages/quickrun/workflowFilePath.ts`:

```ts
import type { VnextWorkspaceConfig } from '@vnext-forge-studio/designer-ui';

/**
 * Absolute path of a workflow from its route coordinates. `_` is the route
 * placeholder for a workflow directly under the workflows root.
 */
export function workflowFilePathFor(
  projectPath: string | undefined,
  paths: VnextWorkspaceConfig['paths'] | undefined,
  group: string | undefined,
  name: string | undefined,
): string | null {
  if (!projectPath || !paths || !group || !name) return null;
  const base = `${projectPath}/${paths.componentsRoot}/${paths.workflows}`;
  const folder = group === '_' ? '' : group;
  const dir = folder ? `${base}/${folder}` : base;
  return `${dir}/${name}.json`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}
```

In `QuickRunPage.tsx` replace the `workflowFilePath` `useMemo` body with `() => workflowFilePathFor(projectPath, vnextConfig?.paths, group, name)` (keep the same dependency list) and import the helper.

- [ ] **Step 3: `MonitorPage.tsx`**

```tsx
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { monitorTabId, useEditorStore, useProjectStore, useToolHeadersStore } from '@vnext-forge-studio/designer-ui';
import { MonitorShell, type OpenComponentTarget } from '@vnext-forge-studio/designer-ui/monitor';

import { useEnvironmentStore } from '../../app/store/useEnvironmentStore';
import { resolveFileRoute } from '../../modules/project-workspace/FileRouter';
import { workflowFilePathFor } from '../quickrun/workflowFilePath';

/** Instance Monitor as an editor tab, opened from Quick Run's Monitor button. */
export function MonitorPage() {
  const { id, group, name, instanceId } = useParams<{ id: string; group: string; name: string; instanceId: string }>();
  const navigate = useNavigate();
  const openTab = useEditorStore((s) => s.openTab);
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeEnv = useEnvironmentStore((s) => s.getActiveEnvironment());
  const headers = useToolHeadersStore((s) => s.headers);

  const workflowFilePath = workflowFilePathFor(activeProject?.path, vnextConfig?.paths, group, name);
  const domain = activeProject?.domain;

  useEffect(() => {
    if (!id || !group || !name || !instanceId) return;
    openTab({
      id: monitorTabId(id, instanceId),
      kind: 'monitor',
      title: `Monitor: ${name} · ${instanceId.slice(0, 8)}`,
      group,
      name,
      search: instanceId,
    });
  }, [id, group, name, instanceId, openTab]);

  const target = useMemo(
    () =>
      domain && name && instanceId && id
        ? {
            domain,
            workflowKey: name,
            instanceId,
            projectId: id,
            ...(workflowFilePath ? { workflowFilePath } : {}),
            ...(activeEnv?.name ? { environmentName: activeEnv.name } : {}),
            ...(activeEnv?.baseUrl ? { runtimeUrl: activeEnv.baseUrl } : {}),
          }
        : null,
    [domain, name, instanceId, id, workflowFilePath, activeEnv?.name, activeEnv?.baseUrl],
  );

  const openFile = useCallback(
    (filePath: string) => {
      if (!id || !activeProject) return;
      const route = resolveFileRoute(filePath, vnextConfig, id, activeProject.path);
      navigate(route.navigateTo ?? `/project/${id}/code/${encodeURIComponent(filePath)}`);
    },
    [id, activeProject, vnextConfig, navigate],
  );

  if (!target) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Open the monitor from Quick Run in a loaded project.</p>
      </div>
    );
  }

  return (
    <MonitorShell
      target={target}
      headers={headers}
      onOpenComponent={(t: OpenComponentTarget) => openFile(t.filePath)}
      onOpenScript={(path) => navigate(`/project/${id}/code/${encodeURIComponent(path)}`)}
      onOpenQuickRun={() => navigate(`/project/${id}/quickrun/${encodeURIComponent(group!)}/${encodeURIComponent(name!)}`)}
      {...(workflowFilePath ? { onOpenFlowDesigner: () => openFile(workflowFilePath) } : {})}
    />
  );
}
```

`workflowKey` is the route `name` here; Quick Run's `workflowKey` is the file's `key`, which equals the file name in vNext workspaces. If they can differ, read the key the way `QuickRunPage` does (`filesService.read` + `json.key`) — check one workspace first (`vnext-example`: `command grep -rn '"key"' -m1 <a workflow file>`); if they match by convention, keep `name`.

- [ ] **Step 4: Route**

`AppRouter.tsx`: next to the `QuickRunPage` lazy import add

```ts
const MonitorPage = lazy(() =>
  import('../pages/monitor/MonitorPage').then((m) => ({ default: m.MonitorPage })),
);
```

(match the exact lazy pattern used on line 64) and after the `quickrun/:group/:name` route:

```tsx
                  <Route path="monitor/:group/:name/:instanceId" element={<MonitorPage />} />
```

- [ ] **Step 5: Quick Run → monitor (`QuickRunPage.tsx`)**

```tsx
  const openMonitor = useCallback(
    (target: OpenMonitorTarget) => {
      if (!id || !group || !name) return;
      navigate(
        `/project/${id}/monitor/${encodeURIComponent(group)}/${encodeURIComponent(name)}/${encodeURIComponent(target.instanceId)}`,
      );
    },
    [id, group, name, navigate],
  );
```

import `type OpenMonitorTarget` from `@vnext-forge-studio/designer-ui/quickrun` and pass `onOpenMonitor={openMonitor}` to `QuickRunShell`.

- [ ] **Step 6: Typecheck and build**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/web build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/code-editor apps/web
git commit -m "feat(web): Instance Monitor tab opened from Quick Run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full test and build**

Run: `pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter vnext-forge-studio test && pnpm -w turbo run build`
Expected: all PASS / succeed.

- [ ] **Step 2: Lint the touched files**

Run: `git diff --name-only main...HEAD -- '*.ts' '*.tsx' | xargs -I{} sh -c 'case {} in packages/designer-ui/*) echo {};; esac' | sed 's#packages/designer-ui/##' | xargs pnpm --filter @vnext-forge-studio/designer-ui exec eslint`, and the same for `apps/extension` and `apps/web` paths.
Expected: no new errors in touched files.

- [ ] **Step 3: Web shell check against a local runtime**

Start the local runtime and the web shell (`.claude/launch.json` → `preview_start`). In a vnext-example project:
1. Open Quick Run for a workflow with a loop and a view (e.g. a lab from `vnext-example`), start an instance, fire two transitions.
2. Click the **Monitor** button in the instance header → a `Monitor:` tab opens.
3. Verify: current state pulses; visited states are full colour; an entered-twice state shows **×2**; traversed edges show their step numbers; **Path only** dims the rest; the timeline lists the steps and a chip selects its transition — the edge pulses on the canvas and the Inspector shows it; clicking a node marks nothing in the timeline but fills the Inspector.
4. Click a state → Inspector shows "Visited … · now here"; a task / view / schema reference shows **Open**; clicking it opens that designer; a script location shows **Open script**.
5. Instance tab shows key, id, flow, version; temporarily change the local workflow `version` → drift banner appears; revert.
6. Rename the workflow file temporarily → reload the monitor → "Local definition not found" and a history-only graph; revert.
7. Stop the runtime → Refresh → **Stale** badge, data stays; start it again → Refresh clears it.
8. Use a random instance id in the URL → "Instance not found in …".
9. Narrow the window to ~900px → layout stays usable (no horizontal page scroll).

- [ ] **Step 4: Extension Development Host check**

Run the `Run Extension` launch config, open a vnext-example workspace, open Quick Run, start an instance, click **Monitor**: the panel opens **beside** Quick Run; repeat steps 3–5; clicking **Open** opens the designer panel; **Open in Quick Run** reveals the Quick Run panel; clicking Monitor again reveals the same panel instead of a new one.

- [ ] **Step 5: Record and commit any fixes**

If a check needed a fix, commit it with a `fix(instance-monitor): …` message. Update the memory note `instance-monitor-design.md` with "M1 implemented on f/instance-monitor (commits …), manual checks run: web / EDH".
