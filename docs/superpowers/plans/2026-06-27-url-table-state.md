# URL-Persisted Table State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each data table's filter / search / sort / page into a single opaque, shareable URL param keyed by `tableId`, restoring it losslessly on load.

**Architecture:** A pure, dependency-free codec encodes a `TableUrlState` bundle to a mode-tagged base64url token (`g~1~…` / `q~1~…`). Pure `URLSearchParams` read/write helpers wrap the codec. A thin `useTableUrlState` hook bridges those helpers to react-router (hydrate-once on mount, mirror-on-change), mirroring the existing `TimeRangeUrlSync` pattern. Pages own their state and wire the hook with an `onHydrate` callback that validates the decoded filter against the page's own columns.

**Tech Stack:** React 19, react-router-dom v7, TypeScript, Vitest (pure node tests, `.vitest.test.ts`).

## Global Constraints

- All user-visible text and code comments in **English** (vnext-forge product rule).
- No `console.*`; use `createLogger('monitoring/…')` from `@vnext-forge-studio/designer-ui` if logging is needed (not expected here).
- `import.meta.env` only inside `shared/config/config.ts` (not touched here).
- Tests use the repo convention: filename `*.vitest.test.ts`, run via `vitest run`; **pure node only** (no jsdom/RTL exists in the repo). Hook logic is extracted into pure helpers so it is testable without a DOM.
- Test files and the units they cover use **relative imports** within `src/shared/components/data-table/` (matches existing `filter-serializer.ts`); do not rely on `@monitoring/*` alias resolution inside vitest.
- Git commits are made by the developer running the plan; commit messages end with the project's co-author trailer if configured. (Do not auto-push.)

---

## File Structure

- Create: `apps/monitoring/vitest.config.ts` — vitest config (include `src/**/*.vitest.test.ts`).
- Modify: `apps/monitoring/package.json` — add `"test": "vitest run"` script + `vitest` devDependency.
- Create: `apps/monitoring/src/shared/components/data-table/table-state-url.ts` — codec + `URLSearchParams` read/write helpers.
- Create: `apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts` — codec + helper tests.
- Create: `apps/monitoring/src/shared/components/data-table/filter-validate.ts` — `validateFilterGroup` + `validateQueryParamFilters`.
- Create: `apps/monitoring/src/shared/components/data-table/filter-validate.vitest.test.ts` — validation tests.
- Create: `apps/monitoring/src/shared/components/data-table/useTableUrlState.ts` — the React hook.
- Modify: `apps/monitoring/src/shared/components/data-table/index.ts` — barrel exports.
- Modify: `apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx` — wire graphql-mode table.
- Modify: `apps/monitoring/src/pages/DefinitionsPage.tsx` — wire query-param-mode table.

---

### Task 1: Vitest infra + codec round-trip (graphql)

**Files:**
- Create: `apps/monitoring/vitest.config.ts`
- Modify: `apps/monitoring/package.json`
- Create: `apps/monitoring/src/shared/components/data-table/table-state-url.ts`
- Test: `apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts`

**Interfaces:**
- Produces:
  - `type TableFilterMode = 'graphql' | 'query-param'`
  - `interface TableUrlState { f?: unknown; q?: string; s?: { by: string; dir: 'asc' | 'desc' }; p?: number }`
  - `encodeTableState(mode: TableFilterMode, state: TableUrlState): string | null`
  - `decodeTableState(mode: TableFilterMode, token: string): TableUrlState | null`

- [ ] **Step 1: Add vitest config**

Create `apps/monitoring/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.vitest.test.ts'],
  },
});
```

- [ ] **Step 2: Add test script + dep**

In `apps/monitoring/package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
```

and add to `"devDependencies"` (create the block if absent):

```json
    "vitest": "^3.2.4"
```

Then install from the repo root:

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge && corepack pnpm install`
Expected: install completes; `apps/monitoring/node_modules/.bin/vitest` now exists.

- [ ] **Step 3: Write the failing test**

Create `apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeTableState, decodeTableState } from './table-state-url';
import type { FilterGroup } from './types';

const graphqlFilter: FilterGroup = {
  kind: 'group',
  id: 'root',
  combinator: 'and',
  children: [
    { kind: 'condition', id: 'c1', columnId: 'status', operator: 'in', value: 'Active,Busy' },
    {
      kind: 'group',
      id: 'g2',
      combinator: 'or',
      children: [
        { kind: 'condition', id: 'c2', columnId: 'key', operator: 'contains', value: 'tëst' },
      ],
    },
  ],
};

describe('table-state-url codec — graphql round-trip', () => {
  it('round-trips a nested filter + page through encode/decode', () => {
    const state = { f: graphqlFilter, p: 3 };
    const token = encodeTableState('graphql', state);
    expect(token).toBeTruthy();
    expect(token!.startsWith('g~1~')).toBe(true);
    expect(decodeTableState('graphql', token!)).toEqual(state);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: FAIL — `table-state-url` has no export `encodeTableState`.

- [ ] **Step 5: Implement the codec**

Create `apps/monitoring/src/shared/components/data-table/table-state-url.ts`:

```ts
export type TableFilterMode = 'graphql' | 'query-param';

/**
 * The per-table state carried in the URL. `f` is page-defined and opaque to the
 * codec (FilterGroup, QueryParamFilters, or a composite) — the page interprets
 * and validates it on hydrate. Empty fields are omitted by the encoder.
 */
export interface TableUrlState {
  f?: unknown;
  q?: string;
  s?: { by: string; dir: 'asc' | 'desc' };
  p?: number;
}

const MODE_TAG: Record<TableFilterMode, string> = { graphql: 'g', 'query-param': 'q' };
const VERSION = 1;

// UTF-8 safe base64url (works in browser and node 18+).
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isEmptyState(state: TableUrlState): boolean {
  return (
    state.f === undefined &&
    !state.q?.trim() &&
    state.s === undefined &&
    (state.p === undefined || state.p === 1)
  );
}

/**
 * Encodes a table-state bundle into a mode-tagged token: "<tag>~<version>~<base64url>".
 * Returns null when the bundle carries nothing effective (caller should delete the param).
 */
export function encodeTableState(mode: TableFilterMode, state: TableUrlState): string | null {
  if (isEmptyState(state)) return null;

  const payload: TableUrlState = {};
  if (state.f !== undefined) payload.f = state.f;
  if (state.q?.trim()) payload.q = state.q;
  if (state.s !== undefined) payload.s = state.s;
  if (state.p !== undefined && state.p !== 1) payload.p = state.p;

  return `${MODE_TAG[mode]}~${VERSION}~${toBase64Url(JSON.stringify(payload))}`;
}

/**
 * Decodes a token back into a bundle. Returns null (silently) on mode-tag
 * mismatch, unknown version, or any decode/parse failure. Does NOT interpret
 * `f` — column validation is the caller's responsibility.
 */
export function decodeTableState(mode: TableFilterMode, token: string): TableUrlState | null {
  if (!token) return null;
  const sep = token.indexOf('~');
  if (sep === -1) return null;
  const tag = token.slice(0, sep);
  if (tag !== MODE_TAG[mode]) return null;

  const rest = token.slice(sep + 1);
  const sep2 = rest.indexOf('~');
  if (sep2 === -1) return null;
  const version = Number(rest.slice(0, sep2));
  if (version !== VERSION) return null;

  const payload = rest.slice(sep2 + 1);
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as TableUrlState;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/vitest.config.ts apps/monitoring/package.json pnpm-lock.yaml apps/monitoring/src/shared/components/data-table/table-state-url.ts apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts
git commit -m "feat(monitoring): add table-state URL codec + vitest infra"
```

---

### Task 2: Codec — query-param, empty, and robustness cases

**Files:**
- Test: `apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts` (append)

**Interfaces:**
- Consumes: `encodeTableState`, `decodeTableState`, `TableUrlState` from Task 1.

- [ ] **Step 1: Append failing tests**

Add these `describe` blocks to `table-state-url.vitest.test.ts`:

```ts
describe('table-state-url codec — query-param round-trip', () => {
  it('round-trips a flat filter map + search', () => {
    const state = { f: { 'version[eq]': '1.0', 'tags[contains]': 'x' }, q: 'abc' };
    const token = encodeTableState('query-param', state);
    expect(token).toBeTruthy();
    expect(token!.startsWith('q~1~')).toBe(true);
    expect(decodeTableState('query-param', token!)).toEqual(state);
  });

  it('round-trips a sort descriptor', () => {
    const state = { s: { by: 'createdAt', dir: 'desc' as const }, p: 2 };
    const token = encodeTableState('graphql', state)!;
    expect(decodeTableState('graphql', token)).toEqual(state);
  });
});

describe('table-state-url codec — empty + omission', () => {
  it('returns null for a fully empty bundle', () => {
    expect(encodeTableState('graphql', {})).toBeNull();
    expect(encodeTableState('graphql', { q: '   ', p: 1 })).toBeNull();
  });

  it('omits default page and blank search from the payload', () => {
    const token = encodeTableState('graphql', { f: { a: 1 }, q: '', p: 1 })!;
    expect(decodeTableState('graphql', token)).toEqual({ f: { a: 1 } });
  });
});

describe('table-state-url codec — robustness', () => {
  it('rejects a token whose mode tag does not match', () => {
    const token = encodeTableState('graphql', { f: { a: 1 } })!;
    expect(decodeTableState('query-param', token)).toBeNull();
  });

  it('rejects an unknown version', () => {
    expect(decodeTableState('graphql', 'g~9~eyJ9')).toBeNull();
  });

  it('rejects corrupt payloads', () => {
    expect(decodeTableState('graphql', 'g~1~!!!not-base64!!!')).toBeNull();
    expect(decodeTableState('graphql', 'garbage')).toBeNull();
    expect(decodeTableState('graphql', '')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they pass**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: PASS (all codec tests). These exercise existing behavior, so no implementation change is expected.

Note: if `decodeTableState('graphql', 'g~1~!!!not-base64!!!')` does NOT return null (some `atob` implementations are lenient), make the failure deterministic by validating the parsed result is a plain object — already handled by the `typeof parsed !== 'object'` guard. If it still slips through, add at the top of the `try`: `if (/[^A-Za-z0-9\-_]/.test(payload)) return null;` then re-run.

- [ ] **Step 3: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts apps/monitoring/src/shared/components/data-table/table-state-url.ts
git commit -m "test(monitoring): cover codec query-param, empty, and robustness cases"
```

---

### Task 3: URLSearchParams read/write helpers

**Files:**
- Modify: `apps/monitoring/src/shared/components/data-table/table-state-url.ts`
- Test: `apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts` (append)

**Interfaces:**
- Consumes: `encodeTableState`, `decodeTableState`, `TableFilterMode`, `TableUrlState`.
- Produces:
  - `readTableState(params: URLSearchParams, tableId: string, mode: TableFilterMode): TableUrlState | null`
  - `writeTableState(params: URLSearchParams, tableId: string, mode: TableFilterMode, state: TableUrlState): URLSearchParams`

- [ ] **Step 1: Write the failing test**

Append to `table-state-url.vitest.test.ts`:

```ts
import { readTableState, writeTableState } from './table-state-url';

describe('readTableState', () => {
  it('decodes the token at the tableId param', () => {
    const token = encodeTableState('graphql', { f: { a: 1 }, p: 2 })!;
    const params = new URLSearchParams({ 'wf-instances': token, range: 'last-7d' });
    expect(readTableState(params, 'wf-instances', 'graphql')).toEqual({ f: { a: 1 }, p: 2 });
  });

  it('returns null when the param is absent or invalid', () => {
    const params = new URLSearchParams({ other: 'x' });
    expect(readTableState(params, 'wf-instances', 'graphql')).toBeNull();
  });
});

describe('writeTableState', () => {
  it('sets the token at tableId and preserves sibling params', () => {
    const params = new URLSearchParams({ range: 'last-7d', 'other-table': 'g~1~abc' });
    const next = writeTableState(params, 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(next.get('range')).toBe('last-7d');
    expect(next.get('other-table')).toBe('g~1~abc');
    expect(readTableState(next, 'wf-instances', 'graphql')).toEqual({ f: { a: 1 } });
  });

  it('deletes the param when the state is empty', () => {
    const start = writeTableState(new URLSearchParams(), 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(start.has('wf-instances')).toBe(true);
    const cleared = writeTableState(start, 'wf-instances', 'graphql', {});
    expect(cleared.has('wf-instances')).toBe(false);
  });

  it('does not mutate the input params', () => {
    const params = new URLSearchParams({ range: 'last-7d' });
    writeTableState(params, 'wf-instances', 'graphql', { f: { a: 1 } });
    expect(params.has('wf-instances')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: FAIL — no export `readTableState` / `writeTableState`.

- [ ] **Step 3: Implement the helpers**

Append to `table-state-url.ts`:

```ts
/** Reads and decodes the table-state token stored at `tableId` in the given params. */
export function readTableState(
  params: URLSearchParams,
  tableId: string,
  mode: TableFilterMode,
): TableUrlState | null {
  const token = params.get(tableId);
  return token ? decodeTableState(mode, token) : null;
}

/**
 * Returns a NEW URLSearchParams with the `tableId` token set to the encoded
 * state, or removed when the state is empty. All other params are preserved.
 * The input is not mutated.
 */
export function writeTableState(
  params: URLSearchParams,
  tableId: string,
  mode: TableFilterMode,
  state: TableUrlState,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const token = encodeTableState(mode, state);
  if (token) next.set(tableId, token);
  else next.delete(tableId);
  return next;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/shared/components/data-table/table-state-url.ts apps/monitoring/src/shared/components/data-table/table-state-url.vitest.test.ts
git commit -m "feat(monitoring): add URLSearchParams read/write helpers for table state"
```

---

### Task 4: Filter validation helpers (drop stale columns)

**Files:**
- Create: `apps/monitoring/src/shared/components/data-table/filter-validate.ts`
- Test: `apps/monitoring/src/shared/components/data-table/filter-validate.vitest.test.ts`

**Interfaces:**
- Consumes: `FilterGroup`, `FilterNode`, `FilterableColumn` from `./types`; `createEmptyFilterRoot` from `./filter-eval`.
- Produces:
  - `validateFilterGroup(raw: unknown, columns: FilterableColumn[]): FilterGroup`
  - `validateQueryParamFilters(raw: unknown, columns: FilterableColumn[]): Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `apps/monitoring/src/shared/components/data-table/filter-validate.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateFilterGroup, validateQueryParamFilters } from './filter-validate';
import type { FilterableColumn, FilterGroup } from './types';

const columns: FilterableColumn[] = [
  { id: 'status', label: 'Status', type: 'select' },
  { id: 'key', label: 'Key', type: 'text' },
];

describe('validateFilterGroup', () => {
  it('keeps conditions on known columns and drops unknown ones', () => {
    const raw: FilterGroup = {
      kind: 'group', id: 'root', combinator: 'and',
      children: [
        { kind: 'condition', id: 'c1', columnId: 'status', operator: 'eq', value: 'Active' },
        { kind: 'condition', id: 'c2', columnId: 'ghost', operator: 'eq', value: 'x' },
      ],
    };
    const out = validateFilterGroup(raw, columns);
    expect(out.children).toHaveLength(1);
    expect((out.children[0] as { columnId: string }).columnId).toBe('status');
  });

  it('returns an empty root for malformed input', () => {
    const out = validateFilterGroup({ nonsense: true }, columns);
    expect(out.kind).toBe('group');
    expect(out.children).toEqual([]);
  });

  it('recurses into nested groups and prunes empties', () => {
    const raw: FilterGroup = {
      kind: 'group', id: 'root', combinator: 'and',
      children: [
        { kind: 'group', id: 'g', combinator: 'or', children: [
          { kind: 'condition', id: 'c', columnId: 'ghost', operator: 'eq', value: 'x' },
        ] },
      ],
    };
    const out = validateFilterGroup(raw, columns);
    expect(out.children).toEqual([]);
  });
});

describe('validateQueryParamFilters', () => {
  it('keeps entries whose base column exists', () => {
    const out = validateQueryParamFilters(
      { 'key[contains]': 'abc', 'ghost[eq]': 'x', status: 'Active' },
      columns,
    );
    expect(out).toEqual({ 'key[contains]': 'abc', status: 'Active' });
  });

  it('returns an empty object for non-object input', () => {
    expect(validateQueryParamFilters(null, columns)).toEqual({});
    expect(validateQueryParamFilters('nope', columns)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: FAIL — `filter-validate` module not found.

- [ ] **Step 3: Implement the helpers**

Create `apps/monitoring/src/shared/components/data-table/filter-validate.ts`:

```ts
import { createEmptyFilterRoot } from './filter-eval';
import type { FilterCondition, FilterGroup, FilterNode, FilterableColumn } from './types';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sanitizeNode(node: unknown, ids: Set<string>): FilterNode | null {
  if (!isObject(node)) return null;

  if (node.kind === 'condition') {
    const c = node as unknown as FilterCondition;
    if (typeof c.columnId !== 'string' || !ids.has(c.columnId)) return null;
    if (typeof c.operator !== 'string' || typeof c.value !== 'string') return null;
    return { kind: 'condition', id: String(c.id ?? ''), columnId: c.columnId, operator: c.operator, value: c.value };
  }

  if (node.kind === 'group') {
    const g = node as unknown as FilterGroup;
    const children = Array.isArray(g.children)
      ? g.children.map((child) => sanitizeNode(child, ids)).filter((x): x is FilterNode => x !== null)
      : [];
    return {
      kind: 'group',
      id: String(g.id ?? ''),
      combinator: g.combinator === 'or' ? 'or' : 'and',
      children,
    };
  }

  return null;
}

/**
 * Rebuilds a clean FilterGroup from untrusted input (e.g. a URL-decoded value),
 * dropping conditions that reference columns not in `columns` and pruning groups
 * that become empty. Returns an empty root when the input is unusable.
 */
export function validateFilterGroup(raw: unknown, columns: FilterableColumn[]): FilterGroup {
  const ids = new Set(columns.map((c) => c.id));
  const sanitized = sanitizeNode(raw, ids);
  if (!sanitized || sanitized.kind !== 'group') return createEmptyFilterRoot();
  // Prune nested groups that ended up empty.
  sanitized.children = sanitized.children.filter(
    (child) => child.kind === 'condition' || child.children.length > 0,
  );
  return sanitized;
}

/**
 * Filters a query-param map down to entries whose base column id (the part
 * before any `[operator]`) exists in `columns`. Returns an empty object for
 * non-object input.
 */
export function validateQueryParamFilters(
  raw: unknown,
  columns: FilterableColumn[],
): Record<string, string> {
  if (!isObject(raw)) return {};
  const ids = new Set(columns.map((c) => c.id));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const base = key.includes('[') ? key.slice(0, key.indexOf('[')) : key;
    if (ids.has(base)) out[key] = value;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/shared/components/data-table/filter-validate.ts apps/monitoring/src/shared/components/data-table/filter-validate.vitest.test.ts
git commit -m "feat(monitoring): add filter validation helpers for URL hydration"
```

---

### Task 5: useTableUrlState hook + barrel exports

**Files:**
- Create: `apps/monitoring/src/shared/components/data-table/useTableUrlState.ts`
- Modify: `apps/monitoring/src/shared/components/data-table/index.ts`

**Interfaces:**
- Consumes: `readTableState`, `writeTableState`, `TableFilterMode`, `TableUrlState` from `./table-state-url`; `useSearchParams` from `react-router-dom`.
- Produces: `useTableUrlState(opts: { tableId: string; mode: TableFilterMode; state: TableUrlState; onHydrate: (decoded: TableUrlState) => void }): void`

- [ ] **Step 1: Implement the hook**

Create `apps/monitoring/src/shared/components/data-table/useTableUrlState.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { readTableState, writeTableState, type TableFilterMode, type TableUrlState } from './table-state-url';

interface UseTableUrlStateOptions {
  /** URL param name — use the table's `tableId`. */
  tableId: string;
  mode: TableFilterMode;
  /** The page's current table-state bundle (controlled). */
  state: TableUrlState;
  /** Called once on mount if the URL holds a valid token for this table. */
  onHydrate: (decoded: TableUrlState) => void;
}

/**
 * Bridges a data table's state and the URL, keyed by `tableId`. On first mount a
 * valid token in the URL is decoded and pushed into the page via `onHydrate`
 * (URL wins). Afterwards, state changes are mirrored back to the URL (replace, so
 * history is not spammed). Only the table's own param is touched — time-range and
 * sibling tables are preserved. Renders nothing.
 *
 * Hook logic is intentionally thin; the encode/decode/merge behavior lives in the
 * pure helpers in ./table-state-url, which carry the unit tests.
 */
export function useTableUrlState({ tableId, mode, state, onHydrate }: UseTableUrlStateOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);
  const mirrorMounted = useRef(false);

  // Hydrate once. If there is no valid token, do nothing (keep the URL clean
  // until the user actually filters).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const decoded = readTableState(searchParams, tableId, mode);
    if (decoded) onHydrate(decoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror state -> URL on change. Skip the first run so we don't clobber a token
  // that the hydrate effect just consumed (both fire in the same commit).
  useEffect(() => {
    if (!mirrorMounted.current) {
      mirrorMounted.current = true;
      return;
    }
    const next = writeTableState(searchParams, tableId, mode, state);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
```

- [ ] **Step 2: Add barrel exports**

In `apps/monitoring/src/shared/components/data-table/index.ts`, append:

```ts
export { useTableUrlState } from './useTableUrlState'
export {
  encodeTableState,
  decodeTableState,
  readTableState,
  writeTableState,
} from './table-state-url'
export type { TableFilterMode, TableUrlState } from './table-state-url'
export { validateFilterGroup, validateQueryParamFilters } from './filter-validate'
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/shared/components/data-table/useTableUrlState.ts apps/monitoring/src/shared/components/data-table/index.ts
git commit -m "feat(monitoring): add useTableUrlState hook + barrel exports"
```

---

### Task 6: Wire WorkflowDetailPage instances table (graphql mode)

**Files:**
- Modify: `apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx`

**Interfaces:**
- Consumes: `useTableUrlState`, `validateFilterGroup`, `countConditions` (from `./filter-eval`, re-exported by the barrel), `INSTANCE_FILTERABLE_COLUMNS`.
- Existing state used: `instanceFilterRoot` / `setInstanceFilterRoot` (FilterGroup), `instancePage` / `setInstancePage` (number).

- [ ] **Step 1: Import the hook and helpers**

In `WorkflowDetailPage.tsx`, extend the existing import from `@monitoring/shared/components/data-table` (which already imports `createEmptyFilterRoot`, `filterGroupToJson`, types) to also include:

```ts
  countConditions,
  useTableUrlState,
  validateFilterGroup,
```

- [ ] **Step 2: Add the hook call**

Immediately after the `instanceFilterJson` `useMemo` (around line 286), add:

```ts
  useTableUrlState({
    tableId: 'workflow-detail-instances',
    mode: 'graphql',
    state: {
      f: countConditions(instanceFilterRoot) > 0 ? instanceFilterRoot : undefined,
      p: instancePage,
    },
    onHydrate: (decoded) => {
      if (decoded.f) setInstanceFilterRoot(validateFilterGroup(decoded.f, INSTANCE_FILTERABLE_COLUMNS));
      if (typeof decoded.p === 'number') setInstancePage(decoded.p);
    },
  });
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run the dev server: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge && corepack pnpm --filter @vnext-forge-studio/monitoring dev` (port 3100).
1. Open a workflow detail page, go to the Instances tab, add a filter condition (e.g. status = Active) and move to page 2.
2. Confirm the URL gains a `workflow-detail-instances=g~1~…` param.
3. Copy the URL, open it in a new tab. Confirm the filter and page are restored and the table shows the filtered result.
4. Confirm the existing `range`/`from`/`to` time-range params are still present and unchanged.

- [ ] **Step 5: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx
git commit -m "feat(monitoring): persist workflow instances table state in URL"
```

---

### Task 7: Wire DefinitionsPage table (query-param mode)

**Files:**
- Modify: `apps/monitoring/src/pages/DefinitionsPage.tsx`

**Interfaces:**
- Consumes: `useTableUrlState`, `validateQueryParamFilters`, `QueryParamFilters`, `FILTERABLE_COLUMNS`.
- Existing state used: `queryParamFilters` / `setQueryParamFilters`, `searchDraft` / `setSearchDraft`, `search` (debounced), `page` / `setPage`.

**Note on hydration ordering:** DefinitionsPage has an effect that resets `page` to 1 whenever the debounced `search` changes. On first load, hydrating a search term would make `search` transition `'' → term`, firing that effect and clobbering the hydrated page. Guard the reset effect with a ref so it is skipped on the initial hydration cycle.

- [ ] **Step 1: Add imports**

In `DefinitionsPage.tsx`, add `useRef` to the existing `react` import, and add to the `@monitoring/shared/components/data-table` import:

```ts
  useTableUrlState,
  validateQueryParamFilters,
```

- [ ] **Step 2: Guard the search→page-reset effect**

Find the effect that resets the page when `search` changes (around lines 138-140):

```ts
  // Reset to page 1 when the debounced search term changes
  useEffect(() => {
    setPage(1);
  }, [search]);
```

Replace it with a ref-guarded version that skips the first run (so initial hydration is not clobbered):

```ts
  // Reset to page 1 when the debounced search term changes — but not on the
  // initial hydration pass, where a restored page must survive the first
  // '' -> term transition of the debounced search.
  const searchResetMounted = useRef(false);
  useEffect(() => {
    if (!searchResetMounted.current) {
      searchResetMounted.current = true;
      return;
    }
    setPage(1);
  }, [search]);
```

- [ ] **Step 3: Add the hook call**

After the `apiFilters` `useMemo` (around line 146), add:

```ts
  const urlFilterColumns = FILTERABLE_COLUMNS[defType] ?? [];
  useTableUrlState({
    tableId: `definitions-${defType}`,
    mode: 'query-param',
    state: {
      f: Object.keys(queryParamFilters).length > 0 ? queryParamFilters : undefined,
      q: search,
      p: page,
    },
    onHydrate: (decoded) => {
      if (decoded.f) {
        setQueryParamFilters(validateQueryParamFilters(decoded.f, urlFilterColumns) as QueryParamFilters);
      }
      if (typeof decoded.q === 'string') setSearchDraft(decoded.q);
      if (typeof decoded.p === 'number') setPage(decoded.p);
    },
  });
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm exec tsc -b`
Expected: no errors.

- [ ] **Step 5: Manual verification**

With the dev server running:
1. Open Definitions → Workflows. Add a filter (e.g. `version` contains `1`), type a search term, go to page 2.
2. Confirm the URL gains `definitions-workflow=q~1~…`.
3. Open the copied URL in a new tab. Confirm the search box, filter panel, and page are all restored and the list is filtered.
4. Switch the definition type (e.g. to Tasks) and confirm the param key changes to `definitions-task` and the workflow token is left untouched.

- [ ] **Step 6: Commit**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add apps/monitoring/src/pages/DefinitionsPage.tsx
git commit -m "feat(monitoring): persist definitions table state in URL"
```

---

### Task 8: Final verification (build + lint + full test run)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm test`
Expected: all codec + validation tests PASS.

- [ ] **Step 2: Typecheck + build**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm build`
Expected: `tsc -b` + `vite build` succeed with no errors.

- [ ] **Step 3: Lint**

Run: `cd /Users/UST951/Burgan/monitoring-ui/vnext-forge/apps/monitoring && corepack pnpm lint`
Expected: no new lint errors in the created/modified files. (If the two `eslint-disable-next-line react-hooks/exhaustive-deps` comments in `useTableUrlState.ts` are flagged as unused because the project uses a different hooks-rule name, match the disable to the rule name used elsewhere in the repo — e.g. `react-x/exhaustive-deps` as seen in `TimeRangeUrlSync.tsx`.)

- [ ] **Step 4: Final commit (if lint adjustments were needed)**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
git add -A
git commit -m "chore(monitoring): lint + verification fixes for URL table state"
```

---

## Out of Scope (from the spec)

- `apps/monitoring/src/pages/InstanceListPage.tsx` is dead code (route removed). Delete in a separate change.
- LZ-string compression of tokens — deferred (YAGNI).
- `FaultsPage` uses a hand-rolled table without `DataTable` filter UI; URL-state is not wired there.
- `pageSize` is intentionally not carried in the URL bundle (the spec scopes the bundle to filter + search + sort + page); each table keeps its own default page size.
