# Instance Monitor M3 (Data history) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show how an instance's data changed over time: a runtime read that lists every `InstanceData` row (with the same role-based exposure as the `data` function), and in Forge a Data tab (current data, version timeline, diffs, compare two) plus a per-firing "Data change" section in the transition inspector.

**Architecture:** Two repositories. **Runtime** (`/Users/U0B006/Documents/repos/burgan-tech/vnext`, new branch `f/instance-data-history` from `master`): a paged repository read over `InstancesData`, an app-service read that runs every row through `IInstanceDataReadService.ExposeAsync`, two controller routes, docs + vnext-meta entries. **Forge** (`f/instance-monitor`): RPCs `quickrun/getDataHistory` and `quickrun/getDataHistoryRow` through the full rpc-method-policy set, pure diff / attribution models, a `useDataHistory` hook shared by the Data tab and the transition inspector. Forge treats a 404 from the history route (instance already loaded) as "feature unavailable" and hides the history parts.

**Tech Stack:** .NET 10 / C#, EF Core (PostgreSQL jsonb), xUnit + NSubstitute + Shouldly; React 19 / TypeScript, zod, vitest SSR.

**Spec:** `docs/superpowers/specs/2026-10-06-instance-monitor-design.md` (§3 "Runtime endpoint", "Data tab", transition "Data change"; phase M3).

## Global Constraints

- Runtime: never hand-edit `common.props` (CI bumps versions); every new public endpoint gets a `vnext-meta/features.json` entry with `since` and a row in `docs/contracts/api-and-service-contracts.md`; error codes must be catalogued; follow the existing incidents read as the template (validation, `runtimeInfoProvider.Check`, `InstanceReadActivityHelper.StartRead`, `BeginInstanceScope`, N+1 paging without COUNT).
- Runtime security: history rows MUST go through `IInstanceDataReadService.ExposeAsync(flow, instance, row, new AuthorizationRequestContext(headers, query), ct)` — the same x-roles pruning, x-masking and x-encryption pass as the `data` function. Never return raw `row.Data`.
- Runtime commits: Conventional Commits on `f/instance-data-history`; do NOT push. Every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Forge: all user-visible strings English; the monitor never drives the instance and never writes files; `apps/web` must not import services-core; colours via `var(--vscode-*, <fallback>)`; buttons `cursor-pointer`; tests `*.vitest.test.ts(x)`; every new RPC method needs registry entry (paramsSchema, resultSchema, handler), policy tag, `MethodId` + `METHOD_HTTP_METADATA`, server route, fixture, `QuickRunApi` wrapper (`.cursor/rules/rpc-method-policy.mdc`); Forge commits end with the same trailer line on `f/instance-monitor`.
- `grep` in this shell is aliased to ugrep; use `command grep` or `rg`.

### Decisions taken while planning

| Topic | Decision | Why |
|---|---|---|
| `since` for the new feature | `0.0.100` | `features.json` already has `0.0.99` entries for the release just cut; flag it in the runtime PR description for the maintainer to confirm |
| Where the rows are read | New methods on `IInstanceRepository` / `EfCoreInstanceRepository` (it owns `WorkflowDbContext.InstancesData`) | No InstanceData repository exists; incidents repo shows the N+1 paging pattern |
| Ordering | `EnteredAt DESC, Id DESC` | Global chronology per `InstanceData.VersionNo` doc; Id breaks same-tick ties |
| Remote / gateway variants | Not added | Only the HTTP surface needs it (incidents is HTTP-only too) |
| Forge loading | Data history loads lazily (Data tab opened or a transition selected), cached per level and invalidated on each level refresh | Keeps the level load light; rows can be large |
| Current data | From `QuickRunApi.getData` (works on every runtime) | History may be unavailable on older runtimes |

---

## Part R — Runtime (`vnext` repo)

### Task R1: Repository read and app-service read with exposure

**Files (runtime repo):**
- Modify: `src/BBT.Workflow.Domain/Instances/IInstanceRepository.cs` (+ two methods)
- Modify: `src/BBT.Workflow.Infrastructure/Instances/EfCoreInstanceRepository.cs`
- Modify: `src/BBT.Workflow.Application/Instances/InstanceReadKinds.cs` (+ `DataHistory = "dataHistory"`)
- Modify: `src/BBT.Workflow.Application/Instances/DTOs/GetInstanceInput.cs` (+ `GetInstanceDataHistoryInput`, `GetInstanceDataHistoryRowInput`)
- Modify: `src/BBT.Workflow.Domain/Instances/DTOs/GetInstanceOutput.cs` (+ `InstanceDataHistoryItemDto`, `GetInstanceDataHistoryOutput`)
- Modify: `src/BBT.Workflow.Application/Instances/IInstanceQueryAppService.cs`, `InstanceQueryAppService.cs`
- Test: `test/BBT.Workflow.Application.Tests/Instances/InstanceQueryAppServiceDataHistoryTests.cs` (create)

**Interfaces:**
- `Task<HateoasPagedList<InstanceData>> GetDataHistoryPagedAsync(Guid instanceId, int page, int pageSize, CancellationToken cancellationToken = default)` — AsNoTracking, `Where(d => d.InstanceId == instanceId)`, `OrderByDescending(EnteredAt).ThenByDescending(Id)`, `Skip/Take(pageSize + 1)` like `EfCoreInstanceIncidentRepository.GetHistoryPagedAsync`.
- `Task<InstanceData?> FindDataRowAsync(Guid instanceId, Guid rowId, CancellationToken cancellationToken = default)` — AsNoTracking, both ids must match.
- `GetInstanceDataHistoryInput : IHasDomain { Domain, Workflow, Instance, Page = 1, PageSize = 20, IncludeData = true, Headers, QueryParameters, Roles; const int MaxPageSize = 100 }` — same attributes as `GetInstanceIncidentsInput` (`[Required]`, `[StringLength]`).
- `GetInstanceDataHistoryRowInput : IHasDomain { Domain, Workflow, Instance, RowId (Guid), Headers, QueryParameters, Roles }`.
- `InstanceDataHistoryItemDto { Guid Id; string Version; long VersionNo; DateTime EnteredAt; string ETag; bool IsLatest; JsonElement? Data }` (Data omitted from JSON when null — follow how other DTOs ignore nulls).
- `GetInstanceDataHistoryOutput { List<InstanceDataHistoryItemDto> Items; int Page; int PageSize; bool HasNext }`.
- `IInstanceQueryAppService`: `Task<Result<GetInstanceDataHistoryOutput>> GetInstanceDataHistoryAsync(GetInstanceDataHistoryInput input, CancellationToken ct = default)`; `Task<Result<InstanceDataHistoryItemDto>> GetInstanceDataHistoryRowAsync(GetInstanceDataHistoryRowInput input, CancellationToken ct = default)`.

- [ ] **Step 1: Branch** — `git -C /Users/U0B006/Documents/repos/burgan-tech/vnext checkout -b f/instance-data-history` (from a clean `master`).
- [ ] **Step 2: Failing tests** in `InstanceQueryAppServiceDataHistoryTests.cs`, built the way `InstanceQueryAppServiceDataCacheTests` / `InstanceQueryAppServiceStateTests` construct the service (reuse their builders/fixtures; NSubstitute repo mocks, a real `InstanceDataReadService` over a substituted `ISchemaFieldFilterService`):
  1. returns rows newest first with page / pageSize / hasNext from the repository's `HateoasPagedList`;
  2. runs `ISchemaFieldFilterService.ApplyAsync` once **per row** when `IncludeData` (assert `Received(n)`), and the DTO's `Data` is the filter's output — never the raw row;
  3. `IncludeData = false` → `Data` null and the filter is not called;
  4. clamps `Page < 1` to 1 and `PageSize` to `1..100`;
  5. unknown instance → the same not-found error the incidents read returns (`Instance:100013`), repository not called;
  6. row read: found row → exposed DTO; row of another instance / unknown id → a catalogued not-found error (find the existing instance-data not-found error in `WorkflowErrors` / `WorkflowErrorCodes`; add a new catalogued code only if none fits, following the catalogue's conventions).
- [ ] **Step 3: Run → FAIL** — `dotnet test test/BBT.Workflow.Application.Tests --filter "FullyQualifiedName~DataHistory"`.
- [ ] **Step 4: Implement** — repository methods; DTOs; `InstanceReadKinds.DataHistory`; app-service methods mirroring `GetInstanceIncidentsAsync` (Check domain → `StartRead(InstanceReadKinds.DataHistory, …)` → clamp → `GetInstanceByIdOrKeyAsync(input.Instance, ct)` → `componentCacheStore.GetFlowAsync(domain, workflow, instance.FlowVersion, ct)` → `BeginInstanceScope` → repo read → per row `instanceDataReadService.ExposeAsync(flow, instance, row, new AuthorizationRequestContext(input.Headers, input.QueryParameters), ct)` when `IncludeData`). Rows are exposed sequentially (secrets preload per row is acceptable for a dev read; note it in the XML doc).
- [ ] **Step 5: Run → PASS**, then `dotnet build` the solution and `dotnet test test/BBT.Workflow.Application.Tests` (whole project) — green; also run the `InstanceReadEnvelopeTests` (they assert every read uses `InstanceReadKinds`).
- [ ] **Step 6: Commit** — `feat(instances): paged data-history read with the data function's exposure pass`.

### Task R2: HTTP routes, docs, vnext-meta

**Files (runtime repo):**
- Modify: `orchestration/BBT.Workflow.Orchestration.HttpApi.Host/Controllers/Instances/InstanceController.cs`
- Modify: `docs/contracts/api-and-service-contracts.md` (endpoint table)
- Modify: `vnext-meta/features.json` (new feature entry, `since: "0.0.100"`)
- Test: controller-level tests only if the repo has a pattern for them (check `test/` for `InstanceController` tests); otherwise rely on R1 tests.

- [ ] **Step 1: Routes** — modelled on `GetInstanceIncidentsAsync` (resolve caller roles, fail on resolver error, build the input with `Headers`, `QueryParameters`, `Roles`, `response.ToActionResult(HttpContext)`; XML docs like the neighbours; visible in ApiExplorer):
  - `[HttpGet("{domain}/workflows/{workflow}/instances/{instance}/data/history")]` with `[FromQuery] int page = 1, int pageSize = 20, bool includeData = true`.
  - `[HttpGet("{domain}/workflows/{workflow}/instances/{instance}/data/history/{rowId:guid}")]`.
  - Confirm no route ambiguity with the existing hidden `…/instances/{instance}/data` (different segment count).
- [ ] **Step 2: Docs** — add rows next to the incidents row: `GET /{domain}/workflows/{workflow}/instances/{instance}/data/history` (paged data rows newest first, exposed per caller like `data`) and `…/data/history/{rowId}`.
- [ ] **Step 3: vnext-meta** — a `features.json` entry modelled on `stateIncident` (key e.g. `instanceDataHistory`, `since: "0.0.100"`, endpoints listed). Run the repo's vnext-meta validation the way `docs/code-review/reviewers/contract.md` describes (skill `vnext-meta-validator` / its script if present) and record the result in the report.
- [ ] **Step 4: Build + test** — `dotnet build` and `dotnet test test/BBT.Workflow.Application.Tests`; green.
- [ ] **Step 5: Commit** — `feat(instances): expose the data-history read over HTTP`.

---

## Part F — Forge (`vnext-forge`, branch `f/instance-monitor`)

### Task F1: RPCs `quickrun/getDataHistory` and `quickrun/getDataHistoryRow`

**Files:**
- Modify: `packages/services-core/src/services/quickrun/quickrun-schemas.ts`, `quickrun.service.ts`
- Modify: `packages/services-core/src/registry/method-registry.ts`, `src/registry/policy.ts`
- Modify: `packages/services-core/test/registry-contract.test.ts` (method list)
- Create: `packages/services-core/test/fixtures/quickrun/getDataHistory.json`, `getDataHistoryRow.json`
- Modify: `packages/services-core/test/quickrun-service.test.ts` (or the existing quickrun service test file)
- Modify: `packages/app-contracts/src/method-http.ts` (`MethodId` + metadata)
- Modify: `apps/server/src/api/v1/quickrun.routes.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts`

**Interfaces:**
- Params: `quickrunGetDataHistoryParams = { ...workflowIdentifier, instanceId, page (int ≥1, default 1), pageSize (1..100, default 20), includeData (boolean, default true), headers, runtimeUrl? }`; `quickrunGetDataHistoryRowParams = { ...workflowIdentifier, instanceId, rowId: string (uuid), headers, runtimeUrl? }`.
- Results: `dataHistoryItemSchema = { id: string, version: string, versionNo: number, enteredAt: string, etag: string, isLatest: boolean, data?: unknown }`; `quickrunGetDataHistoryResult = { items, page, pageSize, hasNext }`; row result = one item.
- Service: GET `${instancePath}/data/history` with query `page`, `pageSize`, `includeData`; GET `${instancePath}/data/history/${rowId}`; normalise like `getIncidents` (defaults when fields missing); runtime 404 → `RUNTIME_NOT_FOUND` via the existing `runtimeHttpError`.
- Metadata: both `{ verb: 'POST', paramSource: 'json' }` like `getIncidents`; policy `'privileged'`.
- QuickRunApi: `export interface DataHistoryItem { id; version; versionNo; enteredAt; etag; isLatest; data?: unknown }`, `export interface DataHistoryPage { items: DataHistoryItem[]; page; pageSize; hasNext }`, `getDataHistory(params: InstanceScopedParams & { page?: number; pageSize?: number; includeData?: boolean })`, `getDataHistoryRow(params: InstanceScopedParams & { rowId: string })`.

- [ ] **Step 1: Failing tests** — services-core: the service builds the right runtime path + query and normalises the page; a 404 maps to `RUNTIME_NOT_FOUND`; registry-contract picks up both fixtures (it fails when a registered method lacks a fixture / metadata).
- [ ] **Step 2: Run → FAIL** (`pnpm --filter @vnext-forge-studio/services-core test`).
- [ ] **Step 3: Implement** all wiring points listed above (mirror `quickrun/getIncidents` at each: schemas ~l.327, service ~l.580, registry ~l.714, policy ~l.102, method-http ~l.66/153, server route ~l.25, QuickRunApi ~l.301).
- [ ] **Step 4: Run** services-core, server, app-contracts tests and `pnpm --filter @vnext-forge-studio/designer-ui build` → green.
- [ ] **Step 5: Commit** — `feat(quick-run): data-history RPCs`.

### Task F2: Diff and attribution models

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/model/jsonDiff.ts` (+ test)
- Create: `packages/designer-ui/src/modules/instance-monitor/model/dataAttribution.ts` (+ test)

**Interfaces:**
- `diffJson(before: unknown, after: unknown): JsonDiff` where `JsonDiff = { added: { path: string; value: string }[]; removed: { path: string; value: string }[]; changed: { path: string; oldValue: string; newValue: string }[]; unchangedCount: number }` — leaf-level paths (`a.b`, `items[0].id`), values `JSON.stringify`-ed; arrays compared by index; a type change (object ↔ scalar) counts as `changed` at that path; `before` undefined/null → everything `added`.
- `attributeRows(rows: DataHistoryItem[], history: HistoryTransition[]): Map<string /* history row id */, DataHistoryItem[]>` plus `otherWrites(rows, history): DataHistoryItem[]` — a row belongs to the firing whose `[startedAt, finishedAt ?? now]` contains `row.enteredAt` (inclusive bounds; on overlap the latest-starting firing wins); rows outside every window are "other writes".
- `previousRow(rows, row): DataHistoryItem | null` — the next older row in a newest-first list.

- [ ] **Step 1: Failing tests** (`jsonDiff.vitest.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { diffJson } from './jsonDiff';

describe('diffJson', () => {
  it('finds added, removed and changed leaves', () => {
    const d = diffJson({ a: 1, b: { c: 'x', d: true }, gone: 1 }, { a: 2, b: { c: 'x', e: null }, list: [1] });
    expect(d.changed).toEqual([{ path: 'a', oldValue: '1', newValue: '2' }]);
    expect(d.removed.map((r) => r.path).sort()).toEqual(['b.d', 'gone']);
    expect(d.added.map((r) => r.path).sort()).toEqual(['b.e', 'list[0]']);
    expect(d.unchangedCount).toBe(1);
  });
  it('treats a type change as changed at that path', () => {
    expect(diffJson({ a: { x: 1 } }, { a: 5 }).changed).toEqual([{ path: 'a', oldValue: '{"x":1}', newValue: '5' }]);
  });
  it('reports everything added when there is no previous data', () => {
    expect(diffJson(undefined, { a: 1 }).added).toEqual([{ path: 'a', value: '1' }]);
  });
  it('compares arrays by index', () => {
    const d = diffJson({ l: [1, 2] }, { l: [1, 3, 4] });
    expect(d.changed).toEqual([{ path: 'l[1]', oldValue: '2', newValue: '3' }]);
    expect(d.added).toEqual([{ path: 'l[2]', value: '4' }]);
  });
});
```

`dataAttribution.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { attributeRows, otherWrites, previousRow } from './dataAttribution';

const row = (id: string, enteredAt: string) => ({ id, version: '1.0.0', versionNo: 1, enteredAt, etag: id, isLatest: false });
const fire = (id: string, startedAt: string, finishedAt?: string) => ({ id, transitionId: id, fromState: 'a', toState: 'b', startedAt, ...(finishedAt ? { finishedAt } : {}), triggerType: 'manual', createdAt: startedAt }) as never;

describe('attributeRows', () => {
  const history = [fire('h1', '2026-10-06T10:00:00Z', '2026-10-06T10:00:02Z'), fire('h2', '2026-10-06T10:01:00Z')];
  const rows = [row('r3', '2026-10-06T10:05:00Z'), row('r2', '2026-10-06T10:00:30Z'), row('r1', '2026-10-06T10:00:01Z')];
  it('puts a row into the firing whose window contains it', () => {
    const map = attributeRows(rows, history, Date.parse('2026-10-06T10:10:00Z'));
    expect(map.get('h1')?.map((r) => r.id)).toEqual(['r1']);
    expect(map.get('h2')?.map((r) => r.id)).toEqual(['r3']); // open window runs to "now"
  });
  it('collects rows outside every window as other writes', () => {
    expect(otherWrites(rows, history, Date.parse('2026-10-06T10:10:00Z')).map((r) => r.id)).toEqual(['r2']);
  });
  it('finds the previous (older) row', () => {
    expect(previousRow(rows, rows[0])?.id).toBe('r2');
    expect(previousRow(rows, rows[2])).toBeNull();
  });
});
```

(`attributeRows` / `otherWrites` take an explicit `now` for testability — `(rows, history, now = Date.now())`.)

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** both modules (pure, no React). `jsonDiff`: recursive walk over plain objects and arrays; leaves are scalars / null; `unchangedCount` counts equal leaves.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(instance-monitor): json diff and data-row attribution models`.

### Task F3: Data tab and transition "Data change"

**Files:**
- Create: `packages/designer-ui/src/modules/instance-monitor/hooks/useDataHistory.ts`
- Create: `packages/designer-ui/src/modules/instance-monitor/components/DataDiffView.tsx`, `components/DataTab.tsx` (+ `components/data.vitest.test.tsx`)
- Modify: `components/TransitionExecution.tsx` (Data change per firing), `components/MonitorInspector.tsx`, `components/MonitorShell.tsx` (fifth tab, hook wiring)

**Interfaces:**
- `useDataHistory(level: MonitorTarget, headers, refreshKey: number, enabled: boolean): { state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'; rows: DataHistoryItem[]; hasNext: boolean; error: RuntimeErrorLike | null; loadMore(): void }` — first page (`pageSize: 20, includeData: true`) when `enabled` becomes true; reloads when `refreshKey` (the level's `loadedAt`) changes; `RUNTIME_NOT_FOUND` (code) → `'unavailable'`; other failures → `'error'`; guards stale responses.
- `DataDiffView({ diff }: { diff: JsonDiff })` — port of `apps/monitoring/src/pages/InstanceDetailPage.tsx:320-379` with `var(--vscode-*, …)` colours (added: `--vscode-gitDecoration-addedResourceForeground`, removed: `--vscode-gitDecoration-deletedResourceForeground`, changed: `--vscode-gitDecoration-modifiedResourceForeground`) and English copy ("No differences. N fields unchanged.").
- `DataTab({ current, history, rows, state, hasNext, error, onLoadMore })`:
  - **Current** — `current` (from `QuickRunApi.getData`, loaded by MonitorShell on tab open) as `CopyableJsonBlock`; "Current data could not be loaded." on failure.
  - **Versions** (state `ready`) — newest first: `#{n} · {time} · {after <transition label> (<from> → <to>) | Other write}` + "{k} fields changed" (diff vs previous row); clicking a row expands its `DataDiffView` vs the previous row; two checkboxes → **Compare** button shows the diff between the two (older → newer); **Load more** while `hasNext`.
  - `unavailable` — "Data history needs a newer runtime." (tooltip-free note); `error` — `RuntimeErrorBanner` "Data history request failed".
- `TransitionExecution` gains `dataRowsByFiring?: Map<string, DataHistoryItem[]>` and `allRows?: DataHistoryItem[]`; for an expanded firing with rows, append a "Data change" `DetailsBody` tab rendering `DataDiffView` between the row before the firing's first row and its last row (`previousRow(allRows, firstRow)` → last row). Absent rows → no tab.
- `MonitorShell`: fifth right-pane tab **Data**; `useDataHistory(level, headers, data.loadedAt, dataTabOpen || selection?.kind === 'transition')`; current data fetched with `QuickRunApi.getData({ ...scope })` when the Data tab opens (cache per `loadedAt`); `attributeRows` memo passed to the inspector.

- [ ] **Step 1: Failing SSR tests** (`data.vitest.test.tsx`): `DataDiffView` shows `+ b.e`, `− gone`, `~ a` with old/new values and "N fields unchanged"; `DataTab` in `ready` shows "#3", "after", "Other write", "fields changed" and a **Compare** button; `unavailable` shows "Data history needs a newer runtime."; `TransitionExecution` with one firing (auto-expanded) and attributed rows renders a "Data change" tab label.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per the interfaces (reuse `CopyableJsonBlock`, `DetailsBody`, `RuntimeErrorBanner`, `pickLabel` + `findTransition` for transition labels).
- [ ] **Step 4: Run** instance-monitor + quick-run suites, designer-ui build → green.
- [ ] **Step 5: Commit** — `feat(instance-monitor): data tab with version diffs and per-firing data change`.

### Task F4: Verification

- [ ] Runtime: `dotnet build` + `dotnet test test/BBT.Workflow.Application.Tests` on `f/instance-data-history` → green.
- [ ] Forge: designer-ui, services-core, extension, server, app-contracts tests + `pnpm -w turbo run build` → green.
- [ ] Manual (when a local runtime built from `f/instance-data-history` is available): Data tab lists rows newest first, diffs read right, a transition's Data change matches; against the current released runtime the Versions part shows "Data history needs a newer runtime." while Current still works. Record what ran.
