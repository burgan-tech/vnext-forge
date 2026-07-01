# Workflow Canvas — Shared Between Extension (Designer) and Monitoring

**Status:** Implemented
**Last updated:** 2026-06-26
**Packages:** `packages/designer-ui`, `apps/monitoring` (the forge VS Code extension webview also consumes `designer-ui`)
**Related:**
- Design spec: [`docs/superpowers/specs/2026-06-26-shared-readonly-canvas-panels-design.md`](../superpowers/specs/2026-06-26-shared-readonly-canvas-panels-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-06-26-shared-readonly-canvas-panels.md`](../superpowers/plans/2026-06-26-shared-readonly-canvas-panels.md)

---

## 1. Why this exists

A workflow is a state machine: states (nodes) connected by transitions (edges), plus
workflow-level metadata (cancel / exit / timeout / updateData transitions, labels,
schema, functions, extensions, roles).

Two products need to draw the same picture from the same domain model:

- **The forge extension (designer)** — full **editable** canvas: add/remove states,
  edit transitions, wire tasks/views/schemas, drag nodes, persist diagram positions.
- **The monitoring app** — **read-only** canvas: visualize a workflow definition and,
  for a running instance, overlay execution (visited states, traversed transitions,
  current state).

Rather than re-implement the canvas (and drift over time), both products feed a single
shared canvas component and a single shared set of inspector panels. Changes to the
visual language happen **once** and both sides inherit them.

> **The single most important rule of this feature:** the shared read-only components
> must never pull editor-only machinery (the workflow edit store, Monaco, file/route
> resolvers, dialogs, notifications) into the monitoring bundle. Sharing is achieved by
> keeping the shared pieces **presentational and data-driven**, not by sharing the
> editor's stateful internals.

---

## 2. The big picture

```
                         ┌─────────────────────────────────────────────┐
                         │            packages/designer-ui              │
                         │                                              │
  Extension (designer)   │   FlowCanvas  (mode: 'designer')             │
  edit store + files ───▶│      └─ editable panels (store-backed):      │
                         │           StatePropertyPanel,                │
                         │           TransitionPropertyPanel,           │
                         │           WorkflowMetadataPanel              │
                         │                                              │
                         │   FlowCanvas  (mode: 'workflow-view' |       │
  Monitoring             │                      'instance-view')        │
  definition JSON ──────▶│      └─ read-only inspectors (props-only):   │
                         │           StateInspector,                    │
                         │           TransitionInspector,               │
                         │           WorkflowMetadataInspector          │
                         │                                              │
                         │   normalizeDefinition()  ◀── single source   │
                         │     definition JSON → view-model + canvas JSON│
                         └─────────────────────────────────────────────┘
```

Three things are shared today:

1. **`FlowCanvas`** — the ReactFlow-based canvas itself. Already shared before this
   feature; it is data-driven (props) and mode-aware.
2. **`normalizeDefinition`** — the single function that turns a raw workflow definition
   (any of the known shapes) into both the canvas JSON and the inspector view-model.
3. **The read-only inspector cores** — `StateInspector`, `TransitionInspector`,
   `WorkflowMetadataInspector` (+ the shared `TransitionFields` body).

The extension's **editable** panels remain separate (store-backed). A future phase may
refactor them to wrap the same presentational cores (see [§9](#9-whats-not-shared-yet-phase-4)).

---

## 3. `FlowCanvas` — the shared canvas

Location: [`packages/designer-ui/src/modules/canvas-interaction/FlowCanvas.tsx`](../../packages/designer-ui/src/modules/canvas-interaction/FlowCanvas.tsx)
Exported from the package barrel `@vnext-forge-studio/designer-ui`.

`FlowCanvas` takes the workflow and diagram as **plain props** and never reads the
filesystem. Selected props:

| Prop | Purpose |
|------|---------|
| `workflowJson` | The workflow in canvas shape (`{ key, attributes: { states, startTransition, cancel, ... } }`). Produced by `normalizeDefinition`. |
| `diagramJson` | Node positions etc. (`{ nodePos: {...} }`). Monitoring passes an empty `{ nodePos: {} }` so the canvas auto-lays-out. |
| `mode` | `'designer'` \| `'workflow-view'` \| `'instance-view'` — see below. |
| `executionOverlay` | `{ traversedTransitions, currentState }` — instance execution highlight. |
| `workflowSettingsActive` / `onToggleWorkflowSettings` / `onOpenWorkflowSettings` | Workflow-level metadata toolbox wiring. |
| `onNodeSelect(stateKey)` / `onEdgeSelect(transitionKey)` | Selection callbacks the host uses to open the right inspector. |

### Canvas modes

Defined in [`context/CanvasModeContext.tsx`](../../packages/designer-ui/src/modules/canvas-interaction/context/CanvasModeContext.tsx).

| Mode | `isEditable` | Used by | Behavior |
|------|:---:|---------|----------|
| `designer` | ✅ | extension | Full editing: add/remove states, edit transitions, drag+persist positions, context menus. |
| `workflow-view` | ❌ | monitoring (definition Graph tab) | Read-only structure visualization. |
| `instance-view` | ❌ | monitoring (instance state-graph) | Read-only + `executionOverlay` (current state, visited states, traversed transitions). |

In the non-editable modes, all editing affordances (add-state, context menus, delete
shortcuts, position persistence) are suppressed; the visualization remains.

---

## 4. `normalizeDefinition` — the single normalization point

Location: [`packages/designer-ui/src/modules/canvas-interaction/readonly/normalize.ts`](../../packages/designer-ui/src/modules/canvas-interaction/readonly/normalize.ts)
Types: [`readonly/view-types.ts`](../../packages/designer-ui/src/modules/canvas-interaction/readonly/view-types.ts)

Before this feature, the `definition → canvas JSON` logic (`toFlowCanvasJson`) plus the
`lookupState` / `lookupTransition` helpers were **duplicated** in the monitoring app
(once in `WorkflowCanvas`, again in `InstanceWorkflowCanvas`). They are now a single
shared module.

```ts
const vm = normalizeDefinition(rawDefinition);
// vm.workflowJson  → fed to FlowCanvas
// vm.workflow      → WorkflowMetaView   (for WorkflowMetadataInspector)
// vm.states        → StateView[]        (each with its TransitionView[])

const state      = findState(vm, selectedStateKey);        // → StateView | null
const transition = findTransition(vm, selectedTransitionKey); // → TransitionView | null
```

### Input shapes it accepts

The definition endpoint / on-disk JSON can arrive in three shapes; `normalizeDefinition`
(and the `toFlowCanvasJson` it embeds) handle all three:

1. **Full vNext** — `{ attributes: { states: [...] } }` (what the designer reads from disk).
2. **Monitoring semi-flat** — `{ states: [{ stateType, transitions: [...] }], cancel, exit, ... }`
   (top-level states with nested transitions; workflow-level transitions at the root).
   This is what the monitor definition endpoint returns.
3. **Fully flat** — `{ states: [...], transitions: [...] }` (separate flat arrays).

Trigger types are normalized (`'manual'|'automatic'|'scheduled'|'event'` → `0|1|2|3`)
via `normalizeTriggerType`, so downstream code only deals with numbers.

### Output: the view-model

The view-model types ([`view-types.ts`](../../packages/designer-ui/src/modules/canvas-interaction/readonly/view-types.ts))
are intentionally lean and presentation-oriented (only what the inspectors render):
`ComponentRef`, `LabelView`, `RoleGrantView`, `CodeView`, `TaskRefView`,
`ViewBindingView`, `TransitionView`, `ErrorHandlerView`, `StateView`, `WorkflowMetaView`,
`WorkflowViewModel`.

---

## 5. The read-only inspector cores

Location: [`packages/designer-ui/src/modules/canvas-interaction/readonly/`](../../packages/designer-ui/src/modules/canvas-interaction/readonly/)
Exported from `@vnext-forge-studio/designer-ui`.

| Component | Renders | Parity with designer |
|-----------|---------|----------------------|
| `WorkflowMetadataInspector` | Workflow-level metadata: basic (key/domain/version/flow/type/comment), tags, labels, schema, query roles, updateData / cancel / exit / timeout transitions, shared transitions, functions, extensions. | Mirrors `WorkflowMetadataPanel` sections, read-only. |
| `StateInspector` | Tabbed: **General / Tasks / Transitions / SubFlow** (only for SubFlow states) **/ Error Boundary**, with counts. | Mirrors `StatePropertyPanel` tabs, read-only. |
| `TransitionInspector` | Header + `TransitionFields`: target, trigger type/kind, comment, on-execution tasks, schema, mapping, rule, timer, roles, views, availableIn, labels, annotations. | Mirrors `TransitionPropertyPanel` / `TransitionCard`, read-only. |
| `TransitionFields` | The transition body, reused by both `TransitionInspector` and `StateInspector`'s Transitions tab (DRY). | — |

### How parity is achieved without coupling

The cores are **presentational** and reuse the **already-pure** primitives in
[`components/panels/tabs/PropertyPanelShared.tsx`](../../packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/PropertyPanelShared.tsx)
(`Section`, `InfoRow`, `Badge`, `ResourceRef`, `CodePreview`, `LabelList`, `SummaryCard`)
and label helpers in `PropertyPanelHelpers.ts`. This is why the read-only panels look
like the designer panels without sharing the editor's stateful components.

### The import-purity constraint (enforced by review)

Every file under `readonly/` imports **only**:

- `react`, `lucide-react`
- `./view-types` and sibling `readonly/` files
- the pure `PropertyPanelShared` / `PropertyPanelHelpers`

They must **never** import `useWorkflowStore`, `useProjectStore`, Monaco
(`CsxEditorField`), dialogs, notifications, or any file/route resolver. That is what
keeps the monitoring bundle free of editor-only machinery. The designer's editable
panels, by contrast, are deeply coupled to `useWorkflowStore` and those editor systems —
which is exactly why they are not reused directly.

### Props (presentational)

```ts
StateInspector({ state: StateView | null, onClose?, children? })
TransitionInspector({ transition: TransitionView, onClose?, children? })
WorkflowMetadataInspector({ workflow: WorkflowMetaView, onClose? })
```

`children` is an **execution-overlay slot** — monitoring's instance view injects runtime
info there (see [§7](#7-instance-runtime-view)).

---

## 6. Graceful degradation — monitoring only has the definition

The designer, during development, has the whole folder of vNext components on disk and
can resolve a referenced task/view/schema/function to its full content. **Monitoring
cannot** — it only has the definition JSON returned by the monitor endpoint:

```
GET {baseUrl}/api/v{apiVersion}/monitor/{domain}/components/definition?type=sys-flows&key={key}[&version={version}]
```

So the rule is: render everything the definition **inlines**, and **degrade**
references the definition only points to.

| Content | In the definition? | Monitoring shows |
|---------|:---:|------------------|
| State key / type / labels, outgoing transitions, trigger | ✅ inline | Full |
| Workflow metadata (cancel/exit/timeout/updateData, labels, tags) | ✅ inline | Full |
| Task / view / schema / function **references** (key/domain/version/flow) | ✅ inline | Reference chip via `ResourceRef` (no deep body) |
| Inline mapping / rule / timer code (csx, base64) | ✅ inline | Read-only `CodePreview` (decoded) |
| Task **inner body**, view content, schema content | ❌ separate component | Not shown — deliberate degrade |

The design reserves an optional `resolveReference` hook so the **extension** (which can
resolve references via files) could later render resolved detail/deep-links while
monitoring renders plain chips — same component, two behaviors. That hook is **deferred
to Phase 4** (not built yet); monitoring's chip-only rendering already satisfies the
degrade requirement.

---

## 7. Monitoring integration

### 7.1 Definition Graph tab

[`apps/monitoring/src/modules/definitions/workflow/WorkflowCanvas.tsx`](../../apps/monitoring/src/modules/definitions/workflow/WorkflowCanvas.tsx)

- `normalizeDefinition(definition)` → feeds `FlowCanvas` (`mode="workflow-view"`).
- Clicking a node → `findState` → `StateInspector`; clicking an edge → `findTransition`
  → `TransitionInspector`.
- The canvas workflow-settings button (`workflowSettingsActive` / `onToggleWorkflowSettings`
  / `onOpenWorkflowSettings`) opens `WorkflowMetadataInspector`.
- Selection and the settings panel are mutually exclusive.

### 7.2 Instance runtime view

[`apps/monitoring/src/modules/instances/components/InstanceWorkflowCanvas.tsx`](../../apps/monitoring/src/modules/instances/components/InstanceWorkflowCanvas.tsx)

- Same normalizer + inspectors, but `mode="instance-view"` plus an `executionOverlay`
  built from the instance timeline (`{ traversedTransitions, currentState }`).
- Runtime info is injected via the inspector **`children` slot**:
  - [`InstanceStatePanel`](../../apps/monitoring/src/modules/instances/components/InstanceStatePanel.tsx)
    — execution status (Current / Visited / Not reached), visit count (arrivals),
    first entry (earliest arrival), last exit (latest departure).
  - [`InstanceTransitionPanel`](../../apps/monitoring/src/modules/instances/components/InstanceTransitionPanel.tsx)
    — traversal count and per-fire detail (started at, duration, trigger, created by).

  These are **execution-only fragments**: the structural fields come from the shared
  inspector; the fragment only adds runtime data inside the slot.

The previous hand-rolled `MonitoringStatePanel` / `MonitoringTransitionPanel` (which
showed only key/type/from/to/trigger) were **deleted** in favor of the shared cores.

### Selective import policy

Monitoring imports the canvas, normalizer, and inspectors **only** through the public
barrel `@vnext-forge-studio/designer-ui` (it does not reach into deep paths). This
matches the project's designer-ui selective-import policy.

---

## 8. The canvas centering fix

Symptom (before): clicking any node collapsed every node to the canvas center.

Root cause: monitoring recreated `workflowJson` / `diagramJson` on every render. A
selection re-render produced new object identities → `FlowCanvas` recomputed nodes to
their default positions → the one-shot auto-layout did not re-run (its `autoLayoutDone`
ref was already set) → nodes stayed collapsed.

Fix: memoize the normalized model and `diagramJson` so their identity is stable across
selection-driven re-renders (in `InstanceWorkflowCanvas` the memo is placed **before**
the early `if (!definition)` return to keep hook order stable).

---

## 9. What's NOT shared yet (Phase 4)

The extension's **editable** panels (`StatePropertyPanel`, `TransitionPropertyPanel`,
`WorkflowMetadataPanel` and their section/card sub-components) are still separate,
store-backed components. They were intentionally left untouched.

A future phase could refactor them to wrap the same presentational cores (passing a
`readOnly={false}` + `resolveReference`), making the read-only and editable paths a
single source of truth. Until then:

- **Shared:** `FlowCanvas`, `normalizeDefinition`, the read-only inspector cores, the
  pure `PropertyPanelShared` primitives.
- **Not shared:** the editable panels (designer-only), the edit store, Monaco/file
  resolution.

---

## 10. Build pipeline note

`apps/monitoring`'s `tsconfig` uses **TypeScript project references**, so it resolves
`designer-ui` through its built `dist/*.d.ts` (not source) **for typechecking**.
Therefore, after changing `designer-ui` source, rebuild its dist before typechecking
monitoring:

```bash
corepack pnpm --filter @vnext-forge-studio/designer-ui exec tsc -b
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

CI / Turborepo should declare `designer-ui#build` as a prerequisite of
`monitoring#typecheck`. (At runtime, Vite resolves `designer-ui` via its `exports` map,
which points at source — so the dev server does not require a prior build.)

---

## 11. File map

**Shared (`packages/designer-ui/src/modules/canvas-interaction/`):**

| File | Role |
|------|------|
| `FlowCanvas.tsx` | Shared ReactFlow canvas (modes, overlay, selection). |
| `context/CanvasModeContext.tsx` | `CanvasMode` + `isEditable` + `ExecutionOverlay`. |
| `readonly/view-types.ts` | View-model types. |
| `readonly/normalize.ts` | `normalizeDefinition`, `toFlowCanvasJson`, `findState`, `findTransition`. |
| `readonly/normalize.vitest.test.ts` | Normalizer tests (node env). |
| `readonly/TransitionFields.tsx` | Shared transition body. |
| `readonly/TransitionInspector.tsx` | Read-only transition panel. |
| `readonly/StateInspector.tsx` | Read-only state panel (tabbed). |
| `readonly/WorkflowMetadataInspector.tsx` | Read-only workflow-level metadata panel. |
| `readonly/index.ts` | Barrel for the read-only layer. |
| `components/panels/tabs/PropertyPanelShared.tsx` | Pure presentational primitives reused by the cores. |

**Monitoring (`apps/monitoring/src/modules/`):**

| File | Role |
|------|------|
| `definitions/workflow/WorkflowCanvas.tsx` | Definition Graph tab (workflow-view + settings toolbox). |
| `instances/components/InstanceWorkflowCanvas.tsx` | Instance state-graph (instance-view + overlay). |
| `instances/components/InstanceStatePanel.tsx` | Execution-overlay slot fragment (state). |
| `instances/components/InstanceTransitionPanel.tsx` | Execution-overlay slot fragment (transition). |

**Testing note:** `designer-ui`'s vitest harness is node-only (`src/**/*.vitest.test.ts`,
no DOM). The pure normalizer is unit-tested; the React inspector cores are verified by
typecheck and by running the monitoring app (no DOM render-test harness exists).
