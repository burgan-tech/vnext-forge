# Designer Platform Feature Additions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose four new vnext engine capabilities in the vnext-forge designer — three new task types, function read-through cache, workflow/transition events, and schema data-vocab annotations.

**Architecture:** One shared UI primitive (`DynamicExpressoField`) built first, then four independent workstreams touching disjoint modules so they parallelize across subagents. Editors are driven by untyped `Record<string, unknown>` JSON + Zod; vnext-types edits are additive and load-bearing only.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest (`renderToStaticMarkup` SSR assertions — **no** React Testing Library), pnpm workspaces + Turborepo.

**Spec:** [docs/superpowers/specs/2026-07-26-designer-platform-features-design.md](../specs/2026-07-26-designer-platform-features-design.md)

---

## Conventions (read once before any task)

- **Task form prop contract:** `{ config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void }`.
- **Normalize-empty:** every write collapses empty/absent values to `undefined` so they drop out of JSON (`d.x = e.target.value || undefined`). Numbers guard with `Number.isFinite`. Arrays/maps collapse to `undefined` when empty.
- **Test pattern:** colocated `*.vitest.test.ts(x)`; `renderToStaticMarkup(createElement(Component, props))` then `expect(html).toContain(...)`. No DOM, no user-event.
- **Package build/test commands** (run from repo root):
  - Typecheck designer-ui: `pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit`
  - Typecheck vnext-types: `pnpm --filter @vnext-forge-studio/vnext-types exec tsc --noEmit`
  - Vitest (single file): `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run <path>`
  - Web build (parity gate): `pnpm --filter @vnext-forge-studio/web build`
- **Gates:** `tsc` + the touched Vitest files + build. Per-package `eslint .` is pre-existing red repo-wide — do not treat it as a gate; lint only touched files.
- **Do not** re-do the in-progress working-tree changes (State Store task 17, `WorkflowOutputSection`) — they are prior-art templates.

---

## Phase 0 — Shared primitive: `DynamicExpressoField`

**Files:**
- Create: `packages/designer-ui/src/ui/DynamicExpressoField.tsx`
- Modify: `packages/designer-ui/src/ui/index.ts`
- Test: `packages/designer-ui/src/ui/DynamicExpressoField.vitest.test.tsx`

### Task 0.1: Build the primitive

- [ ] **Step 1: Write the failing test** — `packages/designer-ui/src/ui/DynamicExpressoField.vitest.test.tsx`

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DynamicExpressoField } from './DynamicExpressoField.js';

describe('DynamicExpressoField', () => {
  it('renders the label, hint and current expression code', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicExpressoField, {
        label: 'Key Expression',
        hint: 'Dynamic Expresso expression.',
        value: { location: 'dynamicExpresso', code: 'a + b', encoding: 'NAT' },
        onChange: () => {},
      }),
    );
    expect(html).toContain('Key Expression');
    expect(html).toContain('Dynamic Expresso expression.');
    expect(html).toContain('a + b');
  });

  it('renders an empty textarea when value is undefined', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicExpressoField, { label: 'Key Expression', value: undefined, onChange: () => {} }),
    );
    expect(html).toContain('Key Expression');
    expect(html).toContain('data-slot="textarea"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/DynamicExpressoField.vitest.test.tsx`
Expected: FAIL — cannot resolve `./DynamicExpressoField.js`.

- [ ] **Step 3: Write the implementation** — `packages/designer-ui/src/ui/DynamicExpressoField.tsx`

```tsx
import { Field } from './Field';
import { Textarea } from './Textarea';

/** A ScriptCode carrying an inline Dynamic Expresso expression. */
export interface DynamicExpressoValue {
  location: 'dynamicExpresso';
  code: string;
  encoding?: 'B64' | 'NAT' | 'REF';
}

interface DynamicExpressoFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  value: DynamicExpressoValue | undefined;
  onChange: (next: DynamicExpressoValue | undefined) => void;
}

/**
 * Edits a lightweight inline Dynamic Expresso expression stored as a ScriptCode
 * of shape { location: 'dynamicExpresso', code, encoding: 'NAT' }. An empty
 * expression collapses the whole value to undefined so it drops out of the JSON.
 */
export function DynamicExpressoField({
  label,
  hint,
  required,
  placeholder,
  value,
  onChange,
}: DynamicExpressoFieldProps) {
  return (
    <Field label={label} hint={hint} required={required}>
      <Textarea
        value={value?.code ?? ''}
        onChange={(e) => {
          const code = e.target.value;
          onChange(code ? { location: 'dynamicExpresso', code, encoding: 'NAT' } : undefined);
        }}
        placeholder={placeholder ?? 'e.g. "customer:" + context.Headers.customerId'}
        className="min-h-16 font-mono text-xs"
      />
    </Field>
  );
}
```

- [ ] **Step 4: Export it** — add to `packages/designer-ui/src/ui/index.ts` (alongside the other primitive exports):

```ts
export { DynamicExpressoField } from './DynamicExpressoField';
export type { DynamicExpressoValue } from './DynamicExpressoField';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/ui/DynamicExpressoField.vitest.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/ui/DynamicExpressoField.tsx packages/designer-ui/src/ui/DynamicExpressoField.vitest.test.tsx packages/designer-ui/src/ui/index.ts
git commit -m "feat(designer-ui): add DynamicExpressoField inline-expression primitive"
```

---

## Phase 1 (WS1) — Three new task types

Enum values: **CacheAside = 18, GetInstance = 19, DaprConversation = 20**. Reference template for wiring: State Store (17).

### Task 1.1: Enum + config interfaces (vnext-types)

**Files:**
- Modify: `packages/vnext-types/src/constants/task-types.ts:18`
- Modify: `packages/vnext-types/src/types/task.ts` (append new interfaces)

- [ ] **Step 1: Extend the enum** — `task-types.ts`, replace the closing of the enum:

```ts
  Soap = 16,
  StateStore = 17,
  CacheAside = 18,
  GetInstance = 19,
  DaprConversation = 20,
}
```

- [ ] **Step 2: Append config interfaces** to `packages/vnext-types/src/types/task.ts` (end of file):

```ts
export interface TaskReference {
  key: string;
  domain: string;
  /** Defaults to "sys-tasks" when omitted */
  flow?: string;
  version: string;
}

/** ScriptCode shape as authored inline in task configs. */
export interface TaskScriptCode {
  type?: 'G' | 'L';
  location?: string;
  code?: string;
  encoding?: 'B64' | 'NAT' | 'REF';
}

export interface CacheAsideTaskConfig {
  /** Static cache key (optional; may be derived via keyExpression) */
  key?: string;
  /** Dapr state store name. Empty → runtime DAPR_STATE_STORE_NAME */
  storeName?: string;
  /** TTL seconds; absent or 0 → no expiry */
  ttlInSeconds?: number;
  consistency?: 'Eventual' | 'Strong';
  /** Task executed on a cache miss (required) */
  sourceTask: TaskReference;
  /** Mapping applied to the raw source result before caching/returning */
  sourceMapping?: TaskScriptCode;
  /** Dynamic Expresso expression overriding the cache key at runtime */
  keyExpression?: TaskScriptCode;
  /** Default: true */
  bypassOnCacheError?: boolean;
  /** Default: false */
  forceRefresh?: boolean;
}

export interface GetInstanceTaskConfig {
  /** Target workflow domain (required) */
  domain: string;
  /** Target workflow name (required) */
  flow: string;
  key?: string;
  /** GUID */
  instanceId?: string;
  extensions?: string[];
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  acceptedStatusCodes?: string[];
}

export interface DaprConversationTaskConfig {
  /** Dapr conversation component name, e.g. "openai" (required) */
  componentName: string;
  /** Conversation inputs — JSON array of role/content messages */
  inputs?: unknown;
  /** Provider-specific string parameters (model, maxTokens, …) */
  parameters?: Record<string, string>;
  /** Dapr component metadata */
  metadata?: Record<string, string>;
  contextId?: string;
  temperature?: number;
  scrubPII?: boolean;
  /** Default: 30 */
  timeoutSeconds?: number;
}
```

- [ ] **Step 3: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/vnext-types exec tsc --noEmit
git add packages/vnext-types/src/constants/task-types.ts packages/vnext-types/src/types/task.ts
git commit -m "feat(vnext-types): task enum + configs for CacheAside/GetInstance/DaprConversation"
```

### Task 1.2: GetInstance (19) form + registration

**Files:**
- Create: `packages/designer-ui/src/modules/task-editor/forms/GetInstanceTaskForm.tsx`
- Modify: `forms/index.ts`, `components/TaskTypePicker.tsx`, `TaskEditorPanel.tsx`, `TaskEditorPanel.vitest.test.ts`

- [ ] **Step 1: Write the failing panel test** — add to `TaskEditorPanel.vitest.test.ts` inside the `describe`:

```ts
  it('renders a configuration form for Get Instance tasks', () => {
    const html = renderTaskEditorPanel('19');
    expect(html).toContain('Get Instance task settings.');
    expect(html).toContain('Target Workflow');
    expect(html).toContain('Extensions');
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: FAIL — `'Get Instance task settings.'` not found (falls to "No form available").

- [ ] **Step 3: Create the form** — `forms/GetInstanceTaskForm.tsx` (GetInstance uses `domain`/`flow` config keys, so `WorkflowRefFields` fits directly; it adds `useDapr` via `HttpSettingsFields` plus a Dapr toggle):

```tsx
import { useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { TagEditor } from '../../../ui/TagEditor';
import { useProjectStore } from '../../../store/useProjectStore';
import {
  ChooseExistingVnextComponentDialog,
  ChooseFromExistingVnextComponentButton,
} from '../../canvas-interaction/components/panels/tabs/ChooseExistingTaskDialog';
import { HttpSettingsFields, WorkflowRefFields } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function GetInstanceTaskForm({ config, onChange }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const [extPickerOpen, setExtPickerOpen] = useState(false);

  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);
  const extensions = (config.extensions as string[]) || [];

  function handleExtensionSelected(component: DiscoveredVnextComponent) {
    if (!component.key || extensions.includes(component.key)) return;
    onChange((d: any) => {
      const current = (d.extensions as string[]) || [];
      d.extensions = [...current, component.key];
    });
  }

  return (
    <div className="space-y-3">
      <WorkflowRefFields config={config} onChange={onChange} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Key">
          <Input type="text" value={String(config.key || '')}
            onChange={(e) => onChange((d: any) => { d.key = e.target.value || undefined; })}
            placeholder="Required if Instance ID is empty" size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Instance ID">
          <Input type="text" value={String(config.instanceId || '')}
            onChange={(e) => onChange((d: any) => { d.instanceId = e.target.value || undefined; })}
            placeholder="Required if Key is empty" size="sm" inputClassName="font-mono text-xs" />
        </Field>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-primary-text/75">Extensions</span>
          <ChooseFromExistingVnextComponentButton
            category="extensions"
            onClick={() => setExtPickerOpen(true)}
            disabled={!canPickExisting}
            label="Choose existing extension"
            title={canPickExisting ? 'Pick an extension from workspace JSON files' : 'Requires an open project and vnext.config.json with paths'}
          />
        </div>
        <TagEditor
          tags={extensions}
          onChange={(tags) => onChange((d: any) => { d.extensions = tags.length > 0 ? tags : undefined; })}
          placeholder="Add extension"
        />
      </div>
      <Field label="Use Dapr">
        <Select
          value={config.useDapr === true ? 'true' : 'false'}
          onChange={(e) => onChange((d: any) => { d.useDapr = e.target.value === 'true' ? true : undefined; })}
          className="text-xs">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
      </Field>
      <HttpSettingsFields config={config} onChange={onChange} />
      <ChooseExistingVnextComponentDialog
        open={extPickerOpen}
        onOpenChange={setExtPickerOpen}
        category="extensions"
        onSelect={handleExtensionSelected}
        title="Choose an extension"
        description="Select an extension JSON from your workspace paths to add to the extensions list."
      />
    </div>
  );
}
```

- [ ] **Step 4: Register** — three edits:

`forms/index.ts` — add import after the StateStore import and a map entry:
```ts
import { GetInstanceTaskForm } from './GetInstanceTaskForm';
```
```ts
  '17': StateStoreTaskForm,
  '19': GetInstanceTaskForm,
```

`components/TaskTypePicker.tsx` — add to `TASK_TYPES` after the `'17'` entry:
```ts
  { value: '19', label: 'Get Instance', desc: 'Read full instance projection' },
```

`TaskEditorPanel.tsx` — add to the `names` map after `'17'`:
```ts
    '19': 'Get Instance',
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: PASS including the new Get Instance test.

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/modules/task-editor/forms/GetInstanceTaskForm.tsx packages/designer-ui/src/modules/task-editor/forms/index.ts packages/designer-ui/src/modules/task-editor/components/TaskTypePicker.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.vitest.test.ts
git commit -m "feat(task-editor): Get Instance (19) task form"
```

### Task 1.3: CacheAside (18) form + registration

**Files:**
- Create: `packages/designer-ui/src/modules/task-editor/forms/CacheAsideTaskForm.tsx`
- Modify: `forms/index.ts`, `components/TaskTypePicker.tsx`, `TaskEditorPanel.tsx`, `TaskEditorPanel.vitest.test.ts`

- [ ] **Step 1: Write the failing panel test** — add to `TaskEditorPanel.vitest.test.ts`:

```ts
  it('renders a configuration form for Cache Aside tasks', () => {
    const html = renderTaskEditorPanel('18');
    expect(html).toContain('Cache Aside task settings.');
    expect(html).toContain('Source Task');
    expect(html).toContain('Key Expression');
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: FAIL — `'Cache Aside task settings.'` not found.

- [ ] **Step 3: Create the form** — `forms/CacheAsideTaskForm.tsx`. The `sourceTask` reference is a nested object (`key/domain/flow/version`); it is edited via plain inputs. `sourceMapping` reuses `CsxEditorField`; `keyExpression` uses the Phase 0 primitive.

```tsx
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Checkbox } from '../../../ui/Checkbox';
import { DynamicExpressoField, type DynamicExpressoValue } from '../../../ui/DynamicExpressoField';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function CacheAsideTaskForm({ config, onChange }: Props) {
  const sourceTask = (config.sourceTask as Record<string, unknown> | undefined) ?? {};
  const setSource = (field: string, value: string) =>
    onChange((d: any) => {
      const s = (d.sourceTask as Record<string, unknown>) ?? {};
      s[field] = value || undefined;
      d.sourceTask = s;
    });

  return (
    <div className="space-y-3">
      <Field label="Cache Key" hint="Static key. Optional — may be derived by the key expression below.">
        <Input type="text" value={String(config.key || '')}
          onChange={(e) => onChange((d: any) => { d.key = e.target.value || undefined; })}
          size="sm" inputClassName="font-mono text-xs" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Store Name" hint="Empty → runtime DAPR_STATE_STORE_NAME.">
          <Input type="text" value={String(config.storeName || '')}
            onChange={(e) => onChange((d: any) => { d.storeName = e.target.value || undefined; })}
            size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <Field label="TTL (seconds)" hint="Absent or 0 → no expiry.">
          <Input type="number" min={0}
            value={config.ttlInSeconds == null ? '' : Number(config.ttlInSeconds)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.ttlInSeconds = e.target.value !== '' && Number.isFinite(n) && n >= 0 ? n : undefined; });
            }}
            size="sm" inputClassName="text-xs" />
        </Field>
      </div>

      <Field label="Consistency">
        <Select value={String(config.consistency || '')}
          onChange={(e) => onChange((d: any) => { d.consistency = e.target.value || undefined; })}
          className="text-xs">
          <option value="">Default</option>
          <option value="Eventual">Eventual</option>
          <option value="Strong">Strong</option>
        </Select>
      </Field>

      <div className="rounded-md border border-border p-3 space-y-2">
        <span className="text-xs font-semibold text-primary-text/75">Source Task</span>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" required>
            <Input type="text" value={String(sourceTask.key || '')}
              onChange={(e) => setSource('key', e.target.value)} size="sm" inputClassName="font-mono text-xs" />
          </Field>
          <Field label="Domain" required>
            <Input type="text" value={String(sourceTask.domain || '')}
              onChange={(e) => setSource('domain', e.target.value)} size="sm" inputClassName="font-mono text-xs" />
          </Field>
          <Field label="Flow" hint="Defaults to sys-tasks.">
            <Input type="text" value={String(sourceTask.flow || '')}
              onChange={(e) => setSource('flow', e.target.value)} placeholder="sys-tasks" size="sm" inputClassName="font-mono text-xs" />
          </Field>
          <Field label="Version" required>
            <Input type="text" value={String(sourceTask.version || '')}
              onChange={(e) => setSource('version', e.target.value)} size="sm" inputClassName="font-mono text-xs" />
          </Field>
        </div>
      </div>

      <Field label="Source Mapping" hint="Optional mapping applied to the raw source result before caching.">
        <CsxEditorField
          value={(config.sourceMapping as ScriptCode | undefined) ?? null}
          onChange={(next) => onChange((d: any) => { d.sourceMapping = next ?? undefined; })}
          onRemove={() => onChange((d: any) => { d.sourceMapping = undefined; })}
          templateType="mapping"
          contextName="cacheaside-source-mapping"
          label="Source Mapping"
        />
      </Field>

      <DynamicExpressoField
        label="Key Expression"
        hint="Optional Dynamic Expresso expression whose string result overrides the cache key."
        value={config.keyExpression as DynamicExpressoValue | undefined}
        onChange={(next) => onChange((d: any) => { d.keyExpression = next; })}
      />

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.bypassOnCacheError !== false}
          onCheckedChange={(v) => onChange((d: any) => { d.bypassOnCacheError = v ? undefined : false; })}
        />
        Bypass on cache error (fall back to the source task)
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.forceRefresh === true}
          onCheckedChange={(v) => onChange((d: any) => { d.forceRefresh = v ? true : undefined; })}
        />
        Force refresh (always run source, overwrite cache)
      </label>
    </div>
  );
}
```

> **Note for the implementer:** verify `Checkbox`'s prop name in `packages/designer-ui/src/ui/Checkbox.tsx` (this repo uses `onCheckedChange`, matching `FunctionTaskModeSection`'s `rawResponse` usage). If the actual prop differs, match the existing usage. Confirm `CsxEditorField`'s named export of `ScriptCode` at `packages/designer-ui/src/modules/save-component/components/CsxEditorField.tsx`.

- [ ] **Step 4: Register** — `forms/index.ts` import + `'18': CacheAsideTaskForm`; `TaskTypePicker.tsx` `{ value: '18', label: 'Cache Aside', desc: 'Read-through cache pattern' }`; `TaskEditorPanel.tsx` names `'18': 'Cache Aside'`.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/modules/task-editor/forms/CacheAsideTaskForm.tsx packages/designer-ui/src/modules/task-editor/forms/index.ts packages/designer-ui/src/modules/task-editor/components/TaskTypePicker.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.vitest.test.ts
git commit -m "feat(task-editor): Cache Aside (18) task form"
```

### Task 1.4: DaprConversation (20) form + registration

**Files:**
- Create: `packages/designer-ui/src/modules/task-editor/forms/DaprConversationTaskForm.tsx`
- Modify: `forms/index.ts`, `components/TaskTypePicker.tsx`, `TaskEditorPanel.tsx`, `TaskEditorPanel.vitest.test.ts`

- [ ] **Step 1: Write the failing panel test** — add to `TaskEditorPanel.vitest.test.ts`:

```ts
  it('renders a configuration form for Dapr Conversation tasks', () => {
    const html = renderTaskEditorPanel('20');
    expect(html).toContain('Dapr Conversation task settings.');
    expect(html).toContain('Component Name');
    expect(html).toContain('Inputs (JSON)');
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: FAIL — `'Dapr Conversation task settings.'` not found.

- [ ] **Step 3: Create the form** — `forms/DaprConversationTaskForm.tsx`:

```tsx
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { Checkbox } from '../../../ui/Checkbox';
import { BodyJsonField } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

function toPairs(v: unknown) {
  const map = v as Record<string, string> | undefined;
  return map ? Object.entries(map).map(([key, value]) => ({ key, value: String(value) })) : [];
}

export function DaprConversationTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Component Name" required hint="Configured LLM provider, e.g. openai.">
          <Input type="text" value={String(config.componentName || '')}
            onChange={(e) => onChange((d: any) => { d.componentName = e.target.value || undefined; })}
            placeholder="openai" size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Context ID" hint="Optional, continues a stateful conversation.">
          <Input type="text" value={String(config.contextId || '')}
            onChange={(e) => onChange((d: any) => { d.contextId = e.target.value || undefined; })}
            size="sm" inputClassName="font-mono text-xs" />
        </Field>
      </div>

      <BodyJsonField
        label="Inputs (JSON)"
        value={config.inputs}
        configKey="inputs"
        onChange={onChange}
      />

      <Field label="Parameters" hint="Provider-specific string parameters (model, maxTokens, …).">
        <KVEditor pairs={toPairs(config.parameters)}
          onChange={(pairs) => onChange((d: any) => {
            d.parameters = pairs.length > 0 ? Object.fromEntries(pairs.map((p) => [p.key, p.value])) : undefined;
          })} />
      </Field>

      <Field label="Metadata" hint="Dapr component metadata.">
        <KVEditor pairs={toPairs(config.metadata)}
          onChange={(pairs) => onChange((d: any) => {
            d.metadata = pairs.length > 0 ? Object.fromEntries(pairs.map((p) => [p.key, p.value])) : undefined;
          })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature" hint="Optional sampling temperature.">
          <Input type="number" step="0.1"
            value={config.temperature == null ? '' : Number(config.temperature)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.temperature = e.target.value !== '' && Number.isFinite(n) ? n : undefined; });
            }}
            size="sm" inputClassName="text-xs" />
        </Field>
        <Field label="Timeout (seconds)">
          <Input type="number" min={1} value={Number(config.timeoutSeconds ?? 30)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.timeoutSeconds = Number.isFinite(n) ? n : undefined; });
            }}
            size="sm" inputClassName="text-xs" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.scrubPII === true}
          onCheckedChange={(v) => onChange((d: any) => { d.scrubPII = v ? true : undefined; })}
        />
        Scrub PII from prompts and responses
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register** — `forms/index.ts` import + `'20': DaprConversationTaskForm`; `TaskTypePicker.tsx` `{ value: '20', label: 'Dapr Conversation', desc: 'Invoke an LLM via Dapr' }`; `TaskEditorPanel.tsx` names `'20': 'Dapr Conversation'`.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/task-editor/TaskEditorPanel.vitest.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/modules/task-editor/forms/DaprConversationTaskForm.tsx packages/designer-ui/src/modules/task-editor/forms/index.ts packages/designer-ui/src/modules/task-editor/components/TaskTypePicker.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.tsx packages/designer-ui/src/modules/task-editor/TaskEditorPanel.vitest.test.ts
git commit -m "feat(task-editor): Dapr Conversation (20) task form"
```

### Task 1.5: doc-gen labels

**Files:** Modify `packages/doc-gen/src/generators/task-doc.ts:47`

- [ ] **Step 1: Add three labels** to `TASK_TYPE_LABELS` after `'17'`:

```ts
  '17': 'State Store Task',
  '18': 'Cache Aside Task',
  '19': 'Get Instance Task',
  '20': 'Dapr Conversation Task',
};
```

- [ ] **Step 2: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/doc-gen exec tsc --noEmit
git add packages/doc-gen/src/generators/task-doc.ts
git commit -m "feat(doc-gen): labels for task types 18-20"
```

### Task 1.6: vnext-schema — DaprConversation type 20 (separate repo)

**Repo:** `/Users/U0B006/Documents/repos/burgan-tech/vnext-schema` (branch `feat/schema-tasks-events-cache-datavocab`).
**File:** `schemas/task-definition.schema.json`

- [ ] **Step 1: Extend the type enum** — in `attributes.properties.type.enum` add `"20"`, and append to `enumDescriptions` the string `"Dapr Conversation Task"` (keep positional alignment — it becomes the 20th entry).

- [ ] **Step 2: Append a per-type block** — add a new object to the `attributes.allOf` array, mirroring the type-17 block shape:

```json
{
  "if": { "properties": { "type": { "const": "20" } } },
  "then": {
    "title": "Dapr Conversation Task",
    "properties": {
      "type": { "const": "20" },
      "config": {
        "type": "object",
        "description": "Dapr Conversation Task configuration - Invokes an LLM/AI provider through the Dapr Conversation building block.",
        "properties": {
          "componentName": { "type": "string", "description": "Dapr conversation component name (LLM provider), e.g. openai", "minLength": 1 },
          "inputs": { "type": "array", "description": "Conversation inputs as an array of role/content messages" },
          "parameters": { "type": "object", "description": "Provider-specific string parameters (model, maxTokens, …)" },
          "metadata": { "type": "object", "description": "Dapr component metadata forwarded with the request" },
          "contextId": { "type": "string", "description": "Optional context identifier to continue a stateful conversation" },
          "temperature": { "type": "number", "description": "Optional sampling temperature" },
          "scrubPII": { "type": "boolean", "description": "When true, requests the provider scrub PII from prompts and responses" },
          "timeoutSeconds": { "type": "integer", "minimum": 1, "default": 30, "description": "Timeout in seconds" }
        },
        "required": ["componentName"],
        "additionalProperties": false
      }
    },
    "required": ["type", "config"],
    "additionalProperties": false
  }
}
```

- [ ] **Step 3: Validate JSON & commit** (in the vnext-schema repo):

```bash
cd /Users/U0B006/Documents/repos/burgan-tech/vnext-schema
node -e "JSON.parse(require('fs').readFileSync('schemas/task-definition.schema.json','utf8')); console.log('valid json')"
npm test 2>/dev/null || echo "no test script — JSON parse gate only"
git add schemas/task-definition.schema.json
git commit -m "feat(schema): add DaprConversation task type (20)"
```

---

## Phase 2 (WS2) — Function cache

**Files:**
- Create: `packages/designer-ui/src/modules/function-editor/components/FunctionCacheSection.tsx`
- Create: `packages/designer-ui/src/modules/function-editor/components/FunctionCacheSection.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/function-editor/components/FunctionEditorPanel.tsx`
- Modify: `packages/designer-ui/src/modules/function-editor/FunctionEditorSchema.ts` (Zod passthrough for `attributes.cache`)

> **Implementer prerequisite:** read `FunctionEditorPanel.tsx` (section host, ~50 lines), `FunctionTaskModeSection.tsx` (draft-mutation + delete-key-on-default pattern for `rawResponse`), and `FunctionEditorSchema.ts` before starting.

### Task 2.1: FunctionCacheSection component

- [ ] **Step 1: Write the failing test** — `FunctionCacheSection.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunctionCacheSection } from './FunctionCacheSection.js';

describe('FunctionCacheSection', () => {
  it('renders cache fields from attributes.cache', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionCacheSection, {
        json: { attributes: { cache: { storeName: 'statestore', ttlInSeconds: 60 } } },
        onChange: () => {},
      }),
    );
    expect(html).toContain('Cache');
    expect(html).toContain('Store Name');
    expect(html).toContain('Key Expression');
    expect(html).toContain('Vary By Headers');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor/components/FunctionCacheSection.vitest.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `FunctionCacheSection.tsx`. Props mirror other function sections: `{ json: Record<string, unknown>; onChange: (u:(draft:any)=>void)=>void }`. Reads `json.attributes.cache`. Uses the collapsible `ui/Section`. Fields: key/storeName/generationKey (`Input`), ttlInSeconds (numeric min 1), consistency (`Select` Eventual/Strong), bypassOnCacheError (`Checkbox`, default true → write `undefined` when true / `false` when unchecked), varyByHeaders + varyByHeaderPrefixes (`TagEditor`), keyExpression + generationKeyExpression (`DynamicExpressoField`).

```tsx
import { Section } from '../../../ui/Section';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Checkbox } from '../../../ui/Checkbox';
import { TagEditor } from '../../../ui/TagEditor';
import { DynamicExpressoField, type DynamicExpressoValue } from '../../../ui/DynamicExpressoField';

interface Props { json: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

function mutateCache(onChange: Props['onChange'], fn: (cache: Record<string, unknown>) => void) {
  onChange((draft: any) => {
    const a = (draft.attributes ?? {}) as Record<string, unknown>;
    const cache = (a.cache ?? {}) as Record<string, unknown>;
    fn(cache);
    const hasAny = Object.values(cache).some((v) => v !== undefined);
    a.cache = hasAny ? cache : undefined;
    draft.attributes = a;
  });
}

export function FunctionCacheSection({ json, onChange }: Props) {
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const cache = (attrs.cache ?? {}) as Record<string, unknown>;

  return (
    <Section title="Cache" description="Optional read-through cache for this function." collapsible defaultOpen={!!attrs.cache}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" hint="Static cache key (used when no key expression).">
            <Input type="text" value={String(cache.key || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.key = e.target.value || undefined; })}
              size="sm" inputClassName="font-mono text-xs" />
          </Field>
          <Field label="Store Name" hint="Empty → runtime DAPR_STATE_STORE_NAME.">
            <Input type="text" value={String(cache.storeName || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.storeName = e.target.value || undefined; })}
              size="sm" inputClassName="font-mono text-xs" />
          </Field>
        </div>

        <DynamicExpressoField label="Key Expression"
          hint="Dynamic Expresso expression computing the cache key. Takes precedence over Key."
          value={cache.keyExpression as DynamicExpressoValue | undefined}
          onChange={(next) => mutateCache(onChange, (c) => { c.keyExpression = next; })} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="TTL (seconds)" hint="Null / non-positive → no expiry.">
            <Input type="number" min={1}
              value={cache.ttlInSeconds == null ? '' : Number(cache.ttlInSeconds)}
              onChange={(e) => {
                const n = Number(e.target.value);
                mutateCache(onChange, (c) => { c.ttlInSeconds = e.target.value !== '' && Number.isFinite(n) && n >= 1 ? n : undefined; });
              }}
              size="sm" inputClassName="text-xs" />
          </Field>
          <Field label="Consistency">
            <Select value={String(cache.consistency || '')}
              onChange={(e) => mutateCache(onChange, (c) => { c.consistency = e.target.value || undefined; })}
              className="text-xs">
              <option value="">Default</option>
              <option value="Eventual">Eventual</option>
              <option value="Strong">Strong</option>
            </Select>
          </Field>
        </div>

        <Field label="Vary By Headers" hint="Exact request-header names that vary the cached result.">
          <TagEditor tags={(cache.varyByHeaders as string[] | undefined) ?? []}
            onChange={(tags) => mutateCache(onChange, (c) => { c.varyByHeaders = tags.length > 0 ? tags : undefined; })}
            placeholder="Add header name" />
        </Field>
        <Field label="Vary By Header Prefixes" hint="Request-header name prefixes that vary the result.">
          <TagEditor tags={(cache.varyByHeaderPrefixes as string[] | undefined) ?? []}
            onChange={(tags) => mutateCache(onChange, (c) => { c.varyByHeaderPrefixes = tags.length > 0 ? tags : undefined; })}
            placeholder="Add header prefix" />
        </Field>

        <Field label="Generation Key" hint="State key holding the cache generation stamp (namespace invalidation).">
          <Input type="text" value={String(cache.generationKey || '')}
            onChange={(e) => mutateCache(onChange, (c) => { c.generationKey = e.target.value || undefined; })}
            size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <DynamicExpressoField label="Generation Key Expression"
          hint="Dynamic Expresso expression resolving the generation-stamp state key. Takes precedence over Generation Key."
          value={cache.generationKeyExpression as DynamicExpressoValue | undefined}
          onChange={(next) => mutateCache(onChange, (c) => { c.generationKeyExpression = next; })} />

        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={cache.bypassOnCacheError !== false}
            onCheckedChange={(v) => mutateCache(onChange, (c) => { c.bypassOnCacheError = v ? undefined : false; })} />
          Bypass on cache error (fall back to executing the function)
        </label>
      </div>
    </Section>
  );
}
```

> **Implementer note:** confirm `Section`'s prop names (`title`, `description`, `collapsible`, `defaultOpen`) against `packages/designer-ui/src/ui/Section.tsx:139` and `Checkbox`'s `onCheckedChange` against `Checkbox.tsx`. Adjust to match the actual signatures.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor/components/FunctionCacheSection.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the panel** — in `FunctionEditorPanel.tsx`, import `FunctionCacheSection` and render it after the "Task Execution" card, passing the same `json`/`onChange` the other sections receive. Follow the file's existing Card/Section composition (read it first to match how `json`/`onChange` are threaded).

- [ ] **Step 6: Extend the Zod schema** — in `FunctionEditorSchema.ts`, ensure `attributes.cache` is allowed to round-trip (add an optional `cache` object to the attributes schema, or confirm the schema already uses `.passthrough()`; if it strips unknown keys, add a permissive `cache: z.record(z.unknown()).optional()` on the attributes shape). Verify by loading a function JSON with a `cache` block and confirming it is not dropped on save.

- [ ] **Step 7: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/modules/function-editor/
git commit -m "feat(function-editor): read-through cache section"
```

---

## Phase 3 (WS3) — Events

### Task 3.1: vnext-types Event type + fields

**Files:**
- Create: `packages/vnext-types/src/types/event.ts`
- Modify: `packages/vnext-types/src/types/workflow.ts` (add `event?` to `WorkflowAttributes`), `packages/vnext-types/src/types/state.ts` (add `event?` to `Transition`), and the package barrel (`packages/vnext-types/src/index.ts` or `types/index.ts`) to export `Event`.

- [ ] **Step 1: Create the type** — `event.ts`:

```ts
import type { MappingCode } from './mapping';

/**
 * Declares how an inbound external event is mapped before it acts on a workflow.
 * Present at workflow level (attributes.event, action=start) and transition level
 * (transition.event, action=transition; required when triggerType is Event).
 */
export interface Event {
  /** Mapping script (implements IEventMapping) turning the raw payload into InstanceKey + Body. */
  mapping: MappingCode;
}
```

- [ ] **Step 2: Add the fields** — in `workflow.ts` `WorkflowAttributes`, add near `output`:

```ts
  event?: Event;
```
and import `Event` at the top. In `state.ts` `Transition`, add:
```ts
  event?: Event;
```
and import `Event`. Export `Event` from the types barrel next to the other type exports.

- [ ] **Step 3: Typecheck & commit**

```bash
pnpm --filter @vnext-forge-studio/vnext-types exec tsc --noEmit
git add packages/vnext-types/src/types/event.ts packages/vnext-types/src/types/workflow.ts packages/vnext-types/src/types/state.ts packages/vnext-types/src/index.ts packages/vnext-types/src/types/index.ts
git commit -m "feat(vnext-types): Event type on workflow + transition"
```

### Task 3.2: Workflow-level event section

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowEventSection.tsx`
- Modify: `WorkflowMetadataPanel.tsx`, `packages/designer-ui/src/modules/flow-editor/FlowEditorApi.ts`

> **Implementer prerequisite:** open `sections/WorkflowOutputSection.tsx` — this section is a direct structural clone of it, differing only in the JSON path (`attributes.event.mapping` vs `attributes.output`) and labels.

- [ ] **Step 1: Create `WorkflowEventSection.tsx`** — clone `WorkflowOutputSection.tsx` with these differences:
  - Read `attrs.event?.mapping` (not `attrs.output`).
  - `updateEvent`/`removeEvent`/`updateEventScripts` mutate `draft.attributes.event.mapping` and `draft.attributes.event.mapping.scripts` (create the `event` holder object when absent; delete `event` entirely on remove).
  - `MetadataSection title="Event"`, description "External event that starts a new instance (action=start).", `defaultOpen={!!eventMapping}`.
  - `CsxEditorField` props: `templateType="mapping"`, `contextName="workflow-event"`, `label="Event Mapping"`, `stateKey={WORKFLOW_LEVEL_STATE_KEY}`, `listField="event"`, `index={0}`, `scriptField="mapping"`.

- [ ] **Step 2: Register in the panel** — in `WorkflowMetadataPanel.tsx`, import `WorkflowEventSection` and add after the output section:

```tsx
        <div id="wf-section-event"><WorkflowEventSection /></div>
```

- [ ] **Step 3: Collect the script** — in `FlowEditorApi.ts` `extractScripts`, next to `collect(attrs.output);` add:

```ts
    collect((attrs.event as { mapping?: unknown } | undefined)?.mapping);
```

- [ ] **Step 4: Verify build & commit** — there is no dedicated section test; the gate is typecheck + build (the section renders through the store, which the SSR test harness does not seed).

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
pnpm --filter @vnext-forge-studio/web build
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowEventSection.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/WorkflowMetadataPanel.tsx packages/designer-ui/src/modules/flow-editor/FlowEditorApi.ts
git commit -m "feat(canvas): workflow-level event mapping section"
```

### Task 3.3: Transition-level event

**Files:**
- Modify: `tabs/transition/transitionFieldPolicy.ts`, `tabs/transition/useTransitionMutations.ts`, `tabs/transition/TransitionCard.tsx`, `TransitionPropertyPanel.tsx`
- Create: `tabs/transition/TransitionEventSection.tsx`
(all under `packages/designer-ui/src/modules/canvas-interaction/components/panels/`)

> **Implementer prerequisite:** open `tabs/transition/TransitionMappingSection.tsx` (the ~54-line template), `transitionFieldPolicy.ts` (the `TransitionFieldKey` union + per-trigger policy objects), `useTransitionMutations.ts:112-142` (the mapping mutations), and the two `TransitionCard` call sites in `TransitionPropertyPanel.tsx`.

- [ ] **Step 1: Field policy** — in `transitionFieldPolicy.ts`: add `'event'` to the `TransitionFieldKey` union; in the `TriggerType.Event` branch of `stateTransitionPolicy` and `sharedTransitionPolicy`, set `event: VISIBLE_REQUIRED` (use whatever the file's existing "visible + required" constant is); set `event: HIDDEN` in all other trigger branches. (Allowed-trigger lists already include `Event`.)

- [ ] **Step 2: Create `TransitionEventSection.tsx`** — clone `TransitionMappingSection.tsx`, addressing `event.mapping` instead of `mapping`: it renders a `CsxEditorField` with `scriptField="event"` (addressing `transition.event.mapping`), `templateType="mapping"`, `label="Event Mapping"`, plus the `MappingScriptsSection`. Props mirror `TransitionMappingSection` (`value`, `onUpdate`, `onRemove`, `onUpdateScripts`, addressing tuple).

- [ ] **Step 3: Mutations** — in `useTransitionMutations.ts`, add `updateTransitionEvent`, `removeTransitionEvent`, `updateTransitionEventScripts` mirroring the mapping mutations but targeting `ctx.transitions[index].event` (create `event` holder when absent; delete `event` on remove).

- [ ] **Step 4: Render in `TransitionCard.tsx`** — add the new handler props to `TransitionCardProps`; render `<TransitionEventSection .../>` gated on `policy.event.visible`, placed next to the mapping render.

- [ ] **Step 5: Wire call sites** — pass the new handlers through both `TransitionCard` usages in `TransitionPropertyPanel.tsx`, plus `TransitionsTab.tsx` and `sections/WorkflowSharedTransitionsSection.tsx`. Verify `getTriggerColor` in `PropertyPanelHelpers.ts` has a `case 3` (Event) branch; add one (reuse an existing color) if missing.

- [ ] **Step 6: Verify build & commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
pnpm --filter @vnext-forge-studio/web build
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/
git commit -m "feat(canvas): transition-level event mapping (triggerType Event)"
```

---

## Phase 4 (WS4) — data-vocab schema annotations

**Files (all under `packages/designer-ui/src/modules/schema-editor/`):**
- Create: `components/tree-editor/vnext/XContextSourceCard.tsx`
- Create: `components/tree-editor/vnext/XContextTargetCard.tsx`
- Modify: `components/tree-editor/vnext/vnextCardRegistry.ts` (add `scope` field + register both cards), `model/recognizedKeywords.ts` (add both keywords), `components/tree-editor/detail-panel/tabs/VNextTab.tsx` (filter by scope), `components/tree-editor/RootCompositionPanel.tsx` (host root-scoped cards) — see Step notes.
- Test: `model/dataVocab.vitest.test.ts` (pure normalize/serialize round-trip)

> **Implementer prerequisite:** open `XLovCard.tsx` (nested-object card: normalize/serialize/DEFAULT_VALUE + `VNextCardShell` + `useVNextEnabled`), `vnextCardRegistry.ts` (the `VNextCardEntry` shape), `recognizedKeywords.ts`, `VNextTab.tsx`, `FilterListEditor.tsx`/`RoleGrantListEditor.tsx` (list-of-object editors), and `model/jsonPointer.ts` (`ROOT_POINTER`).

### Task 4.1: Card registry scope + recognized keywords

- [ ] **Step 1: Add `scope` to `VNextCardEntry`** — in `vnextCardRegistry.ts`, add `scope: 'property' | 'root' | 'any'` to the entry type; default every existing entry to `'property'` (or `'any'` if any current card is legitimately used at root — confirm by reading the file).

- [ ] **Step 2: Filter by scope in `VNextTab.tsx`** — the tab already receives the resolved `pointer`. Filter the registry: at `pointer === ROOT_POINTER` render `scope: 'root' | 'any'`; at property pointers render `scope: 'property' | 'any'`. If root cards should instead live in `RootCompositionPanel.tsx`, render the filtered root-scoped subset there — pick one host and keep property cards in `VNextTab`.

- [ ] **Step 3: Register recognized keywords** — in `recognizedKeywords.ts`, add `'x-context-source'` and `'x-context-target'` to `RECOGNIZED_VNEXT_KEYWORDS` so they are not shown as raw passthrough.

- [ ] **Step 4: Typecheck** — `pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit`. (Commit with Task 4.2/4.3 once the cards exist and compile.)

### Task 4.2: `XContextSourceCard` (property-scoped)

- [ ] **Step 1: Write the failing round-trip test** — `model/dataVocab.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeContextSource, serializeContextSource } from '../components/tree-editor/vnext/XContextSourceCard.js';

describe('x-context-source normalize/serialize', () => {
  it('round-trips a context slot', () => {
    const v = normalizeContextSource({ context: { boundary: 'user', key: 'profile:{subject}', storage: 'secure' } });
    expect(v.shape).toBe('context');
    expect(serializeContextSource(v)).toEqual({ context: { boundary: 'user', key: 'profile:{subject}', storage: 'secure' } });
  });
  it('round-trips an identity ref', () => {
    const v = normalizeContextSource({ identity: 'subject' });
    expect(v.shape).toBe('identity');
    expect(serializeContextSource(v)).toEqual({ identity: 'subject' });
  });
  it('round-trips a const literal', () => {
    const v = normalizeContextSource({ const: 42 });
    expect(v.shape).toBe('const');
    expect(serializeContextSource(v)).toEqual({ const: 42 });
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/model/dataVocab.vitest.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `XContextSourceCard.tsx`** — clone `XLovCard.tsx`'s structure. Export the pure `normalizeContextSource` / `serializeContextSource` helpers (tested above) plus the card component. The card renders a shape `Select` (`const` / `context` / `identity`) driving conditional fields:
  - `const`: a JSON literal input (reuse `JsonCodeField` or a text input parsed as JSON).
  - `context`: `boundary` Select (device/user/subject), `key` text template Input, `storage` Select (—/memory/local/secure).
  - `identity`: Select (subject/user).
  Register in `vnextCardRegistry.ts` with `scope: 'property'`, `xKey: 'x-context-source'`, title "Context Source", and a `DEFAULT_VALUE` of `{ context: { boundary: 'user', key: '' } }`.

- [ ] **Step 4: Run to verify pass** — same vitest command → PASS (3 tests).

### Task 4.3: `XContextTargetCard` (root-scoped)

- [ ] **Step 1: Add round-trip tests** — append to `dataVocab.vitest.test.ts`:

```ts
import { normalizeContextTarget, serializeContextTarget } from '../components/tree-editor/vnext/XContextTargetCard.js';

describe('x-context-target normalize/serialize', () => {
  it('round-trips a path→slot map', () => {
    const rows = normalizeContextTarget({ 'profile.name': { context: { boundary: 'user', key: 'name:{instance}' } } });
    expect(rows).toHaveLength(1);
    expect(serializeContextTarget(rows)).toEqual({ 'profile.name': { context: { boundary: 'user', key: 'name:{instance}' } } });
  });
});
```

- [ ] **Step 2: Run to verify fail** → FAIL (module not found).

- [ ] **Step 3: Implement `XContextTargetCard.tsx`** — export pure `normalizeContextTarget` (map → row array) / `serializeContextTarget` (rows → map, dropping empty-path rows). The card is a row list (mirror `FilterListEditor`): each row = field path (dot-notation) text input + a `{ context: { boundary, key, storage? } }` sub-editor. Enforce `minProperties >= 1` UX: when enabled, seed one empty row; when serialization yields zero valid rows and the card is disabled, remove the keyword. Register in `vnextCardRegistry.ts` with `scope: 'root'`, `xKey: 'x-context-target'`, title "Context Targets".

- [ ] **Step 4: Run to verify pass** → PASS.

- [ ] **Step 5: Add a keyword-survival round-trip assertion** — in the existing `__tests__/roundtrip.vitest.test.ts` (or `dataVocab.vitest.test.ts`), assert that authoring then removing `x-context-source` on a property and `x-context-target` at root leaves the rest of the schema unchanged, matching the existing unknown-`x-*`-survival test style.

- [ ] **Step 6: Typecheck, build & commit** (Phase 4 whole)

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/
pnpm --filter @vnext-forge-studio/web build
git add packages/designer-ui/src/modules/schema-editor/
git commit -m "feat(schema-editor): data-vocab x-context-source and x-context-target cards"
```

---

## Final integration gate

- [ ] Full designer-ui typecheck: `pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit`
- [ ] Full designer-ui test run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run`
- [ ] vnext-types typecheck: `pnpm --filter @vnext-forge-studio/vnext-types exec tsc --noEmit`
- [ ] Web build (extension webview parity): `pnpm --filter @vnext-forge-studio/web build`
- [ ] Confirm vnext-schema repo committed on its own branch (Task 1.6).

## Execution notes for subagents

- **Order:** Phase 0 → then Phases 1–4 in parallel (disjoint modules). Within Phase 1, Tasks 1.3 (CacheAside) and Phase 2 depend on Phase 0's `DynamicExpressoField`.
- **vnext-types contention:** only Task 1.1 (task.ts / task-types.ts) and Task 3.1 (event.ts / workflow.ts / state.ts) touch vnext-types, in different files — safe in parallel.
- Each phase produces its own commits; keep them scoped so review is per-workstream.
