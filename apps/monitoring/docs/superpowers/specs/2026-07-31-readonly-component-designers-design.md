# Read-Only Component Designers + Skeleton Loading — Design Spec (Phase 1)

**Date:** 2026-07-31
**Status:** Approved
**Branch:** `f/monitoring-readonly-designers`

---

## Context

The monitoring app observes deployed vNext domains. Its component detail pages
(Extension, Function, View, Schema, Mapping, Task) currently show only a thin
Overview (badges + key/flow grid) and a raw JSON tab. The forge designer
(VS Code extension / web shell) renders rich form-based editors for the same
components. Product goal: **one shared UX language** — the monitoring detail
pages must look like the forge designer forms, but strictly **read-only**
(no mutations, no action buttons).

Second problem: the dashboard and list screens have no loading feedback at all;
during requests the app feels frozen. There is no `Skeleton` primitive in
`designer-ui` (only `Loading.tsx`).

**Established precedent** (commit `cd6f641`): the workflow canvas is already
shared via `packages/designer-ui/src/modules/canvas-interaction/readonly/` —
presentational, props-driven, read-only components that reuse designer
primitives but import no edit-store / Monaco-loader / file-resolver code, so
nothing editor-only leaks into the monitoring bundle. This spec extends that
pattern to the six component types.

**Constraint:** the extension is production-level. Shared code changes must be
additive and default-off; forge behavior must be bit-identical when the new
read-only mechanism is not mounted.

## Decisions (user-approved)

1. **Scope:** all six component detail pages — Extension, Function, View,
   Schema, Mapping, **and Task**. Workflow detail is a later phase (only its
   canvas is already shared). Filtering improvements are also out of scope.
2. **Architecture:** hybrid — new read-only "detail core" components in
   designer-ui that reuse clean props-driven leaf forms via a read-only
   context, and hand-written lightweight read-only counterparts where the
   editor part is store-bound.
3. **Read-only UX:** "quiet read-only" — fields keep the designer form look
   (bordered inputs, normal text color), values are selectable/copyable, no
   focus ring, no disabled-gray styling. Action buttons (add/remove row,
   choose-existing, edit) are **not rendered** at all.
4. **Loading UX:** full skeleton set — a `Skeleton` primitive in
   `designer-ui/ui`, layout-mimicking skeletons for dashboard KPI cards,
   charts, DataTable rows, and detail pages. Refetch-with-data uses a subtle
   opacity + spinner treatment (TanStack Query `isFetching`), never a layout
   jump.

---

## 1. Shared read-only infrastructure (`packages/designer-ui`)

### `FormReadOnlyContext`

New file under `src/ui/` (exported from the `./ui` barrel):

```ts
const FormReadOnlyContext = createContext(false);
export function FormReadOnlyProvider({ children }) { … }   // value fixed to true
export function useFormReadOnly(): boolean;                 // default false
```

Consumed by form primitives. **Default is `false` and no forge shell mounts the
provider, so existing editor behavior is unchanged.**

| Primitive | Behavior when `useFormReadOnly() === true` |
|---|---|
| `Input`, `Textarea` | native `readOnly`, no focus ring, normal text color |
| `Select` | non-interactive, chevron hidden, value in normal color |
| `KVEditor` | rows render as static key/value; add/remove buttons not rendered |
| `TagEditor` | tags render as chips; add input and remove buttons not rendered |
| `ComponentDescriptionField` | read-only text |
| `TaskTypePicker` (and pickers reached through reused leaf forms) | static value display, no dropdown |

Code/script display reuses the existing `JsonCodeField` (`./editor` subpath),
which already supports a `readOnly` variant. Monaco is already part of the
monitoring bundle, so this adds no new weight.

### What is reused vs. rewritten

- **Reused as-is (inside the provider, with a no-op `onChange`):** the ~17
  task-type config forms under `modules/task-editor/forms/` (`HttpTaskForm`,
  `ScriptTaskForm`, `DaprPubSubTaskForm`, …) — they are clean
  `(config, onChange)` props-driven components built on ui primitives. Also the
  clean metadata form layouts where they carry no store dependency.
- **Not reused:** panel-level editor components (`*EditorView`, `*EditorPanel`
  where store-bound), `CsxEditorField` (script-panel store, chrome context,
  choose-dialogs), the schema editor's store-driven tree, save/validation/modal
  chrome (`ComponentValidationSummary`, `OpenVnextComponentInModalButton`, …).

## 2. Per-component detail cores (`modules/component-readonly/`)

New designer-ui module following the `canvas-interaction/readonly` precedent.
All components are presentational and props-driven: input is the component
definition JSON (as returned by the monitor Definitions API), plus an optional
`onNavigateToComponent?(type, key)` callback. References to other components
render as chips; with the callback they become links.

```
modules/component-readonly/
  index.ts                     # public exports (added to the root barrel)
  shared/                      # ReadOnly section shells, reference chips,
                               # metadata section (key/version/domain/flow/
                               # tags/labels/_comment in designer Field layout)
  TaskDetailCore.tsx           # metadata + type badge + type-specific config
                               #   (reuses the task-editor forms read-only)
  ExtensionDetailCore.tsx      # metadata (type/scope/defined flows) + embedded
                               #   task config (reuses TaskDetailCore's config
                               #   section); task ref degrades to chip
  FunctionDetailCore.tsx       # metadata + scope + task composition list +
                               #   .csx script content read-only (JsonCodeField)
  MappingDetailCore.tsx        # metadata + .csx code read-only
  SchemaDetailCore.tsx         # metadata + lightweight presentational JSON
                               #   Schema tree (property, type, required,
                               #   format, x-label) — NOT the store-driven tree
  ViewDetailCore.tsx           # metadata + content section (type/display/
                               #   renderer + content code read-only)
```

Import rules (enforced by review + existing dependency tests where present):
no imports from `store/`, `save-component/` (except pure types), `code-editor/`
(except `JsonCodeField` via `./editor`), `project-workspace/`,
`workspace-fs-events/`, or anything transport-bound.

## 3. Monitoring adoption (`apps/monitoring`)

Each `modules/definitions/<type>/…DetailPage.tsx` keeps its current header
(key, `domain · version`, `VersionPicker`) and tab bar, and changes tabs to:

| Tab | Content |
|---|---|
| **Designer** (default) | the new `<Type>DetailCore` wrapped in `FormReadOnlyProvider` |
| **Definition** | existing `RawJsonViewer` (unchanged) |
| **Preview** (View only) | `PseudoUiViewSurface` from `designer-ui/quickrun` — replaces the existing stub in `ViewPreviewTab.tsx`, using its already-written `buildViewResponse` helper |

Data continues to come from the existing `useComponentDetail` query; no API
layer changes. `onNavigateToComponent` maps to
`/definitions/<type>/<key>` routes.

## 4. Skeleton & loading

### designer-ui

- `Skeleton` primitive in `src/ui/Skeleton.tsx` (theme-aware shimmer,
  `bg-muted` + `animate-pulse`, composable via `className`), exported from the
  `./ui` barrel. Additive; forge can adopt it later.

### monitoring

- `shared/components/skeletons/`: `KpiCardSkeleton`, `ChartSkeleton`,
  `DataTableSkeleton({ columns, rows })`, `DetailPageSkeleton`. Each mimics the
  real layout footprint so content does not jump when data arrives.
- Dashboard sections switch on their query `isLoading` → matching skeleton.
- `DataTable` gains an `isLoading?: boolean` prop → renders skeleton rows using
  the current column definitions.
- Refetch while data exists (`isFetching && !isLoading`): container gets a
  subtle opacity treatment + small inline spinner; layout unchanged.
- Detail pages replace the `Loading…` text with `DetailPageSkeleton`.

## 5. Risk & verification

**Risk surface:** only the ui primitives gain an optional context read
(default-off). No forge shell mounts the provider → no behavior change in the
production extension. Detail cores, Skeleton, and monitoring pages are new
files or monitoring-local edits.

**Verification gates:**

1. `pnpm --filter @vnext-forge-studio/designer-ui test` (346 baseline tests)
2. `pnpm --filter @vnext-forge-studio/monitoring test` (27 baseline tests)
3. `pnpm build` — full monorepo including extension + web + desktop
4. Forge web editor smoke check (editors behave as before — no provider mounted)
5. Monitoring visual verification in the browser (dev server, per detail page
   type + dashboard skeletons)

**New tests:**

- `FormReadOnlyContext` behavior: inputs get `readOnly`, action buttons absent,
  default-off leaves primitives interactive.
- One render test per detail core against a representative component JSON
  fixture (task fixture must cover at least HttpTask + ScriptTask configs).
- Skeleton render tests (DataTable skeleton row/column counts; dashboard
  section switch on `isLoading`).

## Out of scope (later phases)

- Workflow detail page overhaul and detailed filtering (explicitly Phase 2 per
  the user).
- Adopting `Skeleton` inside forge screens.
- Version history (VersionPicker still lists only the current version).
- Any write/action capability in monitoring.
