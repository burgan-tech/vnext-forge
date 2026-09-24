# vNext Runtime Sync — Phase C (Flow Designer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the flow designer author every runtime construct Phase A typed — timeout annotations, the full subflow override surface, the long-poll rule arm, a dedicated Human Task node and tab, a long-poll indicator, optional `availableIn` on shared transitions — and lint the runtime rules authors trip over.

**Architecture:** Every decision lives in a small pure, unit-tested module (`longPollConfig`, `timeoutFields`, `childWorkflowSummary`, `subFlowOverrides`, `humanTask`, `stateNodeData`, `runtimeSyncRules`, `functionTaskKeys`); components are props-driven so the SSR-only harness (`renderToStaticMarkup`) can assert them; store-bound shells (`SubFlowTab`, `GeneralTab`, `StatePropertyPanel`, `WorkflowTimeoutSection`) only wire helpers to `updateWorkflow`. The subflow child definition is loaded through the same resolver the canvas uses to open a subflow (`useWorkflowFileResolver`), quietly, and reduced to a key/view summary before any component sees it.

**Tech Stack:** TypeScript 5.7, React 19, zustand + immer (`updateWorkflow` = `produce`), lucide-react, vitest 3 (`renderToStaticMarkup`, `vi.mock` + `await import`), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (Phase C: C1–C7; Decision D6; builds on Phase A A1/A3)

## Global Constraints

- All development happens in vnext-forge only; `vnext`, `vnext-schema`, `vnext-example`, `vnext-workflow-cli` (siblings under `/Users/U0B006/Documents/repos/burgan-tech/`) are read-only references.
- All user-visible strings are English (repo rule in `CLAUDE.md`). Do not put a raw `'` or `"` in JSX text (`react/no-unescaped-entities`); rephrase instead.
- Branch: `f/vnext-runtime-sync`. Phase start commit: `9275111`. Commit only at the Commit steps; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- designer-ui never imports `@vnext-forge-studio/services-core` (dependency policy).
- Every task leaves designer-ui compiling: run `pnpm --filter @vnext-forge-studio/designer-ui build` (`tsc -b`) before each commit. designer-ui `tsconfig.json` excludes only `*.vitest.test.ts`; `*.vitest.test.tsx` files are compiled by `tsc -b` and must type-check.
- Test command: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run <path relative to packages/designer-ui>`.
- Component tests: `renderToStaticMarkup`. zustand stores are frozen at their initial snapshot under SSR, so tested components take props. A component rendering `CsxEditorField` / `MappingScriptsSection` / `ChooseExistingVnextComponentDialog` is tested with `vi.mock(<same specifier the component uses>, …)` and loaded with `const { X } = await import('./X')`.
- `packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts` contains two intentional NUL bytes (edge-pair key separators, lines ~413/419): edit it only with the Edit tool on anchors away from those lines, never with `sed`/`cat >`; search it with `grep -a`. After editing, `python3 -c "print(open('packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts','rb').read().count(b'\x00'))"` must still print `2`.
- `SubFlowTimeoutOverride` is deprecated (Phase A); new code uses `TimeoutTransition`.
- Runtime facts this plan relies on (read-only sources): subflow overrides — `vnext/docs/domain/subflow-overrides.md`; long-poll rule arm — `vnext/docs/domain/long-poll-termination.md` §Rule-based authorization; human-task gate = leaf state `queryRoles`, else workflow root `queryRoles`, fail-closed when neither — `vnext/docs/runtime/human-task-function.md` §The gate is the leaf state's queryRoles; state-level `subFlow.type: "P"` is an authoring error — `vnext/docs/agent-council/sessions/README.md` 2026-09-22; `timer.reset` has no reader in `vnext/src`; function task-key normalization — `vnext/src/BBT.Workflow.Domain/System/Text/StringExtensions.cs` `ToVariableName`; custom-function `roles` are evaluated only by `authorize?functionKey=` (`WorkflowErrors.FunctionAccessDenied` has no caller).
- Lint only touched files against the phase start commit; per-package `eslint .` is pre-existing red. The designer-ui eslint config is `recommendedTypeChecked` + `stylisticTypeChecked`, so in new and edited code: no `any` / unsafe member access (cast store `any` values to a local shape first), `??` instead of `||` on nullable operands, `interface` for object types, `T[]` not `Array<T>`/`ReadonlyArray<T>`, no empty functions (tests use `() => undefined`), one import per module (`import { X, type Y } from …`). `*.vitest.test.ts` files are outside the tsconfig (parse-only), so the gate lints `.ts` sources and `.tsx` tests only.

## Decisions made while planning (spec ambiguities)

| Topic | Choice | Why |
|---|---|---|
| Initial + Human (C4) | Initial keeps its identity (node type `initialState`, Initial look); Human applies to Intermediate and Wizard; SubFlow and Final keep theirs. Busy overlay unchanged. | The Initial stamp is the only on-canvas marker of the entry point besides the start edge; a Human entry state is rare. The warning dot, the property-panel Human badge and the Human Task tab still apply to it. |
| Human warning (C4 dot, C7 lint) | Fires when the state has no `queryRoles` **and** the workflow root declares none. | Mirrors the runtime gate (state → workflow root fallback); a state inheriting root grants is listed correctly. |
| Human node border | `border-dotted` (SubFlow keeps `border-dashed`). | "Distinct border like SubFlow's dashed" without colliding with SubFlow. |
| Offered transitions (C4) | Manual state transitions + manual shared transitions available here (`availableIn` absent/empty or listing the state) + `cancel`/`exit`/`updateData` available here. | That is what the state function can offer a caller; roles are decided at open time. |
| Long-poll override group without a loaded child (C2) | Shown when the child state declares a long poll, or when the override already holds `interaction` (plus an "inert" warning when the child has none). | Never hides existing data; otherwise follows the spec. |
| Override count badge (C2) | One per set field: timeout, each `roles`/`queryRoles`, each long-poll field, each view swap, each legacy view entry. | "Count badge includes views and interaction overrides." |
| Legacy views migration (C2) | Offered only when the child is loaded and every legacy view key is selected by some child state/transition; the entry is copied to each state/transition that selects it; then `viewOverrides` / `overrides.views` are removed. | Runtime rejects mixing; a partial migration would create exactly that. |
| `availableIn` on shared transitions (C6) | Optional for Manual/Scheduled/Event; the section drops the key when cleared and new shared transitions no longer seed `availableIn: []`. | Absent/null/empty all mean "every state" (Phase A type); keeps JSON minimal like the lifecycle transitions. |
| `timer.reset` info (C7) | Fires whenever a workflow timeout or subflow timeout override sets `timer.reset`. | Schema requires `reset`, runtime has no reader. |
| Function `roles` copy (C7) | No roles UI existed; add a small Roles card (reused `RoleGrantEditor`) carrying the authorize-only copy. | The copy needs a home; the field is in the function schema. |
| Function task-key collisions (C7) | Inline error block in the Multiple Tasks section (the function editor has no lint engine). | Same rule as runtime `FunctionComponentValidator.ValidateTaskKeysDistinct`. |
| Script panel sync for object holders | `applyScriptValueToWorkflow` treats a non-array state field as a holder and `scriptField` as a dotted path. | The rule (`interaction.longPoll.rule`) and the timeout override mapping (`subFlow.overrides.timeout.mapping`) need it; it also fixes the already-broken `subFlow.mapping` sync. |

## File Map

| File | Responsibility |
|---|---|
| `packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.ts` | script panel → workflow draft; gains object-holder dotted paths |
| `.../canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.ts` | C6 policy |
| `.../canvas-interaction/components/panels/sections/WorkflowSharedTransitionsSection.tsx` | drop empty `availableIn` |
| `.../canvas-interaction/components/panels/tabs/state/longPollConfig.ts` | arm switching, rule writer, arm issue |
| `.../canvas-interaction/components/panels/tabs/state/StateInteractionEditor.tsx` | "Authorize by" control, rule arm |
| `.../canvas-interaction/components/panels/tabs/GeneralTab.tsx` | passes `stateKey` to the interaction editor |
| `.../canvas-interaction/components/panels/tabs/shared/timeoutFields.ts` (new) | annotations / `_comment` writers for timeouts |
| `.../canvas-interaction/components/panels/sections/WorkflowTimeoutSection.tsx` | C1 annotations |
| `.../vnext-workspace/resolveWorkflowFileByKey.ts` | `quiet` option |
| `.../canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.ts` (new) | child definition → keys, long-poll arm, view keys |
| `.../canvas-interaction/components/panels/tabs/subflow/useChildWorkflowSummary.ts` (new) | loads the child quietly |
| `.../canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.ts` (new) | count, warnings, legacy migration, long-poll override writer, key helpers |
| `.../canvas-interaction/components/panels/tabs/subflow/KeyCombobox.tsx` (new) | free-text key input with suggestions |
| `.../canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.tsx` (new) | C1 subflow timeout override editor |
| `.../canvas-interaction/components/panels/tabs/subflow/OptionalRoleOverride.tsx` (new) | set / unset a role-list override |
| `.../canvas-interaction/components/panels/tabs/subflow/ViewSwapMapEditor.tsx` (new) | view key → replacement map |
| `.../canvas-interaction/components/panels/tabs/subflow/SubFlowOverridesSection.tsx` | rewritten C2 surface |
| `.../canvas-interaction/components/panels/tabs/subflow/SubFlowTab.tsx` | wires child summary + `updateSubFlow` |
| `.../canvas-interaction/utils/humanTask.ts` (new) | human-task predicates, offered transitions, mapping snippet |
| `.../canvas-interaction/utils/stateNodeData.ts` (new) | interaction + human node data, tooltip |
| `.../canvas-interaction/utils/Conversion.ts` | `humanState` node type, extra node data |
| `.../canvas-interaction/components/nodes/{stateNodeConfig.tsx,index.ts,StateNodeBase.tsx}` | Human look, registry, indicators |
| `.../canvas-interaction/components/nodes/StateNodeIndicators.tsx` (new) | long-poll icon, human gate dot |
| `.../canvas-interaction/components/panels/tabs/HumanTaskTab.tsx` (new) | C4 tab |
| `.../canvas-interaction/components/panels/StatePropertyPanel.tsx` | Human Task tab wiring |
| `.../workflow-validation/runtimeSyncRules.ts` (new) | C7 workflow rules |
| `.../workflow-validation/ValidationEngine.ts`, `.../canvas-interaction/utils/workflowLint.ts` | consume the rules |
| `.../function-editor/functionTaskKeys.ts` (new) | `toVariableName` mirror, collisions |
| `.../function-editor/components/{FunctionTaskKeyCollisions.tsx,FunctionRolesSection.tsx}` (new) | C7 function editor UI |
| `.../function-editor/components/{FunctionMultipleTasksSection.tsx,FunctionEditorPanel.tsx}` | wiring |

(`...` = `packages/designer-ui/src/modules`.)

---

### Task 1: Script panel writes into object holders on a state

**Files:**
- Modify: `packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.ts` (the state-list tail of `applyScriptValueToWorkflow`)
- Test: `packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.vitest.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `applyScriptValueToWorkflow` contract extension — for a state-level script whose `state[listField]` is a plain object (not an array), `scriptField` is a dotted path inside it; intermediate objects must already exist, otherwise no-op. Used by Task 3 (`listField: 'interaction'`, `scriptField: 'longPoll.rule'`) and Task 7 (`listField: 'subFlow'`, `scriptField: 'overrides.timeout.mapping'`).

- [ ] **Step 1: Write the failing tests**

Append to `ScriptWorkflowSync.vitest.test.ts` (after the final `});`):

```ts
describe('applyScriptValueToWorkflow — object holders on a state', () => {
  it('writes the long-poll rule under interaction.longPoll', () => {
    const draft = {
      attributes: {
        states: [
          { key: 'state-a', interaction: { longPoll: { terminate: true, rule: { location: '', code: '' } } } },
        ],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'interaction', scriptField: 'longPoll.rule' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.interaction.longPoll.rule).toEqual(nextValue);
  });

  it('writes the subflow timeout override mapping', () => {
    const draft = {
      attributes: {
        states: [{ key: 'state-a', subFlow: { overrides: { timeout: { key: 't', target: 'x' } } } }],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'overrides.timeout.mapping' }),
      nextValue,
    );

    expect((draft.attributes.states[0]!.subFlow.overrides.timeout as Record<string, unknown>).mapping).toEqual(
      nextValue,
    );
  });

  it('writes a flat field on an object holder (subFlow.mapping)', () => {
    const draft = { attributes: { states: [{ key: 'state-a', subFlow: { mapping: { code: 'old' } } }] } };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'mapping' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.subFlow.mapping).toEqual(nextValue);
  });

  it('is a no-op when an intermediate holder is missing', () => {
    const draft = { attributes: { states: [{ key: 'state-a', subFlow: {} as Record<string, unknown> }] } };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'overrides.timeout.mapping' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.subFlow).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/code-editor/ScriptWorkflowSync.vitest.test.ts`
Expected: FAIL — the first three new tests get `undefined` / the old value (object holders are ignored today); the no-op test passes.

- [ ] **Step 3: Implement the object-holder branch**

In `ScriptWorkflowSync.ts` replace the tail of `applyScriptValueToWorkflow`:

```ts
  const entries = state[activeScript.listField];
  if (!Array.isArray(entries)) return;

  const entry = entries[activeScript.index] as Record<string, unknown> | undefined;
  if (!entry) return;

  entry[activeScript.scriptField] = value;
}
```

with:

```ts
  const holder = state[activeScript.listField];

  if (Array.isArray(holder)) {
    const entry = holder[activeScript.index] as Record<string, unknown> | undefined;
    if (!entry) return;
    entry[activeScript.scriptField] = value;
    return;
  }

  // Object holders on a state (`interaction`, `subFlow`): `scriptField` is a
  // dotted path inside the holder, e.g. `longPoll.rule` or
  // `overrides.timeout.mapping`. Intermediate objects must already exist —
  // the owning editor creates them before the script panel opens.
  if (holder && typeof holder === 'object') {
    setAtDottedPath(holder as Record<string, unknown>, activeScript.scriptField, value);
  }
}

function setAtDottedPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = root;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return;
    cursor = next as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/code-editor/ScriptWorkflowSync.vitest.test.ts`
Expected: PASS (all old and new tests).

- [ ] **Step 5: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.ts packages/designer-ui/src/modules/code-editor/ScriptWorkflowSync.vitest.test.ts
git commit -m "$(cat <<'MSG'
fix(code-editor): script panel writes into object holders on a state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: `availableIn` is optional on every shared transition (C6)

**Files:**
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.ts` (`sharedTransitionPolicy`)
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSharedTransitionsSection.tsx` (`addSharedTransition`, `updateAvailableIn`)
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveFieldPolicy('shared', t).availableIn` = `{ visible: true, required: false }` for `TriggerType.Manual | Scheduled | Event`.

- [ ] **Step 1: Update the failing tests**

In `transitionFieldPolicy.vitest.test.ts`, inside `describe('resolveFieldPolicy — availableIn visibility', …)` replace the two tests

```ts
  it('is visible and required for a manual shared transition', () => {
    const policy = resolveFieldPolicy('shared', TriggerType.Manual).availableIn;
    expect(policy.visible).toBe(true);
    expect(policy.required).toBe(true);
  });

  it('is hidden for scheduled and event shared transitions', () => {
    expect(resolveFieldPolicy('shared', TriggerType.Scheduled).availableIn.visible).toBe(false);
    expect(resolveFieldPolicy('shared', TriggerType.Event).availableIn.visible).toBe(false);
  });
```

with

```ts
  it('is visible but optional for manual, scheduled and event shared transitions', () => {
    for (const triggerType of [TriggerType.Manual, TriggerType.Scheduled, TriggerType.Event]) {
      const policy = resolveFieldPolicy('shared', triggerType).availableIn;
      expect(policy.visible).toBe(true);
      expect(policy.required).toBe(false);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts`
Expected: FAIL — Manual reports `required: true`, Scheduled reports `visible: false`.

- [ ] **Step 3: Change the policy**

In `transitionFieldPolicy.ts` replace `sharedTransitionPolicy`:

```ts
function sharedTransitionPolicy(
  triggerType: TriggerType,
  triggerKind?: TriggerKind,
): TransitionFieldPolicyMap {
  const statePolicy = stateTransitionPolicy(triggerType, triggerKind);
  return {
    ...statePolicy,
    availableIn:
      triggerType === TriggerType.Manual ? VISIBLE_REQUIRED : HIDDEN,
  };
}
```

with:

```ts
function sharedTransitionPolicy(
  triggerType: TriggerType,
  triggerKind?: TriggerKind,
): TransitionFieldPolicyMap {
  const statePolicy = stateTransitionPolicy(triggerType, triggerKind);
  // Absent, null or empty `availableIn` means every state, for every trigger
  // type (vnext-schema master) — optional on Manual, Scheduled and Event alike.
  return { ...statePolicy, availableIn: VISIBLE_OPTIONAL };
}
```

- [ ] **Step 4: Stop forcing the key in the shared section**

In `WorkflowSharedTransitionsSection.tsx`:

1. In `addSharedTransition`, delete the line `        availableIn: [],` from the pushed object.
2. Replace the body of `updateAvailableIn`:

```ts
      updateWorkflow((draft: any) => {
        if (draft.attributes?.sharedTransitions?.[index]) {
          // Unlike the lifecycle transitions, `availableIn` is a required
          // property of a shared transition — an empty list keeps the key
          // present rather than dropping it.
          draft.attributes.sharedTransitions[index].availableIn = next ?? [];
        }
      });
```

with:

```ts
      updateWorkflow((draft) => {
        const shared = (draft.attributes as { sharedTransitions?: { availableIn?: AvailableIn }[] } | undefined)
          ?.sharedTransitions;
        const st = shared?.[index];
        if (!st) return;
        // Same convention as cancel / exit / updateData: absent means every
        // state, so a cleared list drops the key.
        if (next) st.availableIn = next;
        else delete st.availableIn;
      });
```

(`AvailableIn` is already imported in this file for the callback signature.)

- [ ] **Step 5: Run tests, type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/transition/transitionFieldPolicy.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowSharedTransitionsSection.tsx
git commit -m "$(cat <<'MSG'
feat(designer): availableIn is optional on every shared transition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Long-poll rule arm (C3)

**Files:**
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.vitest.test.ts`
- Modify (full rewrite): `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateInteractionEditor.tsx`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state/StateInteractionEditor.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/GeneralTab.tsx` (the `<StateInteractionEditor … />` element)

**Interfaces:**
- Consumes: Task 1 (script panel writes `interaction.longPoll.rule`); `LongPollConfig`, `LongPollRuleArm`, `MappingCode`, `RoleGrant` from `@vnext-forge-studio/vnext-types`.
- Produces (in `longPollConfig.ts`): `type LongPollArm = 'roles' | 'rule'`, `type LongPollArmIssue = 'both' | 'neither'`, `const EMPTY_RULE: MappingCode`, `currentLongPollArm(lp: LongPollConfig): LongPollArm`, `switchLongPollArm(lp: LongPollConfig, arm: LongPollArm): LongPollConfig`, `setLongPollRule(lp: LongPollConfig, rule: MappingCode): LongPollConfig`, `longPollArmIssue(lp: LongPollConfig): LongPollArmIssue | null`. `StateInteractionEditor` props gain `stateKey: string`.

- [ ] **Step 1: Write the failing helper tests**

In `longPollConfig.vitest.test.ts` replace the import line

```ts
import { isRuleArm, makeEmptyLongPoll, patchLongPoll } from './longPollConfig';
```

with

```ts
import {
  currentLongPollArm,
  isRuleArm,
  longPollArmIssue,
  makeEmptyLongPoll,
  patchLongPoll,
  setLongPollRule,
  switchLongPollArm,
} from './longPollConfig';
```

and append at the end of the file:

```ts
describe('long-poll arm switching', () => {
  const ROLES = [{ role: 'ovr.child-ack', grant: 'allow' as const }];

  it('switching to Rule drops roles and seeds an empty rule', () => {
    expect(switchLongPollArm({ terminate: true, fallbackTimeoutSeconds: 30, roles: ROLES }, 'rule')).toEqual({
      terminate: true,
      fallbackTimeoutSeconds: 30,
      rule: { location: '', code: '' },
    });
  });

  it('switching to Roles drops the rule and starts with no grants', () => {
    expect(switchLongPollArm({ terminate: false, rule: RULE }, 'roles')).toEqual({ terminate: false, roles: [] });
  });

  it('keeps the chosen arm value and clears the other when both are present', () => {
    const both = { terminate: true, roles: ROLES, rule: RULE } as unknown as LongPollConfig;
    expect(switchLongPollArm(both, 'rule')).toEqual({ terminate: true, rule: RULE });
    expect(switchLongPollArm(both, 'roles')).toEqual({ terminate: true, roles: ROLES });
  });

  it('setLongPollRule replaces the rule and keeps terminate and fallback', () => {
    const next = setLongPollRule({ terminate: true, fallbackTimeoutSeconds: 90, rule: { location: '', code: '' } }, RULE);
    expect(next).toEqual({ terminate: true, fallbackTimeoutSeconds: 90, rule: RULE });
  });

  it('reports the current arm', () => {
    expect(currentLongPollArm({ terminate: true, roles: [] })).toBe('roles');
    expect(currentLongPollArm({ terminate: true, rule: RULE })).toBe('rule');
  });

  it('flags both arms, no arm, and a rule without a script', () => {
    expect(longPollArmIssue({ terminate: true, roles: ROLES, rule: RULE } as unknown as LongPollConfig)).toBe('both');
    expect(longPollArmIssue({ terminate: true } as unknown as LongPollConfig)).toBe('neither');
    expect(longPollArmIssue({ terminate: true, rule: { location: '', code: '' } })).toBe('neither');
    expect(longPollArmIssue({ terminate: true, roles: [] })).toBeNull();
    expect(longPollArmIssue({ terminate: true, rule: RULE })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.vitest.test.ts`
Expected: FAIL — `switchLongPollArm is not a function` (and the other new exports).

- [ ] **Step 3: Implement the helpers**

In `longPollConfig.ts` change the type import to

```ts
import type {
  LongPollConfig,
  LongPollRuleArm,
  MappingCode,
  RoleGrant,
} from '@vnext-forge-studio/vnext-types';
```

and append at the end of the file:

```ts
export type LongPollArm = 'roles' | 'rule';
export type LongPollArmIssue = 'both' | 'neither';

/** A rule arm without a script yet — CsxEditorField shows its create buttons. */
export const EMPTY_RULE: MappingCode = { location: '', code: '' };

function commonFields(lp: LongPollConfig): { terminate: boolean; fallbackTimeoutSeconds?: number } {
  return lp.fallbackTimeoutSeconds === undefined
    ? { terminate: lp.terminate }
    : { terminate: lp.terminate, fallbackTimeoutSeconds: lp.fallbackTimeoutSeconds };
}

export function currentLongPollArm(lp: LongPollConfig): LongPollArm {
  return isRuleArm(lp) ? 'rule' : 'roles';
}

/**
 * Moves the long poll to `arm`, clearing the other arm. The chosen arm keeps
 * its existing value when the document already carries one (a hand-edited
 * document can hold both); otherwise it starts empty.
 */
export function switchLongPollArm(lp: LongPollConfig, arm: LongPollArm): LongPollConfig {
  const common = commonFields(lp);
  if (arm === 'rule') {
    const rule = (lp as { rule?: MappingCode }).rule;
    return { ...common, rule: rule ?? { ...EMPTY_RULE } };
  }
  const roles = (lp as { roles?: RoleGrant[] }).roles;
  return { ...common, roles: Array.isArray(roles) ? roles : [] };
}

export function setLongPollRule(lp: LongPollConfig, rule: MappingCode): LongPollConfig {
  return { ...commonFields(lp), rule };
}

/**
 * `both`: roles and rule are present (schema `oneOf` violation).
 * `neither`: no arm, or a rule arm whose script is still empty.
 */
export function longPollArmIssue(lp: LongPollConfig): LongPollArmIssue | null {
  const rec = lp as { roles?: unknown; rule?: MappingCode };
  const hasRoles = rec.roles !== undefined;
  const hasRule = rec.rule !== undefined;
  if (hasRoles && hasRule) return 'both';
  if (!hasRoles && !hasRule) return 'neither';
  if (hasRule && !rec.rule?.code) return 'neither';
  return null;
}
```

- [ ] **Step 4: Run to verify the helper tests pass**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/state/longPollConfig.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing editor test**

Create `StateInteractionEditor.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StateInteraction } from '@vnext-forge-studio/vnext-types';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: (props: { templateType: string; listField: string; scriptField: string }) =>
    createElement('div', { 'data-csx': `${props.templateType}:${props.listField}:${props.scriptField}` }),
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));

const { StateInteractionEditor } = await import('./StateInteractionEditor');

const RULE = { location: './src/InteractionGate.csx', code: 'cmV0dXJuIHRydWU7' };

function render(interaction: StateInteraction | null): string {
  return renderToStaticMarkup(
    createElement(StateInteractionEditor, { interaction, stateKey: 'lp-wait', onChange: () => undefined }),
  );
}

describe('StateInteractionEditor', () => {
  it('shows the Roles arm selected with the role editor', () => {
    const html = render({ longPoll: { terminate: true, roles: [{ role: 'ovr.child-ack', grant: 'allow' }] } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Roles<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Rule<\/button>/);
    expect(html).toContain('value="ovr.child-ack"');
    expect(html).not.toContain('data-csx');
  });

  it('shows the Rule arm with a condition script bound to interaction.longPoll.rule', () => {
    const html = render({ longPoll: { terminate: true, rule: RULE } });
    expect(html).toMatch(/aria-pressed="true"[^>]*>Rule<\/button>/);
    expect(html).toContain('data-csx="condition:interaction:longPoll.rule"');
    expect(html).not.toContain('e.g. morph-idm.maker');
  });

  it('warns when both arms are present', () => {
    const html = render({
      longPoll: { terminate: true, roles: [], rule: RULE } as unknown as StateInteraction['longPoll'],
    });
    expect(html).toContain('Both roles and a rule are set');
  });

  it('warns when the rule has no script yet', () => {
    const html = render({ longPoll: { terminate: true, rule: { location: '', code: '' } } });
    expect(html).toContain('No authorization is set');
  });

  it('offers to add a long poll when there is none', () => {
    expect(render(null)).toContain('Add long poll');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/state/StateInteractionEditor.vitest.test.tsx`
Expected: FAIL — no `aria-pressed` buttons, no `data-csx`.

- [ ] **Step 7: Rewrite `StateInteractionEditor.tsx`**

Replace the whole file with:

```tsx
/**
 * Editor for `state.interaction.longPoll`.
 *
 * Authorization is exactly one arm — role grants or a condition rule
 * (schema `oneOf`). "Authorize by" switches arms and clears the other one
 * (`switchLongPollArm`). Every write goes through `longPollConfig.ts`, so the
 * editor can never produce both arms.
 *
 * Fully controlled — `onChange(next | null)` fires for every mutation;
 * GeneralTab strips `interaction` when it is cleared.
 */
import type { MappingCode, StateInteraction } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import {
  EditableInput,
  IconPlus,
  IconTrash,
  SelectField,
  Section,
} from '../PropertyPanelShared';
import { RoleGrantEditor } from '../subflow/RoleGrantEditor';
import {
  EMPTY_RULE,
  currentLongPollArm,
  isRuleArm,
  longPollArmIssue,
  makeEmptyLongPoll,
  patchLongPoll as applyLongPollPatch,
  setLongPollRule,
  switchLongPollArm,
  type LongPollArm,
  type LongPollArmIssue,
  type LongPollPatch,
} from './longPollConfig';

interface StateInteractionEditorProps {
  interaction: StateInteraction | null;
  /** Owning state — addresses the rule script for the script panel. */
  stateKey: string;
  onChange: (next: StateInteraction | null) => void;
}

const TERMINATE_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

const ARMS: readonly { value: LongPollArm; label: string }[] = [
  { value: 'roles', label: 'Roles' },
  { value: 'rule', label: 'Rule' },
];

const ARM_ISSUE_MESSAGES: Record<LongPollArmIssue, string> = {
  both: 'Both roles and a rule are set. The schema allows only one — pick the arm to keep.',
  neither: 'No authorization is set. Add role grants or create a rule script.',
};

export function StateInteractionEditor({ interaction, stateKey, onChange }: StateInteractionEditorProps) {
  const longPoll = interaction?.longPoll ?? null;

  const patchLongPoll = (patch: LongPollPatch): void => {
    onChange({ longPoll: applyLongPollPatch(longPoll, patch) });
  };

  const addLongPoll = (): void => {
    onChange({ longPoll: makeEmptyLongPoll() });
  };

  const removeLongPoll = (): void => {
    // Clearing longPoll clears the whole interaction block — it's the
    // only member today.
    onChange(null);
  };

  const arm: LongPollArm | null = longPoll ? currentLongPollArm(longPoll) : null;
  const issue = longPoll ? longPollArmIssue(longPoll) : null;
  const ruleArm = longPoll && isRuleArm(longPoll) ? longPoll : null;
  const roles = longPoll && !isRuleArm(longPoll) && Array.isArray(longPoll.roles) ? longPoll.roles : [];

  const selectArm = (next: LongPollArm): void => {
    if (!longPoll) return;
    if (arm === next && issue !== 'both') return;
    onChange({ longPoll: switchLongPollArm(longPoll, next) });
  };

  const writeRule = (rule: MappingCode): void => {
    if (!longPoll) return;
    onChange({ longPoll: setLongPollRule(longPoll, rule) });
  };

  return (
    <Section
      title="Interaction"
      count={longPoll ? 1 : 0}
      defaultOpen={!!longPoll}>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Configure long polling so the client workflow manager knows when to
        terminate an open request for this state.
      </p>
      {!longPoll ? (
        <button
          type="button"
          onClick={addLongPoll}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Add long poll
        </button>
      ) : (
        <div className="border border-border-subtle rounded-xl bg-surface p-2.5 space-y-2.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Terminate
              </label>
              <SelectField
                value={longPoll.terminate ? 'true' : 'false'}
                onChange={(v) => patchLongPoll({ terminate: v === 'true' })}
                options={[...TERMINATE_OPTIONS]}
              />
            </div>
            <div className="w-28 shrink-0">
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Fallback (s)
              </label>
              <EditableInput
                value={
                  longPoll.fallbackTimeoutSeconds === undefined
                    ? ''
                    : String(longPoll.fallbackTimeoutSeconds)
                }
                onChange={(v) => {
                  const n = Number(v);
                  patchLongPoll({
                    fallbackTimeoutSeconds:
                      v.trim() === '' || !Number.isFinite(n) ? undefined : n,
                  });
                }}
                mono
                placeholder="e.g. 30"
              />
            </div>
            <button
              type="button"
              onClick={removeLongPoll}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1.5 mt-4 transition-all"
              aria-label="Remove long poll"
              title="Remove long poll">
              <IconTrash />
            </button>
          </div>

          <div>
            <span className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
              Authorize by
            </span>
            <div
              role="group"
              aria-label="Authorize by"
              className="inline-flex rounded-lg border border-border bg-muted-surface p-0.5">
              {ARMS.map((option) => {
                const active = arm === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectArm(option.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-surface text-secondary-icon shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {issue && (
            <p
              role="alert"
              className="rounded-md border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text leading-relaxed">
              {ARM_ISSUE_MESSAGES[issue]}
            </p>
          )}

          {ruleArm ? (
            <div>
              <label className="text-[9px] font-medium text-muted-foreground mb-0.5 block">
                Rule
              </label>
              <p className="text-[10px] text-muted-foreground mb-1 leading-relaxed">
                Condition script (IConditionMapping) evaluated per caller. It reads
                context.Instance.Data; context.Body is not populated here. A false,
                throwing or non-compiling rule denies.
              </p>
              <CsxEditorField
                value={ruleArm.rule as ScriptCode}
                onChange={(sc) => writeRule(sc as MappingCode)}
                onRemove={() => writeRule({ ...EMPTY_RULE })}
                templateType="condition"
                contextName={`${stateKey}-longpoll-rule`}
                label="Long poll rule"
                stateKey={stateKey}
                listField="interaction"
                index={0}
                scriptField="longPoll.rule"
                allowRefEncoding
              />
              {ruleArm.rule.code ? (
                <MappingScriptsSection
                  value={ruleArm.rule.scripts}
                  onChange={(scripts) => writeRule({ ...ruleArm.rule, scripts })}
                />
              ) : null}
            </div>
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
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 8: Pass `stateKey` from GeneralTab**

In `GeneralTab.tsx` replace

```tsx
      <StateInteractionEditor
        interaction={(state.interaction as StateInteraction | null | undefined) ?? null}
        onChange={updateInteraction}
      />
```

with

```tsx
      <StateInteractionEditor
        interaction={(state.interaction as StateInteraction | null | undefined) ?? null}
        stateKey={String(stateKey)}
        onChange={updateInteraction}
      />
```

- [ ] **Step 9: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/state && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS (both test files), exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/state packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/GeneralTab.tsx
git commit -m "$(cat <<'MSG'
feat(designer): long-poll authorization by roles or a condition rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Workflow timeout annotations (C1, workflow part)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowTimeoutSection.tsx`

**Interfaces:**
- Consumes: `Annotations` from `@vnext-forge-studio/vnext-types`; `TransitionAnnotationsSection` (`annotations: Record<string,string> | undefined`, `onChange(next | undefined)`).
- Produces: `interface TimeoutFieldHolder { annotations?: Annotations | null; _comment?: string }`, `setTimeoutAnnotations(t: TimeoutFieldHolder, next: Annotations | undefined): void`, `setTimeoutComment(t: TimeoutFieldHolder, text: string): void` (Task 7 reuses both).

- [ ] **Step 1: Write the failing test**

Create `timeoutFields.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { setTimeoutAnnotations, setTimeoutComment, type TimeoutFieldHolder } from './timeoutFields';

describe('setTimeoutAnnotations', () => {
  it('writes non-empty annotations', () => {
    const t: TimeoutFieldHolder = {};
    setTimeoutAnnotations(t, { 'ui/countdown': 'root-deadline' });
    expect(t).toEqual({ annotations: { 'ui/countdown': 'root-deadline' } });
  });

  it('drops the key when cleared or emptied', () => {
    const cleared: TimeoutFieldHolder = { annotations: { a: '1' } };
    setTimeoutAnnotations(cleared, undefined);
    expect('annotations' in cleared).toBe(false);

    const emptied: TimeoutFieldHolder = { annotations: { a: '1' } };
    setTimeoutAnnotations(emptied, {});
    expect('annotations' in emptied).toBe(false);
  });
});

describe('setTimeoutComment', () => {
  it('writes the text as typed', () => {
    const t: TimeoutFieldHolder = {};
    setTimeoutComment(t, 'Abandon after 20 seconds ');
    expect(t._comment).toBe('Abandon after 20 seconds ');
  });

  it('drops the key for blank text', () => {
    const t: TimeoutFieldHolder = { _comment: 'old' };
    setTimeoutComment(t, '   ');
    expect('_comment' in t).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.vitest.test.ts`
Expected: FAIL — cannot resolve `./timeoutFields`.

- [ ] **Step 3: Implement `timeoutFields.ts`**

```ts
import type { Annotations } from '@vnext-forge-studio/vnext-types';

/**
 * Writers shared by the workflow timeout section and the subflow timeout
 * override editor. Both hold a `workflowTimeout`; empty values drop their key
 * so the saved JSON stays minimal.
 */
export interface TimeoutFieldHolder {
  annotations?: Annotations | null;
  _comment?: string;
}

export function setTimeoutAnnotations(t: TimeoutFieldHolder, next: Annotations | undefined): void {
  if (next && Object.keys(next).length > 0) t.annotations = next;
  else delete t.annotations;
}

export function setTimeoutComment(t: TimeoutFieldHolder, text: string): void {
  if (text.trim() === '') delete t._comment;
  else t._comment = text;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Embed annotations in `WorkflowTimeoutSection`**

In `WorkflowTimeoutSection.tsx` change the vnext-types import to `import type { ScriptsConfig, TimeoutTransition } from '@vnext-forge-studio/vnext-types';` and add after the `MetadataSection` import:

```ts
import { TransitionAnnotationsSection } from '../tabs/transition/TransitionAnnotationsSection';
import { setTimeoutAnnotations } from '../tabs/shared/timeoutFields';
```

Then, directly after the Description block (the `<div>` that closes after the `aria-label="Timeout description"` textarea), insert:

```tsx
          <TransitionAnnotationsSection
            annotations={(timeout as TimeoutTransition).annotations ?? undefined}
            onChange={(next) => {
              updateWorkflow((draft) => {
                const t = (draft.attributes as { timeout?: TimeoutTransition } | undefined)?.timeout;
                if (t) setTimeoutAnnotations(t, next);
              });
            }}
          />
```

(`timeout` is `any` in this file; the casts keep the new lines free of `no-unsafe-*` errors.)

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/shared/timeoutFields.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/sections/WorkflowTimeoutSection.tsx
git commit -m "$(cat <<'MSG'
feat(designer): annotations on the workflow timeout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Child workflow summary for subflow pickers (C2 foundation)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/useChildWorkflowSummary.ts`
- Modify: `packages/designer-ui/src/modules/vnext-workspace/resolveWorkflowFileByKey.ts` (`useWorkflowFileResolver`)

**Interfaces:**
- Consumes: `useWorkflowFileResolver` (existing), `readFile(path): Promise<{ content: string }>` from `modules/project-workspace/WorkspaceApi`.
- Produces:
  - `type ChildWorkflowLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable'`
  - `interface ChildStateSummary { key: string; longPollAuth: 'roles' | 'rule' | null; viewKeys: string[] }`
  - `interface ChildTransitionSummary { key: string; viewKeys: string[] }`
  - `interface ChildWorkflowSummary { states: ChildStateSummary[]; transitions: ChildTransitionSummary[] }`
  - `interface ChildWorkflowLoad { status: ChildWorkflowLoadStatus; summary: ChildWorkflowSummary | null }`
  - `summarizeChildWorkflow(json: unknown): ChildWorkflowSummary | null`
  - `useChildWorkflowSummary(processKey: string, processDomain: string): ChildWorkflowLoad`
  - `useWorkflowFileResolver()` now returns `(workflowKey: string, workflowDomain?: string, options?: ResolveWorkflowFileOptions) => Promise<ResolvedWorkflowFile | null>` with `interface ResolveWorkflowFileOptions { quiet?: boolean }` (existing callers unchanged).

- [ ] **Step 1: Write the failing test**

Create `childWorkflowSummary.vitest.test.ts` (fixture trimmed from `vnext-example/core/Workflows/subflow-override-lab/subflow-override-lab-child.json`, plus a rule-gated state, a shared transition and `cancel`):

```ts
import { describe, expect, it } from 'vitest';
import { summarizeChildWorkflow } from './childWorkflowSummary';

const view = (key: string) => ({ view: { key, domain: 'core', version: '1.0.0', flow: 'sys-views' }, loadData: false });

const CHILD = {
  key: 'subflow-override-lab-child',
  attributes: {
    states: [
      { key: 'child-initial', stateType: 1, transitions: [{ key: 'auto-child-to-lp-wait', target: 'lp-wait', triggerType: 1 }] },
      {
        key: 'lp-wait',
        stateType: 2,
        subType: 6,
        interaction: { longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [{ role: 'ovr.child-ack', grant: 'allow' }] } },
        view: view('subflow-override-lab-child-lp-view'),
        transitions: [
          { key: 'confirm', target: 'child-done', triggerType: 0, view: view('subflow-override-lab-child-confirm-view') },
          { key: 'note', target: '$self', triggerType: 0, views: [view('subflow-override-lab-child-lp-view')] },
        ],
      },
      {
        key: 'gate',
        stateType: 2,
        interaction: { longPoll: { terminate: true, rule: { location: './src/Gate.csx', code: 'eA==' } } },
        transitions: [],
      },
      { key: 'child-done', stateType: 3, subType: 1, transitions: [] },
    ],
    sharedTransitions: [{ key: 'escalate', target: 'child-done', triggerType: 0, availableIn: [] }],
    cancel: { key: 'cancel', target: 'child-done', triggerType: 0, view: view('cancel-view') },
  },
};

describe('summarizeChildWorkflow', () => {
  it('lists states with their long-poll arm and view keys', () => {
    expect(summarizeChildWorkflow(CHILD)?.states).toEqual([
      { key: 'child-initial', longPollAuth: null, viewKeys: [] },
      { key: 'lp-wait', longPollAuth: 'roles', viewKeys: ['subflow-override-lab-child-lp-view'] },
      { key: 'gate', longPollAuth: 'rule', viewKeys: [] },
      { key: 'child-done', longPollAuth: null, viewKeys: [] },
    ]);
  });

  it('lists state, shared and lifecycle transitions with their view keys', () => {
    expect(summarizeChildWorkflow(CHILD)?.transitions).toEqual([
      { key: 'auto-child-to-lp-wait', viewKeys: [] },
      { key: 'confirm', viewKeys: ['subflow-override-lab-child-confirm-view'] },
      { key: 'note', viewKeys: ['subflow-override-lab-child-lp-view'] },
      { key: 'escalate', viewKeys: [] },
      { key: 'cancel', viewKeys: ['cancel-view'] },
    ]);
  });

  it('merges view keys of transitions that share a key across states', () => {
    const json = {
      attributes: {
        states: [
          { key: 'a', transitions: [{ key: 'go', view: view('v1') }] },
          { key: 'b', transitions: [{ key: 'go', view: view('v2') }] },
        ],
      },
    };
    expect(summarizeChildWorkflow(json)?.transitions).toEqual([{ key: 'go', viewKeys: ['v1', 'v2'] }]);
  });

  it('returns null for something that is not a workflow', () => {
    expect(summarizeChildWorkflow(null)).toBeNull();
    expect(summarizeChildWorkflow({ attributes: {} })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.vitest.test.ts`
Expected: FAIL — cannot resolve `./childWorkflowSummary`.

- [ ] **Step 3: Implement `childWorkflowSummary.ts`**

```ts
/**
 * Reduces a child workflow definition to what the parent's subflow override
 * editors need: state keys (with their long-poll arm and the view keys their
 * rules can select) and transition keys (with their view keys). Pure — the
 * loading lives in `useChildWorkflowSummary`.
 */

export type ChildWorkflowLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface ChildStateSummary {
  key: string;
  /** `null` when the state declares no `interaction.longPoll`. */
  longPollAuth: 'roles' | 'rule' | null;
  viewKeys: string[];
}

export interface ChildTransitionSummary {
  key: string;
  viewKeys: string[];
}

export interface ChildWorkflowSummary {
  states: ChildStateSummary[];
  transitions: ChildTransitionSummary[];
}

export interface ChildWorkflowLoad {
  status: ChildWorkflowLoadStatus;
  summary: ChildWorkflowSummary | null;
}

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function viewKeysOf(holder: Rec): string[] {
  const keys: string[] = [];
  const push = (binding: unknown): void => {
    if (!isRec(binding) || !isRec(binding.view)) return;
    const key = binding.view.key;
    if (typeof key === 'string' && key !== '' && !keys.includes(key)) keys.push(key);
  };
  push(holder.view);
  if (Array.isArray(holder.views)) (holder.views as unknown[]).forEach(push);
  return keys;
}

function longPollAuthOf(state: Rec): 'roles' | 'rule' | null {
  const longPoll = isRec(state.interaction) ? state.interaction.longPoll : undefined;
  if (!isRec(longPoll)) return null;
  return longPoll.rule !== undefined && longPoll.rule !== null ? 'rule' : 'roles';
}

export function summarizeChildWorkflow(json: unknown): ChildWorkflowSummary | null {
  if (!isRec(json) || !isRec(json.attributes) || !Array.isArray(json.attributes.states)) return null;
  const attributes = json.attributes;

  const states: ChildStateSummary[] = [];
  const transitions = new Map<string, string[]>();

  const addTransition = (transition: unknown): void => {
    if (!isRec(transition) || typeof transition.key !== 'string' || transition.key === '') return;
    const viewKeys = transitions.get(transition.key) ?? [];
    for (const key of viewKeysOf(transition)) {
      if (!viewKeys.includes(key)) viewKeys.push(key);
    }
    transitions.set(transition.key, viewKeys);
  };

  for (const state of attributes.states as unknown[]) {
    if (!isRec(state) || typeof state.key !== 'string') continue;
    states.push({ key: state.key, longPollAuth: longPollAuthOf(state), viewKeys: viewKeysOf(state) });
    if (Array.isArray(state.transitions)) (state.transitions as unknown[]).forEach(addTransition);
  }
  if (Array.isArray(attributes.sharedTransitions)) (attributes.sharedTransitions as unknown[]).forEach(addTransition);
  for (const lifecycle of ['cancel', 'exit', 'updateData'] as const) addTransition(attributes[lifecycle]);

  return {
    states,
    transitions: [...transitions].map(([key, viewKeys]) => ({ key, viewKeys })),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Add a `quiet` option to the resolver**

In `resolveWorkflowFileByKey.ts`:

1. Above `export function useWorkflowFileResolver()`, add:

```ts
export interface ResolveWorkflowFileOptions {
  /**
   * Suppress the warning notifications. For background lookups (the subflow
   * override pickers) where a missing child just means "free text keys".
   */
  quiet?: boolean;
}
```

2. Change the hook's return type and callback signature:

```ts
export function useWorkflowFileResolver(): (
  workflowKey: string,
  workflowDomain?: string,
  options?: ResolveWorkflowFileOptions,
) => Promise<ResolvedWorkflowFile | null> {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);

  return useCallback(
    async (workflowKey: string, workflowDomain?: string, options?: ResolveWorkflowFileOptions) => {
      const notify: typeof showNotification = options?.quiet ? () => undefined : showNotification;
      if (!workflowKey) return null;
```

3. Inside that callback, replace each of the four `showNotification({` calls with `notify({` (no active project, foreign domain, not found, failed to resolve). Leave the rest of the body unchanged. (`showNotification(options: NotificationOptions): void`, so `() => undefined` is assignable to `typeof showNotification`.)

- [ ] **Step 6: Create `useChildWorkflowSummary.ts`**

```ts
import { useEffect, useState } from 'react';

import { readFile } from '../../../../../project-workspace/WorkspaceApi';
import { useWorkflowFileResolver } from '../../../../../vnext-workspace/resolveWorkflowFileByKey';
import { summarizeChildWorkflow, type ChildWorkflowLoad } from './childWorkflowSummary';

const IDLE: ChildWorkflowLoad = { status: 'idle', summary: null };
const UNAVAILABLE: ChildWorkflowLoad = { status: 'unavailable', summary: null };

/**
 * Loads the subflow's child definition with the same resolution the canvas
 * uses to open a subflow (sibling-solution aware), but quietly: a child that
 * cannot be found only turns the override pickers into free-text inputs.
 */
export function useChildWorkflowSummary(processKey: string, processDomain: string): ChildWorkflowLoad {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [load, setLoad] = useState<ChildWorkflowLoad>(IDLE);

  useEffect(() => {
    if (!processKey) {
      setLoad(IDLE);
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading', summary: null });
    void (async () => {
      try {
        const resolved = await resolveWorkflowFile(processKey, processDomain || undefined, { quiet: true });
        if (!resolved) {
          if (!cancelled) setLoad(UNAVAILABLE);
          return;
        }
        const file = await readFile(resolved.path);
        const summary = summarizeChildWorkflow(JSON.parse(file.content));
        if (!cancelled) setLoad(summary ? { status: 'ready', summary } : UNAVAILABLE);
      } catch {
        if (!cancelled) setLoad(UNAVAILABLE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processKey, processDomain, resolveWorkflowFile]);

  return load;
}
```

(The hook is glue over the existing resolver and `readFile`; its logic is `summarizeChildWorkflow`, tested above. It is exercised end to end in Task 14.)

- [ ] **Step 7: Type-check, run the existing resolver tests, commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/vnext-workspace src/modules/canvas-interaction/components/panels/tabs/subflow`
Expected: exit 0; PASS.

```bash
git add packages/designer-ui/src/modules/vnext-workspace/resolveWorkflowFileByKey.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/childWorkflowSummary.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/useChildWorkflowSummary.ts
git commit -m "$(cat <<'MSG'
feat(designer): load the subflow child definition for override pickers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Subflow override rules (C2, pure)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.vitest.test.ts`

**Interfaces:**
- Consumes: `ChildWorkflowSummary` (Task 5); `ResourceReference`, `RoleGrant`, `SubFlowConfig`, `SubFlowStateOverride` from `@vnext-forge-studio/vnext-types`.
- Produces:
  - `type SubFlowOverrideSource = Pick<SubFlowConfig, 'overrides' | 'viewOverrides'>`
  - `countOverrides(sf: SubFlowOverrideSource): number`
  - `type OverrideWarningCode = 'roles-empty' | 'roles-ignored-rule' | 'longpoll-inert' | 'legacy-views' | 'mixed-views'`; `interface OverrideWarning { code: OverrideWarningCode; message: string }`
  - `overrideWarnings(sf: SubFlowOverrideSource, child: ChildWorkflowSummary | null): OverrideWarning[]`
  - `legacyViewOverrides(sf): Record<string, ResourceReference>`, `hasLegacyViews(sf): boolean`
  - `interface LegacyViewMigrationPlan { states: Record<string, Record<string, ResourceReference>>; transitions: Record<string, Record<string, ResourceReference>>; unplaced: string[] }`
  - `planLegacyViewMigration(sf, child: ChildWorkflowSummary): LegacyViewMigrationPlan`
  - `applyLegacyViewMigration(sf: SubFlowConfig, plan: LegacyViewMigrationPlan): void` (mutates; no-op when `plan.unplaced` is non-empty)
  - `type FallbackParse = { ok: true; value: number | undefined } | { ok: false }`; `parseFallbackSeconds(text: string): FallbackParse`
  - `interface LongPollOverridePatch { fallbackTimeoutSeconds?: number | undefined; roles?: RoleGrant[] | undefined }`; `setLongPollOverride(entry: SubFlowStateOverride, patch: LongPollOverridePatch): void` (mutates; present-with-undefined removes the field; empty long poll removes `interaction`)
  - `renameRecordKey<T>(record: Record<string, T>, from: string, to: string): boolean` (order-preserving; refuses a clash)
  - `nextOverrideKey(record: Record<string, unknown>, options: string[], prefix: string): string`

- [ ] **Step 1: Write the failing test**

Create `subFlowOverrides.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ResourceReference, SubFlowConfig, SubFlowStateOverride } from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';
import {
  applyLegacyViewMigration,
  countOverrides,
  hasLegacyViews,
  nextOverrideKey,
  overrideWarnings,
  parseFallbackSeconds,
  planLegacyViewMigration,
  renameRecordKey,
  setLongPollOverride,
} from './subFlowOverrides';

const ref = (key: string): ResourceReference => ({ key, domain: 'core', version: '1.0.0', flow: 'sys-views' });
const PROCESS = { key: 'subflow-override-lab-child', domain: 'core', version: '1.0.2', flow: 'sys-flows' };

const CHILD: ChildWorkflowSummary = {
  states: [
    { key: 'lp-wait', longPollAuth: 'roles', viewKeys: ['child-lp-view'] },
    { key: 'gate', longPollAuth: 'rule', viewKeys: [] },
    { key: 'child-done', longPollAuth: null, viewKeys: [] },
  ],
  transitions: [
    { key: 'confirm', viewKeys: ['child-confirm-view'] },
    { key: 'note', viewKeys: ['child-lp-view'] },
  ],
};

describe('countOverrides', () => {
  it('counts every set field, view swaps and legacy entries', () => {
    const sf: SubFlowConfig = {
      type: 'S',
      process: PROCESS,
      viewOverrides: { 'old-view': ref('x') },
      overrides: {
        timeout: { key: 'child-abandoned', target: 'child-timedout' },
        transitions: { confirm: { roles: [], views: { 'child-confirm-view': ref('p') } } },
        states: {
          'lp-wait': {
            queryRoles: [{ role: 'a', grant: 'allow' }],
            interaction: { longPoll: { fallbackTimeoutSeconds: 120, roles: [] } },
            views: { 'child-lp-view': ref('q') },
          },
          'child-done': {},
        },
      },
    };
    // timeout 1 + confirm roles 1 + confirm view 1 + lp-wait queryRoles 1 + window 1 + lp roles 1 + lp view 1 + legacy 1
    expect(countOverrides(sf)).toBe(8);
  });

  it('is zero without overrides', () => {
    expect(countOverrides({})).toBe(0);
  });
});

describe('overrideWarnings', () => {
  it('flags empty role lists', () => {
    const codes = overrideWarnings(
      {
        overrides: {
          transitions: { confirm: { roles: [] } },
          states: { 'lp-wait': { queryRoles: [], interaction: { longPoll: { roles: [] } } } },
        },
      },
      null,
    ).map((w) => w.code);
    expect(codes).toEqual(['roles-empty', 'roles-empty', 'roles-empty']);
  });

  it('flags a roles override on a rule-gated child long poll', () => {
    const warnings = overrideWarnings(
      { overrides: { states: { gate: { interaction: { longPoll: { roles: [{ role: 'p', grant: 'allow' }] } } } } } },
      CHILD,
    );
    expect(warnings).toEqual([expect.objectContaining({ code: 'roles-ignored-rule' })]);
    expect(warnings[0].message).toContain('gate');
  });

  it('flags a long-poll override on a child state without a long poll', () => {
    const warnings = overrideWarnings(
      { overrides: { states: { 'child-done': { interaction: { longPoll: { fallbackTimeoutSeconds: 30 } } } } } },
      CHILD,
    );
    expect(warnings.map((w) => w.code)).toEqual(['longpoll-inert']);
  });

  it('does not judge child-dependent rules without a child or for unknown keys', () => {
    const sf = { overrides: { states: { gate: { interaction: { longPoll: { roles: [{ role: 'p', grant: 'allow' as const }] } } } } } };
    expect(overrideWarnings(sf, null)).toEqual([]);
    expect(overrideWarnings({ overrides: { states: { unknown: { interaction: { longPoll: { fallbackTimeoutSeconds: 5 } } } } } }, CHILD)).toEqual([]);
  });

  it('flags legacy views, and mixing them with scoped views', () => {
    expect(overrideWarnings({ viewOverrides: { v: ref('x') } }, null).map((w) => w.code)).toEqual(['legacy-views']);
    expect(
      overrideWarnings(
        { overrides: { views: { v: ref('x') }, states: { 'lp-wait': { views: { w: ref('y') } } } } },
        null,
      ).map((w) => w.code),
    ).toEqual(['legacy-views', 'mixed-views']);
  });
});

describe('legacy view migration', () => {
  it('places each legacy view on every child state and transition that selects it', () => {
    const sf: SubFlowConfig = { type: 'S', process: PROCESS, overrides: { views: { 'child-lp-view': ref('legacy') } } };
    const plan = planLegacyViewMigration(sf, CHILD);
    expect(plan).toEqual({
      states: { 'lp-wait': { 'child-lp-view': ref('legacy') } },
      transitions: { note: { 'child-lp-view': ref('legacy') } },
      unplaced: [],
    });

    applyLegacyViewMigration(sf, plan);
    expect(sf).toEqual({
      type: 'S',
      process: PROCESS,
      overrides: {
        states: { 'lp-wait': { views: { 'child-lp-view': ref('legacy') } } },
        transitions: { note: { views: { 'child-lp-view': ref('legacy') } } },
      },
    });
    expect(hasLegacyViews(sf)).toBe(false);
  });

  it('reads subFlow.viewOverrides too and keeps existing scoped entries', () => {
    const sf: SubFlowConfig = {
      type: 'S',
      process: PROCESS,
      viewOverrides: { 'child-confirm-view': ref('legacy') },
      overrides: { transitions: { confirm: { views: { 'child-confirm-view': ref('scoped') } } } },
    };
    applyLegacyViewMigration(sf, planLegacyViewMigration(sf, CHILD));
    expect(sf.viewOverrides).toBeUndefined();
    expect(sf.overrides?.transitions?.confirm.views).toEqual({ 'child-confirm-view': ref('scoped') });
  });

  it('refuses when a legacy key is selected nowhere in the child', () => {
    const sf: SubFlowConfig = { type: 'S', process: PROCESS, viewOverrides: { ghost: ref('x') } };
    const plan = planLegacyViewMigration(sf, CHILD);
    expect(plan.unplaced).toEqual(['ghost']);
    applyLegacyViewMigration(sf, plan);
    expect(sf.viewOverrides).toEqual({ ghost: ref('x') });
  });
});

describe('parseFallbackSeconds', () => {
  it('accepts whole numbers of at least 1 and blank', () => {
    expect(parseFallbackSeconds('120')).toEqual({ ok: true, value: 120 });
    expect(parseFallbackSeconds(' ')).toEqual({ ok: true, value: undefined });
  });

  it('rejects zero, negatives, fractions and text', () => {
    for (const text of ['0', '-5', '1.5', 'abc']) expect(parseFallbackSeconds(text)).toEqual({ ok: false });
  });
});

describe('setLongPollOverride', () => {
  it('sets and clears single fields, dropping an empty interaction', () => {
    const entry: SubFlowStateOverride = {};
    setLongPollOverride(entry, { fallbackTimeoutSeconds: 180 });
    expect(entry).toEqual({ interaction: { longPoll: { fallbackTimeoutSeconds: 180 } } });

    setLongPollOverride(entry, { roles: [] });
    expect(entry).toEqual({ interaction: { longPoll: { fallbackTimeoutSeconds: 180, roles: [] } } });

    setLongPollOverride(entry, { fallbackTimeoutSeconds: undefined });
    expect(entry).toEqual({ interaction: { longPoll: { roles: [] } } });

    setLongPollOverride(entry, { roles: undefined });
    expect(entry).toEqual({});
  });
});

describe('record key helpers', () => {
  it('renames in place, preserving order', () => {
    const record: Record<string, number> = { a: 1, b: 2, c: 3 };
    expect(renameRecordKey(record, 'b', 'x')).toBe(true);
    expect(Object.keys(record)).toEqual(['a', 'x', 'c']);
    expect(record.x).toBe(2);
  });

  it('refuses a clash or a missing source', () => {
    const record: Record<string, number> = { a: 1, b: 2 };
    expect(renameRecordKey(record, 'a', 'b')).toBe(false);
    expect(renameRecordKey(record, 'zzz', 'y')).toBe(false);
    expect(record).toEqual({ a: 1, b: 2 });
  });

  it('suggests the first unused option, else a numbered key', () => {
    expect(nextOverrideKey({ confirm: 1 }, ['confirm', 'note'], 'transition')).toBe('note');
    expect(nextOverrideKey({ 'state-2': 1 }, [], 'state')).toBe('state-3');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.vitest.test.ts`
Expected: FAIL — cannot resolve `./subFlowOverrides`.

- [ ] **Step 3: Implement `subFlowOverrides.ts`**

```ts
import type {
  ResourceReference,
  RoleGrant,
  SubFlowConfig,
  SubFlowLongPollOverride,
  SubFlowOverrides,
  SubFlowStateOverride,
} from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';

/**
 * Pure rules for `state.subFlow.overrides` (runtime: vnext
 * docs/domain/subflow-overrides.md). Components render what these return and
 * write through the mutators below inside `updateWorkflow`.
 */

export type SubFlowOverrideSource = Pick<SubFlowConfig, 'overrides' | 'viewOverrides'>;

function overridesOf(sf: SubFlowOverrideSource): SubFlowOverrides {
  return sf.overrides ?? {};
}

export function countOverrides(sf: SubFlowOverrideSource): number {
  const o = overridesOf(sf);
  let n = o.timeout?.key ? 1 : 0;
  for (const entry of Object.values(o.transitions ?? {})) {
    if (entry.roles !== undefined) n += 1;
    n += Object.keys(entry.views ?? {}).length;
  }
  for (const entry of Object.values(o.states ?? {})) {
    if (entry.queryRoles !== undefined) n += 1;
    const longPoll = entry.interaction?.longPoll;
    if (longPoll?.fallbackTimeoutSeconds !== undefined) n += 1;
    if (longPoll?.roles !== undefined) n += 1;
    n += Object.keys(entry.views ?? {}).length;
  }
  return n + Object.keys(legacyViewOverrides(sf)).length;
}

export type OverrideWarningCode =
  | 'roles-empty'
  | 'roles-ignored-rule'
  | 'longpoll-inert'
  | 'legacy-views'
  | 'mixed-views';

export interface OverrideWarning {
  code: OverrideWarningCode;
  message: string;
}

export function legacyViewOverrides(sf: SubFlowOverrideSource): Record<string, ResourceReference> {
  return { ...(sf.viewOverrides ?? {}), ...(overridesOf(sf).views ?? {}) };
}

export function hasLegacyViews(sf: SubFlowOverrideSource): boolean {
  return Object.keys(legacyViewOverrides(sf)).length > 0;
}

function hasScopedViews(o: SubFlowOverrides): boolean {
  const scoped = [...Object.values(o.states ?? {}), ...Object.values(o.transitions ?? {})];
  return scoped.some((entry) => Object.keys(entry.views ?? {}).length > 0);
}

function isEmptyList(roles: RoleGrant[] | undefined): boolean {
  return Array.isArray(roles) && roles.length === 0;
}

export function overrideWarnings(
  sf: SubFlowOverrideSource,
  child: ChildWorkflowSummary | null,
): OverrideWarning[] {
  const o = overridesOf(sf);
  const warnings: OverrideWarning[] = [];

  for (const [key, entry] of Object.entries(o.transitions ?? {})) {
    if (isEmptyList(entry.roles)) {
      warnings.push({
        code: 'roles-empty',
        message: `Transition "${key}" overrides roles with an empty list — every caller is admitted.`,
      });
    }
  }

  for (const [key, entry] of Object.entries(o.states ?? {})) {
    if (isEmptyList(entry.queryRoles)) {
      warnings.push({
        code: 'roles-empty',
        message: `State "${key}" overrides query roles with an empty list — every caller can read it.`,
      });
    }
    const longPoll = entry.interaction?.longPoll;
    if (!longPoll) continue;
    if (isEmptyList(longPoll.roles)) {
      warnings.push({
        code: 'roles-empty',
        message: `State "${key}" overrides long-poll roles with an empty list — every caller can acknowledge.`,
      });
    }
    const childState = child?.states.find((s) => s.key === key);
    if (!childState) continue;
    if (childState.longPollAuth === null) {
      warnings.push({
        code: 'longpoll-inert',
        message: `Child state "${key}" declares no long poll — this long-poll override has no effect.`,
      });
    } else if (childState.longPollAuth === 'rule' && longPoll.roles !== undefined) {
      warnings.push({
        code: 'roles-ignored-rule',
        message: `Child state "${key}" authorizes its long poll with a rule — the roles override is ignored at runtime.`,
      });
    }
  }

  if (hasLegacyViews(sf)) {
    warnings.push({
      code: 'legacy-views',
      message:
        'Legacy view overrides (subFlow.viewOverrides / overrides.views) are deprecated — migrate them to state or transition scoped views.',
    });
    if (hasScopedViews(o)) {
      warnings.push({
        code: 'mixed-views',
        message:
          'Legacy and scoped view overrides are mixed — the runtime rejects this subflow. Migrate or remove the legacy map.',
      });
    }
  }

  return warnings;
}

export interface LegacyViewMigrationPlan {
  states: Record<string, Record<string, ResourceReference>>;
  transitions: Record<string, Record<string, ResourceReference>>;
  unplaced: string[];
}

export function planLegacyViewMigration(
  sf: SubFlowOverrideSource,
  child: ChildWorkflowSummary,
): LegacyViewMigrationPlan {
  const plan: LegacyViewMigrationPlan = { states: {}, transitions: {}, unplaced: [] };
  for (const [viewKey, replacement] of Object.entries(legacyViewOverrides(sf))) {
    let placed = false;
    for (const state of child.states) {
      if (!state.viewKeys.includes(viewKey)) continue;
      (plan.states[state.key] ??= {})[viewKey] = replacement;
      placed = true;
    }
    for (const transition of child.transitions) {
      if (!transition.viewKeys.includes(viewKey)) continue;
      (plan.transitions[transition.key] ??= {})[viewKey] = replacement;
      placed = true;
    }
    if (!placed) plan.unplaced.push(viewKey);
  }
  return plan;
}

/** Existing scoped entries win over migrated legacy ones. */
export function applyLegacyViewMigration(sf: SubFlowConfig, plan: LegacyViewMigrationPlan): void {
  if (plan.unplaced.length > 0) return;
  if (!sf.overrides) sf.overrides = {};
  const o = sf.overrides;
  for (const [stateKey, views] of Object.entries(plan.states)) {
    if (!o.states) o.states = {};
    const entry = (o.states[stateKey] ??= {});
    entry.views = { ...views, ...(entry.views ?? {}) };
  }
  for (const [transitionKey, views] of Object.entries(plan.transitions)) {
    if (!o.transitions) o.transitions = {};
    const entry = (o.transitions[transitionKey] ??= {});
    entry.views = { ...views, ...(entry.views ?? {}) };
  }
  delete o.views;
  delete sf.viewOverrides;
}

export type FallbackParse = { ok: true; value: number | undefined } | { ok: false };

/** Schema: `fallbackTimeoutSeconds` is an integer, minimum 1. Blank = keep the child value. */
export function parseFallbackSeconds(text: string): FallbackParse {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= 1 ? { ok: true, value } : { ok: false };
}

export interface LongPollOverridePatch {
  fallbackTimeoutSeconds?: number | undefined;
  roles?: RoleGrant[] | undefined;
}

export function setLongPollOverride(entry: SubFlowStateOverride, patch: LongPollOverridePatch): void {
  const longPoll: SubFlowLongPollOverride = { ...(entry.interaction?.longPoll ?? {}) };
  if ('fallbackTimeoutSeconds' in patch) {
    if (patch.fallbackTimeoutSeconds === undefined) delete longPoll.fallbackTimeoutSeconds;
    else longPoll.fallbackTimeoutSeconds = patch.fallbackTimeoutSeconds;
  }
  if ('roles' in patch) {
    if (patch.roles === undefined) delete longPoll.roles;
    else longPoll.roles = patch.roles;
  }
  if (Object.keys(longPoll).length === 0) delete entry.interaction;
  else entry.interaction = { longPoll };
}

export function renameRecordKey<T>(record: Record<string, T>, from: string, to: string): boolean {
  if (from === to || !(from in record) || to in record) return false;
  const entries = Object.entries(record);
  for (const key of Object.keys(record)) delete record[key];
  for (const [key, value] of entries) record[key === from ? to : key] = value;
  return true;
}

export function nextOverrideKey(record: Record<string, unknown>, options: string[], prefix: string): string {
  const free = options.find((option) => !(option in record));
  if (free) return free;
  let index = Object.keys(record).length + 1;
  while (`${prefix}-${index}` in record) index += 1;
  return `${prefix}-${index}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.ts packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/subFlowOverrides.vitest.test.ts
git commit -m "$(cat <<'MSG'
feat(designer): subflow override counting, warnings and legacy view migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Subflow timeout override editor (C1, subflow part)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/KeyCombobox.tsx`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.vitest.test.tsx`

**Interfaces:**
- Consumes: Task 1 (script panel path `subFlow` / `overrides.timeout.mapping`), Task 4 (`setTimeoutAnnotations`, `setTimeoutComment`), `TransitionAnnotationsSection`, `CsxEditorField`, `MappingScriptsSection`, `TimeoutTransition`, `MappingCode`.
- Produces:
  - `KeyCombobox(props: { value: string; options: string[]; onCommit: (next: string) => void; ariaLabel: string; placeholder?: string })` — free text + `<datalist>` suggestions, commits on blur / Enter, reverts on Escape or blank.
  - `TimeoutOverrideEditor(props: TimeoutOverrideEditorProps)` with `interface TimeoutOverrideEditorProps { timeout: TimeoutTransition | undefined; stateKey: string; childStateKeys: string[]; onUpdate: (updater: (t: TimeoutTransition) => void) => void; onClear: () => void }`. Wired into the section in Task 8.

- [ ] **Step 1: Write the failing test**

Create `TimeoutOverrideEditor.vitest.test.tsx` (values from `vnext-example/core/Workflows/timeout-lab/timeout-lab-parent.json`):

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TimeoutTransition } from '@vnext-forge-studio/vnext-types';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: (props: { templateType: string; listField: string; scriptField: string }) =>
    createElement('div', { 'data-csx': `${props.templateType}:${props.listField}:${props.scriptField}` }),
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));

const { TimeoutOverrideEditor } = await import('./TimeoutOverrideEditor');

function render(timeout: TimeoutTransition | undefined, childStateKeys: string[] = []): string {
  return renderToStaticMarkup(
    createElement(TimeoutOverrideEditor, {
      timeout,
      stateKey: 'parent-subflow',
      childStateKeys,
      onUpdate: () => undefined,
      onClear: () => undefined,
    }),
  );
}

const TIMEOUT: TimeoutTransition = {
  key: 'child-abandoned',
  target: 'child-timedout',
  versionStrategy: 'Minor',
  timer: { reset: 'never', duration: 'PT20S' },
  annotations: { 'ui/countdown': 'parent-override' },
  _comment: 'Parent deadline for the child',
};

describe('TimeoutOverrideEditor', () => {
  it('offers child states as timeout targets and keeps the current target', () => {
    const html = render(TIMEOUT, ['child-waiting', 'child-completed', 'child-timedout']);
    expect(html).toContain('value="child-timedout"');
    expect(html).toContain('value="child-waiting"');
    expect(html).toContain('<datalist');
  });

  it('edits annotations, description and the mapping script', () => {
    const html = render(TIMEOUT);
    expect(html).toContain('Annotations');
    expect(html).toContain('value="ui/countdown"');
    expect(html).toContain('Parent deadline for the child');
    expect(html).toContain('data-csx="mapping:subFlow:overrides.timeout.mapping"');
  });

  it('starts collapsed when nothing is set', () => {
    const html = render(undefined);
    expect(html).toContain('Timeout override');
    expect(html).toContain('Not set');
    expect(html).not.toContain('data-csx');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.vitest.test.tsx`
Expected: FAIL — cannot resolve `./TimeoutOverrideEditor`.

- [ ] **Step 3: Create `KeyCombobox.tsx`**

```tsx
import { useEffect, useId, useState } from 'react';

interface KeyComboboxProps {
  value: string;
  options: string[];
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

/**
 * Free-text key input with suggestions (native `<datalist>`). Commits on blur
 * or Enter, so renaming a record key does not rewrite the document per
 * keystroke. Values outside `options` stay allowed: the child definition may
 * be missing or older than the parent. Blank input reverts.
 */
export function KeyCombobox({ value, options, onCommit, ariaLabel, placeholder }: KeyComboboxProps) {
  const listId = useId();
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
    <>
      <input
        type="text"
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(value);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
```

- [ ] **Step 4: Create `TimeoutOverrideEditor.tsx`**

```tsx
import { useState } from 'react';
import type { MappingCode, TimeoutTransition } from '@vnext-forge-studio/vnext-types';
import { CsxEditorField, type ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../../../../../modules/save-component/components/MappingScriptsSection';
import { EditableInput, IconTrash } from '../PropertyPanelShared';
import { setTimeoutAnnotations, setTimeoutComment } from '../shared/timeoutFields';
import { TransitionAnnotationsSection } from '../transition/TransitionAnnotationsSection';
import { KeyCombobox } from './KeyCombobox';

export interface TimeoutOverrideEditorProps {
  timeout: TimeoutTransition | undefined;
  /** Parent state owning the subflow — addresses the mapping script. */
  stateKey: string;
  /** Child state keys offered as targets; free text stays allowed. */
  childStateKeys: string[];
  onUpdate: (updater: (t: TimeoutTransition) => void) => void;
  onClear: () => void;
}

const LABEL = 'text-[10px] font-medium text-muted-foreground mb-0.5 block';

export function TimeoutOverrideEditor({
  timeout,
  stateKey,
  childStateKeys,
  onUpdate,
  onClear,
}: TimeoutOverrideEditorProps) {
  const [open, setOpen] = useState(!!timeout?.key);
  const configured = !!timeout?.key;
  const mapping = timeout?.mapping;

  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">
          Timeout override
        </span>
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
          {configured ? 'Configured' : 'Not set'}
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-1.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Replaces the child workflow timeout as a whole, annotations included.
          </p>
          <div>
            <label className={LABEL}>Key</label>
            <EditableInput value={timeout?.key ?? ''} onChange={(v) => onUpdate((t) => { t.key = v; })} mono placeholder="e.g. child-abandoned" />
          </div>
          <div>
            <label className={LABEL}>Target</label>
            <KeyCombobox
              value={timeout?.target ?? ''}
              options={childStateKeys}
              onCommit={(v) => onUpdate((t) => { t.target = v; })}
              ariaLabel="Timeout target state"
              placeholder="e.g. child-timedout"
            />
          </div>
          <div>
            <label className={LABEL}>Version strategy</label>
            <EditableInput value={timeout?.versionStrategy ?? ''} onChange={(v) => onUpdate((t) => { t.versionStrategy = v || undefined; })} placeholder="e.g. Minor" />
          </div>
          <div>
            <label className={LABEL}>Timer reset</label>
            <EditableInput value={timeout?.timer?.reset ?? ''} onChange={(v) => onUpdate((t) => { if (!t.timer) t.timer = {}; t.timer.reset = v || undefined; })} placeholder="e.g. never" />
          </div>
          <div>
            <label className={LABEL}>Duration (ISO 8601)</label>
            <EditableInput value={timeout?.timer?.duration ?? ''} onChange={(v) => onUpdate((t) => { if (!t.timer) t.timer = {}; t.timer.duration = v || undefined; })} mono placeholder="e.g. PT25M" />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              value={timeout?._comment ?? ''}
              onChange={(e) => {
                const text = e.target.value;
                onUpdate((t) => setTimeoutComment(t, text));
              }}
              rows={2}
              aria-label="Timeout override description"
              placeholder="Why the parent overrides the child timeout..."
              className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all resize-y"
            />
          </div>
          <TransitionAnnotationsSection
            annotations={timeout?.annotations ?? undefined}
            onChange={(next) => onUpdate((t) => setTimeoutAnnotations(t, next))}
          />
          <div>
            <label className={LABEL}>Mapping (optional)</label>
            <CsxEditorField
              value={(mapping as ScriptCode | undefined) ?? null}
              onChange={(sc) => onUpdate((t) => { t.mapping = sc as MappingCode; })}
              onRemove={() => onUpdate((t) => { delete t.mapping; })}
              templateType="mapping"
              contextName={`${stateKey}-subflow-timeout`}
              label="Timeout mapping"
              stateKey={stateKey}
              listField="subFlow"
              index={0}
              scriptField="overrides.timeout.mapping"
            />
            {mapping && (
              <MappingScriptsSection
                value={mapping.scripts}
                onChange={(scripts) =>
                  onUpdate((t) => {
                    if (!t.mapping) return;
                    if (scripts === undefined) delete t.mapping.scripts;
                    else t.mapping.scripts = scripts;
                  })
                }
              />
            )}
          </div>
          {configured && (
            <button
              type="button"
              onClick={onClear}
              className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors mt-1">
              <IconTrash />
              Clear timeout override
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

`WorkflowTimerConfig` has optional `reset`/`duration`, so `t.timer = {}` type-checks (same as the editor this replaces).

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0.

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/KeyCombobox.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/TimeoutOverrideEditor.vitest.test.tsx
git commit -m "$(cat <<'MSG'
feat(designer): subflow timeout override editor with annotations, mapping and child targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Subflow overrides surface (C2)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/OptionalRoleOverride.tsx`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/ViewSwapMapEditor.tsx`
- Modify (full rewrite): `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/SubFlowOverridesSection.tsx`
- Modify (full rewrite): `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/SubFlowTab.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow/SubFlowOverridesSection.vitest.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`ChildWorkflowSummary`, `ChildStateSummary`, `ChildTransitionSummary`, `ChildWorkflowLoadStatus`, `useChildWorkflowSummary`), Task 6 (all exports of `subFlowOverrides.ts`), Task 7 (`KeyCombobox`, `TimeoutOverrideEditor`), `RoleGrantEditor`, `ChooseExistingVnextComponentDialog` (`category="views"`, `onSelect(component: DiscoveredVnextComponent)`).
- Produces:
  - `OptionalRoleOverride(props: { label: string; roles: RoleGrant[] | undefined; onChange: (next: RoleGrant[] | undefined) => void; contextLabel: string; note?: string })`
  - `ViewSwapMapEditor(props: { value: Record<string, ResourceReference> | undefined; viewKeyOptions: string[]; onChange: (next: Record<string, ResourceReference> | undefined) => void; onBrowse?: (viewKey: string) => void })`
  - `SubFlowOverridesSection(props: SubFlowOverridesSectionProps)` with `interface SubFlowOverridesSectionProps { subFlow: SubFlowConfig; stateKey: string; child: ChildWorkflowSummary | null; childStatus: ChildWorkflowLoadStatus; projectDomain: string; canPickViews: boolean; onUpdateSubFlow: (updater: (sf: SubFlowConfig) => void) => void }` (replaces the old `overrides` / `onUpdateOverrides` props).

- [ ] **Step 1: Write the failing test**

Create `SubFlowOverridesSection.vitest.test.tsx` (overrides modelled on `vnext-example/core/Workflows/subflow-override-lab/subflow-override-lab-parent*.json`):

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceReference, SubFlowConfig } from '@vnext-forge-studio/vnext-types';
import type { ChildWorkflowSummary } from './childWorkflowSummary';

vi.mock('../../../../../../modules/save-component/components/CsxEditorField', () => ({
  CsxEditorField: () => null,
}));
vi.mock('../../../../../../modules/save-component/components/MappingScriptsSection', () => ({
  MappingScriptsSection: () => null,
}));
vi.mock('../ChooseExistingTaskDialog', () => ({
  ChooseExistingVnextComponentDialog: () => null,
}));

const { SubFlowOverridesSection } = await import('./SubFlowOverridesSection');

const PROCESS = { key: 'subflow-override-lab-child', domain: 'core', version: '1.0.2', flow: 'sys-flows' };
const ref = (key: string): ResourceReference => ({ key, domain: 'core', version: '1.0.0', flow: 'sys-views' });

const CHILD: ChildWorkflowSummary = {
  states: [
    { key: 'lp-wait', longPollAuth: 'rule', viewKeys: ['subflow-override-lab-child-lp-view'] },
    { key: 'child-done', longPollAuth: null, viewKeys: [] },
  ],
  transitions: [{ key: 'confirm', viewKeys: ['subflow-override-lab-child-confirm-view'] }],
};

function render(subFlow: SubFlowConfig, child: ChildWorkflowSummary | null = CHILD): string {
  return renderToStaticMarkup(
    createElement(SubFlowOverridesSection, {
      subFlow,
      stateKey: 'parent-subflow',
      child,
      childStatus: child ? 'ready' : 'unavailable',
      projectDomain: 'core',
      canPickViews: true,
      onUpdateSubFlow: () => undefined,
    }),
  );
}

describe('SubFlowOverridesSection', () => {
  it('shows the subflow type, child pickers, long-poll fields and warnings', () => {
    const html = render({
      type: 'S',
      process: PROCESS,
      overrides: {
        states: {
          'lp-wait': {
            interaction: { longPoll: { fallbackTimeoutSeconds: 120, roles: [{ role: 'ovr.parent-ack', grant: 'allow' }] } },
            views: { 'subflow-override-lab-child-lp-view': ref('subflow-override-lab-parent-lp-view') },
          },
        },
        transitions: { confirm: { roles: [] } },
      },
    });
    expect(html).toContain('SubFlow (S)');
    expect(html).toContain('value="lp-wait"');
    expect(html).toContain('value="confirm"');
    expect(html).toContain('Fallback window (s)');
    expect(html).toContain('value="120"');
    expect(html).toContain('value="subflow-override-lab-parent-lp-view"');
    expect(html).toContain('authorizes its long poll with a rule');
    expect(html).toContain('every caller is admitted');
  });

  it('hides the long-poll fields for a child state without a long poll', () => {
    const html = render({ type: 'S', process: PROCESS, overrides: { states: { 'child-done': { queryRoles: [{ role: 'a', grant: 'allow' }] } } } });
    expect(html).not.toContain('Fallback window (s)');
  });

  it('offers migration of legacy view overrides when the child selects every key', () => {
    const html = render({
      type: 'S',
      process: PROCESS,
      overrides: { views: { 'subflow-override-lab-child-lp-view': ref('subflow-override-lab-legacy-view') } },
    });
    expect(html).toContain('deprecated');
    expect(html).toContain('Migrate to scoped views');
  });

  it('explains free-text keys when the child is unavailable', () => {
    const html = render({ type: 'S', process: PROCESS, viewOverrides: { v: ref('x') } }, null);
    expect(html).toContain('Child workflow not found in this workspace');
    expect(html).not.toContain('Migrate to scoped views');
  });

  it('notes that a SubProcess ignores overrides', () => {
    const html = render({ type: 'P', process: PROCESS, overrides: { transitions: { confirm: { roles: [{ role: 'a', grant: 'allow' }] } } } });
    expect(html).toContain('SubProcess (P)');
    expect(html).toContain('overrides apply to SubFlow (S) only');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow/SubFlowOverridesSection.vitest.test.tsx`
Expected: FAIL — the current section takes `overrides` / `onUpdateOverrides` and renders none of the new text.

- [ ] **Step 3: Create `OptionalRoleOverride.tsx`**

```tsx
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { IconPlus, IconTrash } from '../PropertyPanelShared';
import { RoleGrantEditor } from './RoleGrantEditor';

interface OptionalRoleOverrideProps {
  label: string;
  /** `undefined` = not overridden (child value applies); `[]` = override with no grants. */
  roles: RoleGrant[] | undefined;
  onChange: (next: RoleGrant[] | undefined) => void;
  contextLabel: string;
  /** Shown above the editor, e.g. when the runtime will ignore the override. */
  note?: string;
}

/**
 * A role list override has three states the plain editor cannot express:
 * absent (keep the child), empty (admit everyone) and a grant list. Removing
 * the last row keeps an explicit `[]`; "Remove override" drops the field.
 */
export function OptionalRoleOverride({ label, roles, onChange, contextLabel, note }: OptionalRoleOverrideProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        {roles !== undefined && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-subtle hover:text-destructive-text inline-flex min-h-0 cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors">
            <IconTrash />
            Remove override
          </button>
        )}
      </div>
      {note && <p className="mb-1 text-[10px] leading-relaxed text-warning-text">{note}</p>}
      {roles === undefined ? (
        <button
          type="button"
          onClick={() => onChange([{ role: '', grant: 'allow' }])}
          className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
          <IconPlus />
          Override {label.toLowerCase()}
        </button>
      ) : (
        <RoleGrantEditor roles={roles} onChange={onChange} contextLabel={contextLabel} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `ViewSwapMapEditor.tsx`**

```tsx
import type { ResourceReference } from '@vnext-forge-studio/vnext-types';
import { EditableInput, IconPlus, IconTrash } from '../PropertyPanelShared';
import { KeyCombobox } from './KeyCombobox';
import { nextOverrideKey, renameRecordKey } from './subFlowOverrides';

interface ViewSwapMapEditorProps {
  /** Key = the view key the child selected; value = the replacement view. */
  value: Record<string, ResourceReference> | undefined;
  /** View keys the child can select in this state / transition. */
  viewKeyOptions: string[];
  onChange: (next: Record<string, ResourceReference> | undefined) => void;
  /** Opens the view picker for one entry; omitted when no project is open. */
  onBrowse?: (viewKey: string) => void;
}

const EMPTY_REF: ResourceReference = { key: '', domain: '', version: '1.0.0', flow: 'sys-views' };

export function ViewSwapMapEditor({ value, viewKeyOptions, onChange, onBrowse }: ViewSwapMapEditorProps) {
  const entries = Object.entries(value ?? {});

  const write = (next: Record<string, ResourceReference>): void => {
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const add = (): void => {
    const next = { ...(value ?? {}) };
    next[nextOverrideKey(next, viewKeyOptions, 'view')] = { ...EMPTY_REF };
    write(next);
  };

  const rename = (from: string, to: string): void => {
    const next = { ...(value ?? {}) };
    if (renameRecordKey(next, from, to)) write(next);
  };

  const remove = (viewKey: string): void => {
    const next = { ...(value ?? {}) };
    delete next[viewKey];
    write(next);
  };

  const patchRef = (viewKey: string, field: keyof ResourceReference, text: string): void => {
    const next = { ...(value ?? {}) };
    next[viewKey] = { ...next[viewKey], [field]: text };
    write(next);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium text-muted-foreground block">View swaps</span>
      {entries.map(([viewKey, replacement]) => (
        <div key={viewKey} className="border border-border-subtle rounded-lg p-2 bg-surface/50 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <KeyCombobox
                value={viewKey}
                options={viewKeyOptions}
                onCommit={(to) => rename(viewKey, to)}
                ariaLabel="Child view key"
                placeholder="Child view key"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(viewKey)}
              className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
              aria-label={`Remove view swap ${viewKey}`}
              title={`Remove view swap ${viewKey}`}>
              <IconTrash />
            </button>
          </div>
          <span className="text-[9px] font-medium text-muted-foreground block">Replacement view</span>
          <div className="grid grid-cols-2 gap-1.5">
            <EditableInput value={replacement.key} onChange={(v) => patchRef(viewKey, 'key', v)} mono placeholder="key" />
            <EditableInput value={replacement.domain} onChange={(v) => patchRef(viewKey, 'domain', v)} mono placeholder="domain" />
            <EditableInput value={replacement.version} onChange={(v) => patchRef(viewKey, 'version', v)} mono placeholder="version" />
            <EditableInput value={replacement.flow} onChange={(v) => patchRef(viewKey, 'flow', v)} mono placeholder="flow" />
          </div>
          {onBrowse && (
            <button
              type="button"
              onClick={() => onBrowse(viewKey)}
              className="text-secondary-icon hover:text-secondary-foreground cursor-pointer text-[10px] font-semibold">
              Choose view…
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
        <IconPlus />
        Add view swap
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `SubFlowOverridesSection.tsx`**

Replace the whole file with:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type {
  ResourceReference,
  SubFlowConfig,
  SubFlowLongPollOverride,
  SubFlowOverrides,
  SubFlowStateOverride,
  SubFlowTransitionOverride,
} from '@vnext-forge-studio/vnext-types';
import { ChooseExistingVnextComponentDialog } from '../ChooseExistingTaskDialog';
import { IconPlus, IconTrash, Section } from '../PropertyPanelShared';
import type {
  ChildStateSummary,
  ChildTransitionSummary,
  ChildWorkflowLoadStatus,
  ChildWorkflowSummary,
} from './childWorkflowSummary';
import { KeyCombobox } from './KeyCombobox';
import { OptionalRoleOverride } from './OptionalRoleOverride';
import { TimeoutOverrideEditor } from './TimeoutOverrideEditor';
import { ViewSwapMapEditor } from './ViewSwapMapEditor';
import {
  applyLegacyViewMigration,
  countOverrides,
  hasLegacyViews,
  nextOverrideKey,
  overrideWarnings,
  parseFallbackSeconds,
  planLegacyViewMigration,
  renameRecordKey,
  setLongPollOverride,
  type LongPollOverridePatch,
} from './subFlowOverrides';

export interface SubFlowOverridesSectionProps {
  subFlow: SubFlowConfig;
  /** Parent state owning the subflow. */
  stateKey: string;
  child: ChildWorkflowSummary | null;
  childStatus: ChildWorkflowLoadStatus;
  projectDomain: string;
  canPickViews: boolean;
  onUpdateSubFlow: (updater: (sf: SubFlowConfig) => void) => void;
}

type OverrideScope = 'states' | 'transitions';
interface ViewTarget {
  scope: OverrideScope;
  entryKey: string;
  viewKey: string;
}
type BrowseView = (scope: OverrideScope, entryKey: string, viewKey: string) => void;

function ensureOverrides(sf: SubFlowConfig): SubFlowOverrides {
  if (!sf.overrides) sf.overrides = {};
  return sf.overrides;
}

const NOTE = 'text-[10px] text-muted-foreground leading-relaxed';

export function SubFlowOverridesSection({
  subFlow,
  stateKey,
  child,
  childStatus,
  projectDomain,
  canPickViews,
  onUpdateSubFlow,
}: SubFlowOverridesSectionProps) {
  const [viewTarget, setViewTarget] = useState<ViewTarget | null>(null);
  const overrides = subFlow.overrides ?? {};
  const total = countOverrides(subFlow);
  const warnings = overrideWarnings(subFlow, child);
  const legacy = hasLegacyViews(subFlow);
  const plan = useMemo(
    () => (legacy && child ? planLegacyViewMigration(subFlow, child) : null),
    [legacy, child, subFlow],
  );
  const isSubProcess = subFlow.type === 'P';

  const updateStates = (updater: (states: Record<string, SubFlowStateOverride>) => void): void =>
    onUpdateSubFlow((sf) => {
      const o = ensureOverrides(sf);
      if (!o.states) o.states = {};
      updater(o.states);
    });

  const updateTransitions = (updater: (transitions: Record<string, SubFlowTransitionOverride>) => void): void =>
    onUpdateSubFlow((sf) => {
      const o = ensureOverrides(sf);
      if (!o.transitions) o.transitions = {};
      updater(o.transitions);
    });

  const browseView: BrowseView | undefined = canPickViews
    ? (scope, entryKey, viewKey) => setViewTarget({ scope, entryKey, viewKey })
    : undefined;

  const handlePickView = (component: DiscoveredVnextComponent): void => {
    const target = viewTarget;
    setViewTarget(null);
    if (!target) return;
    const replacement: ResourceReference = {
      key: component.key,
      domain: projectDomain,
      version: component.version ?? '1.0.0',
      flow: component.flow || 'sys-views',
    };
    onUpdateSubFlow((sf) => {
      const bucket = ensureOverrides(sf)[target.scope];
      const entry = bucket?.[target.entryKey];
      if (!entry) return;
      entry.views = { ...(entry.views ?? {}), [target.viewKey]: replacement };
    });
  };

  return (
    <Section title="Overrides" count={total} defaultOpen={total > 0}>
      <div className="space-y-3">
        <p className={NOTE}>
          <span className="font-semibold">Type:</span> {isSubProcess ? 'SubProcess (P)' : 'SubFlow (S)'} —
          overrides apply to SubFlow (S) only.
        </p>
        {childStatus === 'loading' && <p className={NOTE}>Loading the child workflow…</p>}
        {childStatus === 'unavailable' && (
          <p className={NOTE}>Child workflow not found in this workspace — keys are free text.</p>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="rounded-md border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text leading-relaxed">
                {warning.message}
              </li>
            ))}
          </ul>
        )}

        {legacy &&
          (plan?.unplaced.length === 0 ? (
            <button
              type="button"
              onClick={() => onUpdateSubFlow((sf) => applyLegacyViewMigration(sf, plan))}
              className="text-[11px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-surface hover:bg-secondary-muted border border-secondary-border rounded-lg px-2.5 py-1 cursor-pointer transition-colors">
              Migrate to scoped views
            </button>
          ) : (
            <p className={NOTE}>
              {plan
                ? `Automatic migration is not possible: no child state or transition selects ${plan.unplaced.join(', ')}.`
                : 'Load the child workflow to migrate the legacy view overrides.'}
            </p>
          ))}

        <TimeoutOverrideEditor
          timeout={overrides.timeout ?? undefined}
          stateKey={stateKey}
          childStateKeys={child?.states.map((s) => s.key) ?? []}
          onUpdate={(updater) =>
            onUpdateSubFlow((sf) => {
              const o = ensureOverrides(sf);
              if (!o.timeout) o.timeout = { key: '', target: '' };
              updater(o.timeout);
            })
          }
          onClear={() =>
            onUpdateSubFlow((sf) => {
              if (sf.overrides) delete sf.overrides.timeout;
            })
          }
        />

        <TransitionOverridesGroup
          transitions={overrides.transitions}
          childTransitions={child?.transitions ?? []}
          onUpdate={updateTransitions}
          browseView={browseView}
        />

        <StateOverridesGroup
          states={overrides.states}
          childStates={child?.states ?? []}
          onUpdate={updateStates}
          browseView={browseView}
        />
      </div>

      <ChooseExistingVnextComponentDialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
        category="views"
        onSelect={handlePickView}
      />
    </Section>
  );
}

/* ────────────── Transition overrides ────────────── */

function TransitionOverridesGroup({
  transitions,
  childTransitions,
  onUpdate,
  browseView,
}: {
  transitions: Record<string, SubFlowTransitionOverride> | undefined;
  childTransitions: ChildTransitionSummary[];
  onUpdate: (updater: (t: Record<string, SubFlowTransitionOverride>) => void) => void;
  browseView: BrowseView | undefined;
}) {
  const keys = Object.keys(transitions ?? {});
  const options = childTransitions.map((t) => t.key);

  return (
    <GroupShell title="Transition overrides" count={keys.length}>
      {keys.map((key) => {
        const entry: SubFlowTransitionOverride = transitions?.[key] ?? {};
        const viewKeyOptions = childTransitions.find((t) => t.key === key)?.viewKeys ?? [];
        return (
          <EntryCard
            key={key}
            entryKey={key}
            keyLabel="Child transition key"
            options={options}
            onRename={(to) => onUpdate((t) => { renameRecordKey(t, key, to); })}
            onRemove={() => onUpdate((t) => { delete t[key]; })}>
            <OptionalRoleOverride
              label="Roles"
              roles={entry.roles}
              contextLabel={key}
              onChange={(roles) =>
                onUpdate((t) => {
                  const e = t[key];
                  if (!e) return;
                  if (roles === undefined) delete e.roles;
                  else e.roles = roles;
                })
              }
            />
            <ViewSwapMapEditor
              value={entry.views}
              viewKeyOptions={viewKeyOptions}
              onChange={(views) =>
                onUpdate((t) => {
                  const e = t[key];
                  if (!e) return;
                  if (views) e.views = views;
                  else delete e.views;
                })
              }
              onBrowse={browseView ? (viewKey) => browseView('transitions', key, viewKey) : undefined}
            />
          </EntryCard>
        );
      })}
      <AddButton
        label="Add transition override"
        onClick={() => onUpdate((t) => { t[nextOverrideKey(t, options, 'transition')] = {}; })}
      />
    </GroupShell>
  );
}

/* ────────────── State overrides ────────────── */

function StateOverridesGroup({
  states,
  childStates,
  onUpdate,
  browseView,
}: {
  states: Record<string, SubFlowStateOverride> | undefined;
  childStates: ChildStateSummary[];
  onUpdate: (updater: (s: Record<string, SubFlowStateOverride>) => void) => void;
  browseView: BrowseView | undefined;
}) {
  const keys = Object.keys(states ?? {});
  const options = childStates.map((s) => s.key);

  return (
    <GroupShell title="State overrides" count={keys.length}>
      {keys.map((key) => {
        const entry: SubFlowStateOverride = states?.[key] ?? {};
        const childState = childStates.find((s) => s.key === key);
        const longPoll = entry.interaction?.longPoll;
        const showLongPoll = (childState?.longPollAuth ?? null) !== null || longPoll !== undefined;
        return (
          <EntryCard
            key={key}
            entryKey={key}
            keyLabel="Child state key"
            options={options}
            onRename={(to) => onUpdate((s) => { renameRecordKey(s, key, to); })}
            onRemove={() => onUpdate((s) => { delete s[key]; })}>
            <OptionalRoleOverride
              label="Query roles"
              roles={entry.queryRoles}
              contextLabel={key}
              onChange={(roles) =>
                onUpdate((s) => {
                  const e = s[key];
                  if (!e) return;
                  if (roles === undefined) delete e.queryRoles;
                  else e.queryRoles = roles;
                })
              }
            />
            {showLongPoll && (
              <LongPollOverrideFields
                entryKey={key}
                longPoll={longPoll}
                childAuth={childState?.longPollAuth ?? null}
                onPatch={(patch) =>
                  onUpdate((s) => {
                    const e = s[key];
                    if (e) setLongPollOverride(e, patch);
                  })
                }
              />
            )}
            <ViewSwapMapEditor
              value={entry.views}
              viewKeyOptions={childState?.viewKeys ?? []}
              onChange={(views) =>
                onUpdate((s) => {
                  const e = s[key];
                  if (!e) return;
                  if (views) e.views = views;
                  else delete e.views;
                })
              }
              onBrowse={browseView ? (viewKey) => browseView('states', key, viewKey) : undefined}
            />
          </EntryCard>
        );
      })}
      <AddButton
        label="Add state override"
        onClick={() => onUpdate((s) => { s[nextOverrideKey(s, options, 'state')] = {}; })}
      />
    </GroupShell>
  );
}

function LongPollOverrideFields({
  entryKey,
  longPoll,
  childAuth,
  onPatch,
}: {
  entryKey: string;
  longPoll: SubFlowLongPollOverride | undefined;
  childAuth: 'roles' | 'rule' | null;
  onPatch: (patch: LongPollOverridePatch) => void;
}) {
  const stored = longPoll?.fallbackTimeoutSeconds;
  const [text, setText] = useState(stored === undefined ? '' : String(stored));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(stored === undefined ? '' : String(stored));
    setInvalid(false);
  }, [stored]);

  return (
    <div className="rounded-lg border border-border-subtle p-2 space-y-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground block">Long poll</span>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Fallback window (s)</label>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = parseFallbackSeconds(next);
            setInvalid(!parsed.ok);
            if (parsed.ok) onPatch({ fallbackTimeoutSeconds: parsed.value });
          }}
          aria-label={`Long-poll fallback window for ${entryKey}`}
          aria-invalid={invalid}
          placeholder="Child value"
          className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
        />
        {invalid && (
          <p className="mt-0.5 text-[10px] text-destructive-text">Enter a whole number of seconds (1 or more).</p>
        )}
      </div>
      <OptionalRoleOverride
        label="Long-poll roles"
        roles={longPoll?.roles}
        contextLabel={`${entryKey} long poll`}
        onChange={(roles) => onPatch({ roles })}
        note={
          childAuth === 'rule'
            ? 'The child authorizes this long poll with a rule — a roles override is ignored at runtime.'
            : undefined
        }
      />
    </div>
  );
}

/* ────────────── Shared shells ────────────── */

function GroupShell({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(count > 0);
  return (
    <div className="rounded-lg bg-muted-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left group hover:bg-muted transition-colors cursor-pointer"
        aria-expanded={open}>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-tight flex-1">{title}</span>
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums bg-surface px-1.5 py-0.5 rounded-md border border-border-subtle font-semibold">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function EntryCard({
  entryKey,
  keyLabel,
  options,
  onRename,
  onRemove,
  children,
}: {
  entryKey: string;
  keyLabel: string;
  options: string[];
  onRename: (to: string) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-border-subtle rounded-lg p-2 bg-surface/50 space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <KeyCombobox value={entryKey} options={options} onCommit={onRename} ariaLabel={keyLabel} placeholder={keyLabel} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-subtle hover:text-destructive-text hover:bg-destructive-surface shrink-0 cursor-pointer rounded-lg p-1 transition-all"
          aria-label={`Remove ${keyLabel.toLowerCase()} ${entryKey}`}
          title={`Remove ${keyLabel.toLowerCase()} ${entryKey}`}>
          <IconTrash />
        </button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1 text-[11px] font-semibold transition-colors">
      <IconPlus />
      {label}
    </button>
  );
}
```

- [ ] **Step 6: Rewrite `SubFlowTab.tsx`**

Replace the whole file with:

```tsx
import { useCallback } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { ScriptsConfig, SubFlowConfig } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../../store/useProjectStore';
import type { ScriptCode } from '../../../../../../modules/save-component/components/CsxEditorField';
import { SubFlowProcessRefSection } from './SubFlowProcessRefSection';
import { SubFlowMappingSection } from './SubFlowMappingSection';
import { SubFlowOverridesSection } from './SubFlowOverridesSection';
import { useChildWorkflowSummary } from './useChildWorkflowSummary';
import { GitBranch } from 'lucide-react';

interface SubFlowTabProps {
  state: any;
}

export function SubFlowTab({ state }: SubFlowTabProps) {
  const { updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);

  const stateKey: string = state.key;
  const sf = state.subFlow;
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';
  const canPickExisting = Boolean(activeProject && vnextConfig?.paths);
  const subFlowConfig = sf as SubFlowConfig | undefined;
  const childLoad = useChildWorkflowSummary(subFlowConfig?.process?.key ?? '', subFlowConfig?.process?.domain ?? '');

  const findState = useCallback(
    (draft: any) => draft.attributes?.states?.find((s: any) => s.key === stateKey),
    [stateKey],
  );

  const addSubFlow = useCallback(
    (component?: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s) return;
        s.subFlow = {
          type: 'S',
          process: {
            key: component?.key ?? '',
            domain: component ? projectDomain : '',
            version: component?.version ?? '1.0.0',
            flow: component?.flow ?? 'sys-flows',
          },
        };
      });
    },
    [updateWorkflow, findState, projectDomain],
  );

  const removeSubFlow = useCallback(() => {
    updateWorkflow((draft: any) => {
      const s = findState(draft);
      if (!s) return;
      delete s.subFlow;
    });
  }, [updateWorkflow, findState]);

  const updateProcessField = useCallback(
    (field: string, value: string) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        if (!s.subFlow.process) s.subFlow.process = { key: '', domain: '', version: '', flow: '' };
        s.subFlow.process[field] = value;
      });
    },
    [updateWorkflow, findState],
  );

  const handleSelectWorkflow = useCallback(
    (component: DiscoveredVnextComponent) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s) return;
        if (!s.subFlow) {
          s.subFlow = { type: 'S', process: { key: '', domain: '', version: '', flow: '' } };
        }
        s.subFlow.process = {
          key: component.key,
          domain: projectDomain,
          version: component.version || '1.0.0',
          flow: component.flow || 'sys-flows',
        };
      });
    },
    [updateWorkflow, findState, projectDomain],
  );

  const updateMapping = useCallback(
    (mapping: ScriptCode) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        s.subFlow.mapping = mapping;
      });
    },
    [updateWorkflow, findState],
  );

  const removeMapping = useCallback(() => {
    updateWorkflow((draft: any) => {
      const s = findState(draft);
      if (!s?.subFlow) return;
      delete s.subFlow.mapping;
    });
  }, [updateWorkflow, findState]);

  const updateMappingScripts = useCallback(
    (next: ScriptsConfig | undefined) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow?.mapping) return;
        if (next === undefined) {
          delete s.subFlow.mapping.scripts;
        } else {
          s.subFlow.mapping.scripts = next;
        }
      });
    },
    [updateWorkflow, findState],
  );

  const updateSubFlow = useCallback(
    (updater: (subFlow: SubFlowConfig) => void) => {
      updateWorkflow((draft: any) => {
        const s = findState(draft);
        if (!s?.subFlow) return;
        updater(s.subFlow);
      });
    },
    [updateWorkflow, findState],
  );

  if (!sf) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-3">
        <div className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
          <GitBranch size={22} />
        </div>
        <div className="text-[12px] font-semibold text-muted-foreground mb-1">No SubFlow configured</div>
        <div className="text-[10px] text-subtle text-center mb-3 leading-relaxed max-w-[240px]">
          Reference another workflow and optional mapping or security overrides.
        </div>
        <button
          type="button"
          onClick={() => addSubFlow()}
          className="text-[11px] font-semibold text-secondary-icon hover:text-secondary-foreground bg-secondary-surface hover:bg-secondary-muted border border-secondary-border rounded-lg px-3 py-1.5 cursor-pointer transition-colors">
          Add SubFlow
        </button>
      </div>
    );
  }

  const process = sf.process ?? { key: sf.key ?? '', domain: sf.domain ?? '', version: sf.version ?? '', flow: sf.flow ?? '' };

  return (
    <div className="space-y-3">
      <SubFlowProcessRefSection
        process={process}
        projectDomain={projectDomain}
        onUpdateField={updateProcessField}
        onSelectWorkflow={handleSelectWorkflow}
        onRemove={removeSubFlow}
        canPickExisting={canPickExisting}
      />

      <SubFlowMappingSection
        mapping={sf.mapping}
        stateKey={stateKey}
        onChange={updateMapping}
        onRemove={removeMapping}
        scripts={(sf.mapping as { scripts?: ScriptsConfig } | undefined)?.scripts}
        onScriptsChange={updateMappingScripts}
      />

      <SubFlowOverridesSection
        subFlow={sf as SubFlowConfig}
        stateKey={stateKey}
        child={childLoad.summary}
        childStatus={childLoad.status}
        projectDomain={projectDomain}
        canPickViews={canPickExisting}
        onUpdateSubFlow={updateSubFlow}
      />
    </div>
  );
}
```

- [ ] **Step 7: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/subflow && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS (all subflow tests), exit 0. `rg -n "onUpdateOverrides|SubFlowTimeoutOverride" packages/designer-ui/src` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/subflow
git commit -m "$(cat <<'MSG'
feat(designer): full subflow override surface with child pickers, view swaps and warnings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Human-task and long-poll node data (C4/C5 logic)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/utils/humanTask.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/utils/humanTask.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/canvas-interaction/utils/stateNodeData.ts`
- Test: `packages/designer-ui/src/modules/canvas-interaction/utils/stateNodeData.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts` (NUL bytes — Edit tool only, see Global Constraints)

**Interfaces:**
- Consumes: `availableInStateKeys(raw: unknown): string[]` from `@vnext-forge-studio/vnext-types`.
- Produces:
  - `humanTask.ts`: `HUMAN_SUBTYPE = 6`; `interface HumanTaskStateLike { stateType?: unknown; subType?: unknown; queryRoles?: unknown }`; `isHumanTaskState(state: HumanTaskStateLike): boolean` (subType 6, not Final 3, not SubFlow 4); `hasRoleGrants(roles: unknown): boolean`; `isHumanTaskGateMissing(state: HumanTaskStateLike, workflowQueryRoles: unknown): boolean`; `type OfferedTransitionSource = 'state' | 'shared' | 'cancel' | 'exit' | 'updateData'`; `interface OfferedTransition { key: string; source: OfferedTransitionSource }`; `offeredTransitionsForState(attributes: unknown, stateKey: string): OfferedTransition[]`; `HUMAN_TASK_MAPPING_SNIPPET: string`.
  - `stateNodeData.ts`: `DEFAULT_LONG_POLL_FALLBACK_SECONDS = 60`; `interface InteractionNodeData { hasLongPoll: boolean; longPollAuth?: 'roles' | 'rule'; terminate?: boolean; fallbackTimeoutSeconds?: number }`; `interface StateNodeExtraData extends InteractionNodeData { humanTaskGateMissing: boolean }`; `deriveInteractionNodeData(interaction: unknown): InteractionNodeData`; `longPollTooltip(data: InteractionNodeData): string`; `deriveStateNodeData(state: HumanTaskStateLike & { interaction?: unknown }, workflowQueryRoles: unknown): StateNodeExtraData`.
  - `Conversion.ts`: state nodes of an Intermediate/Wizard state with `subType === 6` get `type: 'humanState'`; every state node's `data` gains the `StateNodeExtraData` fields.

- [ ] **Step 1: Write the failing `humanTask` test**

Create `humanTask.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HUMAN_TASK_MAPPING_SNIPPET,
  hasRoleGrants,
  isHumanTaskGateMissing,
  isHumanTaskState,
  offeredTransitionsForState,
} from './humanTask';

const APPROVER = [{ role: 'ht-approver', grant: 'allow' }];

describe('isHumanTaskState', () => {
  it('is true for subType 6 on states that can wait for a person', () => {
    expect(isHumanTaskState({ stateType: 2, subType: 6 })).toBe(true);
    expect(isHumanTaskState({ stateType: 1, subType: 6 })).toBe(true);
    expect(isHumanTaskState({ stateType: 5, subType: 6 })).toBe(true);
  });

  it('is false for Final and SubFlow states and other subTypes', () => {
    expect(isHumanTaskState({ stateType: 3, subType: 6 })).toBe(false);
    expect(isHumanTaskState({ stateType: 4, subType: 6 })).toBe(false);
    expect(isHumanTaskState({ stateType: 2, subType: 5 })).toBe(false);
    expect(isHumanTaskState({ stateType: 2 })).toBe(false);
  });
});

describe('hasRoleGrants', () => {
  it('needs at least one named role', () => {
    expect(hasRoleGrants(APPROVER)).toBe(true);
    expect(hasRoleGrants([])).toBe(false);
    expect(hasRoleGrants([{ role: '  ', grant: 'allow' }])).toBe(false);
    expect(hasRoleGrants(undefined)).toBe(false);
  });
});

describe('isHumanTaskGateMissing', () => {
  it('is missing when neither the state nor the workflow declares queryRoles', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6 }, undefined)).toBe(true);
  });

  it('is satisfied by state queryRoles or the workflow root fallback', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6, queryRoles: APPROVER }, undefined)).toBe(false);
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 6 }, APPROVER)).toBe(false);
  });

  it('never applies to non-human states', () => {
    expect(isHumanTaskGateMissing({ stateType: 2, subType: 0 }, undefined)).toBe(false);
  });
});

describe('offeredTransitionsForState', () => {
  const attributes = {
    states: [
      {
        key: 'ht-a-human',
        stateType: 2,
        subType: 6,
        transitions: [
          { key: 'ht-a-approve', target: 'ht-a-completed', triggerType: 0 },
          { key: 'auto-escalate', target: 'ht-a-completed', triggerType: 1 },
          { key: 'implicit-manual', target: 'ht-a-completed' },
        ],
      },
    ],
    sharedTransitions: [
      { key: 'everywhere', target: '$self', triggerType: 0 },
      { key: 'here-only', target: '$self', triggerType: 0, availableIn: [{ state: 'ht-a-human' }] },
      { key: 'elsewhere', target: '$self', triggerType: 0, availableIn: ['other'] },
      { key: 'nightly', target: '$self', triggerType: 2 },
    ],
    cancel: { key: 'cancel', target: 'ht-a-cancelled', availableIn: ['ht-a-human'] },
    exit: { key: 'exit', target: 'ht-a-cancelled', availableIn: ['other'] },
    updateData: { key: 'update-data', target: '$self' },
  };

  it('lists manual state, shared and lifecycle transitions offered in the state', () => {
    expect(offeredTransitionsForState(attributes, 'ht-a-human')).toEqual([
      { key: 'ht-a-approve', source: 'state' },
      { key: 'implicit-manual', source: 'state' },
      { key: 'everywhere', source: 'shared' },
      { key: 'here-only', source: 'shared' },
      { key: 'cancel', source: 'cancel' },
      { key: 'update-data', source: 'updateData' },
    ]);
  });

  it('returns nothing for a malformed document', () => {
    expect(offeredTransitionsForState(null, 'x')).toEqual([]);
  });
});

describe('HUMAN_TASK_MAPPING_SNIPPET', () => {
  it('writes humanTask.title and humanTask.description into instance data', () => {
    expect(HUMAN_TASK_MAPPING_SNIPPET).toContain('humanTask.title');
    expect(HUMAN_TASK_MAPPING_SNIPPET).toContain('humanTask.description');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils/humanTask.vitest.test.ts`
Expected: FAIL — cannot resolve `./humanTask`.

- [ ] **Step 3: Implement `humanTask.ts`**

```ts
import { availableInStateKeys } from '@vnext-forge-studio/vnext-types';

/**
 * Human-task rules the designer mirrors from the runtime
 * (vnext docs/runtime/human-task-function.md): an instance is listed while it
 * waits in its OWN state with subType 6 (never a Final or SubFlow state), and
 * the list is gated by the state queryRoles, else the workflow root
 * queryRoles — failing closed when neither declares any.
 */

export const HUMAN_SUBTYPE = 6;
const STATE_TYPE_FINAL = 3;
const STATE_TYPE_SUBFLOW = 4;
const TRIGGER_MANUAL = 0;

export interface HumanTaskStateLike {
  stateType?: unknown;
  subType?: unknown;
  queryRoles?: unknown;
}

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isHumanTaskState(state: HumanTaskStateLike): boolean {
  return (
    state.subType === HUMAN_SUBTYPE &&
    state.stateType !== STATE_TYPE_FINAL &&
    state.stateType !== STATE_TYPE_SUBFLOW
  );
}

export function hasRoleGrants(roles: unknown): boolean {
  return (
    Array.isArray(roles) &&
    roles.some((grant) => isRec(grant) && typeof grant.role === 'string' && grant.role.trim() !== '')
  );
}

export function isHumanTaskGateMissing(state: HumanTaskStateLike, workflowQueryRoles: unknown): boolean {
  return isHumanTaskState(state) && !hasRoleGrants(state.queryRoles) && !hasRoleGrants(workflowQueryRoles);
}

export type OfferedTransitionSource = 'state' | 'shared' | 'cancel' | 'exit' | 'updateData';

export interface OfferedTransition {
  key: string;
  source: OfferedTransitionSource;
}

function isManual(transition: Rec): boolean {
  return transition.triggerType === undefined || transition.triggerType === TRIGGER_MANUAL;
}

function availableIn(transition: Rec, stateKey: string): boolean {
  const keys = availableInStateKeys(transition.availableIn);
  return keys.length === 0 || keys.includes(stateKey);
}

/**
 * Transitions the state function can offer a caller in `stateKey`: manual
 * state transitions, manual shared transitions available there, and the
 * cancel / exit / updateData lifecycle transitions available there. Which of
 * them a caller actually sees is decided by roles at open time.
 */
export function offeredTransitionsForState(attributes: unknown, stateKey: string): OfferedTransition[] {
  if (!isRec(attributes)) return [];
  const offered: OfferedTransition[] = [];

  const states: unknown[] = Array.isArray(attributes.states) ? attributes.states : [];
  const state = states.find((s) => isRec(s) && s.key === stateKey);
  if (isRec(state) && Array.isArray(state.transitions)) {
    for (const t of state.transitions as unknown[]) {
      if (isRec(t) && typeof t.key === 'string' && isManual(t)) offered.push({ key: t.key, source: 'state' });
    }
  }

  if (Array.isArray(attributes.sharedTransitions)) {
    for (const t of attributes.sharedTransitions as unknown[]) {
      if (isRec(t) && typeof t.key === 'string' && isManual(t) && availableIn(t, stateKey)) {
        offered.push({ key: t.key, source: 'shared' });
      }
    }
  }

  for (const source of ['cancel', 'exit', 'updateData'] as const) {
    const t = attributes[source];
    if (isRec(t) && typeof t.key === 'string' && availableIn(t, stateKey)) offered.push({ key: t.key, source });
  }

  return offered;
}

/** C# mapping body that fills the text the human-task list shows. */
export const HUMAN_TASK_MAPPING_SNIPPET = [
  'dynamic humanTask = new ExpandoObject();',
  'humanTask.title = "Approve the application";',
  'humanTask.description = "Review the request and approve or reject it";',
  '',
  'dynamic data = new ExpandoObject();',
  'data.humanTask = humanTask;',
  'return Task.FromResult(new ScriptResponse { Data = data });',
].join('\n');
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils/humanTask.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing `stateNodeData` test**

Create `stateNodeData.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toVnextWorkflow, workflowToReactFlow } from './Conversion';
import { deriveInteractionNodeData, deriveStateNodeData, longPollTooltip } from './stateNodeData';

const RULE = { location: './src/Gate.csx', code: 'eA==' };

describe('deriveInteractionNodeData', () => {
  it('is empty without a long poll', () => {
    expect(deriveInteractionNodeData(null)).toEqual({ hasLongPoll: false });
    expect(deriveInteractionNodeData({})).toEqual({ hasLongPoll: false });
  });

  it('reads a roles arm with its window', () => {
    expect(
      deriveInteractionNodeData({ longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [] } }),
    ).toEqual({ hasLongPoll: true, longPollAuth: 'roles', terminate: true, fallbackTimeoutSeconds: 600 });
  });

  it('reads a rule arm without a window', () => {
    expect(deriveInteractionNodeData({ longPoll: { terminate: false, rule: RULE } })).toEqual({
      hasLongPoll: true,
      longPollAuth: 'rule',
      terminate: false,
    });
  });
});

describe('longPollTooltip', () => {
  it('summarizes terminate, window and arm', () => {
    expect(longPollTooltip({ hasLongPoll: true, longPollAuth: 'roles', terminate: true, fallbackTimeoutSeconds: 600 })).toBe(
      'Long poll · terminate · 600s · roles',
    );
    expect(longPollTooltip({ hasLongPoll: true, longPollAuth: 'rule', terminate: false })).toBe(
      'Long poll · no terminate · 60s (default) · rule',
    );
    expect(longPollTooltip({ hasLongPoll: false })).toBe('No long poll');
  });
});

describe('deriveStateNodeData', () => {
  it('flags a human task nobody can see', () => {
    expect(deriveStateNodeData({ stateType: 2, subType: 6 }, undefined).humanTaskGateMissing).toBe(true);
    expect(
      deriveStateNodeData({ stateType: 2, subType: 6 }, [{ role: 'ht-approver', grant: 'allow' }]).humanTaskGateMissing,
    ).toBe(false);
  });
});

describe('workflowToReactFlow — human and long-poll node data', () => {
  function stateNodes(states: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
    return workflowToReactFlow(
      toVnextWorkflow({
        key: 'wf',
        attributes: { startTransition: { key: 'start', target: 'entry' }, states, ...extra },
      }),
      { nodePos: {} },
    ).nodes.filter((n) => n.id !== '__start__');
  }

  it('gives an intermediate Human state the humanState node type', () => {
    const [node] = stateNodes([{ key: 'entry', stateType: 2, subType: 6, transitions: [] }]);
    expect(node.type).toBe('humanState');
    expect(node.data).toMatchObject({ humanTaskGateMissing: true, hasLongPoll: false });
  });

  it('keeps Initial, Final and SubFlow identities for subType 6', () => {
    const nodes = stateNodes([
      { key: 'entry', stateType: 1, subType: 6, transitions: [] },
      { key: 'done', stateType: 3, subType: 6, transitions: [] },
      { key: 'child', stateType: 4, subType: 6, transitions: [] },
    ]);
    expect(nodes.map((n) => n.type)).toEqual(['initialState', 'finalState', 'subFlowState']);
  });

  it('carries long-poll data and honours the workflow queryRoles fallback', () => {
    const [node] = stateNodes(
      [
        {
          key: 'entry',
          stateType: 2,
          subType: 6,
          interaction: { longPoll: { terminate: true, rule: RULE } },
          transitions: [],
        },
      ],
      { queryRoles: [{ role: 'ht-approver', grant: 'allow' }] },
    );
    expect(node.data).toMatchObject({
      hasLongPoll: true,
      longPollAuth: 'rule',
      terminate: true,
      humanTaskGateMissing: false,
    });
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils/stateNodeData.vitest.test.ts`
Expected: FAIL — cannot resolve `./stateNodeData`.

- [ ] **Step 7: Implement `stateNodeData.ts`**

```ts
import { isHumanTaskGateMissing, type HumanTaskStateLike } from './humanTask';

/** Runtime default acknowledge window (vnext long-poll-termination.md). */
export const DEFAULT_LONG_POLL_FALLBACK_SECONDS = 60;

export interface InteractionNodeData {
  hasLongPoll: boolean;
  longPollAuth?: 'roles' | 'rule';
  terminate?: boolean;
  fallbackTimeoutSeconds?: number;
}

export interface StateNodeExtraData extends InteractionNodeData {
  humanTaskGateMissing: boolean;
}

export function deriveInteractionNodeData(interaction: unknown): InteractionNodeData {
  if (typeof interaction !== 'object' || interaction === null) return { hasLongPoll: false };
  const longPoll = (interaction as { longPoll?: unknown }).longPoll;
  if (typeof longPoll !== 'object' || longPoll === null) return { hasLongPoll: false };
  const rec = longPoll as Record<string, unknown>;
  const data: InteractionNodeData = {
    hasLongPoll: true,
    longPollAuth: rec.rule !== undefined && rec.rule !== null ? 'rule' : 'roles',
    terminate: rec.terminate === true,
  };
  if (typeof rec.fallbackTimeoutSeconds === 'number') data.fallbackTimeoutSeconds = rec.fallbackTimeoutSeconds;
  return data;
}

export function longPollTooltip(data: InteractionNodeData): string {
  if (!data.hasLongPoll) return 'No long poll';
  const fallback =
    data.fallbackTimeoutSeconds === undefined
      ? `${DEFAULT_LONG_POLL_FALLBACK_SECONDS}s (default)`
      : `${data.fallbackTimeoutSeconds}s`;
  return ['Long poll', data.terminate ? 'terminate' : 'no terminate', fallback, data.longPollAuth ?? 'roles'].join(' · ');
}

export function deriveStateNodeData(
  state: HumanTaskStateLike & { interaction?: unknown },
  workflowQueryRoles: unknown,
): StateNodeExtraData {
  return {
    ...deriveInteractionNodeData(state.interaction),
    humanTaskGateMissing: isHumanTaskGateMissing(state, workflowQueryRoles),
  };
}
```

- [ ] **Step 8: Wire `Conversion.ts` (Edit tool only)**

1. After the line `import { parseAvailableIn, type AvailableIn } from '@vnext-forge-studio/vnext-types';` add:

```ts
import { deriveStateNodeData } from './stateNodeData';
```

2. In `interface WorkflowState`, replace

```ts
  errorBoundary?: unknown;
  subFlow?: unknown;
}
```

with

```ts
  errorBoundary?: unknown;
  subFlow?: unknown;
  queryRoles?: unknown;
  interaction?: unknown;
}
```

3. In `interface VnextWorkflow`, replace `    exit?: WorkflowLevelTransition;` with

```ts
    exit?: WorkflowLevelTransition;
    queryRoles?: unknown;
```

4. Replace the whole `getNodeType` function with:

```ts
/**
 * Initial, Final and SubFlow keep their identity for any subType (entry
 * point, terminal, child workflow). A Human (6) Intermediate or Wizard state
 * is a dedicated `humanState` node.
 */
function getNodeType(stateType: number, subType: number): string {
  switch (stateType) {
    case 1: return 'initialState';
    case 3: return 'finalState';
    case 4: return 'subFlowState';
  }
  if (subType === 6) return 'humanState';
  if (stateType === 5) return 'wizardState';
  return 'intermediateState';
}
```

5. Replace `      type: getNodeType(state.stateType),` with `      type: getNodeType(state.stateType, state.subType ?? 0),`.

6. Replace

```ts
        subFlowProcessDomain: (state.subFlow as any)?.process?.domain || '',
      },
```

with

```ts
        subFlowProcessDomain: (state.subFlow as any)?.process?.domain || '',
        ...deriveStateNodeData(state, workflow.attributes?.queryRoles),
      },
```

7. Verify the NUL bytes survived:

Run: `python3 -c "print(open('packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts','rb').read().count(b'\x00'))"`
Expected: `2`.

- [ ] **Step 9: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/utils && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS (new tests and `availableInEdges.vitest.test.ts`), exit 0. (`humanState` is registered in Task 10; until then React Flow falls back to its default node for that type — acceptable between commits, not shipped.)

- [ ] **Step 10: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/utils/humanTask.ts packages/designer-ui/src/modules/canvas-interaction/utils/humanTask.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/utils/stateNodeData.ts packages/designer-ui/src/modules/canvas-interaction/utils/stateNodeData.vitest.test.ts packages/designer-ui/src/modules/canvas-interaction/utils/Conversion.ts
git commit -m "$(cat <<'MSG'
feat(canvas): human-task and long-poll node data, humanState node type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: Human node look and state indicators (C4/C5 visuals)

**Files:**
- Modify (full rewrite): `packages/designer-ui/src/modules/canvas-interaction/components/nodes/stateNodeConfig.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/stateNodeConfig.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/index.ts`
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeIndicators.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeIndicators.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/nodes/StateNodeBase.tsx`

**Interfaces:**
- Consumes: Task 9 (`InteractionNodeData`, `longPollTooltip`, node data fields `hasLongPoll`, `longPollAuth`, `terminate`, `fallbackTimeoutSeconds`, `humanTaskGateMissing`, node type `humanState`).
- Produces: `getStateNodeConfig(stateType, subType)` — Initial keeps its look for Human; Human config has `borderStyle: 'border-dotted'`. `LongPollIndicator(props: Partial<InteractionNodeData>)`, `HumanTaskGateDot(props: { show: boolean })`, `HUMAN_TASK_GATE_MISSING_LABEL: string`. `nodeTypes.humanState = StateNodeBase`.

- [ ] **Step 1: Update the failing config test**

Replace the body of `stateNodeConfig.vitest.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest';
import { getStateNodeConfig } from './stateNodeConfig';

describe('getStateNodeConfig', () => {
  it('uses the Human look with a dotted border on an intermediate state', () => {
    const config = getStateNodeConfig(2, 6);
    expect(config.typeLabel).toBe('Human');
    expect(config.borderStyle).toBe('border-dotted');
  });

  it('uses the Human look on a wizard state', () => {
    expect(getStateNodeConfig(5, 6).typeLabel).toBe('Human');
  });

  it('keeps Initial identity for a Human initial state', () => {
    expect(getStateNodeConfig(1, 6).typeLabel).toBe('Initial');
  });

  it('overlays Busy on intermediate and initial states', () => {
    expect(getStateNodeConfig(2, 5).typeLabel).toBe('Busy');
    expect(getStateNodeConfig(1, 5).typeLabel).toBe('Busy');
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

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/nodes/stateNodeConfig.vitest.test.tsx`
Expected: FAIL — `borderStyle` is `undefined`; `(1, 6)` returns `Human`.

- [ ] **Step 3: Rewrite `stateNodeConfig.tsx`**

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
const HUMAN: StateNodeConfig = { bg: 'bg-indigo-500/10', text: 'text-indigo-600', accent: 'bg-indigo-500', ring: 'ring-indigo-500/20', icon: <UserCircle size={16} />, typeLabel: 'Human', borderStyle: 'border-dotted' };
const INITIAL: StateNodeConfig = { bg: 'bg-initial/10', text: 'text-initial', accent: 'bg-initial', ring: 'ring-initial/20', icon: <Play size={16} />, typeLabel: 'Initial' };
const SUBFLOW: StateNodeConfig = { bg: 'bg-subflow/10', text: 'text-subflow', accent: 'bg-subflow', ring: 'ring-subflow/20', icon: <Repeat2 size={16} />, typeLabel: 'SubFlow', borderStyle: 'border-dashed' };

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
 * Visual config for a state node.
 *
 * - Final and SubFlow keep their identity for any subType.
 * - Busy (5) overlays every other state type.
 * - Initial keeps its identity for Human (6): the stamp marks the entry point.
 * - Human (6) on an Intermediate or Wizard state is the dedicated Human node
 *   (`humanState` in Conversion.ts), dotted border.
 */
export function getStateNodeConfig(stateType: number, subType: number): StateNodeConfig {
  if (stateType === 3) return finalConfig(subType);
  if (stateType === 4) return SUBFLOW;
  if (subType === 5) return BUSY;
  if (stateType === 1) return INITIAL;
  if (subType === 6) return HUMAN;
  if (stateType === 5) {
    return { bg: 'bg-wizard/10', text: 'text-wizard', accent: 'bg-wizard', ring: 'ring-wizard/20', icon: <LayoutGrid size={16} />, typeLabel: 'Wizard' };
  }
  return { bg: 'bg-intermediate/10', text: 'text-intermediate', accent: 'bg-intermediate', ring: 'ring-intermediate/20', icon: <Square size={16} />, typeLabel: 'State' };
}
```

- [ ] **Step 4: Run to verify the config test passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/nodes/stateNodeConfig.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing indicators test**

Create `StateNodeIndicators.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HUMAN_TASK_GATE_MISSING_LABEL, HumanTaskGateDot, LongPollIndicator } from './StateNodeIndicators';

describe('LongPollIndicator', () => {
  it('renders a labelled radio-tower icon for a long poll', () => {
    const html = renderToStaticMarkup(
      createElement(LongPollIndicator, { hasLongPoll: true, longPollAuth: 'rule', terminate: true }),
    );
    expect(html).toContain('title="Long poll · terminate · 60s (default) · rule"');
    expect(html).toContain('<svg');
  });

  it('renders nothing without a long poll', () => {
    expect(renderToStaticMarkup(createElement(LongPollIndicator, {}))).toBe('');
  });
});

describe('HumanTaskGateDot', () => {
  it('renders the warning dot only when the gate is missing', () => {
    expect(renderToStaticMarkup(createElement(HumanTaskGateDot, { show: true }))).toContain(
      HUMAN_TASK_GATE_MISSING_LABEL,
    );
    expect(renderToStaticMarkup(createElement(HumanTaskGateDot, { show: false }))).toBe('');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/nodes/StateNodeIndicators.vitest.test.tsx`
Expected: FAIL — cannot resolve `./StateNodeIndicators`.

- [ ] **Step 7: Create `StateNodeIndicators.tsx`**

```tsx
import { RadioTower } from 'lucide-react';
import { longPollTooltip, type InteractionNodeData } from '../../utils/stateNodeData';

/** Stats-row mini icon: the state holds long polls (C5). */
export function LongPollIndicator(props: Partial<InteractionNodeData>) {
  if (!props.hasLongPoll) return null;
  const label = longPollTooltip({ ...props, hasLongPoll: true });
  return (
    <span className="text-initial inline-flex items-center" title={label} aria-label={label}>
      <RadioTower size={11} strokeWidth={2.25} />
    </span>
  );
}

export const HUMAN_TASK_GATE_MISSING_LABEL =
  'Human task without queryRoles — the human-task list shows it to nobody';

/** Corner dot on the icon stamp: a human task no caller can see (C4). */
export function HumanTaskGateDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      role="img"
      className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning-icon ring-2 ring-surface"
      title={HUMAN_TASK_GATE_MISSING_LABEL}
      aria-label={HUMAN_TASK_GATE_MISSING_LABEL}
    />
  );
}
```

- [ ] **Step 8: Register the node type and render the indicators**

1. In `nodes/index.ts`, after `  wizardState: StateNodeBase,` add `  humanState: StateNodeBase,`.

2. In `StateNodeBase.tsx`:
   - After `import { getStateNodeConfig } from './stateNodeConfig';` add `import { HumanTaskGateDot, LongPollIndicator } from './StateNodeIndicators';`.
   - In `interface StateNodeData`, after `  subFlowProcessDomain: string;` add:

```ts
  hasLongPoll?: boolean;
  longPollAuth?: 'roles' | 'rule';
  terminate?: boolean;
  fallbackTimeoutSeconds?: number;
  humanTaskGateMissing?: boolean;
```

   - Replace

```tsx
          className={`shrink-0 rounded-xl ${config.accent} flex items-center justify-center shadow-sm ring-1 ring-black/5`}
        >
          <span className="text-white [&>svg]:size-[18px]">{config.icon}</span>
        </div>
```

     with

```tsx
          className={`relative shrink-0 rounded-xl ${config.accent} flex items-center justify-center shadow-sm ring-1 ring-black/5`}
        >
          <span className="text-white [&>svg]:size-[18px]">{config.icon}</span>
          <HumanTaskGateDot show={Boolean(d.humanTaskGateMissing)} />
        </div>
```

   - Replace `{statsAllowed && (totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow) && (` with `{statsAllowed && (totalActions > 0 || d.transitionCount > 0 || d.hasView || d.hasErrorBoundary || d.hasSubFlow || d.hasLongPoll) && (`.
   - Replace

```tsx
                <Repeat2 size={11} strokeWidth={2.25} />
              </span>
            )}
          </div>
```

     with

```tsx
                <Repeat2 size={11} strokeWidth={2.25} />
              </span>
            )}
            <LongPollIndicator
              hasLongPoll={d.hasLongPoll}
              longPollAuth={d.longPollAuth}
              terminate={d.terminate}
              fallbackTimeoutSeconds={d.fallbackTimeoutSeconds}
            />
          </div>
```

   - Add `- RadioTower → "Long poll" (tooltip: terminate · window · arm)` to the icon list in the stats-row comment block.

- [ ] **Step 9: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/nodes && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS, exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/nodes
git commit -m "$(cat <<'MSG'
feat(canvas): Human task node look, long-poll indicator and missing-queryRoles dot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 11: Human Task property tab (C4)

**Files:**
- Create: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.tsx`
- Test: `packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/canvas-interaction/components/panels/StatePropertyPanel.tsx`

**Interfaces:**
- Consumes: Task 9 (`HUMAN_TASK_MAPPING_SNIPPET`, `hasRoleGrants`, `isHumanTaskState`, `offeredTransitionsForState`, `OfferedTransition`, `deriveInteractionNodeData`, `longPollTooltip`), `RoleGrantEditor`, `Badge`, `Section`.
- Produces: `HumanTaskTab(props: HumanTaskTabProps)` with `interface HumanTaskTabProps { stateType: number; subType: number; queryRoles: RoleGrant[]; workflowQueryRoles: RoleGrant[]; offeredTransitions: OfferedTransition[]; interaction: unknown; onUpdateQueryRoles: (roles: RoleGrant[]) => void }`; `StatePropertyPanel` shows the **Human Task** tab when `subType === 6`.

- [ ] **Step 1: Write the failing test**

Create `HumanTaskTab.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { HumanTaskTab, type HumanTaskTabProps } from './HumanTaskTab';

const APPROVER: RoleGrant[] = [{ role: 'ht-approver', grant: 'allow' }];

function render(overrides: Partial<HumanTaskTabProps> = {}): string {
  const props: HumanTaskTabProps = {
    stateType: 2,
    subType: 6,
    queryRoles: [],
    workflowQueryRoles: [],
    offeredTransitions: [
      { key: 'ht-a-approve', source: 'state' },
      { key: 'cancel', source: 'cancel' },
    ],
    interaction: null,
    onUpdateQueryRoles: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HumanTaskTab, props));
}

describe('HumanTaskTab', () => {
  it('puts required queryRoles first and explains the fail-closed gate', () => {
    const html = render();
    expect(html.indexOf('Query roles (required)')).toBeLessThan(html.indexOf('Task text'));
    expect(html).toContain('fails closed');
    expect(html).toContain('listed for nobody');
  });

  it('accepts the workflow queryRoles as the fallback gate', () => {
    const html = render({ workflowQueryRoles: APPROVER });
    expect(html).not.toContain('listed for nobody');
    expect(html).toContain('workflow queryRoles apply');
  });

  it('shows state queryRoles in the editor', () => {
    expect(render({ queryRoles: APPROVER })).toContain('value="ht-approver"');
  });

  it('explains where the task text comes from, with a mapping snippet', () => {
    const html = render();
    expect(html).toContain('humanTask.title');
    expect(html).toContain('humanTask.description');
    expect(html).toContain('new ExpandoObject()');
  });

  it('lists the offered transitions and the interaction status', () => {
    const html = render({ interaction: { longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [] } } });
    expect(html).toContain('ht-a-approve');
    expect(html).toContain('Cancel');
    expect(html).toContain('Long poll · terminate · 600s · roles');
  });

  it('warns that Final and SubFlow states are never listed', () => {
    expect(render({ stateType: 3 })).toContain('never appear in the human-task list');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.vitest.test.tsx`
Expected: FAIL — cannot resolve `./HumanTaskTab`.

- [ ] **Step 3: Create `HumanTaskTab.tsx`**

```tsx
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import {
  HUMAN_TASK_MAPPING_SNIPPET,
  hasRoleGrants,
  isHumanTaskState,
  type OfferedTransition,
} from '../../../utils/humanTask';
import { deriveInteractionNodeData, longPollTooltip } from '../../../utils/stateNodeData';
import { Badge, Section } from './PropertyPanelShared';
import { RoleGrantEditor } from './subflow/RoleGrantEditor';

export interface HumanTaskTabProps {
  stateType: number;
  subType: number;
  queryRoles: RoleGrant[];
  workflowQueryRoles: RoleGrant[];
  offeredTransitions: OfferedTransition[];
  interaction: unknown;
  onUpdateQueryRoles: (roles: RoleGrant[]) => void;
}

const SOURCE_LABEL: Record<OfferedTransition['source'], string> = {
  state: 'State',
  shared: 'Shared',
  cancel: 'Cancel',
  exit: 'Exit',
  updateData: 'Update data',
};

const NOTE = 'text-[10px] text-muted-foreground mb-2 leading-relaxed';

export function HumanTaskTab({
  stateType,
  subType,
  queryRoles,
  workflowQueryRoles,
  offeredTransitions,
  interaction,
  onUpdateQueryRoles,
}: HumanTaskTabProps) {
  const listed = isHumanTaskState({ stateType, subType });
  const stateGated = hasRoleGrants(queryRoles);
  const workflowGated = hasRoleGrants(workflowQueryRoles);
  const interactionData = deriveInteractionNodeData(interaction);

  return (
    <div className="space-y-3">
      {!listed && (
        <p className="rounded-md border border-warning-border bg-warning-surface px-2 py-1.5 text-[10px] text-warning-text leading-relaxed">
          Final and SubFlow states never appear in the human-task list — only an active instance
          waiting in this state does.
        </p>
      )}

      <Section title="Query roles (required)" count={queryRoles.length} defaultOpen>
        <p className={NOTE}>
          The human-task list shows this task only to callers these roles allow. The list fails
          closed: when neither this state nor the workflow declares queryRoles, nobody sees the
          task.
        </p>
        {!stateGated &&
          (workflowGated ? (
            <p className="mb-2 text-[10px] text-muted-foreground leading-relaxed">
              No state queryRoles — the workflow queryRoles apply.
            </p>
          ) : (
            <p
              role="alert"
              className="mb-2 rounded-md border border-destructive-border bg-destructive-surface px-2 py-1 text-[10px] text-destructive-text leading-relaxed">
              No queryRoles on this state or the workflow — this task is listed for nobody.
            </p>
          ))}
        <RoleGrantEditor roles={queryRoles} onChange={onUpdateQueryRoles} contextLabel="human task" />
      </Section>

      <Section title="Task text" defaultOpen>
        <p className={NOTE}>
          The list shows the title and description from instance data <code>humanTask.title</code>{' '}
          and <code>humanTask.description</code>. Set them in a mapping that runs before the
          instance enters this state, for example:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface p-2 font-mono text-[10px] leading-relaxed text-foreground">
          {HUMAN_TASK_MAPPING_SNIPPET}
        </pre>
      </Section>

      <Section title="Offered transitions" count={offeredTransitions.length} defaultOpen>
        <p className={NOTE}>
          Manual transitions a caller can be offered in this state. Each transition roles decide
          what a caller actually sees when the instance is opened.
        </p>
        {offeredTransitions.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No manual transitions are offered in this state.</p>
        ) : (
          <ul className="space-y-1">
            {offeredTransitions.map((transition) => (
              <li key={`${transition.source}-${transition.key}`} className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-foreground">{transition.key}</span>
                <Badge className="bg-muted text-muted-foreground">{SOURCE_LABEL[transition.source]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Interaction" defaultOpen>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {interactionData.hasLongPoll
            ? longPollTooltip(interactionData)
            : 'No long poll — the client keeps polling normally.'}
        </p>
      </Section>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.vitest.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the tab into `StatePropertyPanel.tsx`**

1. After `import { StartNodePanel } from './tabs/StartNodePanel';` add:

```ts
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { HumanTaskTab } from './tabs/HumanTaskTab';
import { offeredTransitionsForState } from '../../utils/humanTask';
```

2. Replace `type Tab = 'general' | 'tasks' | 'transitions' | 'subflow' | 'error-boundary';` with

```ts
type Tab = 'general' | 'human-task' | 'tasks' | 'transitions' | 'subflow' | 'error-boundary';
```

3. In the `tabs` array, after `    { key: 'general', label: 'General', show: true },` add

```ts
    { key: 'human-task', label: 'Human Task', show: subType === 6 },
```

4. Replace every occurrence of `activeTab === ` with `shownTab === ` in this file (Edit with `replace_all: true`; it hits the two tab-button class expressions and the content lines).

5. Directly after the closing `];` of the `tabs` array add:

```ts
  // A tab can disappear when the state changes (e.g. subType no longer Human);
  // fall back to General instead of rendering an empty panel.
  const shownTab: Tab = tabs.some((t) => t.key === activeTab && t.show) ? activeTab : 'general';
  // `state` is `any` in this file; read the Human Task inputs through typed views.
  const workflowAttributes = (workflowJson as { attributes?: Record<string, unknown> } | null)?.attributes;
  const humanState = state as { key: string; queryRoles?: RoleGrant[]; interaction?: unknown };
```

6. After the line `{shownTab === 'general' && <GeneralTab state={state} updateWorkflow={updateWorkflow} />}` add:

```tsx
        {shownTab === 'human-task' && (
          <HumanTaskTab
            stateType={Number(stateType)}
            subType={Number(subType ?? 0)}
            queryRoles={humanState.queryRoles ?? []}
            workflowQueryRoles={(workflowAttributes?.queryRoles as RoleGrant[] | undefined) ?? []}
            offeredTransitions={offeredTransitionsForState(workflowAttributes, humanState.key)}
            interaction={humanState.interaction}
            onUpdateQueryRoles={(roles) =>
              updateWorkflow((draft) => {
                const states = (draft.attributes as { states?: { key: string; queryRoles?: RoleGrant[] }[] } | undefined)
                  ?.states;
                const s = states?.find((x) => x.key === humanState.key);
                if (s) s.queryRoles = roles.length > 0 ? roles : undefined;
              })
            }
          />
        )}
```

- [ ] **Step 6: Type-check and run the panel tests**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/canvas-interaction/components/panels`
Expected: exit 0; PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/tabs/HumanTaskTab.vitest.test.tsx packages/designer-ui/src/modules/canvas-interaction/components/panels/StatePropertyPanel.tsx
git commit -m "$(cat <<'MSG'
feat(designer): Human Task tab with required queryRoles, task text and offered transitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: Runtime-sync lint rules for workflows (C7)

**Files:**
- Create: `packages/designer-ui/src/modules/workflow-validation/runtimeSyncRules.ts`
- Test: `packages/designer-ui/src/modules/workflow-validation/runtimeSyncRules.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/workflow-validation/ValidationEngine.ts`
- Modify: `packages/designer-ui/src/modules/workflow-validation/ValidationEngine.vitest.test.ts` (append)
- Modify: `packages/designer-ui/src/modules/canvas-interaction/utils/workflowLint.ts`
- Create: `packages/designer-ui/src/modules/canvas-interaction/utils/workflowLint.vitest.test.ts`

**Interfaces:**
- Consumes: Task 9 (`isHumanTaskGateMissing`, `HumanTaskStateLike`).
- Produces: `type RuntimeSyncSeverity = 'error' | 'warning' | 'info'`; `interface RuntimeSyncFinding { severity: RuntimeSyncSeverity; rule: string; message: string; stateKey?: string }`; `runtimeSyncFindings(workflow: unknown): RuntimeSyncFinding[]` with rule ids `subflow-state-subprocess` (error), `human-task-query-roles` (warning), `timeout-timer-reset-ignored` (info), `auto-and-scheduled` (info). `validateWorkflow` appends them as `ValidationIssue`s (`nodeId` = `stateKey`); `lintWorkflow` appends them as `LintFinding`s.

- [ ] **Step 1: Write the failing rules test**

Create `runtimeSyncRules.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runtimeSyncFindings } from './runtimeSyncRules';

const wf = (attributes: Record<string, unknown>) => ({ attributes });
const rules = (attributes: Record<string, unknown>) => runtimeSyncFindings(wf(attributes)).map((f) => f.rule);

describe('runtimeSyncFindings', () => {
  it('reports a state-level SubProcess as an error on the state', () => {
    expect(runtimeSyncFindings(wf({ states: [{ key: 'spawn', stateType: 4, subFlow: { type: 'P' } }] }))).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'subflow-state-subprocess', stateKey: 'spawn' }),
    ]);
    expect(rules({ states: [{ key: 'child', stateType: 4, subFlow: { type: 'S' } }] })).toEqual([]);
  });

  it('warns about a Human state that no queryRoles gate', () => {
    expect(runtimeSyncFindings(wf({ states: [{ key: 'ht-a-human', stateType: 2, subType: 6 }] }))).toEqual([
      expect.objectContaining({ severity: 'warning', rule: 'human-task-query-roles', stateKey: 'ht-a-human' }),
    ]);
  });

  it('accepts a Human state gated by its own or the workflow queryRoles', () => {
    const grant = [{ role: 'ht-approver', grant: 'allow' }];
    expect(rules({ states: [{ key: 'h', stateType: 2, subType: 6, queryRoles: grant }] })).toEqual([]);
    expect(rules({ queryRoles: grant, states: [{ key: 'h', stateType: 2, subType: 6 }] })).toEqual([]);
    expect(rules({ states: [{ key: 'h', stateType: 3, subType: 6 }] })).toEqual([]);
  });

  it('notes that timer.reset on the workflow timeout has no effect', () => {
    const findings = runtimeSyncFindings(
      wf({ timeout: { key: 'root-abandoned', target: 'root-timedout', timer: { reset: 'never', duration: 'PT20S' } }, states: [] }),
    );
    expect(findings).toEqual([expect.objectContaining({ severity: 'info', rule: 'timeout-timer-reset-ignored' })]);
    expect(findings[0].stateKey).toBeUndefined();
    expect(findings[0].message).toContain('"never"');
  });

  it('notes timer.reset on a subflow timeout override, on the parent state', () => {
    const findings = runtimeSyncFindings(
      wf({
        states: [
          {
            key: 'parent-subflow',
            stateType: 4,
            subFlow: { type: 'S', overrides: { timeout: { key: 'k', target: 't', timer: { reset: 'never', duration: 'PT20S' } } } },
          },
        ],
      }),
    );
    expect(findings).toEqual([
      expect.objectContaining({ severity: 'info', rule: 'timeout-timer-reset-ignored', stateKey: 'parent-subflow' }),
    ]);
  });

  it('notes a state with both automatic and scheduled transitions', () => {
    expect(
      runtimeSyncFindings(
        wf({
          states: [
            {
              key: 'waiting',
              stateType: 2,
              transitions: [
                { key: 'auto-go', target: 'done', triggerType: 1 },
                { key: 'later', target: 'done', triggerType: 2 },
              ],
            },
          ],
        }),
      ),
    ).toEqual([expect.objectContaining({ severity: 'info', rule: 'auto-and-scheduled', stateKey: 'waiting' })]);
  });

  it('returns nothing for a document that is not an object', () => {
    expect(runtimeSyncFindings(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/workflow-validation/runtimeSyncRules.vitest.test.ts`
Expected: FAIL — cannot resolve `./runtimeSyncRules`.

- [ ] **Step 3: Implement `runtimeSyncRules.ts`**

```ts
import { isHumanTaskGateMissing, type HumanTaskStateLike } from '../canvas-interaction/utils/humanTask';

/**
 * Workflow rules that come from runtime behaviour rather than the schema
 * (spec Phase C7). Shared by `validateWorkflow` (Problems panel) and
 * `lintWorkflow` (canvas) so the two never disagree.
 */

export type RuntimeSyncSeverity = 'error' | 'warning' | 'info';

export interface RuntimeSyncFinding {
  severity: RuntimeSyncSeverity;
  rule: string;
  message: string;
  stateKey?: string;
}

type Rec = Record<string, unknown>;

const TRIGGER_AUTOMATIC = 1;
const TRIGGER_SCHEDULED = 2;

function isRec(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timerReset(timeout: unknown): string | null {
  if (!isRec(timeout) || !isRec(timeout.timer)) return null;
  const reset = timeout.timer.reset;
  return typeof reset === 'string' && reset.trim() !== '' ? reset : null;
}

export function runtimeSyncFindings(workflow: unknown): RuntimeSyncFinding[] {
  if (!isRec(workflow) || !isRec(workflow.attributes)) return [];
  const attributes = workflow.attributes;
  const findings: RuntimeSyncFinding[] = [];

  const workflowReset = timerReset(attributes.timeout);
  if (workflowReset !== null) {
    findings.push({
      severity: 'info',
      rule: 'timeout-timer-reset-ignored',
      message: `Workflow timeout timer.reset "${workflowReset}" has no effect — the runtime does not implement reset strategies.`,
    });
  }

  const states = Array.isArray(attributes.states) ? (attributes.states as unknown[]).filter(isRec) : [];
  for (const state of states) {
    const key = typeof state.key === 'string' ? state.key : '';
    const subFlow = isRec(state.subFlow) ? state.subFlow : null;

    if (subFlow?.type === 'P') {
      findings.push({
        severity: 'error',
        rule: 'subflow-state-subprocess',
        message: `State "${key}" starts a SubProcess from its subFlow (type "P"). A state may only start a SubFlow — start a SubProcess with a SubProcessTask (type 14).`,
        stateKey: key,
      });
    }

    const overrideReset = subFlow && isRec(subFlow.overrides) ? timerReset(subFlow.overrides.timeout) : null;
    if (overrideReset !== null) {
      findings.push({
        severity: 'info',
        rule: 'timeout-timer-reset-ignored',
        message: `SubFlow timeout override in state "${key}": timer.reset "${overrideReset}" has no effect — the runtime does not implement reset strategies.`,
        stateKey: key,
      });
    }

    if (isHumanTaskGateMissing(state as HumanTaskStateLike, attributes.queryRoles)) {
      findings.push({
        severity: 'warning',
        rule: 'human-task-query-roles',
        message: `Human task state "${key}" has no queryRoles and the workflow declares none. The human-task list fails closed, so this task is listed for nobody.`,
        stateKey: key,
      });
    }

    const triggers = (Array.isArray(state.transitions) ? (state.transitions as unknown[]) : [])
      .filter(isRec)
      .map((transition) => transition.triggerType);
    if (triggers.includes(TRIGGER_AUTOMATIC) && triggers.includes(TRIGGER_SCHEDULED)) {
      findings.push({
        severity: 'info',
        rule: 'auto-and-scheduled',
        message: `State "${key}" has both automatic and scheduled transitions. When an automatic transition fires, the scheduled timer is never armed.`,
        stateKey: key,
      });
    }
  }

  return findings;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/workflow-validation/runtimeSyncRules.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing integration tests**

Append to `ValidationEngine.vitest.test.ts`:

```ts
describe('runtime-sync rules in validateWorkflow', () => {
  it('reports a state-level SubProcess as an error on its node', () => {
    const issues = validateWorkflow(
      workflowWith({
        states: [
          { key: 'review', stateType: 1, transitions: [{ key: 'go', target: 'spawn' }] },
          {
            key: 'spawn',
            stateType: 4,
            subFlow: { type: 'P', process: { key: 'x', domain: 'core', version: '1.0.0', flow: 'sys-flows' } },
            transitions: [{ key: 'done', target: 'done' }],
          },
          { key: 'done', stateType: 3, transitions: [] },
        ],
      }),
    ).filter((issue) => issue.rule === 'subflow-state-subprocess');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', nodeId: 'spawn' });
  });
});
```

Create `packages/designer-ui/src/modules/canvas-interaction/utils/workflowLint.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toVnextWorkflow } from './Conversion';
import { lintWorkflow } from './workflowLint';

describe('lintWorkflow — runtime-sync rules', () => {
  it('includes the human-task queryRoles warning with its state', () => {
    const findings = lintWorkflow(
      toVnextWorkflow({
        key: 'wf',
        attributes: {
          states: [
            { key: 'entry', stateType: 1, labels: [{ language: 'en', label: 'Entry' }], transitions: [{ key: 'go', target: 'ht' }] },
            { key: 'ht', stateType: 2, subType: 6, labels: [{ language: 'en', label: 'Approve' }], transitions: [{ key: 'ok', target: 'done' }] },
            { key: 'done', stateType: 3, labels: [{ language: 'en', label: 'Done' }], transitions: [] },
          ],
        },
      }),
    );
    expect(findings.filter((f) => f.rule === 'human-task-query-roles')).toEqual([
      expect.objectContaining({ severity: 'warning', stateKey: 'ht' }),
    ]);
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/workflow-validation/ValidationEngine.vitest.test.ts src/modules/canvas-interaction/utils/workflowLint.vitest.test.ts`
Expected: FAIL — both filters return `[]`.

- [ ] **Step 7: Consume the rules**

In `ValidationEngine.ts`:
- After `import type { ValidationIssue } from './WorkflowValidationTypes';` add `import { runtimeSyncFindings } from './runtimeSyncRules';`.
- Replace the final

```ts
  return results;
}

function isWorkflowData(
```

with

```ts
  for (const finding of runtimeSyncFindings(workflow)) {
    results.push({
      id: makeId(),
      severity: finding.severity,
      message: finding.message,
      rule: finding.rule,
      ...(finding.stateKey ? { nodeId: finding.stateKey } : {}),
    });
  }

  return results;
}

function isWorkflowData(
```

In `workflowLint.ts`:
- After `import type { VnextWorkflow } from './Conversion';` add `import { runtimeSyncFindings } from '../../workflow-validation/runtimeSyncRules';`.
- Replace

```ts
  return findings;
}

// ─── Pattern Detection
```

with

```ts
  for (const finding of runtimeSyncFindings(workflow)) {
    findings.push({
      severity: finding.severity,
      rule: finding.rule,
      message: finding.message,
      ...(finding.stateKey ? { stateKey: finding.stateKey } : {}),
    });
  }

  return findings;
}

// ─── Pattern Detection
```

- [ ] **Step 8: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/workflow-validation src/modules/canvas-interaction/utils && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS, exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/designer-ui/src/modules/workflow-validation packages/designer-ui/src/modules/canvas-interaction/utils/workflowLint.ts packages/designer-ui/src/modules/canvas-interaction/utils/workflowLint.vitest.test.ts
git commit -m "$(cat <<'MSG'
feat(validation): runtime rules for SubProcess states, human-task gates, timer.reset and auto+scheduled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 13: Function editor — task-key collisions and authorize-only roles (C7)

**Files:**
- Create: `packages/designer-ui/src/modules/function-editor/functionTaskKeys.ts`
- Test: `packages/designer-ui/src/modules/function-editor/functionTaskKeys.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/function-editor/components/FunctionTaskKeyCollisions.tsx`
- Create: `packages/designer-ui/src/modules/function-editor/components/FunctionRolesSection.tsx`
- Test: `packages/designer-ui/src/modules/function-editor/components/FunctionRuntimeRules.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/function-editor/components/FunctionMultipleTasksSection.tsx`
- Modify: `packages/designer-ui/src/modules/function-editor/components/FunctionEditorPanel.tsx`

**Interfaces:**
- Consumes: `RoleGrant`; `RoleGrantEditor` (`../../canvas-interaction/components/panels/tabs/subflow/RoleGrantEditor`); `Card*` from `../../../ui/Card`.
- Produces: `toVariableName(key: string): string` (mirror of runtime `StringExtensions.ToVariableName`); `interface TaskKeyCollision { index: number; key: string; collidesWith: string; variableName: string }`; `findTaskKeyCollisions(tasks: unknown[]): TaskKeyCollision[]`; `FunctionTaskKeyCollisions(props: { tasks: unknown[] })`; `applyFunctionRoles(draft: Record<string, unknown>, next: RoleGrant[]): void`; `FunctionRolesSection(props: { json: Record<string, unknown>; onChange: (updater: (draft: Record<string, unknown>) => void) => void })`.

- [ ] **Step 1: Write the failing key test**

Create `functionTaskKeys.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findTaskKeyCollisions, toVariableName } from './functionTaskKeys';

describe('toVariableName (runtime StringExtensions.ToVariableName)', () => {
  it('camel-cases hyphen, underscore and space separated keys', () => {
    expect(toVariableName('user-info')).toBe('userInfo');
    expect(toVariableName('user_info')).toBe('userInfo');
    expect(toVariableName('User-INFO')).toBe('userInfo');
    expect(toVariableName('send otp code')).toBe('sendOtpCode');
  });

  it('prefixes an underscore when the name would not start with a letter', () => {
    expect(toVariableName('2fa-check')).toBe('_2faCheck');
  });

  it('returns blank input unchanged', () => {
    expect(toVariableName('')).toBe('');
    expect(toVariableName('--')).toBe('--');
  });
});

describe('findTaskKeyCollisions', () => {
  it('reports later entries whose key normalizes to an earlier one', () => {
    expect(
      findTaskKeyCollisions([
        { order: 1, task: { key: 'user-info' } },
        { order: 2, task: { key: 'send-otp' } },
        { order: 3, task: { key: 'user_info' } },
        { order: 4, task: { key: 'user-info' } },
      ]),
    ).toEqual([
      { index: 2, key: 'user_info', collidesWith: 'user-info', variableName: 'userInfo' },
      { index: 3, key: 'user-info', collidesWith: 'user-info', variableName: 'userInfo' },
    ]);
  });

  it('skips entries without a task key', () => {
    expect(findTaskKeyCollisions([{ order: 1 }, { order: 2, task: { key: ' ' } }, null])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor/functionTaskKeys.vitest.test.ts`
Expected: FAIL — cannot resolve `./functionTaskKeys`.

- [ ] **Step 3: Implement `functionTaskKeys.ts`**

```ts
/**
 * Mirror of the runtime's `StringExtensions.ToVariableName` — each
 * `onExecutionTasks` entry files its response under this name in
 * `ScriptContext.TaskResponse` / `OutputResponse`, and the runtime
 * (`FunctionComponentValidator.ValidateTaskKeysDistinct`) rejects two entries
 * that resolve to the same name at publish.
 */
export function toVariableName(key: string): string {
  if (key.trim() === '') return key;
  const words = key.split(/[-_\s]+/).filter((word) => word.trim() !== '');
  if (words.length === 0) return key;
  let result = words[0].toLowerCase();
  for (const word of words.slice(1)) {
    result += word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  if (!/^[\p{L}_]/u.test(result)) result = `_${result}`;
  return result;
}

export interface TaskKeyCollision {
  index: number;
  key: string;
  collidesWith: string;
  variableName: string;
}

export function findTaskKeyCollisions(tasks: unknown[]): TaskKeyCollision[] {
  const claimed = new Map<string, string>();
  const collisions: TaskKeyCollision[] = [];
  tasks.forEach((entry, index) => {
    const key = (entry as { task?: { key?: unknown } } | null)?.task?.key;
    if (typeof key !== 'string' || key.trim() === '') return;
    const variableName = toVariableName(key);
    const first = claimed.get(variableName);
    if (first !== undefined) {
      collisions.push({ index, key, collidesWith: first, variableName });
      return;
    }
    claimed.set(variableName, key);
  });
  return collisions;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor/functionTaskKeys.vitest.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Create `components/FunctionRuntimeRules.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunctionTaskKeyCollisions } from './FunctionTaskKeyCollisions';
import { FunctionRolesSection, applyFunctionRoles } from './FunctionRolesSection';

describe('FunctionTaskKeyCollisions', () => {
  it('shows an error for colliding task keys', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionTaskKeyCollisions, {
        tasks: [{ task: { key: 'user-info' } }, { task: { key: 'user_info' } }],
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('Task keys collide');
    expect(html).toContain('userInfo');
  });

  it('renders nothing when keys are distinct', () => {
    expect(
      renderToStaticMarkup(createElement(FunctionTaskKeyCollisions, { tasks: [{ task: { key: 'a' } }, { task: { key: 'b' } }] })),
    ).toBe('');
  });
});

describe('FunctionRolesSection', () => {
  it('explains that roles are authorize-only grants', () => {
    const html = renderToStaticMarkup(
      createElement(FunctionRolesSection, {
        json: { attributes: { roles: [{ role: 'morph-idm.maker', grant: 'allow' }] } },
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('not an invocation gate');
    expect(html).toContain('value="morph-idm.maker"');
  });

  it('writes roles and drops the key when the list is empty', () => {
    const draft: Record<string, unknown> = { attributes: { scope: 'I' } };
    applyFunctionRoles(draft, [{ role: 'a', grant: 'allow' }]);
    expect(draft).toEqual({ attributes: { scope: 'I', roles: [{ role: 'a', grant: 'allow' }] } });
    applyFunctionRoles(draft, []);
    expect(draft).toEqual({ attributes: { scope: 'I' } });
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor/components/FunctionRuntimeRules.vitest.test.tsx`
Expected: FAIL — cannot resolve `./FunctionTaskKeyCollisions`.

- [ ] **Step 7: Create `FunctionTaskKeyCollisions.tsx`**

```tsx
import { findTaskKeyCollisions } from '../functionTaskKeys';

/** Publish-time runtime error surfaced while editing (C7). */
export function FunctionTaskKeyCollisions({ tasks }: { tasks: unknown[] }) {
  const collisions = findTaskKeyCollisions(tasks);
  if (collisions.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive-border bg-destructive-surface px-3 py-2 text-[11px] text-destructive-text space-y-1">
      <div className="font-semibold">Task keys collide</div>
      <ul className="list-disc space-y-0.5 pl-4">
        {collisions.map((collision) => (
          <li key={collision.index}>
            Task {collision.index + 1} key <code>{collision.key}</code> collides with{' '}
            <code>{collision.collidesWith}</code>: both resolve to the response variable{' '}
            <code>{collision.variableName}</code>, so the later task output overwrites the earlier
            one and the runtime rejects the function at publish. Rename one of them.
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Create `FunctionRolesSection.tsx`**

```tsx
import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { RoleGrantEditor } from '../../canvas-interaction/components/panels/tabs/subflow/RoleGrantEditor';

interface FunctionRolesSectionProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function applyFunctionRoles(draft: Record<string, unknown>, next: RoleGrant[]): void {
  const attributes = (draft.attributes ?? {}) as Record<string, unknown>;
  if (next.length > 0) attributes.roles = next;
  else delete attributes.roles;
  draft.attributes = attributes;
}

/**
 * `attributes.roles` of a custom function. The runtime evaluates them only in
 * the authorize function (`?functionKey=`); invoking the function does not
 * check them.
 */
export function FunctionRolesSection({ json, onChange }: FunctionRolesSectionProps) {
  const attributes = (json.attributes ?? {}) as Record<string, unknown>;
  const roles = Array.isArray(attributes.roles) ? (attributes.roles as RoleGrant[]) : [];

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-base">Roles</CardTitle>
        <CardDescription className="text-xs">
          Authorize-only grants: the authorize function (?functionKey=) evaluates them so a client
          can decide whether to offer this function. They are not an invocation gate — calling the
          function does not check them. No roles means every caller is allowed.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <RoleGrantEditor
          roles={roles}
          onChange={(next) => onChange((draft) => applyFunctionRoles(draft, next))}
          contextLabel="function"
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9: Wire both into the editor**

In `FunctionMultipleTasksSection.tsx`:
- After `import { MappingScriptsSection } from '../../save-component/components/MappingScriptsSection';` add `import { FunctionTaskKeyCollisions } from './FunctionTaskKeyCollisions';`.
- Replace

```tsx
    <div className="space-y-4">
      <TaskExecutionList
```

with

```tsx
    <div className="space-y-4">
      <FunctionTaskKeyCollisions tasks={tasks} />
      <TaskExecutionList
```

In `FunctionEditorPanel.tsx`:
- After `import { FunctionMetadataForm } from './FunctionMetadataForm';` add `import { FunctionRolesSection } from './FunctionRolesSection';`.
- Replace

```tsx
      <FunctionCacheSection json={json} onChange={onChange} />
```

with

```tsx
      <FunctionRolesSection json={json} onChange={onChange} />

      <FunctionCacheSection json={json} onChange={onChange} />
```

- [ ] **Step 10: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS, exit 0.

- [ ] **Step 11: Commit**

```bash
git add packages/designer-ui/src/modules/function-editor
git commit -m "$(cat <<'MSG'
feat(function-editor): flag colliding task keys and explain authorize-only roles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 14: Phase C gate

**Files:** none (verification only).

- [ ] **Step 1: Full builds**

Run: `pnpm build`
Expected: Turborepo finishes with every task successful (extension esbuild and web vite included).

- [ ] **Step 2: Test suites**

Run: `pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter @vnext-forge-studio/services-core test`
Expected: PASS, no skipped new tests.

- [ ] **Step 3: Lint touched files against the phase start commit**

No touched file may gain eslint errors relative to `9275111`. Run from the repo root:

```bash
BASE=9275111
PKG=packages/designer-ui
TMP=$(mktemp -d)
count_errors() {
  (cd "$PKG" && pnpm exec eslint -f json "$1" 2>/dev/null) |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).reduce((n,f)=>n+f.errorCount,0))}catch{console.log(-1)}})'
}
status=0
for f in $(git diff --name-only --diff-filter=AM "$BASE" HEAD -- "$PKG/src" | grep -E '\.tsx?$' | grep -v '\.vitest\.test\.ts$' | sed "s#^$PKG/##"); do
  head=$(count_errors "$f")
  base=0
  if git cat-file -e "$BASE:$PKG/$f" 2>/dev/null; then
    cp "$PKG/$f" "$TMP/current"
    git show "$BASE:$PKG/$f" > "$PKG/$f"
    base=$(count_errors "$f")
    cp "$TMP/current" "$PKG/$f"
  fi
  echo "$f base=$base head=$head"
  if [ "$head" -lt 0 ] || [ "$head" -gt "$base" ]; then echo "  REGRESSION"; status=1; fi
done
git status --porcelain -- "$PKG"
echo "exit=$status"
```

Expected: every line `head <= base`, no `REGRESSION`, `git status --porcelain` prints nothing (every file restored), `exit=0`. Fix any regression in the owning task's files and re-run. (`Conversion.ts` is restored with `cp`, which preserves its NUL bytes; re-check with the command from Global Constraints.)

- [ ] **Step 4: Web-shell check**

If the preview tools can start `.claude/launch.json` configurations `server` and `web`, open the vnext-example workspace (`/Users/U0B006/Documents/repos/burgan-tech/vnext-example`) in the web shell and verify, with a screenshot of each:
1. `core/Workflows/human-task-chain/ht-a.json`: `ht-a-human` is a dotted Human node without the warning dot; the Human Task tab lists `ht-approver`, the snippet, `ht-a-approve`. Clearing its queryRoles shows the dot and the red alert (undo afterwards, do not save).
2. `core/Workflows/subflow-override-lab/subflow-override-lab-parent.json`: the SubFlow tab Overrides section suggests child keys (`lp-wait`, `confirm`), shows the long-poll window 120 and the view swaps; `subflow-override-lab-parent-legacy.json` shows the deprecation warning and "Migrate to scoped views"; `subflow-override-lab-child.json`: `lp-wait` shows the radio-tower icon with its tooltip.
3. `core/Workflows/timeout-lab/timeout-lab-root.json`: the Timeout section shows the `ui/countdown` annotation; the Problems panel lists the `timer.reset` info.
4. A state long poll switched Roles → Rule → Roles leaves exactly one arm in the JSON view.

If the preview cannot run, record "Web-shell check: not run" in the report — do not claim it.

- [ ] **Step 5: Report**

Summarize per task: tests added, commands run with their results, lint table, screenshots (or "not run"). Do not claim completion without the command output.

---

## Self-Review

**Spec coverage**
- C1: `WorkflowTimeoutSection` embeds `TransitionAnnotationsSection` → Task 4. Subflow timeout override gains annotations, mapping (script panel path via Task 1), `_comment`, target picker from child states → Task 7 (editor), Task 8 (wiring with `childStateKeys`).
- C2: child definition via `useSubFlowNavigation`'s resolver (`useWorkflowFileResolver`, quiet) → Task 5; pickers with free-text fallback (`KeyCombobox`) → Tasks 7/8; state group — long-poll window (`fallbackTimeoutSeconds ≥ 1`, `parseFallbackSeconds`) and roles shown only when the child declares a long poll, view-swap map with view picker → Task 8; transition group — roles + view-swap map → Task 8; warnings (rule-ignored roles, `roles: []`, deprecated views with migration, mixed views) → Task 6 logic, Task 8 UI; count badge incl. views and interaction → Task 6 `countOverrides`, Task 8; type S/P read-only with "overrides apply to S only" → Task 8.
- C3: "Authorize by: Roles | Rule", Rule arm = `CsxEditorField templateType="condition"`, switching clears the other arm, hint for both/neither → Task 3 (+ Task 1 for script-panel sync).
- C4: `getNodeType` → `humanState` (Task 9), own palette, `UserCircle`, dotted border, warning dot on missing queryRoles (Task 10); Human Task tab — queryRoles first/required with fail-closed explanation, `humanTask.title` / `humanTask.description` with snippet, offered transitions, interaction status (Task 11). Initial + Human decision recorded above.
- C5: node data `hasLongPoll`, `longPollAuth`, `terminate`, `fallbackTimeoutSeconds` (Task 9); `RadioTower` stats icon with "Long poll · terminate · 60s · rule" tooltip (Task 10).
- C6: shared `availableIn` `VISIBLE_OPTIONAL` for Manual/Scheduled/Event + test update → Task 2.
- C7: SubProcess error, Human warning, `timer.reset` info, auto+scheduled info → Task 12 (both `ValidationEngine` and `workflowLint`); `onExecutionTasks` normalized-key collision error and authorize-only roles copy in the function editor → Task 13.
- D6 (dedicated node type and tab, like SubFlow) → Tasks 9–11.

**Placeholder scan** — every code step carries complete code; no TBD/TODO; each test step has its test code and expected failure.

**Type consistency** — checked across tasks: `LongPollArm`, `LongPollArmIssue`, `EMPTY_RULE`, `switchLongPollArm`, `setLongPollRule`, `longPollArmIssue`, `currentLongPollArm` (Task 3); `setTimeoutAnnotations`, `setTimeoutComment`, `TimeoutFieldHolder` (Task 4 → 7); `ChildWorkflowSummary`, `ChildStateSummary`, `ChildTransitionSummary`, `ChildWorkflowLoadStatus`, `ChildWorkflowLoad`, `useChildWorkflowSummary`, `ResolveWorkflowFileOptions` (Task 5 → 6/8); `countOverrides`, `overrideWarnings`, `hasLegacyViews`, `planLegacyViewMigration`, `applyLegacyViewMigration`, `parseFallbackSeconds`, `setLongPollOverride`, `LongPollOverridePatch`, `renameRecordKey`, `nextOverrideKey` (Task 6 → 8); `KeyCombobox`, `TimeoutOverrideEditor` (Task 7 → 8); `isHumanTaskState`, `hasRoleGrants`, `isHumanTaskGateMissing`, `HumanTaskStateLike`, `offeredTransitionsForState`, `OfferedTransition`, `HUMAN_TASK_MAPPING_SNIPPET` (Task 9 → 11/12); `InteractionNodeData`, `deriveInteractionNodeData`, `longPollTooltip`, `deriveStateNodeData` (Task 9 → 10/11); `runtimeSyncFindings` (Task 12); `toVariableName`, `findTaskKeyCollisions`, `applyFunctionRoles` (Task 13). Script-panel addresses: `interaction` / `longPoll.rule` (Task 3) and `subFlow` / `overrides.timeout.mapping` (Task 7) match the Task 1 tests.

**Lint conformance** — checked against the designer-ui eslint config (`recommendedTypeChecked` + `stylisticTypeChecked`, measured on the phase start commit: `StateInteractionEditor.tsx` 0 errors, `StatePropertyPanel.tsx` 54, `GeneralTab.tsx` 220, `WorkflowTimeoutSection.tsx` 57, `SubFlowOverridesSection.tsx` 10, `Conversion.ts` 34): new lines in `any`-heavy files read through typed casts, `??` replaces `||` on nullable operands, object types are interfaces, arrays use `T[]`, tests use `() => undefined`, no duplicate imports.
