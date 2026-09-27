# vNext Runtime Sync — Phase A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Forge's types and validation with the current vNext runtime/schema and fix the places where Forge writes invalid documents or shows wrong runtime data today.

**Architecture:** Types first (`packages/vnext-types`, quick-run response types), then an unreleased-schema forward-port in `services-core` validation (shape-detected, like `view-display-schema-patch.ts`), then small P0 fixes, each isolated behind a pure, unit-tested helper so UI components stay thin.

**Tech Stack:** TypeScript 5.7, React 19, zod, Ajv (draft-07 + 2019-09), vitest (`renderToStaticMarkup` for component tests), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (Phase A section)

## Global Constraints

- All development happens in vnext-forge only; `vnext`, `vnext-schema`, `vnext-example`, `vnext-workflow-cli` (siblings of this repo under `/Users/U0B006/Documents/repos/burgan-tech/`) are read-only references.
- All user-visible strings are English (repo rule in `CLAUDE.md`).
- `apps/web`: no raw `console.*`; use `createLogger`.
- Branch: `f/vnext-runtime-sync`. Commit only at the Commit steps; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lint only touched files (`pnpm exec eslint <files>`); per-package `eslint .` is pre-existing red. Gates are `tsc -b` (package `build`), vitest, and builds.
- Unreleased schema source: `vnext-schema` master commit `ac42026` (after tag `v0.0.53`).
- InstanceStatus `P` = Passive; InstanceType `P` = SubProcess. Never conflate them.

## File Map

| File | Responsibility |
|---|---|
| `packages/vnext-types/src/types/annotations.ts` (new) | `Annotations` type |
| `packages/vnext-types/src/types/{workflow,state,available-in}.ts` | schema-aligned definition types |
| `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.ts` (new) | pure long-poll patch helpers (roles/rule arms) |
| `packages/services-core/src/services/validate/unreleased/{workflow,schema}.master.ts` (new, generated) | vendored vnext-schema master schemas |
| `packages/services-core/src/services/validate/runtime-sync-schema-patch.ts` (new) | shape-detected forward-port |
| `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts`, `QuickRunApi.ts`, `services-core/.../quickrun-schemas.ts` | runtime response types |
| `packages/designer-ui/src/modules/quick-run/utils/incident.ts` (new) | old/new incident shape normalizer |
| `packages/designer-ui/src/modules/quick-run/utils/instanceStatus.ts` (new) | effective status + bucket helpers |
| `packages/designer-ui/src/modules/canvas-interaction/components/nodes/stateNodeConfig.tsx` (new) | node visual config incl. subType overlay |
| `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.ts` (new) | operator split/merge preserving unknown values |

---

### Task 1: vnext-types alignment

**Files:**
- Create: `packages/vnext-types/src/types/annotations.ts`
- Modify: `packages/vnext-types/src/index.ts`, `packages/vnext-types/src/types/workflow.ts`, `packages/vnext-types/src/types/state.ts`, `packages/vnext-types/src/types/available-in.ts`

**Interfaces:**
- Produces: `Annotations`, `SubFlowType`, `SubFlowLongPollOverride`, `SubFlowStateOverride`, `SubFlowTransitionOverride`, `LongPollRolesArm`, `LongPollRuleArm`, `LongPollConfig` (union), `TimeoutTransition.annotations`, `SubFlowTimeoutOverride = TimeoutTransition` (deprecated alias).

vnext-types has no test runner; the gate is `tsc`. This task only needs `vnext-types` itself to compile. designer-ui will fail to compile on `StateInteractionEditor.tsx` until Task 2 — that is expected.

- [ ] **Step 1: Create `annotations.ts`**

```ts
/**
 * Key-value annotations on a transition or the workflow timeout. Pure
 * passthrough metadata for client UI context; the runtime does not interpret
 * values. Use namespaced keys, e.g. `ui/priority`. The schema also accepts
 * `null`.
 */
export type Annotations = Record<string, string>;
```

Add `export * from './types/annotations';` to `packages/vnext-types/src/index.ts` directly above `export * from './types/workflow';`.

- [ ] **Step 2: Update `workflow.ts`**

Add `import type { Annotations } from './annotations';` at the top. Remove the `annotations?: Record<string, string>;` line from `StartTransition` (the schema's start transition has `additionalProperties: false` and no annotations). Replace `TimeoutTransition` with:

```ts
export interface TimeoutTransition {
  key: string;
  target: string;
  versionStrategy?: string;
  timer?: WorkflowTimerConfig;
  mapping?: MappingCode;
  /** Surfaced on the state function's `timeout` block. A subflow timeout
   *  override replaces the child's timeout as a whole, annotations included. */
  annotations?: Annotations | null;
  _comment?: string;
}
```

In `CancelTransition`, `ExitTransition` and `UpdateDataTransition` change `annotations?: Record<string, string>;` to `annotations?: Annotations | null;` and `availableIn?: AvailableIn;` to `availableIn?: AvailableIn | null;`.

- [ ] **Step 3: Update `state.ts`**

Add `import type { Annotations } from './annotations';` and `import type { TimeoutTransition, WorkflowTimerConfig } from './workflow';` (type-only; no runtime cycle).

In `Transition` change `annotations?: Record<string, string>;` to `annotations?: Annotations | null;`. Replace `SharedTransition`, `SubFlowTimerConfig`, `SubFlowTimeoutOverride`, `SubFlowOverrides`, `SubFlowConfig` (lines 56–83) with:

```ts
export interface SharedTransition extends Transition {
  /** Null, empty or absent means every state — for every trigger type. */
  availableIn?: AvailableIn | null;
}

/** @deprecated Use {@link WorkflowTimerConfig}. */
export type SubFlowTimerConfig = WorkflowTimerConfig;

/**
 * @deprecated A subflow timeout override is a full workflow timeout; use
 * {@link TimeoutTransition}.
 */
export type SubFlowTimeoutOverride = TimeoutTransition;

/**
 * Parent override of a child state's `interaction.longPoll`. Field-level:
 * omitted fields keep the child's value. `terminate` and `rule` are not
 * overridable; `roles` is ignored when the child uses a rule.
 */
export interface SubFlowLongPollOverride {
  fallbackTimeoutSeconds?: number;
  roles?: RoleGrant[];
}

export interface SubFlowStateOverride {
  queryRoles?: RoleGrant[];
  interaction?: { longPoll?: SubFlowLongPollOverride };
  /** View swap: key is the view key the child selected, value the replacement. */
  views?: Record<string, ResourceReference>;
}

export interface SubFlowTransitionOverride {
  roles?: RoleGrant[];
  views?: Record<string, ResourceReference>;
}

export interface SubFlowOverrides {
  timeout?: TimeoutTransition | null;
  transitions?: Record<string, SubFlowTransitionOverride>;
  states?: Record<string, SubFlowStateOverride>;
  /** @deprecated Use `states.<s>.views` / `transitions.<t>.views`. */
  views?: Record<string, ResourceReference>;
}

/** `S` = SubFlow, `P` = SubProcess. Overrides apply to `S` only. */
export type SubFlowType = 'S' | 'P';

export interface SubFlowConfig {
  type?: SubFlowType;
  process: ResourceReference;
  mapping?: MappingCode;
  overrides?: SubFlowOverrides;
  /** @deprecated Use `overrides.states.<s>.views` / `overrides.transitions.<t>.views`. */
  viewOverrides?: Record<string, ResourceReference>;
}
```

Replace `LongPollConfig` (lines 103–115) with:

```ts
interface LongPollBase {
  /** When true the runtime pauses after the triggering transition until the
   *  client acknowledges (or `fallbackTimeoutSeconds` elapses). */
  terminate: boolean;
  /** Acknowledge fallback window in seconds (runtime default 60). */
  fallbackTimeoutSeconds?: number;
}

/** Authorization by role grants. DENY overrides ALLOW. */
export interface LongPollRolesArm extends LongPollBase {
  roles: RoleGrant[];
  rule?: never;
}

/** Authorization by a condition script (IConditionMapping), fail-closed. */
export interface LongPollRuleArm extends LongPollBase {
  rule: MappingCode;
  roles?: never;
}

/**
 * Long polling configuration for a state. Exactly one authorization arm:
 * `roles` or `rule` — never both (schema `oneOf`).
 */
export type LongPollConfig = LongPollRolesArm | LongPollRuleArm;
```

If `MappingCode` is not yet imported in `state.ts`, add `import { MappingCode } from './mapping';`.

- [ ] **Step 4: Update `available-in.ts` doc comment**

Replace the `AvailableIn` doc comment with:

```ts
/**
 * States where a transition is available. Null, empty or absent means
 * **every** state. Fields hold `AvailableIn | null`.
 *
 * Supported on shared transitions (every trigger type) and on the `cancel`,
 * `exit` and `updateData` lifecycle transitions. Read and written through the
 * codec in `utils/available-in` so the parse and write rules cannot drift apart.
 */
```

- [ ] **Step 5: Type-check vnext-types**

Run: `pnpm --filter @vnext-forge-studio/vnext-types build`
Expected: exit 0. (Then `git status` should show no `dist` changes committed — `dist` is ignored.)

- [ ] **Step 6: Commit**

```bash
git add packages/vnext-types/src
git commit -m "feat(vnext-types): align definition types with vnext-schema master

Timeout annotations, expanded subflow overrides, long-poll roles/rule arms,
nullable availableIn/annotations; drop start-transition annotations.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Long-poll editor respects the roles/rule `oneOf`

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateInteractionEditor.tsx`

**Interfaces:**
- Consumes: `LongPollConfig`, `LongPollRuleArm` from Task 1.
- Produces: `makeEmptyLongPoll(): LongPollConfig`, `patchLongPoll(base: LongPollConfig | null, patch: LongPollPatch): LongPollConfig`, `isRuleArm(lp: LongPollConfig): lp is LongPollRuleArm`, `type LongPollPatch = { terminate?: boolean; fallbackTimeoutSeconds?: number | undefined; roles?: RoleGrant[] }`. Phase C (rule editor) extends this file.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { LongPollConfig } from '@vnext-forge-studio/vnext-types';
import { isRuleArm, makeEmptyLongPoll, patchLongPoll } from './longPollConfig';

const RULE = { location: './src/Rule.csx', code: 'cmV0dXJuIHRydWU7' };

describe('longPollConfig', () => {
  it('seeds a roles arm with one editable row', () => {
    expect(makeEmptyLongPoll()).toEqual({ terminate: true, roles: [{ role: '', grant: 'allow' }] });
  });

  it('replaces roles on a roles arm', () => {
    const next = patchLongPoll({ terminate: true, roles: [] }, { roles: [{ role: 'a', grant: 'allow' }] });
    expect(next).toEqual({ terminate: true, roles: [{ role: 'a', grant: 'allow' }] });
  });

  it('never writes roles next to a rule', () => {
    const base: LongPollConfig = { terminate: true, rule: RULE };
    const next = patchLongPoll(base, { terminate: false, roles: [{ role: 'x', grant: 'allow' }] });
    expect(next).toEqual({ terminate: false, rule: RULE });
    expect('roles' in next).toBe(false);
  });

  it('drops fallbackTimeoutSeconds when cleared', () => {
    const next = patchLongPoll(
      { terminate: true, fallbackTimeoutSeconds: 30, roles: [] },
      { fallbackTimeoutSeconds: undefined },
    );
    expect(next).toEqual({ terminate: true, roles: [] });
  });

  it('keeps fallbackTimeoutSeconds when the patch does not mention it', () => {
    const next = patchLongPoll({ terminate: true, fallbackTimeoutSeconds: 30, roles: [] }, { terminate: false });
    expect(next).toEqual({ terminate: false, fallbackTimeoutSeconds: 30, roles: [] });
  });

  it('starts from an empty roles arm when there is no base', () => {
    expect(patchLongPoll(null, { terminate: false })).toEqual({
      terminate: false,
      roles: [{ role: '', grant: 'allow' }],
    });
  });

  it('detects the rule arm', () => {
    expect(isRuleArm({ terminate: true, rule: RULE })).toBe(true);
    expect(isRuleArm({ terminate: true, roles: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.vitest.test.ts`
Expected: FAIL — cannot resolve `./longPollConfig`.

- [ ] **Step 3: Implement `longPollConfig.ts`**

```ts
import type {
  LongPollConfig,
  LongPollRuleArm,
  RoleGrant,
} from '@vnext-forge-studio/vnext-types';

/**
 * Pure helpers for `state.interaction.longPoll`. The schema requires exactly
 * one authorization arm (`roles` XOR `rule`); these helpers are the only
 * writers so the editor can never produce both.
 */

export interface LongPollPatch {
  terminate?: boolean;
  /** Present-with-undefined clears the field. */
  fallbackTimeoutSeconds?: number | undefined;
  /** Ignored on a rule arm. */
  roles?: RoleGrant[];
}

export function isRuleArm(lp: LongPollConfig): lp is LongPollRuleArm {
  return (lp as LongPollRuleArm).rule !== undefined;
}

export function makeEmptyLongPoll(): LongPollConfig {
  // Seed one role row so the user can type straight away.
  return { terminate: true, roles: [{ role: '', grant: 'allow' }] };
}

export function patchLongPoll(base: LongPollConfig | null, patch: LongPollPatch): LongPollConfig {
  const current = base ?? makeEmptyLongPoll();
  const terminate = patch.terminate ?? current.terminate;
  const fallback =
    'fallbackTimeoutSeconds' in patch ? patch.fallbackTimeoutSeconds : current.fallbackTimeoutSeconds;
  const common = fallback === undefined ? { terminate } : { terminate, fallbackTimeoutSeconds: fallback };

  if (isRuleArm(current)) return { ...common, rule: current.rule };
  return { ...common, roles: patch.roles ?? current.roles };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: PASS (7 tests).

- [ ] **Step 5: Wire the editor**

In `StateInteractionEditor.tsx`:
- Change the vnext-types import to `import type { LongPollConfig, StateInteraction } from '@vnext-forge-studio/vnext-types';` and add `import { isRuleArm, makeEmptyLongPoll, patchLongPoll as applyLongPollPatch, type LongPollPatch } from './longPollConfig';`.
- Delete the local `makeEmptyLongPoll` function.
- Replace the local `patchLongPoll` with:

```ts
  const patchLongPoll = (patch: LongPollPatch): void => {
    onChange({ longPoll: applyLongPollPatch(longPoll, patch) });
  };
```

- Replace `const roles: RoleGrant[] = Array.isArray(longPoll?.roles) ? longPoll!.roles : [];` with:

```ts
  const ruleArm = longPoll !== null && isRuleArm(longPoll);
  const roles = longPoll && !isRuleArm(longPoll) && Array.isArray(longPoll.roles) ? longPoll.roles : [];
```

- Replace the Roles `<div>` block (the one containing `<RoleGrantEditor … contextLabel="long poll" />`) with:

```tsx
          {ruleArm ? (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This long poll is authorized by a condition rule. Role grants do not apply.
            </p>
          ) : (
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-1 block">
                Roles
              </label>
              <RoleGrantEditor
                roles={roles}
                onChange={(next) => patchLongPoll({ roles: next })}
                contextLabel="long poll"
              />
            </div>
          )}
```

`LongPollConfig` stays imported only if still referenced; remove it from the import otherwise.

- [ ] **Step 6: Type-check designer-ui and fix fallout from Task 1**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0. If other files fail because of Task 1 (e.g. `annotations` now `| null`, `availableIn` optional/nullable, `SubFlowTimeoutOverride` alias), fix each at the use site with the narrowest change: `?? undefined` / `?? {}` / `?? []`, or the existing `utils/available-in` codec which already tolerates `null`. Do not widen or cast types.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src
git commit -m "fix(designer): long-poll editor never writes roles next to a rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Forward-port unreleased vnext-schema (workflow + schema definitions)

**Files:**
- Create: `packages/services-core/src/services/validate/unreleased/workflow.master.ts` (generated)
- Create: `packages/services-core/src/services/validate/unreleased/schema.master.ts` (generated)
- Create: `packages/services-core/src/services/validate/runtime-sync-schema-patch.ts`
- Create: `packages/services-core/test/fixtures/runtime-sync/{timeout-lab-root,subflow-override-lab-parent,subflow-override-lab-child}.json` (copied)
- Test: `packages/services-core/test/validate/runtime-sync-schema-patch.test.ts`
- Modify: `packages/services-core/src/services/validate/validate.service.ts:8,174-180`
- Modify: `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (D2/A2 wording)

**Interfaces:**
- Produces: `patchRuntimeSyncSchema(type: string, schema: Record<string, unknown>): Record<string, unknown>`, `UNRELEASED_SCHEMA_SOURCE: string`. Every schema read (`readSchema`) goes through it, so AJV validation, `validate/getAllSchemas` (Monaco) and `getSchema` agree.

Design: **shape-detected, not version-gated** (same stance as `view-display-schema-patch.ts`): when the loaded schema still has the pre-`ac42026` shape, the vendored master schema is returned instead. Once a vnext-schema release carries these changes the detector returns false and the patch is inert; delete the `unreleased/` folder and this patch after bumping the pin.

- [ ] **Step 1: Generate the vendored schema modules**

From `packages/services-core`:

```bash
mkdir -p src/services/validate/unreleased
for pair in "workflow:workflow-definition" "schema:schema-definition"; do
  name="${pair%%:*}"; src="${pair##*:}"
  {
    echo "// GENERATED — do not edit. Source: vnext-schema@ac42026 schemas/${src}.schema.json"
    echo "// Unreleased at the time of vendoring (after v0.0.53). Delete once a release carries it."
    echo "// Regenerate: see docs/superpowers/plans/2026-09-24-vnext-runtime-sync-phase-a.md Task 3."
    echo "const schema: Record<string, unknown> = "
    git -C ../../../vnext-schema show "ac42026:schemas/${src}.schema.json"
    echo ""
    echo "export default schema"
  } > "src/services/validate/unreleased/${name}.master.ts"
done
```

Run: `head -5 src/services/validate/unreleased/workflow.master.ts && tail -2 src/services/validate/unreleased/schema.master.ts`
Expected: header comment, `const schema: Record<string, unknown> =`, `{`, … and `export default schema`.

- [ ] **Step 2: Copy example fixtures**

```bash
mkdir -p test/fixtures/runtime-sync
cp ../../../vnext-example/core/Workflows/timeout-lab/timeout-lab-root.json test/fixtures/runtime-sync/
cp ../../../vnext-example/core/Workflows/subflow-override-lab/subflow-override-lab-parent.json test/fixtures/runtime-sync/
cp ../../../vnext-example/core/Workflows/subflow-override-lab/subflow-override-lab-child.json test/fixtures/runtime-sync/
```

- [ ] **Step 3: Write the failing test**

`test/validate/runtime-sync-schema-patch.test.ts`:

```ts
import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { patchRuntimeSyncSchema } from '../../src/services/validate/runtime-sync-schema-patch.js'

const require_ = createRequire(import.meta.url)
const installed = require_('@burgan-tech/vnext-schema') as {
  getSchema(type: string): Record<string, unknown> | null
}

function compile(schema: Record<string, unknown>) {
  const opts = { strict: false, allErrors: true }
  const ajv = String(schema.$schema ?? '').includes('2019-09') ? new Ajv2019(opts) : new Ajv(opts)
  addFormats(ajv as unknown as Ajv)
  return ajv.compile(schema)
}

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/runtime-sync/${name}.json`, import.meta.url), 'utf8'))
}

const workflowSchema = () => patchRuntimeSyncSchema('workflow', installed.getSchema('workflow')!)
const schemaSchema = () => patchRuntimeSyncSchema('schema', installed.getSchema('schema')!)

describe('patchRuntimeSyncSchema — workflow', () => {
  it('replaces the stale installed workflow schema', () => {
    const original = installed.getSchema('workflow')!
    expect(patchRuntimeSyncSchema('workflow', original)).not.toBe(original)
  })

  it('is a no-op once the schema already carries longPoll.rule', () => {
    const patched = workflowSchema()
    expect(patchRuntimeSyncSchema('workflow', patched)).toBe(patched)
  })

  it('leaves other component types untouched', () => {
    const task = installed.getSchema('task')!
    expect(patchRuntimeSyncSchema('task', task)).toBe(task)
  })

  it.each(['timeout-lab-root', 'subflow-override-lab-parent', 'subflow-override-lab-child'])(
    'accepts vnext-example %s',
    (name) => {
      const validate = compile(workflowSchema())
      const ok = validate(fixture(name))
      expect(validate.errors ?? []).toEqual([])
      expect(ok).toBe(true)
    },
  )

  it('rejects a long poll with both roles and rule', () => {
    const doc = fixture('subflow-override-lab-child') as {
      attributes: { states: { interaction?: { longPoll?: Record<string, unknown> } }[] }
    }
    const state = doc.attributes.states.find((s) => s.interaction?.longPoll)!
    state.interaction!.longPoll!.rule = { location: './src/Rule.csx', code: 'cmV0dXJuIHRydWU7' }
    expect(compile(workflowSchema())(doc)).toBe(false)
  })
})

describe('patchRuntimeSyncSchema — schema definition', () => {
  const base = {
    key: 'order-master',
    version: '1.0.0',
    domain: 'core',
    flow: 'sys-schemas',
    flowVersion: '1.0.0',
    tags: ['t'],
  }
  const withSchema = (type: string, props: Record<string, unknown>) => ({
    ...base,
    attributes: { type, schema: { type: 'object', properties: props } },
  })

  it('accepts x-indexed on a scalar field of a master schema', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('master', { amount: { type: 'number', 'x-indexed': true } }))).toBe(true)
  })

  it('rejects x-indexed on a non-master schema', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('schema', { amount: { type: 'number', 'x-indexed': true } }))).toBe(false)
  })

  it('rejects x-indexed on an array field', () => {
    const validate = compile(schemaSchema())
    expect(
      validate(withSchema('master', { list: { type: 'array', items: { type: 'string' }, 'x-indexed': true } })),
    ).toBe(false)
  })

  it('accepts a free-text attributes.type', () => {
    const validate = compile(schemaSchema())
    expect(validate(withSchema('headers-v2', { a: { type: 'string' } }))).toBe(true)
  })
})
```

If the base component fields above do not satisfy the vendored schema-definition's `required` list, read `required` from `src/services/validate/unreleased/schema.master.ts` and add the missing fields to `base` — the test is about `x-indexed`, not envelope fields.

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/validate/runtime-sync-schema-patch.test.ts`
Expected: FAIL — cannot resolve `runtime-sync-schema-patch.js`.

- [ ] **Step 5: Implement the patch**

`src/services/validate/runtime-sync-schema-patch.ts`:

```ts
/**
 * Forward-port of unreleased vnext-schema changes (master `ac42026`, after
 * `v0.0.53`) that the September 2026 runtime already relies on:
 *
 * - workflow-definition: timeout annotations, expanded `subFlow.overrides`
 *   (long-poll window/roles, scoped view swaps), `longPoll` roles/rule `oneOf`,
 *   nullable `availableIn` for every trigger type.
 * - schema-definition: free-text `attributes.type`, `x-indexed` eligibility
 *   rules for `master` schemas.
 *
 * ## Why whole-schema replacement
 *
 * The schema-definition change is a ~550-line rewrite of the `attributes.schema`
 * validation; porting it node by node would be a second copy to keep in sync.
 * Both files are vendored verbatim under `./unreleased/`.
 *
 * ## Why it is safe
 *
 * Shape-detected, not version-gated (same stance as `view-display-schema-patch`):
 * it fires only while the loaded schema still has the old shape. A vnext-schema
 * release carrying these commits makes it inert. After bumping the pin, delete
 * `./unreleased/` and this file.
 *
 * Projects pinning a much older `schemaVersion` also receive the master schema.
 * Master is a superset for authored documents except the new constraints
 * (roles/rule exclusivity, `x-indexed` eligibility), which the runtime enforces
 * at publish anyway.
 */
import unreleasedSchemaDefinition from './unreleased/schema.master.js'
import unreleasedWorkflowDefinition from './unreleased/workflow.master.js'

export const UNRELEASED_SCHEMA_SOURCE = 'vnext-schema@ac42026'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Pre-ac42026 workflow schema: `longPoll` exists but has no `rule` arm. */
function isStaleWorkflowSchema(schema: Record<string, unknown>): boolean {
  const longPoll = asRecord(asRecord(schema.definitions)?.longPoll)
  if (!longPoll) return false
  return asRecord(longPoll.properties)?.rule === undefined
}

/** Pre-ac42026 schema-definition: `attributes.type` is still a closed enum. */
function isStaleSchemaDefinition(schema: Record<string, unknown>): boolean {
  const type = asRecord(asRecord(asRecord(asRecord(schema.properties)?.attributes)?.properties)?.type)
  return Array.isArray(type?.enum)
}

/**
 * Return the vendored master schema when `schema` is a stale workflow or
 * schema definition, otherwise `schema` unchanged. Never mutates its input.
 */
export function patchRuntimeSyncSchema(
  type: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (type === 'workflow' && isStaleWorkflowSchema(schema)) return unreleasedWorkflowDefinition
  if (type === 'schema' && isStaleSchemaDefinition(schema)) return unreleasedSchemaDefinition
  return schema
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: same command as Step 4. Expected: PASS. If a vnext-example fixture fails, print `validate.errors` and check whether the fixture uses something newer than `ac42026` (then re-vendor from the current `vnext-schema` HEAD and update `ac42026` everywhere in this task) — do not edit the fixture.

- [ ] **Step 7: Wire into `validate.service.ts`**

Add `import { patchRuntimeSyncSchema } from './runtime-sync-schema-patch.js'` below the view-display import, and change `readSchema`'s return to:

```ts
    return schema ? patchRuntimeSyncSchema(type, patchViewDisplaySchema(type, schema)) : schema
```

Update the `readSchema` doc comment's first sentence to: "Every schema read goes through here, so the forward-ports (view display, unreleased runtime-sync schemas) apply identically to the bundled module and to a version downloaded by `schemaCacheService`."

- [ ] **Step 8: Run the whole services-core suite**

Run: `pnpm --filter @vnext-forge-studio/services-core test`
Expected: PASS. If `registry-contract` or schema snapshot tests fail only because `validate/getAllSchemas`/`getSchema` output changed for `workflow`/`schema`, update snapshots with `pnpm --filter @vnext-forge-studio/services-core exec vitest run -u` and inspect the diff (`git diff --stat test`) — only those two schemas may change.

- [ ] **Step 9: Align the spec wording**

In `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md`:
- D2 row: replace "gated to schema versions ≤ 0.0.53" with "shape-detected (inert once a release carries the changes); vendored master files under `services-core/src/services/validate/unreleased/`".
- A2 first paragraph: replace "applied in `validate.service.ts` next to the view-display patch, only when the resolved schema version ≤ 0.0.53. It ports these vnext-schema master changes" with "applied in `validate.service.ts` next to the view-display patch; when the loaded schema has the pre-`ac42026` shape it is replaced by the vendored master schema, which carries these changes".
- A2 Monaco paragraph: replace "(Today Monaco uses the bundled version; aligning it to the project-pinned version is included.)" with "(Serving Monaco the project-pinned version instead of the bundled one moves to Phase D.)"

- [ ] **Step 10: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/services-core build`
Expected: exit 0.

```bash
git add packages/services-core/src/services/validate packages/services-core/test docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md
git commit -m "feat(validate): forward-port unreleased vnext-schema workflow and schema definitions

Shape-detected replacement with vendored vnext-schema@ac42026 so timeout
annotations, subflow override expansion, long-poll rule and x-indexed validate
before the next schema release.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: QuickRunner response types, incident normalizer and Passive status

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/incident.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/incident.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts`, `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts:201-251`, `packages/designer-ui/src/modules/quick-run/components/StatusBadge.tsx`, `packages/services-core/src/services/quickrun/quickrun-schemas.ts`

**Interfaces:**
- Produces (quickrun.types.ts): `InstanceStatus = 'A'|'B'|'C'|'F'|'P'`, `InstanceType = 'R'|'S'|'P'`, `IncidentLinks`, `StateTimeout`, `InteractionSignal`, `TransitionInfo.executeAtUtc?`, `TRANSITION_KINDS` incl. `'scheduled'`, `StateResponse.{timeout?, incident?, interaction?: InteractionSignal}`, `InstanceListItem.metadata.{type?, effectiveStatus?, incident?}`.
- Produces (utils/incident.ts): `NormalizedIncident`, `normalizeIncident(raw: unknown): NormalizedIncident | null`.
- Produces (QuickRunApi.ts): `IncidentEntry.statusCode?`, `IncidentInfo` (legacy, documented), `InstanceDetailResponse.metadata.{type?, effectiveStatus?, incident?: IncidentInfo | IncidentLinks}`.

Note: adding `'scheduled'` to `TRANSITION_KINDS` makes `TRANSITION_KIND_STYLES` (a `Record<TransitionKind, …>`) incomplete; Task 6 adds the style. To keep this task compiling, Task 4 adds the `'scheduled'` style entry too (Step 6) and Task 6 adds the read-only rendering.

- [ ] **Step 1: Write the failing test**

`utils/incident.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeIncident } from './incident';

const ENTRY = {
  id: 'i1', createdAt: '2026-09-20T10:00:00Z', state: 's', transition: 't', task: 'k',
  message: 'boom', errorCode: 'E1', errorLayer: 'task', boundaryAction: null, boundaryLevel: null,
  traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
};

describe('normalizeIncident', () => {
  it('returns null for missing input', () => {
    expect(normalizeIncident(undefined)).toBeNull();
    expect(normalizeIncident('x')).toBeNull();
  });

  it('reads the link shape (runtime >= 2026-09-07)', () => {
    expect(
      normalizeIncident({
        hasActiveIncident: true,
        active: { href: '/core/workflows/w/instances/1/incidents/active' },
        history: { href: '/core/workflows/w/instances/1/incidents' },
      }),
    ).toEqual({
      hasActiveIncident: true,
      history: [],
      links: {
        active: '/core/workflows/w/instances/1/incidents/active',
        history: '/core/workflows/w/instances/1/incidents',
      },
    });
  });

  it('reads the legacy embedded shape', () => {
    const n = normalizeIncident({ hasActiveIncident: true, totalCount: 2, active: ENTRY, history: [ENTRY] });
    expect(n?.hasActiveIncident).toBe(true);
    expect(n?.active?.id).toBe('i1');
    expect(n?.history).toHaveLength(1);
    expect(n?.links).toBeUndefined();
  });

  it('treats a resolved legacy active entry as no active incident', () => {
    const n = normalizeIncident({ hasActiveIncident: true, active: { ...ENTRY, isResolved: true } });
    expect(n?.hasActiveIncident).toBe(false);
  });

  it('reads a link shape without an active incident', () => {
    expect(normalizeIncident({ hasActiveIncident: false, history: { href: '/h' } })).toEqual({
      hasActiveIncident: false,
      history: [],
      links: { history: '/h' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/incident.vitest.test.ts`
Expected: FAIL — cannot resolve `./incident`.

- [ ] **Step 3: Update `QuickRunApi.ts` incident + metadata types (lines 201–251)**

```ts
export interface IncidentEntry {
  id: string;
  createdAt: string;
  state: string;
  transition: string;
  task: string;
  message: string;
  errorCode: string;
  errorLayer: string;
  /** HTTP status of the failed call, when the failure came from one. */
  statusCode?: number | null;
  boundaryAction: string | null;
  boundaryLevel: string | null;
  traceId: string;
  isResolved: boolean;
  resolvedAt: string | null;
  retryCount: number;
}

/**
 * Legacy embedded incident block — sent by runtimes before 2026-09-07. Newer
 * runtimes send {@link IncidentLinks}. Read either through `normalizeIncident`.
 */
export interface IncidentInfo {
  hasActiveIncident: boolean;
  totalCount: number;
  active?: IncidentEntry;
  history?: IncidentEntry[];
}
```

Add `import type { IncidentLinks, InstanceStatus, InstanceType } from './types/quickrun.types';` (merge into the existing import from that file if there is one). In `InstanceDetailResponse.metadata` add `type?: InstanceType;` and `effectiveStatus?: InstanceStatus;` after `status`, and change `incident?: IncidentInfo;` to `incident?: IncidentInfo | IncidentLinks;`.

- [ ] **Step 4: Update `quickrun.types.ts`**

- Line 9: `export type InstanceStatus = 'A' | 'B' | 'C' | 'F' | 'P';` with a doc line above: `/** A Active, B Busy, C Completed, F Faulted, P Passive. */`
- Below it add:

```ts
/** How an instance was started — immutable. `P` here is SubProcess, not Passive. */
export type InstanceType = 'R' | 'S' | 'P';

/** Incident block (runtime >= 2026-09-07): links, never content. */
export interface IncidentLinks {
  hasActiveIncident: boolean;
  active?: { href: string };
  history?: { href: string };
}

/** State-function `timeout` block: the armed workflow timeout of the polled instance. */
export interface StateTimeout {
  key: string;
  target: string;
  executeAtUtc: string;
  annotations?: Record<string, string> | null;
}

/**
 * State-function `interaction` block. Present only while the runtime is paused
 * waiting for an acknowledge (`longPoll.terminate: true`).
 */
export interface InteractionSignal {
  terminateLongPoll?: boolean;
  fallbackTimeoutSeconds?: number;
  ack?: { href: string };
}
```

- In `TransitionInfo` add after `annotations`: `/** Scheduled entries only: when the engine will fire it. Not callable by clients. */ executeAtUtc?: string;` and change `annotations?: Record<string, string>;` to `annotations?: Record<string, string> | null;`.
- `TRANSITION_KINDS`: append `'scheduled',` after `'$timeout',`.
- In `StateResponse` replace the `interaction?: {…}` member (and its comment) with:

```ts
  /** See {@link InteractionSignal}. */
  interaction?: InteractionSignal;
  /** Armed workflow timeout; absent when none is armed or the instance is terminal. */
  timeout?: StateTimeout;
  /** Incident flag + links (part of the ETag). */
  incident?: IncidentLinks;
```

- In `InstanceListItem.metadata` add after `status: InstanceStatus;`:

```ts
    /** Deepest active subflow's status (or the instance's own). Prefer for display. */
    effectiveStatus?: InstanceStatus;
    type?: InstanceType;
    incident?: IncidentLinks;
```

- [ ] **Step 5: Implement `utils/incident.ts`**

```ts
import type { IncidentEntry } from '../QuickRunApi';

/**
 * One view over both incident shapes the runtime has served:
 * - runtime >= 2026-09-07: `{ hasActiveIncident, active?: {href}, history: {href} }`
 * - older runtimes: `{ hasActiveIncident, totalCount, active?: IncidentEntry, history?: IncidentEntry[] }`
 */
export interface NormalizedIncident {
  hasActiveIncident: boolean;
  /** Embedded active entry — legacy runtimes only. */
  active?: IncidentEntry;
  /** Embedded history — legacy runtimes only; empty for the link shape. */
  history: IncidentEntry[];
  /** Server hrefs — link shape only. Informational; Forge rebuilds paths itself. */
  links?: { active?: string; history?: string };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isEntry(value: unknown): value is IncidentEntry {
  const r = asRecord(value);
  return !!r && typeof r.id === 'string';
}

function hrefOf(value: unknown): string | undefined {
  const href = asRecord(value)?.href;
  return typeof href === 'string' ? href : undefined;
}

export function normalizeIncident(raw: unknown): NormalizedIncident | null {
  const r = asRecord(raw);
  if (!r) return null;

  const active = isEntry(r.active) ? r.active : undefined;
  const history = Array.isArray(r.history) ? r.history.filter(isEntry) : [];
  const activeHref = hrefOf(r.active);
  const historyHref = hrefOf(r.history);

  const result: NormalizedIncident = {
    hasActiveIncident: r.hasActiveIncident === true && !(active?.isResolved ?? false),
    history,
  };
  if (active) result.active = active;
  if (activeHref || historyHref) {
    result.links = {};
    if (activeHref) result.links.active = activeHref;
    if (historyHref) result.links.history = historyHref;
  }
  return result;
}
```

- [ ] **Step 6: Keep exhaustive records compiling**

- `StatusBadge.tsx` `STATUS_CONFIG`: add `P: { label: 'Passive', className: 'border-border bg-muted text-muted-text' },` after `F`.
- `components/transitionKindStyles.ts` `TRANSITION_KIND_STYLES`: add after `$timeout`:

```ts
  scheduled: {
    order: 6,
    label: 'Scheduled',
    description: 'Fired by the engine at the scheduled time — not callable',
    buttonClass:
      'rounded border border-dashed border-primary-border px-3 py-1.5 text-xs font-medium text-muted-text',
    badgeClass: 'bg-muted text-muted-text',
    glyph: '⏰',
  },
```

- [ ] **Step 7: Update the services-core zod schemas (`quickrun-schemas.ts`)**

- `const instanceStatusSchema = z.enum(['A', 'B', 'C', 'F', 'P'])` and add `const instanceTypeSchema = z.enum(['R', 'S', 'P'])`.
- Add a shared incident schema tolerant of both shapes, below `instanceStatusSchema`:

```ts
/** Incident block: link shape (runtime >= 2026-09-07) or legacy embedded content. */
const incidentBlockSchema = z
  .object({ hasActiveIncident: z.boolean() })
  .passthrough()
```

- `transitionInfoSchema`: add `kind: z.string().optional(),`, `executeAtUtc: z.string().optional(),`, `annotations: z.record(z.string(), z.string()).nullable().optional(),`.
- `quickrunGetStateResult`: replace `interaction` with

```ts
  interaction: z.object({
    terminateLongPoll: z.boolean().optional(),
    fallbackTimeoutSeconds: z.number().int().optional(),
    ack: z.object({ href: z.string() }).optional(),
  }).optional(),
  timeout: z.object({
    key: z.string(),
    target: z.string(),
    executeAtUtc: z.string(),
    annotations: z.record(z.string(), z.string()).nullable().optional(),
  }).optional(),
  incident: incidentBlockSchema.optional(),
```

- `getInstanceMetadataSchema` and `instanceMetadataSchema`: add `effectiveStatus: instanceStatusSchema.optional(),`, `type: instanceTypeSchema.nullable().optional(),`, `incident: incidentBlockSchema.optional(),` after `status`.

- [ ] **Step 8: Run tests and type-checks**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/incident.vitest.test.ts`
Expected: PASS (5 tests).

Run: `pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter @vnext-forge-studio/services-core build`
Expected: PASS. If a result-schema snapshot changes, update with `-u` and confirm the diff only adds the fields above.

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0 except errors in `InstanceDashboard.tsx` about `incident.active.isResolved` / `incident.history` (fixed in Task 5). If any **other** file fails on `InstanceStatus`/`TransitionKind` exhaustiveness (e.g. `NewRunDialog.tsx`), add the `'P'` / `'scheduled'` case there with the same labels as above.

- [ ] **Step 9: Commit**

Commit after Task 5 makes designer-ui compile (Task 5 Step 5 commits both). Do not commit a non-compiling designer-ui.

---

### Task 5: Instance details show the incident correctly on old and new runtimes

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx:6,1222-1223,1336-1339,1454-1470,1610-1621`
- Test: `packages/designer-ui/src/modules/quick-run/components/IncidentSection.vitest.test.tsx`

**Interfaces:**
- Consumes: `normalizeIncident`, `NormalizedIncident` (Task 4).
- Produces: exported `IncidentSection({ incident, raw }: { incident: NormalizedIncident; raw: unknown })` (exported for the test; Phase B4 replaces its body with lazy loading).

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { normalizeIncident } from '../utils/incident';
import { IncidentSection } from './InstanceDashboard';

describe('IncidentSection', () => {
  it('shows a link-shape active incident without inventing entry fields', () => {
    const raw = { hasActiveIncident: true, active: { href: '/a' }, history: { href: '/h' } };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw }));
    expect(html).toContain('This instance has an active incident');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('Current incident');
  });

  it('renders the embedded active entry from a legacy runtime', () => {
    const raw = {
      hasActiveIncident: true,
      totalCount: 1,
      active: {
        id: 'i1', createdAt: '2026-09-01T10:00:00Z', state: 'review', transition: 'approve', task: 'call-api',
        message: 'upstream failed', errorCode: 'E1', errorLayer: 'task', boundaryAction: null,
        boundaryLevel: null, traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
      },
    };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw }));
    expect(html).toContain('Current incident');
    expect(html).toContain('upstream failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/IncidentSection.vitest.test.tsx`
Expected: FAIL — `IncidentSection` is not exported / type errors.

- [ ] **Step 3: Implement in `InstanceDashboard.tsx`**

- Line 6: change the import to `import type { IncidentEntry, InstanceDetailResponse, WorkflowBucketConfig } from '../QuickRunApi';` and add `import { normalizeIncident, type NormalizedIncident } from '../utils/incident';`.
- Lines 1222–1223:

```tsx
  const rawIncident = data?.metadata?.incident;
  const incident = normalizeIncident(rawIncident);
  const showAlertStrip = incident?.hasActiveIncident === true;
```

- Lines 1336–1339:

```tsx
              {/* Incident */}
              {incident && (incident.hasActiveIncident || incident.active || incident.history.length > 0) && (
                <IncidentSection incident={incident} raw={rawIncident} />
              )}
```

- Replace `function IncidentSection` (1454–1470) with:

```tsx
export function IncidentSection({ incident, raw }: { incident: NormalizedIncident; raw: unknown }) {
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--vscode-panel-border)] pt-4">
      <p className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">Incident</p>

      {incident.active ? (
        <IncidentActiveCard entry={incident.active} />
      ) : (
        incident.hasActiveIncident && (
          <p className="text-xs text-[var(--vscode-foreground)]">
            This instance has an active incident. Details are served by the runtime&apos;s incidents endpoint.
          </p>
        )
      )}

      {incident.history.length > 0 && <IncidentHistorySection history={incident.history} />}

      <IncidentRawJsonDisclosure incident={raw} />
    </section>
  );
}
```

- `IncidentRawJsonDisclosure` (1610): change the prop type to `{ incident: unknown }`.

- [ ] **Step 4: Run test and type-check**

Run: the Step 2 command. Expected: PASS (2 tests).
Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

- [ ] **Step 5: Commit (Tasks 4 + 5)**

```bash
git add packages/designer-ui/src/modules/quick-run packages/services-core/src/services/quickrun packages/services-core/test
git commit -m "fix(quick-run): read the runtime's link-shaped incident block and new response fields

Adds Passive status, instance type, effectiveStatus, state timeout and
interaction window to the types; incident details no longer render empty
fields against runtimes after 2026-09-07.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scheduled transitions are shown read-only

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/components/transitionKindStyles.ts`, `packages/designer-ui/src/modules/quick-run/components/AvailableTransitions.tsx:94-105`
- Test: `packages/designer-ui/src/modules/quick-run/components/AvailableTransitions.vitest.test.tsx`

**Interfaces:**
- Consumes: `'scheduled'` kind + style (Task 4), `TransitionInfo.executeAtUtc`.
- Produces: `TransitionKindStyle.readOnly?: boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AvailableTransitions } from './AvailableTransitions';

const noop = () => {};

describe('AvailableTransitions — scheduled entries', () => {
  it('renders scheduled entries without a button', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'approve', href: '/t/approve', kind: 'stateTransition' },
          { name: 'reminder', href: '/t/reminder', kind: 'scheduled', executeAtUtc: '2026-09-30T12:00:00Z' },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
      }),
    );
    const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
    expect(buttons.some((b) => b.includes('approve'))).toBe(true);
    expect(buttons.some((b) => b.includes('reminder'))).toBe(false);
    expect(html).toContain('reminder');
    expect(html).toContain('Scheduled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/AvailableTransitions.vitest.test.tsx`
Expected: FAIL — `reminder` is rendered inside a `<button>`.

- [ ] **Step 3: Implement**

In `transitionKindStyles.ts` add to `TransitionKindStyle`:

```ts
  /** Engine-fired entry the client cannot call — rendered as a label, not a button. */
  readOnly?: boolean;
```

and add `readOnly: true,` to the `scheduled` entry.

In `AvailableTransitions.tsx` replace the `items.map(({ info }) => ( <button …> ))` block (lines 94–105) with:

```tsx
              {items.map(({ info }) =>
                style.readOnly ? (
                  <span
                    key={`${kind}-${info.name}`}
                    className={style.buttonClass}
                    title={style.description}
                  >
                    {style.glyph ? `${style.glyph} ` : ''}
                    {flowLabels?.transitions[info.name] ?? info.name}
                    {info.executeAtUtc && (
                      <span className="ml-1 opacity-70">· {new Date(info.executeAtUtc).toLocaleString()}</span>
                    )}
                  </span>
                ) : (
                  <button
                    key={`${kind}-${info.name}`}
                    className={style.buttonClass}
                    onClick={() => onTransitionClick(info)}
                    disabled={disabled}
                    title={style.description}
                  >
                    {style.glyph ? `${style.glyph} ` : ''}
                    {flowLabels?.transitions[info.name] ?? info.name}
                  </button>
                ),
              )}
```

- [ ] **Step 4: Run test and type-check**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run/components
git commit -m "fix(quick-run): show scheduled transitions read-only instead of as callable buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Instance list uses effectiveStatus and keeps Passive instances

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/instanceStatus.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/instanceStatus.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceListPanel.tsx:55,117-118,273`

**Interfaces:**
- Consumes: `InstanceStatus` incl. `'P'`, `metadata.effectiveStatus` (Task 4).
- Produces: `displayStatus(meta: { status: InstanceStatus; effectiveStatus?: InstanceStatus }): InstanceStatus`, `isActiveStatus(s: InstanceStatus): boolean`, `isInactiveStatus(s: InstanceStatus): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { displayStatus, isActiveStatus, isInactiveStatus } from './instanceStatus';

describe('instanceStatus', () => {
  it('prefers effectiveStatus', () => {
    expect(displayStatus({ status: 'B', effectiveStatus: 'A' })).toBe('A');
  });

  it('falls back to status on older runtimes', () => {
    expect(displayStatus({ status: 'B' })).toBe('B');
  });

  it('buckets every status exactly once', () => {
    for (const s of ['A', 'B', 'C', 'F', 'P'] as const) {
      expect(isActiveStatus(s) !== isInactiveStatus(s)).toBe(true);
    }
    expect(isInactiveStatus('P')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/instanceStatus.vitest.test.ts`
Expected: FAIL — cannot resolve `./instanceStatus`.

- [ ] **Step 3: Implement `instanceStatus.ts`**

```ts
import type { InstanceStatus } from '../types/quickrun.types';

/**
 * Status to show for an instance. A parent sitting in a subflow is stored as
 * `B`; the runtime's `effectiveStatus` reports the deepest active subflow's
 * status, which is what the user expects to see.
 */
export function displayStatus(meta: { status: InstanceStatus; effectiveStatus?: InstanceStatus }): InstanceStatus {
  return meta.effectiveStatus ?? meta.status;
}

export function isActiveStatus(s: InstanceStatus): boolean {
  return s === 'A' || s === 'B';
}

/** Completed, Faulted or Passive. */
export function isInactiveStatus(s: InstanceStatus): boolean {
  return s === 'C' || s === 'F' || s === 'P';
}
```

- [ ] **Step 4: Wire `InstanceListPanel.tsx`**

- Add `import { displayStatus, isActiveStatus, isInactiveStatus } from '../utils/instanceStatus';`.
- Line 55: `status: displayStatus(item.metadata),`
- Lines 117–118:

```tsx
  const activeInstances = Array.from(instances.values()).filter((i) => isActiveStatus(i.status));
  const completedInstances = Array.from(instances.values()).filter((i) => isInactiveStatus(i.status));
```

- Line 273: `<StatusBadge status={displayStatus(item.metadata)} compact />`

- [ ] **Step 5: Run test, type-check, commit**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "fix(quick-run): list instances by effectiveStatus and keep Passive ones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Canvas shows Human and Busy subTypes on every state type

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/stateNodeConfig.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/stateNodeConfig.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeBase.tsx:3-9,35-68,134`

**Interfaces:**
- Produces: `StateNodeConfig` (moved), `getStateNodeConfig(stateType: number, subType: number): StateNodeConfig`. Phase C4 (`humanState` node) reuses it.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { getStateNodeConfig } from './stateNodeConfig';

describe('getStateNodeConfig', () => {
  it('overlays Human on an intermediate state', () => {
    expect(getStateNodeConfig(2, 6).typeLabel).toBe('Human');
  });

  it('overlays Busy on an intermediate state', () => {
    expect(getStateNodeConfig(2, 5).typeLabel).toBe('Busy');
  });

  it('keeps the plain intermediate look without a subType', () => {
    expect(getStateNodeConfig(2, 0).typeLabel).toBe('State');
  });

  it('keeps SubFlow identity even with a subType', () => {
    expect(getStateNodeConfig(4, 6).typeLabel).toBe('SubFlow');
  });

  it('keeps final subTypes', () => {
    expect(getStateNodeConfig(3, 1).typeLabel).toBe('Success');
    expect(getStateNodeConfig(3, 6).typeLabel).toBe('Human');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/nodes/stateNodeConfig.vitest.test.tsx`
Expected: FAIL — cannot resolve `./stateNodeConfig`.

- [ ] **Step 3: Implement `stateNodeConfig.tsx`**

```tsx
import {
  Play, Square, CheckCircle2, XCircle, StopCircle,
  PauseCircle, Circle, Repeat2, LayoutGrid,
  Loader2, UserCircle, Ban, TimerOff,
} from 'lucide-react';

export interface StateNodeConfig {
  bg: string;
  text: string;
  accent: string;
  ring: string;
  icon: React.ReactNode;
  typeLabel: string;
  borderStyle?: string;
}

const BUSY: StateNodeConfig = { bg: 'bg-sky-500/10', text: 'text-sky-600', accent: 'bg-sky-500', ring: 'ring-sky-500/20', icon: <Loader2 size={16} />, typeLabel: 'Busy' };
const HUMAN: StateNodeConfig = { bg: 'bg-indigo-500/10', text: 'text-indigo-600', accent: 'bg-indigo-500', ring: 'ring-indigo-500/20', icon: <UserCircle size={16} />, typeLabel: 'Human' };

function finalConfig(subType: number): StateNodeConfig {
  switch (subType) {
    case 1: return { bg: 'bg-final-success/10', text: 'text-final-success', accent: 'bg-final-success', ring: 'ring-final-success/20', icon: <CheckCircle2 size={16} />, typeLabel: 'Success' };
    case 2: return { bg: 'bg-final-error/10', text: 'text-final-error', accent: 'bg-final-error', ring: 'ring-final-error/20', icon: <XCircle size={16} />, typeLabel: 'Error' };
    case 3: return { bg: 'bg-final-terminated/10', text: 'text-final-terminated', accent: 'bg-final-terminated', ring: 'ring-final-terminated/20', icon: <StopCircle size={16} />, typeLabel: 'Terminated' };
    case 4: return { bg: 'bg-final-suspended/10', text: 'text-final-suspended', accent: 'bg-final-suspended', ring: 'ring-final-suspended/20', icon: <PauseCircle size={16} />, typeLabel: 'Suspended' };
    case 5: return BUSY;
    case 6: return HUMAN;
    case 7: return { bg: 'bg-rose-500/10', text: 'text-rose-600', accent: 'bg-rose-500', ring: 'ring-rose-500/20', icon: <Ban size={16} />, typeLabel: 'Cancelled' };
    case 8: return { bg: 'bg-amber-500/10', text: 'text-amber-600', accent: 'bg-amber-500', ring: 'ring-amber-500/20', icon: <TimerOff size={16} />, typeLabel: 'Timeout' };
    default: return { bg: 'bg-final-terminated/10', text: 'text-final-terminated', accent: 'bg-final-terminated', ring: 'ring-final-terminated/20', icon: <Circle size={16} />, typeLabel: 'Final' };
  }
}

/**
 * Visual config for a state node. Busy (5) and Human (6) subTypes overlay
 * every state type except SubFlow — the runtime selects human tasks by
 * subType regardless of stateType, and Human is almost always on an
 * intermediate (2) state.
 */
export function getStateNodeConfig(stateType: number, subType: number): StateNodeConfig {
  if (stateType === 3) return finalConfig(subType);
  if (stateType === 4) {
    return { bg: 'bg-subflow/10', text: 'text-subflow', accent: 'bg-subflow', ring: 'ring-subflow/20', icon: <Repeat2 size={16} />, typeLabel: 'SubFlow', borderStyle: 'border-dashed' };
  }
  if (subType === 6) return HUMAN;
  if (subType === 5) return BUSY;
  if (stateType === 1) {
    return { bg: 'bg-initial/10', text: 'text-initial', accent: 'bg-initial', ring: 'ring-initial/20', icon: <Play size={16} />, typeLabel: 'Initial' };
  }
  if (stateType === 5) {
    return { bg: 'bg-wizard/10', text: 'text-wizard', accent: 'bg-wizard', ring: 'ring-wizard/20', icon: <LayoutGrid size={16} />, typeLabel: 'Wizard' };
  }
  return { bg: 'bg-intermediate/10', text: 'text-intermediate', accent: 'bg-intermediate', ring: 'ring-intermediate/20', icon: <Square size={16} />, typeLabel: 'State' };
}
```

- [ ] **Step 4: Wire `StateNodeBase.tsx`**

- Delete `interface StateNodeConfig` (35–43) and `function getConfig` (45–68).
- Add `import { getStateNodeConfig } from './stateNodeConfig';`.
- Line 134: `const config = getStateNodeConfig(d.stateType, d.subType);`
- Remove icons from the lucide import that are no longer used in this file (`Play, Square, CheckCircle2, XCircle, StopCircle, PauseCircle, Circle, LayoutGrid, Loader2, UserCircle, Ban, TimerOff` — keep any still referenced, e.g. `Repeat2`, `Eye`, `AlertTriangle`; let `tsc`/eslint `no-unused-vars` tell you).

- [ ] **Step 5: Run test, type-check, commit**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/nodes
git commit -m "fix(canvas): show Human and Busy subTypes on non-final states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Start transition no longer offers annotations

**Files:**
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.ts:176`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts`

- [ ] **Step 1: Write the failing test** — append to the test file:

```ts
describe('resolveFieldPolicy — annotations visibility', () => {
  it('is hidden for the start transition (schema has no annotations there)', () => {
    expect(resolveFieldPolicy('start', TriggerType.Manual).annotations.visible).toBe(false);
  });

  it('stays visible for every other transition kind', () => {
    for (const kind of ['state', 'shared', 'cancel', 'exit', 'updateData'] as const) {
      expect(resolveFieldPolicy(kind, TriggerType.Manual).annotations.visible).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts`
Expected: FAIL on the start assertion.

- [ ] **Step 3: Implement** — in `startTransitionPolicy()` replace `annotations: VISIBLE_OPTIONAL,` with:

```ts
    // The start transition schema has `additionalProperties: false` and no
    // `annotations`; existing values are left in the JSON untouched.
    annotations: HIDDEN,
```

- [ ] **Step 4: Run test, commit**

Run: Step 2 command → PASS.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition
git commit -m "fix(designer): hide annotations on the start transition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Filter-operator card never drops operators it does not know

**Files:**
- Create: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.ts`
- Test: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext/XFilterOperatorsCard.tsx:20-66,80-92`

**Interfaces:**
- Produces: `FILTER_OPERATORS`, `FilterOperator`, `splitOperators(value: unknown): { known: FilterOperator[]; unknown: string[] }`, `mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[]`. Phase D4 replaces the operator list here with the runtime spellings.

The runtime's schema filter check uses spellings such as `gte`, `lte`, `neq`, `contains` (see `vnext/src/BBT.Workflow.Domain/Definitions/Schemas/SchemaFilterContext.cs`). Today the card silently deletes them on the next edit.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mergeOperators, splitOperators } from './filterOperators';

describe('filterOperators', () => {
  it('separates known operators from unknown spellings', () => {
    expect(splitOperators(['eq', 'gte', 'eq', 'contains', 3])).toEqual({
      known: ['eq'],
      unknown: ['gte', 'contains'],
    });
  });

  it('returns empty lists for non-arrays', () => {
    expect(splitOperators(undefined)).toEqual({ known: [], unknown: [] });
  });

  it('writes known operators in canonical order and keeps unknown ones', () => {
    expect(mergeOperators(new Set(['lt', 'eq']), ['gte', 'contains'])).toEqual(['eq', 'lt', 'gte', 'contains']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/schema-editor/components/tree-editor/vnext/filterOperators.vitest.test.ts`
Expected: FAIL — cannot resolve `./filterOperators`.

- [ ] **Step 3: Implement `filterOperators.ts`**

Move `FILTER_OPERATORS`, `FilterOperator` and `FILTER_OPERATOR_SET` (card lines 10–40, with their comment) into this file and export `FILTER_OPERATORS` and `FilterOperator`. Then add:

```ts
/**
 * Split an authored `x-filterOperators` value. Operators outside
 * {@link FILTER_OPERATORS} are kept verbatim in `unknown` — they may be
 * spellings the runtime accepts (e.g. `gte`, `contains`) and must survive an
 * edit of the known ones.
 */
export function splitOperators(value: unknown): { known: FilterOperator[]; unknown: string[] } {
  const known: FilterOperator[] = [];
  const unknown: string[] = [];
  if (!Array.isArray(value)) return { known, unknown };
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || seen.has(item)) continue;
    seen.add(item);
    if (FILTER_OPERATOR_SET.has(item)) known.push(item as FilterOperator);
    else unknown.push(item);
  }
  return { known, unknown };
}

/** Known operators in canonical order, followed by preserved unknown ones. */
export function mergeOperators(selected: ReadonlySet<string>, unknown: readonly string[]): string[] {
  return [...FILTER_OPERATORS.filter((o) => selected.has(o.value)).map((o) => o.value), ...unknown];
}
```

- [ ] **Step 4: Wire the card**

In `XFilterOperatorsCard.tsx`:
- Remove the moved constants and `normalizeOperators`; add `import { FILTER_OPERATORS, mergeOperators, splitOperators, type FilterOperator } from './filterOperators';`. Keep `CATEGORIES` and `DEFAULT_VALUE` in the card.
- Replace `const value = normalizeOperators(node?.['x-filterOperators']);` with:

```ts
  const { known: value, unknown: preserved } = splitOperators(node?.['x-filterOperators']);
```

- In `setOperator` replace the `ordered` computation and write with:

```ts
    updateComponent(setKeyword(pointer, 'x-filterOperators', mergeOperators(next, preserved)));
```

(delete the now-stale "Preserve the canonical operator ordering" comment lines, `mergeOperators` documents it).
- Below the categories `<div className="space-y-2">…</div>` block, before `</VNextCardShell>`, add:

```tsx
      {preserved.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Also kept: <span className="font-mono">{preserved.join(', ')}</span>
        </p>
      )}
```

- [ ] **Step 5: Run test, type-check, commit**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

```bash
git add packages/designer-ui/src/modules/schema-editor/components/tree-editor/vnext
git commit -m "fix(schema-editor): keep filter operators the card does not list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Phase A gate

**Files:** none (verification only).

- [ ] **Step 1: Full builds**

Run: `pnpm build`
Expected: Turborepo finishes with all tasks successful (extension host esbuild + web vite build included).

- [ ] **Step 2: Test suites**

Run: `pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter @vnext-forge-studio/designer-ui test`
Expected: PASS, no skipped new tests.

- [ ] **Step 3: Lint touched files**

Run: `git diff --name-only main...HEAD -- '*.ts' '*.tsx' | grep -v '/unreleased/' | xargs pnpm exec eslint`
Expected: no new errors in the listed files (the generated `unreleased/*.master.ts` files are excluded on purpose).

- [ ] **Step 4: Browser check (web shell)**

Start the web shell with the preview tools (`.claude/launch.json`) and open a vnext-example workflow containing a Human state (`core/Workflows/human-task-chain/ht-a.json`): the `Human` node look is visible on the intermediate state. Open a start transition: no Annotations section. Take a screenshot as evidence.

- [ ] **Step 5: Report**

Summarize per task: tests added, commands run with results, screenshot. Do not claim completion without the command output.
