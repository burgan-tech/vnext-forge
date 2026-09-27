# vNext Runtime Sync (September 2026)

**Date:** 2026-09-24
**Status:** Draft — awaiting user review
**Branch:** `f/vnext-runtime-sync`

## Context

Forge last synced with the vNext platform on 2026-09-05 (`f/vnext-platform-sync`, `@burgan-tech/vnext-schema ^0.0.53`). Since then the runtime shipped ~40 changes (v0.0.88 → master `f6c5c828`), vnext-schema master gained 8 unreleased commits after `v0.0.53`, and the `wf` CLI master gained `wf indexes generate` and the publish-completed hook (unreleased; npm `latest` = 1.0.13).

**All development happens in vnext-forge only.** `vnext`, `vnext-schema`, `vnext-example` and `vnext-workflow-cli` are reference material. vnext-example workflows and tests are the executable reference for every contract below.

### Outcome

A Forge release whose designer writes schema-valid documents for the current runtime, whose QuickRunner speaks the current runtime API (incidents, metadata, timeout, interaction/ack, authorize, human-task, task history), whose schema editor supports attribute indexing, and whose Forge Tools can generate index SQL.

## Decisions

| # | Decision |
|---|---|
| D1 | Decompose into phases A–E on one branch (`f/vnext-runtime-sync`); each phase gets its own implementation plan and commit group. A first, then B/C/D (independent), E any time. |
| D2 | Unreleased vnext-schema changes are applied through a **local patch layer** in services-core (pattern: `view-display-schema-patch.ts`), shape-detected (inert once a release carries the changes); vendored master files under `services-core/src/services/validate/unreleased/`. When vnext-schema is released: bump the pin and delete the patch. The workflow forward-port applies only to 0.0.52-era schemas (marker `definitions.availableInEntry`); the schema-definition forward-port applies to every pinned version (accepted: master only adds `x-indexed` eligibility rules and frees `attributes.type`). **Resolved 2026-09-24:** vnext-schema 0.0.54 released with exactly these schemas (identical to `ac42026`); pins bumped to `^0.0.54` and the patch layer + vendored files removed. Projects pinned below 0.0.54 are now validated against their own pinned package. |
| D3 | Interaction (long-poll `terminate`) in QuickRunner: **user decision + countdown** — stop polling, show view + countdown, offer *Acknowledge* / *Wait for fallback*, then resume polling. |
| D4 | `authorize` in QuickRunner: **panel + opt-in inline badges**. |
| D5 | `human-task` list: **QuickRunner tab** next to the instance list. |
| D6 | HumanTask state gets a **dedicated node type and property tab**, like SubFlow. |
| D7 | Filter operators: Forge writes the **runtime spellings** (`gte`, `lte`, `neq`, `contains`, …) and never drops unknown values. |
| D8 | Out of scope: `apps/monitoring` (Monitor API removed by runtime `e1205b82`; separate track), task types 22 ExternalHttp / 23 Python (not in schema master), changes to other repos, `functions/actions` (runtime writes no rows yet), web/server `cli/execute` support for `indexes generate`. |

### Clarification: `terminate` semantics (verified in runtime code and vnext-example tests)

- `interaction.longPoll.terminate: true` → after the triggering transition the pipeline **pauses** (step order 75), the instance stays `B`, a fallback job is scheduled after `fallbackTimeoutSeconds` (default 60). The state function returns `interaction: { terminateLongPoll: true, fallbackTimeoutSeconds, ack: { href } }` **only while an ack is pending**.
- Client stops long-polling, shows the view, `POST …/instances/{id}/longpoll/ack` (idempotent; 200 when nothing is pending). After ack — or fallback expiry — the chain returns to `A` and remaining pipeline steps (auto/scheduled) run; the client must **poll again**.
- `terminate: false` → no pause, no `interaction` block; the client keeps polling normally.
- Subflows: the child's block surfaces on the polled parent with the ack href rewritten to the parent.

---

## Phase A — Foundation

### A1. vnext-types alignment (`packages/vnext-types`)

| Type | Change |
|---|---|
| `TimeoutTransition` (workflow.ts) | add `annotations?: Record<string,string> \| null`, `_comment?` |
| `StartTransition` | remove `annotations` (schema: `additionalProperties: false`, no annotations) |
| `SubFlowTimeoutOverride` (state.ts) | replace with `TimeoutTransition` (override is a full `workflowTimeout`) |
| `SubFlowOverrides` | `states[k]: { queryRoles?, interaction?: { longPoll?: { fallbackTimeoutSeconds?, roles? } }, views?: Record<string, ResourceReference> }`; `transitions[k]: { roles?, views? }`; deprecated root `views?` |
| `SubFlowConfig` | `type: 'S' \| 'P'`; deprecated `viewOverrides?` |
| `LongPollConfig` | `terminate` required; `roles?` / `rule?: MappingCode` — exactly one (discriminated helper type) |
| `AvailableIn`, `SharedTransition.availableIn` | allow `null`; optional on shared transitions; fix "Manual only" doc comment |
| annotations fields | accept `null` |

QuickRunner response types (`designer-ui/modules/quick-run/types`, `QuickRunApi.ts`, `services-core/.../quickrun-schemas.ts`):

- `StateResponse`: `timeout?: { key, target, executeAtUtc, annotations? }`, `incident: IncidentLinks`, `interaction?: { terminateLongPoll, fallbackTimeoutSeconds, ack: { href } }`; transitions gain `executeAtUtc?`, `annotations?`; `TRANSITION_KINDS` gains `'scheduled'`.
- `IncidentLinks = { hasActiveIncident: boolean; active?: { href }; history: { href } }` replaces `IncidentInfo`; `IncidentEntry` gains `statusCode?`.
- Instance metadata (detail + list item): `type?: 'R'|'S'|'P'`, `effectiveStatus?: InstanceStatus`, `incident: IncidentLinks`.
- `InstanceStatus` gains `'P'` (Passive). Note: InstanceType `P` (SubProcess) ≠ InstanceStatus `P`.

### A2. Schema patch layer (`packages/services-core/src/services/validate/`)

New `runtime-sync-schema-patch.ts`, applied in `validate.service.ts` next to the view-display patch; when the loaded schema has the pre-`ac42026` shape it is replaced by the vendored master schema, which carries these changes. It ports these vnext-schema master changes (`git diff v0.0.53..HEAD`):

- **workflow-definition:** `workflowTimeout.annotations`; `subFlow.overrides` expansion (`subFlowStateOverride.interaction.longPoll`, `.views`; `subFlowTransitionOverride.views`; deprecated `views`/`viewOverrides`); `longPoll` `required: ["terminate"]` + roles/rule `oneOf`; `availableIn` `["array","null"]` and removal of the Scheduled/Event `availableIn: null` constraint on shared transitions.
- **schema-definition:** `attributes.type` free text (enum removed); `x-indexed` rules (non-master rejects any `x-indexed`; master validates eligibility — mirrored from master's `masterIndexSchema` / `indexableMasterField` / `unindexableMasterSchema`).

Monaco: `validate/getAllSchemas` returns the patched schema so editor validation and save validation agree. (Serving Monaco the project-pinned version instead of the bundled one moves to Phase D.)

Tests: fixture-driven — each vnext-example document using a new construct (`timeout-lab/*`, `subflow-override-lab/*`, `human-task-chain/*`) validates; negative fixtures for longPoll roles+rule, `x-indexed` on non-master, `x-indexed` under `$ref`/`items`.

### A3. P0 fixes (Forge writes invalid output or shows wrong data today)

1. **Canvas subType overlay** — `StateNodeBase.getConfig` applies subType accent for every stateType (Human 6, Busy 5), not only Final. (Dedicated Human node in C4.)
2. **Start transition annotations** — `transitionFieldPolicy` start `annotations: HIDDEN`; existing values preserved on read, not offered for edit.
3. **LongPoll `oneOf`** — `StateInteractionEditor` never writes `roles` alongside `rule`; `makeEmptyLongPoll` seeds `{ terminate, roles: [] }` only when no rule exists. (Rule UI in C3.)
4. **Filter-operator data loss** — `XFilterOperatorsCard.normalizeOperators` keeps unknown values (full fix in D4).
5. **Scheduled entries** — `resolveTransitionKind` maps `'scheduled'` to a read-only kind; `AvailableTransitions` renders it non-clickable.
6. **Incident panel** — consume `IncidentLinks`; show flag only (history/active loading in B1).
7. **Instance list status** — `effectiveStatus ?? status`; `'P'` bucketed as completed/inactive, not dropped.

---

## Phase B — QuickRunner

### B0. Carry-overs from Phase A

- Passive (`P`) is not handled by polling / `shouldFetchView` (`useQuickRunPolling.ts`, `shouldFetchView.ts`): treat it as terminal in B2.
- `InstanceListPanel.openInstance` writes `displayStatus()` into `QuickRunInstance.status`, which also drives behaviour (retry button, active checks). Keep the raw `status` for behaviour and use the effective status for display only (B2/B5).
- The Instance Details status row still shows raw `metadata.status`; show `effectiveStatus` alongside it (B5).
- TS `InstanceType` should accept `null` (the zod schema already does) before B5 consumes `metadata.type`.
- `IncidentSection` moves out of `InstanceDashboard.tsx` in B4; then drop the suite-wide `server.deps.inline` in `packages/designer-ui/vitest.config.ts`.
- Read-only scheduled entries: add `aria-disabled` / a non-interactive role when B3 touches `AvailableTransitions`.

### B1. New RPC methods

Each follows the rpc-method-policy: registry entry (params/result schema), `policy.ts` (`privileged`), `METHOD_HTTP_METADATA` + `MethodId`, `apps/server/src/api/v1/quickrun.routes.ts`, fixture + snapshot, `registry-contract.test.ts`, `QuickRunApi.ts` wrapper. Paths are rebuilt from identifiers (as `acknowledgeLongPoll` does), never by following server hrefs.

| Method | Runtime | Notes |
|---|---|---|
| `quickrun/getIncidents` | `GET {d}/workflows/{wf}/instances/{id}/incidents?page&pageSize` | `pageSize ≤ 100`; `{ hasActiveIncident, items, page, pageSize, hasNext }` |
| `quickrun/getActiveIncident` | `GET …/incidents/active` | 404 `Instance:100037` → `null` (not an error) |
| `quickrun/authorize` | `GET …/instances/{id}/functions/authorize` | exactly one of `transitionKey` / `functionKey` / `queryRoles=true` / `ack=true`; optional `role`, `version`; returns `{ allowed, status }` for **200 and 403**; other statuses are errors |
| `quickrun/getHumanTasks` | `GET {d}/functions/human-task` | caller headers/role; optional `X-VNext-Cache-Override: true`; returns `{ items, truncated }` from `X-VNext-HumanTask-Truncated` |
| `quickrun/getTaskHistory` | `GET …/instances/{id}/functions/tasks` | `{ items: [{ id, taskKey, transitionKey, fromState, toState?, triggerType, status, businessStatus, startedAt, finishedAt?, durationMs?, error? }] }` |

`quickrun/acknowledgeLongPoll`: add optional `role`; surface non-2xx to the caller instead of swallowing.

### B2. Interaction flow (`useQuickRunPolling`)

Extract the polling/interaction logic into a pure reducer (`interactionMachine.ts`) with states `polling → awaitingAck → resuming → polling`:

- `interaction` present → stop polling, render view, start countdown from `fallbackTimeoutSeconds`.
- UI: countdown, **Acknowledge** (POST ack with current role), **Wait for fallback**. While awaiting: transitions disabled with an "Awaiting acknowledge" badge.
- After ack success or countdown expiry → resume polling (normal ETag cadence) until status leaves `B` / state changes.
- Ack failure → banner with runtime error (uses existing `RuntimeErrorBanner`), stay in `awaitingAck`.

### B3. State surface

- **Timeout chip** in the state header: `timeout.key → target`, live countdown to `executeAtUtc`, annotations tooltip; absent when `timeout` absent. "Settling…" when `executeAtUtc` is past.
- **Scheduled entries**: read-only rows with clock icon, `executeAtUtc` countdown, annotations.
- **Annotations** on scheduled entries and timeout rendered as key/value chips.

### B4. Incidents

Instance dashboard: `hasActiveIncident` flag in alert strip → expand lazily loads `getActiveIncident` (card with state/transition/task/message/errorCode/statusCode/boundary/traceId); "Past incidents" pages `getIncidents`. Incident badge in instance list and status bar driven by `incident.hasActiveIncident`.

### B5. Metadata & filters

Details dialog shows `type` (Root/SubFlow/SubProcess) and `effectiveStatus`. `instanceFilterSerializer` `INSTANCE_FIELDS` adds `instanceType` (ops `eq/ne/in/nin`, options Root/SubFlow/SubProcess) and `effectiveStatus` (status type).

### B6. Authorize panel

Instance dashboard panel: target selector (transition / function / queryRoles / ack) populated from the current state's transitions and functions, `role`, `version`, Run → verdict chip (Allowed/Denied + HTTP status). Opt-in toggle **"Check permissions for role"**: calls `authorize` per available transition + `queryRoles=true` for the current role; results cached per `(eTag, role)`; badges next to each transition and an instance-visibility indicator. Remove stale 403-based comments/flows (`InstanceDashboard`, `useQuickRunPolling`, `quickRunStore`) since the runtime no longer emits in-process `queryRoles` 403s.

### B7. Human Tasks tab

Tab beside the instance list: role picker (reuses QuickRun header/role settings), cache-override toggle, truncated warning, rows `{ title, description, workflow, instanceId, createdAt }`. Clicking opens the **root** instance; if `workflow` differs from the current one, open that workflow's QuickRunner.

### B8. Tasks tab

ContextPanel gains `tasks` tab: per-transition grouped timeline, status + businessStatus badges, duration, error expandable. Loaded on tab open and refreshed on eTag change.

### B9. Sync response extensions

No behavior change: extensions stay sourced from `getData`. Ensure no UI reads `extensions` from start/transition responses.

---

## Phase C — Flow Designer

### C1. Timeout annotations

`WorkflowTimeoutSection` embeds `TransitionAnnotationsSection`. Subflow timeout override editor (`SubFlowOverridesSection`) gains annotations, mapping, `_comment`, and a target picker from child states.

### C2. Subflow overrides

- Load the child definition (reuse `useSubFlowNavigation` resolution) to offer child state/transition keys in pickers; unknown keys remain editable (free text fallback).
- State override group: long-poll window (`fallbackTimeoutSeconds ≥ 1`) and roles — shown only when the child state declares `interaction.longPoll`; view-swap map (view key → reference via view picker).
- Transition override group: roles (existing) + view-swap map.
- Warnings: roles override while child uses `rule` (ignored at runtime); `roles: []` (admits every caller); deprecated `viewOverrides` / `overrides.views` present (offer migration to scoped views); mixing legacy and scoped views (runtime rejects).
- Count badge includes views and interaction overrides. Show subflow `type` (S/P, read-only display) with note that overrides apply to `S` only.

### C3. Long-poll rule arm

`StateInteractionEditor`: "Authorize by: Roles | Rule" segmented control; Rule arm uses `CsxEditorField templateType="condition"`; switching clears the other arm. Validation hint when both/neither set.

### C4. HumanTask state node & tab

- `getNodeType`: `subType === 6` → `humanState` node (own palette, `UserCircle` icon, distinct border like SubFlow's dashed style). Warning dot when `queryRoles` is empty.
- `StatePropertyPanel`: **Human Task** tab when `subType === 6` — `queryRoles` first and required (explains it gates the human-task list; fail-closed), explanation that title/description come from instance data `humanTask.title` / `humanTask.description` with a mapping snippet, list of transitions that will be offered, interaction status.

### C5. Interaction indicator

`Conversion.ts` node data gains `hasLongPoll`, `longPollAuth: 'roles'|'rule'`, `terminate`, `fallbackTimeoutSeconds`. `StateNodeBase` stats row shows a `RadioTower` mini-icon with tooltip ("Long poll · terminate · 60s · rule").

### C6. availableIn

`transitionFieldPolicy`: shared `availableIn` `VISIBLE_OPTIONAL` for Manual, Scheduled and Event; update `transitionFieldPolicy.vitest.test.ts`.

### C7. Lint / validation (`workflow-validation/ValidationEngine.ts`, `canvas-interaction/utils/workflowLint.ts`)

- Error: state-level `subFlow.type === 'P'` → "use a SubProcessTask (type 14)".
- Error (function editor): `onExecutionTasks` keys colliding after normalization (`user-info` vs `user_info`).
- Warning: Human state (subType 6) without `queryRoles`.
- Info: timeout `timer.reset` not implemented by the runtime.
- Info: state with both auto and scheduled transitions — timer is not armed when the auto transition fires.
- Function editor copy: `roles` are authorize-only grants, not an invocation gate.

---

## Phase D — Schema editor

### D1. `attributes.type`

`SchemaMetadataForm` gains a free-text combobox (suggestions `master`, `schema`, `view`, `headers`) with hint "Only `master` permits x-indexed". `SchemaEditorSchema` models `attributes.type`; unused root `type` removed. Creating a schema from the workflow's Master Schema section defaults to `master`.

### D2. Index eligibility

`schema-editor/model/indexEligibility.ts`: pure mirror of runtime `AttributeIndexDefinition.Visit` → per-node `{ eligible, reason }`. Rules: schema type `master`; explicit scalar `type` (`string`/`number`/`integer`/`boolean`, date via `format: date-time`); path under a `properties` chain with parents typeless or `object`; first segment `^[a-zA-Z][a-zA-Z0-9_]*$`, later `^[a-zA-Z0-9_]+$`; no `$ref`/composition/conditional on node or ancestors; not under `items`/`prefixItems`/`additionalProperties`/`patternProperties`/`$defs`/`contains`/`propertyNames`/`unevaluated*`; root not indexable. Used by the card, the tree badge and save-time messages (translate AJV if/then noise into these reasons).

### D3. `XIndexedCard`

Registered in `vnextCardRegistry` (`scope: 'property'`) and `RECOGNIZED_VNEXT_KEYWORDS`. Tri-state (unset / true / false); disabled with reason when ineligible; note that indexing does not grant filter/sort and SQL comes from `wf indexes generate`; shows produced columns (text, + numeric, + timestamptz). `PropertyTreeNode` shows an **IDX** badge. Banner with "Remove all x-indexed" when type ≠ `master` and any `x-indexed` exists.

### D4. Filter operators

`XFilterOperatorsCard` offers runtime spellings `eq neq gt gte lt lte between contains startsWith endsWith in nin isNull includes`; reads legacy `ge le ne like match` normalized for display; writes only on user edit; never drops unknown values.

### D5. QuickRunner schema-aware filters

`InstanceFilterPanel` reads the workflow's local master schema: attribute path suggestions, value type from field type, operators limited to `x-filterOperators`, `attributes.<path>` sort options for `x-sortable`, IDX hint for indexed fields. Client-side limits: ≤ 1000 chars per value (per element for `in`/`nin`/`between`), ≤ 5000 total.

### D6. Workflow cross-check

`WorkflowSchemaSection` warns when the referenced schema has `x-indexed` fields but `attributes.type !== 'master'`.

---

## Phase E — Forge Tools

1. `wf-argv.ts`: `{ base: 'indexes generate'; flow?; output?; retireObsolete? }` → `['indexes','generate', --flow k, -o dir, --retire-obsolete]`. Validate `flow` with `/^[a-zA-Z_][a-zA-Z0-9_-]*$/`, ≤ 63 chars. **Never** append `--domain` or use the `wf domain use` fallback for this command (CLI ignores it; command is offline). `WF_INDEXES_MIN_VERSION = '1.0.14'` (single constant; CLI 1.0.14 published 2026-09 with `wf indexes` and publish-completed) and `wfSupportsIndexes()`.
2. `wf-cli-probe.ts`: `supportsIndexes`, `supportsPublishCompleted` (≥ 1.0.14).
3. `WfCliUpgradeNotice` generalized to `(featureName, minVersion)`.
4. New Tools tree group **Database**: "Generate Index SQL (all flows)", "Generate Index SQL for flow…" (quick-pick of local workflows); `--retire-obsolete` behind modal confirm; unsupported CLI → "Update Workflow CLI" node. Multi-domain: when the chosen solution is not `vnext.config.json`, warn that the CLI only processes the default solution. Run captured (no prompts), parse `Generated N SQL file(s): <path>`, reveal the batch folder and offer to open `README.txt`. Contributes entries in `apps/extension/package.json`, registration in `extension.ts`.
5. Package Deploy: info node when CLI < 1.0.14 — "This CLI does not signal publish-completed; the runtime discovery cache may stay stale."

---

## Testing & verification

- **Unit (vitest):** vnext-types guards; schema patch (vnext-example fixtures, positive + negative); `indexEligibility` (mirror runtime test cases); filter-operator normalization; `wf-argv` indexes spec; `transitionFieldPolicy`; `interactionMachine` reducer; lint rules; Conversion node data.
- **Contract:** fixtures + registry parity for the five new methods and the ack change.
- **End-to-end:** run vnext-example workflows against a local runtime in QuickRunner — `timeout-lab`, `subflow-override-lab`, `human-task-chain`, `authorization-chain-lab`, `error-boundary-lab`; verify in the web shell browser preview with screenshots.
- **Gates per phase:** `tsc`, esbuild/vite builds, vitest. Lint touched files only (per-package `eslint .` is pre-existing red).

## Risks

- **Schema drift:** vnext-schema may change again before release; the patch is isolated in one file and version-gated, and its fixtures fail loudly on drift.
- **CLI version:** resolved — `wf indexes` shipped in CLI 1.0.14; `WF_INDEXES_MIN_VERSION` set accordingly.
- **Authorize badge cost:** one call per transition per role; opt-in and cached per eTag.
- **Runtime version skew:** users on older runtimes (pre-2026-09-07) still send embedded incident content; `IncidentLinks` parsing must tolerate the old shape (treat as "has incident" without links).
