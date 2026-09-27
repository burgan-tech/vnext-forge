# vNext Runtime Sync — Phase D (Schema editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the schema editor author attribute indexing the way the September 2026 runtime enforces it (free-text `attributes.type`, `x-indexed` eligibility, runtime filter-operator spellings), make QuickRunner's instance filter schema-aware, warn in the flow designer about non-master schemas with `x-indexed`, and give the web code editor's Monaco the project-pinned vnext-schema.

**Architecture:** Every rule lives in a small pure, unit-tested module: `filterOperators` (D4 spellings), `indexEligibility` (a line-by-line mirror of runtime `AttributeIndexDefinition.Visit` producing one `{ eligible, reason }` per schema node), `indexValidationMessages` (save-time translation of AJV noise), `masterSchemaFields` (mirror of runtime `SchemaFilterMetadataResolver` + `SchemaFilterContext.IsOperatorAllowed`), `loadSchemaComponent` / `workflowMasterSchema` (dependency-injected loaders). Components are thin: store-bound shells (`XIndexedCard`, `PropertyTreeNode`, `WorkflowSchemaSection`, `InstanceListPanel`) only feed props into presentational views that the SSR harness (`renderToStaticMarkup`) asserts. Monaco gets the pinned schema through a `schemaVersion` parameter on `validate/getAllSchemas`, which services-core already knows how to resolve (`schemaCacheService`, bundled fallback, forward-port patches).

**Tech Stack:** TypeScript 5.7, React 19, zustand + immer, zod, lucide-react, vitest 3 (`renderToStaticMarkup`), Hono (server route), Monaco (`@monaco-editor/react`), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (Phase D: D1–D6; the A2 note "Serving Monaco the project-pinned version instead of the bundled one moves to Phase D"; Decision D7; builds on Phase A A2/A3.4 and Phase B B5)

## Global Constraints

- All development happens in vnext-forge only; `vnext`, `vnext-schema`, `vnext-example`, `vnext-workflow-cli` (siblings under `/Users/U0B006/Documents/repos/burgan-tech/`) are read-only references.
- All user-visible strings are English (repo rule in `CLAUDE.md`). Do not put a raw `'` or `"` in JSX text; rephrase instead. Messages that end up in `title="…"` attributes contain no quotes or apostrophes (SSR escapes them and the tests match plain text).
- Branch: `f/vnext-runtime-sync`. Phase start commit: `7e75725`. Commit only at the Commit steps; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Decision D7 (verbatim): "Filter operators: Forge writes the **runtime spellings** (`gte`, `lte`, `neq`, `contains`, …) and never drops unknown values."
- Runtime operator spellings (D4, verbatim): `eq neq gt gte lt lte between contains startsWith endsWith in nin isNull includes`; legacy spellings read and normalized for display: `ge le ne like match` (plus the old lowercase `startswith endswith isnull`).
- Client-side filter limits (D5, verbatim): "≤ 1000 chars per value (per element for `in`/`nin`/`between`), ≤ 5000 total" — runtime `InputValidator.MaxValueLength = 1000`, `MaxFilterLength = 5000`.
- Only the exact `attributes.type` value `master` permits `x-indexed` (runtime `SchemaComponentValidator` → `AttributeIndexDefinition.ValidateSchema(schema, schema.Type)`; `MASTER`, blank, missing are not master).
- designer-ui never imports `@vnext-forge-studio/services-core` (dependency policy). `apps/web` never imports services-core.
- Every task leaves its packages compiling: run `pnpm --filter @vnext-forge-studio/designer-ui build` (`tsc -b`) before each designer-ui commit; services-core / server / web tasks name their own build commands. designer-ui `tsconfig.json` excludes only `*.vitest.test.ts`; `*.vitest.test.tsx` files are compiled by `tsc -b` and must type-check.
- Test commands: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run <path relative to packages/designer-ui>`, `pnpm --filter @vnext-forge-studio/services-core exec vitest run <path relative to packages/services-core>`, `pnpm --filter @vnext-forge-studio/server exec vitest run <path relative to apps/server>`. The server tests import the **built** services-core: run `pnpm --filter @vnext-forge-studio/services-core build` first.
- Component tests: `renderToStaticMarkup`. Components under test take props; the only exception is the schema-editor store, which the existing `VNextTab.vitest.test.tsx` seeds on both `getState()` and `getInitialState()` (the SSR snapshot) — reuse that `seed` pattern where a test must render a store-bound card.
- Method-signature change (Task 12) follows `.cursor/rules/rpc-method-policy.mdc`: params zod, fixture under `packages/services-core/test/fixtures/validate/`, `MethodHttpSpec` unchanged (`GET` / `query`), server route unchanged (one-liner via `createDispatchHelper`), sorted-names snapshot unchanged, `policy.ts` unchanged (`public`).
- Runtime facts this plan mirrors (read-only sources): eligibility — `vnext/src/BBT.Workflow.Domain/Definitions/Schemas/AttributeIndexDefinition.cs` `Visit` + `From`; operator allowance — `SchemaFilterContext.cs` (`ToSchemaOperator`, case-insensitive `Contains`); field collection — `SchemaFilterMetadataResolver.cs`; which operators read the index projection — `vnext/src/BBT.Workflow.Domain/QueryExtensions/AttributeConditionBuilder.cs` (`storage` switch: comparisons → numeric/timestamptz, `like match startswith endswith in nin isnull` → text, `eq ne includes` → none); limits — `vnext/src/BBT.Workflow.Domain/Security/InputValidator.cs`. Test cases are ported from `vnext-schema/test/validate-schema-documents.js`, `vnext/test/BBT.Workflow.Domain.Tests/QueryExtensions/AttributeIndexTests.cs`, `…/Definitions/Schemas/SchemaFilterMetadataResolverTests.cs` and `vnext/test/BBT.Workflow.Application.Tests/Definitions/Validators/SchemaComponentValidatorTests.cs`.
- Lint only touched files against the phase start commit; per-package `eslint .` is pre-existing red. The shared eslint config is `recommendedTypeChecked` + `stylisticTypeChecked` + `no-duplicate-imports` + inline `consistent-type-imports`, so in new and edited code: no `any` / unsafe member access (cast `unknown` to a local shape first), `??` instead of `||` on nullable operands, `interface` for object types, `T[]` not `Array<T>`, no empty functions (tests use `() => undefined`), no `async` function without `await` in linted files (`.tsx` tests included; use `Promise.resolve`), `void` on floating promises, one import per module. `*.vitest.test.ts` files are outside the tsconfig and are not linted.

## Decisions made while planning (spec ambiguities)

| Topic | Choice | Why |
|---|---|---|
| Modeling `attributes.type` (D1) | The load schema gets a permissive `attributes.type: z.unknown().optional()` entry; the typed accessor `readSchemaAttributesType` (string or `undefined`) and writer `setSchemaAttributesType` are what the UI uses. Root `type` is removed from the zod shape (passthrough still preserves it on disk). | The load schema's contract is "legacy files still open for repair"; a strict `z.string()` would refuse to open a file with a numeric `attributes.type`. |
| Combobox behaviour (D1) | Native `<input list>` + `<datalist>` (`master`, `schema`, `view`, `headers`); commits on blur/Enter; blank input reverts. | `attributes.type` is a required string in every vnext-schema version; free text stays allowed. |
| Default `master` (D1) | Only the workflow Master Schema section passes `schemaType="master"` to `CreateNewComponentDialog`; the dialog's default stays `workflow` and `vnextComponentTemplates` keeps `schema`. | Spec scopes the default to that section; other pickers (transition/view schemas) are not master schemas. |
| Reason precedence (D2) | One reason per node: `notMaster` → `root` → first blocking ancestor reason (`dynamicLocation`, `composition`, `parentNotObject`, `invalidPath` for a `.` in a property name) → `invalidPath` (regex) → `notScalar`. Violations add `notBoolean` (checked after `notMaster`, like the runtime). | The runtime throws one generic message; Forge needs one actionable reason. Eligibility itself is exactly `Visit`. |
| `x-indexed: false` | Allowed anywhere in a master schema, rejected anywhere in a non-master schema. | Runtime `Visit` only rejects `true` on ineligible nodes; vnext-schema `unindexableMasterSchema` allows `const: false`. |
| Ineligible toggle (D3) | Disabled only while unset; a value already set stays removable and shows the violation. | Never trap existing data. |
| Save-time translation (D2) | Only when Forge finds at least one violation: drop AJV errors at/under `/attributes/schema` (keeping `minProperties` and `type: object`) and the root `if/then/else` error; prepend one readable entry per violating node at `/attributes/schema<pointer>`. | Under master rules every AJV error below `attributes.schema` comes from the index rules (captured with AJV on vnext-schema master); unrelated errors stay. |
| Operator normalization (D4) | Case-insensitive match of the runtime spelling or a legacy alias; `like` and `match` both become `contains` (deduplicated). Legacy pairs are listed under the card and rewritten only on the next user change. | D7; the runtime compares case-insensitively and maps `like`/`match` to `contains`. |
| QuickRunner allowance (D5) | Mirrors `SchemaFilterContext.IsOperatorAllowed`: wire operator → schema spelling → case-insensitive exact match in `x-filterOperators`. A legacy `ge` in the schema does **not** allow `ge` filters (the runtime rejects them too). | Show what the runtime accepts. |
| Unknown / unfilterable attribute paths (D5) | Keep the type-based operator list and show a notice (not declared / no `x-filterOperators` / no operator fits the value type). | The runtime's enforcement can be switched off; free paths must stay possible. |
| IDX hint (D5) | Badge on indexed fields (path suggestions, filter rows, sort options); the row tooltip says whether the chosen operator reads the index column (comparisons, text, `in`/`nin`, `isNull`) or uses JSON containment (`eq`, `ne`, `includes`). | `AttributeConditionBuilder` storage switch. |
| Local master schema lookup (D5/D6) | designer-ui resolves it itself: workflow file via `useWorkflowFileResolver` (quiet), `attributes.schema` reference, schema component by key via `vnext/schemas/list` (same domain preferred), `files/read`. No host (web/extension) plumbing. | Works in both shells with the transports they already register (as the Correlations tab does). |
| Limits (D5) | 1000 characters per scalar raw value (each `in`/`nin` element, each `between` bound, text operators); `includes` JSON is not measured; 5000 characters for the serialized `filter` JSON. | `InputValidator.MaxValueLength` applies to scalar operands; `MaxFilterLength` to the JSON string. |
| Monaco pinned schema (A2 → D) | `validate/getAllSchemas` gains optional `schemaVersion` (`getAllSchemasVersioned`, bundled fallback on failure). Monaco JSON validation is wired in the web shell's `CodeEditorPage` only. | That is the only Monaco editor for whole component files; the extension edits JSON in VS Code's own editor. Today the registration is dead code (`setupMonaco` has no caller) and `JsonSchemaRegistry` expects a `{ schemas, types }` shape the method never returned — both fixed here. |

## File Map

| File | Responsibility |
|---|---|
| `.../schema-editor/components/tree-editor/vnext/filterOperators.ts` | D4 runtime spellings, legacy aliases, split/merge |
| `.../schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.tsx` | D4 card |
| `.../schema-editor/SchemaEditorSchema.ts` | D1 `attributes.type` model, accessor/writer, suggestions |
| `.../schema-editor/components/SchemaTypeField.tsx` (new) | D1 combobox |
| `.../schema-editor/components/SchemaMetadataForm.tsx` | D1 wiring |
| `.../canvas-interaction/components/panels/tabs/createNewComponentTemplates.ts` (new) | templates moved out of the dialog; `schemaType` option |
| `.../canvas-interaction/components/panels/tabs/CreateNewComponentDialog.tsx` | `schemaType` prop |
| `.../canvas-interaction/components/panels/sections/WorkflowSchemaSection.tsx` | D1 default `master`, D6 warning |
| `.../schema-editor/model/indexEligibility.ts` (new) | D2 mirror of `Visit`, violations, columns, mismatch |
| `.../schema-editor/model/indexValidationMessages.ts` (new) | D2 save-time translation |
| `.../schema-editor/useSchemaEditor.ts` | D2 wiring at save |
| `.../schema-editor/components/tree-editor/vnext/XIndexedCard.tsx` (new) | D3 card (view + store shell) |
| `.../schema-editor/components/tree-editor/vnext/vnextCardRegistry.ts`, `.../schema-editor/model/recognizedKeywords.ts` | D3 registration |
| `.../schema-editor/model/mutators.ts` | `removeIndexedKeywords` |
| `.../schema-editor/components/tree-editor/property-tree/IndexBadge.tsx` (new), `PropertyTreeNode.tsx` | D3 IDX badge |
| `.../schema-editor/components/IndexedTypeMismatchBanner.tsx` (new), `SchemaEditorPanel.tsx` | D3 banner |
| `.../vnext-workspace/loadSchemaComponent.ts` (new), `useSchemaComponentJson.ts` (new) | shared schema component loader (D5/D6) |
| `.../canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.tsx` (new) | D6 warning view |
| `.../quick-run/utils/instanceFilterSerializer.ts` | D5 limits |
| `.../quick-run/utils/masterSchemaFields.ts` (new), `workflowMasterSchema.ts` (new) | D5 field model and loader |
| `.../quick-run/hooks/useWorkflowMasterSchema.ts` (new) | D5 hook |
| `.../quick-run/components/InstanceFilterPanel.tsx`, `InstanceListPanel.tsx` | D5 UI |
| `packages/services-core/src/services/validate/validate.service.ts`, `src/registry/method-registry.ts` | `getAllSchemasVersioned`, param |
| `packages/services-core/test/validate/get-all-schemas-versioned.test.ts` (new), `test/fixtures/validate/getAllSchemas.json` (new) | tests + fixture |
| `apps/server/src/__tests__/api/validate.test.ts` | query forwarding test |
| `.../code-editor/editor/JsonSchemaRegistry.ts`, `JsonSchemaSetup.ts`, `packages/designer-ui/src/index.ts` | per-version cache, schema builder, export |
| `apps/web/src/pages/code-editor/CodeEditorPage.tsx` | Monaco registration with the pinned version |

(`...` = `packages/designer-ui/src/modules`.)

---

### Task 1: Filter operators use the runtime spellings (D4)

**Files:**
- Modify (rewrite): `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.ts`
- Modify (rewrite): `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.tsx`
- Test (rewrite): `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts`
- Test (new): `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.vitest.test.tsx`

**Interfaces:**
- Consumes: Phase A `splitOperators` / `mergeOperators` (same names, extended result).
- Produces: `FILTER_OPERATORS` (14 runtime spellings), `type FilterOperator`, `type FilterOperatorCategory`, `FILTER_OPERATOR_CATEGORIES`, `LEGACY_OPERATOR_ALIASES`, `normalizeOperator(raw: string): FilterOperator | null`, `interface LegacySpelling { raw: string; normalized: FilterOperator }`, `interface SplitOperators { known: FilterOperator[]; unknown: string[]; legacy: LegacySpelling[] }`, `splitOperators(value: unknown): SplitOperators`, `mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[]`.

- [ ] **Step 1: Write the failing tests**

Replace `filterOperators.vitest.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import { FILTER_OPERATORS, mergeOperators, normalizeOperator, splitOperators } from './filterOperators';

describe('FILTER_OPERATORS', () => {
  it('lists exactly the runtime spellings', () => {
    expect(FILTER_OPERATORS.map((o) => o.value)).toEqual([
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between',
      'contains', 'startsWith', 'endsWith', 'in', 'nin', 'includes', 'isNull',
    ]);
  });
});

describe('normalizeOperator', () => {
  it('keeps runtime spellings and matches them case-insensitively', () => {
    expect(normalizeOperator('gte')).toBe('gte');
    expect(normalizeOperator('GTE')).toBe('gte');
    expect(normalizeOperator('startswith')).toBe('startsWith');
    expect(normalizeOperator('isnull')).toBe('isNull');
  });

  it('maps legacy spellings', () => {
    expect(normalizeOperator('ge')).toBe('gte');
    expect(normalizeOperator('le')).toBe('lte');
    expect(normalizeOperator('ne')).toBe('neq');
    expect(normalizeOperator('like')).toBe('contains');
    expect(normalizeOperator('match')).toBe('contains');
    expect(normalizeOperator('endswith')).toBe('endsWith');
  });

  it('returns null for unknown values', () => {
    expect(normalizeOperator('regex')).toBeNull();
  });
});

describe('splitOperators', () => {
  it('treats runtime spellings as known, in authored order', () => {
    expect(splitOperators(['contains', 'eq', 'gte'])).toEqual({
      known: ['contains', 'eq', 'gte'],
      unknown: [],
      legacy: [],
    });
  });

  it('normalizes legacy spellings and reports each one', () => {
    expect(splitOperators(['ge', 'like', 'match', 'eq'])).toEqual({
      known: ['gte', 'contains', 'eq'],
      unknown: [],
      legacy: [
        { raw: 'ge', normalized: 'gte' },
        { raw: 'like', normalized: 'contains' },
        { raw: 'match', normalized: 'contains' },
      ],
    });
  });

  it('keeps unknown values verbatim, once, and ignores non-strings', () => {
    expect(splitOperators(['eq', 'regex', 3, 'regex'])).toEqual({ known: ['eq'], unknown: ['regex'], legacy: [] });
  });

  it('returns empty lists for non-arrays', () => {
    expect(splitOperators(undefined)).toEqual({ known: [], unknown: [], legacy: [] });
  });
});

describe('mergeOperators', () => {
  it('writes runtime spellings in canonical order followed by unknown values', () => {
    expect(mergeOperators(new Set(['isNull', 'lte', 'eq']), ['regex'])).toEqual(['eq', 'lte', 'isNull', 'regex']);
  });
});
```

Create `XFilterOperatorsCard.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { FILTER_OPERATORS } from './filterOperators';
import { XFilterOperatorsCard } from './XFilterOperatorsCard';

function doc(operators: unknown[]): Record<string, unknown> {
  return {
    key: 'orders',
    version: '1.0.0',
    domain: 'core',
    flow: 'sys-schemas',
    attributes: {
      type: 'master',
      schema: { type: 'object', properties: { amount: { type: 'number', 'x-filterOperators': operators } } },
    },
  };
}

/** Same seeding as `VNextTab.vitest.test.tsx`: live state + the SSR snapshot. */
function seed(json: Record<string, unknown>): void {
  useSchemaEditorStore.getState().setComponent(json, '');
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: json, filePath: '' });
}

afterEach(() => {
  useSchemaEditorStore.getState().clear();
  Object.assign(useSchemaEditorStore.getInitialState(), { componentJson: null, filePath: null });
});

function checkboxTag(html: string, op: string): string {
  return new RegExp(`<button[^>]*id="filter-op-_properties_amount-${op}"[^>]*>`).exec(html)?.[0] ?? '';
}

const render = (): string => renderToStaticMarkup(createElement(XFilterOperatorsCard, { pointer: '/properties/amount' }));

describe('XFilterOperatorsCard', () => {
  it('offers every runtime spelling', () => {
    seed(doc(['eq']));
    const html = render();
    for (const op of FILTER_OPERATORS) expect(checkboxTag(html, op.value)).not.toBe('');
  });

  it('shows legacy spellings as runtime operators without writing anything', () => {
    const json = doc(['ge', 'like', 'regex']);
    seed(json);
    const html = render();

    expect(checkboxTag(html, 'gte')).toContain('aria-checked="true"');
    expect(checkboxTag(html, 'contains')).toContain('aria-checked="true"');
    expect(checkboxTag(html, 'lt')).toContain('aria-checked="false"');
    expect(html).toContain('ge → gte');
    expect(html).toContain('like → contains');
    expect(html).toContain('regex');

    expect(useSchemaEditorStore.getState().isDirty).toBe(false);
    expect(useSchemaEditorStore.getState().componentJson).toBe(json);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.vitest.test.tsx`
Expected: FAIL — `normalizeOperator` is not exported; the operator list still holds `ne`/`ge`/…; no `legacy` field.

- [ ] **Step 3: Rewrite `filterOperators.ts`**

```ts
/**
 * `x-filterOperators` spellings the runtime matches. The runtime maps the wire
 * operator of a filter (`ge`, `like`, …) to its schema spelling
 * (`SchemaFilterContext.ToSchemaOperator`) and looks it up case-insensitively in
 * this list, so only these spellings grant a filter. Grouped by category for the
 * picker only — persisted strings are the bare values.
 *
 * Decision D7: Forge writes these spellings and never drops a value it does not
 * know.
 */
export const FILTER_OPERATORS = [
  { value: 'eq', category: 'Equality' },
  { value: 'neq', category: 'Equality' },
  { value: 'gt', category: 'Comparison' },
  { value: 'gte', category: 'Comparison' },
  { value: 'lt', category: 'Comparison' },
  { value: 'lte', category: 'Comparison' },
  { value: 'between', category: 'Comparison' },
  { value: 'contains', category: 'Text' },
  { value: 'startsWith', category: 'Text' },
  { value: 'endsWith', category: 'Text' },
  { value: 'in', category: 'Membership' },
  { value: 'nin', category: 'Membership' },
  { value: 'includes', category: 'Membership' },
  { value: 'isNull', category: 'Presence' },
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];
export type FilterOperatorCategory = (typeof FILTER_OPERATORS)[number]['category'];

export const FILTER_OPERATOR_CATEGORIES: readonly FilterOperatorCategory[] = [
  'Equality',
  'Comparison',
  'Text',
  'Membership',
  'Presence',
];

/** Spellings of the old view vocabulary enum → runtime spelling. */
export const LEGACY_OPERATOR_ALIASES: Readonly<Record<string, FilterOperator>> = {
  ne: 'neq',
  ge: 'gte',
  le: 'lte',
  like: 'contains',
  match: 'contains',
  startswith: 'startsWith',
  endswith: 'endsWith',
  isnull: 'isNull',
};

const BY_LOWERCASE: ReadonlyMap<string, FilterOperator> = new Map<string, FilterOperator>([
  ...FILTER_OPERATORS.map((o): [string, FilterOperator] => [o.value.toLowerCase(), o.value]),
  ...Object.entries(LEGACY_OPERATOR_ALIASES),
]);

/** Runtime spelling for `raw` (exact, case-insensitive or legacy alias), or `null` when unknown. */
export function normalizeOperator(raw: string): FilterOperator | null {
  return BY_LOWERCASE.get(raw.trim().toLowerCase()) ?? null;
}

export interface LegacySpelling {
  raw: string;
  normalized: FilterOperator;
}

export interface SplitOperators {
  /** Runtime spellings in authored order, deduplicated. */
  known: FilterOperator[];
  /** Values Forge does not know, verbatim — they survive every edit. */
  unknown: string[];
  /** Authored values that were respelled for display (rewritten on the next edit). */
  legacy: LegacySpelling[];
}

/**
 * Split an authored `x-filterOperators` value for display. Nothing is written:
 * callers persist {@link mergeOperators} only after a user edit.
 */
export function splitOperators(value: unknown): SplitOperators {
  const known: FilterOperator[] = [];
  const unknown: string[] = [];
  const legacy: LegacySpelling[] = [];
  if (!Array.isArray(value)) return { known, unknown, legacy };
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeOperator(item);
    if (normalized === null) {
      if (!unknown.includes(item)) unknown.push(item);
      continue;
    }
    if (normalized !== item) legacy.push({ raw: item, normalized });
    if (!known.includes(normalized)) known.push(normalized);
  }
  return { known, unknown, legacy };
}

/** Runtime spellings in canonical order, followed by preserved unknown values. */
export function mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[] {
  return [...FILTER_OPERATORS.filter((o) => selected.has(o.value)).map((o) => o.value), ...unknown];
}
```

- [ ] **Step 4: Rewrite `XFilterOperatorsCard.tsx`**

```tsx
import { Checkbox } from '../../../../../ui/Checkbox';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';
import {
  FILTER_OPERATOR_CATEGORIES,
  FILTER_OPERATORS,
  mergeOperators,
  splitOperators,
  type FilterOperator,
} from './filterOperators';

// Seed with the most common operator so the toggle-on state is immediately
// valid (an empty list means "not filterable" — toggle the card off instead).
const DEFAULT_VALUE = (): FilterOperator[] => ['eq'];

interface XFilterOperatorsCardProps {
  pointer: JsonPointer;
}

/**
 * `x-filterOperators` lists the filter operators the runtime accepts for this
 * field, in runtime spelling (`eq neq gt gte lt lte between contains startsWith
 * endsWith in nin includes isNull`). Legacy spellings (`ge`, `like`, …) are shown
 * as their runtime equivalent and rewritten only on the next user change; values
 * Forge does not know are kept verbatim.
 */
export function XFilterOperatorsCard({ pointer }: XFilterOperatorsCardProps) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-filterOperators', DEFAULT_VALUE);
  const { known, unknown: preserved, legacy } = splitOperators(node?.['x-filterOperators']);
  const selected = new Set<string>(known);

  function setOperator(op: FilterOperator, on: boolean): void {
    const next = new Set<string>(known);
    if (on) next.add(op);
    else next.delete(op);
    updateComponent(setKeyword(pointer, 'x-filterOperators', mergeOperators(next, preserved)));
  }

  return (
    <VNextCardShell
      xKey="x-filterOperators"
      title="Filter operators"
      purpose="Operators the runtime accepts when instances are filtered by this field. Turn off the card to remove all operators (field becomes unfilterable)."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-2">
        {FILTER_OPERATOR_CATEGORIES.map((category) => {
          const ops = FILTER_OPERATORS.filter((o) => o.category === category);
          return (
            <div key={category}>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-primary-text/55">
                {category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ops.map((op) => {
                  const id = `filter-op-${pointer.replace(/\W+/g, '_')}-${op.value}`;
                  const checked = selected.has(op.value);
                  return (
                    <label
                      key={op.value}
                      htmlFor={id}
                      className={
                        readOnly
                          ? 'pointer-events-none flex items-center gap-1 rounded-md border border-primary-border/60 bg-primary-muted/30 px-2 py-1 text-[10px] font-mono'
                          : 'flex cursor-pointer items-center gap-1 rounded-md border border-primary-border/60 bg-primary-muted/30 px-2 py-1 text-[10px] font-mono hover:bg-primary-muted/60'
                      }>
                      {/* Read-only: non-interactive, not disabled/gray. */}
                      <Checkbox
                        id={id}
                        checked={checked}
                        aria-readonly={readOnly || undefined}
                        tabIndex={readOnly ? -1 : undefined}
                        className={readOnly ? 'pointer-events-none' : undefined}
                        onCheckedChange={(next) => {
                          if (readOnly) {
                            return;
                          }
                          setOperator(op.value, next === true);
                        }}
                      />
                      <span>{op.value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {legacy.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Shown with runtime names:{' '}
          <span className="font-mono">{legacy.map((l) => `${l.raw} → ${l.normalized}`).join(', ')}</span>.
          They are saved with these names on your next change.
        </p>
      )}
      {preserved.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Also kept: <span className="font-mono">{preserved.join(', ')}</span>
        </p>
      )}
    </VNextCardShell>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.vitest.test.tsx src/modules/schema-editor/components/tree-editor/__tests__/roundtrip.vitest.test.ts`
Expected: PASS (roundtrip still passes: it toggles and round-trips `x-filterOperators` through the store, not through the card).

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.ts packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.tsx packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.vitest.test.tsx
git commit -m "$(cat <<'MSG'
feat(schema-editor): filter operators in runtime spelling, legacy shown normalized

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: `attributes.type` model and combobox (D1)

**Files:**
- Modify: `packages/designer-ui/src/modules/schema-editor/SchemaEditorSchema.ts`
- Create: `packages/designer-ui/src/modules/schema-editor/components/SchemaTypeField.tsx`
- Modify: `packages/designer-ui/src/modules/schema-editor/components/SchemaMetadataForm.tsx`
- Test: `packages/designer-ui/src/modules/schema-editor/SchemaEditorSchema.vitest.test.ts` (append)
- Test (new): `packages/designer-ui/src/modules/schema-editor/components/SchemaTypeField.vitest.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MASTER_SCHEMA_TYPE = 'master'`, `SCHEMA_TYPE_SUGGESTIONS = ['master', 'schema', 'view', 'headers'] as const`, `readSchemaAttributesType(json: Record<string, unknown> | null | undefined): string | undefined`, `setSchemaAttributesType(draft: Record<string, unknown>, value: string): void` (all from `SchemaEditorSchema.ts`); `SchemaTypeField({ value, onCommit, errorMsg })` with `interface SchemaTypeFieldProps { value: string; onCommit: (next: string) => void; errorMsg?: string }`. Used by Tasks 4, 6, 7, 8.

- [ ] **Step 1: Write the failing tests**

In `SchemaEditorSchema.vitest.test.ts` replace the import line with

```ts
import {
  assertSchemaEditorDocument,
  getSchemaSource,
  readSchemaAttributesType,
  setSchemaAttributesType,
} from './SchemaEditorSchema';
```

and append after the final `});`:

```ts
describe('schema attributes.type', () => {
  const base = { key: 'orders', version: '1.0.0', domain: 'core' };

  it('reads attributes.type only when it is a string', () => {
    expect(readSchemaAttributesType({ ...base, attributes: { type: 'master', schema: {} } })).toBe('master');
    expect(readSchemaAttributesType({ ...base, attributes: { type: 7, schema: {} } })).toBeUndefined();
    expect(readSchemaAttributesType({ ...base })).toBeUndefined();
    expect(readSchemaAttributesType(null)).toBeUndefined();
  });

  it('writes attributes.type and keeps the schema', () => {
    const draft: Record<string, unknown> = { ...base, attributes: { type: 'schema', schema: { type: 'object' } } };
    setSchemaAttributesType(draft, 'master');
    expect(draft.attributes).toEqual({ type: 'master', schema: { type: 'object' } });
  });

  it('creates attributes when missing', () => {
    const draft: Record<string, unknown> = { ...base };
    setSchemaAttributesType(draft, 'view');
    expect(draft.attributes).toEqual({ type: 'view' });
  });

  it('opens documents with any attributes.type for repair', () => {
    const numeric = { ...base, attributes: { type: 7, schema: { type: 'object' } } };
    expect(assertSchemaEditorDocument(numeric, 'test')).toEqual(numeric);
  });
});
```

Create `components/SchemaTypeField.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaTypeField } from './SchemaTypeField';

const render = (value: string, errorMsg?: string): string =>
  renderToStaticMarkup(
    createElement(SchemaTypeField, { value, onCommit: () => undefined, ...(errorMsg ? { errorMsg } : {}) }),
  );

describe('SchemaTypeField', () => {
  it('renders the current value with the four suggestions', () => {
    const html = render('schema');
    expect(html).toContain('value="schema"');
    for (const option of ['master', 'schema', 'view', 'headers']) {
      expect(html).toContain(`<option value="${option}">`);
    }
  });

  it('explains that only master permits x-indexed', () => {
    expect(render('view')).toContain('permits x-indexed');
  });

  it('shows the save-time error', () => {
    expect(render('', 'must be string')).toContain('must be string');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/SchemaEditorSchema.vitest.test.ts src/modules/schema-editor/components/SchemaTypeField.vitest.test.tsx`
Expected: FAIL — `readSchemaAttributesType` / `setSchemaAttributesType` / `SchemaTypeField` do not exist.

- [ ] **Step 3: Model `attributes.type` in `SchemaEditorSchema.ts`**

In `schemaEditorDocumentSchema` delete the root line `    type: z.string().optional(),` and replace

```ts
    attributes: z
      .object({
        schema: schemaNodeSchema,
      })
      .passthrough()
      .optional(),
```

with

```ts
    attributes: z
      .object({
        /**
         * Free-text schema purpose (vnext-schema master). Only `master` permits
         * `x-indexed`. Kept permissive here so a legacy file with a wrong type
         * still opens for repair; the UI reads it via `readSchemaAttributesType`.
         */
        type: z.unknown().optional(),
        schema: schemaNodeSchema,
      })
      .passthrough()
      .optional(),
```

Then append at the end of the file:

```ts
/** The only `attributes.type` value that permits `x-indexed` (runtime + vnext-schema master). */
export const MASTER_SCHEMA_TYPE = 'master';

/** Suggestions for the free-text `attributes.type` combobox (D1). */
export const SCHEMA_TYPE_SUGGESTIONS = [MASTER_SCHEMA_TYPE, 'schema', 'view', 'headers'] as const;

/** `attributes.type` when it is a string, otherwise `undefined`. */
export function readSchemaAttributesType(
  json: Record<string, unknown> | null | undefined,
): string | undefined {
  const attributes = json?.attributes;
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return undefined;
  }
  const type = (attributes as Record<string, unknown>).type;
  return typeof type === 'string' ? type : undefined;
}

/** Write `attributes.type` on an Immer draft, creating `attributes` when missing. */
export function setSchemaAttributesType(draft: Record<string, unknown>, value: string): void {
  const current = draft.attributes;
  const attributes =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  attributes.type = value;
  draft.attributes = attributes;
}
```

- [ ] **Step 4: Create `components/SchemaTypeField.tsx`**

```tsx
import { useEffect, useId, useState } from 'react';

import { Field } from '../../../ui/Field';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
import { SCHEMA_TYPE_SUGGESTIONS } from '../SchemaEditorSchema';

export interface SchemaTypeFieldProps {
  value: string;
  onCommit: (next: string) => void;
  errorMsg?: string;
}

/**
 * Free-text `attributes.type` input with suggestions (native `<datalist>`).
 * Commits on blur or Enter so the document is not rewritten per keystroke;
 * blank input reverts because the field is a required string.
 */
export function SchemaTypeField({ value, onCommit, errorMsg }: SchemaTypeFieldProps) {
  const listId = useId();
  const readOnly = useFormReadOnly();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onCommit(trimmed);
  };

  return (
    <Field
      label="Schema type"
      required
      errorMsg={errorMsg}
      hint={
        <>
          Free text. Only <code>master</code> permits x-indexed.
        </>
      }>
      <input
        type="text"
        list={listId}
        value={draft}
        readOnly={readOnly}
        aria-label="Schema type"
        aria-invalid={Boolean(errorMsg)}
        placeholder="master"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(value);
        }}
        className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
      />
      <datalist id={listId}>
        {SCHEMA_TYPE_SUGGESTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </Field>
  );
}
```

- [ ] **Step 5: Wire it into `SchemaMetadataForm.tsx`**

Replace the import block from `'../SchemaEditorSchema'` with

```ts
import {
  readSchemaAttributesType,
  schemaMetadataFormSchema,
  setSchemaAttributesType,
  type SchemaMetadataFormValues,
  toSchemaMetadataFormValues,
} from '../SchemaEditorSchema';
import { SchemaTypeField } from './SchemaTypeField';
```

After `const flowVersionServerError = useFieldValidationError('flowVersion');` add

```ts
  const schemaTypeServerError = useFieldValidationError('attributes/type');
```

and inside the `grid grid-cols-2` block, after the closing `</Field>` of **Flow Version**, add

```tsx
        <SchemaTypeField
          value={readSchemaAttributesType(json) ?? ''}
          errorMsg={schemaTypeServerError}
          onCommit={(next) => onChange((draft) => setSchemaAttributesType(draft, next))}
        />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/SchemaEditorSchema.vitest.test.ts src/modules/schema-editor/components/SchemaTypeField.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 7: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/SchemaEditorSchema.ts packages/designer-ui/src/modules/schema-editor/SchemaEditorSchema.vitest.test.ts packages/designer-ui/src/modules/schema-editor/components/SchemaTypeField.tsx packages/designer-ui/src/modules/schema-editor/components/SchemaTypeField.vitest.test.tsx packages/designer-ui/src/modules/schema-editor/components/SchemaMetadataForm.tsx
git commit -m "$(cat <<'MSG'
feat(schema-editor): free-text attributes.type combobox; model attributes.type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: A schema created from the Master Schema section defaults to `master` (D1)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.ts`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/CreateNewComponentDialog.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSchemaSection.tsx`
- Test (new): `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.vitest.test.ts`

**Interfaces:**
- Consumes: `MASTER_SCHEMA_TYPE` (Task 2).
- Produces: `type SupportedCategory = 'schemas' | 'views' | 'extensions' | 'functions'`, `interface NewComponentTemplateOptions { schemaType?: string }`, `CREATE_NEW_COMPONENT_META: Record<SupportedCategory, { singular; flow; template(key, domain, options?) }>`; `CreateNewComponentDialog` prop `schemaType?: string`.

- [ ] **Step 1: Write the failing test**

Create `createNewComponentTemplates.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CREATE_NEW_COMPONENT_META } from './createNewComponentTemplates';

describe('CREATE_NEW_COMPONENT_META.schemas', () => {
  it('uses the requested attributes.type', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core', { schemaType: 'master' });
    expect((json.attributes as Record<string, unknown>).type).toBe('master');
  });

  it('keeps the previous default when no type is requested', () => {
    const json = CREATE_NEW_COMPONENT_META.schemas.template('orders', 'core');
    expect((json.attributes as Record<string, unknown>).type).toBe('workflow');
  });

  it('ignores the option for other categories', () => {
    const json = CREATE_NEW_COMPONENT_META.views.template('v', 'core', { schemaType: 'master' });
    expect((json.attributes as Record<string, unknown>).type).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.vitest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the templates into `createNewComponentTemplates.ts`**

This is the `CATEGORY_META` constant and `SupportedCategory` type of `CreateNewComponentDialog.tsx`, moved verbatim except for the new `options` parameter on `schemas.template`:

```ts
export type SupportedCategory = 'schemas' | 'views' | 'extensions' | 'functions';

export interface NewComponentTemplateOptions {
  /** `attributes.type` of a new schema; defaults to `workflow` (previous behaviour). */
  schemaType?: string;
}

export interface NewComponentCategoryMeta {
  singular: string;
  flow: string;
  template: (key: string, domain: string, options?: NewComponentTemplateOptions) => Record<string, unknown>;
}

/** Minimal documents written by `CreateNewComponentDialog`, per category. */
export const CREATE_NEW_COMPONENT_META: Record<SupportedCategory, NewComponentCategoryMeta> = {
  schemas: {
    singular: 'schema',
    flow: 'sys-schemas',
    template: (key, domain, options) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-schemas',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-schemas'],
      attributes: {
        type: options?.schemaType ?? 'workflow',
        schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: `urn:vnext:${key}`,
          title: key,
          type: 'object',
        },
      },
    }),
  },
  views: {
    singular: 'view',
    flow: 'sys-views',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-views',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-views'],
      attributes: {
        type: 1,
        display: 'full-page',
        content: {},
      },
    }),
  },
  extensions: {
    singular: 'extension',
    flow: 'sys-extensions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-extensions',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-extensions'],
      attributes: {
        type: 1,
        scope: 1,
        task: {
          order: 1,
          task: { key: 'placeholder', domain, flow: 'sys-tasks', version: '1.0.0' },
          mapping: { location: './src/Mapping.csx', code: 'Ly8=' },
        },
      },
    }),
  },
  functions: {
    singular: 'function',
    flow: 'sys-functions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-functions',
      flowVersion: '1.0.0',
      tags: [domain, 'sys-functions'],
      attributes: {
        scope: 'I',
        task: {
          order: 1,
          task: { key: 'placeholder', domain, flow: 'sys-tasks', version: '1.0.0' },
          mapping: { location: './src/Mapping.csx', code: 'Ly8=' },
        },
      },
    }),
  },
};
```

- [ ] **Step 4: Use it from `CreateNewComponentDialog.tsx`**

1. Delete the whole `const CATEGORY_META: Record<…> = { … };` block and the line `type SupportedCategory = 'schemas' | 'views' | 'extensions' | 'functions';` (both now live in the new file).
2. Add below the other imports:

```ts
import { CREATE_NEW_COMPONENT_META as CATEGORY_META, type SupportedCategory } from './createNewComponentTemplates.js';
```

3. Replace the props interface and signature:

```ts
export interface CreateNewComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: DiscoveredVnextComponent) => void;
  category: SupportedCategory;
  /** `attributes.type` for a new schema (`category="schemas"` only). */
  schemaType?: string;
}

export function CreateNewComponentDialog({
  open,
  onOpenChange,
  onCreated,
  category,
  schemaType,
}: CreateNewComponentDialogProps) {
```

4. In `handleCreate` replace `const json = meta.template(componentName, projectDomain);` with

```ts
    const json = meta.template(componentName, projectDomain, schemaType ? { schemaType } : undefined);
```

(`CreateNewComponentButton` keeps reading `CATEGORY_META[category]` through the alias.)

- [ ] **Step 5: Pass `master` from `WorkflowSchemaSection.tsx`**

Add to the imports:

```ts
import { MASTER_SCHEMA_TYPE } from '../../../../schema-editor/SchemaEditorSchema';
```

and replace

```tsx
      <CreateNewComponentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        category="schemas"
        onCreated={setSchema}
      />
```

with

```tsx
      <CreateNewComponentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        category="schemas"
        schemaType={MASTER_SCHEMA_TYPE}
        onCreated={setSchema}
      />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.vitest.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/createNewComponentTemplates.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/CreateNewComponentDialog.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSchemaSection.tsx
git commit -m "$(cat <<'MSG'
feat(canvas): Master Schema section creates master schemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Index eligibility — mirror of runtime `AttributeIndexDefinition.Visit` (D2)

**Files:**
- Create: `packages/designer-ui/src/modules/schema-editor/model/indexEligibility.ts`
- Test (new): `packages/designer-ui/src/modules/schema-editor/model/indexEligibility.vitest.test.ts`

**Interfaces:**
- Consumes: `readSchemaAttributesType`, `MASTER_SCHEMA_TYPE` (Task 2); `appendPointer`, `ROOT_POINTER`, `JsonPointer` (`model/jsonPointer.ts`); `getSchemaRoot` (`model/schemaNode.ts`).
- Produces (used by Tasks 5–8):
  - `type IndexIneligibleReason = 'notMaster' | 'root' | 'dynamicLocation' | 'composition' | 'parentNotObject' | 'invalidPath' | 'notScalar'`
  - `type IndexViolationReason = IndexIneligibleReason | 'notBoolean'`
  - `type IndexColumnType = 'text' | 'numeric' | 'timestamptz'`
  - `INDEX_MESSAGES: Record<IndexViolationReason, string>`
  - `interface IndexNodeInfo { pointer: JsonPointer; path: string; eligible: boolean; reason?: IndexIneligibleReason; indexed: unknown }`
  - `interface IndexViolation { pointer: JsonPointer; path: string; reason: IndexViolationReason; message: string }`
  - `interface IndexTypeMismatch { schemaType: string | undefined; indexedPointers: JsonPointer[] }`
  - `analyzeIndexEligibility(schemaRoot: unknown, schemaType: unknown): Map<JsonPointer, IndexNodeInfo>`
  - `getIndexAnalysis(componentJson: Record<string, unknown> | null | undefined): Map<JsonPointer, IndexNodeInfo>` (cached per document object)
  - `indexInfoAt(analysis: Map<JsonPointer, IndexNodeInfo>, pointer: JsonPointer): IndexNodeInfo`
  - `indexViolationFor(info: IndexNodeInfo): IndexViolation | null`
  - `findIndexViolations(analysis: Map<JsonPointer, IndexNodeInfo>): IndexViolation[]`
  - `indexedPointers(analysis: Map<JsonPointer, IndexNodeInfo>): JsonPointer[]`
  - `indexColumnsFor(node: Record<string, unknown> | null | undefined): IndexColumnType[]`
  - `indexTypeMismatch(componentJson: Record<string, unknown> | null | undefined): IndexTypeMismatch | null`

- [ ] **Step 1: Write the failing tests**

Create `model/indexEligibility.vitest.test.ts` (cases ported from `vnext-schema/test/validate-schema-documents.js`, runtime `AttributeIndexTests`, `SchemaFilterMetadataResolverTests`, `SchemaComponentValidatorTests`):

```ts
import { describe, expect, it } from 'vitest';

import {
  INDEX_MESSAGES,
  analyzeIndexEligibility,
  findIndexViolations,
  getIndexAnalysis,
  indexColumnsFor,
  indexInfoAt,
  indexTypeMismatch,
  indexedPointers,
} from './indexEligibility';

type Schema = Record<string, unknown>;

const indexedField: Schema = { type: 'number', 'x-indexed': true };
const withField = (field: Schema): Schema => ({ type: 'object', properties: { amount: field } });
const reasons = (schema: Schema, type: unknown = 'master'): string[] =>
  findIndexViolations(analyzeIndexEligibility(schema, type)).map((v) => v.reason);

describe('index eligibility — explicit scalar fields', () => {
  it.each(['string', 'number', 'integer', 'boolean'])('accepts scalar %s', (type) => {
    expect(reasons(withField({ type, 'x-indexed': true }))).toEqual([]);
  });

  it('accepts date-time strings', () => {
    expect(reasons(withField({ type: 'string', format: 'date-time', 'x-indexed': true }))).toEqual([]);
  });

  it.each([['true'], [1], [null], [{}], [[]]])('rejects non-boolean metadata %j', (indexed) => {
    expect(reasons(withField({ type: 'number', 'x-indexed': indexed }))).toEqual(['notBoolean']);
  });

  it.each([['object'], ['array'], ['null'], [['number', 'null']], [undefined]])(
    'requires an explicit scalar type (%j), but false never requests a projection',
    (type) => {
      const typed = type === undefined ? {} : { type };
      expect(reasons(withField({ ...typed, 'x-indexed': true }))).toEqual(['notScalar']);
      expect(reasons(withField({ ...typed, 'x-indexed': false }))).toEqual([]);
    },
  );

  it('rejects the document root', () => {
    expect(reasons({ type: 'number', 'x-indexed': true })).toEqual(['root']);
  });
});

describe('index eligibility — paths', () => {
  it('accepts implicit objects and a numeric nested key', () => {
    expect(reasons({ properties: { nested: { properties: { '0': indexedField } } } })).toEqual([]);
  });

  it.each(['a.b', 'a-b', 'İsim', ''])('rejects the property name %j at the root and nested', (name) => {
    expect(reasons({ properties: { [name]: indexedField } })).toEqual(['invalidPath']);
    expect(reasons({ properties: { nested: { properties: { [name]: indexedField } } } })).toEqual(['invalidPath']);
  });

  it.each(['0', '_amount'])('requires the first segment %j to start with a letter', (name) => {
    expect(reasons({ properties: { [name]: indexedField } })).toEqual(['invalidPath']);
  });

  it.each([['array'], ['string'], [['object', 'null']]])('rejects a parent of type %j', (type) => {
    expect(reasons({ properties: { nested: { type, properties: { amount: indexedField } } } })).toEqual([
      'parentNotObject',
    ]);
  });

  it('reports the dotted runtime path', () => {
    const analysis = analyzeIndexEligibility(
      { type: 'object', properties: { customer: { type: 'object', properties: { name: { type: 'string' } } } } },
      'master',
    );
    expect(analysis.get('/properties/customer/properties/name')).toEqual({
      pointer: '/properties/customer/properties/name',
      path: 'customer.name',
      eligible: true,
      indexed: undefined,
    });
  });
});

describe('index eligibility — references and conditional schemas', () => {
  const conditions: Record<string, unknown> = {
    $ref: '#/$defs/amount',
    allOf: [],
    anyOf: [],
    oneOf: [],
    not: {},
    if: {},
    then: {},
    else: {},
    dependentSchemas: {},
  };

  it.each(Object.entries(conditions))('%s on the indexed node, an ancestor, or a sibling', (keyword, value) => {
    expect(reasons(withField({ ...indexedField, [keyword]: value }))).toEqual(['composition']);
    expect(reasons({ [keyword]: value, properties: { amount: indexedField } })).toEqual(['composition']);
    expect(reasons({ properties: { amount: indexedField, sibling: { [keyword]: value } } })).toEqual([]);
  });

  it('allows conditional unindexed fields beside indexed fields', () => {
    expect(
      reasons({ properties: { amount: indexedField, other: { type: 'string', oneOf: [{ maxLength: 10 }] } } }),
    ).toEqual([]);
  });
});

describe('index eligibility — dynamic schema locations', () => {
  it.each(['items', 'additionalProperties', 'contains', 'propertyNames', 'additionalItems', 'unevaluatedProperties', 'unevaluatedItems'])(
    'rejects %s',
    (keyword) => {
      expect(reasons({ [keyword]: withField(indexedField) })).toEqual(['dynamicLocation']);
      expect(reasons({ [keyword]: withField({ type: 'number', 'x-indexed': false }) })).toEqual([]);
    },
  );

  it.each(['$defs', 'definitions', 'patternProperties'])('rejects dictionary %s', (keyword) => {
    expect(reasons({ [keyword]: { entry: withField(indexedField) } })).toEqual(['dynamicLocation']);
  });

  it('rejects dependentSchemas entries (the keyword also makes the node conditional)', () => {
    expect(reasons({ dependentSchemas: { entry: withField(indexedField) } })).toEqual(['composition']);
  });

  it.each(['prefixItems', 'items'])('rejects array %s', (keyword) => {
    expect(reasons({ [keyword]: [withField(indexedField)] })).toEqual(['dynamicLocation']);
  });

  it.each(['allOf', 'anyOf', 'oneOf'])('rejects array %s', (keyword) => {
    expect(reasons({ [keyword]: [withField(indexedField)] })).toEqual(['composition']);
  });

  it('rejects fields under array items (runtime AttributeIndexTests)', () => {
    expect(
      reasons({ properties: { a: { type: 'array', items: { properties: { b: { type: 'number', 'x-indexed': true } } } } } }),
    ).toEqual(['dynamicLocation']);
  });

  it.each(['examples', 'default', 'const', 'enum'])('does not interpret literal %s data', (keyword) => {
    expect(reasons({ ...withField(indexedField), [keyword]: [{ 'x-indexed': 'data, not metadata' }] })).toEqual([]);
  });

  it('accepts a property named x-indexed', () => {
    expect(reasons({ properties: { 'x-indexed': { type: 'string' } } })).toEqual([]);
  });
});

describe('index eligibility — attributes.type', () => {
  it.each(['transition', 'view', 'function', 'workflow', 'custom-schema', 'MASTER', null, '', '   ', undefined])(
    'rejects x-indexed true and false when the type is %j',
    (type) => {
      expect(reasons(withField({ type: 'number', 'x-indexed': true }), type)).toEqual(['notMaster']);
      expect(reasons(withField({ type: 'number', 'x-indexed': false }), type)).toEqual(['notMaster']);
    },
  );

  it('rejects nested false metadata outside master but ignores example data', () => {
    expect(
      reasons({ properties: { nested: { properties: { value: { type: 'string', 'x-indexed': false } } } } }, 'view'),
    ).toEqual(['notMaster']);
    expect(reasons({ type: 'object', examples: [{ 'x-indexed': true }] }, 'view')).toEqual([]);
  });

  it('marks every node ineligible outside master', () => {
    expect(analyzeIndexEligibility(withField({ type: 'number' }), 'view').get('/properties/amount')?.reason).toBe(
      'notMaster',
    );
  });
});

describe('violation messages', () => {
  it('carries the pointer, path and a readable message', () => {
    expect(findIndexViolations(analyzeIndexEligibility(withField({ type: 'array', 'x-indexed': true }), 'master'))).toEqual([
      { pointer: '/properties/amount', path: 'amount', reason: 'notScalar', message: INDEX_MESSAGES.notScalar },
    ]);
  });
});

describe('indexInfoAt', () => {
  it('falls back to an ineligible dynamic location for pointers that were not visited', () => {
    const info = indexInfoAt(new Map(), '/properties/ghost');
    expect(info.eligible).toBe(false);
    expect(info.reason).toBe('dynamicLocation');
  });
});

describe('indexColumnsFor (runtime AttributeIndexDefinition.From)', () => {
  it('always keeps text; adds numeric for numbers and timestamptz for date-time strings', () => {
    expect(indexColumnsFor({ type: 'number' })).toEqual(['text', 'numeric']);
    expect(indexColumnsFor({ type: 'integer' })).toEqual(['text', 'numeric']);
    expect(indexColumnsFor({ type: 'string', format: 'date-time' })).toEqual(['text', 'timestamptz']);
    expect(indexColumnsFor({ type: 'boolean' })).toEqual(['text']);
    expect(indexColumnsFor(null)).toEqual([]);
  });
});

describe('document-level helpers', () => {
  const doc = (type: string, schema: Schema): Record<string, unknown> => ({ key: 'k', attributes: { type, schema } });

  it('caches the analysis per document object', () => {
    const json = doc('master', withField(indexedField));
    expect(getIndexAnalysis(json)).toBe(getIndexAnalysis(json));
    expect(getIndexAnalysis(json).get('/properties/amount')?.eligible).toBe(true);
    expect(getIndexAnalysis(null).size).toBe(0);
  });

  it('lists every node that carries x-indexed', () => {
    const json = doc('master', { properties: { a: indexedField, b: { type: 'string', 'x-indexed': false }, c: {} } });
    expect(indexedPointers(getIndexAnalysis(json))).toEqual(['/properties/a', '/properties/b']);
  });

  it('reports a non-master schema with x-indexed fields', () => {
    expect(indexTypeMismatch(doc('view', withField(indexedField)))).toEqual({
      schemaType: 'view',
      indexedPointers: ['/properties/amount'],
    });
    expect(indexTypeMismatch(doc('master', withField(indexedField)))).toBeNull();
    expect(indexTypeMismatch(doc('view', withField({ type: 'number' })))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/indexEligibility.vitest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `model/indexEligibility.ts`**

```ts
/**
 * Mirror of runtime `AttributeIndexDefinition.Visit`
 * (vnext/src/BBT.Workflow.Domain/Definitions/Schemas/AttributeIndexDefinition.cs).
 *
 * The runtime walks the schema with a `supported` flag and throws one generic
 * message on the first bad `x-indexed`. This walk is the same traversal, but it
 * records every object node with a single actionable reason, so the editor can
 * explain eligibility before save:
 *
 * - `supported` turns false below `$ref` / composition / conditional keywords
 *   (on the node itself or an ancestor), below every keyword that is not a
 *   fixed `properties` chain, below a non-object parent, and below a property
 *   name that contains a dot;
 * - the dotted path must match `^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$`
 *   (so the root, path `""`, is never indexable);
 * - `x-indexed: true` needs an explicit scalar `type`;
 * - outside `attributes.type === 'master'` any `x-indexed` is rejected.
 */
import { MASTER_SCHEMA_TYPE, readSchemaAttributesType } from '../SchemaEditorSchema';
import { appendPointer, ROOT_POINTER, type JsonPointer } from './jsonPointer';
import { getSchemaRoot } from './schemaNode';

export type IndexIneligibleReason =
  | 'notMaster'
  | 'root'
  | 'dynamicLocation'
  | 'composition'
  | 'parentNotObject'
  | 'invalidPath'
  | 'notScalar';

export type IndexViolationReason = IndexIneligibleReason | 'notBoolean';

export type IndexColumnType = 'text' | 'numeric' | 'timestamptz';

export const INDEX_MESSAGES: Record<IndexViolationReason, string> = {
  notMaster: 'x-indexed is only allowed when attributes.type is master.',
  notBoolean: 'x-indexed must be true or false.',
  root: 'The schema root cannot be indexed. Mark a field under properties instead.',
  dynamicLocation:
    'Only fields reached through nested properties can be indexed, not fields under items, $defs, patternProperties, additionalProperties or similar locations.',
  composition:
    'An indexed field and its parents cannot use $ref, allOf, anyOf, oneOf, not, if/then/else or dependentSchemas.',
  parentNotObject: 'The parent of an indexed field must be an object (type object or no type).',
  invalidPath:
    'Index paths start with a letter and use only letters, digits and underscores in every segment.',
  notScalar:
    'x-indexed needs an explicit scalar type: string, number, integer or boolean (dates are strings with format date-time).',
};

export interface IndexNodeInfo {
  pointer: JsonPointer;
  /** Dotted runtime path (`customer.name`); dynamic locations keep their parent path. */
  path: string;
  eligible: boolean;
  reason?: IndexIneligibleReason;
  /** Raw `x-indexed` value; `undefined` when the keyword is absent. */
  indexed: unknown;
}

export interface IndexViolation {
  pointer: JsonPointer;
  path: string;
  reason: IndexViolationReason;
  message: string;
}

export interface IndexTypeMismatch {
  schemaType: string | undefined;
  indexedPointers: JsonPointer[];
}

const COMPOSITION_KEYWORDS: ReadonlySet<string> = new Set([
  '$ref', 'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', 'dependentSchemas',
]);
const DICTIONARY_KEYWORDS: ReadonlySet<string> = new Set([
  '$defs', 'definitions', 'patternProperties', 'dependentSchemas',
]);
const SUBSCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  'items', 'prefixItems', '$defs', 'definitions', 'allOf', 'anyOf', 'oneOf', 'if', 'then', 'else',
  'additionalProperties', 'patternProperties', 'not', 'dependentSchemas', 'contains', 'propertyNames',
  'additionalItems', 'unevaluatedProperties', 'unevaluatedItems',
]);
const SCALAR_TYPES: ReadonlySet<string> = new Set(['string', 'number', 'integer', 'boolean']);
const INDEX_PATH = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function analyzeIndexEligibility(
  schemaRoot: unknown,
  schemaType: unknown,
): Map<JsonPointer, IndexNodeInfo> {
  const master = schemaType === MASTER_SCHEMA_TYPE;
  const result = new Map<JsonPointer, IndexNodeInfo>();

  const reasonFor = (
    node: Record<string, unknown>,
    pointer: JsonPointer,
    path: string,
    blocked: IndexIneligibleReason | null,
  ): IndexIneligibleReason | null => {
    if (!master) return 'notMaster';
    if (pointer === ROOT_POINTER) return 'root';
    if (blocked) return blocked;
    if (!INDEX_PATH.test(path)) return 'invalidPath';
    if (typeof node.type !== 'string' || !SCALAR_TYPES.has(node.type)) return 'notScalar';
    return null;
  };

  const visit = (
    value: unknown,
    pointer: JsonPointer,
    path: string,
    blocked: IndexIneligibleReason | null,
  ): void => {
    if (Array.isArray(value)) {
      (value as unknown[]).forEach((child, index) => {
        visit(child, appendPointer(pointer, index), path, blocked ?? 'dynamicLocation');
      });
      return;
    }
    if (!isRecord(value)) return;

    const nodeBlocked =
      blocked ?? (Object.keys(value).some((key) => COMPOSITION_KEYWORDS.has(key)) ? 'composition' : null);
    const reason = reasonFor(value, pointer, path, nodeBlocked);
    result.set(pointer, {
      pointer,
      path,
      eligible: reason === null,
      ...(reason ? { reason } : {}),
      indexed: value['x-indexed'],
    });

    for (const [keyword, child] of Object.entries(value)) {
      if (keyword === 'properties' && isRecord(child)) {
        const objectParent = !('type' in value) || value.type === 'object';
        for (const [name, propertySchema] of Object.entries(child)) {
          const childBlocked =
            nodeBlocked ?? (!objectParent ? 'parentNotObject' : name.includes('.') ? 'invalidPath' : null);
          visit(
            propertySchema,
            appendPointer(pointer, 'properties', name),
            path === '' ? name : `${path}.${name}`,
            childBlocked,
          );
        }
      } else if (SUBSCHEMA_KEYWORDS.has(keyword)) {
        const childBlocked = nodeBlocked ?? 'dynamicLocation';
        if (DICTIONARY_KEYWORDS.has(keyword) && isRecord(child)) {
          for (const [name, entry] of Object.entries(child)) {
            visit(entry, appendPointer(pointer, keyword, name), path, childBlocked);
          }
        } else {
          visit(child, appendPointer(pointer, keyword), path, childBlocked);
        }
      }
    }
  };

  visit(schemaRoot, ROOT_POINTER, '', null);
  return result;
}

const analysisCache = new WeakMap<object, Map<JsonPointer, IndexNodeInfo>>();

/** Analysis of a whole schema component (`attributes.schema` + `attributes.type`), cached per document object. */
export function getIndexAnalysis(
  componentJson: Record<string, unknown> | null | undefined,
): Map<JsonPointer, IndexNodeInfo> {
  if (!componentJson) return new Map();
  const cached = analysisCache.get(componentJson);
  if (cached) return cached;
  const analysis = analyzeIndexEligibility(getSchemaRoot(componentJson), readSchemaAttributesType(componentJson));
  analysisCache.set(componentJson, analysis);
  return analysis;
}

export function indexInfoAt(analysis: Map<JsonPointer, IndexNodeInfo>, pointer: JsonPointer): IndexNodeInfo {
  return (
    analysis.get(pointer) ?? { pointer, path: '', eligible: false, reason: 'dynamicLocation', indexed: undefined }
  );
}

export function indexViolationFor(info: IndexNodeInfo): IndexViolation | null {
  if (info.indexed === undefined) return null;
  const violation = (reason: IndexViolationReason): IndexViolation => ({
    pointer: info.pointer,
    path: info.path,
    reason,
    message: INDEX_MESSAGES[reason],
  });
  if (info.reason === 'notMaster') return violation('notMaster');
  if (typeof info.indexed !== 'boolean') return violation('notBoolean');
  if (info.indexed && !info.eligible) return violation(info.reason ?? 'dynamicLocation');
  return null;
}

export function findIndexViolations(analysis: Map<JsonPointer, IndexNodeInfo>): IndexViolation[] {
  const violations: IndexViolation[] = [];
  for (const info of analysis.values()) {
    const violation = indexViolationFor(info);
    if (violation) violations.push(violation);
  }
  return violations;
}

export function indexedPointers(analysis: Map<JsonPointer, IndexNodeInfo>): JsonPointer[] {
  return [...analysis.values()].filter((info) => info.indexed !== undefined).map((info) => info.pointer);
}

/** Columns the runtime projects for an indexed field (`AttributeIndexDefinition.From`). */
export function indexColumnsFor(node: Record<string, unknown> | null | undefined): IndexColumnType[] {
  if (!node) return [];
  const columns: IndexColumnType[] = ['text'];
  if (node.type === 'number' || node.type === 'integer') columns.push('numeric');
  if (node.type === 'string' && node.format === 'date-time') columns.push('timestamptz');
  return columns;
}

/** A schema that declares `x-indexed` anywhere while `attributes.type` is not `master`. */
export function indexTypeMismatch(
  componentJson: Record<string, unknown> | null | undefined,
): IndexTypeMismatch | null {
  const schemaType = readSchemaAttributesType(componentJson);
  if (schemaType === MASTER_SCHEMA_TYPE) return null;
  const pointers = indexedPointers(getIndexAnalysis(componentJson));
  return pointers.length > 0 ? { schemaType, indexedPointers: pointers } : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/indexEligibility.vitest.test.ts`
Expected: PASS (every case).

- [ ] **Step 5: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/model/indexEligibility.ts packages/designer-ui/src/modules/schema-editor/model/indexEligibility.vitest.test.ts
git commit -m "$(cat <<'MSG'
feat(schema-editor): x-indexed eligibility mirrored from the runtime

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Readable save-time messages for `x-indexed` (D2)

**Files:**
- Create: `packages/designer-ui/src/modules/schema-editor/model/indexValidationMessages.ts`
- Modify: `packages/designer-ui/src/modules/schema-editor/useSchemaEditor.ts` (the `save` callback)
- Test (new): `packages/designer-ui/src/modules/schema-editor/model/indexValidationMessages.vitest.test.ts`

**Interfaces:**
- Consumes: `getIndexAnalysis`, `findIndexViolations`, `INDEX_MESSAGES` (Task 4).
- Produces: `interface SchemaValidationEntry { path: string; message: string; params?: Record<string, unknown> }`, `translateIndexValidationErrors(componentJson: Record<string, unknown> | null | undefined, errors: readonly SchemaValidationEntry[]): SchemaValidationEntry[]`.

- [ ] **Step 1: Write the failing tests**

The AJV error lists below were captured by compiling vnext-schema master `schema-definition.schema.json` with the same AJV options services-core uses (`allErrors: true`).

```ts
import { describe, expect, it } from 'vitest';

import { INDEX_MESSAGES } from './indexEligibility';
import { translateIndexValidationErrors } from './indexValidationMessages';

const doc = (type: string, schema: Record<string, unknown>): Record<string, unknown> => ({
  key: 'k',
  version: '1.0.0',
  domain: 'd',
  flow: 'sys-schemas',
  flowVersion: '1.0.0',
  tags: ['t'],
  attributes: { type, schema },
});

const ARRAY_INDEXED_ERRORS = [
  { path: '/attributes/schema', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/tags', message: 'must be boolean', params: { type: 'boolean' } },
  {
    path: '/attributes/schema/properties/tags/type',
    message: 'must be equal to one of the allowed values',
    params: { allowedValues: ['string', 'number', 'integer', 'boolean'] },
  },
  { path: '/attributes/schema/properties/tags', message: 'must match "then" schema', params: { failingKeyword: 'then' } },
  { path: '/attributes/schema/properties/tags', message: 'must match a schema in anyOf', params: {} },
  { path: '/attributes/schema', message: 'must match a schema in anyOf', params: {} },
  { path: '', message: 'must match "then" schema', params: { failingKeyword: 'then' } },
];

const NON_MASTER_ERRORS = [
  { path: '/attributes/schema', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/amount', message: 'must be boolean', params: { type: 'boolean' } },
  { path: '/attributes/schema/properties/amount', message: 'must NOT be valid', params: {} },
  { path: '/attributes/schema/properties/amount', message: 'must match a schema in anyOf', params: {} },
  { path: '/attributes/schema', message: 'must match a schema in anyOf', params: {} },
  { path: '', message: 'must match "else" schema', params: { failingKeyword: 'else' } },
];

describe('translateIndexValidationErrors', () => {
  it('replaces the AJV if/then noise with one readable message per field', () => {
    const json = doc('master', { type: 'object', properties: { tags: { type: 'array', 'x-indexed': true } } });
    expect(translateIndexValidationErrors(json, ARRAY_INDEXED_ERRORS)).toEqual([
      { path: '/attributes/schema/properties/tags', message: INDEX_MESSAGES.notScalar },
    ]);
  });

  it('explains x-indexed on a non-master schema', () => {
    const json = doc('view', { type: 'object', properties: { amount: { type: 'number', 'x-indexed': true } } });
    expect(translateIndexValidationErrors(json, NON_MASTER_ERRORS)).toEqual([
      { path: '/attributes/schema/properties/amount', message: INDEX_MESSAGES.notMaster },
    ]);
  });

  it('keeps errors that are not about the schema body', () => {
    const json = doc('view', { type: 'object', properties: { amount: { type: 'number', 'x-indexed': true } } });
    const unrelated = [
      { path: '/key', message: 'must NOT have fewer than 1 characters', params: { limit: 1 } },
      { path: '', message: 'must have required property "tags"', params: { missingProperty: 'tags' } },
    ];
    expect(translateIndexValidationErrors(json, [...NON_MASTER_ERRORS, ...unrelated])).toEqual([
      { path: '/attributes/schema/properties/amount', message: INDEX_MESSAGES.notMaster },
      ...unrelated,
    ]);
  });

  it('returns the AJV errors unchanged when Forge finds no index problem', () => {
    const errors = [{ path: '/attributes/schema', message: 'must NOT have fewer than 1 properties', params: { limit: 1 } }];
    expect(translateIndexValidationErrors(doc('master', {}), errors)).toEqual(errors);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/indexValidationMessages.vitest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `model/indexValidationMessages.ts`**

```ts
import { findIndexViolations, getIndexAnalysis } from './indexEligibility';

export interface SchemaValidationEntry {
  path: string;
  message: string;
  params?: Record<string, unknown>;
}

const SCHEMA_PATH = '/attributes/schema';

/**
 * AJV errors produced by the vnext-schema `x-indexed` rules: everything below
 * `attributes.schema` (master and non-master rules only constrain index
 * metadata there), the union/boolean noise on `attributes.schema` itself (its
 * own `minProperties` / `type: object` errors are kept), and the root
 * `if/then/else` that selects master vs non-master.
 */
function isIndexRuleNoise(entry: SchemaValidationEntry): boolean {
  if (entry.path === '') return entry.params?.failingKeyword !== undefined;
  if (entry.path.startsWith(`${SCHEMA_PATH}/`)) return true;
  if (entry.path === SCHEMA_PATH) return entry.params?.limit === undefined && entry.params?.type !== 'object';
  return false;
}

/**
 * Save-time messages for a schema component: when Forge's mirror of the runtime
 * rules finds `x-indexed` problems, they replace the AJV if/then noise with one
 * readable entry per field. Otherwise the AJV errors pass through unchanged.
 */
export function translateIndexValidationErrors(
  componentJson: Record<string, unknown> | null | undefined,
  errors: readonly SchemaValidationEntry[],
): SchemaValidationEntry[] {
  const violations = findIndexViolations(getIndexAnalysis(componentJson));
  if (violations.length === 0) return [...errors];
  return [
    ...violations.map((v) => ({ path: `${SCHEMA_PATH}${v.pointer}`, message: v.message })),
    ...errors.filter((e) => !isIndexRuleNoise(e)),
  ];
}
```

- [ ] **Step 4: Use it when a schema save is blocked (`useSchemaEditor.ts`)**

Add to the imports:

```ts
import { translateIndexValidationErrors } from './model/indexValidationMessages';
```

In `save`, replace

```ts
    if (!gate.valid && !gate.skipped) {
      useComponentStore.getState().setValidationErrors(
        gate.errors.map((e) => ({ path: e.path, message: e.message })),
      );
      const count = gate.errors.length;
```

with

```ts
    if (!gate.valid && !gate.skipped) {
      const errors = translateIndexValidationErrors(componentJson, gate.errors);
      useComponentStore.getState().setValidationErrors(
        errors.map((e) => ({ path: e.path, message: e.message })),
      );
      const count = errors.length;
```

and replace `logger.warn('Schema save blocked by validation', { errors: gate.errors });` with `logger.warn('Schema save blocked by validation', { errors });`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/indexValidationMessages.vitest.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/model/indexValidationMessages.ts packages/designer-ui/src/modules/schema-editor/model/indexValidationMessages.vitest.test.ts packages/designer-ui/src/modules/schema-editor/useSchemaEditor.ts
git commit -m "$(cat <<'MSG'
feat(schema-editor): readable x-indexed messages instead of AJV if/then noise at save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: `XIndexedCard` (D3)

**Files:**
- Create: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.tsx`
- Modify: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/vnextCardRegistry.ts`
- Modify: `packages/designer-ui/src/modules/schema-editor/model/recognizedKeywords.ts`
- Test (new): `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.vitest.test.tsx`

**Interfaces:**
- Consumes: `getIndexAnalysis`, `indexInfoAt`, `indexViolationFor`, `indexColumnsFor`, `INDEX_MESSAGES`, `IndexNodeInfo`, `IndexColumnType` (Task 4); `VNextCardShell`, `useVNextEnabled`, `useSchemaNode`, `setKeyword`.
- Produces: `XIndexedCardView(props: XIndexedCardViewProps)`, `interface XIndexedCardViewProps { pointer: JsonPointer; enabled: boolean; value: unknown; info: IndexNodeInfo; columns: IndexColumnType[]; violation: string | null; onToggle: () => void; onSelect: (next: boolean) => void }`, `XIndexedCard({ pointer })`; registry entry `{ xKey: 'x-indexed', component: XIndexedCard, scope: 'property' }`; `'x-indexed'` in `RECOGNIZED_VNEXT_KEYWORDS`.

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { INDEX_MESSAGES, type IndexNodeInfo } from '../../../model/indexEligibility';
import { XIndexedCardView, type XIndexedCardViewProps } from './XIndexedCard';

const eligible: IndexNodeInfo = { pointer: '/properties/amount', path: 'amount', eligible: true, indexed: undefined };
const ineligible: IndexNodeInfo = {
  pointer: '/properties/tags',
  path: 'tags',
  eligible: false,
  reason: 'notScalar',
  indexed: undefined,
};

const render = (over: Partial<XIndexedCardViewProps> = {}): string =>
  renderToStaticMarkup(
    createElement(XIndexedCardView, {
      pointer: '/properties/amount',
      enabled: false,
      value: undefined,
      info: eligible,
      columns: [],
      violation: null,
      onToggle: () => undefined,
      onSelect: () => undefined,
      ...over,
    }),
  );

const toggleTag = (html: string): string => /<button[^>]*id="vnext-toggle-x-indexed"[^>]*>/.exec(html)?.[0] ?? '';

describe('XIndexedCardView', () => {
  it('offers the toggle on an eligible field', () => {
    const html = render();
    expect(html).toContain('x-indexed');
    expect(toggleTag(html)).not.toContain('disabled');
  });

  it('disables the toggle with the reason on an ineligible field', () => {
    const html = render({ info: ineligible });
    expect(toggleTag(html)).toContain('disabled');
    expect(html).toContain(`title="${INDEX_MESSAGES.notScalar}"`);
  });

  it('keeps a set value removable even when the field became ineligible', () => {
    const html = render({ info: { ...ineligible, indexed: true }, enabled: true, value: true });
    expect(toggleTag(html)).not.toContain('disabled');
  });

  it('shows the produced columns and the filter/sort note', () => {
    const html = render({ enabled: true, value: true, info: { ...eligible, indexed: true }, columns: ['text', 'numeric'] });
    expect(html).toContain('text, numeric');
    expect(html).toContain('Indexed (true)');
    expect(html).toContain('Not indexed (false)');
    expect(html).toContain('does not make the field filterable or sortable');
    expect(html).toContain('wf indexes generate');
  });

  it('shows the violation', () => {
    const html = render({ enabled: true, value: true, violation: INDEX_MESSAGES.notMaster });
    expect(html).toContain(INDEX_MESSAGES.notMaster);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.vitest.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `XIndexedCard.tsx`**

```tsx
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import {
  INDEX_MESSAGES,
  getIndexAnalysis,
  indexColumnsFor,
  indexInfoAt,
  indexViolationFor,
  type IndexColumnType,
  type IndexNodeInfo,
} from '../../../model/indexEligibility';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

const DEFAULT_VALUE = (): boolean => true;

export interface XIndexedCardViewProps {
  pointer: JsonPointer;
  enabled: boolean;
  /** Raw `x-indexed` value. */
  value: unknown;
  info: IndexNodeInfo;
  columns: IndexColumnType[];
  violation: string | null;
  onToggle: () => void;
  onSelect: (next: boolean) => void;
}

/**
 * `x-indexed` tri-state: unset (card off), `true`, `false`. Enabling is
 * blocked with the eligibility reason while unset; a value that is already set
 * stays removable and shows why the runtime would reject it.
 */
export function XIndexedCardView({
  pointer,
  enabled,
  value,
  info,
  columns,
  violation,
  onToggle,
  onSelect,
}: XIndexedCardViewProps) {
  const readOnly = useFormReadOnly();
  const blocked = !enabled && !info.eligible;
  const blockedReason = blocked ? INDEX_MESSAGES[info.reason ?? 'dynamicLocation'] : undefined;

  return (
    <VNextCardShell
      xKey="x-indexed"
      title="Indexed"
      purpose="Ask for a database index column for this field. Master schemas only."
      enabled={enabled}
      onToggle={onToggle}
      toggleDisabled={blocked}
      toggleDisabledReason={blockedReason}
      error={violation ?? undefined}>
      <div role="radiogroup" aria-label="x-indexed value" className="flex flex-wrap gap-3">
        {[true, false].map((option) => (
          <label
            key={String(option)}
            className={
              readOnly
                ? 'pointer-events-none flex items-center gap-1.5 text-[11px]'
                : 'flex cursor-pointer items-center gap-1.5 text-[11px]'
            }>
            <input
              type="radio"
              name={`x-indexed-${pointer}`}
              checked={value === option}
              aria-readonly={readOnly || undefined}
              disabled={option && !info.eligible && value !== true}
              onChange={() => {
                if (!readOnly) onSelect(option);
              }}
            />
            {option ? 'Indexed (true)' : 'Not indexed (false)'}
          </label>
        ))}
      </div>
      {value === true && columns.length > 0 ? (
        <p className="text-[10px] text-primary-text/75">
          Produces columns: <span className="font-mono">{columns.join(', ')}</span>
        </p>
      ) : null}
      <p className="text-[10px] text-primary-text/65">
        Indexing does not make the field filterable or sortable; use x-filterOperators and x-sortable for that.
        The index SQL comes from <code>wf indexes generate</code> and is run by a DBA.
      </p>
    </VNextCardShell>
  );
}

interface XIndexedCardProps {
  pointer: JsonPointer;
}

/** Store shell: feeds the node, its eligibility and its violation into the view. */
export function XIndexedCard({ pointer }: XIndexedCardProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { node } = useSchemaNode(pointer);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-indexed', DEFAULT_VALUE);
  const info = indexInfoAt(getIndexAnalysis(componentJson), pointer);

  return (
    <XIndexedCardView
      pointer={pointer}
      enabled={enabled}
      value={node?.['x-indexed']}
      info={info}
      columns={indexColumnsFor(node)}
      violation={indexViolationFor(info)?.message ?? null}
      onToggle={toggle}
      onSelect={(next) => updateComponent(setKeyword(pointer, 'x-indexed', next))}
    />
  );
}
```

- [ ] **Step 4: Register the keyword**

In `vnextCardRegistry.ts` add the import `import { XIndexedCard } from './XIndexedCard';` (alphabetically after `XFilterOperatorsCard`), change comment line ` *  5. Tabular display           (`x-filterOperators`, `x-sortable`, `x-displayFormat`)` to ` *  5. Tabular display / indexing (`x-filterOperators`, `x-sortable`, `x-displayFormat`, `x-indexed`)`, and insert after the `x-displayFormat` entry:

```ts
  { xKey: 'x-indexed', component: XIndexedCard, scope: 'property' },
```

In `recognizedKeywords.ts` add `'x-indexed',` after `'x-displayFormat',` in `RECOGNIZED_VNEXT_KEYWORDS`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.vitest.test.tsx src/modules/schema-editor/components/tree-editor/detail-panel/tabs/VNextTab.vitest.test.tsx src/modules/schema-editor/components/tree-editor/__tests__/roundtrip.vitest.test.ts`
Expected: PASS (VNextTab now also renders the `x-indexed` card at property pointers).

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.tsx packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XIndexedCard.vitest.test.tsx packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/vnextCardRegistry.ts packages/designer-ui/src/modules/schema-editor/model/recognizedKeywords.ts
git commit -m "$(cat <<'MSG'
feat(schema-editor): x-indexed card with eligibility, columns and filter/sort note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: IDX tree badge and the non-master banner (D3)

**Files:**
- Modify: `packages/designer-ui/src/modules/schema-editor/model/mutators.ts` (append `removeIndexedKeywords`)
- Create: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/property-tree/IndexBadge.tsx`
- Modify: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/property-tree/PropertyTreeNode.tsx`
- Create: `packages/designer-ui/src/modules/schema-editor/components/IndexedTypeMismatchBanner.tsx`
- Modify: `packages/designer-ui/src/modules/schema-editor/components/SchemaEditorPanel.tsx`
- Test (new): `packages/designer-ui/src/modules/schema-editor/model/removeIndexedKeywords.vitest.test.ts`
- Test (new): `packages/designer-ui/src/modules/schema-editor/components/IndexedTypeMismatchBanner.vitest.test.tsx` (also covers `IndexBadge`)

**Interfaces:**
- Consumes: `getIndexAnalysis`, `indexViolationFor`, `indexTypeMismatch`, `IndexNodeInfo` (Task 4); `setKeyword`, `SchemaUpdater`.
- Produces: `removeIndexedKeywords(pointers: readonly JsonPointer[]): SchemaUpdater`; `IndexBadge({ info }: { info: IndexNodeInfo | undefined })`; `IndexedTypeMismatchBanner({ json, onChange })`.

- [ ] **Step 1: Write the failing tests**

`model/removeIndexedKeywords.vitest.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import { removeIndexedKeywords } from './mutators';

describe('removeIndexedKeywords', () => {
  it('deletes x-indexed at every pointer and leaves the rest', () => {
    const doc = {
      key: 'k',
      attributes: {
        type: 'view',
        schema: {
          properties: {
            a: { type: 'number', 'x-indexed': true },
            b: { type: 'array', items: { properties: { c: { type: 'string', 'x-indexed': false } } } },
            d: { type: 'string', 'x-sortable': true },
          },
        },
      },
    };
    const next = produce(doc, removeIndexedKeywords(['/properties/a', '/properties/b/items/properties/c']));
    expect(next.attributes.schema.properties).toEqual({
      a: { type: 'number' },
      b: { type: 'array', items: { properties: { c: { type: 'string' } } } },
      d: { type: 'string', 'x-sortable': true },
    });
  });
});
```

`components/IndexedTypeMismatchBanner.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormReadOnlyProvider } from '../../../ui/FormReadOnlyContext';
import { INDEX_MESSAGES } from '../model/indexEligibility';
import { IndexBadge } from './tree-editor/property-tree/IndexBadge';
import { IndexedTypeMismatchBanner } from './IndexedTypeMismatchBanner';

const doc = (type: string): Record<string, unknown> => ({
  key: 'orders',
  attributes: {
    type,
    schema: {
      properties: {
        a: { type: 'number', 'x-indexed': true },
        b: { type: 'string', 'x-indexed': false },
      },
    },
  },
});

const banner = (json: Record<string, unknown>): ReturnType<typeof createElement> =>
  createElement(IndexedTypeMismatchBanner, { json, onChange: () => undefined });

describe('IndexedTypeMismatchBanner', () => {
  it('names the count and the type and offers the cleanup', () => {
    const html = renderToStaticMarkup(banner(doc('view')));
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).toContain('>view<');
    expect(html).toContain('Remove all x-indexed');
  });

  it('hides the cleanup in read-only hosts', () => {
    const html = renderToStaticMarkup(createElement(FormReadOnlyProvider, null, banner(doc('view'))));
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).not.toContain('Remove all x-indexed');
  });

  it('renders nothing for a master schema', () => {
    expect(renderToStaticMarkup(banner(doc('master')))).toBe('');
  });
});

describe('IndexBadge', () => {
  const info = { pointer: '/properties/a', path: 'a', eligible: true, indexed: true };

  it('marks an indexed field', () => {
    const html = renderToStaticMarkup(createElement(IndexBadge, { info }));
    expect(html).toContain('IDX');
    expect(html).toContain('title="Indexed (x-indexed: true)"');
  });

  it('carries the violation as the title', () => {
    const html = renderToStaticMarkup(
      createElement(IndexBadge, { info: { ...info, eligible: false, reason: 'notScalar' as const } }),
    );
    expect(html).toContain(`title="${INDEX_MESSAGES.notScalar}"`);
  });

  it('renders nothing unless x-indexed is true', () => {
    expect(renderToStaticMarkup(createElement(IndexBadge, { info: { ...info, indexed: false } }))).toBe('');
    expect(renderToStaticMarkup(createElement(IndexBadge, { info: undefined }))).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/removeIndexedKeywords.vitest.test.ts src/modules/schema-editor/components/IndexedTypeMismatchBanner.vitest.test.tsx`
Expected: FAIL — `removeIndexedKeywords`, `IndexBadge`, `IndexedTypeMismatchBanner` do not exist.

- [ ] **Step 3: Append `removeIndexedKeywords` to `model/mutators.ts`**

Insert before the final `export type { JsonPointer };` line:

```ts
/** Delete `x-indexed` at every pointer (the non-master cleanup, D3). */
export function removeIndexedKeywords(pointers: readonly JsonPointer[]): SchemaUpdater {
  return (draft) => {
    for (const pointer of pointers) {
      setKeyword(pointer, 'x-indexed', undefined)(draft);
    }
  };
}
```

- [ ] **Step 4: Create `property-tree/IndexBadge.tsx`**

```tsx
import { Badge } from '../../../../../ui/Badge';
import { indexViolationFor, type IndexNodeInfo } from '../../../model/indexEligibility';

interface IndexBadgeProps {
  info: IndexNodeInfo | undefined;
}

/** IDX marker for `x-indexed: true`; red with the reason when the runtime would reject it. */
export function IndexBadge({ info }: IndexBadgeProps) {
  if (info?.indexed !== true) return null;
  const violation = indexViolationFor(info);
  return (
    <Badge
      variant={violation ? 'destructive' : 'success'}
      className="px-1.5 py-0 text-[9px]"
      title={violation ? violation.message : 'Indexed (x-indexed: true)'}>
      IDX
    </Badge>
  );
}
```

- [ ] **Step 5: Show it in `PropertyTreeNode.tsx`**

Add imports:

```ts
import { getIndexAnalysis } from '../../../model/indexEligibility';
import { IndexBadge } from './IndexBadge';
```

After `const type = getNodeType(node);` add:

```ts
  const indexInfo = getIndexAnalysis(componentJson).get(pointer);
```

and right after the type badge block

```tsx
        {type ? (
          <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
            {type}
          </Badge>
        ) : null}
```

add

```tsx
        <IndexBadge info={indexInfo} />
```

- [ ] **Step 6: Create `components/IndexedTypeMismatchBanner.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';

import { Button } from '../../../ui/Button';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
import { indexTypeMismatch } from '../model/indexEligibility';
import { removeIndexedKeywords } from '../model/mutators';

interface IndexedTypeMismatchBannerProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

/** D3: x-indexed anywhere while attributes.type is not master — the runtime rejects the schema at publish. */
export function IndexedTypeMismatchBanner({ json, onChange }: IndexedTypeMismatchBannerProps) {
  const readOnly = useFormReadOnly();
  const mismatch = indexTypeMismatch(json);
  if (!mismatch) return null;
  const count = mismatch.indexedPointers.length;
  const typeLabel = mismatch.schemaType?.trim() ? mismatch.schemaType : '(not set)';

  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-xs">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        This schema declares x-indexed on {count} {count === 1 ? 'field' : 'fields'}, but attributes.type is{' '}
        <span className="font-mono">{typeLabel}</span>. Only master schemas may declare x-indexed; the runtime
        rejects this schema at publish. Set the schema type to master or remove the flags.
      </p>
      {!readOnly && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(removeIndexedKeywords(mismatch.indexedPointers))}>
          Remove all x-indexed
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Render it in `SchemaEditorPanel.tsx`**

Add the import `import { IndexedTypeMismatchBanner } from './IndexedTypeMismatchBanner';` and insert between the closing `</Card>` of **Schema Metadata** and the opening `<Card …>` of **JSON Schema**:

```tsx
      <IndexedTypeMismatchBanner json={json} onChange={onChange} />
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/removeIndexedKeywords.vitest.test.ts src/modules/schema-editor/components/IndexedTypeMismatchBanner.vitest.test.tsx src/modules/schema-editor/model/mutators.vitest.test.ts`
Expected: PASS.

- [ ] **Step 9: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/model/mutators.ts packages/designer-ui/src/modules/schema-editor/model/removeIndexedKeywords.vitest.test.ts packages/designer-ui/src/modules/schema-editor/components/tree-editor/property-tree/IndexBadge.tsx packages/designer-ui/src/modules/schema-editor/components/tree-editor/property-tree/PropertyTreeNode.tsx packages/designer-ui/src/modules/schema-editor/components/IndexedTypeMismatchBanner.tsx packages/designer-ui/src/modules/schema-editor/components/IndexedTypeMismatchBanner.vitest.test.tsx packages/designer-ui/src/modules/schema-editor/components/SchemaEditorPanel.tsx
git commit -m "$(cat <<'MSG'
feat(schema-editor): IDX tree badge and non-master x-indexed banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Schema component loader and the workflow cross-check (D6)

**Files:**
- Create: `packages/designer-ui/src/modules/vnext-workspace/loadSchemaComponent.ts`
- Create: `packages/designer-ui/src/modules/vnext-workspace/useSchemaComponentJson.ts`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSchemaSection.tsx`
- Test (new): `packages/designer-ui/src/modules/vnext-workspace/loadSchemaComponent.vitest.test.ts`
- Test (new): `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.vitest.test.tsx`

**Interfaces:**
- Consumes: `indexTypeMismatch`, `IndexTypeMismatch` (Task 4); `discoverVnextComponentsByCategory`, `unwrapApi`, `useProjectStore`, `subscribeWorkspaceFsChange`.
- Produces (Task 10 uses the first four):
  - `interface SchemaReferenceLike { key: string; domain?: string; version?: string; flow?: string }`
  - `readSchemaReference(value: unknown): SchemaReferenceLike | null`
  - `interface SchemaComponentLoaderDeps { listSchemas: (projectId: string) => Promise<DiscoveredVnextComponent[]>; readText: (path: string) => Promise<string> }`
  - `defaultSchemaComponentLoaderDeps: SchemaComponentLoaderDeps`
  - `loadSchemaComponent(projectId: string, ref: SchemaReferenceLike, deps?: SchemaComponentLoaderDeps): Promise<Record<string, unknown> | null>`
  - `useSchemaComponentJson(ref: SchemaReferenceLike | null): Record<string, unknown> | null`
  - `SchemaIndexTypeWarning({ schemaKey, mismatch }: { schemaKey: string; mismatch: IndexTypeMismatch | null })`

- [ ] **Step 1: Write the failing tests**

`vnext-workspace/loadSchemaComponent.vitest.test.ts`:

```ts
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { describe, expect, it } from 'vitest';

import { loadSchemaComponent, readSchemaReference, type SchemaComponentLoaderDeps } from './loadSchemaComponent';

const LIST: DiscoveredVnextComponent[] = [
  { key: 'orders', path: '/p/partner/Schemas/orders.json', flow: 'sys-schemas', domain: 'partner' },
  { key: 'orders', path: '/p/core/Schemas/orders.json', flow: 'sys-schemas', domain: 'core' },
  { key: 'broken', path: '/p/core/Schemas/broken.json', flow: 'sys-schemas', domain: 'core' },
];
const FILES: Record<string, string> = {
  '/p/partner/Schemas/orders.json': JSON.stringify({ key: 'orders', domain: 'partner' }),
  '/p/core/Schemas/orders.json': JSON.stringify({ key: 'orders', domain: 'core' }),
  '/p/core/Schemas/broken.json': '{ not json',
};
const deps: SchemaComponentLoaderDeps = {
  listSchemas: () => Promise.resolve(LIST),
  readText: (path) => {
    const content = FILES[path];
    return content === undefined ? Promise.reject(new Error('missing')) : Promise.resolve(content);
  },
};

describe('readSchemaReference', () => {
  it('reads key, domain, version and flow', () => {
    expect(readSchemaReference({ key: 'orders', domain: 'core', version: '1.0.0', flow: 'sys-schemas' })).toEqual({
      key: 'orders',
      domain: 'core',
      version: '1.0.0',
      flow: 'sys-schemas',
    });
  });

  it('returns null without a key', () => {
    expect(readSchemaReference({ domain: 'core' })).toBeNull();
    expect(readSchemaReference({ key: '  ' })).toBeNull();
    expect(readSchemaReference('orders')).toBeNull();
    expect(readSchemaReference(undefined)).toBeNull();
  });
});

describe('loadSchemaComponent', () => {
  it('prefers the component of the referenced domain', async () => {
    expect(await loadSchemaComponent('core', { key: 'orders', domain: 'core' }, deps)).toEqual({
      key: 'orders',
      domain: 'core',
    });
  });

  it('falls back to the first component with the key', async () => {
    expect(await loadSchemaComponent('core', { key: 'orders' }, deps)).toEqual({ key: 'orders', domain: 'partner' });
  });

  it('returns null for unknown keys and unreadable files', async () => {
    expect(await loadSchemaComponent('core', { key: 'ghost' }, deps)).toBeNull();
    expect(await loadSchemaComponent('core', { key: 'broken' }, deps)).toBeNull();
  });
});
```

`sections/SchemaIndexTypeWarning.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaIndexTypeWarning } from './SchemaIndexTypeWarning';

describe('SchemaIndexTypeWarning', () => {
  it('names the schema, the count and the type', () => {
    const html = renderToStaticMarkup(
      createElement(SchemaIndexTypeWarning, {
        schemaKey: 'orders-master',
        mismatch: { schemaType: 'schema', indexedPointers: ['/properties/a', '/properties/b'] },
      }),
    );
    expect(html).toContain('orders-master');
    expect(html).toContain('x-indexed on 2 fields');
    expect(html).toContain('>schema<');
    expect(html).toContain('role="alert"');
  });

  it('labels a missing type', () => {
    const html = renderToStaticMarkup(
      createElement(SchemaIndexTypeWarning, {
        schemaKey: 'orders-master',
        mismatch: { schemaType: undefined, indexedPointers: ['/properties/a'] },
      }),
    );
    expect(html).toContain('x-indexed on 1 field');
    expect(html).toContain('(not set)');
  });

  it('renders nothing without a mismatch', () => {
    expect(renderToStaticMarkup(createElement(SchemaIndexTypeWarning, { schemaKey: 'x', mismatch: null }))).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/vnext-workspace/loadSchemaComponent.vitest.test.ts src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.vitest.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `vnext-workspace/loadSchemaComponent.ts`**

```ts
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import { unwrapApi } from '../../api/client.js';
import { discoverVnextComponentsByCategory } from './vnextComponentDiscovery.js';

export interface SchemaReferenceLike {
  key: string;
  domain?: string;
  version?: string;
  flow?: string;
}

/** A `{ key, domain?, version?, flow? }` reference (e.g. workflow `attributes.schema`), or `null`. */
export function readSchemaReference(value: unknown): SchemaReferenceLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as Record<string, unknown>;
  if (typeof ref.key !== 'string' || ref.key.trim() === '') return null;
  return {
    key: ref.key,
    ...(typeof ref.domain === 'string' ? { domain: ref.domain } : {}),
    ...(typeof ref.version === 'string' ? { version: ref.version } : {}),
    ...(typeof ref.flow === 'string' ? { flow: ref.flow } : {}),
  };
}

export interface SchemaComponentLoaderDeps {
  listSchemas: (projectId: string) => Promise<DiscoveredVnextComponent[]>;
  readText: (path: string) => Promise<string>;
}

export const defaultSchemaComponentLoaderDeps: SchemaComponentLoaderDeps = {
  listSchemas: (projectId) => discoverVnextComponentsByCategory(projectId, 'schemas'),
  readText: async (path) => {
    const file = await unwrapApi<{ content: string }>(
      { method: 'files/read', params: { path: path.replace(/\\/g, '/') } },
      'Failed to read file',
    );
    return file.content;
  },
};

/**
 * Local schema component for `ref`, found by key in the project's schema
 * folder (the referenced domain wins when several solutions share the key).
 * Returns `null` on any failure — callers treat a missing schema as "no data".
 * Discovery de-dupes by key per solution, so `version` is not used to select.
 */
export async function loadSchemaComponent(
  projectId: string,
  ref: SchemaReferenceLike,
  deps: SchemaComponentLoaderDeps = defaultSchemaComponentLoaderDeps,
): Promise<Record<string, unknown> | null> {
  try {
    const sameKey = (await deps.listSchemas(projectId)).filter((s) => s.key === ref.key);
    const match = sameKey.find((s) => ref.domain !== undefined && s.domain === ref.domain) ?? sameKey[0];
    if (!match) return null;
    const parsed: unknown = JSON.parse(await deps.readText(match.path));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create `vnext-workspace/useSchemaComponentJson.ts`**

```ts
import { useEffect, useState } from 'react';

import { useProjectStore } from '../../store/useProjectStore.js';
import { subscribeWorkspaceFsChange } from '../../workspace-fs-events/index.js';
import { loadSchemaComponent, type SchemaReferenceLike } from './loadSchemaComponent.js';

/**
 * The referenced schema component of the active project, reloaded when the
 * reference changes or a workspace file is written (e.g. the schema is fixed
 * in the modal editor). `null` while loading, when absent, or on failure.
 */
export function useSchemaComponentJson(ref: SchemaReferenceLike | null): Record<string, unknown> | null {
  const projectId = useProjectStore((s) => s.activeProject?.id);
  const [json, setJson] = useState<Record<string, unknown> | null>(null);
  const [revision, setRevision] = useState(0);
  const key = ref?.key;
  const domain = ref?.domain;

  useEffect(() => subscribeWorkspaceFsChange(() => setRevision((r) => r + 1)), []);

  useEffect(() => {
    if (!projectId || !key) {
      setJson(null);
      return;
    }
    let cancelled = false;
    void loadSchemaComponent(projectId, { key, ...(domain ? { domain } : {}) }).then((loaded) => {
      if (!cancelled) setJson(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, key, domain, revision]);

  return json;
}
```

- [ ] **Step 5: Create `sections/SchemaIndexTypeWarning.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';

import type { IndexTypeMismatch } from '../../../../schema-editor/model/indexEligibility';

export interface SchemaIndexTypeWarningProps {
  schemaKey: string;
  mismatch: IndexTypeMismatch | null;
}

/** D6: the workflow's master schema declares x-indexed but is not typed master. */
export function SchemaIndexTypeWarning({ schemaKey, mismatch }: SchemaIndexTypeWarningProps) {
  if (!mismatch) return null;
  const count = mismatch.indexedPointers.length;
  const typeLabel = mismatch.schemaType?.trim() ? mismatch.schemaType : '(not set)';

  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Schema <span className="font-mono">{schemaKey}</span> declares x-indexed on {count}{' '}
        {count === 1 ? 'field' : 'fields'}, but its attributes.type is{' '}
        <span className="font-mono">{typeLabel}</span>. Only master schemas may declare x-indexed; the runtime
        rejects it at publish. Open the schema and set its type to master, or remove the flags.
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Wire the cross-check into `WorkflowSchemaSection.tsx`**

Add imports:

```ts
import { indexTypeMismatch } from '../../../../schema-editor/model/indexEligibility';
import { readSchemaReference } from '../../../../vnext-workspace/loadSchemaComponent';
import { useSchemaComponentJson } from '../../../../vnext-workspace/useSchemaComponentJson';
import { SchemaIndexTypeWarning } from './SchemaIndexTypeWarning';
```

Hooks must run before the early `return null`, so after `const [createOpen, setCreateOpen] = useState(false);` add:

```ts
  const schemaRef = readSchemaReference(
    (workflowJson as { attributes?: { schema?: unknown } } | null)?.attributes?.schema,
  );
  const referencedSchema = useSchemaComponentJson(schemaRef);
```

Then, directly after the `{schema && ( <div …> … </div> )}` block that renders the chosen schema row, add:

```tsx
        {schema?.key && referencedSchema ? (
          <SchemaIndexTypeWarning schemaKey={schema.key} mismatch={indexTypeMismatch(referencedSchema)} />
        ) : null}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/vnext-workspace/loadSchemaComponent.vitest.test.ts src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 8: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/vnext-workspace/loadSchemaComponent.ts packages/designer-ui/src/modules/vnext-workspace/loadSchemaComponent.vitest.test.ts packages/designer-ui/src/modules/vnext-workspace/useSchemaComponentJson.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/SchemaIndexTypeWarning.vitest.test.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSchemaSection.tsx
git commit -m "$(cat <<'MSG'
feat(canvas): warn when the master schema has x-indexed but is not typed master

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Instance filter value limits (D5)

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/utils/instanceFilterSerializer.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `MAX_FILTER_VALUE_LENGTH = 1000`, `MAX_FILTER_LENGTH = 5000`; `SerializedFilter` gains `filterError?: string` (set, with `filter` undefined, when the JSON exceeds 5000 characters). Used by Task 11.

- [ ] **Step 1: Write the failing tests**

Replace the import block of `instanceFilterSerializer.vitest.test.ts` with

```ts
import {
  INSTANCE_FIELDS,
  INSTANCE_TYPE_OPTIONS,
  MAX_FILTER_LENGTH,
  MAX_FILTER_VALUE_LENGTH,
  getOperatorsForFieldType,
  isValidAttributePath,
  serializeCondition,
  serializeInstanceFilter,
  serializeInstanceSort,
  sortableInstanceFields,
  type FilterCondition,
} from './instanceFilterSerializer';
```

and append at the end of the file:

```ts
describe('runtime value limits', () => {
  const long = 'x'.repeat(MAX_FILTER_VALUE_LENGTH + 1);

  it('uses the runtime InputValidator limits', () => {
    expect(MAX_FILTER_VALUE_LENGTH).toBe(1000);
    expect(MAX_FILTER_LENGTH).toBe(5000);
  });

  it('accepts a value of exactly 1000 characters', () => {
    expect(serializeCondition(attr('name', 'like', 'x'.repeat(1000))).error).toBeUndefined();
  });

  it('rejects longer text and scalar values', () => {
    expect(serializeCondition(attr('name', 'like', long)).error).toContain('1000');
    expect(serializeCondition(attr('name', 'eq', long)).error).toContain('1000');
  });

  it('checks every in / nin element', () => {
    expect(serializeCondition(attr('name', 'in', `a, ${long}`)).error).toContain('1000');
    expect(serializeCondition(attr('name', 'nin', `${long}, b`)).error).toContain('1000');
  });

  it('checks both between bounds', () => {
    expect(serializeCondition(attr('name', 'between', 'a', undefined, long)).error).toMatch(/^Upper bound: .*1000/);
    expect(serializeCondition(attr('name', 'between', long, undefined, 'b')).error).toMatch(/^Lower bound: .*1000/);
  });

  it('rejects a serialized filter longer than 5000 characters', () => {
    const conditions = Array.from({ length: 6 }, (_, i) => attr(`f${i}`, 'eq', 'y'.repeat(900)));
    const result = serializeInstanceFilter(conditions);
    expect(result.filter).toBeUndefined();
    expect(result.errors).toEqual({});
    expect(result.filterError).toContain('5000');
  });

  it('keeps filters within the limit', () => {
    const result = serializeInstanceFilter([attr('f', 'eq', 'y'.repeat(900))]);
    expect(result.filter).toBeDefined();
    expect(result.filterError).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts`
Expected: FAIL — `MAX_FILTER_VALUE_LENGTH` / `MAX_FILTER_LENGTH` are not exported; long values serialize.

- [ ] **Step 3: Add the limits to `instanceFilterSerializer.ts`**

After `const ATTRIBUTE_SEGMENT = /^[a-zA-Z0-9_]+$/;` add:

```ts
/** Runtime `InputValidator.MaxValueLength`: one scalar operand (each `in`/`nin` element, each `between` bound). */
export const MAX_FILTER_VALUE_LENGTH = 1000;
/** Runtime `InputValidator.MaxFilterLength`: the whole `filter` JSON string. */
export const MAX_FILTER_LENGTH = 5000;

function valueTooLong(value: string): string | undefined {
  return value.length > MAX_FILTER_VALUE_LENGTH
    ? `Values may be at most ${MAX_FILTER_VALUE_LENGTH} characters (this one has ${value.length}).`
    : undefined;
}
```

In `coerceScalar`, after `if (!v) return { error: 'Value is required.' };` add:

```ts
  const tooLong = valueTooLong(v);
  if (tooLong) return { error: tooLong };
```

In `serializeCondition`, replace the text-operator branch

```ts
    case 'like':
    case 'match':
    case 'startswith':
    case 'endswith': {
      const v = c.value.trim();
      if (!v) return { error: 'Value is required.' };
      wireValue = v;
      break;
    }
```

with

```ts
    case 'like':
    case 'match':
    case 'startswith':
    case 'endswith': {
      const v = c.value.trim();
      if (!v) return { error: 'Value is required.' };
      const tooLong = valueTooLong(v);
      if (tooLong) return { error: tooLong };
      wireValue = v;
      break;
    }
```

Replace the `SerializedFilter` interface with

```ts
export interface SerializedFilter {
  /** JSON string for the `filter` query parameter; undefined when there are no conditions. */
  filter?: string;
  /** Row index → message. Empty when everything serialized. */
  errors: Record<number, string>;
  /** Whole-filter problem (the runtime's 5000-character limit); `filter` is then undefined. */
  filterError?: string;
}
```

and replace the last two lines of `serializeInstanceFilter`

```ts
  if (nodes.length === 0) return { errors };
  return { filter: JSON.stringify(nodes.length === 1 ? nodes[0] : { and: nodes }), errors };
```

with

```ts
  if (nodes.length === 0) return { errors };
  const filter = JSON.stringify(nodes.length === 1 ? nodes[0] : { and: nodes });
  if (filter.length > MAX_FILTER_LENGTH) {
    return {
      errors,
      filterError: `The filter is ${filter.length} characters long; the runtime accepts at most ${MAX_FILTER_LENGTH}. Remove conditions or shorten values.`,
    };
  }
  return { filter, errors };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts`
Expected: PASS (old and new tests).

- [ ] **Step 5: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/quick-run/utils/instanceFilterSerializer.ts packages/designer-ui/src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts
git commit -m "$(cat <<'MSG'
feat(quick-run): enforce the runtime filter value and length limits client-side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: Master schema field model and loader (D5)

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/masterSchemaFields.ts`
- Create: `packages/designer-ui/src/modules/quick-run/utils/workflowMasterSchema.ts`
- Test (new): `packages/designer-ui/src/modules/quick-run/utils/masterSchemaFields.vitest.test.ts`
- Test (new): `packages/designer-ui/src/modules/quick-run/utils/workflowMasterSchema.vitest.test.ts`

**Interfaces:**
- Consumes: `getFieldType`, `getOperatorsForFieldType`, `FilterCondition`, `FilterOperator`, `FilterValueType` (`instanceFilterSerializer.ts`); `readSchemaReference`, `loadSchemaComponent`, `SchemaComponentLoaderDeps` (Task 8).
- Produces (Task 11):
  - `interface MasterSchemaField { path: string; type: string; format?: string; indexed: boolean; filterOperators: string[]; sortable: boolean }`
  - `collectMasterSchemaFields(schemaRoot: unknown): MasterSchemaField[]`
  - `findSchemaField(fields: readonly MasterSchemaField[] | undefined, path: string): MasterSchemaField | undefined`
  - `fieldValueType(field: MasterSchemaField): FilterValueType`
  - `SCHEMA_OPERATOR_FOR_WIRE: Record<FilterOperator, string>`
  - `isOperatorAllowedBySchema(field: MasterSchemaField, op: FilterOperator): boolean`
  - `operatorsForCondition(c: FilterCondition, fields?: readonly MasterSchemaField[]): FilterOperator[]`
  - `schemaFieldNotice(c: FilterCondition, fields?: readonly MasterSchemaField[]): string | null`
  - `usesIndexProjection(op: FilterOperator): boolean`
  - `interface AttributeSortOption { value: string; label: string; indexed: boolean }`, `sortableAttributeOptions(fields?: readonly MasterSchemaField[]): AttributeSortOption[]`
  - `describeSchemaField(field: MasterSchemaField): string`
  - `type MasterSchemaLoad = { status: 'none' } | { status: 'unavailable' } | { status: 'ready'; schemaKey: string; fields: MasterSchemaField[] }`
  - `interface MasterSchemaLoaderDeps extends SchemaComponentLoaderDeps { resolveWorkflowFile: (workflowKey: string) => Promise<{ path: string; projectId: string } | null> }`
  - `loadWorkflowMasterSchema(workflowKey: string, deps: MasterSchemaLoaderDeps): Promise<MasterSchemaLoad>`

- [ ] **Step 1: Write the failing tests**

`utils/masterSchemaFields.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { FilterCondition } from './instanceFilterSerializer';
import {
  collectMasterSchemaFields,
  describeSchemaField,
  fieldValueType,
  findSchemaField,
  operatorsForCondition,
  schemaFieldNotice,
  sortableAttributeOptions,
  usesIndexProjection,
} from './masterSchemaFields';

const SCHEMA = {
  type: 'object',
  properties: {
    amount: { type: 'number', 'x-indexed': true, 'x-filterOperators': ['eq', 'gte', 'in', 'neq'], 'x-sortable': true },
    when: { type: 'string', format: 'date-time', 'x-indexed': true, 'x-filterOperators': ['gte'] },
    customer: {
      type: 'object',
      properties: { name: { type: 'string', 'x-filterOperators': ['eq', 'contains', 'startsWith', ' '] } },
    },
    legacy: { type: 'number', 'x-filterOperators': ['ge'] },
    active: { type: 'boolean', 'x-filterOperators': ['eq'] },
    plain: {},
    tags: 'not a schema',
  },
};
const FIELDS = collectMasterSchemaFields(SCHEMA);
const field = (path: string) => findSchemaField(FIELDS, path)!;
const attr = (path: string, valueType: FilterCondition['valueType'] = 'text'): FilterCondition => ({
  category: 'attribute',
  field: path,
  operator: 'eq',
  value: '',
  valueType,
});

describe('collectMasterSchemaFields (runtime SchemaFilterMetadataResolver)', () => {
  it('collects dotted paths of object-valued properties, recursing into nested properties', () => {
    expect(FIELDS.map((f) => f.path)).toEqual(['amount', 'when', 'customer', 'customer.name', 'legacy', 'active', 'plain']);
  });

  it('reads type (default string), format, x-indexed, x-sortable and non-blank x-filterOperators', () => {
    expect(field('amount')).toEqual({
      path: 'amount',
      type: 'number',
      indexed: true,
      filterOperators: ['eq', 'gte', 'in', 'neq'],
      sortable: true,
    });
    expect(field('when').format).toBe('date-time');
    expect(field('customer.name').filterOperators).toEqual(['eq', 'contains', 'startsWith']);
    expect(field('plain')).toEqual({ path: 'plain', type: 'string', indexed: false, filterOperators: [], sortable: false });
  });

  it('returns nothing for non-object schemas', () => {
    expect(collectMasterSchemaFields(null)).toEqual([]);
  });
});

describe('fieldValueType', () => {
  it('maps schema types to value coercion', () => {
    expect(fieldValueType(field('amount'))).toBe('number');
    expect(fieldValueType(field('when'))).toBe('date');
    expect(fieldValueType(field('active'))).toBe('boolean');
    expect(fieldValueType(field('customer.name'))).toBe('text');
  });
});

describe('operatorsForCondition (runtime SchemaFilterContext.IsOperatorAllowed)', () => {
  it('keeps only type operators whose schema spelling is listed', () => {
    expect(operatorsForCondition(attr('amount', 'number'), FIELDS)).toEqual(['eq', 'ne', 'ge', 'in']);
    expect(operatorsForCondition(attr('customer.name'), FIELDS)).toEqual(['eq', 'like', 'match', 'startswith']);
  });

  it('does not honour legacy spellings in the schema (the runtime rejects them too)', () => {
    expect(operatorsForCondition(attr('legacy', 'number'), FIELDS)).toEqual([
      'eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'in', 'nin', 'isNull',
    ]);
    expect(schemaFieldNotice(attr('legacy', 'number'), FIELDS)).toContain('runtime spellings');
  });

  it('falls back to the type operators with a notice for undeclared or unfilterable fields', () => {
    expect(operatorsForCondition(attr('ghost'), FIELDS)).toContain('like');
    expect(schemaFieldNotice(attr('ghost'), FIELDS)).toContain('Not declared in the master schema');
    expect(schemaFieldNotice(attr('plain'), FIELDS)).toContain('no x-filterOperators');
  });

  it('is unchanged without a schema and for instance fields', () => {
    expect(schemaFieldNotice(attr('ghost'), undefined)).toBeNull();
    const status: FilterCondition = { category: 'instance', field: 'status', operator: 'eq', value: '' };
    expect(operatorsForCondition(status, FIELDS)).toEqual(['eq', 'ne', 'in', 'nin']);
    expect(schemaFieldNotice(status, FIELDS)).toBeNull();
    expect(schemaFieldNotice(attr('amount', 'number'), FIELDS)).toBeNull();
  });
});

describe('usesIndexProjection (runtime AttributeConditionBuilder)', () => {
  it('is true for comparisons, text, membership and isNull; false for containment operators', () => {
    for (const op of ['gt', 'ge', 'lt', 'le', 'between', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull'] as const) {
      expect(usesIndexProjection(op)).toBe(true);
    }
    for (const op of ['eq', 'ne', 'includes'] as const) expect(usesIndexProjection(op)).toBe(false);
  });
});

describe('sortableAttributeOptions and describeSchemaField', () => {
  it('offers attributes.<path> for x-sortable fields', () => {
    expect(sortableAttributeOptions(FIELDS)).toEqual([{ value: 'attributes.amount', label: 'amount', indexed: true }]);
    expect(sortableAttributeOptions(undefined)).toEqual([]);
  });

  it('describes type, index and filterability', () => {
    expect(describeSchemaField(field('amount'))).toBe('number · IDX');
    expect(describeSchemaField(field('plain'))).toBe('string · not filterable');
  });
});
```

`utils/workflowMasterSchema.vitest.test.ts`:

```ts
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { describe, expect, it } from 'vitest';

import { loadWorkflowMasterSchema, type MasterSchemaLoaderDeps } from './workflowMasterSchema';

const SCHEMA = { type: 'object', properties: { amount: { type: 'number', 'x-filterOperators': ['gte'] } } };

function deps(files: Record<string, string>, schemas: DiscoveredVnextComponent[]): MasterSchemaLoaderDeps {
  return {
    resolveWorkflowFile: (key) => Promise.resolve(key === 'mt' ? { path: '/p/Workflows/mt.json', projectId: 'core' } : null),
    readText: (path) => {
      const content = files[path];
      return content === undefined ? Promise.reject(new Error('missing')) : Promise.resolve(content);
    },
    listSchemas: () => Promise.resolve(schemas),
  };
}

const WORKFLOW = JSON.stringify({
  key: 'mt',
  attributes: { schema: { key: 'mt-master', domain: 'core', flow: 'sys-schemas', version: '1.0.0' } },
});
const MASTER = JSON.stringify({ key: 'mt-master', attributes: { type: 'master', schema: SCHEMA } });
const LISTED: DiscoveredVnextComponent[] = [
  { key: 'mt-master', path: '/p/Schemas/mt-master.json', flow: 'sys-schemas', domain: 'core' },
];

describe('loadWorkflowMasterSchema', () => {
  it('returns the fields of the workflow master schema', async () => {
    const load = await loadWorkflowMasterSchema(
      'mt',
      deps({ '/p/Workflows/mt.json': WORKFLOW, '/p/Schemas/mt-master.json': MASTER }, LISTED),
    );
    expect(load).toEqual({
      status: 'ready',
      schemaKey: 'mt-master',
      fields: [{ path: 'amount', type: 'number', indexed: false, filterOperators: ['gte'], sortable: false }],
    });
  });

  it('reports none when the workflow has no master schema', async () => {
    const load = await loadWorkflowMasterSchema(
      'mt',
      deps({ '/p/Workflows/mt.json': JSON.stringify({ key: 'mt', attributes: {} }) }, LISTED),
    );
    expect(load).toEqual({ status: 'none' });
  });

  it('reports unavailable when the workflow or schema cannot be read', async () => {
    expect(await loadWorkflowMasterSchema('other', deps({}, LISTED))).toEqual({ status: 'unavailable' });
    expect(await loadWorkflowMasterSchema('mt', deps({ '/p/Workflows/mt.json': WORKFLOW }, []))).toEqual({
      status: 'unavailable',
    });
    expect(await loadWorkflowMasterSchema('mt', deps({ '/p/Workflows/mt.json': '{ broken' }, LISTED))).toEqual({
      status: 'unavailable',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/masterSchemaFields.vitest.test.ts src/modules/quick-run/utils/workflowMasterSchema.vitest.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `utils/masterSchemaFields.ts`**

```ts
/**
 * QuickRunner view of the workflow's master schema, mirroring the runtime:
 * - field collection: `SchemaFilterMetadataResolver` (dotted paths, type
 *   defaults to `string`, recursion into nested `properties`);
 * - operator allowance: `SchemaFilterContext.IsOperatorAllowed` (wire operator
 *   → schema spelling, case-insensitive exact match in `x-filterOperators`);
 * - index use: `AttributeConditionBuilder` storage switch.
 */
import {
  getFieldType,
  getOperatorsForFieldType,
  type FilterCondition,
  type FilterOperator,
  type FilterValueType,
} from './instanceFilterSerializer';

export interface MasterSchemaField {
  /** Dotted instance-data path (`customer.name`). */
  path: string;
  /** JSON Schema `type`; the runtime treats a missing or non-string type as `string`. */
  type: string;
  format?: string;
  indexed: boolean;
  /** `x-filterOperators` verbatim (non-blank strings). Empty → not filterable. */
  filterOperators: string[];
  sortable: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function collectMasterSchemaFields(schemaRoot: unknown): MasterSchemaField[] {
  const fields: MasterSchemaField[] = [];
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    const properties = node.properties;
    if (!isRecord(properties)) return;
    for (const [name, value] of Object.entries(properties)) {
      if (!isRecord(value)) continue;
      const path = prefix === '' ? name : `${prefix}.${name}`;
      const rawOperators: unknown = value['x-filterOperators'];
      fields.push({
        path,
        type: typeof value.type === 'string' ? value.type : 'string',
        ...(typeof value.format === 'string' ? { format: value.format } : {}),
        indexed: value['x-indexed'] === true,
        filterOperators: Array.isArray(rawOperators)
          ? (rawOperators as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim() !== '')
          : [],
        sortable: value['x-sortable'] === true,
      });
      if (value.properties !== undefined) walk(value, path);
    }
  };
  if (isRecord(schemaRoot)) walk(schemaRoot, '');
  return fields;
}

export function findSchemaField(
  fields: readonly MasterSchemaField[] | undefined,
  path: string,
): MasterSchemaField | undefined {
  return fields?.find((f) => f.path === path);
}

export function fieldValueType(field: MasterSchemaField): FilterValueType {
  if (field.type === 'number' || field.type === 'integer') return 'number';
  if (field.type === 'boolean') return 'boolean';
  if (field.type === 'string' && field.format === 'date-time') return 'date';
  return 'text';
}

/** Runtime `SchemaFilterContext.ToSchemaOperator`: wire operator → `x-filterOperators` spelling. */
export const SCHEMA_OPERATOR_FOR_WIRE: Record<FilterOperator, string> = {
  eq: 'eq',
  ne: 'neq',
  gt: 'gt',
  ge: 'gte',
  lt: 'lt',
  le: 'lte',
  between: 'between',
  like: 'contains',
  match: 'contains',
  startswith: 'startsWith',
  endswith: 'endsWith',
  in: 'in',
  nin: 'nin',
  isNull: 'isNull',
  includes: 'includes',
};

export function isOperatorAllowedBySchema(field: MasterSchemaField, op: FilterOperator): boolean {
  const schemaOp = SCHEMA_OPERATOR_FOR_WIRE[op].toLowerCase();
  return field.filterOperators.some((o) => o.toLowerCase() === schemaOp);
}

function typeOperators(c: FilterCondition): FilterOperator[] {
  return getOperatorsForFieldType(getFieldType(c.category, c.field), c.valueType);
}

/**
 * Operators offered for a condition: the type-based list, narrowed to what the
 * master schema grants. Falls back to the type-based list (with a
 * {@link schemaFieldNotice}) when the schema grants nothing usable.
 */
export function operatorsForCondition(
  c: FilterCondition,
  fields?: readonly MasterSchemaField[],
): FilterOperator[] {
  const base = typeOperators(c);
  if (c.category !== 'attribute') return base;
  const field = findSchemaField(fields, c.field.trim());
  if (!field || field.filterOperators.length === 0) return base;
  const allowed = base.filter((op) => isOperatorAllowedBySchema(field, op));
  return allowed.length > 0 ? allowed : base;
}

/** Why the runtime may reject an attribute condition, or `null`. Only when a master schema was loaded. */
export function schemaFieldNotice(c: FilterCondition, fields?: readonly MasterSchemaField[]): string | null {
  if (c.category !== 'attribute' || !fields) return null;
  const field = findSchemaField(fields, c.field.trim());
  if (!field) {
    return 'Not declared in the master schema. The runtime rejects it while schema filter enforcement is on.';
  }
  if (field.filterOperators.length === 0) {
    return 'Not filterable: the master schema declares no x-filterOperators for this field.';
  }
  if (!typeOperators(c).some((op) => isOperatorAllowedBySchema(field, op))) {
    return 'No operator for this value type is listed in x-filterOperators (the runtime expects runtime spellings such as gte, neq, contains).';
  }
  return null;
}

const INDEX_BACKED_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'gt', 'ge', 'lt', 'le', 'between', 'like', 'match', 'startswith', 'endswith', 'in', 'nin', 'isNull',
]);

/** True when the runtime reads the x-indexed projection for this operator (not for eq, ne, includes). */
export function usesIndexProjection(op: FilterOperator): boolean {
  return INDEX_BACKED_OPERATORS.has(op);
}

export interface AttributeSortOption {
  value: string;
  label: string;
  indexed: boolean;
}

export function sortableAttributeOptions(fields?: readonly MasterSchemaField[]): AttributeSortOption[] {
  return (fields ?? [])
    .filter((f) => f.sortable)
    .map((f) => ({ value: `attributes.${f.path}`, label: f.path, indexed: f.indexed }));
}

export function describeSchemaField(field: MasterSchemaField): string {
  const parts = [field.type];
  if (field.indexed) parts.push('IDX');
  if (field.filterOperators.length === 0) parts.push('not filterable');
  return parts.join(' · ');
}
```

- [ ] **Step 4: Implement `utils/workflowMasterSchema.ts`**

```ts
import {
  loadSchemaComponent,
  readSchemaReference,
  type SchemaComponentLoaderDeps,
} from '../../vnext-workspace/loadSchemaComponent';
import { collectMasterSchemaFields, type MasterSchemaField } from './masterSchemaFields';

export type MasterSchemaLoad =
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'ready'; schemaKey: string; fields: MasterSchemaField[] };

export interface MasterSchemaLoaderDeps extends SchemaComponentLoaderDeps {
  resolveWorkflowFile: (workflowKey: string) => Promise<{ path: string; projectId: string } | null>;
}

const NONE: MasterSchemaLoad = { status: 'none' };
const UNAVAILABLE: MasterSchemaLoad = { status: 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Local master schema (`attributes.schema` of the workflow file) as QuickRunner
 * filter fields. `none` when the workflow declares no master schema,
 * `unavailable` when anything cannot be read.
 */
export async function loadWorkflowMasterSchema(
  workflowKey: string,
  deps: MasterSchemaLoaderDeps,
): Promise<MasterSchemaLoad> {
  try {
    const workflowFile = await deps.resolveWorkflowFile(workflowKey);
    if (!workflowFile) return UNAVAILABLE;
    const workflow: unknown = JSON.parse(await deps.readText(workflowFile.path));
    const attributes = isRecord(workflow) ? workflow.attributes : undefined;
    const ref = readSchemaReference(isRecord(attributes) ? attributes.schema : undefined);
    if (!ref) return NONE;
    const component = await loadSchemaComponent(workflowFile.projectId, ref, deps);
    const componentAttributes = component?.attributes;
    const schemaRoot = isRecord(componentAttributes) ? componentAttributes.schema : undefined;
    if (!isRecord(schemaRoot)) return UNAVAILABLE;
    return { status: 'ready', schemaKey: ref.key, fields: collectMasterSchemaFields(schemaRoot) };
  } catch {
    return UNAVAILABLE;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/masterSchemaFields.vitest.test.ts src/modules/quick-run/utils/workflowMasterSchema.vitest.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/quick-run/utils/masterSchemaFields.ts packages/designer-ui/src/modules/quick-run/utils/masterSchemaFields.vitest.test.ts packages/designer-ui/src/modules/quick-run/utils/workflowMasterSchema.ts packages/designer-ui/src/modules/quick-run/utils/workflowMasterSchema.vitest.test.ts
git commit -m "$(cat <<'MSG'
feat(quick-run): master schema filter fields mirrored from the runtime resolver

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 11: Schema-aware instance filter panel (D5)

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/hooks/useWorkflowMasterSchema.ts`
- Modify (rewrite): `packages/designer-ui/src/modules/quick-run/components/InstanceFilterPanel.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceListPanel.tsx`
- Test (new): `packages/designer-ui/src/modules/quick-run/components/InstanceFilterPanel.vitest.test.tsx`

**Interfaces:**
- Consumes: everything Task 10 produces; `MAX_FILTER_*` / `filterError` (Task 9); `useWorkflowFileResolver` (`vnext-workspace/resolveWorkflowFileByKey.ts`, `quiet` option); `defaultSchemaComponentLoaderDeps` (Task 8).
- Produces: `useWorkflowMasterSchema(workflowKey: string): MasterSchemaLoad`; `InstanceFilterPanel` props `schemaFields?: readonly MasterSchemaField[]`, `schemaKey?: string`; exported `FilterRow` with `interface FilterRowProps { condition; error?; schemaFields?; onChange; onRemove }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { FilterCondition } from '../utils/instanceFilterSerializer';
import { collectMasterSchemaFields } from '../utils/masterSchemaFields';
import { FilterRow, InstanceFilterPanel, type FilterRowProps } from './InstanceFilterPanel';

const FIELDS = collectMasterSchemaFields({
  properties: {
    amount: { type: 'number', 'x-indexed': true, 'x-filterOperators': ['eq', 'gte'], 'x-sortable': true },
    note: { type: 'string' },
  },
});

const row = (over: Partial<FilterRowProps>): string =>
  renderToStaticMarkup(
    createElement(FilterRow, {
      condition: { category: 'attribute', field: 'amount', operator: 'ge', value: '', valueType: 'number' },
      onChange: () => undefined,
      onRemove: () => undefined,
      ...over,
    }),
  );

const optionValues = (html: string): string[] =>
  [...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1] ?? '');

describe('FilterRow with a master schema', () => {
  it('limits operators to x-filterOperators and marks indexed fields', () => {
    const html = row({ schemaFields: FIELDS });
    expect(optionValues(html)).toEqual(expect.arrayContaining(['eq', 'ge']));
    expect(optionValues(html)).not.toContain('lt');
    expect(html).toContain('IDX');
    expect(html).toContain('reads the index column');
  });

  it('warns about fields the schema does not make filterable', () => {
    const condition: FilterCondition = { category: 'attribute', field: 'note', operator: 'eq', value: '', valueType: 'text' };
    expect(row({ condition, schemaFields: FIELDS })).toContain('no x-filterOperators');
  });

  it('keeps the type-based operators without a schema', () => {
    expect(optionValues(row({}))).toContain('lt');
  });
});

describe('InstanceFilterPanel with a master schema', () => {
  const html = renderToStaticMarkup(
    createElement(InstanceFilterPanel, {
      onApply: () => undefined,
      onClose: () => undefined,
      schemaFields: FIELDS,
      schemaKey: 'orders-master',
    }),
  );

  it('suggests attribute paths from the schema', () => {
    expect(html).toContain('<datalist');
    expect(html).toContain('value="amount"');
    expect(html).toContain('number · IDX');
    expect(html).toContain('orders-master');
  });

  it('offers x-sortable fields as attributes.<path> sort options', () => {
    expect(html).toContain('value="attributes.amount"');
    expect(html).toContain('amount · IDX');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/InstanceFilterPanel.vitest.test.tsx`
Expected: FAIL — `FilterRow` is not exported; no `schemaFields` support.

- [ ] **Step 3: Create `hooks/useWorkflowMasterSchema.ts`**

```ts
import { useEffect, useState } from 'react';

import { defaultSchemaComponentLoaderDeps } from '../../vnext-workspace/loadSchemaComponent';
import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { loadWorkflowMasterSchema, type MasterSchemaLoad } from '../utils/workflowMasterSchema';

const NONE: MasterSchemaLoad = { status: 'none' };

/** The workflow's local master schema as filter fields; quiet when it cannot be found. */
export function useWorkflowMasterSchema(workflowKey: string): MasterSchemaLoad {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [load, setLoad] = useState<MasterSchemaLoad>(NONE);

  useEffect(() => {
    if (!workflowKey) {
      setLoad(NONE);
      return;
    }
    let cancelled = false;
    void loadWorkflowMasterSchema(workflowKey, {
      ...defaultSchemaComponentLoaderDeps,
      resolveWorkflowFile: async (key) => {
        const resolved = await resolveWorkflowFile(key, undefined, { quiet: true });
        return resolved ? { path: resolved.path, projectId: resolved.projectId } : null;
      },
    }).then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowKey, resolveWorkflowFile]);

  return load;
}
```

- [ ] **Step 4: Rewrite `components/InstanceFilterPanel.tsx`**

```tsx
import { useCallback, useId, useMemo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import {
  ALL_OPERATORS,
  INSTANCE_FIELDS,
  INSTANCE_TYPE_OPTIONS,
  STATUS_OPTIONS,
  getFieldType,
  isValidAttributePath,
  operatorNeedsValue,
  resolveValueType,
  serializeInstanceFilter,
  serializeInstanceSort,
  sortableInstanceFields,
  type FilterCondition,
  type FilterOperator,
  type FilterValueType,
} from '../utils/instanceFilterSerializer';
import {
  describeSchemaField,
  fieldValueType,
  findSchemaField,
  operatorsForCondition,
  schemaFieldNotice,
  sortableAttributeOptions,
  usesIndexProjection,
  type MasterSchemaField,
} from '../utils/masterSchemaFields';

const DEFAULT_ORDER_BY = serializeInstanceSort('createdAt', 'desc');

const VALUE_TYPES: { value: FilterValueType; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'bool' },
  { value: 'date', label: 'date' },
];

const INPUT_CLASS =
  'rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]';

const IDX_BADGE_CLASS =
  'shrink-0 rounded bg-[var(--vscode-testing-iconPassed)] px-1 py-0.5 text-[8px] font-semibold text-[var(--vscode-editor-background)]';

export interface InstanceFilterPanelProps {
  onApply: (filter?: string, orderBy?: string, sort?: string) => void;
  onClose: () => void;
  /** Fields of the workflow's local master schema; `undefined` when none was loaded. */
  schemaFields?: readonly MasterSchemaField[];
  /** Key of that master schema, shown as the suggestion source. */
  schemaKey?: string;
}

export function InstanceFilterPanel({ onApply, onClose, schemaFields, schemaKey }: InstanceFilterPanelProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [attrInput, setAttrInput] = useState('');
  // Row index → message, populated on Apply (and cleared as rows change) so a
  // half-typed row is not shouted at while the author is still editing.
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const attrListId = useId();
  const attributeSortOptions = useMemo(() => sortableAttributeOptions(schemaFields), [schemaFields]);

  const attrInputValid = attrInput.trim() === '' || isValidAttributePath(attrInput);

  const addInstanceCondition = useCallback(() => {
    setRowErrors({});
    setFilterError(null);
    setConditions((prev) => [
      ...prev,
      { category: 'instance', field: 'status', operator: 'eq', value: '' },
    ]);
  }, []);

  const addAttributeCondition = useCallback(
    (fieldName: string) => {
      const name = fieldName.trim();
      if (!name || !isValidAttributePath(name)) return;
      setRowErrors({});
      setFilterError(null);
      const field = findSchemaField(schemaFields, name);
      const draft: FilterCondition = {
        category: 'attribute',
        field: name,
        operator: 'eq',
        value: '',
        valueType: field ? fieldValueType(field) : 'text',
      };
      const operator = operatorsForCondition(draft, schemaFields)[0] ?? 'eq';
      setConditions((prev) => [...prev, { ...draft, operator }]);
    },
    [schemaFields],
  );

  const removeCondition = useCallback((index: number) => {
    setRowErrors({});
    setFilterError(null);
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCondition = useCallback(
    (index: number, patch: Partial<FilterCondition>) => {
      setFilterError(null);
      setRowErrors((prev) => {
        if (!(index in prev)) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setConditions((prev) =>
        prev.map((c, i) => {
          if (i !== index) return c;
          const updated: FilterCondition = { ...c, ...patch };
          if (patch.field !== undefined || patch.category !== undefined || patch.valueType !== undefined) {
            const ops = operatorsForCondition(updated, schemaFields);
            if (!ops.includes(updated.operator)) updated.operator = ops[0] ?? 'eq';
          }
          if (patch.operator !== undefined && patch.operator !== 'between') updated.value2 = undefined;
          return updated;
        }),
      );
    },
    [schemaFields],
  );

  const handleApply = useCallback(() => {
    const result = serializeInstanceFilter(conditions);
    if (Object.keys(result.errors).length > 0) {
      setRowErrors(result.errors);
      return;
    }
    if (result.filterError) {
      setFilterError(result.filterError);
      return;
    }
    setRowErrors({});
    setFilterError(null);
    onApply(result.filter, serializeInstanceSort(sortField, sortDirection), undefined);
  }, [conditions, sortField, sortDirection, onApply]);

  const handleClear = useCallback(() => {
    setConditions([]);
    setRowErrors({});
    setFilterError(null);
    setSortField('createdAt');
    setSortDirection('desc');
    onApply(undefined, DEFAULT_ORDER_BY, undefined);
  }, [onApply]);

  const hasErrors = useMemo(() => Object.keys(rowErrors).length > 0, [rowErrors]);

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
          Filter & Sort
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                onClick={onClose}
                aria-label="Close filter panel"
              >
                ✕
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Close
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {schemaKey && (
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          Attribute suggestions from master schema <span className="font-mono">{schemaKey}</span>
        </span>
      )}

      {conditions.map((c, i) => (
        <FilterRow
          key={i}
          condition={c}
          error={rowErrors[i]}
          schemaFields={schemaFields}
          onChange={(patch) => updateCondition(i, patch)}
          onRemove={() => removeCondition(i)}
        />
      ))}

      {/* Add filter controls */}
      <div className="flex items-center gap-2">
        <button
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={addInstanceCondition}
        >
          + Instance field
        </button>
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">|</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <input
              type="text"
              list={schemaFields ? attrListId : undefined}
              className={`w-28 ${INPUT_CLASS} ${attrInputValid ? '' : 'border-[var(--vscode-inputValidation-errorBorder)]'}`}
              placeholder="attribute path"
              title="Instance data path, e.g. amount or customer.id (letters, digits, underscores)"
              aria-invalid={!attrInputValid}
              value={attrInput}
              onChange={(e) => setAttrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && attrInput.trim() && attrInputValid) {
                  addAttributeCondition(attrInput);
                  setAttrInput('');
                }
              }}
            />
            {schemaFields && (
              <datalist id={attrListId}>
                {schemaFields.map((f) => (
                  <option key={f.path} value={f.path} label={describeSchemaField(f)} />
                ))}
              </datalist>
            )}
            <button
              className="rounded bg-[var(--vscode-button-secondaryBackground)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-40"
              disabled={!attrInput.trim() || !attrInputValid}
              onClick={() => {
                addAttributeCondition(attrInput);
                setAttrInput('');
              }}
            >
              + Attr
            </button>
          </div>
          {!attrInputValid && (
            <span className="text-[10px] text-[var(--vscode-errorForeground)]">
              Use letters, digits and underscores; separate nested fields with dots.
            </span>
          )}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1 border-t border-[var(--vscode-panel-border)] pt-2">
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">Sort:</span>
        <select
          className={`flex-1 ${INPUT_CLASS}`}
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
        >
          <optgroup label="Instance">
            {sortableInstanceFields().map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
          {attributeSortOptions.length > 0 && (
            <optgroup label="Attributes (x-sortable)">
              {attributeSortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.indexed ? `${o.label} · IDX` : o.label}</option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          className="rounded border border-[var(--vscode-input-border)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
        >
          {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          className="rounded bg-[var(--vscode-button-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-40"
          onClick={handleApply}
          disabled={hasErrors}
          title={hasErrors ? 'Fix the highlighted conditions first' : undefined}
        >
          Apply
        </button>
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={handleClear}
        >
          Clear
        </button>
        {hasErrors && (
          <span className="text-[10px] text-[var(--vscode-errorForeground)]">
            Some conditions are invalid.
          </span>
        )}
        {filterError && (
          <span className="text-[10px] text-[var(--vscode-errorForeground)]" role="alert">
            {filterError}
          </span>
        )}
      </div>
    </div>
  );
}

export interface FilterRowProps {
  condition: FilterCondition;
  error?: string;
  schemaFields?: readonly MasterSchemaField[];
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
}

export function FilterRow({ condition, error, schemaFields, onChange, onRemove }: FilterRowProps) {
  const fieldType = getFieldType(condition.category, condition.field);
  const operators = operatorsForCondition(condition, schemaFields);
  const valueType = resolveValueType(condition);
  const isAttribute = condition.category === 'attribute';
  const schemaField = isAttribute ? findSchemaField(schemaFields, condition.field.trim()) : undefined;
  const notice = schemaFieldNotice(condition, schemaFields);

  const enumOptions: readonly string[] | null =
    fieldType === 'status' ? STATUS_OPTIONS : fieldType === 'instanceType' ? INSTANCE_TYPE_OPTIONS : null;
  const needsValue = operatorNeedsValue(condition.operator);
  const isBetween = condition.operator === 'between';
  const isList = condition.operator === 'in' || condition.operator === 'nin';
  const isIncludes = condition.operator === 'includes';
  const errorClass = error ? 'border-[var(--vscode-inputValidation-errorBorder)]' : '';

  const valueInputType = valueType === 'date' ? 'datetime-local' : valueType === 'number' && !isList ? 'number' : 'text';
  const placeholder = isList
    ? valueType === 'number' ? '1, 2, 3' : 'a, b, c'
    : isIncludes
      ? '{"role":"admin"}'
      : valueType === 'boolean'
        ? 'true / false'
        : isBetween ? 'from' : 'value';
  const idxTitle = usesIndexProjection(condition.operator)
    ? 'Indexed field (x-indexed). This operator reads the index column once the generated index SQL has been run.'
    : 'Indexed field (x-indexed). This operator uses JSON containment, not the index column.';

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {condition.category === 'instance' ? (
          <select
            className={`w-24 ${INPUT_CLASS}`}
            value={condition.field}
            onChange={(e) => onChange({ field: e.target.value })}
          >
            {INSTANCE_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        ) : (
          <div className="flex w-24 items-center gap-0.5">
            <span className="shrink-0 rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[8px] text-[var(--vscode-badge-foreground)]">
              attr
            </span>
            {schemaField?.indexed && (
              <span className={IDX_BADGE_CLASS} title={idxTitle}>
                IDX
              </span>
            )}
            <input
              type="text"
              className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
              value={condition.field}
              onChange={(e) => onChange({ field: e.target.value })}
            />
          </div>
        )}

        {isAttribute && (
          <select
            className={`w-14 ${INPUT_CLASS}`}
            value={condition.valueType ?? 'text'}
            title="Value type — decides how the value is sent (string, number, boolean, ISO date)"
            aria-label="Value type"
            onChange={(e) => onChange({ valueType: e.target.value as FilterValueType })}
          >
            {VALUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}

        <select
          className={`w-[70px] ${INPUT_CLASS}`}
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as FilterOperator })}
        >
          {operators.map((op) => {
            const def = ALL_OPERATORS.find((o) => o.value === op);
            return <option key={op} value={op}>{def?.label ?? op}</option>;
          })}
        </select>

        {!needsValue ? (
          <span className="flex-1 px-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
            (no value needed)
          </span>
        ) : enumOptions && (condition.operator === 'eq' || condition.operator === 'ne') ? (
          <select
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Select...</option>
            {enumOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : enumOptions ? (
          <input
            type="text"
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            placeholder={enumOptions.slice(0, 2).join(', ')}
            title="Comma-separated names"
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ) : (
          <>
            <input
              type={valueInputType}
              className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
              value={condition.value}
              placeholder={placeholder}
              title={isList ? 'Comma-separated values' : undefined}
              onChange={(e) => onChange({ value: e.target.value })}
            />
            {isBetween && (
              <input
                type={valueInputType}
                className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
                value={condition.value2 ?? ''}
                placeholder="to"
                aria-label="Upper bound"
                onChange={(e) => onChange({ value2: e.target.value })}
              />
            )}
          </>
        )}

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="shrink-0 text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-foreground)]"
                onClick={onRemove}
                aria-label="Remove"
              >
                ✕
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[11px]">
              Remove
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {error && (
        <span className="pl-1 text-[10px] text-[var(--vscode-errorForeground)]" role="alert">
          {error}
        </span>
      )}
      {notice && (
        <span className="pl-1 text-[10px] text-[var(--vscode-editorWarning-foreground)]">{notice}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Feed the schema from `InstanceListPanel.tsx`**

Add the import:

```ts
import { useWorkflowMasterSchema } from '../hooks/useWorkflowMasterSchema';
```

After `const openInstance = useOpenInstance();` add:

```ts
  const masterSchema = useWorkflowMasterSchema(workflowKey);
```

and replace

```tsx
        <InstanceFilterPanel
          onApply={handleFilterApply}
          onClose={() => setShowFilter(false)}
        />
```

with

```tsx
        <InstanceFilterPanel
          onApply={handleFilterApply}
          onClose={() => setShowFilter(false)}
          {...(masterSchema.status === 'ready'
            ? { schemaFields: masterSchema.fields, schemaKey: masterSchema.schemaKey }
            : {})}
        />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/InstanceFilterPanel.vitest.test.tsx src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts src/modules/quick-run/utils/masterSchemaFields.vitest.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/quick-run/hooks/useWorkflowMasterSchema.ts packages/designer-ui/src/modules/quick-run/components/InstanceFilterPanel.tsx packages/designer-ui/src/modules/quick-run/components/InstanceFilterPanel.vitest.test.tsx packages/designer-ui/src/modules/quick-run/components/InstanceListPanel.tsx
git commit -m "$(cat <<'MSG'
feat(quick-run): schema-aware instance filters — paths, types, x-filterOperators, x-sortable, IDX

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: `validate/getAllSchemas` serves the project-pinned version (A2 → D)

**Files:**
- Modify: `packages/services-core/src/services/validate/validate.service.ts`
- Modify: `packages/services-core/src/registry/method-registry.ts` (the `'validate/getAllSchemas'` entry)
- Create: `packages/services-core/test/fixtures/validate/getAllSchemas.json`
- Test (new): `packages/services-core/test/validate/get-all-schemas-versioned.test.ts`
- Test: `apps/server/src/__tests__/api/validate.test.ts` (append)

**Interfaces:**
- Consumes: `SchemaCacheService.resolve(version): Promise<ResolvedSchema>`; existing `readSchema` (forward-port patches) inside `createValidateService`.
- Produces: `validateGetAllSchemasParams` = `{ schemaVersion?: string }`; `ValidateService.getAllSchemasVersioned(schemaVersion?: string): Promise<Record<string, Record<string, unknown>>>`; `validate/getAllSchemas` accepts `?schemaVersion=` (HTTP spec unchanged: `GET` / `query`). Used by Task 13.

- [ ] **Step 1: Write the failing tests**

`packages/services-core/test/validate/get-all-schemas-versioned.test.ts`:

```ts
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

import type { LoggerAdapter } from '../../src/adapters/index.js'
import type { SchemaCacheService } from '../../src/services/schema-cache/index.js'
import { createValidateService, type VnextSchemaLoader } from '../../src/services/validate/validate.service.js'

const require_ = createRequire(import.meta.url)
const schemaLoader: VnextSchemaLoader = { load: () => require_('@burgan-tech/vnext-schema') }
const logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: vi.fn(),
  error: () => undefined,
} as unknown as LoggerAdapter

/** A pre-ac42026 schema definition: `attributes.type` is still a closed enum. */
const staleSchemaDefinition = {
  properties: { attributes: { properties: { type: { type: 'string', enum: ['workflow', 'schema'] } } } },
}
const pinnedModule = {
  getAvailableTypes: () => ['schema'],
  getSchema: (type: string) => (type === 'schema' ? staleSchemaDefinition : null),
  schemas: {},
}

function cache(resolve: SchemaCacheService['resolve']): SchemaCacheService {
  return { resolve, has: vi.fn(), refresh: vi.fn(), listCachedVersions: vi.fn() } as unknown as SchemaCacheService
}

describe('getAllSchemasVersioned', () => {
  it('serves the pinned package, with the forward-port applied', async () => {
    const resolve = vi.fn(() => Promise.resolve({ module: pinnedModule, version: '0.0.40', fromBundle: false }))
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned('0.0.40')

    expect(resolve).toHaveBeenCalledWith('0.0.40')
    expect(Object.keys(schemas)).toEqual(['schema'])
    const type = (schemas.schema as { properties: { attributes: { properties: { type: { enum?: unknown } } } } })
      .properties.attributes.properties.type
    expect(type.enum).toBeUndefined()
  })

  it('serves the bundled package without a version', async () => {
    const resolve = vi.fn()
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned(undefined)

    expect(resolve).not.toHaveBeenCalled()
    expect(schemas.workflow).toBeDefined()
  })

  it('falls back to the bundled package when the pinned version cannot be resolved', async () => {
    const resolve = vi.fn(() => Promise.reject(new Error('offline')))
    const service = createValidateService({ schemaLoader, logger, schemaCacheService: cache(resolve) })

    const schemas = await service.getAllSchemasVersioned('9.9.9')

    expect(schemas.workflow).toBeDefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('serves the bundled package when no cache service is wired (extension shell)', async () => {
    const service = createValidateService({ schemaLoader, logger })
    expect((await service.getAllSchemasVersioned('0.0.40')).workflow).toBeDefined()
  })
})
```

`packages/services-core/test/fixtures/validate/getAllSchemas.json`:

```json
{
  "params": { "schemaVersion": "0.0.53" },
  "result": { "schema": { "type": "object" } }
}
```

Append to `apps/server/src/__tests__/api/validate.test.ts`, inside `describe('API v1 validate routes', …)` before its closing `});`:

```ts
  it('forwards schemaVersion from the query to getAllSchemasVersioned', async () => {
    const getAllSchemasVersioned = vi.fn(() => Promise.resolve({ schema: { type: 'object' } }));
    const services = {
      ...emptyServices,
      validateService: {
        getAvailableTypes: vi.fn(),
        validate: vi.fn(),
        validateComponent: vi.fn(),
        getAllSchemas: vi.fn(),
        getAllSchemasVersioned,
        getSchema: vi.fn(),
      },
    } as unknown as ServiceRegistry;

    const app = buildTestApp(services);
    const res = await app.request('/api/v1/validate/getAllSchemas?schemaVersion=0.0.53');
    expect(res.status).toBe(200);
    expect(getAllSchemasVersioned).toHaveBeenCalledWith('0.0.53');
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.data).toEqual({ schema: { type: 'object' } });

    const bundled = await app.request('/api/v1/validate/getAllSchemas');
    expect(bundled.status).toBe(200);
    expect(getAllSchemasVersioned).toHaveBeenLastCalledWith(undefined);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/validate/get-all-schemas-versioned.test.ts test/registry-contract.test.ts`
Expected: `get-all-schemas-versioned.test.ts` FAILS (`getAllSchemasVersioned` is not a function); `registry-contract.test.ts` still passes (the fixture parses even though the current params schema strips `schemaVersion`).

- [ ] **Step 3: Add the parameter and the versioned read (`validate.service.ts`)**

Replace

```ts
export const validateGetAllSchemasParams = z.object({}).optional().transform(() => ({}))
```

with

```ts
export const validateGetAllSchemasParams = z
  .object({
    /**
     * Project's `vnext.config.json#schemaVersion`. When supplied (and a
     * `schemaCacheService` is wired) the schemas come from that exact
     * `@burgan-tech/vnext-schema` version — the contract save validation
     * uses — instead of the bundled package.
     */
    schemaVersion: z.string().min(1).optional(),
  })
  .optional()
  .transform((params) => params ?? {})
```

Replace the existing `getAllSchemas` function with

```ts
  function collectSchemas(mod: VnextSchemaModule): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {}
    for (const type of mod.getAvailableTypes()) {
      const schema = readSchema(mod, type)
      if (schema) result[type] = schema
    }
    return result
  }

  function getAllSchemas(): Record<string, Record<string, unknown>> {
    return collectSchemas(ensureBundled().module)
  }

  /**
   * Every component schema of the project-pinned package (forward-ports
   * applied), for Monaco. Same fallback rules as `getSchemaVersioned`: no
   * version, no cache service, or a failed download → bundled package.
   */
  async function getAllSchemasVersioned(
    schemaVersion?: string,
  ): Promise<Record<string, Record<string, unknown>>> {
    if (!schemaVersion || !schemaCacheService) {
      return getAllSchemas()
    }
    try {
      const resolved = await schemaCacheService.resolve(schemaVersion)
      return collectSchemas(resolved.module)
    } catch (err) {
      deps.logger.warn(
        `[validate.service] getAllSchemasVersioned fallback to bundled (${schemaVersion}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      return getAllSchemas()
    }
  }
```

and add `getAllSchemasVersioned,` after `getAllSchemas,` in the returned object.

- [ ] **Step 4: Route the registry entry through it (`method-registry.ts`)**

Replace

```ts
    'validate/getAllSchemas': {
      paramsSchema: validateGetAllSchemasParams,
      resultSchema: validateGetAllSchemasResult,
      handler: async (_p, { validateService }) => validateService.getAllSchemas(),
    },
```

with

```ts
    'validate/getAllSchemas': {
      paramsSchema: validateGetAllSchemasParams,
      resultSchema: validateGetAllSchemasResult,
      // Monaco asks with the project's `schemaVersion` so editor diagnostics
      // match save-time validation; omitted → bundled package.
      handler: async ({ schemaVersion }, { validateService }) =>
        validateService.getAllSchemasVersioned(schemaVersion),
    },
```

- [ ] **Step 5: Run the services-core tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/validate/get-all-schemas-versioned.test.ts test/validate/runtime-sync-wiring.test.ts test/registry-contract.test.ts`
Expected: PASS (sorted-names snapshot unchanged; the new fixture parses against params/result).

- [ ] **Step 6: Build services-core and run the server test**

Run: `pnpm --filter @vnext-forge-studio/services-core build && pnpm --filter @vnext-forge-studio/server exec vitest run src/__tests__/api/validate.test.ts && pnpm --filter @vnext-forge-studio/server build`
Expected: PASS and exit 0 (`validate.routes.ts` needs no change: the helper passes the query to `dispatchMethod`).

- [ ] **Step 7: Commit**

```bash
git add packages/services-core/src/services/validate/validate.service.ts packages/services-core/src/registry/method-registry.ts packages/services-core/test/validate/get-all-schemas-versioned.test.ts packages/services-core/test/fixtures/validate/getAllSchemas.json apps/server/src/__tests__/api/validate.test.ts
git commit -m "$(cat <<'MSG'
feat(validate): getAllSchemas serves the project-pinned vnext-schema version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 13: Monaco validates component JSON against the pinned schema (A2 → D)

**Files:**
- Modify (rewrite): `packages/designer-ui/src/modules/code-editor/editor/JsonSchemaRegistry.ts`
- Modify (rewrite): `packages/designer-ui/src/modules/code-editor/editor/JsonSchemaSetup.ts`
- Modify: `packages/designer-ui/src/index.ts`
- Modify: `apps/web/src/pages/code-editor/CodeEditorPage.tsx`
- Test (new): `packages/designer-ui/src/modules/code-editor/editor/JsonSchemaSetup.vitest.test.ts`

**Interfaces:**
- Consumes: `validate/getAllSchemas` with `schemaVersion` (Task 12); `setApiTransport` (tests).
- Produces: `type VnextSchemaMap = Record<string, object>`; `fetchVnextSchemas(schemaVersion?: string): Promise<VnextSchemaMap | null>`; `getCachedSchemas(schemaVersion?: string): VnextSchemaMap | null`; `invalidateSchemaCache(): void`; `interface MonacoJsonSchemaEntry { uri: string; fileMatch: string[]; schema: object }`; `buildMonacoJsonSchemas(schemas: VnextSchemaMap, paths?: VnextWorkspacePaths | null, schemaVersion?: string): MonacoJsonSchemaEntry[]`; `interface JsonSchemaValidationOptions { paths?: VnextWorkspacePaths | null; schemaVersion?: string }`; `configureJsonSchemaValidation(monaco: Monaco, options?: JsonSchemaValidationOptions): Promise<void>` (exported from `@vnext-forge-studio/designer-ui`). `detectComponentType` unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
import type { Monaco } from '@monaco-editor/react';
import {
  ERROR_CODES,
  success,
  type ApiResponse,
  type VnextWorkspacePaths,
} from '@vnext-forge-studio/app-contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setApiTransport } from '../../../api/transport';
import { invalidateSchemaCache } from './JsonSchemaRegistry';
import { buildMonacoJsonSchemas, configureJsonSchemaValidation } from './JsonSchemaSetup';

const PATHS: VnextWorkspacePaths = {
  componentsRoot: 'core',
  tasks: 'Tasks',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
  workflows: 'Flows',
  schemas: 'Schemas',
  mappings: 'Mappings',
};

function fakeMonaco() {
  const setDiagnosticsOptions = vi.fn();
  const monaco = { languages: { json: { jsonDefaults: { setDiagnosticsOptions } } } } as unknown as Monaco;
  return { monaco, setDiagnosticsOptions };
}

function useTransport(respond: (params: unknown) => Promise<ApiResponse<unknown>>) {
  const send = vi.fn((_method: string, params: unknown) => respond(params));
  setApiTransport({ send: send as unknown as <T>(method: string, params: unknown) => Promise<ApiResponse<T>> });
  return send;
}

beforeEach(() => invalidateSchemaCache());
afterEach(() => setApiTransport(null));

describe('buildMonacoJsonSchemas', () => {
  it('maps component types to the configured folders and skips core/header', () => {
    expect(
      buildMonacoJsonSchemas({ workflow: { title: 'wf' }, schema: { title: 's' }, core: {}, header: {}, unknown: {} }, PATHS, '0.0.52'),
    ).toEqual([
      { uri: 'vnext://schemas/0.0.52/workflow-definition', fileMatch: ['**/Flows/**/*.json', '**/Flows/*.json'], schema: { title: 'wf' } },
      { uri: 'vnext://schemas/0.0.52/schema-definition', fileMatch: ['**/Schemas/**/*.json', '**/Schemas/*.json'], schema: { title: 's' } },
    ]);
  });

  it('falls back to conventional folder names and a bundled uri', () => {
    expect(buildMonacoJsonSchemas({ task: {} }, null)).toEqual([
      { uri: 'vnext://schemas/bundled/task-definition', fileMatch: ['**/Tasks/**/*.json', '**/Tasks/*.json'], schema: {} },
    ]);
  });
});

describe('configureJsonSchemaValidation', () => {
  it('requests the project-pinned version and registers its schemas', async () => {
    const send = useTransport(() => Promise.resolve(success({ schema: { title: 'pinned' } })));
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    await configureJsonSchemaValidation(monaco, { paths: PATHS, schemaVersion: '0.0.52' });

    expect(send).toHaveBeenCalledWith('validate/getAllSchemas', { schemaVersion: '0.0.52' });
    expect(setDiagnosticsOptions).toHaveBeenCalledWith({
      validate: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: 'vnext://schemas/0.0.52/schema-definition',
          fileMatch: ['**/Schemas/**/*.json', '**/Schemas/*.json'],
          schema: { title: 'pinned' },
        },
      ],
    });
  });

  it('asks for the bundled schemas when the project pins nothing', async () => {
    const send = useTransport(() => Promise.resolve(success({})));
    await configureJsonSchemaValidation(fakeMonaco().monaco);
    expect(send).toHaveBeenCalledWith('validate/getAllSchemas', {});
  });

  it('caches per version', async () => {
    const send = useTransport(() => Promise.resolve(success({ task: {} })));
    const { monaco } = fakeMonaco();
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    expect(send).toHaveBeenCalledTimes(1);
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.53' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('leaves Monaco untouched when the request fails', async () => {
    useTransport(() =>
      Promise.resolve({ success: false, data: null, error: { code: ERROR_CODES.INTERNAL_UNEXPECTED, message: 'boom' } }),
    );
    const { monaco, setDiagnosticsOptions } = fakeMonaco();
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    expect(setDiagnosticsOptions).not.toHaveBeenCalled();
  });

  it('lets the latest call win when an older request resolves later', async () => {
    let releaseOld: (() => void) | undefined;
    useTransport((params) => {
      if ((params as { schemaVersion?: string }).schemaVersion === '0.0.40') {
        return new Promise((resolve) => {
          releaseOld = () => resolve(success({ schema: { title: 'old' } }));
        });
      }
      return Promise.resolve(success({ schema: { title: 'new' } }));
    });
    const { monaco, setDiagnosticsOptions } = fakeMonaco();

    const older = configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.40' });
    await configureJsonSchemaValidation(monaco, { schemaVersion: '0.0.52' });
    releaseOld?.();
    await older;

    expect(setDiagnosticsOptions).toHaveBeenCalledTimes(1);
    expect(setDiagnosticsOptions.mock.calls[0]?.[0]).toMatchObject({ schemas: [{ schema: { title: 'new' } }] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/code-editor/editor/JsonSchemaSetup.vitest.test.ts`
Expected: FAIL — `buildMonacoJsonSchemas` is not exported; the registry reads `cache.schemas` of a flat map.

- [ ] **Step 3: Rewrite `JsonSchemaRegistry.ts`**

```ts
import { callApi } from '../../../api/client';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('JsonSchemaRegistry');

/** `validate/getAllSchemas` result: component type → JSON Schema (forward-ports already applied by services-core). */
export type VnextSchemaMap = Record<string, object>;

const BUNDLED_KEY = '__bundled__';
const cache = new Map<string, VnextSchemaMap>();
const inflight = new Map<string, Promise<VnextSchemaMap | null>>();

function cacheKey(schemaVersion: string | undefined): string {
  return schemaVersion ?? BUNDLED_KEY;
}

/**
 * Component schemas for `schemaVersion` (the project's
 * `vnext.config.json#schemaVersion`; omitted → the package bundled with the
 * backend). Cached per version; concurrent calls share one request.
 */
export async function fetchVnextSchemas(schemaVersion?: string): Promise<VnextSchemaMap | null> {
  const key = cacheKey(schemaVersion);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await callApi<VnextSchemaMap>({
        method: 'validate/getAllSchemas',
        params: schemaVersion ? { schemaVersion } : {},
      });
      if (response.success) {
        cache.set(key, response.data);
        logger.info(`Loaded ${Object.keys(response.data).length} vnext schemas (${key})`);
        return response.data;
      }
      logger.warn('Failed to load vnext schemas from server');
      return null;
    } catch {
      logger.warn('Error fetching vnext schemas');
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}

export function getCachedSchemas(schemaVersion?: string): VnextSchemaMap | null {
  return cache.get(cacheKey(schemaVersion)) ?? null;
}

export function invalidateSchemaCache(): void {
  cache.clear();
  inflight.clear();
}
```

- [ ] **Step 4: Rewrite `JsonSchemaSetup.ts`**

```ts
import type { Monaco } from '@monaco-editor/react';
import type { VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';
import { fetchVnextSchemas, type VnextSchemaMap } from './JsonSchemaRegistry';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('JsonSchemaSetup');

const COMPONENT_TYPE_TO_PATH_KEY: Record<string, keyof Omit<VnextWorkspacePaths, 'componentsRoot'>> = {
  workflow: 'workflows',
  task: 'tasks',
  view: 'views',
  function: 'functions',
  extension: 'extensions',
  schema: 'schemas',
  mapping: 'mappings',
};

function buildFileMatchPatterns(
  componentType: string,
  paths?: VnextWorkspacePaths | null,
): string[] {
  const pathKey = COMPONENT_TYPE_TO_PATH_KEY[componentType];
  if (!pathKey) return [];

  const folderName = paths?.[pathKey] ?? pathKey.charAt(0).toUpperCase() + pathKey.slice(1);
  return [`**/${folderName}/**/*.json`, `**/${folderName}/*.json`];
}

export interface MonacoJsonSchemaEntry {
  uri: string;
  fileMatch: string[];
  schema: object;
}

/** Monaco `jsonDefaults` schema entries; the uri carries the version so a switch replaces them. */
export function buildMonacoJsonSchemas(
  schemas: VnextSchemaMap,
  paths?: VnextWorkspacePaths | null,
  schemaVersion?: string,
): MonacoJsonSchemaEntry[] {
  const versionSegment = schemaVersion ?? 'bundled';
  const entries: MonacoJsonSchemaEntry[] = [];
  for (const [type, schema] of Object.entries(schemas)) {
    if (type === 'core' || type === 'header') continue;
    const fileMatch = buildFileMatchPatterns(type, paths);
    if (fileMatch.length === 0) continue;
    entries.push({ uri: `vnext://schemas/${versionSegment}/${type}-definition`, fileMatch, schema });
  }
  return entries;
}

export interface JsonSchemaValidationOptions {
  /** Workspace folder names (`vnext.config.json#paths`); defaults to the conventional ones. */
  paths?: VnextWorkspacePaths | null;
  /** Project-pinned `@burgan-tech/vnext-schema` version; omitted → bundled package. */
  schemaVersion?: string;
}

let latestRequest = 0;

/**
 * Register the vNext component schemas with Monaco's JSON language service.
 * `setDiagnosticsOptions` is global per Monaco instance, so the latest call
 * wins: an older request that resolves later is discarded.
 */
export async function configureJsonSchemaValidation(
  monaco: Monaco,
  options: JsonSchemaValidationOptions = {},
): Promise<void> {
  latestRequest += 1;
  const request = latestRequest;
  const schemas = await fetchVnextSchemas(options.schemaVersion);
  if (request !== latestRequest) return;

  if (!schemas) {
    logger.warn('No vnext schemas available for Monaco JSON validation');
    return;
  }

  const entries = buildMonacoJsonSchemas(schemas, options.paths, options.schemaVersion);
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    schemas: entries,
  });

  logger.info(
    `Registered ${entries.length} JSON schemas for Monaco validation (${options.schemaVersion ?? 'bundled'})`,
  );
}

export function detectComponentType(
  filePath: string,
  paths?: VnextWorkspacePaths | null,
): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const [type, pathKey] of Object.entries(COMPONENT_TYPE_TO_PATH_KEY)) {
    const folderName = paths?.[pathKey] ?? pathKey.charAt(0).toUpperCase() + pathKey.slice(1);
    if (
      normalizedPath.includes(`/${folderName}/`) ||
      normalizedPath.includes(`\\${folderName}\\`)
    ) {
      return type;
    }
  }

  return null;
}
```

(`MonacoSetup.setupMonaco` still calls `configureJsonSchemaValidation(monaco)` and keeps compiling.)

- [ ] **Step 5: Export it from the package (`packages/designer-ui/src/index.ts`)**

After `export { setupMonacoWithLsp } from './modules/code-editor/editor/MonacoSetup.js';` add:

```ts
export {
  configureJsonSchemaValidation,
  type JsonSchemaValidationOptions,
} from './modules/code-editor/editor/JsonSchemaSetup.js';
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/code-editor/editor/JsonSchemaSetup.vitest.test.ts`
Expected: PASS.

- [ ] **Step 7: Register the pinned schemas in the web code editor (`CodeEditorPage.tsx`)**

1. Add `configureJsonSchemaValidation,` to the `@vnext-forge-studio/designer-ui` import list (alphabetically after `cn,`).
2. Replace `import Editor, { type OnMount } from '@monaco-editor/react';` with `import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';`.
3. After `const lspSessionId = useRef(crypto.randomUUID());` add:

```ts
  const monacoRef = useRef<Monaco | null>(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const pinnedSchemaVersion = vnextConfig?.schemaVersion;
  const workspacePaths = vnextConfig?.paths ?? null;
```

4. In `handleMount`, after `editorRef.current = editorInstance;` add:

```ts
      monacoRef.current = monaco;
      setMonacoReady(true);
```

5. After the `useEffect` that calls `loadFile(filePath)`, add:

```ts
  // Monaco validates vNext component JSON against the project's pinned
  // `@burgan-tech/vnext-schema` (vnext.config.json#schemaVersion) — the same
  // contract save-time validation uses. The backend falls back to its bundled
  // package when the pin cannot be resolved.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monacoReady || !monaco || language !== 'json') return;
    void configureJsonSchemaValidation(monaco, {
      paths: workspacePaths,
      ...(pinnedSchemaVersion ? { schemaVersion: pinnedSchemaVersion } : {}),
    });
  }, [monacoReady, language, workspacePaths, pinnedSchemaVersion]);
```

- [ ] **Step 8: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/web build`
Expected: exit 0 for both.

```bash
git add packages/designer-ui/src/modules/code-editor/editor/JsonSchemaRegistry.ts packages/designer-ui/src/modules/code-editor/editor/JsonSchemaSetup.ts packages/designer-ui/src/modules/code-editor/editor/JsonSchemaSetup.vitest.test.ts packages/designer-ui/src/index.ts apps/web/src/pages/code-editor/CodeEditorPage.tsx
git commit -m "$(cat <<'MSG'
feat(code-editor): Monaco validates component JSON against the project-pinned vnext-schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 14: Phase D gate

**Files:** none (verification only).

- [ ] **Step 1: Full builds**

Run: `pnpm build`
Expected: Turborepo finishes with every task successful (extension esbuild and web vite included).

- [ ] **Step 2: Test suites**

Run: `pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter @vnext-forge-studio/server test`
Expected: PASS, no skipped new tests.

- [ ] **Step 3: Lint touched files against the phase start commit**

No touched file may gain eslint errors relative to `7e75725`. `*.vitest.test.ts` files are skipped (outside the tsconfig); services-core tests live under `test/` and are outside the diffed `src/` trees. Run from the repo root:

```bash
BASE=7e75725
TMP=$(mktemp -d)
count_errors() {
  (cd "$1" && pnpm exec eslint -f json "$2" 2>/dev/null) |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).reduce((n,f)=>n+f.errorCount,0))}catch{console.log(-1)}})'
}
status=0
for PKG in packages/designer-ui packages/services-core apps/server apps/web; do
  for f in $(git diff --name-only --diff-filter=AM "$BASE" HEAD -- "$PKG/src" | grep -E '\.tsx?$' | grep -v '\.vitest\.test\.ts$' | sed "s#^$PKG/##"); do
    head=$(count_errors "$PKG" "$f")
    base=0
    if git cat-file -e "$BASE:$PKG/$f" 2>/dev/null; then
      cp "$PKG/$f" "$TMP/current"
      git show "$BASE:$PKG/$f" > "$PKG/$f"
      base=$(count_errors "$PKG" "$f")
      cp "$TMP/current" "$PKG/$f"
    fi
    echo "$PKG/$f base=$base head=$head"
    if [ "$head" -lt 0 ] || [ "$head" -gt "$base" ]; then echo "  REGRESSION"; status=1; fi
  done
done
git status --porcelain
echo "exit=$status"
```

Expected: every line `head <= base`, no `REGRESSION`, `git status --porcelain` prints nothing (every file restored), `exit=0`. Fix any regression in the owning task's files and re-run.

- [ ] **Step 4: Web-shell check**

If the preview tools can start `.claude/launch.json` configurations `server` and `web`, open the vnext-example workspace (`/Users/U0B006/Documents/repos/burgan-tech/vnext-example`, `schemaVersion` 0.0.52) in the web shell and verify, with a screenshot of each. Never save a changed file — undo every edit.
1. `core/Schemas/money-transfer/money-transfer-master.json` in the schema editor: **Schema type** shows `schema` with the four suggestions; `targetIban` → vNext tab → Filter operators shows `eq` checked. Select `amount`: the x-indexed card toggle is disabled with the not-master reason. Change the type to `master`: the toggle enables; enabling shows `Produces columns: text, numeric` and an IDX badge in the tree. Change the type back to `schema`: the banner with **Remove all x-indexed** appears and the IDX badge turns red. Press **Save**: the save is blocked and the validation summary lists the readable not-master message instead of AJV if/then errors. Undo everything.
2. `core/Workflows/money-transfer/money-transfer.json` → Workflow Master Schema section shows `money-transfer-master` without a warning (the on-disk mismatch case is covered by the unit tests; do not write a mismatched file).
3. QuickRunner for `money-transfer` (runtime not required for the panel): open **Filter & Sort**; the header names `money-transfer-master`; the attribute input suggests `targetIban`, `amount`, …; adding `targetIban` offers only `=`; adding `amount` shows the not-filterable notice. Paste a 1001-character value and Apply: the row error cites 1000 characters.
4. Open `core/Schemas/money-transfer/money-transfer-master.json` in the web **code editor**: the network log shows `GET /api/v1/validate/getAllSchemas?schemaVersion=0.0.52`; adding `"x-indexed": true` to `amount` produces a Monaco error marker (non-master schema). Undo.

If the preview cannot run, record "Web-shell check: not run" in the report — do not claim it.

- [ ] **Step 5: Report**

Summarize per task: tests added, commands run with their results, lint table, screenshots (or "not run"). Do not claim completion without the command output.

---

## Self-Review

**Spec coverage**
- D1: free-text combobox with `master`/`schema`/`view`/`headers` and the "Only master permits x-indexed" hint → Task 2 (`SchemaTypeField`, `SchemaMetadataForm`); `SchemaEditorSchema` models `attributes.type`, root `type` removed → Task 2; Master Schema section creates `master` → Task 3.
- D2: `schema-editor/model/indexEligibility.ts`, pure mirror of `Visit` with per-node `{ eligible, reason }` covering master type, explicit scalar type (date via `format: date-time`), `properties` chain with typeless/`object` parents, segment regexes, no `$ref`/composition/conditional on node or ancestors, no dynamic locations, root not indexable → Task 4 (tests ported from vnext-schema and runtime); used by the card (Task 6), the tree badge (Task 7) and save-time messages replacing AJV if/then noise (Task 5).
- D3: `XIndexedCard` in `vnextCardRegistry` (`scope: 'property'`) and `RECOGNIZED_VNEXT_KEYWORDS`; tri-state; disabled with reason when ineligible; filter/sort note and `wf indexes generate`; produced columns (text, + numeric, + timestamptz) → Task 6; `PropertyTreeNode` IDX badge and the non-master "Remove all x-indexed" banner → Task 7.
- D4: runtime spellings `eq neq gt gte lt lte between contains startsWith endsWith in nin isNull includes`; legacy `ge le ne like match` read and normalized for display; writes only on user edit; unknown values never dropped → Task 1 (D7).
- D5: local master schema → path suggestions, value type from field type, operators limited to `x-filterOperators`, `attributes.<path>` sort for `x-sortable`, IDX hint → Tasks 10–11 (loader via Task 8); limits ≤ 1000 per value (per element for `in`/`nin`/`between`), ≤ 5000 total → Task 9.
- D6: `WorkflowSchemaSection` warns when the referenced schema has `x-indexed` but `attributes.type !== 'master'` → Task 8.
- A2 carry-over (Monaco gets the project-pinned schema, not the bundled one) → Task 12 (method) + Task 13 (Monaco registration, including the dead-code and response-shape fixes).
- Phase gate (build, suites, per-file lint vs `7e75725`, web-shell or "not run") → Task 14.

**Placeholder scan** — every code step carries complete code or exact old/new anchors; every test step has its test code and the expected failure; no TBD/TODO.

**Type consistency** — checked across tasks: `FilterOperator` (schema-editor, Task 1) and quick-run `FilterOperator` (existing wire union) live in different modules and are never mixed; `MASTER_SCHEMA_TYPE`, `SCHEMA_TYPE_SUGGESTIONS`, `readSchemaAttributesType`, `setSchemaAttributesType` (Task 2 → 3, 4); `CREATE_NEW_COMPONENT_META`, `SupportedCategory`, `NewComponentTemplateOptions` (Task 3); `IndexIneligibleReason`, `IndexViolationReason`, `IndexColumnType`, `INDEX_MESSAGES`, `IndexNodeInfo`, `IndexViolation`, `IndexTypeMismatch`, `analyzeIndexEligibility`, `getIndexAnalysis`, `indexInfoAt`, `indexViolationFor`, `findIndexViolations`, `indexedPointers`, `indexColumnsFor`, `indexTypeMismatch` (Task 4 → 5–8); `SchemaValidationEntry`, `translateIndexValidationErrors` (Task 5); `XIndexedCardView`, `XIndexedCardViewProps` (Task 6); `removeIndexedKeywords`, `IndexBadge`, `IndexedTypeMismatchBanner` (Task 7); `SchemaReferenceLike`, `readSchemaReference`, `SchemaComponentLoaderDeps`, `defaultSchemaComponentLoaderDeps`, `loadSchemaComponent`, `useSchemaComponentJson`, `SchemaIndexTypeWarning` (Task 8 → 10, 11); `MAX_FILTER_VALUE_LENGTH`, `MAX_FILTER_LENGTH`, `SerializedFilter.filterError` (Task 9 → 11); `MasterSchemaField`, `collectMasterSchemaFields`, `findSchemaField`, `fieldValueType`, `SCHEMA_OPERATOR_FOR_WIRE`, `isOperatorAllowedBySchema`, `operatorsForCondition`, `schemaFieldNotice`, `usesIndexProjection`, `AttributeSortOption`, `sortableAttributeOptions`, `describeSchemaField`, `MasterSchemaLoad`, `MasterSchemaLoaderDeps`, `loadWorkflowMasterSchema` (Task 10 → 11); `useWorkflowMasterSchema`, `FilterRow`, `FilterRowProps`, `InstanceFilterPanelProps` (Task 11); `getAllSchemasVersioned`, `validateGetAllSchemasParams` (Task 12 → 13); `VnextSchemaMap`, `fetchVnextSchemas`, `getCachedSchemas`, `invalidateSchemaCache`, `MonacoJsonSchemaEntry`, `buildMonacoJsonSchemas`, `JsonSchemaValidationOptions`, `configureJsonSchemaValidation` (Task 13).
