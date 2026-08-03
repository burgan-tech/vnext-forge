# Read-Only Component Designers + Skeleton Loading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the monitoring app's six component detail pages (Task, Extension, Function, Mapping, Schema, View) the forge designer's form look — strictly read-only — and add a full skeleton loading experience.

**Architecture:** New `component-readonly` module in `packages/designer-ui` (following the `canvas-interaction/readonly` precedent): props-driven detail cores that reuse clean leaf form components via a new `FormReadOnlyContext`, plus hand-written read-only counterparts where the editor is store-bound. Monitoring wires the cores into its existing detail pages and adopts a new `Skeleton` primitive.

**Tech Stack:** React 19, TypeScript, Tailwind 4, vitest (`renderToStaticMarkup` pattern), TanStack Query/Table, pnpm + Turborepo.

**Spec:** `apps/monitoring/docs/superpowers/specs/2026-07-31-readonly-component-designers-design.md`

---

## ⚠ Repo policies that bind this plan

1. **Git commits are made by the USER.** (`apps/monitoring/docs/CLAUDE.md` → Git Policy.) Every "Commit checkpoint" step below means: **stop, report what changed, and tell the user this is a good commit point with the suggested message.** Do not run `git commit` unless the user has explicitly authorized agent commits for this execution run.
2. All UI copy and code comments in English.
3. Monitoring code reads env only via `@monitoring/shared/config/config`; logs via `createLogger`.
4. Working branch: `f/monitoring-readonly-designers` (worktree `.claude/worktrees/f-monitoring-readonly-designers`). All commands run from the worktree root.

## Verified facts the plan relies on (do not re-derive)

- Task config lives at `json.attributes.config`; task type at `json.attributes.type` as a **string** (`TaskEditorPanel.tsx:13-15`).
- `taskFormMap` (`task-editor/forms/index.ts:26-43`) maps string type → form, but importing the barrel drags store/transport-coupled forms. Clean forms (props-only, reusable read-only): `HttpTaskForm` (6), `SoapTaskForm` (16), `NotificationTaskForm` (10), `ScriptTaskForm` (7, static banner), `DaprBindingTaskForm` (2), `DaprServiceTaskForm` (3), `DaprPubSubTaskForm` (4), `StateStoreTaskForm` (17), `DaprConversationTaskForm` (20). Store/transport-coupled (use generic fallback instead): 11, 12, 13, 14, 15, 18, 19 and any unmapped type.
- `KVEditor` and `TagEditor` already have a `readOnly` prop that hides add/remove UI. `Input` already has a `readOnlyState` cva variant (`ui/Input.tsx:44,292,330`).
- Script decode: `decodeScriptCode(code, encoding)`, `isScriptCodeRef`, `formatScriptCodeRef` from `packages/designer-ui/src/modules/code-editor/editor/ScriptCodec.ts` (pure; import by **direct path**, never via the `code-editor` barrel).
- Script JSON paths: function single `attributes.task.mapping`; function multi `attributes.onExecutionTasks[i].mapping` + `attributes.output`; extension `attributes.task.mapping`; mapping (sys-mappings) **flattened**: `attributes.name/location/code/encoding`.
- Extension task is a **reference**: `attributes.task.task.{key,domain,version,flow}` + `attributes.task.order` + `attributes.task.mapping`.
- Function metadata: scope at `attributes.scope` (`'I'|'F'|'D'`); extension type/scope at `attributes.type`/`attributes.scope` (numbers 1..4 / 1..3); `definedFlows` only when type is 3 or 4.
- Schema payload: `json.attributes.schema` (plain object). Pure walkers: `getSchemaRoot`, `getNodeType`, `summarizeNode`, `getPropertyKeys`, `isRequiredKey` from `schema-editor/model/schemaNode.ts`; pointer helpers from `schema-editor/model/jsonPointer.ts`.
- View fields: `attributes.type` (string number), `attributes.display`, `attributes.renderer`, `attributes.content` (object or string, **no base64**); helpers `normalizeContentForEditor`, `isLinkType`, `linkTypeFieldKey`, `viewTypeToMonacoLanguage` from `view-editor/viewContentHelpers.ts` (pure).
- `PseudoUiViewSurface` (props: `viewResponse`, `mode: 'preview'`, `ariaLabel`, optional `lang`, `fillHeight`) needs **no provider**, but is **not yet exported** from `quick-run/index.ts`.
- **Monitor API returns flattened definitions** (`data.type`, `data.content`, `data.script` at top level) while editors read `attributes.*`. `unwrapDefinitionResponse` (`definitions-queries.ts:148-153`) already tolerates two envelope shapes. A normalizer is required (Task 3).
- `useComponentDetail(type, id)` → `Record<string, unknown>`, queryKey `['definitions', type, id]` (`definitions-queries.ts:299-312`).
- `DataTable` loading branch to replace: `apps/monitoring/src/shared/components/data-table/DataTable.tsx:150-159`; `visibleColumnCount` already at L92.
- designer-ui test pattern: `*.vitest.test.tsx` + `renderToStaticMarkup` (see `TaskEditorPanel.vitest.test.ts`); effects don't run, so transport-coupled hooks are inert in tests.
- Do NOT reuse: `CsxEditorField`, `ComponentValidationSummary`, `TaskExecutionList`/`TaskExecutionForm`, `MappingScriptsSection`, `ChooseExisting*` dialogs, `useComponentTypeSchema`/`useFieldValidationError` (transport/store-coupled).

## File structure (what gets created/modified)

```
packages/designer-ui/src/
  ui/
    FormReadOnlyContext.tsx                 [create]  context + provider + hook
    Skeleton.tsx                            [create]  shimmer primitive
    Input.tsx                               [modify]  readOnly defaults from context
    Textarea.tsx                            [modify]  same
    Select.tsx                              [modify]  same (non-interactive, chevron hidden)
    KeyValueEditor.tsx                      [modify]  readOnly prop defaults from context
    TagEditor.tsx                           [modify]  same
    ComponentDescriptionField.tsx           [modify]  same
    index.ts                                [modify]  export new files
  modules/quick-run/index.ts                [modify]  export PseudoUiViewSurface
  modules/component-readonly/
    index.ts                                [create]
    readonlyLabels.ts                       [create]  option label tables (task/ext/func/view)
    normalizeDefinitionDoc.ts               [create]  flat ↔ attributes-nested adapter
    normalizeDefinitionDoc.vitest.test.ts   [create]
    shared/ReadOnlyMetadataSection.tsx      [create]
    shared/ReadOnlyValueField.tsx           [create]
    shared/ComponentRefCard.tsx             [create]
    shared/ReadOnlyScriptSection.tsx        [create]
    shared/ReadOnlyConfigFields.tsx         [create]  generic config fallback
    TaskDetailCore.tsx                      [create]  + .vitest.test.tsx
    ExtensionDetailCore.tsx                 [create]  + .vitest.test.tsx
    FunctionDetailCore.tsx                  [create]  + .vitest.test.tsx
    MappingDetailCore.tsx                   [create]  + .vitest.test.tsx
    SchemaDetailCore.tsx                    [create]  + .vitest.test.tsx
    ViewDetailCore.tsx                      [create]  + .vitest.test.tsx
  index.ts                                  [modify]  barrel: export component-readonly

apps/monitoring/src/
  shared/components/skeletons/
    index.ts                                [create]
    KpiCardSkeleton.tsx                     [create]
    ChartSkeleton.tsx                       [create]
    DetailPageSkeleton.tsx                  [create]
  shared/components/data-table/DataTable.tsx [modify] skeleton rows + isFetching dim
  modules/dashboard/components/ComponentCountsSection.tsx [modify]
  modules/dashboard/components/InstanceDistSection.tsx    [modify]
  modules/dashboard/components/ActivityChart.tsx          [modify]
  modules/dashboard/components/RecentFaultsSection.tsx    [modify]
  modules/definitions/task/TaskDetailPage.tsx             [modify]
  modules/definitions/extension/ExtensionDetailPage.tsx   [modify]
  modules/definitions/function/FunctionDetailPage.tsx     [modify]
  modules/definitions/mapping/MappingDetailPage.tsx       [modify]
  modules/definitions/schema/SchemaDetailPage.tsx         [modify]
  modules/definitions/view/ViewDetailPage.tsx             [modify]
  modules/definitions/view/ViewPreviewTab.tsx             [modify]  wire PseudoUiViewSurface
```

Run all commands from the worktree root:
`/Users/U0B006/Documents/repos/burgan-tech/vnext-forge/.claude/worktrees/f-monitoring-readonly-designers`

---

### Task 1: `Skeleton` primitive (designer-ui)

**Files:**
- Create: `packages/designer-ui/src/ui/Skeleton.tsx`
- Create: `packages/designer-ui/src/ui/Skeleton.vitest.test.tsx`
- Modify: `packages/designer-ui/src/ui/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/designer-ui/src/ui/Skeleton.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton.js';

describe('Skeleton', () => {
  it('renders a pulsing placeholder with merged classes', () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: 'h-4 w-32' }));
    expect(html).toContain('animate-pulse');
    expect(html).toContain('h-4');
    expect(html).toContain('w-32');
    expect(html).toContain('aria-hidden');
  });

  it('respects reduced motion', () => {
    const html = renderToStaticMarkup(createElement(Skeleton));
    expect(html).toContain('motion-reduce:animate-none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/Skeleton.vitest.test.tsx`
Expected: FAIL — cannot resolve `./Skeleton.js`

- [ ] **Step 3: Implement**

`packages/designer-ui/src/ui/Skeleton.tsx`:

```tsx
import * as React from 'react';

import { cn } from '../lib/utils/cn.js';

export interface SkeletonProps extends React.ComponentProps<'div'> {}

/**
 * Theme-aware shimmer placeholder. Size it with utility classes
 * (`h-4 w-32`, `h-full`, …); it mimics the footprint of the content
 * it stands in for so layout does not jump when data arrives.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
```

Add to `packages/designer-ui/src/ui/index.ts` (alphabetical position, near `export * from './Separator.js';`):

```ts
export * from './Skeleton.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/Skeleton.vitest.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit checkpoint** — suggest to user: `feat(designer-ui): add Skeleton primitive`

---

### Task 2: `FormReadOnlyContext` + primitive integration (designer-ui)

**Files:**
- Create: `packages/designer-ui/src/ui/FormReadOnlyContext.tsx`
- Create: `packages/designer-ui/src/ui/FormReadOnlyContext.vitest.test.tsx`
- Modify: `packages/designer-ui/src/ui/Input.tsx`, `Textarea.tsx`, `Select.tsx`, `KeyValueEditor.tsx`, `TagEditor.tsx`, `ComponentDescriptionField.tsx`, `index.ts`

**Mechanism:** each primitive derives its effective read-only flag as `explicit prop ?? context`. Context default is `false`; no forge shell mounts the provider, so current behavior is bit-identical there.

- [ ] **Step 1: Write the failing test**

`packages/designer-ui/src/ui/FormReadOnlyContext.vitest.test.tsx`:

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormReadOnlyProvider } from './FormReadOnlyContext.js';
import { Input } from './Input.js';
import { KVEditor } from './KeyValueEditor.js';
import { TagEditor } from './TagEditor.js';
import { Select } from './Select.js';

const noop = () => {};

describe('FormReadOnlyContext', () => {
  it('defaults to editable without a provider', () => {
    const html = renderToStaticMarkup(
      h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop }),
    );
    expect(html).toContain('Add'); // add button present
  });

  it('makes Input readOnly inside the provider', () => {
    const html = renderToStaticMarkup(
      h(FormReadOnlyProvider, null, h(Input, { value: 'x', onChange: noop })),
    );
    expect(html).toContain('readonly');
  });

  it('hides KVEditor and TagEditor action buttons inside the provider', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop }),
        h(TagEditor, { tags: ['t1'], onChange: noop }),
      ),
    );
    expect(html).not.toContain('aria-label="Remove row 1"');
    expect(html).not.toContain('aria-label="Remove t1"');
    expect(html).not.toContain('data-slot="tag-editor-input"');
  });

  it('renders Select non-interactive inside the provider', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(Select, { value: 'GET', onChange: noop }, h('option', { value: 'GET' }, 'GET')),
      ),
    );
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('aria-readonly="true"');
  });

  it('explicit prop still wins over context', () => {
    const html = renderToStaticMarkup(
      h(
        FormReadOnlyProvider,
        null,
        h(KVEditor, { pairs: [{ key: 'a', value: 'b' }], onChange: noop, readOnly: false }),
      ),
    );
    expect(html).toContain('Add');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/FormReadOnlyContext.vitest.test.tsx`
Expected: FAIL — cannot resolve `./FormReadOnlyContext.js`

- [ ] **Step 3: Create the context**

`packages/designer-ui/src/ui/FormReadOnlyContext.tsx`:

```tsx
import * as React from 'react';

/**
 * When true, form primitives (Input, Textarea, Select, KVEditor, TagEditor,
 * ComponentDescriptionField) render as "quiet read-only": values keep the
 * designer form look and stay selectable/copyable, but nothing is editable
 * and row/tag action buttons are not rendered.
 *
 * Default is false and no forge shell mounts the provider, so editor
 * behavior is unchanged unless a host opts in (e.g. monitoring detail pages).
 */
const FormReadOnlyContext = React.createContext<boolean>(false);

export function FormReadOnlyProvider({ children }: { children: React.ReactNode }) {
  return <FormReadOnlyContext.Provider value={true}>{children}</FormReadOnlyContext.Provider>;
}

export function useFormReadOnly(): boolean {
  return React.useContext(FormReadOnlyContext);
}
```

- [ ] **Step 4: Wire the primitives**

Apply these minimal edits (each follows the same `prop ?? context` pattern):

**`Input.tsx`** — signature currently destructures `readOnly = false` (line ~292). Change to:

```tsx
// add import
import { useFormReadOnly } from './FormReadOnlyContext.js';

// in the forwardRef render function: change `readOnly = false` to
readOnly: readOnlyProp,
// and as the first lines of the function body:
const contextReadOnly = useFormReadOnly();
const readOnly = readOnlyProp ?? contextReadOnly;
```

Everything downstream (`readOnlyState` variant at L330, native `readOnly` at L367, `effectiveHoverable` at L316) already keys off `readOnly` — no other changes.

**`Textarea.tsx`** — the component spreads props onto `<textarea>`. Add:

```tsx
import { useFormReadOnly } from './FormReadOnlyContext.js';
// in the component body:
const contextReadOnly = useFormReadOnly();
const readOnly = readOnlyProp ?? contextReadOnly;
```

Destructure `readOnly: readOnlyProp` from props, pass `readOnly={readOnly}` to the element, and when `readOnly` add `'focus-visible:ring-0 focus-visible:border-inherit cursor-default'` to the class merge so no focus ring appears.

**`Select.tsx`** — native `<select>`; there is no readOnly for selects, so emulate:

```tsx
import { useFormReadOnly } from './FormReadOnlyContext.js';
// component body:
const readOnly = useFormReadOnly();
```

When `readOnly`: add `className` pieces `'pointer-events-none appearance-none'`, set `tabIndex={-1}` and `aria-readonly="true"` on the element. Do NOT set `disabled` (that grays the text via `disabled:opacity-50`).

**`KeyValueEditor.tsx`** — change `readOnly = false` (line ~83) to:

```tsx
readOnly: readOnlyProp,
// body:
const contextReadOnly = useFormReadOnly();
const readOnly = readOnlyProp ?? contextReadOnly;
```

Type change in `KeyValueEditorProps`: `readOnly?: boolean` stays as-is (optional already).

**`TagEditor.tsx`** — same change to its `readOnly = false` destructure (line ~76).

**`ComponentDescriptionField.tsx`** — add:

```tsx
import { useFormReadOnly } from './FormReadOnlyContext.js';
// body:
const readOnly = useFormReadOnly();
// on the <textarea>:
readOnly={readOnly}
```

**`index.ts`** — add `export * from './FormReadOnlyContext.js';`

- [ ] **Step 5: Run the new test + full designer-ui suite**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/FormReadOnlyContext.vitest.test.tsx`
Expected: PASS (5 tests)

Run: `pnpm --filter @vnext-forge-studio/designer-ui test`
Expected: 346 baseline tests + new ones all PASS (regression gate — proves default-off changes nothing)

- [ ] **Step 6: Commit checkpoint** — `feat(designer-ui): FormReadOnlyContext for quiet read-only form primitives`

---

### Task 3: `component-readonly` shared layer (designer-ui)

**Files:**
- Create: `packages/designer-ui/src/modules/component-readonly/{readonlyLabels.ts,normalizeDefinitionDoc.ts,normalizeDefinitionDoc.vitest.test.ts}`
- Create: `packages/designer-ui/src/modules/component-readonly/shared/{ReadOnlyValueField.tsx,ReadOnlyMetadataSection.tsx,ComponentRefCard.tsx,ReadOnlyScriptSection.tsx,ReadOnlyConfigFields.tsx}`

- [ ] **Step 1: Label tables**

`readonlyLabels.ts` — copied from the verified picker/panel sources (single source for read-only rendering; keep in sync comments point back):

```ts
/** Labels mirrored from the editor pickers (TaskTypePicker, ExtensionTypePicker,
 *  ExtensionScopePicker, FunctionScopePicker, ViewEditorPanel). Update together. */

export const TASK_TYPE_LABELS: Record<string, string> = {
  '1': 'Dapr HTTP Endpoint', '2': 'Dapr Binding', '3': 'Dapr Service', '4': 'Dapr PubSub',
  '5': 'Human Task', '6': 'HTTP Task', '7': 'Script Task', '8': 'Condition Task',
  '9': 'Timer Task', '10': 'Notification Task', '11': 'Start Flow Task',
  '12': 'Trigger Transition Task', '13': 'Get Instance Data Task', '14': 'Sub Process Task',
  '15': 'Get Instances Task', '16': 'SOAP Task', '17': 'State Store Task',
  '18': 'Cache Aside Task', '19': 'Get Instance Task', '20': 'Dapr Conversation Task',
};

export const EXTENSION_TYPE_LABELS: Record<number, string> = {
  1: 'Global', 2: 'Global + Requested', 3: 'Defined Flows', 4: 'Defined + Requested',
};

export const EXTENSION_SCOPE_LABELS: Record<number, string> = {
  1: 'Get Instance', 2: 'Get All Instances', 3: 'Everywhere',
};

export const FUNCTION_SCOPE_LABELS: Record<string, string> = {
  I: 'Instance', F: 'Workflow', D: 'Domain',
};

export const VIEW_TYPE_LABELS: Record<string, string> = {
  '1': 'JSON', '2': 'HTML', '3': 'Markdown', '4': 'Deeplink', '5': 'Http', '6': 'URN',
};
```

(Verify each table against the pickers listed in the header comment while implementing; the task-type list must match `TaskTypePicker.tsx:4-21`.)

- [ ] **Step 2: Failing test for the normalizer**

`normalizeDefinitionDoc.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';

describe('normalizeDefinitionDoc', () => {
  it('passes through an attributes-nested document unchanged', () => {
    const doc = {
      key: 't1', version: '1.0.0', domain: 'core', flow: 'sys-tasks',
      attributes: { type: '6', config: { url: 'https://x' } },
    };
    expect(normalizeDefinitionDoc('task', doc)).toEqual(doc);
  });

  it('lifts flattened monitor-API fields into attributes', () => {
    const flat = {
      key: 't1', version: '1.0.0', domain: 'core', flow: 'sys-tasks',
      type: '6', config: { url: 'https://x' }, tags: ['a'],
    };
    const doc = normalizeDefinitionDoc('task', flat);
    expect((doc.attributes as Record<string, unknown>).type).toBe('6');
    expect((doc.attributes as Record<string, unknown>).config).toEqual({ url: 'https://x' });
    expect(doc.key).toBe('t1');
    expect(doc.tags).toEqual(['a']);
    expect(doc).not.toHaveProperty('config'); // moved, not duplicated
  });

  it('normalizes a flattened view', () => {
    const doc = normalizeDefinitionDoc('view', {
      key: 'v1', type: 2, display: 'full-page', renderer: '', content: '<b>x</b>',
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.type).toBe(2);
    expect(attrs.display).toBe('full-page');
    expect(attrs.content).toBe('<b>x</b>');
  });

  it('normalizes a flattened mapping with script alias', () => {
    const doc = normalizeDefinitionDoc('mapping', {
      key: 'm1', name: 'Helper', script: 'cHVibGlj', encoding: 'B64', location: './src/x.csx',
    });
    const attrs = doc.attributes as Record<string, unknown>;
    expect(attrs.code).toBe('cHVibGlj');
    expect(attrs.encoding).toBe('B64');
    expect(attrs.name).toBe('Helper');
  });

  it('normalizes a flattened schema payload', () => {
    const doc = normalizeDefinitionDoc('schema', {
      key: 's1', schema: { type: 'object', properties: { a: { type: 'string' } } },
    });
    expect((doc.attributes as Record<string, unknown>).schema).toEqual({
      type: 'object', properties: { a: { type: 'string' } },
    });
  });
});
```

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/component-readonly/normalizeDefinitionDoc.vitest.test.ts`
Expected: FAIL — module missing

- [ ] **Step 3: Implement the normalizer**

`normalizeDefinitionDoc.ts`:

```ts
/**
 * The monitor API's /components/definition endpoint returns component
 * documents in a FLATTENED shape (type/config/content/… at the top level)
 * while the designer editors read the canonical `attributes.*` nesting.
 * This adapter accepts either shape and returns the canonical one.
 * Mirrors the approach of canvas-interaction/readonly/normalize.ts.
 */

export type ReadonlyComponentType =
  | 'task' | 'extension' | 'function' | 'mapping' | 'schema' | 'view';

const COMMON_TOP_LEVEL = new Set([
  'key', 'version', 'domain', 'flow', 'flowVersion', 'tags', '_comment', 'labels',
]);

/** Per type: which top-level keys belong inside `attributes` (aliases map source→attr key). */
const ATTR_KEYS: Record<ReadonlyComponentType, Record<string, string>> = {
  task:      { type: 'type', config: 'config' },
  extension: { type: 'type', scope: 'scope', definedFlows: 'definedFlows', task: 'task' },
  function:  { scope: 'scope', task: 'task', onExecutionTasks: 'onExecutionTasks',
               output: 'output', rawResponse: 'rawResponse', cache: 'cache' },
  mapping:   { name: 'name', location: 'location', code: 'code', script: 'code',
               encoding: 'encoding' },
  schema:    { type: 'type', schema: 'schema' },
  view:      { type: 'type', display: 'display', renderer: 'renderer', content: 'content',
               labels: 'labels' },
};

export function normalizeDefinitionDoc(
  type: ReadonlyComponentType,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const existingAttrs = raw.attributes;
  if (existingAttrs && typeof existingAttrs === 'object') return raw;

  const attrs: Record<string, unknown> = {};
  const doc: Record<string, unknown> = {};
  const aliasMap = ATTR_KEYS[type];

  for (const [k, v] of Object.entries(raw)) {
    if (COMMON_TOP_LEVEL.has(k) && !(type === 'view' && k === 'labels')) {
      doc[k] = v;
    } else if (k in aliasMap) {
      if (attrs[aliasMap[k]] === undefined) attrs[aliasMap[k]] = v;
    } else {
      doc[k] = v; // unknown keys stay top-level (forward compatible)
    }
  }

  doc.attributes = attrs;
  return doc;
}
```

Run the test again. Expected: PASS (5 tests). If a test contradicts live API data later, fix the alias table — not the callers.

- [ ] **Step 4: Shared presentational pieces**

`shared/ReadOnlyValueField.tsx` — a labeled value in designer form style:

```tsx
import { Field } from '../../../ui/Field.js';
import { Input } from '../../../ui/Input.js';

interface ReadOnlyValueFieldProps {
  label: string;
  value: unknown;
  mono?: boolean;
  placeholder?: string;
}

/** Field+Input in quiet read-only (context supplies readOnly). */
export function ReadOnlyValueField({ label, value, mono, placeholder }: ReadOnlyValueFieldProps) {
  const text = value === null || value === undefined ? '' : String(value);
  return (
    <Field label={label}>
      <Input
        value={text}
        onChange={() => {}}
        placeholder={placeholder ?? '—'}
        size="sm"
        className={mono ? 'font-mono' : undefined}
      />
    </Field>
  );
}
```

(Check `Field`'s actual props while implementing — `packages/designer-ui/src/ui/Field.tsx`; if `label` is not the prop name, adapt. Check `Input`'s `size` prop exists — `HttpTaskForm.tsx:35` uses `size="sm"`, so it does.)

`shared/ReadOnlyMetadataSection.tsx` — the common identity block every core opens with:

```tsx
import { Badge } from '../../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card.js';
import { ComponentDescriptionField } from '../../../ui/ComponentDescriptionField.js';
import { TagEditor } from '../../../ui/TagEditor.js';
import { ReadOnlyValueField } from './ReadOnlyValueField.js';

export interface ReadOnlyMetadataSectionProps {
  json: Record<string, unknown>;
  /** Extra fields rendered inside the grid after the common four. */
  children?: React.ReactNode;
  title?: string;
  description?: string;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((x) => (typeof x === 'string' ? x : String((x as { label?: unknown })?.label ?? '')))
       .filter(Boolean)
    : [];
}

export function ReadOnlyMetadataSection({
  json, children, title = 'Metadata', description = 'Identity, scope and flow bindings.',
}: ReadOnlyMetadataSectionProps) {
  const tags = asStringArray(json.tags);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const labels = asStringArray(attrs.labels ?? json.labels);
  const comment = typeof json._comment === 'string' ? json._comment : '';

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyValueField label="Key" value={json.key} mono />
          <ReadOnlyValueField label="Version" value={json.version} mono />
          <ReadOnlyValueField label="Domain" value={json.domain} mono />
          <ReadOnlyValueField label="Flow" value={json.flow} mono />
          {children}
        </div>
        {labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Labels</span>
            {labels.map((l) => (
              <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
            ))}
          </div>
        )}
        {tags.length > 0 && <TagEditor tags={tags} onChange={() => {}} />}
        {comment && <ComponentDescriptionField value={comment} onChange={() => {}} />}
      </CardContent>
    </Card>
  );
}
```

`shared/ComponentRefCard.tsx` — reference chip/card (used by extension task ref + function task list):

```tsx
import { Badge } from '../../../ui/Badge.js';

export interface ComponentRef {
  key?: string; domain?: string; version?: string; flow?: string;
}

export interface ComponentRefCardProps {
  refValue: ComponentRef | null | undefined;
  order?: number;
  onNavigate?: (ref: ComponentRef) => void;
}

export function ComponentRefCard({ refValue, order, onNavigate }: ComponentRefCardProps) {
  if (!refValue?.key) {
    return <div className="text-muted-foreground text-sm">No task configured.</div>;
  }
  const body = (
    <div className="border-border bg-muted/20 flex items-center gap-2 rounded-lg border p-2 text-sm">
      {order !== undefined && (
        <Badge variant="outline" className="text-xs">#{order}</Badge>
      )}
      <span className="font-mono">{refValue.key}</span>
      {refValue.domain && <span className="text-muted-foreground">@{refValue.domain}</span>}
      {refValue.version && <span className="text-muted-foreground">v{refValue.version}</span>}
      {refValue.flow && <Badge variant="secondary" className="text-xs">{refValue.flow}</Badge>}
    </div>
  );
  if (!onNavigate) return body;
  return (
    <button
      type="button"
      className="block w-full cursor-pointer text-left"
      onClick={() => onNavigate(refValue)}
      aria-label={`Open ${refValue.key}`}>
      {body}
    </button>
  );
}
```

`shared/ReadOnlyScriptSection.tsx` — decoded C# script display:

```tsx
import { Badge } from '../../../ui/Badge.js';
import { JsonCodeField } from '../../../ui/JsonCodeField.js';
import {
  decodeScriptCode, formatScriptCodeRef, getScriptEncoding, isScriptCodeRef,
} from '../../code-editor/editor/ScriptCodec.js';
import { ComponentRefCard } from './ComponentRefCard.js';

interface ScriptLike {
  location?: string;
  code?: unknown;
  encoding?: string;
  scripts?: { helpers?: Array<Record<string, unknown>>; allowedAssemblies?: string[] };
}

export interface ReadOnlyScriptSectionProps {
  label: string;
  script: ScriptLike | null | undefined;
  onNavigateToMapping?: (ref: { key?: string; domain?: string; version?: string }) => void;
}

export function ReadOnlyScriptSection({ label, script, onNavigateToMapping }: ReadOnlyScriptSectionProps) {
  if (!script || (script.code === undefined && !script.location)) return null;

  const encoding = getScriptEncoding(script as never) ?? script.encoding;
  const code = script.code;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {script.location && (
          <span className="text-muted-foreground font-mono text-xs">{script.location}</span>
        )}
        {encoding && <Badge variant="outline" className="text-xs">{encoding}</Badge>}
      </div>
      {isScriptCodeRef(code) ? (
        <ComponentRefCard
          refValue={code as { key?: string }}
          onNavigate={onNavigateToMapping ? () => onNavigateToMapping(code as never) : undefined}
        />
      ) : (
        <JsonCodeField
          value={decodeScriptCode(code as never, encoding)}
          onChange={() => {}}
          readOnly
          language="csharp"
          height={220}
        />
      )}
      {script.scripts?.helpers && script.scripts.helpers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Helpers</span>
          {script.scripts.helpers.map((h, i) => (
            <Badge key={i} variant="secondary" className="font-mono text-xs">
              {formatScriptCodeRef(h as never)}
            </Badge>
          ))}
        </div>
      )}
      {script.scripts?.allowedAssemblies && script.scripts.allowedAssemblies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Allowed assemblies</span>
          {script.scripts.allowedAssemblies.map((a) => (
            <Badge key={a} variant="outline" className="font-mono text-xs">{a}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

**While implementing, verify `JsonCodeField`'s actual props** (`packages/designer-ui/src/ui/JsonCodeField.tsx` / `src/editor/JsonCodeField.tsx`): the exact prop names for `readOnly`, `language`, `height`. `RawJsonViewer.tsx:65-71` in monitoring is a working usage example — copy its prop style.

`shared/ReadOnlyConfigFields.tsx` — generic fallback for task types without a safe form:

```tsx
import { Field } from '../../../ui/Field.js';
import { Input } from '../../../ui/Input.js';
import { JsonCodeField } from '../../../ui/JsonCodeField.js';
import { TagEditor } from '../../../ui/TagEditor.js';

export function ReadOnlyConfigFields({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config);
  if (entries.length === 0) {
    return <div className="text-muted-foreground text-sm">No configuration.</div>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => {
        if (v === null || v === undefined) return null;
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
          return (
            <Field key={k} label={k}>
              <TagEditor tags={v as string[]} onChange={() => {}} />
            </Field>
          );
        }
        if (typeof v === 'object') {
          return (
            <Field key={k} label={k}>
              <JsonCodeField
                value={JSON.stringify(v, null, 2)}
                onChange={() => {}}
                readOnly
                language="json"
                height={160}
              />
            </Field>
          );
        }
        return (
          <Field key={k} label={k}>
            <Input value={String(v)} onChange={() => {}} size="sm" />
          </Field>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: `tsc -b` passes. Fix any prop-name mismatches against the real `Field`/`JsonCodeField` signatures now.

- [ ] **Step 6: Commit checkpoint** — `feat(designer-ui): component-readonly shared layer (normalizer, metadata, script, ref, fallback)`

---

### Task 4: `TaskDetailCore`

**Files:**
- Create: `packages/designer-ui/src/modules/component-readonly/TaskDetailCore.tsx`
- Create: `packages/designer-ui/src/modules/component-readonly/TaskDetailCore.vitest.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskDetailCore } from './TaskDetailCore.js';

const base = { key: 'notify-user', version: '1.0.0', domain: 'core', flow: 'sys-tasks' };

describe('TaskDetailCore', () => {
  it('renders HTTP task config with the real HttpTaskForm read-only', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, {
        json: { ...base, attributes: { type: '6', config: { url: 'https://api.example.com', method: 'POST' } } },
      }),
    );
    expect(html).toContain('HTTP Task');            // type label
    expect(html).toContain('https://api.example.com');
    expect(html).toContain('readonly');             // quiet read-only inputs
    expect(html).not.toContain('>Add<');            // no KVEditor add button
  });

  it('falls back to generic config rendering for unmapped types', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, {
        json: { ...base, attributes: { type: '19', config: { workflowName: 'wf-1' } } },
      }),
    );
    expect(html).toContain('Get Instance Task');
    expect(html).toContain('wf-1');
  });

  it('accepts the flattened monitor-API shape', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, { json: { ...base, type: '6', config: { url: 'https://flat.example' } } }),
    );
    expect(html).toContain('https://flat.example');
  });
});
```

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/component-readonly/TaskDetailCore.vitest.test.tsx`
Expected: FAIL — module missing

- [ ] **Step 2: Implement**

```tsx
import { useMemo } from 'react';
import type { ComponentType } from 'react';

import { Badge } from '../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { DaprBindingTaskForm } from '../task-editor/forms/DaprBindingTaskForm.js';
import { DaprConversationTaskForm } from '../task-editor/forms/DaprConversationTaskForm.js';
import { DaprPubSubTaskForm } from '../task-editor/forms/DaprPubSubTaskForm.js';
import { DaprServiceTaskForm } from '../task-editor/forms/DaprServiceTaskForm.js';
import { HttpTaskForm } from '../task-editor/forms/HttpTaskForm.js';
import { NotificationTaskForm } from '../task-editor/forms/NotificationTaskForm.js';
import { ScriptTaskForm } from '../task-editor/forms/ScriptTaskForm.js';
import { SoapTaskForm } from '../task-editor/forms/SoapTaskForm.js';
import { StateStoreTaskForm } from '../task-editor/forms/StateStoreTaskForm.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { TASK_TYPE_LABELS } from './readonlyLabels.js';
import { ReadOnlyConfigFields } from './shared/ReadOnlyConfigFields.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

type TaskFormProps = { config: Record<string, unknown>; onChange: (u: (d: never) => void) => void };

/**
 * Only forms verified free of store/transport imports are reused
 * (see plan "Verified facts"). Everything else renders through the
 * generic ReadOnlyConfigFields fallback.
 */
const READONLY_TASK_FORM_MAP: Record<string, ComponentType<TaskFormProps>> = {
  '2': DaprBindingTaskForm, '3': DaprServiceTaskForm, '4': DaprPubSubTaskForm,
  '6': HttpTaskForm, '7': ScriptTaskForm, '10': NotificationTaskForm,
  '16': SoapTaskForm, '17': StateStoreTaskForm, '20': DaprConversationTaskForm,
};

const noop = () => {};

export interface TaskDetailCoreProps {
  json: Record<string, unknown>;
}

export function TaskDetailCore({ json: raw }: TaskDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('task', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const taskType = String(attrs.type ?? '0');
  const config = (attrs.config ?? {}) as Record<string, unknown>;
  const typeLabel = TASK_TYPE_LABELS[taskType] ?? `Type ${taskType}`;
  const FormComponent = READONLY_TASK_FORM_MAP[taskType];

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Task Metadata">
          <ReadOnlyValueField label="Task Type" value={typeLabel} />
        </ReadOnlyMetadataSection>

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              Configuration
              <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Type-specific configuration for this task.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {FormComponent
              ? <FormComponent config={config} onChange={noop} />
              : <ReadOnlyConfigFields config={config} />}
          </CardContent>
        </Card>
      </div>
    </FormReadOnlyProvider>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/component-readonly/TaskDetailCore.vitest.test.tsx`
Expected: PASS (3 tests). If the `'>Add<'` assertion fails, inspect the KVEditor button markup and adjust the assertion to its actual add-button label rendering — the requirement is: no add/remove buttons in the HTML.

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): TaskDetailCore read-only task designer`

---

### Task 5: `ExtensionDetailCore`

**Files:** Create `ExtensionDetailCore.tsx` + `ExtensionDetailCore.vitest.test.tsx` (same directory).

- [ ] **Step 1: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExtensionDetailCore } from './ExtensionDetailCore.js';

describe('ExtensionDetailCore', () => {
  it('renders metadata, type/scope labels, defined flows and task ref', () => {
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'audit-ext', version: '1.0.0', domain: 'core', flow: 'sys-extensions',
          attributes: {
            type: 3, scope: 3, definedFlows: ['wf-a', 'wf-b'],
            task: {
              order: 1,
              task: { key: 'audit-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
              mapping: { location: './src/AuditMapping.csx', code: 'Ly8gbWFwcGluZw==', encoding: 'B64' },
            },
          },
        },
      }),
    );
    expect(html).toContain('Defined Flows');
    expect(html).toContain('wf-a');
    expect(html).toContain('Everywhere');     // scope 3 label
    expect(html).toContain('audit-task');     // task ref card
    expect(html).toContain('AuditMapping.csx');
    expect(html).not.toContain('Replace');    // no action buttons
  });

  it('shows an empty state when no task is attached', () => {
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: { key: 'e1', version: '1.0.0', domain: 'core', flow: 'sys-extensions',
                attributes: { type: 1, scope: 1 } },
      }),
    );
    expect(html).toContain('No task configured');
  });
});
```

Run + expect FAIL (module missing).

- [ ] **Step 2: Implement**

```tsx
import { useMemo } from 'react';

import { Badge } from '../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { EXTENSION_SCOPE_LABELS, EXTENSION_TYPE_LABELS } from './readonlyLabels.js';
import { ComponentRefCard, type ComponentRef } from './shared/ComponentRefCard.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyScriptSection } from './shared/ReadOnlyScriptSection.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

export interface ExtensionDetailCoreProps {
  json: Record<string, unknown>;
  onNavigateToComponent?: (flow: string, ref: ComponentRef) => void;
}

export function ExtensionDetailCore({ json: raw, onNavigateToComponent }: ExtensionDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('extension', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const type = Number(attrs.type ?? json.type ?? 1);
  const scope = Number(attrs.scope ?? json.scope ?? 1);
  const definedFlows = Array.isArray(attrs.definedFlows) ? (attrs.definedFlows as string[]) : [];
  const task = (attrs.task ?? null) as
    | { order?: number; task?: ComponentRef; mapping?: Record<string, unknown> | null }
    | null;
  const hasTask = task != null && task.task != null && Boolean(task.task.key);

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Extension Metadata">
          <ReadOnlyValueField label="Extension Type" value={EXTENSION_TYPE_LABELS[type] ?? type} />
          <ReadOnlyValueField label="Extension Scope" value={EXTENSION_SCOPE_LABELS[scope] ?? scope} />
        </ReadOnlyMetadataSection>

        {(type === 3 || type === 4) && (
          <Card variant="default" className="gap-3">
            <CardHeader className="border-border border-b">
              <CardTitle className="text-base">Defined Flows</CardTitle>
              <CardDescription className="text-xs">Flows this extension applies to.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 px-4 sm:px-6">
              {definedFlows.length === 0
                ? <span className="text-muted-foreground text-sm">No flows defined.</span>
                : definedFlows.map((f) => (
                    <Badge key={f} variant="secondary" className="font-mono text-xs">{f}</Badge>
                  ))}
            </CardContent>
          </Card>
        )}

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Task</CardTitle>
            <CardDescription className="text-xs">
              The task that runs when this extension is invoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6">
            {hasTask ? (
              <>
                <ComponentRefCard
                  refValue={task!.task}
                  order={task!.order}
                  onNavigate={
                    onNavigateToComponent
                      ? (ref) => onNavigateToComponent(ref.flow ?? 'sys-tasks', ref)
                      : undefined
                  }
                />
                <ReadOnlyScriptSection label="Mapping" script={task!.mapping as never} />
              </>
            ) : (
              <span className="text-muted-foreground text-sm">No task configured.</span>
            )}
          </CardContent>
        </Card>
      </div>
    </FormReadOnlyProvider>
  );
}
```

- [ ] **Step 3: Run test** — expect PASS (2 tests)

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): ExtensionDetailCore`

---

### Task 6: `FunctionDetailCore`

**Files:** Create `FunctionDetailCore.tsx` + `FunctionDetailCore.vitest.test.tsx`.

- [ ] **Step 1: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionDetailCore } from './FunctionDetailCore.js';

const base = { key: 'calc-fee', version: '1.0.0', domain: 'core', flow: 'sys-functions' };

describe('FunctionDetailCore', () => {
  it('renders single-task mode with scope label and mapping', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: { ...base, attributes: {
          scope: 'D',
          task: { order: 1, task: { key: 'fee-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
                  mapping: { location: './src/FeeMapping.csx', code: 'Ly8gZmVl', encoding: 'B64' } },
        } },
      }),
    );
    expect(html).toContain('Domain');        // scope D label
    expect(html).toContain('fee-task');
    expect(html).toContain('FeeMapping.csx');
    expect(html).toContain('Single task');
  });

  it('renders multi-task mode with ordered refs and output mapping', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: { ...base, attributes: {
          scope: 'I', rawResponse: true,
          onExecutionTasks: [
            { order: 1, task: { key: 't-one', domain: 'core', version: '1.0.0', flow: 'sys-tasks' } },
            { order: 2, task: { key: 't-two', domain: 'core', version: '1.0.0', flow: 'sys-tasks' } },
          ],
          output: { location: './src/Output.csx', code: 'Ly8gb3V0', encoding: 'B64' },
        } },
      }),
    );
    expect(html).toContain('t-one');
    expect(html).toContain('t-two');
    expect(html).toContain('Output Mapping');
    expect(html).toContain('Raw response');
    expect(html).toContain('#2');
  });
});
```

Run + expect FAIL.

- [ ] **Step 2: Implement**

```tsx
import { useMemo } from 'react';

import { Badge } from '../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { FUNCTION_SCOPE_LABELS } from './readonlyLabels.js';
import { ComponentRefCard, type ComponentRef } from './shared/ComponentRefCard.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyScriptSection } from './shared/ReadOnlyScriptSection.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

interface TaskExecutionItem {
  order?: number;
  task?: ComponentRef;
  mapping?: Record<string, unknown> | null;
}

export interface FunctionDetailCoreProps {
  json: Record<string, unknown>;
  onNavigateToComponent?: (flow: string, ref: ComponentRef) => void;
}

export function FunctionDetailCore({ json: raw, onNavigateToComponent }: FunctionDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('function', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const scope = String(attrs.scope ?? json.scope ?? 'I');
  const single = (attrs.task ?? null) as TaskExecutionItem | null;
  const multi = Array.isArray(attrs.onExecutionTasks)
    ? (attrs.onExecutionTasks as TaskExecutionItem[])
    : null;
  const output = (attrs.output ?? null) as Record<string, unknown> | null;
  const rawResponse = attrs.rawResponse === true;
  const cache = (attrs.cache ?? null) as Record<string, unknown> | null;

  const navigate = onNavigateToComponent
    ? (ref: ComponentRef) => onNavigateToComponent(ref.flow ?? 'sys-tasks', ref)
    : undefined;

  const renderExecution = (item: TaskExecutionItem, index: number) => (
    <div key={index} className="space-y-2">
      <ComponentRefCard refValue={item.task} order={item.order ?? index + 1} onNavigate={navigate} />
      <ReadOnlyScriptSection label="Mapping" script={item.mapping as never} />
    </div>
  );

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Function Metadata">
          <ReadOnlyValueField label="Scope" value={FUNCTION_SCOPE_LABELS[scope] ?? scope} />
        </ReadOnlyMetadataSection>

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              Task Execution
              <Badge variant="secondary" className="text-xs">
                {multi ? `${multi.length} tasks` : single ? 'Single task' : 'None'}
              </Badge>
              {rawResponse && <Badge variant="outline" className="text-xs">Raw response</Badge>}
            </CardTitle>
            <CardDescription className="text-xs">
              Tasks executed when this function is called.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {multi
              ? multi.map(renderExecution)
              : single
                ? renderExecution(single, 0)
                : <span className="text-muted-foreground text-sm">No task executions configured.</span>}
          </CardContent>
        </Card>

        {output && (
          <Card variant="default" className="gap-3">
            <CardHeader className="border-border border-b">
              <CardTitle className="text-base">Output Mapping</CardTitle>
              <CardDescription className="text-xs">
                Mapping applied after all tasks complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <ReadOnlyScriptSection label="Output" script={output as never} />
            </CardContent>
          </Card>
        )}

        {cache && (
          <Card variant="default" className="gap-3">
            <CardHeader className="border-border border-b">
              <CardTitle className="text-base">Cache</CardTitle>
              <CardDescription className="text-xs">
                Read-through cache configuration for this function.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 px-4 sm:px-6">
              {Object.entries(cache).map(([k, v]) => (
                <ReadOnlyValueField
                  key={k}
                  label={k}
                  value={Array.isArray(v) ? v.join(', ') : String(v)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </FormReadOnlyProvider>
  );
}
```

- [ ] **Step 3: Run test** — expect PASS (2 tests)

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): FunctionDetailCore`

---

### Task 7: `MappingDetailCore`

**Files:** Create `MappingDetailCore.tsx` + `MappingDetailCore.vitest.test.tsx`.

- [ ] **Step 1: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MappingDetailCore } from './MappingDetailCore.js';

describe('MappingDetailCore', () => {
  it('renders metadata, name, and the decoded body header', () => {
    const html = renderToStaticMarkup(
      h(MappingDetailCore, {
        json: {
          key: 'crypto-helper', version: '1.0.0', domain: 'core',
          flow: 'sys-mappings', flowVersion: '1.0.0',
          attributes: {
            name: 'CryptoHelper', location: './src/CryptoHelper.csx',
            code: 'cHVibGljIHN0YXRpYyBjbGFzcyBDcnlwdG9IZWxwZXIge30=', encoding: 'B64',
          },
        },
      }),
    );
    expect(html).toContain('CryptoHelper');
    expect(html).toContain('CryptoHelper.csx');
    expect(html).toContain('B64');
  });

  it('accepts the flattened shape with a `script` alias', () => {
    const html = renderToStaticMarkup(
      h(MappingDetailCore, {
        json: { key: 'm2', version: '1.0.0', domain: 'core', flow: 'sys-mappings',
                name: 'Flat', script: 'Ly8geA==', encoding: 'B64', location: './src/F.csx' },
      }),
    );
    expect(html).toContain('F.csx');
  });
});
```

Run + expect FAIL.

- [ ] **Step 2: Implement**

```tsx
import { useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyScriptSection } from './shared/ReadOnlyScriptSection.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

export interface MappingDetailCoreProps {
  json: Record<string, unknown>;
}

export function MappingDetailCore({ json: raw }: MappingDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('mapping', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection
          json={json}
          title="Mapping"
          description="Root metadata for this sys-mappings component.">
          <ReadOnlyValueField label="Flow Version" value={json.flowVersion} mono />
          <ReadOnlyValueField label="Name" value={attrs.name} />
        </ReadOnlyMetadataSection>

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Mapping Body</CardTitle>
            <CardDescription className="text-xs">
              The reusable C# helper class other components reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <ReadOnlyScriptSection
              label="Body"
              script={{
                location: typeof attrs.location === 'string' ? attrs.location : undefined,
                code: attrs.code,
                encoding: typeof attrs.encoding === 'string' ? attrs.encoding : undefined,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </FormReadOnlyProvider>
  );
}
```

- [ ] **Step 3: Run test** — expect PASS (2 tests)

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): MappingDetailCore`

---

### Task 8: `SchemaDetailCore` (read-only schema tree)

**Files:** Create `SchemaDetailCore.tsx` + `SchemaDetailCore.vitest.test.tsx`.

Uses ONLY the pure model helpers (`schema-editor/model/schemaNode.ts`, `model/jsonPointer.ts`) — never the schema editor store or its tree component.

- [ ] **Step 1: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SchemaDetailCore } from './SchemaDetailCore.js';

describe('SchemaDetailCore', () => {
  it('renders a property tree with types and required markers', () => {
    const html = renderToStaticMarkup(
      h(SchemaDetailCore, {
        json: {
          key: 'customer', version: '1.0.0', domain: 'core', flow: 'sys-schemas',
          attributes: {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', 'x-label': 'Full name' },
                age: { type: 'integer' },
                address: {
                  type: 'object',
                  properties: { city: { type: 'string' } },
                },
              },
            },
          },
        },
      }),
    );
    expect(html).toContain('name');
    expect(html).toContain('Full name');
    expect(html).toContain('string');
    expect(html).toContain('required');
    expect(html).toContain('city');   // nested property rendered
  });

  it('shows an empty state when there is no schema payload', () => {
    const html = renderToStaticMarkup(
      h(SchemaDetailCore, {
        json: { key: 's-empty', version: '1.0.0', domain: 'core', flow: 'sys-schemas', attributes: {} },
      }),
    );
    expect(html).toContain('No schema definition');
  });
});
```

Run + expect FAIL.

- [ ] **Step 2: Implement**

```tsx
import { useMemo } from 'react';

import { Badge } from '../../ui/Badge.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';

interface SchemaObj { [k: string]: unknown }

function nodeType(node: SchemaObj): string {
  if (typeof node.type === 'string') return node.type;
  if (Array.isArray(node.type)) return (node.type as string[]).join(' | ');
  if (node.enum) return 'enum';
  if (node.oneOf) return 'oneOf';
  if (node.anyOf) return 'anyOf';
  if (node.allOf) return 'allOf';
  if (node.$ref) return String(node.$ref);
  return 'any';
}

function SchemaPropertyRow({
  name, node, required, depth,
}: { name: string; node: SchemaObj; required: boolean; depth: number }) {
  const type = nodeType(node);
  const label = typeof node['x-label'] === 'string' ? (node['x-label'] as string) : undefined;
  const format = typeof node.format === 'string' ? (node.format as string) : undefined;
  const children =
    type === 'object' && node.properties && typeof node.properties === 'object'
      ? Object.entries(node.properties as Record<string, SchemaObj>)
      : type === 'array' && node.items && typeof node.items === 'object'
        ? [['[items]', node.items as SchemaObj] as [string, SchemaObj]]
        : [];
  const childRequired = Array.isArray(node.required) ? (node.required as string[]) : [];

  return (
    <>
      <div
        className="border-border/60 flex items-center gap-2 border-b py-1.5 text-sm"
        style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="font-mono">{name}</span>
        <Badge variant="secondary" className="text-xs">{type}</Badge>
        {format && <Badge variant="outline" className="text-xs">{format}</Badge>}
        {required && <Badge variant="destructive" className="text-xs">required</Badge>}
        {label && <span className="text-muted-foreground text-xs">{label}</span>}
      </div>
      {children.map(([childName, childNode]) => (
        <SchemaPropertyRow
          key={childName}
          name={childName}
          node={childNode}
          required={childRequired.includes(childName)}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export interface SchemaDetailCoreProps {
  json: Record<string, unknown>;
}

export function SchemaDetailCore({ json: raw }: SchemaDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('schema', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const schema = (attrs.schema ?? null) as SchemaObj | null;
  const rootProps =
    schema?.properties && typeof schema.properties === 'object'
      ? Object.entries(schema.properties as Record<string, SchemaObj>)
      : [];
  const rootRequired = Array.isArray(schema?.required) ? (schema!.required as string[]) : [];

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Schema Metadata" />

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Structure</CardTitle>
            <CardDescription className="text-xs">
              Properties, types and validation of this JSON Schema.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {!schema || rootProps.length === 0 ? (
              <span className="text-muted-foreground text-sm">No schema definition.</span>
            ) : (
              <div>
                {rootProps.map(([name, node]) => (
                  <SchemaPropertyRow
                    key={name}
                    name={name}
                    node={node}
                    required={rootRequired.includes(name)}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FormReadOnlyProvider>
  );
}
```

(Note: a local `nodeType` is used instead of `schema-editor/model` imports because `getNodeType` operates on the full component json + pointer, which is heavier than needed here. If during implementation you find `summarizeNode` gives better parity with the forge tree, switch to it — it is pure.)

- [ ] **Step 3: Run test** — expect PASS (2 tests)

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): SchemaDetailCore read-only schema tree`

---

### Task 9: `ViewDetailCore` + `PseudoUiViewSurface` export

**Files:**
- Create: `ViewDetailCore.tsx` + `ViewDetailCore.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/index.ts`

- [ ] **Step 1: Export PseudoUiViewSurface from the quickrun barrel**

Add to `packages/designer-ui/src/modules/quick-run/index.ts`:

```ts
export { PseudoUiViewSurface } from './pseudo-ui/PseudoUiViewSurface.js';
```

(Match the file's existing export style; also export its props type if it is exported by the source file.)

- [ ] **Step 2: Failing test**

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ViewDetailCore } from './ViewDetailCore.js';

const base = { key: 'onboarding-view', version: '1.0.0', domain: 'core', flow: 'sys-views' };

describe('ViewDetailCore', () => {
  it('renders view metadata with type/display/renderer and JSON content', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, attributes: {
          type: '1', display: 'full-page', renderer: 'pseudo-ui',
          content: { view: { children: [] } },
        } },
      }),
    );
    expect(html).toContain('JSON');           // type label
    expect(html).toContain('full-page');
    expect(html).toContain('pseudo-ui');
  });

  it('renders link-type views as a target field', () => {
    const html = renderToStaticMarkup(
      h(ViewDetailCore, {
        json: { ...base, attributes: { type: '4', display: 'popup', content: { href: 'https://x.example' } } },
      }),
    );
    expect(html).toContain('https://x.example');
    expect(html).toContain('Deeplink');
  });
});
```

Run + expect FAIL.

- [ ] **Step 3: Implement**

```tsx
import { useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { JsonCodeField } from '../../ui/JsonCodeField.js';
import {
  isLinkType, linkTypeFieldKey, normalizeContentForEditor, viewTypeToMonacoLanguage,
} from '../view-editor/viewContentHelpers.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { VIEW_TYPE_LABELS } from './readonlyLabels.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

export interface ViewDetailCoreProps {
  json: Record<string, unknown>;
}

export function ViewDetailCore({ json: raw }: ViewDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('view', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const type = String(attrs.type ?? '1');
  const typeLabel = VIEW_TYPE_LABELS[type] ?? type;
  const display = String(attrs.display ?? 'full-page');
  const renderer = typeof attrs.renderer === 'string' ? attrs.renderer : '';
  const content = attrs.content;

  const link = isLinkType(type)
    ? (content as Record<string, unknown> | undefined)?.[linkTypeFieldKey(type)]
    : null;

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="View Metadata">
          <ReadOnlyValueField label="Type" value={typeLabel} />
          <ReadOnlyValueField label="Display Strategy" value={display} />
          {renderer && <ReadOnlyValueField label="Renderer" value={renderer} />}
        </ReadOnlyMetadataSection>

        <Card variant="default" className="gap-3">
          <CardHeader className="border-border border-b">
            <CardTitle className="text-base">Content</CardTitle>
            <CardDescription className="text-xs">
              The {typeLabel} content this view renders.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {isLinkType(type) ? (
              <ReadOnlyValueField label="Target" value={link} mono />
            ) : (
              <JsonCodeField
                value={normalizeContentForEditor(content, type)}
                onChange={() => {}}
                readOnly
                language={viewTypeToMonacoLanguage(type)}
                height={320}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </FormReadOnlyProvider>
  );
}
```

**While implementing, verify `viewContentHelpers` signatures** (`packages/designer-ui/src/modules/view-editor/viewContentHelpers.ts:3,36,97,109`) — in particular whether `isLinkType`/`viewTypeToMonacoLanguage` take the string type or a number; coerce accordingly.

- [ ] **Step 4: Run test** — expect PASS (2 tests)

- [ ] **Step 5: Commit checkpoint** — `feat(designer-ui): ViewDetailCore + export PseudoUiViewSurface from quickrun barrel`

---

### Task 10: Barrel exports + designer-ui gate

**Files:**
- Create: `packages/designer-ui/src/modules/component-readonly/index.ts`
- Modify: `packages/designer-ui/src/index.ts`

- [ ] **Step 1: Module barrel**

```ts
export { TaskDetailCore, type TaskDetailCoreProps } from './TaskDetailCore.js';
export { ExtensionDetailCore, type ExtensionDetailCoreProps } from './ExtensionDetailCore.js';
export { FunctionDetailCore, type FunctionDetailCoreProps } from './FunctionDetailCore.js';
export { MappingDetailCore, type MappingDetailCoreProps } from './MappingDetailCore.js';
export { SchemaDetailCore, type SchemaDetailCoreProps } from './SchemaDetailCore.js';
export { ViewDetailCore, type ViewDetailCoreProps } from './ViewDetailCore.js';
export { normalizeDefinitionDoc, type ReadonlyComponentType } from './normalizeDefinitionDoc.js';
export type { ComponentRef } from './shared/ComponentRefCard.js';
```

- [ ] **Step 2: Root barrel**

In `packages/designer-ui/src/index.ts`, next to the existing canvas readonly export (line ~277 exports `./modules/canvas-interaction/readonly`), add:

```ts
export * from './modules/component-readonly/index.js';
```

- [ ] **Step 3: Full designer-ui gate**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter @vnext-forge-studio/designer-ui lint`
Expected: build green; all tests (346 baseline + ~16 new) PASS. Lint: only pre-existing warnings, nothing new (per repo memory, per-package `eslint .` may be pre-existing red — compare against `git stash`-free main behavior, only ensure no NEW errors in touched files).

Run: `pnpm build`
Expected: full monorepo (extension + web + desktop + server + monitoring) builds — proves the barrel additions don't break any shell.

- [ ] **Step 4: Commit checkpoint** — `feat(designer-ui): export component-readonly detail cores`

---

### Task 11: Monitoring — Designer tabs on all six detail pages

**Files:**
- Modify: `apps/monitoring/src/modules/definitions/task/TaskDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/extension/ExtensionDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/function/FunctionDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/mapping/MappingDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/schema/SchemaDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx`
- Modify: `apps/monitoring/src/modules/definitions/view/ViewPreviewTab.tsx`
- Create: `apps/monitoring/src/shared/components/skeletons/DetailPageSkeleton.tsx` (+ `index.ts`)

**Pattern (identical per page, Extension shown; repeat for all six):**

- [ ] **Step 1: DetailPageSkeleton**

`apps/monitoring/src/shared/components/skeletons/DetailPageSkeleton.tsx`:

```tsx
import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

/** Mimics the detail page footprint: header row, tab strip, two cards. */
export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
```

`apps/monitoring/src/shared/components/skeletons/index.ts`:

```ts
export { DetailPageSkeleton } from './DetailPageSkeleton';
```

(Skeletons for lists/dashboard are added in Task 12 and exported from this same index.)

- [ ] **Step 2: Rewire ExtensionDetailPage**

In `ExtensionDetailPage.tsx`:
1. Replace the `overview` tab with a `designer` tab: `TABS = [{ id: 'designer', label: 'Designer' }, { id: 'definition', label: 'Definition' }]`, default `useState<Tab>('designer')`.
2. Delete the local `OverviewContent` component (the detail core replaces it).
3. Imports:

```tsx
import { ExtensionDetailCore } from '@vnext-forge-studio/designer-ui';
import { DetailPageSkeleton } from '@monitoring/shared/components/skeletons';
import { useNavigate } from 'react-router-dom';
```

4. Replace the loading branch (`if (isLoading) return <div …>Loading…</div>`) with:

```tsx
if (isLoading) return <DetailPageSkeleton />;
```

5. Tab body:

```tsx
const navigate = useNavigate();
// FLOW_TO_ROUTE_TYPE: sys-tasks→task, sys-flows→workflow, sys-functions→function,
// sys-views→view, sys-extensions→extension, sys-schemas→schema, sys-mappings→mapping
…
{activeTab === 'designer' && (
  <ExtensionDetailCore
    json={data}
    onNavigateToComponent={(flow, ref) => {
      const routeType = FLOW_TO_ROUTE_TYPE[flow] ?? 'task';
      if (ref.key) void navigate(`/definitions/${routeType}/${ref.key}`);
    }}
  />
)}
{activeTab === 'definition' && <RawJsonViewer data={data} />}
```

Put `FLOW_TO_ROUTE_TYPE` in `apps/monitoring/src/modules/definitions/api/definitions-queries.ts` next to `DEFINITION_TYPE_API_MAP` (it is its inverse) and import it in the pages that need it (extension + function).

- [ ] **Step 3: Repeat for the other five pages**

Same steps with these per-page specifics:

| Page | Core | Tabs after change | Notes |
|---|---|---|---|
| Task | `TaskDetailCore` | designer, definition | drop local `OverviewContent` |
| Function | `FunctionDetailCore` | designer, definition | pass `onNavigateToComponent` like extension |
| Mapping | `MappingDetailCore` | designer, definition, related | drop the old `script` tab (core shows the decoded body); keep `RelatedComponentsList` |
| Schema | `SchemaDetailCore` | designer, definition, test | keep the Ajv `test` tab as-is |
| View | `ViewDetailCore` | designer, definition, preview | preview upgraded in Step 4 |

- [ ] **Step 4: Wire the real view preview**

`ViewPreviewTab.tsx` — replace the placeholder render (L63-81) with the component its own header comment documents, keeping the existing `buildViewResponse` (L30-38):

```tsx
import { PseudoUiViewSurface } from '@vnext-forge-studio/designer-ui/quickrun';
…
export function ViewPreviewTab({ data }: { data: Record<string, unknown> }) {
  const viewResponse = buildViewResponse(data);
  return (
    <div className="border-border min-h-64 rounded-lg border">
      <PseudoUiViewSurface
        viewResponse={viewResponse}
        mode="preview"
        ariaLabel={`View preview: ${viewResponse.key}`}
        fillHeight={false}
      />
    </div>
  );
}
```

- [ ] **Step 5: Monitoring gate + visual verification**

Run: `pnpm --filter @vnext-forge-studio/monitoring test && pnpm --filter @vnext-forge-studio/monitoring build`
Expected: 27 baseline tests PASS; `tsc -b` + vite build green.

Then start the dev server (`.claude/launch.json` name `monitoring`, port 3100; runtime at `localhost:4203` must be up) and verify in the browser, for one component of each of the six types: Designer tab shows the designer-style form, fields are non-editable but selectable, no add/remove/choose buttons anywhere, Definition tab unchanged, View → Preview renders (or shows the surface's own error state for non-pseudo-ui views). Verify browser console has no new errors (the `VITE_MONITORING_DOMAIN` warning is pre-existing).

- [ ] **Step 6: Commit checkpoint** — `feat(monitoring): read-only designer tabs for all six component detail pages`

---

### Task 12: Monitoring — skeleton loading experience

**Files:**
- Create: `apps/monitoring/src/shared/components/skeletons/KpiCardSkeleton.tsx`, `ChartSkeleton.tsx`
- Modify: `apps/monitoring/src/shared/components/skeletons/index.ts`
- Modify: `apps/monitoring/src/shared/components/data-table/DataTable.tsx`
- Modify: `apps/monitoring/src/modules/dashboard/components/ComponentCountsSection.tsx`, `InstanceDistSection.tsx`, `ActivityChart.tsx`, `RecentFaultsSection.tsx`

- [ ] **Step 1: Failing test for DataTable skeleton rows**

Create `apps/monitoring/src/shared/components/data-table/DataTable.vitest.test.tsx`:

```tsx
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DataTable } from './DataTable';

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name' },
  { id: 'status', header: 'Status', accessorKey: 'status' },
];

describe('DataTable loading state', () => {
  it('renders skeleton rows instead of a Loading… text row', () => {
    const html = renderToStaticMarkup(
      h(DataTable, { tableId: 't', columns: columns as never, data: [], isLoading: true }),
    );
    expect(html).not.toContain('Loading…');
    const skeletonCount = (html.match(/data-slot="skeleton"/g) ?? []).length;
    expect(skeletonCount).toBeGreaterThanOrEqual(10); // 5 rows × 2 columns
  });

  it('dims the body while refetching with data present', () => {
    const html = renderToStaticMarkup(
      h(DataTable, {
        tableId: 't', columns: columns as never,
        data: [{ name: 'a', status: 'ok' }] as never, isFetching: true,
      }),
    );
    expect(html).toContain('opacity-60');
  });
});
```

Run: `pnpm --filter @vnext-forge-studio/monitoring exec vitest run src/shared/components/data-table/DataTable.vitest.test.tsx`
Expected: FAIL (skeletons not rendered; no `isFetching` prop)

- [ ] **Step 2: Implement DataTable changes**

In `DataTable.tsx`:

1. Add to props (L19-45 interface): `isFetching?: boolean;` — doc comment: "true while a background refetch runs; body dims but keeps current rows".
2. Replace the `isLoading` branch (L150-159) with skeleton rows:

```tsx
{isLoading ? (
  Array.from({ length: 5 }, (_, rowIdx) => (
    <tr key={`skeleton-${rowIdx}`} className="border-border border-b">
      {table.getVisibleLeafColumns().map((col) => (
        <td key={col.id} className="px-3 py-2.5">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  ))
) : …existing error/empty/data branches…}
```

3. On the `<tbody>` element add: `className={cn(…existing…, isFetching && !isLoading && 'opacity-60 transition-opacity duration-200')}`.
4. Import: `import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';`

- [ ] **Step 3: Run the DataTable test** — expect PASS (2 tests)

- [ ] **Step 4: Dashboard skeletons**

`KpiCardSkeleton.tsx`:

```tsx
import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

/** Footprint-compatible with KpiCard (label + big value). */
export function KpiCardSkeleton() {
  return (
    <div className="border-border rounded-xl border p-4">
      <Skeleton className="mb-3 h-3.5 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
```

`ChartSkeleton.tsx`:

```tsx
import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

export function ChartSkeleton({ heightClass = 'h-120' }: { heightClass?: string }) {
  return (
    <div className={`flex w-full items-end gap-2 ${heightClass}`} aria-busy="true">
      {[40, 65, 50, 80, 60, 90, 70, 55, 75, 45].map((h, i) => (
        <Skeleton key={i} className="w-full" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
```

Add both to `skeletons/index.ts`.

Wire into dashboard sections (each keeps its props; only the loading render changes):
- `ComponentCountsSection.tsx` (L53 currently renders `'—'`): when `isLoading`, render a `KpiCardSkeleton` grid with the same number of cells as the real KPI grid instead of KpiCards with em-dashes.
- `InstanceDistSection.tsx` (L22): same treatment.
- `ActivityChart.tsx` (L87-90 "Loading chart data…"): replace with `<ChartSkeleton />`. (Note: its query is `enabled:false` today so the state rarely shows — change is still correct for when the endpoint is enabled.)
- `RecentFaultsSection.tsx` (L39-42 "Loading…"): replace with 3 skeleton rows shaped like the hand-rolled table rows (one `Skeleton h-4` per column, same column count as the real table).

- [ ] **Step 5: Pass `isFetching` where queries expose it**

In `DefinitionsPage.tsx` (DataTable usage L235-262): add `isFetching={isFetching}` from the `useDefinitionList` query result. Same one-liner in `JobsPage.tsx` (L117-127), `FaultsPage.tsx` (L152-167), `InstanceListPage.tsx` (L187-206) using their existing query objects.

- [ ] **Step 6: Monitoring gate + visual verification**

Run: `pnpm --filter @vnext-forge-studio/monitoring test && pnpm --filter @vnext-forge-studio/monitoring build`
Expected: all tests PASS (27 baseline + 2 new), build green.

Browser check (dev server + runtime): hard-reload the dashboard and a definitions list — skeletons must appear during initial load and match the final layout footprint (no jump); paging through a list must dim rows instead of blanking them.

- [ ] **Step 7: Commit checkpoint** — `feat(monitoring): skeleton loading for dashboard, lists and detail pages`

---

### Task 13: Final verification sweep

- [ ] **Step 1: Full test + build matrix**

```bash
pnpm --filter @vnext-forge-studio/designer-ui test
pnpm --filter @vnext-forge-studio/monitoring test
pnpm build
```

Expected: everything green (346+ / 29+ tests; full monorepo build including extension/web/desktop).

- [ ] **Step 2: Forge regression smoke (production-risk gate)**

Start the forge web shell (`.claude/launch.json` names `server` + `web`, ports 3001/3000) and open one editor of each touched-primitive-using kind (task editor with an HTTP task, extension editor): confirm fields are still editable, KVEditor add/remove buttons present, TagEditor input present — i.e., the default-off context changed nothing.

- [ ] **Step 3: Monitoring end-to-end pass**

With the runtime up, walk all six detail pages + dashboard + one list: designer forms read-only, skeletons on load, no console errors.

- [ ] **Step 4: Update docs**

- `apps/monitoring/docs/CLAUDE.md`: under "designer-ui Integration", add a bullet: detail pages use the shared read-only detail cores (`TaskDetailCore` … `ViewDetailCore`) from the designer-ui barrel inside `FormReadOnlyProvider`; skeletons via `@monitoring/shared/components/skeletons`.
- `README.md` (Monitoring App section): mention the Designer tab briefly in the routes table row for `/definitions/:type/:id`.

- [ ] **Step 5: Final commit checkpoint** — suggest the user commit remaining docs changes and review the branch diff; offer to help draft the PR description.

---

## Self-review results (already applied)

- **Spec coverage:** quiet read-only (Task 2), six cores (Tasks 4-9), barrel exports (Task 10), monitoring tabs + preview wiring (Task 11), full skeleton set + refetch treatment (Task 12), verification gates incl. forge smoke (Tasks 10/13). Out-of-scope items from the spec are not implemented anywhere.
- **Known uncertainty flagged inline:** exact `Field`/`JsonCodeField`/`viewContentHelpers` prop signatures and the live monitor-API payload shapes — each has a "verify while implementing" note and a locally-owned adapter (`normalizeDefinitionDoc`) so fixes stay in one file.
- **Type consistency:** `ComponentRef` defined once in `ComponentRefCard.tsx` and imported everywhere; `normalizeDefinitionDoc(type, raw)` signature consistent across cores; `FormReadOnlyProvider`/`useFormReadOnly` names consistent between Task 2 and all cores.
