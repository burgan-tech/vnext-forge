# URL-Persisted Table State (Filter / Search / Sort / Page)

**Date:** 2026-06-27
**Status:** Approved design — ready for implementation plan
**Scope:** `apps/monitoring`

## Problem

Monitoring tables hold filter/search/sort/page state in component memory only. A
URL cannot be shared or reloaded to reproduce a filtered view. Two distinct
filter models exist:

- **GraphQL filter** (instances): a recursive `FilterGroup` tree (AND/OR
  combinators) serialized to a single `?filter=<json>` request param.
- **Left-Hand-Side (LHS) bracket filter** (definitions, etc.): a flat
  `QueryParamFilters` map (`version[eq]=1.0`) sent as native query params.

The existing API serializers (`filterGroupToJson`, `buildInstanceFilterParam`,
`buildTimeRangeFilter`) are **lossy and one-way** (e.g. `contains`→`like`,
single-child group collapse, `in`→array, status/time/search merged). They cannot
reconstruct UI state, so they are unusable for URL round-tripping. We need a
separate, lossless transport.

## Decisions

1. **Opaque token** in the URL (not human-readable native params). Copy-paste
   shareable; carries arbitrary nesting losslessly; one common mechanism for both
   filter models.
2. **Full table state** is carried: filter + search + sort + page.
3. **One token per table**, the URL param keyed by the existing `tableId`
   (`DataTable` already has it). Multiple tables on one page = multiple
   independent params, no collision.
4. **Time range stays separate** (`range`/`from`/`to`, owned by
   `TimeRangeUrlSync`); merged into the request filter at build time. No
   double-carry.

## Architecture — three units

### 1. Codec — `shared/components/data-table/table-state-url.ts`

Pure, dependency-free, shape-agnostic for the filter slot.

```ts
export type TableFilterMode = 'graphql' | 'query-param'

export interface TableUrlState {
  f?: unknown                               // page-defined: FilterGroup | QueryParamFilters | composite
  q?: string                                // search (omit if empty)
  s?: { by: string; dir: 'asc' | 'desc' }   // sort (omit if default)
  p?: number                                // page (omit if 1)
}

// "<tag>~<v>~<base64url(json)>"  e.g. "g~1~eyJmIjp7Li4ufX0"
export function encodeTableState(mode: TableFilterMode, state: TableUrlState): string | null
export function decodeTableState(mode: TableFilterMode, token: string): TableUrlState | null
```

- Tag: `g` (graphql) / `q` (query-param). Version `VERSION = 1`.
- **Encode:** omit empty fields (`q===''`, `p===1`, default sort, `f` null). If
  the whole bundle is empty → return `null` (hook deletes the param → clean URL).
  `base64url` = standard base64 with `+/=`→`-_` and stripped padding, via
  `btoa`/`atob`.
- **Decode → null (silently)** when: tag mismatches `mode`; `v` unknown;
  `atob`/`JSON.parse` throws. Decode does **not** interpret `f`; it returns raw
  JSON. Column validation happens in the page's `onHydrate`, not the codec.

### 2. Hook — `shared/components/data-table/useTableUrlState.ts`

Parametric form of the `TimeRangeUrlSync` pattern.

```ts
export function useTableUrlState(opts: {
  tableId: string
  mode: TableFilterMode
  state: TableUrlState
  onHydrate: (decoded: TableUrlState) => void
}): void
```

- **Hydrate (once, `hydrated` ref guard):** `searchParams.get(tableId)` →
  `decodeTableState`. If valid, call `onHydrate` (page rebuilds its state and
  validates `f` against its own columns). If absent/invalid, do nothing — do not
  write to the URL (keep it clean until the user filters).
- **Mirror (`state` change, first run skipped via `mirrorMounted` ref):**
  `encodeTableState` → `next.set(tableId, token)` or `next.delete(tableId)` when
  null → `setSearchParams(next, { replace: true })`. Mutates **only** its own
  `tableId` param; preserves `range`/`from`/`to` and sibling table tokens via a
  copied `URLSearchParams`.
- Mirror depends on `[state]` only, **not** `pathname` (each table lives on one
  page).
- **No cleanup on unmount** — tab switches that unmount a table keep its param so
  state survives a return.

### 3. Page-level wiring

The page calls the hook because the page owns `filterRoot` / `search` / `sort` /
`page` (DataTable receives them as controlled props). DataTable stays
presentational. Example (WorkflowDetailPage instances tab):

```ts
useTableUrlState({
  tableId: 'workflow-detail-instances',
  mode: 'graphql',
  state: { f: instanceFilterRoot, p: instancePage }, // sort hardcoded → omit
  onHydrate: (d) => {
    if (d.f) setInstanceFilterRoot(validateFilterGroup(d.f, INSTANCE_FILTERABLE_COLUMNS))
    if (d.p) setInstancePage(d.p)
  },
})
```

## Edge cases

| Case | Behavior |
|------|----------|
| Multiple tables / tabs | One param per `tableId`; not deleted on unmount. |
| Time range | Separate params + hook; merged into request via `mergeFilters`. |
| `pathname` change | Mirror bound to `state`, not pathname. |
| Filter change resets page | Existing `page=1` reset preserved; bundle reflects new page. |
| Stale token / removed column | `decode`→null or `onHydrate` column validation drops it; no crash. |
| Mode mismatch (token from other page type) | Tag check → null → ignored. |
| Empty bundle | Param deleted → clean URL. |

## Out of scope / follow-ups

- `apps/monitoring/src/pages/InstanceListPage.tsx` is **dead code** since its
  route was removed (live instances table is now the WorkflowDetailPage instances
  tab). Delete separately; does not affect this design.
- LZ-string compression of the token: deferred (YAGNI) until URLs grow too long.
- FaultsPage uses a hand-rolled table (no DataTable filter UI); URL-state applies
  only where a `DataTable` with a `tableId` is used.

## Testing

1. **Codec (pure):** round-trip identity per mode (nested AND/OR, `in`/`nin`
   arrays, boolean, date, flat `QueryParamFilters`, composite); empty→null;
   robustness (mode mismatch, unknown version, corrupt base64/JSON → null).
2. **Hook (RTL + MemoryRouter):** hydrate-once on valid token; mirror on state
   change (`replace`); empty state deletes param; sibling params preserved;
   invalid token → no `onHydrate`, no crash.
3. **Column validation helper:** drops conditions referencing removed columns;
   empty group when all dropped.
