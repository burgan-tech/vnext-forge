# Permissions View Toggle — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Context

Workflow detail page has a Permissions tab that currently shows four sections (Query Roles, Transition Permissions, Function Permissions, State Query Roles). Sections with empty arrays are hidden entirely. The goal is to add a second view — Full Matrix — that shows all rows even when they have no roles, and let the user toggle between the two.

**Relevant file:** `apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx` (permissions tab: lines 619–761)

---

## State

```ts
const [permView, setPermView] = useState<'filtered' | 'full'>('filtered');
```

- Lives inside the existing `activeTab === 'permissions'` render block.
- Declared alongside the other local state in `WorkflowDetailPage`.
- Resets to `'filtered'` whenever the component unmounts (no persistence needed).

---

## UI — Header Row

Replace the opening `<div className="flex flex-col gap-4">` with a layout that includes a header row above the content:

```
┌─────────────────────────────────────────────────────────┐
│  Permissions                   [ Filtered | Full Matrix ]│
├─────────────────────────────────────────────────────────┤
│  ... sections ...                                        │
└─────────────────────────────────────────────────────────┘
```

Segmented control: two `<button>` elements side by side.
- Active: `bg-muted font-semibold text-foreground`
- Inactive: `text-muted-foreground hover:text-foreground`
- Shared: `rounded px-2.5 py-1 text-xs transition-colors`

---

## Filtered View (default — `permView === 'filtered'`)

Preserves current behavior exactly:

| Section | Render condition |
|---|---|
| Query Roles (badge grid) | `queryRoles.length > 0` |
| Transition Permissions (table) | at least one transition with `roles.length > 0` |
| Function Permissions (table) | at least one function with `roles.length > 0` |
| State Query Roles (table) | at least one state with `queryRoles.length > 0` |

Table rows: only rows with at least one role are rendered.

Empty state: shown when no section has any data — "No permissions defined for this workflow".

---

## Full Matrix View (`permView === 'full'`)

| Section | Render condition | Empty roles display |
|---|---|---|
| Query Roles | Always shown | "No workflow-level query roles" (muted text, no badges) |
| Transition Permissions | Always shown (all rows) | `—` in Roles column (muted) |
| Function Permissions | Only if `functions.length > 0` | `—` in Roles column (muted) |
| State Query Roles | Always shown (all rows) | `—` in Roles column (muted) |

Rows with roles render exactly as in Filtered view (allow/deny badges).

---

## Error Handling

No new error cases. `permMatrix` null/loading state is unchanged — the toggle is only rendered when `permMatrix` is available.

---

## Testing

- Manual: verify Filtered view hides `auto-pass-transition` (no roles); Full Matrix shows it with `—`.
- Manual: verify workflow-level Query Roles section appears in Full Matrix even when `queryRoles` is empty.
- Manual: verify toggle resets to Filtered when navigating away and back.
