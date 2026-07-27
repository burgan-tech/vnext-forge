# Designer Platform Feature Additions — Design

- **Date:** 2026-07-26
- **Status:** Approved (design), pending implementation plan
- **Branch:** `f/designer-platform-features`
- **Author:** Tayfun Yılmaz (with Claude)

## Context

The vnext engine added four capabilities to the domain model. The vnext-forge
designer (VS Code extension webview) must expose them for authoring:

1. **Three new task types** — CacheAside, GetInstance, DaprConversation.
2. **Function read-through cache** — an optional `attributes.cache` block on functions.
3. **Workflow events** — event mapping at workflow level (`action=start`) and at
   transition / shared-transition level (`action=transition`, `triggerType=3`).
4. **data-vocab** — `x-context-source` / `x-context-target` schema annotations for
   context-store binding, authored in the Schema Editor.

The designer's Task Editor recently gained **State Store (type 17)** end-to-end;
its wiring is the reference template for the new task types. The workflow panel
recently gained a **`WorkflowOutputSection`** (workflow-level `output` mapping);
it is the reference template for workflow-level events. Both are uncommitted,
in-progress changes in the working tree and are treated as prior art, not as work
to redo.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | DaprConversation (type 20) is absent from the vnext-schema task enum (stops at 19) | Include all 3 task types **and** update the vnext-schema `task-definition.schema.json` (separate repo) |
| 2 | `dynamicExpresso` ScriptCode editing (new to the frontend) | Build a **lightweight inline expression field**, not a `.csx`-backed editor |
| 3 | data-vocab support depth | **Form cards only** — no Source-tab Monaco autocomplete |
| 4 | vnext-types interface updates (editors are untyped-JSON + Zod driven) | **Only load-bearing:** task config interfaces, doc-gen labels, the `Event` type. Skip cosmetic `FunctionDefinition` / schema typing |
| a | Home of the shared expression field | `packages/designer-ui/src/ui/` (reused across two modules) |
| b | vnext-schema DaprConversation update | A **distinct plan task** (separate repo / working tree) |

## Confirmed facts

- Enum values (backend `TaskEnums.cs`): `CacheAside = 18`, `GetInstance = 19`, `DaprConversation = 20`.
- `TriggerType.Event = 3` already exists in vnext-types and in the workflow schema; the transition field-policy already has an Event branch and lists Event as an allowed trigger.
- `ScriptWorkflowSync` already routes `attributes.<listField>.<scriptField>` (e.g. `attributes.event.mapping`) via the `WORKFLOW_LEVEL_STATE_KEY = '__workflow__'` sentinel.
- The editors for Function and Schema operate on untyped `Record<string, unknown>` JSON; vnext-types `FunctionDefinition` / `SchemaDefinition` are stale and not the editor source of truth.

## Non-goals

- No Source-tab Monaco autocomplete/validation for data-vocab (decision 3).
- No cosmetic re-typing of already-stale `FunctionDefinition` / schema node types (decision 4).
- No new task-config discriminated union — the designer uses parallel string-keyed maps by design.
- No backend/runtime changes beyond the one vnext-schema enum addition.

---

## Shared primitive — `DynamicExpressoField`

**Build first; two workstreams depend on it.**

- Location: `packages/designer-ui/src/ui/DynamicExpressoField.tsx`, exported from `ui/index.ts`.
- Renders a `Field` (label + hint) wrapping a monospace `Textarea`.
- Value contract: reads/writes a `ScriptCode` of shape
  `{ location: 'dynamicExpresso', code: <expression string>, encoding: 'NAT' }`.
- Empty `code` collapses the whole value to `undefined` (drops out of JSON), matching the repo's normalize-empty-to-undefined convention.
- Props: `label`, `hint?`, `required?`, `value: ScriptCode | undefined`, `onChange: (next: ScriptCode | undefined) => void`.
- Unit test: `DynamicExpressoField.vitest.test.tsx` (renderToStaticMarkup + presence/onChange assertions).

Consumers: CacheAside `keyExpression`; Function cache `keyExpression` + `generationKeyExpression`.

---

## WS1 — Three new task types

Reference template: **State Store (17)**. Per new type, replicate all touchpoints.

### Per-type touchpoints (in vnext-forge)

1. `packages/vnext-types/src/constants/task-types.ts` — add enum member.
2. `packages/vnext-types/src/types/task.ts` — add `XxxTaskConfig` interface.
3. `packages/designer-ui/src/modules/task-editor/forms/XxxTaskForm.tsx` — new form.
4. `packages/designer-ui/src/modules/task-editor/forms/index.ts` — import + `taskFormMap` entry (string key).
5. `packages/designer-ui/src/modules/task-editor/components/TaskTypePicker.tsx` — `TASK_TYPES` entry.
6. `packages/designer-ui/src/modules/task-editor/TaskEditorPanel.tsx` — `getTaskTypeName` map entry.
7. `packages/doc-gen/src/generators/task-doc.ts` — `TASK_TYPE_LABELS` entry.
8. `packages/designer-ui/src/modules/task-editor/TaskEditorPanel.vitest.test.ts` — panel test.

### Per-type form design

**GetInstance (19)** — clone `GetInstanceDataTaskForm`. Fields: `domain`, `flow`, `key`, `instanceId`, `extensions[]`, plus `HttpSettingsFields` (useDapr / validateSsl / headers / timeoutSeconds / acceptedStatusCodes). Config keys are config-level (`domain`/`flow`), not the `triggerDomain` naming.

**CacheAside (18)** — Fields:
- `sourceTask` reference (key/domain/flow/version) — `WorkflowRefFields`-style row; `flow` defaults to `sys-tasks`.
- `storeName`, `ttlInSeconds` (numeric, min 1 guard), `consistency` (Select Eventual/Strong) — State Store patterns.
- `bypassOnCacheError` (default true), `forceRefresh` (default false) — `Checkbox`, delete-key-on-default trick.
- `sourceMapping` — existing `CsxEditorField` (`.csx` mapping).
- `keyExpression` — **`DynamicExpressoField`**.
- Config-key pruning allow-list (State Store `COMMAND_FIELDS` pattern) not required unless a discriminator emerges; not needed here.

**DaprConversation (20)** — Fields: `componentName` (text), `contextId` (text), `inputs` (`BodyJsonField`, JSON array of messages), `parameters` + `metadata` (`KVEditor`), `temperature` (numeric), `timeoutSeconds` (numeric), `scrubPII` (`Checkbox`).

### Cross-repo task (separate working tree)

`vnext-schema/schemas/task-definition.schema.json` — add `"20"` to the `attributes.type` enum + `enumDescriptions`, and a new `if type==="20" then { config: {...} }` block mirroring existing per-type entries, covering DaprConversation config fields (componentName, inputs, parameters, metadata, contextId, temperature, scrubPII, timeoutSeconds).

---

## WS2 — Function cache

- New `packages/designer-ui/src/modules/function-editor/components/FunctionCacheSection.tsx`.
- Rendered in `FunctionEditorPanel.tsx` as a **collapsible `ui/Section`** (`collapsible defaultOpen={false}`), a third section after Metadata + Task Execution.
- Reads/writes `json.attributes.cache` via the module's draft-mutation pattern:
  `onChange((draft) => { const a = draft.attributes ?? {}; a.cache = ...; draft.attributes = a; })`.
- Fields (reuse State Store patterns): `key`, `storeName`, `generationKey` (text) · `ttlInSeconds` (numeric min 1) · `consistency` (Select Eventual/Strong) · `bypassOnCacheError` (Checkbox, default true → delete-key-when-true) · `varyByHeaders`, `varyByHeaderPrefixes` (`TagEditor`) · `keyExpression`, `generationKeyExpression` (**`DynamicExpressoField`**).
- `FunctionEditorSchema.ts` (Zod) extended so `attributes.cache` validates and round-trips.
- Test: `FunctionCacheSection.vitest.test.tsx` (renderToStaticMarkup convention).

---

## WS3 — Events

### vnext-types

- Add `Event { mapping: MappingCode }` (in `mapping.ts` or a new `event.ts`).
- `WorkflowAttributes.event?: Event` (`workflow.ts`).
- `Transition.event?: Event` (`state.ts`; inherited by `SharedTransition`).

### Workflow-level (`attributes.event.mapping`)

- New `sections/WorkflowEventSection.tsx`, cloned from `WorkflowOutputSection`, using
  `CsxEditorField` with `stateKey={WORKFLOW_LEVEL_STATE_KEY}`, `listField="event"`,
  `scriptField="mapping"`, `contextName="workflow-event"`, plus `MappingScriptsSection`.
- Register in `WorkflowMetadataPanel.tsx` (import + `<div id="wf-section-event">`).
- `FlowEditorApi.ts` `extractScripts`: `collect(attrs.event?.mapping)`.
- `ScriptWorkflowSync` needs no change (nested path already handled).

### Transition-level (`transition.event`, `sharedTransition.event`; required when `triggerType===3`)

- `transitionFieldPolicy.ts` — add `'event'` to `TransitionFieldKey`; VISIBLE_REQUIRED in the `TriggerType.Event` branch (state + shared), HIDDEN elsewhere.
- New `tabs/transition/TransitionEventSection.tsx`, cloned from `TransitionMappingSection`, addressing `event.mapping`.
- `useTransitionMutations.ts` — `updateTransitionEvent` / `removeTransitionEvent` / `updateTransitionEventScripts`, mirroring the mapping mutations, targeting `ctx.transitions[index].event`.
- `TransitionCard.tsx` — add props, render `<TransitionEventSection>` gated on `policy.event.visible`.
- Wire handlers through both `TransitionCard` call sites in `TransitionPropertyPanel.tsx`, and in `TransitionsTab.tsx` / `WorkflowSharedTransitionsSection.tsx`.
- Verify `getTriggerColor` (`PropertyPanelHelpers.ts`) has an Event (case 3) branch (label already present).

---

## WS4 — data-vocab (form cards only)

### `XContextSourceCard` (property-scoped)

- New `components/tree-editor/vnext/XContextSourceCard.tsx`, cloned from `XLovCard`
  (normalize + serialize + DEFAULT_VALUE pattern via `VNextCardShell` + `useVNextEnabled`).
- A shape `Select` — `const` / `context` / `identity` — driving conditional fields:
  - `const`: a literal JSON value input.
  - `context`: `boundary` (Select device/user/subject), `key` (text template), `storage?` (Select memory/local/secure).
  - `identity`: Select subject/user.
- Register in `vnextCardRegistry.ts`; add `'x-context-source'` to `RECOGNIZED_VNEXT_KEYWORDS` (`recognizedKeywords.ts`).

### `XContextTargetCard` (root-scoped)

- Introduce `scope: 'property' | 'root' | 'any'` on `VNextCardEntry` (`vnextCardRegistry.ts`); default existing cards to `'property'` (or `'any'`).
- `VNextTab.tsx` filters the registry by `pointer === ROOT_POINTER` vs property pointers.
- New `XContextTargetCard.tsx` — a path→slot **map editor** (mirror `FilterListEditor` / `LocalizedTextMapEditor`): each row = instance-data field path (dot-notation) → `{ context: { boundary, key, storage? } }`. Enforce `minProperties >= 1` UX (at least one row when enabled).
- Register with `scope: 'root'`; add `'x-context-target'` to `RECOGNIZED_VNEXT_KEYWORDS`.

### Tests

- Round-trip mutator tests in the `model/` + `__tests__/roundtrip.vitest.test.ts` style: authoring, editing, removal, and survival of the two new `x-*` keywords through unrelated mutations.

---

## Testing conventions

- Vitest, `renderToStaticMarkup` (SSR string) assertions — **no** React Testing Library.
- Component tests colocated as `*.vitest.test.ts(x)`.
- data-vocab logic (normalize/serialize) placed in pure functions and tested at the mutator/model layer, matching the schema-editor's existing test concentration.

## Execution model (subagent-driven)

1. **Shared primitive** (`DynamicExpressoField`) — must land before WS1-CacheAside and WS2.
2. **WS1, WS2, WS3, WS4** — independent; touch disjoint modules; run in parallel. vnext-types edits are additive per workstream (only WS1 and WS3 touch it, in different files/sections).
3. **vnext-schema DaprConversation update** — separate repo/working tree; independent of the designer work; can run in parallel and be committed separately.

Integration gate per workstream: `tsc` (typecheck), the workstream's Vitest files, and `esbuild`/Vite build. Per-package `eslint .` is pre-existing red repo-wide (see memory `docgen-appcontracts-lint-quirk`) — rely on tsc/vitest/build as the gates, lint only touched files.
