# vNext Runtime Sync — Phase B (QuickRunner) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the QuickRunner speak the current vNext runtime API — incidents, instance metadata, state timeout, long-poll interaction/acknowledge, authorize, human-task list and task history.

**Architecture:** RPC plumbing first (services-core method registry + app-contracts HTTP metadata + server routes + designer-ui `QuickRunApi` wrappers), then UI slices. Every behaviour decision lives in a pure, unit-tested helper (`interactionMachine`, `countdown`, `permissionChecks`, `humanTasks`, `taskHistory`, `instanceTarget`); components are props-driven so the SSR-only test harness (`renderToStaticMarkup`) can assert them; stores and hooks only wire helpers to the network.

**Tech Stack:** TypeScript 5.7, React 19, zustand, zod 4, vitest 3 (`renderToStaticMarkup` for components, `vi.fn()` proxy mocks for services-core), Hono (server), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-24-vnext-runtime-sync-design.md` (Phase B: B0 carry-overs + B1–B9; Decisions D3, D4, D5; "Clarification: `terminate` semantics")

## Global Constraints

- All development happens in vnext-forge only; `vnext`, `vnext-schema`, `vnext-example`, `vnext-workflow-cli` (siblings under `/Users/U0B006/Documents/repos/burgan-tech/`) are read-only references.
- All user-visible strings are English (repo rule in `CLAUDE.md`).
- `apps/web`: no raw `console.*`; designer-ui logs through `createLogger`.
- Branch: `f/vnext-runtime-sync`. Commit only at the Commit steps; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lint only touched files (`pnpm exec eslint <files>`); per-package `eslint .` is pre-existing red. Gates are package `build` (`tsc -b`), vitest and the Turborepo build.
- Every new method follows `.cursor/rules/rpc-method-policy.mdc`: registry entry (params/result zod), `policy.ts` = `'privileged'`, `MethodId` + `METHOD_HTTP_METADATA` (`POST` / `json`, like every `quickrun/*`), a route in `apps/server/src/api/v1/quickrun.routes.ts`, a fixture under `packages/services-core/test/fixtures/quickrun/`, the sorted-names snapshot in `registry-contract.test.ts`, and a `QuickRunApi.ts` wrapper.
- Runtime paths are rebuilt from identifiers (as `acknowledgeLongPoll` does), never by following server hrefs. Instance ids in new paths go through `encodeURIComponent`.
- InstanceStatus `P` = Passive; InstanceType `P` = SubProcess. Never conflate them.
- Raw `status` drives behaviour (retry, cancel, polling); `effectiveStatus ?? status` (`displayStatus`) drives display only.
- `functions/actions` is out of scope (runtime writes no rows yet — spec D8).
- designer-ui `tsconfig.json` excludes only `*.vitest.test.ts`: `*.vitest.test.tsx` files are compiled by `tsc -b` and must type-check.
- designer-ui component tests: `renderToStaticMarkup`; the zustand store is frozen at creation under SSR, so tested components take props instead of reading the store. Tests that import a component rendering `CopyableJsonBlock` (Monaco) must `vi.mock('./CopyableJsonBlock', …)` and load the component with `await import(...)`.
- The current role is the `role` header, else the first entry of `x-roles` (runtime default caller-role provider; `vnext-example/api-tests/human-task-chain/morph-idm-aggregation.http`).

## File Map

| File | Responsibility |
|---|---|
| `packages/services-core/src/services/quickrun/quickrun-schemas.ts` | zod contracts for the five new methods + ack `role` |
| `packages/services-core/src/services/quickrun/quickrun.service.ts` | runtime calls; `runtimeHttpError`, `runtimeErrorCode`, `headerValue`, `instancePath` helpers |
| `packages/services-core/test/quickrun-service.test.ts` (new) | service unit tests with a mocked proxy |
| `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts` | typed wrappers (`getIncidents`, `getActiveIncident`, `getTaskHistory`, `authorize`, `getHumanTasks`, ack `role`) |
| `packages/designer-ui/src/modules/quick-run/utils/currentRole.ts` (new) | read the current role from headers; override role headers |
| `packages/designer-ui/src/modules/quick-run/hooks/interactionMachine.ts` (new) | pure long-poll interaction reducer (D3) |
| `packages/designer-ui/src/modules/quick-run/utils/countdown.ts` (new) | countdown formatting for ack window, timeout, scheduled entries |
| `packages/designer-ui/src/modules/quick-run/hooks/useNow.ts`, `useInteractionDriver.ts` (new) | ticking clock; countdown expiry + resume polling |
| `packages/designer-ui/src/modules/quick-run/components/InteractionBanner.tsx` (new) | Acknowledge / Wait for fallback UI |
| `packages/designer-ui/src/modules/quick-run/components/AnnotationChips.tsx`, `StateTimeoutChip.tsx` (new) | state surface (B3) |
| `packages/designer-ui/src/modules/quick-run/components/IncidentSection.tsx` (new) | incident alert, lazy active/history loading (moved out of `InstanceDashboard.tsx`) |
| `packages/designer-ui/src/modules/quick-run/utils/instanceTarget.ts`, `hooks/useOpenInstance.ts` (new) | open an instance tab keeping raw vs effective status |
| `packages/designer-ui/src/modules/quick-run/utils/permissionChecks.ts`, `components/AuthorizePanel.tsx` (new) | authorize verdicts, cache key, panel (D4) |
| `packages/designer-ui/src/modules/quick-run/utils/humanTasks.ts`, `components/HumanTaskList.tsx`, `HumanTasksPanel.tsx`, `QuickRunSidebar.tsx` (new) | Human Tasks tab (D5) |
| `packages/designer-ui/src/modules/quick-run/utils/taskHistory.ts`, `components/TasksTab.tsx` (new) | Tasks tab in ContextPanel |

---

### Task 1: services-core — incidents and task-history methods

**Files:**
- Modify: `packages/services-core/src/services/quickrun/quickrun-schemas.ts` (append before the `// ── Get View` section)
- Modify: `packages/services-core/src/services/quickrun/quickrun.service.ts`
- Modify: `packages/services-core/src/registry/method-registry.ts` (import block lines 111–138; entries after `'quickrun/getFunctionCatalog'`)
- Modify: `packages/services-core/src/registry/policy.ts` (after `'quickrun/getFunctionCatalog': 'privileged',`)
- Modify: `packages/app-contracts/src/method-http.ts` (`MethodId` union after `'quickrun/getFunctionCatalog'`; metadata after `'quickrun/getFunctionCatalog': …`)
- Modify: `apps/server/src/api/v1/quickrun.routes.ts`
- Create: `packages/services-core/test/fixtures/quickrun/getIncidents.json`, `getActiveIncident.json`, `getTaskHistory.json`
- Create: `packages/services-core/test/quickrun-service.test.ts`
- Modify: `packages/services-core/test/registry-contract.test.ts` (inline snapshot)

**Interfaces:**
- Produces (services-core): `quickrunGetIncidentsParams/Result`, `quickrunGetActiveIncidentParams/Result`, `quickrunGetTaskHistoryParams/Result`; service methods `getIncidents`, `getActiveIncident`, `getTaskHistory`; module helpers `runtimeHttpError(data, status, source, traceId?)`, `runtimeErrorCode(data)`, `instancePath(domain, workflowKey, instanceId)`, `headerValue(headers, name)` (used by Task 2).
- Wire results: `getIncidents` → `{ hasActiveIncident: boolean; items: IncidentEntry[]; page: number; pageSize: number; hasNext: boolean }`; `getActiveIncident` → `{ incident: IncidentEntry | null }`; `getTaskHistory` → `{ items: TaskHistoryItem[] }`.

- [ ] **Step 1: Write the failing service tests**

Create `packages/services-core/test/quickrun-service.test.ts`:

```ts
import { ERROR_CODES } from '@vnext-forge-studio/app-contracts'
import { describe, expect, it, vi } from 'vitest'

import { createQuickRunService } from '../src/index.js'

function serviceWith(response: { status: number; data: string; responseHeaders?: Record<string, string> }) {
  const proxy = vi.fn().mockResolvedValue({
    status: response.status,
    contentType: 'application/json',
    data: response.data,
    responseHeaders: response.responseHeaders ?? {},
  })
  return { service: createQuickRunService({ proxy } as never), proxy }
}

const ids = { domain: 'core', workflowKey: 'error-boundary-lab', instanceId: 'i-1' }

const INCIDENT = {
  id: 'a1',
  createdAt: '2026-09-20T10:00:00Z',
  state: 'call-api',
  transition: 'go',
  task: 'http-fail',
  message: 'Upstream 503',
  errorCode: 'Task:Http:503',
  errorLayer: 'Task',
  statusCode: 503,
  boundaryAction: 'Abort',
  boundaryLevel: 'Task',
  traceId: 't-1',
  isResolved: false,
  resolvedAt: null,
  retryCount: 0,
}

describe('quickRunService.getIncidents', () => {
  it('pages the incident history from a path rebuilt from identifiers', async () => {
    const { service, proxy } = serviceWith({
      status: 200,
      data: JSON.stringify({ hasActiveIncident: true, items: [INCIDENT], page: 2, pageSize: 5, hasNext: false }),
    })
    const result = await service.getIncidents({ ...ids, page: 2, pageSize: 5 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/incidents',
        query: { page: '2', pageSize: '5' },
      }),
      undefined,
    )
    expect(result).toEqual({ hasActiveIncident: true, items: [INCIDENT], page: 2, pageSize: 5, hasNext: false })
  })

  it('encodes the instance id segment', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"items":[]}' })
    await service.getIncidents({ ...ids, instanceId: 'a/b', page: 1, pageSize: 20 })
    expect(proxy.mock.calls[0][0].runtimePath).toBe('/api/v1/core/workflows/error-boundary-lab/instances/a%2Fb/incidents')
  })

  it('throws a runtime error on a 403', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"x"}}' })
    await expect(service.getIncidents({ ...ids, page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickRunService.getActiveIncident', () => {
  it('returns the open incident', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify(INCIDENT) })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: INCIDENT })
    expect(proxy.mock.calls[0][0].runtimePath).toBe(
      '/api/v1/core/workflows/error-boundary-lab/instances/i-1/incidents/active',
    )
  })

  it('treats 404 Instance:100037 (Aether envelope) as "no open incident"', async () => {
    const { service } = serviceWith({
      status: 404,
      data: JSON.stringify({ error: { prefix: 'Instance', code: '100037', message: 'No active incident' } }),
    })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: null })
  })

  it('treats 404 Instance:100037 (flat code) as "no open incident"', async () => {
    const { service } = serviceWith({ status: 404, data: JSON.stringify({ code: 'Instance:100037' }) })
    expect(await service.getActiveIncident(ids)).toEqual({ incident: null })
  })

  it('still fails on any other 404', async () => {
    const { service } = serviceWith({ status: 404, data: JSON.stringify({ code: 'Instance:100001' }) })
    await expect(service.getActiveIncident(ids)).rejects.toMatchObject({ code: ERROR_CODES.RUNTIME_EXECUTION_FAILED })
  })
})

describe('quickRunService.getTaskHistory', () => {
  it('reads the tasks function of the instance', async () => {
    const item = {
      id: 't1', taskKey: 'send-otp', transitionKey: 'approve', fromState: 'draft', toState: 'approved',
      triggerType: 'manual', status: 'completed', businessStatus: 'success',
      startedAt: '2026-09-20T10:00:00Z', finishedAt: '2026-09-20T10:00:01Z', durationMs: 184.2, error: null,
    }
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify({ items: [item] }) })
    expect(await service.getTaskHistory(ids)).toEqual({ items: [item] })
    expect(proxy.mock.calls[0][0].runtimePath).toBe(
      '/api/v1/core/workflows/error-boundary-lab/instances/i-1/functions/tasks',
    )
  })

  it('reports a body without items as an empty history', async () => {
    const { service } = serviceWith({ status: 200, data: '{}' })
    expect(await service.getTaskHistory(ids)).toEqual({ items: [] })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts`
Expected: FAIL — `service.getIncidents is not a function` (and the same for the other two).

- [ ] **Step 3: Add the zod contracts**

In `quickrun-schemas.ts`, insert directly above `// ── Get View ───…`:

```ts
// ── Incidents ─────────────────────────────────────────────────────────────────
//
// Targets of the state function's `incident.history.href` / `incident.active.href`:
//   GET /api/v1/<domain>/workflows/<flow>/instances/<id>/incidents?page&pageSize
//   GET /api/v1/<domain>/workflows/<flow>/instances/<id>/incidents/active
// As with `acknowledgeLongPoll`, the paths are rebuilt from the identifiers.
// `incidents/active` answers 404 `Instance:100037` when nothing is open — a
// normal answer, surfaced as `{ incident: null }`.

const incidentEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  state: z.string(),
  transition: z.string(),
  task: z.string().nullable().optional(),
  message: z.string(),
  errorCode: z.string().nullable().optional(),
  errorLayer: z.string().nullable().optional(),
  statusCode: z.number().int().nullable().optional(),
  boundaryAction: z.string().nullable().optional(),
  boundaryLevel: z.string().nullable().optional(),
  traceId: z.string().nullable().optional(),
  isResolved: z.boolean(),
  resolvedAt: z.string().nullable().optional(),
  retryCount: z.number().int(),
})

export const quickrunGetIncidentsParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  page: z.number().int().min(1).optional().default(1),
  // The runtime clamps pageSize to 1..100.
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetIncidentsResult = z.object({
  hasActiveIncident: z.boolean(),
  items: z.array(incidentEntrySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  hasNext: z.boolean(),
})

export const quickrunGetActiveIncidentParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetActiveIncidentResult = z.object({
  incident: incidentEntrySchema.nullable(),
})

// ── Task History ──────────────────────────────────────────────────────────────
//
//   GET /api/v1/<domain>/workflows/<flow>/instances/<id>/functions/tasks
// Metadata only (no request/response payloads), StartedAt ascending, unpaged.

const taskHistoryItemSchema = z.object({
  id: z.string(),
  taskKey: z.string(),
  transitionKey: z.string(),
  fromState: z.string(),
  toState: z.string().nullable().optional(),
  triggerType: z.string(),
  /** waiting | busy | completed | faulted */
  status: z.string(),
  /** unknown | success | failed */
  businessStatus: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  error: z.string().nullable().optional(),
})

export const quickrunGetTaskHistoryParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetTaskHistoryResult = z.object({
  items: z.array(taskHistoryItemSchema),
})
```

- [ ] **Step 4: Implement the service methods**

In `quickrun.service.ts`:

1. Add to the import list from `./quickrun-schemas.js`:

```ts
  quickrunGetIncidentsParams,
  quickrunGetIncidentsResult,
  quickrunGetActiveIncidentParams,
  quickrunGetActiveIncidentResult,
  quickrunGetTaskHistoryParams,
  quickrunGetTaskHistoryResult,
```

2. Replace the whole `parseJsonResponse` function with:

```ts
/** The error every non-2xx runtime answer becomes; the body lands in `details`. */
function runtimeHttpError(data: string, status: number, source: string, traceId?: string): VnextForgeError {
  let details: Record<string, unknown> = { httpStatus: status }
  try {
    details = { ...details, ...JSON.parse(data) }
  } catch { /* non-JSON error body */ }
  return new VnextForgeError(
    ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    `Runtime returned HTTP ${status}`,
    { source, layer: 'infrastructure', details },
    traceId,
  )
}

function parseJsonResponse<T>(
  data: string,
  status: number,
  source: string,
  traceId?: string,
): T {
  if (status < 200 || status >= 300) {
    throw runtimeHttpError(data, status, source, traceId)
  }
  try {
    return JSON.parse(data) as T
  } catch {
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_INVALID_RESPONSE,
      'Failed to parse runtime response as JSON',
      { source, layer: 'infrastructure', details: { rawData: data.slice(0, 200) } },
      traceId,
    )
  }
}

/** `Instance:100037` — `incidents/active` has nothing open. A normal answer. */
const ACTIVE_INCIDENT_NOT_FOUND = 'Instance:100037'

/**
 * The runtime error code of an error body, normalised to `<prefix>:<code>`.
 * Reads the Aether envelope (`{ error: { prefix, code } }`) and flat bodies.
 */
function runtimeErrorCode(data: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const outer = parsed as Record<string, unknown>
  const body = (outer.error && typeof outer.error === 'object' ? outer.error : outer) as Record<string, unknown>
  const code =
    typeof body.code === 'string' ? body.code : typeof body.errorCode === 'string' ? body.errorCode : undefined
  if (!code) return undefined
  const prefix = typeof body.prefix === 'string' ? body.prefix : undefined
  return prefix && !code.startsWith(`${prefix}:`) ? `${prefix}:${code}` : code
}

/** Case-insensitive response-header lookup. */
function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }
  return undefined
}

function instancePath(domain: string, workflowKey: string, instanceId: string): string {
  return `${buildBasePath(domain, workflowKey)}/instances/${encodeURIComponent(instanceId)}`
}
```

3. Inside `createQuickRunService`, directly above `return {`, add:

```ts
  async function getIncidents(
    params: z.infer<typeof quickrunGetIncidentsParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetIncidentsResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/incidents`,
        query: { page: String(params.page), pageSize: String(params.pageSize) },
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getIncidents', traceId,
    )
    return {
      hasActiveIncident: parsed.hasActiveIncident === true,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      page: typeof parsed.page === 'number' ? parsed.page : params.page,
      pageSize: typeof parsed.pageSize === 'number' ? parsed.pageSize : params.pageSize,
      hasNext: parsed.hasNext === true,
    } as z.infer<typeof quickrunGetIncidentsResult>
  }

  async function getActiveIncident(
    params: z.infer<typeof quickrunGetActiveIncidentParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetActiveIncidentResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/incidents/active`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    // The link is advertised while the flag is set, but a retry may have
    // resolved the incident since — "nothing open" is an answer, not a failure.
    if (result.status === 404 && runtimeErrorCode(result.data) === ACTIVE_INCIDENT_NOT_FOUND) {
      return { incident: null }
    }
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getActiveIncident', traceId,
    )
    return { incident: parsed } as z.infer<typeof quickrunGetActiveIncidentResult>
  }

  async function getTaskHistory(
    params: z.infer<typeof quickrunGetTaskHistoryParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetTaskHistoryResult>> {
    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/functions/tasks`,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
    const parsed = parseJsonResponse<Record<string, unknown>>(
      result.data, result.status, 'QuickRunService.getTaskHistory', traceId,
    )
    return { items: Array.isArray(parsed.items) ? parsed.items : [] } as z.infer<typeof quickrunGetTaskHistoryResult>
  }
```

4. Add `getIncidents,`, `getActiveIncident,`, `getTaskHistory,` to the returned object after `getFunctionCatalog,`.

- [ ] **Step 5: Run the service tests**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts`
Expected: PASS (9 tests). `headerValue` is unused until Task 2 — that is expected.

- [ ] **Step 6: Register the methods end to end**

`method-registry.ts` — add to the `quickrun-schemas.js` import list:

```ts
  quickrunGetIncidentsParams,
  quickrunGetIncidentsResult,
  quickrunGetActiveIncidentParams,
  quickrunGetActiveIncidentResult,
  quickrunGetTaskHistoryParams,
  quickrunGetTaskHistoryResult,
```

and after the `'quickrun/getFunctionCatalog': { … },` entry:

```ts
    'quickrun/getIncidents': {
      paramsSchema: quickrunGetIncidentsParams,
      resultSchema: quickrunGetIncidentsResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getIncidents(params, traceId),
    },
    'quickrun/getActiveIncident': {
      paramsSchema: quickrunGetActiveIncidentParams,
      resultSchema: quickrunGetActiveIncidentResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getActiveIncident(params, traceId),
    },
    'quickrun/getTaskHistory': {
      paramsSchema: quickrunGetTaskHistoryParams,
      resultSchema: quickrunGetTaskHistoryResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getTaskHistory(params, traceId),
    },
```

`policy.ts` — after `'quickrun/getFunctionCatalog': 'privileged',`:

```ts
  'quickrun/getIncidents': 'privileged',
  'quickrun/getActiveIncident': 'privileged',
  'quickrun/getTaskHistory': 'privileged',
```

`method-http.ts` — in the `MethodId` union after `| 'quickrun/getFunctionCatalog'`:

```ts
  | 'quickrun/getIncidents'
  | 'quickrun/getActiveIncident'
  | 'quickrun/getTaskHistory'
```

and in `METHOD_HTTP_METADATA` after `'quickrun/getFunctionCatalog': { verb: 'POST', paramSource: 'json' },`:

```ts
  'quickrun/getIncidents': { verb: 'POST', paramSource: 'json' },
  'quickrun/getActiveIncident': { verb: 'POST', paramSource: 'json' },
  'quickrun/getTaskHistory': { verb: 'POST', paramSource: 'json' },
```

`quickrun.routes.ts` — after the `getFunctionCatalog` line:

```ts
  app.post('/quickrun/getIncidents', (c) => helper(c, 'quickrun/getIncidents', { source: 'json' }));
  app.post('/quickrun/getActiveIncident', (c) => helper(c, 'quickrun/getActiveIncident', { source: 'json' }));
  app.post('/quickrun/getTaskHistory', (c) => helper(c, 'quickrun/getTaskHistory', { source: 'json' }));
```

- [ ] **Step 7: Add fixtures**

`packages/services-core/test/fixtures/quickrun/getIncidents.json`:

```json
{
  "params": {
    "domain": "core",
    "workflowKey": "error-boundary-lab",
    "instanceId": "0f3c2a4e-5b7d-4a51-9a0e-2d3c1b4a5e6f",
    "page": 1,
    "pageSize": 20,
    "runtimeUrl": "http://localhost:4201"
  },
  "result": {
    "hasActiveIncident": true,
    "items": [
      {
        "id": "7a1b9c2d-0e3f-4a5b-8c6d-9e0f1a2b3c4d",
        "createdAt": "2026-09-20T10:00:00Z",
        "state": "call-api",
        "transition": "go",
        "task": "http-fail",
        "message": "Upstream returned 503",
        "errorCode": "Task:Http:503",
        "errorLayer": "Task",
        "statusCode": 503,
        "boundaryAction": "Abort",
        "boundaryLevel": "Task",
        "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
        "isResolved": false,
        "resolvedAt": null,
        "retryCount": 0
      }
    ],
    "page": 1,
    "pageSize": 20,
    "hasNext": false
  }
}
```

`getActiveIncident.json`:

```json
{
  "params": {
    "domain": "core",
    "workflowKey": "error-boundary-lab",
    "instanceId": "0f3c2a4e-5b7d-4a51-9a0e-2d3c1b4a5e6f"
  },
  "result": {
    "incident": {
      "id": "7a1b9c2d-0e3f-4a5b-8c6d-9e0f1a2b3c4d",
      "createdAt": "2026-09-20T10:00:00Z",
      "state": "call-api",
      "transition": "go",
      "task": "http-fail",
      "message": "Upstream returned 503",
      "errorCode": "Task:Http:503",
      "errorLayer": "Task",
      "statusCode": 503,
      "boundaryAction": "Abort",
      "boundaryLevel": "Task",
      "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
      "isResolved": false,
      "resolvedAt": null,
      "retryCount": 0
    }
  }
}
```

`getTaskHistory.json`:

```json
{
  "params": {
    "domain": "core",
    "workflowKey": "account-opening",
    "instanceId": "b9846b60-0b07-447b-8377-9e2b9ac3d470"
  },
  "result": {
    "items": [
      {
        "id": "6f9c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
        "taskKey": "send-otp",
        "transitionKey": "approve",
        "fromState": "draft",
        "toState": "approved",
        "triggerType": "manual",
        "status": "completed",
        "businessStatus": "success",
        "startedAt": "2026-09-20T10:00:00Z",
        "finishedAt": "2026-09-20T10:00:00.184Z",
        "durationMs": 184.2,
        "error": null
      }
    ]
  }
}
```

- [ ] **Step 8: Update the sorted-names snapshot**

In `registry-contract.test.ts`, inside the inline snapshot insert:
- `"quickrun/getActiveIncident",` directly after `"quickrun/fireTransition",`
- `"quickrun/getIncidents",` directly after `"quickrun/getHistory",`
- `"quickrun/getTaskHistory",` directly after `"quickrun/getState",`

- [ ] **Step 9: Run contract tests and builds**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts test/registry-contract.test.ts`
Expected: PASS (snapshot, parity and fixture parse all green).

Run: `pnpm --filter @vnext-forge-studio/app-contracts test && pnpm --filter @vnext-forge-studio/services-core build && pnpm --filter @vnext-forge-studio/server build`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/services-core packages/app-contracts/src/method-http.ts apps/server/src/api/v1/quickrun.routes.ts
git commit -m "feat(quickrun): add incident and task-history runtime methods

quickrun/getIncidents, quickrun/getActiveIncident (404 Instance:100037 is
\"nothing open\") and quickrun/getTaskHistory, wired through registry,
policy, HTTP metadata, server routes and fixtures.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: services-core — authorize, human-task and acknowledge with role

**Files:**
- Modify: `packages/services-core/src/services/quickrun/quickrun-schemas.ts`
- Modify: `packages/services-core/src/services/quickrun/quickrun.service.ts`
- Modify: `packages/services-core/src/registry/method-registry.ts`, `packages/services-core/src/registry/policy.ts`
- Modify: `packages/app-contracts/src/method-http.ts`, `apps/server/src/api/v1/quickrun.routes.ts`
- Create: `packages/services-core/test/fixtures/quickrun/authorize.json`, `getHumanTasks.json`
- Modify: `packages/services-core/test/quickrun-service.test.ts`, `packages/services-core/test/registry-contract.test.ts`

**Interfaces:**
- Consumes: `runtimeHttpError`, `headerValue`, `instancePath` from Task 1.
- Produces: `quickrun/authorize` params `{ domain, workflowKey, instanceId, transitionKey? | functionKey? | queryRoles?: true | ack?: true (exactly one), role?, version?, headers?, runtimeUrl? }` → `{ allowed: boolean; status: number }` for HTTP 200 and 403; `quickrun/getHumanTasks` params `{ domain, cacheOverride?: boolean, headers?, runtimeUrl? }` → `{ items: HumanTaskItem[]; truncated: boolean }`; `quickrun/acknowledgeLongPoll` gains optional `role` and throws on non-2xx (result stays `{ ok: true; status }`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/services-core/test/quickrun-service.test.ts` (add `import { quickrunAuthorizeParams } from '../src/services/quickrun/quickrun-schemas.js'` below the existing imports):

```ts
describe('quickrunAuthorizeParams', () => {
  it('requires exactly one selector', () => {
    expect(quickrunAuthorizeParams.safeParse(ids).success).toBe(false)
    expect(quickrunAuthorizeParams.safeParse({ ...ids, transitionKey: 'a', ack: true }).success).toBe(false)
    expect(quickrunAuthorizeParams.safeParse({ ...ids, queryRoles: true }).success).toBe(true)
  })
})

describe('quickRunService.authorize', () => {
  it('returns the verdict of a 200 and sends selector, role and version as query', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"allowed":true}' })
    const result = await service.authorize({ ...ids, transitionKey: 'approve', role: 'ht-approver', version: '1.0.0' })
    expect(result).toEqual({ allowed: true, status: 200 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/functions/authorize',
        query: { transitionKey: 'approve', role: 'ht-approver', version: '1.0.0' },
      }),
      undefined,
    )
  })

  it('returns a 403 {"allowed":false} as a verdict, not an error', async () => {
    const { service } = serviceWith({ status: 403, data: '{"allowed":false}' })
    expect(await service.authorize({ ...ids, queryRoles: true })).toEqual({ allowed: false, status: 403 })
  })

  it('sends queryRoles / ack as "true"', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"allowed":true}' })
    await service.authorize({ ...ids, ack: true })
    expect(proxy.mock.calls[0][0].query).toEqual({ ack: 'true' })
  })

  it('treats a 403 without a verdict body as a failure', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"Authorization:110001"}}' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })

  it('treats a 200 without a boolean "allowed" as an invalid response', async () => {
    const { service } = serviceWith({ status: 200, data: '{}' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_INVALID_RESPONSE,
    })
  })

  it('fails on any other status', async () => {
    const { service } = serviceWith({ status: 500, data: 'boom' })
    await expect(service.authorize({ ...ids, queryRoles: true })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})

describe('quickRunService.getHumanTasks', () => {
  const ROW = {
    instanceId: 'APP-1', id: '11111111-2222-3333-4444-555555555555', workflow: 'ht-a',
    title: 'Approve application', description: 'Level A', createdAt: '2026-09-20T10:00:00Z', vNext: true,
  }

  it('calls the domain function with the cache override header', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: JSON.stringify([ROW]) })
    const result = await service.getHumanTasks({ domain: 'core', cacheOverride: true, headers: { role: 'ht-approver' } })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        runtimePath: '/api/v1/core/functions/human-task',
        headers: { role: 'ht-approver', 'X-VNext-Cache-Override': 'true' },
      }),
      undefined,
    )
    expect(result).toEqual({ items: [ROW], truncated: false })
  })

  it('reads truncation from the response header, case-insensitively', async () => {
    const { service } = serviceWith({
      status: 200, data: '[]', responseHeaders: { 'X-VNext-HumanTask-Truncated': 'true' },
    })
    expect((await service.getHumanTasks({ domain: 'core' })).truncated).toBe(true)
  })

  it('rejects a body that is not an array', async () => {
    const { service } = serviceWith({ status: 200, data: '{"items":[]}' })
    await expect(service.getHumanTasks({ domain: 'core' })).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_INVALID_RESPONSE,
    })
  })
})

describe('quickRunService.acknowledgeLongPoll', () => {
  it('sends the acknowledging role as a query parameter', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '' })
    expect(await service.acknowledgeLongPoll({ ...ids, role: 'approver' })).toEqual({ ok: true, status: 200 })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        runtimePath: '/api/v1/core/workflows/error-boundary-lab/instances/i-1/longpoll/ack',
        query: { role: 'approver' },
      }),
      undefined,
    )
  })

  it('surfaces a non-2xx instead of swallowing it', async () => {
    const { service } = serviceWith({ status: 403, data: '{"error":{"code":"x"}}' })
    await expect(service.acknowledgeLongPoll(ids)).rejects.toMatchObject({
      code: ERROR_CODES.RUNTIME_EXECUTION_FAILED,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts`
Expected: FAIL — `quickrunAuthorizeParams` is not exported; `service.authorize` / `service.getHumanTasks` undefined; the ack 403 test resolves instead of rejecting.

- [ ] **Step 3: Add the zod contracts**

In `quickrun-schemas.ts`, replace the `// ── Acknowledge Long Poll` comment block and both ack schemas with:

```ts
// ── Acknowledge Long Poll ─────────────────────────────────────────────────────
//
// Sent when the user acknowledges a paused long poll (state response carries
// `interaction.terminateLongPoll: true`). The endpoint is deterministic:
//   POST /api/v1/<domain>/workflows/<flow>/instances/<instanceId>/longpoll/ack?role=
// so the service builds the path from the workflow identifiers rather than
// trusting the engine-supplied href. `role` names which of the caller's roles
// acknowledges (additive to the provider's roles). Idempotent: 200 when nothing
// is pending. A non-2xx is thrown to the caller.

export const quickrunAcknowledgeLongPollParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  role: z.string().min(1).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunAcknowledgeLongPollResult = z.object({
  ok: z.boolean(),
  status: z.number(),
})

// ── Authorize ─────────────────────────────────────────────────────────────────
//
//   GET /api/v1/<domain>/workflows/<flow>/instances/<id>/functions/authorize
// The runtime's authorization oracle. Exactly one selector; the verdict is in
// the body on BOTH 200 (`{"allowed":true}`) and 403 (`{"allowed":false}`).

export const quickrunAuthorizeParams = z
  .object({
    ...workflowIdentifier,
    instanceId: z.string().min(1),
    transitionKey: z.string().min(1).optional(),
    functionKey: z.string().min(1).optional(),
    queryRoles: z.literal(true).optional(),
    ack: z.literal(true).optional(),
    /** Probe role: fallback for transition/function/queryRoles, additive for ack. */
    role: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    headers: headersSchema,
    runtimeUrl: z.string().optional(),
  })
  .refine(
    (p) =>
      [p.transitionKey !== undefined, p.functionKey !== undefined, p.queryRoles === true, p.ack === true]
        .filter(Boolean).length === 1,
    { message: 'Provide exactly one of transitionKey, functionKey, queryRoles or ack.' },
  )

export const quickrunAuthorizeResult = z.object({
  allowed: z.boolean(),
  /** 200 or 403. */
  status: z.number().int(),
})

// ── Human Tasks ───────────────────────────────────────────────────────────────
//
//   GET /api/v1/<domain>/functions/human-task
// Domain-level; the body is a bare JSON array, truncation is signalled by the
// `X-VNext-HumanTask-Truncated` response header. `cacheOverride` sends
// `X-VNext-Cache-Override: true` (forces a rebuild of the per-caller cache).

export const quickrunGetHumanTasksParams = z.object({
  domain: z.string().min(1),
  cacheOverride: z.boolean().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

const humanTaskItemSchema = z
  .object({
    /** Business key of the ROOT instance (its own Id for a SubProcess). */
    instanceId: z.string().nullable().optional(),
    /** The root instance's own id — always unique. */
    id: z.string(),
    workflow: z.string().nullable().optional(),
    /** From the LEAF instance's `humanTask.title`. */
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough()

export const quickrunGetHumanTasksResult = z.object({
  items: z.array(humanTaskItemSchema),
  truncated: z.boolean(),
})
```

- [ ] **Step 4: Implement the service methods**

In `quickrun.service.ts`:

1. Add to the schema import list: `quickrunAuthorizeParams, quickrunAuthorizeResult, quickrunGetHumanTasksParams, quickrunGetHumanTasksResult,`.

2. Replace the whole `acknowledgeLongPoll` function (and its doc comment) with:

```ts
  /**
   * Acknowledge a paused long poll. The endpoint is deterministic — built from
   * the workflow identifiers, not the engine-supplied href:
   *   POST /api/v1/<domain>/workflows/<flow>/instances/<instanceId>/longpoll/ack
   * The response is commonly empty, so no JSON is parsed on success. A non-2xx
   * is thrown so the QuickRunner can show why the acknowledge was refused.
   */
  async function acknowledgeLongPoll(
    params: z.infer<typeof quickrunAcknowledgeLongPollParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunAcknowledgeLongPollResult>> {
    const base = buildBasePath(params.domain, params.workflowKey)

    const result = await proxyCall(
      {
        method: 'POST',
        runtimePath: `${base}/instances/${params.instanceId}/longpoll/ack`,
        query: params.role ? { role: params.role } : undefined,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status < 200 || result.status >= 300) {
      throw runtimeHttpError(result.data, result.status, 'QuickRunService.acknowledgeLongPoll', traceId)
    }
    return { ok: true, status: result.status }
  }
```

3. Directly above `return {`, add:

```ts
  async function authorize(
    params: z.infer<typeof quickrunAuthorizeParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunAuthorizeResult>> {
    const query: Record<string, string> = {}
    if (params.transitionKey) query.transitionKey = params.transitionKey
    if (params.functionKey) query.functionKey = params.functionKey
    if (params.queryRoles) query.queryRoles = 'true'
    if (params.ack) query.ack = 'true'
    if (params.role) query.role = params.role
    if (params.version) query.version = params.version

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `${instancePath(params.domain, params.workflowKey, params.instanceId)}/functions/authorize`,
        query,
        headers: params.headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    if (result.status === 200 || result.status === 403) {
      let allowed: unknown
      try {
        allowed = (JSON.parse(result.data) as Record<string, unknown> | null)?.allowed
      } catch { /* handled below */ }
      if (typeof allowed === 'boolean') return { allowed, status: result.status }
      if (result.status === 403) {
        // A 403 without a verdict came from somewhere else (e.g. a gateway).
        throw runtimeHttpError(result.data, result.status, 'QuickRunService.authorize', traceId)
      }
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Authorize response has no boolean "allowed" field',
        { source: 'QuickRunService.authorize', layer: 'infrastructure', details: { rawData: result.data.slice(0, 200) } },
        traceId,
      )
    }
    throw runtimeHttpError(result.data, result.status, 'QuickRunService.authorize', traceId)
  }

  async function getHumanTasks(
    params: z.infer<typeof quickrunGetHumanTasksParams>,
    traceId?: string,
  ): Promise<z.infer<typeof quickrunGetHumanTasksResult>> {
    const headers: Record<string, string> = { ...(params.headers ?? {}) }
    if (params.cacheOverride) headers['X-VNext-Cache-Override'] = 'true'

    const result = await proxyCall(
      {
        method: 'GET',
        runtimePath: `/api/v1/${encodeURIComponent(params.domain)}/functions/human-task`,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )

    const parsed = parseJsonResponse<unknown>(result.data, result.status, 'QuickRunService.getHumanTasks', traceId)
    if (!Array.isArray(parsed)) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_INVALID_RESPONSE,
        'Human-task response is not a JSON array',
        { source: 'QuickRunService.getHumanTasks', layer: 'infrastructure', details: { rawData: result.data.slice(0, 200) } },
        traceId,
      )
    }
    return {
      items: parsed,
      truncated: headerValue(result.responseHeaders, 'X-VNext-HumanTask-Truncated')?.toLowerCase() === 'true',
    } as z.infer<typeof quickrunGetHumanTasksResult>
  }
```

4. Add `authorize,` and `getHumanTasks,` to the returned object.

- [ ] **Step 5: Run the service tests**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Register the methods end to end**

`method-registry.ts` — import `quickrunAuthorizeParams, quickrunAuthorizeResult, quickrunGetHumanTasksParams, quickrunGetHumanTasksResult,` and add after the Task 1 entries:

```ts
    'quickrun/authorize': {
      paramsSchema: quickrunAuthorizeParams,
      resultSchema: quickrunAuthorizeResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.authorize(params, traceId),
    },
    'quickrun/getHumanTasks': {
      paramsSchema: quickrunGetHumanTasksParams,
      resultSchema: quickrunGetHumanTasksResult,
      handler: async (params, { quickRunService }, traceId) =>
        quickRunService.getHumanTasks(params, traceId),
    },
```

`policy.ts` — after the Task 1 lines:

```ts
  'quickrun/authorize': 'privileged',
  'quickrun/getHumanTasks': 'privileged',
```

`method-http.ts` — `MethodId`: `| 'quickrun/authorize'` and `| 'quickrun/getHumanTasks'`; metadata:

```ts
  'quickrun/authorize': { verb: 'POST', paramSource: 'json' },
  'quickrun/getHumanTasks': { verb: 'POST', paramSource: 'json' },
```

`quickrun.routes.ts`:

```ts
  app.post('/quickrun/authorize', (c) => helper(c, 'quickrun/authorize', { source: 'json' }));
  app.post('/quickrun/getHumanTasks', (c) => helper(c, 'quickrun/getHumanTasks', { source: 'json' }));
```

- [ ] **Step 7: Add fixtures**

`packages/services-core/test/fixtures/quickrun/authorize.json`:

```json
{
  "params": {
    "domain": "core",
    "workflowKey": "authorization-chain-lab",
    "instanceId": "5d2b0a3c-1e4f-4b6a-9c8d-7e6f5a4b3c2d",
    "transitionKey": "approve",
    "role": "chain.viewer",
    "runtimeUrl": "http://localhost:4201"
  },
  "result": {
    "allowed": false,
    "status": 403
  }
}
```

`getHumanTasks.json`:

```json
{
  "params": {
    "domain": "core",
    "cacheOverride": true,
    "headers": { "role": "ht-approver", "x-roles": "ht-approver" }
  },
  "result": {
    "items": [
      {
        "instanceId": "APP-2026-0001",
        "id": "11111111-2222-3333-4444-555555555555",
        "workflow": "ht-a",
        "title": "Approve application",
        "description": "Level C approval pending",
        "createdAt": "2026-09-20T10:00:00Z"
      }
    ],
    "truncated": false
  }
}
```

- [ ] **Step 8: Update the sorted-names snapshot**

Insert `"quickrun/authorize",` directly after `"quickrun/acknowledgeLongPoll",` and `"quickrun/getHumanTasks",` directly after `"quickrun/getHistory",`.

- [ ] **Step 9: Run contract tests and builds**

Run: `pnpm --filter @vnext-forge-studio/services-core exec vitest run test/quickrun-service.test.ts test/registry-contract.test.ts && pnpm --filter @vnext-forge-studio/app-contracts test`
Expected: PASS.

Run: `pnpm --filter @vnext-forge-studio/services-core build && pnpm --filter @vnext-forge-studio/server build && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: exit 0 (designer-ui still reads `res.data.ok` from the ack; the type is unchanged).

- [ ] **Step 10: Commit**

```bash
git add packages/services-core packages/app-contracts/src/method-http.ts apps/server/src/api/v1/quickrun.routes.ts
git commit -m "feat(quickrun): add authorize and human-task methods, ack with role

quickrun/authorize returns the verdict for 200 and 403; quickrun/getHumanTasks
reads truncation from X-VNext-HumanTask-Truncated; acknowledgeLongPoll takes
the acknowledging role and throws on non-2xx instead of swallowing it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: designer-ui API layer — wrappers, types and current role

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/currentRole.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/currentRole.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunApi.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx` (one line in `IncidentActiveCard`)

**Interfaces:**
- Produces: `currentRoleFromHeaders(headers?: Record<string, string>): string | undefined`, `withRoleHeaders(headers: Record<string, string>, role: string | undefined): Record<string, string>`.
- Types (`quickrun.types.ts`): `TaskHistoryItem`, `TaskHistoryResponse`, `HumanTaskItem`, `HumanTaskListResponse`, `AuthorizeTarget` (`{kind:'transition';transitionKey} | {kind:'function';functionKey} | {kind:'queryRoles'} | {kind:'ack'}`), `AuthorizeResult` (`{ allowed: boolean; status: number }`); `InstanceListItem.metadata.type?: InstanceType | null`.
- `QuickRunApi.ts`: `InstanceScopedParams`, `IncidentPage`, `getIncidents`, `getActiveIncident`, `getTaskHistory`, `authorize`, `getHumanTasks`; `AcknowledgeLongPollParams.role?`; `IncidentEntry` nullables; `InstanceDetailResponse.metadata.type?: InstanceType | null`.

- [ ] **Step 1: Write the failing test**

`packages/designer-ui/src/modules/quick-run/utils/currentRole.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { currentRoleFromHeaders, withRoleHeaders } from './currentRole';

describe('currentRoleFromHeaders', () => {
  it('reads the role header case-insensitively', () => {
    expect(currentRoleFromHeaders({ Role: ' approver ' })).toBe('approver');
  });

  it('falls back to the first x-roles entry', () => {
    expect(currentRoleFromHeaders({ 'X-Roles': ' , viewer, admin' })).toBe('viewer');
  });

  it('returns undefined when neither header carries a value', () => {
    expect(currentRoleFromHeaders(undefined)).toBeUndefined();
    expect(currentRoleFromHeaders({ role: '  ' })).toBeUndefined();
  });
});

describe('withRoleHeaders', () => {
  it('replaces every spelling of role / x-roles with the picked role', () => {
    expect(withRoleHeaders({ Role: 'a', 'x-ROLES': 'a,b', auth: 't' }, 'ht-approver')).toEqual({
      auth: 't',
      role: 'ht-approver',
      'x-roles': 'ht-approver',
    });
  });

  it('leaves the headers alone for an empty role', () => {
    expect(withRoleHeaders({ role: 'a' }, ' ')).toEqual({ role: 'a' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/currentRole.vitest.test.ts`
Expected: FAIL — cannot resolve `./currentRole`.

- [ ] **Step 3: Implement `currentRole.ts`**

```ts
/**
 * The QuickRunner's "current role". The runtime's default caller-role provider
 * reads the `role` header (and `x-roles` for the full set), so the role the
 * user configured in the Headers dialog is the one every call already carries.
 */
function headerLookup(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

export function currentRoleFromHeaders(headers?: Record<string, string>): string | undefined {
  const role = headerLookup(headers, 'role')?.trim();
  if (role) return role;
  const first = headerLookup(headers, 'x-roles')
    ?.split(',')
    .map((r) => r.trim())
    .find((r) => r.length > 0);
  return first || undefined;
}

/** Headers with `role` and `x-roles` replaced by `role` (any existing spelling removed). */
export function withRoleHeaders(headers: Record<string, string>, role: string | undefined): Record<string, string> {
  const trimmed = role?.trim();
  if (!trimmed) return { ...headers };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower !== 'role' && lower !== 'x-roles') out[key] = value;
  }
  out.role = trimmed;
  out['x-roles'] = trimmed;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: Step 2 command. Expected: PASS.

- [ ] **Step 5: Add the response types**

In `quickrun.types.ts`:
- In `InstanceListItem.metadata` change `type?: InstanceType;` to `type?: InstanceType | null;`.
- Append at the end of the file (before `safeViewContent` is fine too):

```ts
/** One row of `…/functions/tasks` (metadata only, StartedAt ascending). */
export interface TaskHistoryItem {
  id: string;
  taskKey: string;
  transitionKey: string;
  fromState: string;
  /** `null` while the owning transition is in progress. */
  toState?: string | null;
  triggerType: string;
  /** waiting | busy | completed | faulted */
  status: string;
  /** unknown | success | failed */
  businessStatus: string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  /** Fault reason on a faulted row; never a stack trace. */
  error?: string | null;
}

export interface TaskHistoryResponse {
  items: TaskHistoryItem[];
}

/** One row of `GET {domain}/functions/human-task`: the ROOT instance, the LEAF's text. */
export interface HumanTaskItem {
  /** Business key of the root (its own id for a SubProcess). */
  instanceId?: string | null;
  /** The root instance's own id — always unique; what Forge opens. */
  id: string;
  workflow?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface HumanTaskListResponse {
  items: HumanTaskItem[];
  /** `X-VNext-HumanTask-Truncated: true` — the runtime capped the list. */
  truncated: boolean;
}

/** The single question an `authorize` call asks. */
export type AuthorizeTarget =
  | { kind: 'transition'; transitionKey: string }
  | { kind: 'function'; functionKey: string }
  | { kind: 'queryRoles' }
  | { kind: 'ack' };

/** `authorize` verdict — the runtime answers 200 (allowed) or 403 (denied), both with a body. */
export interface AuthorizeResult {
  allowed: boolean;
  status: number;
}
```

- [ ] **Step 6: Add the wrappers**

In `QuickRunApi.ts`:

1. Extend the type import from `./types/quickrun.types` with `AuthorizeResult, AuthorizeTarget, HumanTaskListResponse, TaskHistoryResponse,`.

2. Replace `AcknowledgeLongPollParams` and the `acknowledgeLongPoll` doc comment with:

```ts
interface AcknowledgeLongPollParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  /** Which of the caller's roles acknowledges (runtime `?role=`, additive). */
  role?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

/**
 * Acknowledge a paused long poll. The host builds the deterministic endpoint
 * (`/api/v1/<domain>/workflows/<flow>/instances/<id>/longpoll/ack`) from these
 * identifiers. A non-2xx arrives as an `ApiFailure` carrying the runtime body.
 */
```

3. In `IncidentEntry` change `task: string;` → `task?: string | null;`, `errorCode: string;` → `errorCode?: string | null;`, `errorLayer: string;` → `errorLayer?: string | null;`, `boundaryAction: string | null;` → `boundaryAction?: string | null;`, `boundaryLevel: string | null;` → `boundaryLevel?: string | null;`, `traceId: string;` → `traceId?: string | null;`, `resolvedAt: string | null;` → `resolvedAt?: string | null;`.

4. In `InstanceDetailResponse.metadata` change `type?: InstanceType;` to `type?: InstanceType | null;`.

5. Directly after `export async function getInstance(…) { … }` add:

```ts
/** Identifiers every instance-scoped call carries. */
export interface InstanceScopedParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

/** One page of `…/incidents`, newest first. */
export interface IncidentPage {
  hasActiveIncident: boolean;
  items: IncidentEntry[];
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export async function getIncidents(
  params: InstanceScopedParams & { page?: number; pageSize?: number },
): Promise<ApiResponse<IncidentPage>> {
  return callApi({ method: 'quickrun/getIncidents', params });
}

/** `incident: null` means nothing is open any more (runtime 404 `Instance:100037`). */
export async function getActiveIncident(
  params: InstanceScopedParams,
): Promise<ApiResponse<{ incident: IncidentEntry | null }>> {
  return callApi({ method: 'quickrun/getActiveIncident', params });
}

export async function getTaskHistory(params: InstanceScopedParams): Promise<ApiResponse<TaskHistoryResponse>> {
  return callApi({ method: 'quickrun/getTaskHistory', params });
}

export interface AuthorizeParams extends InstanceScopedParams {
  target: AuthorizeTarget;
  role?: string;
  version?: string;
}

/** Ask the runtime's `authorize` oracle one question. 200 and 403 both resolve as data. */
export async function authorize(params: AuthorizeParams): Promise<ApiResponse<AuthorizeResult>> {
  const { target, ...rest } = params;
  const selector =
    target.kind === 'transition'
      ? { transitionKey: target.transitionKey }
      : target.kind === 'function'
        ? { functionKey: target.functionKey }
        : target.kind === 'queryRoles'
          ? { queryRoles: true as const }
          : { ack: true as const };
  return callApi({ method: 'quickrun/authorize', params: { ...rest, ...selector } });
}

export interface GetHumanTasksParams {
  domain: string;
  /** Sends `X-VNext-Cache-Override: true`. */
  cacheOverride?: boolean;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function getHumanTasks(params: GetHumanTasksParams): Promise<ApiResponse<HumanTaskListResponse>> {
  return callApi({ method: 'quickrun/getHumanTasks', params });
}
```

6. In `InstanceDashboard.tsx` `IncidentActiveCard`, change `void navigator.clipboard.writeText(entry.traceId).then(() => {` to `void navigator.clipboard.writeText(entry.traceId ?? '').then(() => {` (the only non-null use; Task 7 replaces this component).

- [ ] **Step 7: Type-check and run the quick-run suite**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run`
Expected: exit 0; all quick-run tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): client wrappers for incidents, authorize, human-task, task history

Also reads the current role from headers and lets instance type be null.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Interaction machine, Passive as terminal, countdown formatting

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/hooks/interactionMachine.ts`
- Test: `packages/designer-ui/src/modules/quick-run/hooks/interactionMachine.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/utils/countdown.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/countdown.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/utils/instanceStatus.ts`, `utils/instanceStatus.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/hooks/shouldFetchView.ts`, `hooks/shouldFetchView.vitest.test.ts`

**Interfaces:**
- Produces: `stopsPolling(status: InstanceStatus): boolean` (A, C, F, P); `formatCountdown(ms: number): string`; `DEFAULT_FALLBACK_TIMEOUT_SECONDS = 60`; `InteractionPhase`, `AwaitingAckPhase`, `InteractionEvent`, `INITIAL_INTERACTION`, `interactionReducer(phase, event): InteractionPhase`, `remainingMs(phase: AwaitingAckPhase, nowMs: number): number`.
- `shouldFetchView` status gate accepts `P`.

- [ ] **Step 1: Write the failing tests**

`hooks/interactionMachine.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  INITIAL_INTERACTION,
  interactionReducer,
  remainingMs,
  type AwaitingAckPhase,
  type InteractionEvent,
  type InteractionPhase,
} from './interactionMachine';

const run = (events: InteractionEvent[], start: InteractionPhase = INITIAL_INTERACTION) =>
  events.reduce(interactionReducer, start);

const paused = (nowMs = 1_000, fallbackTimeoutSeconds?: number): InteractionEvent => ({
  type: 'STATE_RECEIVED',
  instanceId: 'i1',
  status: 'B',
  interaction: { terminateLongPoll: true, ack: { href: '/ack' }, ...(fallbackTimeoutSeconds !== undefined ? { fallbackTimeoutSeconds } : {}) },
  nowMs,
});

describe('interactionReducer', () => {
  it('starts polling', () => {
    expect(run([{ type: 'POLL_STARTED', instanceId: 'i1' }])).toEqual({ kind: 'polling', instanceId: 'i1' });
  });

  it('a pending interaction opens the ack window with the runtime fallback', () => {
    expect(run([{ type: 'POLL_STARTED', instanceId: 'i1' }, paused(1_000, 30)])).toEqual({
      kind: 'awaitingAck',
      instanceId: 'i1',
      deadlineMs: 31_000,
      fallbackTimeoutSeconds: 30,
      acking: false,
      waitingForFallback: false,
      error: null,
    });
  });

  it('defaults the fallback window to 60 s and ignores non-positive values', () => {
    expect((run([paused(0)]) as AwaitingAckPhase).deadlineMs).toBe(60_000);
    expect((run([paused(0, 0)]) as AwaitingAckPhase).deadlineMs).toBe(60_000);
  });

  it('a re-poll while awaiting keeps the original deadline', () => {
    const phase = run([paused(1_000, 30), { type: 'POLL_STARTED', instanceId: 'i1' }, paused(20_000, 30)]);
    expect((phase as AwaitingAckPhase).deadlineMs).toBe(31_000);
  });

  it('a response without interaction ends the wait (someone else acked or the fallback fired)', () => {
    expect(run([paused(), { type: 'STATE_RECEIVED', instanceId: 'i1', status: 'A', nowMs: 2_000 }])).toEqual({ kind: 'idle' });
    expect(run([paused(), { type: 'STATE_RECEIVED', instanceId: 'i1', status: 'B', nowMs: 2_000 }])).toEqual({
      kind: 'polling',
      instanceId: 'i1',
    });
  });

  it('treats A, C, F and P as stop statuses', () => {
    for (const status of ['A', 'C', 'F', 'P'] as const) {
      expect(run([{ type: 'STATE_RECEIVED', instanceId: 'i1', status, nowMs: 0 }])).toEqual({ kind: 'idle' });
    }
  });

  it('acknowledge success resumes', () => {
    expect(run([paused(), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'ACK_SUCCEEDED', instanceId: 'i1' }])).toEqual({
      kind: 'resuming',
      instanceId: 'i1',
      reason: 'ack',
    });
  });

  it('acknowledge failure stays awaiting with the error', () => {
    const error = { code: 'RUNTIME_EXECUTION_FAILED', message: 'Runtime returned HTTP 403' };
    const phase = run([paused(), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'ACK_FAILED', instanceId: 'i1', error }]);
    expect(phase).toMatchObject({ kind: 'awaitingAck', acking: false, error });
  });

  it('a new ack attempt clears the previous error', () => {
    const error = { code: 'X', message: 'm' };
    const phase = run([paused(), { type: 'ACK_FAILED', instanceId: 'i1', error }, { type: 'ACK_REQUESTED', instanceId: 'i1' }]);
    expect(phase).toMatchObject({ acking: true, error: null });
  });

  it('wait for fallback is remembered', () => {
    expect(run([paused(), { type: 'WAIT_FOR_FALLBACK', instanceId: 'i1' }])).toMatchObject({ waitingForFallback: true });
  });

  it('the countdown resumes at the deadline, not before', () => {
    expect(run([paused(1_000, 10), { type: 'TICK', nowMs: 10_999 }])).toMatchObject({ kind: 'awaitingAck' });
    expect(run([paused(1_000, 10), { type: 'TICK', nowMs: 11_000 }])).toEqual({
      kind: 'resuming',
      instanceId: 'i1',
      reason: 'fallback',
    });
  });

  it('does not resume on the deadline while an acknowledge is in flight', () => {
    expect(run([paused(1_000, 10), { type: 'ACK_REQUESTED', instanceId: 'i1' }, { type: 'TICK', nowMs: 20_000 }])).toMatchObject({
      kind: 'awaitingAck',
      acking: true,
    });
  });

  it('ignores ack events for another instance or outside the window', () => {
    expect(run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'other' }])).toMatchObject({ kind: 'awaitingAck' });
    expect(run([{ type: 'ACK_SUCCEEDED', instanceId: 'i1' }])).toEqual({ kind: 'idle' });
  });

  it('resuming becomes polling on the next poll', () => {
    const phase = run([paused(), { type: 'ACK_SUCCEEDED', instanceId: 'i1' }, { type: 'POLL_STARTED', instanceId: 'i1' }]);
    expect(phase).toEqual({ kind: 'polling', instanceId: 'i1' });
  });

  it('reset returns to idle', () => {
    expect(run([paused(), { type: 'RESET' }])).toEqual({ kind: 'idle' });
  });

  it('remainingMs never goes negative', () => {
    const phase = run([paused(1_000, 10)]) as AwaitingAckPhase;
    expect(remainingMs(phase, 6_000)).toBe(5_000);
    expect(remainingMs(phase, 99_000)).toBe(0);
  });
});
```

`utils/countdown.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  it.each([
    [0, '0s'],
    [-5, '0s'],
    [Number.NaN, '0s'],
    [500, '1s'],
    [45_000, '45s'],
    [61_000, '1m 1s'],
    [3_720_000, '1h 2m'],
    [90_000_000, '1d 1h'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
```

Append to `utils/instanceStatus.vitest.test.ts` (extend the import with `stopsPolling`):

```ts
describe('stopsPolling', () => {
  it('stops on A, C, F and Passive; keeps polling on B', () => {
    expect(['A', 'C', 'F', 'P'].every((s) => stopsPolling(s as 'A'))).toBe(true);
    expect(stopsPolling('B')).toBe(false);
  });
});
```

Append to `hooks/shouldFetchView.vitest.test.ts` inside the `describe`:

```ts
  it('applyStatusGate: true accepts Passive (P) like a terminal status', () => {
    expect(shouldFetchView({ ...withView, status: 'P' }, { applyStatusGate: true })).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/hooks/interactionMachine.vitest.test.ts src/modules/quick-run/utils/countdown.vitest.test.ts src/modules/quick-run/utils/instanceStatus.vitest.test.ts src/modules/quick-run/hooks/shouldFetchView.vitest.test.ts`
Expected: FAIL — missing modules / `stopsPolling` not exported / Passive gate returns false.

- [ ] **Step 3: Implement**

`utils/countdown.ts`:

```ts
/**
 * Human countdown: `45s`, `1m 1s`, `1h 2m`, `1d 1h`. Rounds UP to the next
 * second so a positive remainder never reads `0s`.
 */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const total = Math.ceil(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
```

Append to `utils/instanceStatus.ts`:

```ts
/**
 * The poll loop stops on every status except Busy: Active waits for the user,
 * Completed / Faulted / Passive are terminal.
 */
export function stopsPolling(s: InstanceStatus): boolean {
  return s !== 'B';
}
```

In `hooks/shouldFetchView.ts` replace the last line of `shouldFetchView` with:

```ts
  const status = effectiveState.status;
  return status === 'A' || status === 'C' || status === 'P' || !!options.terminate;
```

and in its doc comment replace "status `A`/`C`" with "status `A`/`C`/`P`".

`hooks/interactionMachine.ts`:

```ts
import type { RuntimeErrorLike } from '../components/RuntimeErrorBanner';
import type { InstanceStatus, InteractionSignal } from '../types/quickrun.types';
import { stopsPolling } from '../utils/instanceStatus';

/**
 * Long-poll interaction (`interaction.longPoll.terminate: true`), spec D3.
 *
 * The runtime pauses after the triggering transition and keeps the instance
 * `B` until the client acknowledges or `fallbackTimeoutSeconds` elapses; the
 * state function carries `interaction` only while an ack is pending. The
 * client stops polling, shows the view and a countdown, and offers
 * Acknowledge / Wait for fallback. After a successful ack or the countdown's
 * expiry it must poll again (`resuming` → the next `POLL_STARTED`).
 *
 *   idle ─POLL_STARTED→ polling ─STATE_RECEIVED(pending)→ awaitingAck
 *   awaitingAck ─ACK_SUCCEEDED | TICK≥deadline→ resuming ─POLL_STARTED→ polling
 */

export const DEFAULT_FALLBACK_TIMEOUT_SECONDS = 60;

export type AwaitingAckPhase = {
  kind: 'awaitingAck';
  instanceId: string;
  /** Epoch ms at which the runtime's fallback resumes the pipeline. */
  deadlineMs: number;
  fallbackTimeoutSeconds: number;
  /** An acknowledge request is in flight. */
  acking: boolean;
  /** The user chose "Wait for fallback". */
  waitingForFallback: boolean;
  /** Last acknowledge failure, shown until the next attempt. */
  error: RuntimeErrorLike | null;
};

export type InteractionPhase =
  | { kind: 'idle' }
  | { kind: 'polling'; instanceId: string }
  | AwaitingAckPhase
  | { kind: 'resuming'; instanceId: string; reason: 'ack' | 'fallback' };

export type InteractionEvent =
  | { type: 'POLL_STARTED'; instanceId: string }
  | {
      type: 'STATE_RECEIVED';
      instanceId: string;
      status: InstanceStatus;
      interaction?: InteractionSignal;
      nowMs: number;
    }
  | { type: 'ACK_REQUESTED'; instanceId: string }
  | { type: 'ACK_SUCCEEDED'; instanceId: string }
  | { type: 'ACK_FAILED'; instanceId: string; error: RuntimeErrorLike }
  | { type: 'WAIT_FOR_FALLBACK'; instanceId: string }
  | { type: 'TICK'; nowMs: number }
  | { type: 'RESET' };

export const INITIAL_INTERACTION: InteractionPhase = { kind: 'idle' };

function fallbackSeconds(signal: InteractionSignal | undefined): number {
  const s = signal?.fallbackTimeoutSeconds;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : DEFAULT_FALLBACK_TIMEOUT_SECONDS;
}

function awaitingFor(phase: InteractionPhase, instanceId: string): AwaitingAckPhase | null {
  return phase.kind === 'awaitingAck' && phase.instanceId === instanceId ? phase : null;
}

export function interactionReducer(phase: InteractionPhase, event: InteractionEvent): InteractionPhase {
  switch (event.type) {
    case 'RESET':
      return INITIAL_INTERACTION;

    case 'POLL_STARTED':
      // A re-read while an ack is pending keeps the window; the response decides.
      return awaitingFor(phase, event.instanceId) ?? { kind: 'polling', instanceId: event.instanceId };

    case 'STATE_RECEIVED': {
      if (event.interaction?.terminateLongPoll === true) {
        const existing = awaitingFor(phase, event.instanceId);
        if (existing) return existing;
        const seconds = fallbackSeconds(event.interaction);
        return {
          kind: 'awaitingAck',
          instanceId: event.instanceId,
          deadlineMs: event.nowMs + seconds * 1000,
          fallbackTimeoutSeconds: seconds,
          acking: false,
          waitingForFallback: false,
          error: null,
        };
      }
      return stopsPolling(event.status) ? INITIAL_INTERACTION : { kind: 'polling', instanceId: event.instanceId };
    }

    case 'ACK_REQUESTED': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, acking: true, error: null } : phase;
    }

    case 'ACK_SUCCEEDED':
      return awaitingFor(phase, event.instanceId)
        ? { kind: 'resuming', instanceId: event.instanceId, reason: 'ack' }
        : phase;

    case 'ACK_FAILED': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, acking: false, error: event.error } : phase;
    }

    case 'WAIT_FOR_FALLBACK': {
      const awaiting = awaitingFor(phase, event.instanceId);
      return awaiting ? { ...awaiting, waitingForFallback: true } : phase;
    }

    case 'TICK':
      if (phase.kind === 'awaitingAck' && !phase.acking && event.nowMs >= phase.deadlineMs) {
        return { kind: 'resuming', instanceId: phase.instanceId, reason: 'fallback' };
      }
      return phase;
  }
}

export function remainingMs(phase: AwaitingAckPhase, nowMs: number): number {
  return Math.max(0, phase.deadlineMs - nowMs);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: Step 2 command. Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): pure long-poll interaction machine; Passive stops polling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Interaction flow wired into polling and the dashboard

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts`, `store/quickRunStore.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/hooks/useQuickRunPolling.ts`
- Create: `packages/designer-ui/src/modules/quick-run/hooks/useNow.ts`, `hooks/useInteractionDriver.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/InteractionBanner.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/InteractionBanner.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/AvailableTransitions.tsx`, `components/AvailableTransitions.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx`

**Interfaces:**
- Consumes: `interactionReducer`, `INITIAL_INTERACTION`, `AwaitingAckPhase`, `remainingMs` (Task 4); `formatCountdown` (Task 4); `stopsPolling` (Task 4); `currentRoleFromHeaders` (Task 3); `QuickRunApi.acknowledgeLongPoll({ …, role })` (Task 3).
- Produces: store `interaction: InteractionPhase`, `dispatchInteraction(event: InteractionEvent): void` (replaces `longPollAck` / `setLongPollAck`); `useQuickRunPolling().acknowledgeInteraction(params: { domain; workflowKey; instanceId; headers?; runtimeUrl? }): Promise<void>`; `useNow(intervalMs: number | null): number`; `useInteractionDriver(resume: (instanceId: string) => void): number`; `InteractionBanner` props `{ phase: AwaitingAckPhase; nowMs: number; onAcknowledge(): void; onWaitForFallback(): void }`; `AvailableTransitions` prop `lockedReason?: string`.

- [ ] **Step 1: Write the failing tests**

Append to `store/quickRunStore.vitest.test.ts`:

```ts
describe('useQuickRunStore — interaction', () => {
  beforeEach(() => {
    useQuickRunStore.setState({ tabs: [], activeTabId: null, interaction: { kind: 'idle' } });
  });

  it('dispatchInteraction runs the reducer', () => {
    useQuickRunStore.getState().dispatchInteraction({
      type: 'STATE_RECEIVED',
      instanceId: 'i1',
      status: 'B',
      interaction: { terminateLongPoll: true, fallbackTimeoutSeconds: 30 },
      nowMs: 1_000,
    });
    expect(useQuickRunStore.getState().interaction).toMatchObject({ kind: 'awaitingAck', instanceId: 'i1', deadlineMs: 31_000 });
  });

  it('switching instance drops a pending acknowledge', () => {
    useQuickRunStore.getState().setActiveTab('i1');
    useQuickRunStore.getState().dispatchInteraction({
      type: 'STATE_RECEIVED',
      instanceId: 'i1',
      status: 'B',
      interaction: { terminateLongPoll: true },
      nowMs: 0,
    });
    useQuickRunStore.getState().setActiveTab('i2');
    expect(useQuickRunStore.getState().interaction).toEqual({ kind: 'idle' });
  });
});
```

`components/InteractionBanner.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AwaitingAckPhase } from '../hooks/interactionMachine';
import { InteractionBanner } from './InteractionBanner';

const PHASE: AwaitingAckPhase = {
  kind: 'awaitingAck',
  instanceId: 'i1',
  deadlineMs: 60_000,
  fallbackTimeoutSeconds: 60,
  acking: false,
  waitingForFallback: false,
  error: null,
};

const render = (phase: Partial<AwaitingAckPhase> = {}, nowMs = 15_000) =>
  renderToStaticMarkup(
    createElement(InteractionBanner, {
      phase: { ...PHASE, ...phase },
      nowMs,
      onAcknowledge: () => undefined,
      onWaitForFallback: () => undefined,
    }),
  );

describe('InteractionBanner', () => {
  it('offers Acknowledge and Wait for fallback with the countdown', () => {
    const html = render();
    expect(html).toContain('Awaiting acknowledge');
    expect(html).toContain('Acknowledge</button>');
    expect(html).toContain('Wait for fallback</button>');
    expect(html).toContain('resumes in 45s');
  });

  it('hides Wait for fallback once chosen', () => {
    const html = render({ waitingForFallback: true });
    expect(html).not.toContain('Wait for fallback</button>');
    expect(html).toContain('Waiting for the fallback');
  });

  it('disables the buttons while acknowledging', () => {
    const html = render({ acking: true });
    expect(html).toContain('Acknowledging…');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Acknowledging…<\/button>/);
  });

  it('shows the runtime error of a refused acknowledge', () => {
    const html = render({
      error: { code: 'RUNTIME_EXECUTION_FAILED', message: 'Runtime returned HTTP 403', details: { httpStatus: 403 } },
    });
    expect(html).toContain('Acknowledge failed');
    expect(html).toContain('HTTP 403');
  });

  it('says it is resuming once the deadline passed', () => {
    expect(render({}, 70_000)).toContain('resuming…');
  });
});
```

Append to `components/AvailableTransitions.vitest.test.tsx`:

```tsx
describe('AvailableTransitions — locked while awaiting acknowledge', () => {
  it('disables every button and shows the reason', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [{ name: 'approve', href: '/t/approve', kind: 'stateTransition' }],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: true,
        onManualClick: noop,
        disabled: false,
        lockedReason: 'Awaiting acknowledge',
      }),
    );
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.includes('disabled=""'))).toBe(true);
    expect(html).toContain('Awaiting acknowledge');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/store/quickRunStore.vitest.test.ts src/modules/quick-run/components/InteractionBanner.vitest.test.tsx src/modules/quick-run/components/AvailableTransitions.vitest.test.tsx`
Expected: FAIL — `dispatchInteraction` is not a function; `./InteractionBanner` missing; buttons not disabled.

- [ ] **Step 3: Store slice**

In `quickRunStore.ts`:
- Add `import { INITIAL_INTERACTION, interactionReducer, type InteractionEvent, type InteractionPhase } from '../hooks/interactionMachine';`.
- Replace the `longPollAck` field and its doc comment with:

```ts
  /**
   * Long-poll interaction phase of the active instance (spec D3) — see
   * `hooks/interactionMachine.ts`. Reset with the instance-scoped caches.
   */
  interaction: InteractionPhase;
```

- Replace `setLongPollAck: (status: 'acknowledging' | 'acknowledged' | null) => void;` with `dispatchInteraction: (event: InteractionEvent) => void;`.
- In the initial state replace `longPollAck: null,` with `interaction: INITIAL_INTERACTION,`.
- In `setWorkflowContext` delete the `longPollAck: null,` line (the reset below covers it).
- Replace `setLongPollAck: (longPollAck) => set({ longPollAck }),` with:

```ts
  dispatchInteraction: (event) => set((state) => ({ interaction: interactionReducer(state.interaction, event) })),
```

- In `resetInstanceScopedCaches` add `interaction: INITIAL_INTERACTION,` to the object.

- [ ] **Step 4: Polling hook**

In `useQuickRunPolling.ts`:

1. Imports: delete `import { createLogger } from '../../../lib/logger/createLogger';` and `const logger = createLogger('quick-run-polling');`; add:

```ts
import { currentRoleFromHeaders } from '../utils/currentRole';
import { stopsPolling } from '../utils/instanceStatus';
```

2. In `pollState`'s destructure replace `setLongPollAck,` with `dispatchInteraction,`, and replace

```ts
      // Clear any prior long-poll acknowledge note before a new round.
      setLongPollAck(null);
```

with

```ts
      // A poll while an acknowledge is pending keeps that window (the
      // reducer decides); any other phase becomes `polling`.
      dispatchInteraction({ type: 'POLL_STARTED', instanceId: params.instanceId });
```

3. Replace the block from `// The engine can ask the client to stop the long-poll loop` through `const shouldStop = isTerminalStatus || terminate;` with:

```ts
          // Every full response feeds the interaction machine. An
          // `interaction` block means the runtime paused after the triggering
          // transition and waits for an acknowledge (or its fallback). The
          // loop stops either way; resuming is `useInteractionDriver`'s job.
          dispatchInteraction({
            type: 'STATE_RECEIVED',
            instanceId: params.instanceId,
            status: stateData.status,
            interaction: stateData.interaction,
            nowMs: Date.now(),
          });
          const terminate = stateData.interaction?.terminateLongPoll === true;
          const shouldStop = stopsPolling(stateData.status) || terminate;
```

4. In the `if (shouldStop)` branch replace

```ts
            const viewSource = resolveStateViewSource(stateData);
            const canRenderView =
              !!viewSource &&
              (stateData.status === 'A' || stateData.status === 'C' || terminate);
```

with `const canRenderView = shouldFetchView(stateData, { applyStatusGate: true, terminate });`.

5. Delete the whole `// Silently acknowledge the terminated long poll …` comment and the `if (terminate && stateData.interaction?.ack) { … }` block that follows it (up to, not including, `return stateData;`).

6. Replace the comment in the `} else {` failure branch (the four lines starting `// Surface the engine-side failure (e.g. 403 with`) with:

```ts
          // Surface the engine-side failure so the user sees why polling
          // stopped instead of staring at a quietly empty panel.
```

7. In `fetchInstanceState`: add `dispatchInteraction,` to the destructure; directly after `setEtag('state', extractEtag(stateData));` add

```ts
        dispatchInteraction({
          type: 'STATE_RECEIVED',
          instanceId: params.instanceId,
          status: stateData.status,
          interaction: stateData.interaction,
          nowMs: Date.now(),
        });
        const terminate = stateData.interaction?.terminateLongPoll === true;
```

replace

```ts
        const viewSource = resolveStateViewSource(stateData);
        const canRenderView = !!viewSource && (stateData.status === 'A' || stateData.status === 'C');
```

with `const canRenderView = shouldFetchView(stateData, { applyStatusGate: true, terminate });`, and replace the trailing comment + call

```ts
        // Also refreshes Data on this tick — folded into the same shared
        // step the poll loop uses. `terminate` is always false here: this
        // single-shot tab-switch fetch has no long-poll interaction concept.
```

(keep the remaining three comment lines about `pollingInstanceId`) with

```ts
        // Also refreshes Data on this tick — folded into the same shared
        // step the poll loop uses. A paused instance (`terminate`) still
        // shows its view, exactly as the poll loop's stop tick does.
```

and change the call to `void refreshViewAndData(params, stateData, { terminate, includeData: true }, controller.signal);`.

8. Directly above `return { pollState, fetchInstanceState, cancelPolling, refreshView };` add:

```ts
  /**
   * Acknowledge the paused long poll of `params.instanceId` with the current
   * role. Outcome goes to the interaction machine: success → `resuming`
   * (the driver polls again), failure → stays awaiting with the runtime error.
   */
  const acknowledgeInteraction = useCallback(
    async (params: {
      domain: string;
      workflowKey: string;
      instanceId: string;
      headers?: Record<string, string>;
      runtimeUrl?: string;
    }) => {
      const { dispatchInteraction } = store.getState();
      dispatchInteraction({ type: 'ACK_REQUESTED', instanceId: params.instanceId });
      const role = currentRoleFromHeaders(params.headers);
      try {
        const res = await QuickRunApi.acknowledgeLongPoll({ ...params, ...(role ? { role } : {}) });
        if (res.success) {
          dispatchInteraction({ type: 'ACK_SUCCEEDED', instanceId: params.instanceId });
        } else {
          dispatchInteraction({ type: 'ACK_FAILED', instanceId: params.instanceId, error: res.error });
        }
      } catch (err) {
        dispatchInteraction({
          type: 'ACK_FAILED',
          instanceId: params.instanceId,
          error: { code: 'THROWN', message: err instanceof Error ? err.message : String(err) },
        });
      }
    },
    [],
  );
```

and change the return to `return { pollState, fetchInstanceState, cancelPolling, refreshView, acknowledgeInteraction };`.

9. Delete the module-level `async function acknowledgeLongPoll(…) { … }` and its doc comment at the bottom of the file.

- [ ] **Step 5: Clock and driver hooks**

`hooks/useNow.ts`:

```ts
import { useEffect, useState } from 'react';

/** Epoch ms, refreshed every `intervalMs`; frozen while `intervalMs` is null. */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

`hooks/useInteractionDriver.ts`:

```ts
import { useEffect, useRef } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import { useNow } from './useNow';

/**
 * Drives the interaction machine's clock: ticks once a second while an ack is
 * pending (so the countdown expires into `resuming`) and calls `resume` when
 * the machine enters `resuming` — after a successful ack or the fallback. The
 * caller's `resume` starts a new poll round, whose `POLL_STARTED` moves the
 * machine back to `polling`. Returns the clock for the countdown display.
 */
export function useInteractionDriver(resume: (instanceId: string) => void): number {
  const interaction = useQuickRunStore((s) => s.interaction);
  const dispatchInteraction = useQuickRunStore((s) => s.dispatchInteraction);
  const awaiting = interaction.kind === 'awaitingAck';
  const nowMs = useNow(awaiting ? 1000 : null);

  useEffect(() => {
    if (awaiting) dispatchInteraction({ type: 'TICK', nowMs });
  }, [awaiting, nowMs, dispatchInteraction]);

  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  useEffect(() => {
    if (interaction.kind === 'resuming') resumeRef.current(interaction.instanceId);
  }, [interaction]);

  return nowMs;
}
```

- [ ] **Step 6: InteractionBanner**

`components/InteractionBanner.tsx`:

```tsx
import { remainingMs, type AwaitingAckPhase } from '../hooks/interactionMachine';
import { formatCountdown } from '../utils/countdown';
import { RuntimeErrorBanner } from './RuntimeErrorBanner';

export interface InteractionBannerProps {
  phase: AwaitingAckPhase;
  nowMs: number;
  onAcknowledge: () => void;
  onWaitForFallback: () => void;
}

const BUTTON =
  'rounded border px-2 py-1 text-[10px] font-medium disabled:opacity-50';

/**
 * Long-poll interaction window (spec D3): the runtime paused after the
 * triggering transition; the user acknowledges now or lets the fallback fire.
 */
export function InteractionBanner({ phase, nowMs, onAcknowledge, onWaitForFallback }: InteractionBannerProps) {
  const left = remainingMs(phase, nowMs);
  const lead = phase.waitingForFallback
    ? 'Waiting for the fallback'
    : 'Acknowledge to continue now, or wait for the fallback';
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded border border-warning-border bg-warning-surface px-3 py-2 text-[11px] text-warning-text"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Awaiting acknowledge</span>
        <span className="text-[var(--vscode-foreground)]">
          The runtime paused after this transition. {lead} —{' '}
          {left > 0 ? `resumes in ${formatCountdown(left)}` : 'resuming…'}.
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`${BUTTON} border-[var(--vscode-button-background)] bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]`}
            onClick={onAcknowledge}
            disabled={phase.acking}
          >
            {phase.acking ? 'Acknowledging…' : 'Acknowledge'}
          </button>
          {!phase.waitingForFallback && (
            <button
              type="button"
              className={`${BUTTON} border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]`}
              onClick={onWaitForFallback}
              disabled={phase.acking}
            >
              Wait for fallback
            </button>
          )}
        </div>
      </div>
      {phase.error && <RuntimeErrorBanner title="Acknowledge failed" error={phase.error} />}
    </section>
  );
}
```

- [ ] **Step 7: AvailableTransitions lock**

In `AvailableTransitions.tsx`:
- Add to `AvailableTransitionsProps`:

```ts
  /**
   * When set, every button is disabled and this reason is shown next to the
   * section title (e.g. "Awaiting acknowledge" while a long poll is paused).
   */
  lockedReason?: string;
```

- Add `lockedReason,` to the destructured props and, right after the `grouped` memo, `const locked = disabled || !!lockedReason;`.
- Replace `<p className="text-xs font-semibold uppercase text-muted-text">Available Transitions</p>` with:

```tsx
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase text-muted-text">Available Transitions</p>
        {lockedReason && (
          <span className="rounded border border-warning-border bg-warning-surface px-1.5 py-0.5 text-[10px] font-medium text-warning-text">
            {lockedReason}
          </span>
        )}
      </div>
```

- Change `disabled={disabled}` to `disabled={locked}` on both the transition `<button>` and the `+ Manual` button.

- [ ] **Step 8: Dashboard wiring**

In `InstanceDashboard.tsx`:
- Imports: add `import { useInteractionDriver } from '../hooks/useInteractionDriver';` and `import { InteractionBanner } from './InteractionBanner';`.
- Replace `const longPollAck = useQuickRunStore((s) => s.longPollAck);` with:

```ts
  const interaction = useQuickRunStore((s) => s.interaction);
  const dispatchInteraction = useQuickRunStore((s) => s.dispatchInteraction);
```

- Replace `const { pollState, refreshView } = useQuickRunPolling(pollingConfig);` (the one inside `InstanceDashboard`, line ~71) with `const { pollState, refreshView, acknowledgeInteraction } = useQuickRunPolling(pollingConfig);`.
- Directly after the function-catalog `useEffect(…)` (before `const handleTransitionClick`), insert:

```ts
  /** Headers for interaction/authorize calls — the shared Quick Run merge rule. */
  const liveHeaders = useCallback(
    () => mergeQuickRunHeaders(configRef.current, sessionHeaders, undefined, toolWideHeaders),
    [configRef, sessionHeaders, toolWideHeaders],
  );

  const resumeAfterInteraction = useCallback(
    (instanceId: string) => {
      if (instanceId !== useQuickRunStore.getState().activeTabId || !domain || !workflowKey) {
        dispatchInteraction({ type: 'RESET' });
        return;
      }
      void pollState({ domain, workflowKey, instanceId, headers: liveHeaders(), runtimeUrl: environmentUrl });
    },
    [domain, workflowKey, environmentUrl, liveHeaders, pollState, dispatchInteraction],
  );

  const interactionNow = useInteractionDriver(resumeAfterInteraction);
  const awaitingAck =
    interaction.kind === 'awaitingAck' && interaction.instanceId === activeTabId ? interaction : null;

  const handleAcknowledge = useCallback(() => {
    if (!awaitingAck || !domain || !workflowKey) return;
    void acknowledgeInteraction({
      domain,
      workflowKey,
      instanceId: awaitingAck.instanceId,
      headers: liveHeaders(),
      runtimeUrl: environmentUrl,
    });
  }, [awaitingAck, domain, workflowKey, liveHeaders, environmentUrl, acknowledgeInteraction]);

  const handleWaitForFallback = useCallback(() => {
    if (awaitingAck) dispatchInteraction({ type: 'WAIT_FOR_FALLBACK', instanceId: awaitingAck.instanceId });
  }, [awaitingAck, dispatchInteraction]);
```

- Replace the whole `{/* Long-poll acknowledge note … */}` comment and `{longPollAck && ( … )}` block with:

```tsx
      {/* Long-poll interaction window (D3) — polling is stopped until the
          user acknowledges or the runtime's fallback fires. */}
      {awaitingAck && (
        <InteractionBanner
          phase={awaitingAck}
          nowMs={interactionNow}
          onAcknowledge={handleAcknowledge}
          onWaitForFallback={handleWaitForFallback}
        />
      )}
```

- On `<AvailableTransitions … />` add `lockedReason={awaitingAck ? 'Awaiting acknowledge' : undefined}`.

- [ ] **Step 9: Run tests and type-check**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run && pnpm --filter @vnext-forge-studio/designer-ui build`
Expected: PASS; exit 0. Then `grep -rn "longPollAck\|setLongPollAck" packages/designer-ui/src` → no output.

- [ ] **Step 10: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): acknowledge or wait for fallback on paused long polls

Polling stops on interaction.terminateLongPoll, the view stays visible with a
countdown, Acknowledge sends the current role and surfaces refusals, and
polling resumes after the ack or the fallback. Transitions are locked while
awaiting.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: State surface — timeout chip, scheduled countdown, annotations

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/utils/countdown.ts`, `utils/countdown.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/AnnotationChips.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/components/StateTimeoutChip.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/StateTimeoutChip.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/AvailableTransitions.tsx`, `components/AvailableTransitions.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx`

**Interfaces:**
- Consumes: `formatCountdown` (Task 4), `useNow` (Task 5), `StateTimeout` type (Phase A).
- Produces: `scheduleCountdownLabel(executeAtUtc: string, nowMs: number): string | null` (`'in 4m 10s'` | `'Settling…'` | `null` for an invalid date); `AnnotationChips({ annotations?, className? })`; `StateTimeoutChip({ timeout?, nowMs })`; `AvailableTransitions` prop `nowMs?: number`.

- [ ] **Step 1: Write the failing tests**

Append to `utils/countdown.vitest.test.ts` (extend the import with `scheduleCountdownLabel`):

```ts
describe('scheduleCountdownLabel', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  it('counts down to a future instant', () => {
    expect(scheduleCountdownLabel('2026-09-30T12:04:10Z', now)).toBe('in 4m 10s');
  });
  it('says Settling… once the instant has passed', () => {
    expect(scheduleCountdownLabel('2026-09-30T11:59:00Z', now)).toBe('Settling…');
    expect(scheduleCountdownLabel('2026-09-30T12:00:00Z', now)).toBe('Settling…');
  });
  it('returns null for an unparseable instant', () => {
    expect(scheduleCountdownLabel('not-a-date', now)).toBeNull();
  });
});
```

`components/StateTimeoutChip.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateTimeoutChip } from './StateTimeoutChip';

const NOW = Date.parse('2026-09-30T12:00:00Z');

describe('StateTimeoutChip', () => {
  it('renders nothing without a timeout', () => {
    expect(renderToStaticMarkup(createElement(StateTimeoutChip, { nowMs: NOW }))).toBe('');
  });

  it('shows key → target, the countdown and annotations', () => {
    const html = renderToStaticMarkup(
      createElement(StateTimeoutChip, {
        nowMs: NOW,
        timeout: {
          key: 'expire',
          target: 'expired',
          executeAtUtc: '2026-09-30T12:01:00Z',
          annotations: { 'ui/severity': 'warning' },
        },
      }),
    );
    expect(html).toContain('expire');
    expect(html).toContain('expired');
    expect(html).toContain('in 1m 0s');
    expect(html).toContain('ui/severity');
    expect(html).toContain('warning');
  });

  it('says Settling… when the timeout is due', () => {
    const html = renderToStaticMarkup(
      createElement(StateTimeoutChip, {
        nowMs: NOW,
        timeout: { key: 'expire', target: 'expired', executeAtUtc: '2026-09-30T11:00:00Z' },
      }),
    );
    expect(html).toContain('Settling…');
  });
});
```

Append to `components/AvailableTransitions.vitest.test.tsx`:

```tsx
describe('AvailableTransitions — scheduled countdown and annotations', () => {
  const NOW = Date.parse('2026-09-30T12:00:00Z');
  const renderScheduled = (executeAtUtc: string) =>
    renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'reminder', href: '/t/r', kind: 'scheduled', executeAtUtc, annotations: { 'ui/priority': 'high' } },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
        nowMs: NOW,
      }),
    );

  it('counts down and shows annotation chips on a non-interactive entry', () => {
    const html = renderScheduled('2026-09-30T12:01:00Z');
    expect(html).toContain('in 1m 0s');
    expect(html).toContain('ui/priority');
    expect(html).toContain('aria-disabled="true"');
  });

  it('says Settling… once executeAtUtc has passed', () => {
    expect(renderScheduled('2026-09-30T11:00:00Z')).toContain('Settling…');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/countdown.vitest.test.ts src/modules/quick-run/components/StateTimeoutChip.vitest.test.tsx src/modules/quick-run/components/AvailableTransitions.vitest.test.tsx`
Expected: FAIL — `scheduleCountdownLabel` not exported; `./StateTimeoutChip` missing; no countdown in scheduled markup.

- [ ] **Step 3: Implement**

Append to `utils/countdown.ts`:

```ts
/**
 * Label for an engine-scheduled instant (timeout, scheduled transition):
 * `in 4m 10s` while in the future, `Settling…` once due (the runtime fires it
 * shortly after), `null` when the value does not parse.
 */
export function scheduleCountdownLabel(executeAtUtc: string, nowMs: number): string | null {
  const at = Date.parse(executeAtUtc);
  if (Number.isNaN(at)) return null;
  const left = at - nowMs;
  return left > 0 ? `in ${formatCountdown(left)}` : 'Settling…';
}
```

`components/AnnotationChips.tsx`:

```tsx
/** Key/value chips for transition / timeout `annotations` (client UI metadata). */
export function AnnotationChips({
  annotations,
  className = '',
}: {
  annotations?: Record<string, string> | null;
  className?: string;
}) {
  const entries = annotations ? Object.entries(annotations) : [];
  if (entries.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]"
        >
          <span className="font-semibold">{key}</span>: {value}
        </span>
      ))}
    </span>
  );
}
```

`components/StateTimeoutChip.tsx`:

```tsx
import type { StateTimeout } from '../types/quickrun.types';
import { scheduleCountdownLabel } from '../utils/countdown';
import { AnnotationChips } from './AnnotationChips';

/** The armed workflow timeout of the polled instance (state function `timeout`). */
export function StateTimeoutChip({ timeout, nowMs }: { timeout?: StateTimeout; nowMs: number }) {
  if (!timeout) return null;
  const label = scheduleCountdownLabel(timeout.executeAtUtc, nowMs);
  const at = Date.parse(timeout.executeAtUtc);
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-[11px]"
      title={Number.isNaN(at) ? 'Workflow timeout' : `Workflow timeout fires at ${new Date(at).toLocaleString()}`}
    >
      <span className="inline-flex items-center gap-1 rounded border border-warning-border bg-warning-surface px-1.5 py-0.5 text-warning-text">
        <span aria-hidden="true">⏱</span>
        <span className="font-mono">{timeout.key}</span>
        <span aria-hidden="true">→</span>
        <span className="font-mono">{timeout.target}</span>
        {label && <span className="opacity-80">· {label}</span>}
      </span>
      <AnnotationChips annotations={timeout.annotations} />
    </div>
  );
}
```

In `AvailableTransitions.tsx`:
- Add imports `import { scheduleCountdownLabel } from '../utils/countdown';` and `import { AnnotationChips } from './AnnotationChips';`.
- Add to props: `/** Clock for scheduled-entry countdowns; defaults to render time. */ nowMs?: number;` and destructure `nowMs,`.
- Right after `const locked = …;` add `const now = nowMs ?? Date.now();`.
- Replace the whole `style.readOnly ? ( <span …> … </span> ) : (` branch's `<span>…</span>` with:

```tsx
                  <ScheduledEntry
                    key={`${kind}-${info.name}`}
                    info={info}
                    label={flowLabels?.transitions[info.name] ?? info.name}
                    className={style.buttonClass}
                    description={style.description}
                    glyph={style.glyph}
                    nowMs={now}
                  />
```

- Append to the file:

```tsx
/** Engine-fired entry: not callable, so a non-interactive label with its countdown. */
function ScheduledEntry({
  info,
  label,
  className,
  description,
  glyph,
  nowMs,
}: {
  info: TransitionInfo;
  label: string;
  className: string;
  description: string;
  glyph?: string;
  nowMs: number;
}) {
  const countdown = info.executeAtUtc ? scheduleCountdownLabel(info.executeAtUtc, nowMs) : null;
  const at = info.executeAtUtc ? Date.parse(info.executeAtUtc) : Number.NaN;
  return (
    <span
      className={className}
      title={Number.isNaN(at) ? description : `${description} — ${new Date(at).toLocaleString()}`}
      aria-disabled="true"
    >
      {glyph ? `${glyph} ` : ''}
      {label}
      {countdown && <span className="ml-1 opacity-70">· {countdown}</span>}
      <AnnotationChips annotations={info.annotations} className="ml-1" />
    </span>
  );
}
```

In `InstanceDashboard.tsx`:
- Imports: `import { useNow } from '../hooks/useNow';` and `import { StateTimeoutChip } from './StateTimeoutChip';`.
- After `const interactionNow = useInteractionDriver(resumeAfterInteraction);` add:

```ts
  const hasScheduled = [...(activeState?.transitions ?? []), ...(activeState?.sharedTransitions ?? [])].some(
    (t) => t.kind === 'scheduled',
  );
  const clockNow = useNow(activeState?.timeout || hasScheduled ? 1000 : null);
```

- Inside the `{/* Progress */}` `<section>`, after `<ProgressStepper … />`, add `<StateTimeoutChip timeout={activeState?.timeout} nowMs={clockNow} />` (wrap both children in `<div className="flex flex-col gap-1.5">…</div>`).
- On `<AvailableTransitions … />` add `nowMs={clockNow}`.

- [ ] **Step 4: Run tests and type-check**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): timeout chip, scheduled countdowns and annotation chips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Incidents — lazy loading in its own module

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/components/IncidentSection.tsx`
- Modify (rewrite): `packages/designer-ui/src/modules/quick-run/components/IncidentSection.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceListPanel.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/QuickRunStatusBar.tsx`
- Modify: `packages/designer-ui/vitest.config.ts`

**Interfaces:**
- Consumes: `QuickRunApi.getActiveIncident`, `QuickRunApi.getIncidents`, `IncidentPage`, `IncidentEntry` (Task 3); `normalizeIncident`, `NormalizedIncident` (Phase A); `RuntimeErrorBanner`.
- Produces: `IncidentLoaders { loadActive(); loadHistory(page) }`, `createIncidentLoaders(ctx)`, `INCIDENT_PAGE_SIZE = 20`, `IncidentHistoryState`, `EMPTY_INCIDENT_HISTORY`, `appendIncidentPage(prev, page)`, components `IncidentSection({ incident, raw, loaders? })`, `IncidentAlert({ incident, raw, loaders? })`, `IncidentAlertStrip()`, `IncidentEntryCard({ entry, heading? })`, `IncidentBadge({ label? })`.

- [ ] **Step 1: Write the failing test**

Replace `components/IncidentSection.vitest.test.tsx` with:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { IncidentEntry } from '../QuickRunApi';
import { normalizeIncident } from '../utils/incident';

// `CopyableJsonBlock` mounts Monaco, which the SSR-only harness cannot load.
vi.mock('./CopyableJsonBlock', () => ({
  CopyableJsonBlock: ({ value }: { value: unknown }) => createElement('pre', null, JSON.stringify(value)),
}));

const { IncidentSection, IncidentAlert, IncidentEntryCard, IncidentBadge, appendIncidentPage, EMPTY_INCIDENT_HISTORY } =
  await import('./IncidentSection.js');

const LINK_SHAPE = { hasActiveIncident: true, active: { href: '/a' }, history: { href: '/h' } };

const ENTRY: IncidentEntry = {
  id: 'i1', createdAt: '2026-09-01T10:00:00Z', state: 'review', transition: 'approve', task: null,
  message: 'upstream failed', errorCode: 'Task:Http:503', errorLayer: 'Task', statusCode: 503,
  boundaryAction: null, boundaryLevel: null, traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
};

const loaders = {
  loadActive: () => Promise.resolve({ success: true as const, data: { incident: null } }),
  loadHistory: () =>
    Promise.resolve({
      success: true as const,
      data: { hasActiveIncident: true, items: [], page: 1, pageSize: 20, hasNext: false },
    }),
};

describe('IncidentSection', () => {
  it('shows a link-shape active incident without inventing entry fields', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE }),
    );
    expect(html).toContain('This instance has an active incident');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('Current incident');
  });

  it('offers lazy loading of the active incident and the history when loaders exist', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE, loaders }),
    );
    expect(html).toContain('Show active incident</button>');
    expect(html).toContain('Past incidents</button>');
  });

  it('renders the embedded active entry from a legacy runtime', () => {
    const raw = { hasActiveIncident: true, totalCount: 1, active: { ...ENTRY, task: 'call-api' } };
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw, loaders }),
    );
    expect(html).toContain('Current incident');
    expect(html).toContain('upstream failed');
    expect(html).not.toContain('Show active incident');
  });
});

describe('IncidentEntryCard', () => {
  it('shows the HTTP status code and a dash for missing fields', () => {
    const html = renderToStaticMarkup(createElement(IncidentEntryCard, { entry: ENTRY }));
    expect(html).toContain('503');
    expect(html).toContain('—');
  });
});

describe('IncidentAlert', () => {
  it('shows the strip collapsed by default', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentAlert, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE, loaders }),
    );
    expect(html).toContain('This instance has an active incident.');
    expect(html).toContain('Show details');
    expect(html).not.toContain('Show active incident');
  });
});

describe('IncidentBadge', () => {
  it('is labelled for assistive tech', () => {
    expect(renderToStaticMarkup(createElement(IncidentBadge, {}))).toContain('aria-label="Active incident"');
  });
});

describe('appendIncidentPage', () => {
  it('appends new rows once and tracks paging', () => {
    const first = appendIncidentPage(EMPTY_INCIDENT_HISTORY, {
      hasActiveIncident: true, items: [ENTRY], page: 1, pageSize: 1, hasNext: true,
    });
    const second = appendIncidentPage(first, {
      hasActiveIncident: true, items: [ENTRY, { ...ENTRY, id: 'i2' }], page: 2, pageSize: 1, hasNext: false,
    });
    expect(second.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(second.page).toBe(2);
    expect(second.hasNext).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/components/IncidentSection.vitest.test.tsx`
Expected: FAIL — cannot resolve `./IncidentSection.js`.

- [ ] **Step 3: Implement `IncidentSection.tsx`**

```tsx
import { useCallback, useState, type ReactNode } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import type { IncidentEntry, IncidentPage } from '../QuickRunApi';
import type { NormalizedIncident } from '../utils/incident';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

type LoadResult<T> = { success: true; data: T } | { success: false; error: RuntimeErrorLike };

export const INCIDENT_PAGE_SIZE = 20;

/** Lazy loaders for the incident endpoints; paths are rebuilt host-side. */
export interface IncidentLoaders {
  loadActive: () => Promise<LoadResult<{ incident: IncidentEntry | null }>>;
  loadHistory: (page: number) => Promise<LoadResult<IncidentPage>>;
}

export function createIncidentLoaders(ctx: {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): IncidentLoaders {
  return {
    loadActive: () => QuickRunApi.getActiveIncident(ctx),
    loadHistory: (page) => QuickRunApi.getIncidents({ ...ctx, page, pageSize: INCIDENT_PAGE_SIZE }),
  };
}

export interface IncidentHistoryState {
  items: IncidentEntry[];
  /** Last loaded page; 0 before the first load. */
  page: number;
  hasNext: boolean;
}

export const EMPTY_INCIDENT_HISTORY: IncidentHistoryState = { items: [], page: 0, hasNext: false };

export function appendIncidentPage(prev: IncidentHistoryState, next: IncidentPage): IncidentHistoryState {
  const seen = new Set(prev.items.map((i) => i.id));
  return {
    items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))],
    page: next.page,
    hasNext: next.hasNext,
  };
}

function thrown(err: unknown): RuntimeErrorLike {
  return { code: 'THROWN', message: err instanceof Error ? err.message : String(err) };
}

export interface IncidentSectionProps {
  incident: NormalizedIncident;
  raw: unknown;
  /** Absent → link-shape incidents show the flag only. */
  loaders?: IncidentLoaders;
}

const LINK_BUTTON =
  'self-start rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50';

export function IncidentSection({ incident, raw, loaders }: IncidentSectionProps) {
  const [active, setActive] = useState<{ status: 'idle' | 'loading' | 'loaded'; entry: IncidentEntry | null }>({
    status: 'idle',
    entry: null,
  });
  const [activeError, setActiveError] = useState<RuntimeErrorLike | null>(null);
  const [history, setHistory] = useState<IncidentHistoryState>(EMPTY_INCIDENT_HISTORY);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<RuntimeErrorLike | null>(null);

  const loadActive = useCallback(async () => {
    if (!loaders) return;
    setActive({ status: 'loading', entry: null });
    setActiveError(null);
    try {
      const res = await loaders.loadActive();
      if (res.success) {
        setActive({ status: 'loaded', entry: res.data.incident });
      } else {
        setActive({ status: 'idle', entry: null });
        setActiveError(res.error);
      }
    } catch (err) {
      setActive({ status: 'idle', entry: null });
      setActiveError(thrown(err));
    }
  }, [loaders]);

  const loadHistoryPage = useCallback(
    async (page: number) => {
      if (!loaders) return;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await loaders.loadHistory(page);
        if (res.success) setHistory((prev) => appendIncidentPage(page === 1 ? EMPTY_INCIDENT_HISTORY : prev, res.data));
        else setHistoryError(res.error);
      } catch (err) {
        setHistoryError(thrown(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    [loaders],
  );

  let activeBlock: ReactNode = null;
  if (incident.active) {
    activeBlock = <IncidentEntryCard entry={incident.active} heading="Current incident" />;
  } else if (incident.hasActiveIncident) {
    if (active.status === 'loaded') {
      activeBlock = active.entry ? (
        <IncidentEntryCard entry={active.entry} heading="Current incident" />
      ) : (
        <p className="text-xs text-[var(--vscode-foreground)]">
          No open incident any more — a retry may have resolved it. Refresh the state to see the latest.
        </p>
      );
    } else if (loaders) {
      activeBlock = (
        <button type="button" className={LINK_BUTTON} onClick={() => void loadActive()} disabled={active.status === 'loading'}>
          {active.status === 'loading' ? 'Loading incident…' : 'Show active incident'}
        </button>
      );
    } else {
      activeBlock = <p className="text-xs text-[var(--vscode-foreground)]">This instance has an active incident.</p>;
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--vscode-panel-border)] pt-4">
      <p className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">Incident</p>
      {activeBlock}
      {activeError && <RuntimeErrorBanner title="Could not load the active incident" error={activeError} />}

      {incident.history.length > 0 ? (
        <IncidentHistoryList entries={incident.history} />
      ) : (
        loaders && (
          <div className="flex flex-col gap-2">
            {history.page === 0 ? (
              <button type="button" className={LINK_BUTTON} onClick={() => void loadHistoryPage(1)} disabled={historyLoading}>
                {historyLoading ? 'Loading…' : 'Past incidents'}
              </button>
            ) : (
              <>
                <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">Past incidents</p>
                {history.items.length === 0 ? (
                  <p className="text-xs text-[var(--vscode-descriptionForeground)]">No past incidents.</p>
                ) : (
                  <IncidentHistoryList entries={history.items} />
                )}
                {history.hasNext && (
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    onClick={() => void loadHistoryPage(history.page + 1)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        )
      )}
      {historyError && <RuntimeErrorBanner title="Could not load past incidents" error={historyError} />}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
          Raw JSON
        </summary>
        <div className="mt-2">
          <CopyableJsonBlock value={raw} />
        </div>
      </details>
    </section>
  );
}

const WARN_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0" aria-hidden="true">
    <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28 2.28 13h11.44L8 2.28zM8.5 12v-1h-1v1h1zm0-2V6h-1v4h1z" />
  </svg>
);

/** Instance Details dialog header strip. */
export function IncidentAlertStrip() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-inputValidation-warningBackground)] px-4 py-2 text-[11px] text-[var(--vscode-inputValidation-warningForeground,var(--vscode-foreground))]"
    >
      {WARN_ICON}
      <span>This instance has an active incident.</span>
    </div>
  );
}

/** Dashboard alert: the flag from the state response; details load on expand. */
export function IncidentAlert({ incident, raw, loaders }: IncidentSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded border border-warning-border">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-[var(--vscode-inputValidation-warningBackground)] px-3 py-2 text-[11px] text-[var(--vscode-inputValidation-warningForeground,var(--vscode-foreground))]"
      >
        {WARN_ICON}
        <span>This instance has an active incident.</span>
        <button
          type="button"
          className="ml-auto text-[var(--vscode-textLink-foreground)] hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <IncidentSection incident={incident} raw={raw} loaders={loaders} />
        </div>
      )}
    </section>
  );
}

export function IncidentBadge({ label = '!' }: { label?: string }) {
  return (
    <span
      title="Active incident"
      aria-label="Active incident"
      className="rounded border border-warning-border bg-warning-surface px-1 text-[9px] font-semibold text-warning-text"
    >
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{label}</span>
      <span className="text-[var(--vscode-foreground)]">{children}</span>
    </div>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v);

export function IncidentEntryCard({ entry, heading }: { entry: IncidentEntry; heading?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {heading && <p className="text-[10px] font-medium text-[var(--vscode-descriptionForeground)]">{heading}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Row label="State">{entry.state}</Row>
        <Row label="Transition">{entry.transition}</Row>
        <Row label="Task">{dash(entry.task)}</Row>
        <Row label="Error Code"><code className="break-all text-[10px]">{dash(entry.errorCode)}</code></Row>
        <Row label="Status Code">{dash(entry.statusCode)}</Row>
        <Row label="Layer">{dash(entry.errorLayer)}</Row>
        <Row label="Boundary">{entry.boundaryAction ? `${entry.boundaryAction} · ${dash(entry.boundaryLevel)}` : '—'}</Row>
        <Row label="Retry Count">{entry.retryCount}</Row>
        <Row label="Created At">{formatDateTime(entry.createdAt)}</Row>
        <Row label="Status">
          <span className={entry.isResolved ? 'text-[var(--vscode-charts-green)]' : 'text-[var(--vscode-charts-orange)]'}>
            {entry.isResolved ? `Resolved ${formatDateTime(entry.resolvedAt)}` : 'Open'}
          </span>
        </Row>
        <Row label="Trace ID">
          {entry.traceId ? (
            <span className="flex items-center gap-1">
              <code className="break-all text-[10px] text-[var(--vscode-textLink-foreground)]">{entry.traceId}</code>
              <button
                type="button"
                className="inline-flex shrink-0 rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                onClick={() => {
                  void navigator.clipboard.writeText(entry.traceId ?? '').then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                title={copied ? 'Copied!' : 'Copy Trace ID'}
                aria-label="Copy Trace ID"
              >
                {copied ? '✓' : '⧉'}
              </button>
            </span>
          ) : (
            '—'
          )}
        </Row>
      </div>
      <div className="max-h-48 overflow-y-auto rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-textCodeBlock-background)] p-2">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--vscode-foreground)]">{entry.message}</pre>
      </div>
    </div>
  );
}

function IncidentHistoryList({ entries }: { entries: readonly IncidentEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <details key={entry.id} className="rounded border border-[var(--vscode-panel-border)]">
          <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]">
            <span className="text-[var(--vscode-descriptionForeground)]">{formatDateTime(entry.createdAt)}</span>
            <code className="text-[var(--vscode-foreground)]">{dash(entry.errorCode)}</code>
            <span className="text-[var(--vscode-descriptionForeground)]">@ {entry.state}</span>
            <span className={`ml-auto text-[9px] ${entry.isResolved ? 'text-[var(--vscode-charts-green)]' : 'text-[var(--vscode-charts-orange)]'}`}>
              {entry.isResolved ? 'Resolved' : 'Open'}
            </span>
          </summary>
          <div className="border-t border-[var(--vscode-panel-border)] p-2">
            <IncidentEntryCard entry={entry} />
          </div>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: Step 2 command. Expected: PASS.

- [ ] **Step 5: Remove the old incident code from the dashboard and wire the new module**

In `InstanceDashboard.tsx`:
- Delete everything from the `// ── Incident Components ───` comment through the end of `function IncidentRawJsonDisclosure(…) { … }` (i.e. `IncidentAlertStrip`, `IncidentSection`, `IncidentActiveCard`, `IncidentMessageBlock`, `IncidentHistorySection`, `IncidentHistoryItem`, `IncidentRawJsonDisclosure`). Keep `MetaRow` and `formatDateTime`.
- Imports: change `import type { IncidentEntry, InstanceDetailResponse, WorkflowBucketConfig } from '../QuickRunApi';` to `import type { InstanceDetailResponse, WorkflowBucketConfig } from '../QuickRunApi';`; change `import { normalizeIncident, type NormalizedIncident } from '../utils/incident';` to `import { normalizeIncident } from '../utils/incident';`; delete `import { CopyableJsonBlock } from './CopyableJsonBlock';`; add

```ts
import {
  IncidentAlert,
  IncidentAlertStrip,
  IncidentSection,
  createIncidentLoaders,
  type IncidentLoaders,
} from './IncidentSection';
```

- After the `const clockNow = …` line (Task 6) add:

```ts
  const incidentLoaders = useMemo(
    () =>
      activeTabId && domain && workflowKey
        ? createIncidentLoaders({
            domain,
            workflowKey,
            instanceId: activeTabId,
            headers: mergeQuickRunHeaders(configRef.current, sessionHeaders, undefined, toolWideHeaders),
            runtimeUrl: environmentUrl,
          })
        : undefined,
    [activeTabId, domain, workflowKey, configRef, sessionHeaders, toolWideHeaders, environmentUrl],
  );
  const liveIncident = normalizeIncident(activeState?.incident);
```

- Directly after the `{awaitingAck && ( <InteractionBanner … /> )}` block add:

```tsx
      {liveIncident?.hasActiveIncident && (
        <IncidentAlert key={activeTabId ?? ''} incident={liveIncident} raw={activeState?.incident} loaders={incidentLoaders} />
      )}
```

- `InstanceMetaDialog`: add prop `incidentLoaders?: IncidentLoaders;` (destructure it), change the incident condition and element to:

```tsx
              {incident && (incident.hasActiveIncident || incident.active || incident.history.length > 0 || incident.links?.history) && (
                <IncidentSection incident={incident} raw={rawIncident} loaders={incidentLoaders} />
              )}
```

- At the `<InstanceMetaDialog … />` call site add `incidentLoaders={incidentLoaders}`.

- [ ] **Step 6: Badges in the instance list and status bar**

`InstanceListPanel.tsx`: add `import { normalizeIncident } from '../utils/incident';` and `import { IncidentBadge } from './IncidentSection';`; in the "Recent" row, directly before `<StatusBadge status={displayStatus(item.metadata)} compact />`, add:

```tsx
                {normalizeIncident(item.metadata.incident)?.hasActiveIncident && <IncidentBadge />}
```

`QuickRunStatusBar.tsx`: add `import { normalizeIncident } from '../utils/incident';` and `import { IncidentBadge } from './IncidentSection';`; after the `{activeState && ( … State: … )}` block add:

```tsx
      {normalizeIncident(activeState?.incident)?.hasActiveIncident && <IncidentBadge label="Incident" />}
```

- [ ] **Step 7: Drop the suite-wide dependency inlining**

The `server.deps.inline` entry was added only so the old test could import `InstanceDashboard` (commit `03b9f96`). Replace `packages/designer-ui/vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.vitest.test.ts', 'src/**/*.vitest.test.tsx'],
  },
});
```

Run: `pnpm --filter @vnext-forge-studio/designer-ui test`
Expected: PASS. If (and only if) a suite fails with an ESM/`primereact`/`@burgan-tech/pseudo-ui` resolution error, restore the `server: { deps: { inline: [/primereact/, /@burgan-tech\/pseudo-ui/] } }` block, re-run until green, and name the importing test in the commit body.

- [ ] **Step 8: Type-check and commit**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build` → exit 0.

```bash
git add packages/designer-ui/vitest.config.ts packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): lazy-load active and past incidents

IncidentSection moves out of InstanceDashboard; the dashboard shows the
state's incident flag and loads details on expand; list and status bar get an
incident badge. Drops the suite-wide deps.inline workaround.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Metadata and filters — instance type, effective status, raw status for behaviour

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/instanceTarget.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/instanceTarget.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/hooks/useOpenInstance.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/utils/instanceStatus.ts`, `utils/instanceStatus.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/utils/instanceFilterSerializer.ts`, `utils/instanceFilterSerializer.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceFilterPanel.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts`, `store/quickRunStore.vitest.test.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceListPanel.tsx`, `InstanceDashboard.tsx`, `QuickRunStatusBar.tsx`

**Interfaces:**
- Produces: `QuickRunInstance.effectiveStatus?: InstanceStatus`; `OpenInstanceTarget { id; key; domain; workflowKey; status; effectiveStatus?; currentState?; startedAt }`; `instanceTargetFromListItem(item: InstanceListItem): OpenInstanceTarget`; `useOpenInstance(): (target: OpenInstanceTarget) => void`; `instanceTypeLabel(type: InstanceType | null | undefined): string | null`; `InstanceFieldType` gains `'instanceType'`; `INSTANCE_TYPE_OPTIONS = ['Root', 'SubFlow', 'SubProcess']`; `sortableInstanceFields()`.

- [ ] **Step 1: Write the failing tests**

`utils/instanceTarget.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { InstanceListItem } from '../types/quickrun.types';
import { instanceTargetFromListItem } from './instanceTarget';

const ITEM: InstanceListItem = {
  id: 'i1',
  key: 'k1',
  flow: 'wf',
  domain: 'core',
  metadata: {
    currentState: 'in-subflow',
    effectiveState: 'child-state',
    status: 'B',
    effectiveStatus: 'A',
    createdAt: '2026-09-01T00:00:00Z',
  },
};

describe('instanceTargetFromListItem', () => {
  it('keeps the raw status for behaviour and the effective one for display', () => {
    expect(instanceTargetFromListItem(ITEM)).toEqual({
      id: 'i1',
      key: 'k1',
      domain: 'core',
      workflowKey: 'wf',
      status: 'B',
      effectiveStatus: 'A',
      currentState: 'in-subflow',
      startedAt: '2026-09-01T00:00:00Z',
    });
  });

  it('omits effectiveStatus on older runtimes', () => {
    const { effectiveStatus: _ignored, ...metadata } = ITEM.metadata;
    expect(instanceTargetFromListItem({ ...ITEM, metadata })).not.toHaveProperty('effectiveStatus');
  });
});
```

Append to `utils/instanceStatus.vitest.test.ts` (import `instanceTypeLabel`):

```ts
describe('instanceTypeLabel', () => {
  it('names each instance type and tolerates null', () => {
    expect(instanceTypeLabel('R')).toBe('Root');
    expect(instanceTypeLabel('S')).toBe('SubFlow');
    expect(instanceTypeLabel('P')).toBe('SubProcess');
    expect(instanceTypeLabel(null)).toBeNull();
    expect(instanceTypeLabel(undefined)).toBeNull();
  });
});
```

Append to `utils/instanceFilterSerializer.vitest.test.ts` (extend the import with `INSTANCE_FIELDS, INSTANCE_TYPE_OPTIONS, sortableInstanceFields`):

```ts
describe('instance metadata fields', () => {
  it('offers instanceType and effectiveStatus as filter fields', () => {
    expect(INSTANCE_FIELDS.find((f) => f.value === 'instanceType')?.type).toBe('instanceType');
    expect(INSTANCE_FIELDS.find((f) => f.value === 'effectiveStatus')?.type).toBe('status');
  });

  it('instanceType accepts only eq / ne / in / nin', () => {
    expect(getOperatorsForFieldType('instanceType')).toEqual(['eq', 'ne', 'in', 'nin']);
  });

  it('serializes instance type names', () => {
    expect(parse(inst('instanceType', 'in', 'Root, SubFlow'))).toEqual({ instanceType: { in: ['Root', 'SubFlow'] } });
    expect(parse(inst('effectiveStatus', 'eq', 'Active'))).toEqual({ effectiveStatus: { eq: 'Active' } });
  });

  it('lists the instance type options by name', () => {
    expect(INSTANCE_TYPE_OPTIONS).toEqual(['Root', 'SubFlow', 'SubProcess']);
  });

  it('does not offer instanceType as a sort field', () => {
    expect(sortableInstanceFields().some((f) => f.value === 'instanceType')).toBe(false);
    expect(sortableInstanceFields().some((f) => f.value === 'effectiveStatus')).toBe(true);
  });
});
```

Append to `store/quickRunStore.vitest.test.ts`:

```ts
describe('useQuickRunStore — effective status', () => {
  it('a poll result replaces both statuses (the state function reports the effective status)', () => {
    useQuickRunStore.setState({ instances: new Map() });
    useQuickRunStore.getState().addInstance({
      id: 'i1', key: 'k', status: 'B', effectiveStatus: 'A', domain: 'core', workflowKey: 'wf', startedAt: '2026-09-01T00:00:00Z',
    });
    useQuickRunStore.getState().updateInstanceStatus('i1', 'B', 'child');
    expect(useQuickRunStore.getState().instances.get('i1')).toMatchObject({ status: 'B', effectiveStatus: undefined });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/instanceTarget.vitest.test.ts src/modules/quick-run/utils/instanceStatus.vitest.test.ts src/modules/quick-run/utils/instanceFilterSerializer.vitest.test.ts src/modules/quick-run/store/quickRunStore.vitest.test.ts`
Expected: FAIL — missing module / exports; `effectiveStatus` still `'A'` after the update.

- [ ] **Step 3: Types, helpers, store**

`quickrun.types.ts` — in `QuickRunInstance` add after `status: InstanceStatus;`:

```ts
  /**
   * Display status from the instance list (`metadata.effectiveStatus`). `status`
   * stays the behavioural one (retry, cancel, polling). Cleared by poll results:
   * the state function's own `status` already is the effective status.
   */
  effectiveStatus?: InstanceStatus;
```

Append to `utils/instanceStatus.ts` (add `InstanceType` to the type import):

```ts
const INSTANCE_TYPE_LABELS: Record<InstanceType, string> = { R: 'Root', S: 'SubFlow', P: 'SubProcess' };

/** How the instance was started. `P` here is SubProcess, not Passive. */
export function instanceTypeLabel(type: InstanceType | null | undefined): string | null {
  return type ? INSTANCE_TYPE_LABELS[type] : null;
}
```

`utils/instanceTarget.ts`:

```ts
import type { InstanceListItem, InstanceStatus } from '../types/quickrun.types';

/** Everything needed to open (or focus) an instance tab. */
export interface OpenInstanceTarget {
  id: string;
  key: string;
  domain: string;
  workflowKey: string;
  /** Raw row status — drives behaviour. */
  status: InstanceStatus;
  /** Display status. */
  effectiveStatus?: InstanceStatus;
  currentState?: string;
  startedAt: string;
}

export function instanceTargetFromListItem(item: InstanceListItem): OpenInstanceTarget {
  return {
    id: item.id,
    key: item.key,
    domain: item.domain,
    workflowKey: item.flow,
    status: item.metadata.status,
    ...(item.metadata.effectiveStatus ? { effectiveStatus: item.metadata.effectiveStatus } : {}),
    currentState: item.metadata.currentState,
    startedAt: item.metadata.createdAt,
  };
}
```

`quickRunStore.ts` — in `updateInstanceStatus` change the set call body to `instances.set(instanceId, { ...existing, status, effectiveStatus: undefined, currentState: currentState ?? existing.currentState });` and in `updateInstanceState` add `effectiveStatus: undefined,` after `status: stateResponse.status,`.

`hooks/useOpenInstance.ts`:

```ts
import { useCallback } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import type { OpenInstanceTarget } from '../utils/instanceTarget';
import { useQuickRunPolling } from './useQuickRunPolling';

/** Focus an open instance tab, or add it and start polling it. */
export function useOpenInstance(): (target: OpenInstanceTarget) => void {
  const instances = useQuickRunStore((s) => s.instances);
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);
  const { pollState } = useQuickRunPolling(pollingConfig);

  return useCallback(
    (target: OpenInstanceTarget) => {
      if (instances.has(target.id)) {
        setActiveTab(target.id);
        return;
      }
      addInstance({
        id: target.id,
        key: target.key,
        status: target.status,
        ...(target.effectiveStatus ? { effectiveStatus: target.effectiveStatus } : {}),
        domain: target.domain,
        workflowKey: target.workflowKey,
        environmentName,
        currentState: target.currentState,
        startedAt: target.startedAt,
      });
      addTab({
        instanceId: target.id,
        domain: target.domain,
        workflowKey: target.workflowKey,
        environmentName,
        label: target.key || target.id.slice(0, 8),
      });
      void pollState({
        domain: target.domain,
        workflowKey: target.workflowKey,
        instanceId: target.id,
        headers: globalHeaders,
        runtimeUrl: environmentUrl,
      });
    },
    [instances, setActiveTab, addInstance, addTab, environmentName, environmentUrl, globalHeaders, pollState],
  );
}
```

- [ ] **Step 4: Filter serializer and panel**

`instanceFilterSerializer.ts`:
- `export type InstanceFieldType = 'string' | 'status' | 'date' | 'instanceType';`
- In `INSTANCE_FIELDS` insert after the `status` row:

```ts
  { value: 'effectiveStatus', label: 'Effective Status', type: 'status' },
  { value: 'instanceType', label: 'Instance Type', type: 'instanceType' },
```

- After `STATUS_OPTIONS` add:

```ts
/** `instanceType` accepts names or codes (`Root`/`R`, `SubFlow`/`S`, `SubProcess`/`P`). */
export const INSTANCE_TYPE_OPTIONS = ['Root', 'SubFlow', 'SubProcess'] as const;

/** Sort choices: `instanceType` is filter-only. */
export function sortableInstanceFields(): typeof INSTANCE_FIELDS {
  return INSTANCE_FIELDS.filter((f) => f.type !== 'instanceType');
}
```

- In `getOperatorsForFieldType` change `case 'status': return ['eq', 'ne', 'in', 'nin'];` to:

```ts
    case 'status':
    case 'instanceType':
      return ['eq', 'ne', 'in', 'nin'];
```

`InstanceFilterPanel.tsx`:
- Extend the serializer import with `INSTANCE_TYPE_OPTIONS, sortableInstanceFields,`.
- In the Sort `<select>` replace `{INSTANCE_FIELDS.map((f) => (` with `{sortableInstanceFields().map((f) => (`.
- In the condition row replace `const isStatus = fieldType === 'status';` with:

```ts
  const enumOptions: readonly string[] | null =
    fieldType === 'status' ? STATUS_OPTIONS : fieldType === 'instanceType' ? INSTANCE_TYPE_OPTIONS : null;
```

- Replace `) : isStatus && (condition.operator === 'eq' || condition.operator === 'ne') ? (` with `) : enumOptions && (condition.operator === 'eq' || condition.operator === 'ne') ? (`, replace `{STATUS_OPTIONS.map((s) => (` inside that select with `{enumOptions.map((s) => (`, and replace `) : isStatus ? (` with `) : enumOptions ? (`. In that last text input replace `placeholder="Active, Faulted"` with `placeholder={enumOptions.slice(0, 2).join(', ')}` and `title="Comma-separated status names"` with `title="Comma-separated names"`.

- [ ] **Step 5: Use it in the list, dashboard and status bar**

`InstanceListPanel.tsx`:
- Replace the `useQuickRunPolling` import and the `pollingConfig` / `pollState` lines, and the whole `openInstance` `useCallback`, with:

```ts
  const openInstance = useOpenInstance();
```

  and add imports `import { useOpenInstance } from '../hooks/useOpenInstance';`, `import { instanceTargetFromListItem } from '../utils/instanceTarget';`. Delete the now-unused `addInstance` and `addTab` selectors (keep `environmentName` — the "Recent" header still reads it).
- Change the Recent row `onClick={() => openInstance(item)}` to `onClick={() => openInstance(instanceTargetFromListItem(item))}`.
- Change the two bucket filters to `filter((i) => isActiveStatus(displayStatus(i)))` / `filter((i) => isInactiveStatus(displayStatus(i)))`, and both tab-row badges to `<StatusBadge status={displayStatus(instance)} compact />`.

`InstanceDashboard.tsx`:
- Add `import { displayStatus, instanceTypeLabel } from '../utils/instanceStatus';`.
- Change both `<StatusBadge status={activeInstance.status} />` to `<StatusBadge status={displayStatus(activeInstance)} />` (header and STATUS section). `isActive` and the Retry Instance check keep `activeInstance.status`.
- In `InstanceMetaDialog` replace `<MetaRow label="Status"><span>{data.metadata.status}</span></MetaRow>` with:

```tsx
                  <MetaRow label="Status"><span>{data.metadata.status}</span></MetaRow>
                  {data.metadata.effectiveStatus && (
                    <MetaRow label="Effective Status"><span>{data.metadata.effectiveStatus}</span></MetaRow>
                  )}
                  {instanceTypeLabel(data.metadata.type) && (
                    <MetaRow label="Type"><span>{instanceTypeLabel(data.metadata.type)}</span></MetaRow>
                  )}
```

`QuickRunStatusBar.tsx`: add `import { displayStatus, isActiveStatus } from '../utils/instanceStatus';` and replace the `activeCount` filter with `(i) => isActiveStatus(displayStatus(i))`.

- [ ] **Step 6: Run tests and type-check**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run && pnpm --filter @vnext-forge-studio/designer-ui build` → PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): instance type and effective status in details and filters

Opening an instance keeps the raw status for behaviour and the effective
status for display; instanceType / effectiveStatus are filterable.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Authorize panel and opt-in permission badges

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/permissionChecks.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/permissionChecks.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/AuthorizePanel.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/AuthorizePanel.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/components/AvailableTransitions.tsx`, `components/AvailableTransitions.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/InstanceDashboard.tsx`

**Interfaces:**
- Consumes: `QuickRunApi.authorize(params: AuthorizeParams)`, `AuthorizeTarget`, `AuthorizeResult` (Task 3); `currentRoleFromHeaders` (Task 3); `liveHeaders` in the dashboard (Task 5).
- Produces: `AuthorizeVerdict = { kind: 'verdict'; allowed: boolean; status: number } | { kind: 'error'; message: string }`; `AuthorizeCallResult`; `resolveVerdict(call)`; `permissionCacheKey(eTag, fallback, role)`; `checkableTransitionKeys(transitions, shared)`; `runPermissionChecks({ key, role, transitionKeys, authorize })`; `PermissionCheckResult { key; role; transitions: Record<string, AuthorizeVerdict>; queryRoles: AuthorizeVerdict }`; `verdictText(v)`; `visibilityText(v)`; `buildAuthorizeTarget(kind, key)`; store `permissionChecksEnabled`, `permissionChecks`, `setPermissionChecksEnabled`, `setPermissionChecks`; `AvailableTransitions` prop `permissions?: Readonly<Record<string, AuthorizeVerdict>>`.

- [ ] **Step 1: Write the failing tests**

`utils/permissionChecks.vitest.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import type { AuthorizeTarget } from '../types/quickrun.types';
import {
  buildAuthorizeTarget,
  checkableTransitionKeys,
  permissionCacheKey,
  resolveVerdict,
  runPermissionChecks,
  verdictText,
  visibilityText,
} from './permissionChecks';

describe('permissionCacheKey', () => {
  it('keys by eTag and role, falling back to the state when there is no eTag', () => {
    expect(permissionCacheKey('W/"e1"', 'i1:s', 'approver')).toBe('W/"e1"|approver');
    expect(permissionCacheKey(undefined, 'i1:s', undefined)).toBe('state:i1:s|');
  });
});

describe('checkableTransitionKeys', () => {
  it('lists state and shared transitions once, without scheduled entries', () => {
    expect(
      checkableTransitionKeys(
        [
          { name: 'approve', href: '' },
          { name: 'remind', href: '', kind: 'scheduled' },
        ],
        [
          { name: 'cancel', href: '', kind: 'cancel' },
          { name: 'approve', href: '' },
        ],
      ),
    ).toEqual(['approve', 'cancel']);
  });
});

describe('resolveVerdict', () => {
  it('maps success, failure and throws', async () => {
    expect(await resolveVerdict(Promise.resolve({ success: true, data: { allowed: false, status: 403 } }))).toEqual({
      kind: 'verdict',
      allowed: false,
      status: 403,
    });
    expect(await resolveVerdict(Promise.resolve({ success: false, error: { message: 'HTTP 500' } }))).toEqual({
      kind: 'error',
      message: 'HTTP 500',
    });
    expect(await resolveVerdict(Promise.reject(new Error('offline')))).toEqual({ kind: 'error', message: 'offline' });
  });
});

describe('runPermissionChecks', () => {
  it('asks queryRoles once and each transition once, with the role', async () => {
    const authorize = vi.fn((target: AuthorizeTarget) =>
      Promise.resolve({
        success: true as const,
        data: target.kind === 'transition' && target.transitionKey === 'reject'
          ? { allowed: false, status: 403 }
          : { allowed: true, status: 200 },
      }),
    );
    const result = await runPermissionChecks({ key: 'k', role: 'approver', transitionKeys: ['approve', 'reject', 'approve'], authorize });
    expect(authorize).toHaveBeenCalledTimes(3);
    expect(authorize).toHaveBeenCalledWith({ kind: 'queryRoles' }, 'approver');
    expect(result).toEqual({
      key: 'k',
      role: 'approver',
      queryRoles: { kind: 'verdict', allowed: true, status: 200 },
      transitions: {
        approve: { kind: 'verdict', allowed: true, status: 200 },
        reject: { kind: 'verdict', allowed: false, status: 403 },
      },
    });
  });
});

describe('texts', () => {
  it('describes verdicts and visibility', () => {
    expect(verdictText({ kind: 'verdict', allowed: true, status: 200 })).toBe('Allowed (HTTP 200)');
    expect(verdictText({ kind: 'verdict', allowed: false, status: 403 })).toBe('Denied (HTTP 403)');
    expect(verdictText({ kind: 'error', message: 'x' })).toBe('Check failed: x');
    expect(visibilityText({ kind: 'verdict', allowed: true, status: 200 })).toBe('Instance visible to this role');
    expect(visibilityText({ kind: 'verdict', allowed: false, status: 403 })).toBe('Instance hidden from this role');
  });
});

describe('buildAuthorizeTarget', () => {
  it('needs a key for transition and function targets only', () => {
    expect(buildAuthorizeTarget('transition', '')).toBeNull();
    expect(buildAuthorizeTarget('transition', 'approve')).toEqual({ kind: 'transition', transitionKey: 'approve' });
    expect(buildAuthorizeTarget('function', 'f')).toEqual({ kind: 'function', functionKey: 'f' });
    expect(buildAuthorizeTarget('queryRoles', '')).toEqual({ kind: 'queryRoles' });
    expect(buildAuthorizeTarget('ack', '')).toEqual({ kind: 'ack' });
  });
});
```

`components/AuthorizePanel.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthorizePanel, type AuthorizePanelProps } from './AuthorizePanel';

const render = (over: Partial<AuthorizePanelProps> = {}) =>
  renderToStaticMarkup(
    createElement(AuthorizePanel, {
      transitionKeys: ['approve', 'reject'],
      functionKeys: ['get-branches'],
      defaultRole: 'approver',
      onRun: () => Promise.resolve({ kind: 'verdict' as const, allowed: true, status: 200 }),
      checksEnabled: false,
      onChecksEnabledChange: () => undefined,
      ...over,
    }),
  );

describe('AuthorizePanel', () => {
  it('offers the four targets, the transitions, role and version', () => {
    const html = render();
    for (const text of ['Transition', 'Function', 'Instance visibility (queryRoles)', 'Acknowledge (ack)', 'approve', 'reject', 'Version', 'Run']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('value="approver"');
  });

  it('shows the opt-in toggle with the role', () => {
    const html = render();
    expect(html).toContain('Check permissions for role');
    expect(html).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(render({ checksEnabled: true })).toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('shows the instance-visibility indicator when checked', () => {
    expect(render({ checksEnabled: true, visibility: { kind: 'verdict', allowed: false, status: 403 } })).toContain(
      'Instance hidden from this role',
    );
  });
});
```

Append to `components/AvailableTransitions.vitest.test.tsx`:

```tsx
describe('AvailableTransitions — permission badges', () => {
  it('marks allowed and denied transitions', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'approve', href: '/a', kind: 'stateTransition' },
          { name: 'reject', href: '/r', kind: 'stateTransition' },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
        permissions: {
          approve: { kind: 'verdict', allowed: true, status: 200 },
          reject: { kind: 'verdict', allowed: false, status: 403 },
        },
      }),
    );
    expect(html).toContain('aria-label="Allowed (HTTP 200)"');
    expect(html).toContain('aria-label="Denied (HTTP 403)"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/permissionChecks.vitest.test.ts src/modules/quick-run/components/AuthorizePanel.vitest.test.tsx src/modules/quick-run/components/AvailableTransitions.vitest.test.tsx`
Expected: FAIL — missing modules; no badges.

- [ ] **Step 3: Implement `permissionChecks.ts`**

```ts
import type { AuthorizeResult, AuthorizeTarget, TransitionInfo } from '../types/quickrun.types';

/** One `authorize` answer, or why it could not be obtained. */
export type AuthorizeVerdict =
  | { kind: 'verdict'; allowed: boolean; status: number }
  | { kind: 'error'; message: string };

export type AuthorizeCallResult =
  | { success: true; data: AuthorizeResult }
  | { success: false; error: { message: string } };

export type AuthorizeCall = (target: AuthorizeTarget, role: string | undefined) => Promise<AuthorizeCallResult>;

export interface PermissionCheckResult {
  key: string;
  role: string | undefined;
  transitions: Record<string, AuthorizeVerdict>;
  /** `?queryRoles=true` — may this role read the instance? */
  queryRoles: AuthorizeVerdict;
}

export async function resolveVerdict(call: Promise<AuthorizeCallResult>): Promise<AuthorizeVerdict> {
  try {
    const res = await call;
    return res.success
      ? { kind: 'verdict', allowed: res.data.allowed, status: res.data.status }
      : { kind: 'error', message: res.error.message };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Checks are cached per (eTag, role): the eTag moves whenever the state,
 * its transitions or the incident flag change. Older runtimes without an
 * eTag fall back to the instance + state key.
 */
export function permissionCacheKey(eTag: string | undefined, fallback: string, role: string | undefined): string {
  return `${eTag ?? `state:${fallback}`}|${role ?? ''}`;
}

/** Callable transitions of the current state (scheduled entries are engine-fired). */
export function checkableTransitionKeys(
  transitions: readonly TransitionInfo[],
  sharedTransitions: readonly TransitionInfo[],
): string[] {
  const keys = [...transitions, ...sharedTransitions].filter((t) => t.kind !== 'scheduled').map((t) => t.name);
  return [...new Set(keys)];
}

export async function runPermissionChecks(input: {
  key: string;
  role: string | undefined;
  transitionKeys: readonly string[];
  authorize: AuthorizeCall;
}): Promise<PermissionCheckResult> {
  const unique = [...new Set(input.transitionKeys)];
  const [queryRoles, ...verdicts] = await Promise.all([
    resolveVerdict(input.authorize({ kind: 'queryRoles' }, input.role)),
    ...unique.map((transitionKey) => resolveVerdict(input.authorize({ kind: 'transition', transitionKey }, input.role))),
  ]);
  const transitions: Record<string, AuthorizeVerdict> = {};
  unique.forEach((key, i) => {
    transitions[key] = verdicts[i];
  });
  return { key: input.key, role: input.role, transitions, queryRoles };
}

export function verdictText(v: AuthorizeVerdict): string {
  if (v.kind === 'error') return `Check failed: ${v.message}`;
  return `${v.allowed ? 'Allowed' : 'Denied'} (HTTP ${v.status})`;
}

export function visibilityText(v: AuthorizeVerdict): string {
  if (v.kind === 'error') return 'Visibility check failed';
  return v.allowed ? 'Instance visible to this role' : 'Instance hidden from this role';
}

export function buildAuthorizeTarget(kind: AuthorizeTarget['kind'], key: string): AuthorizeTarget | null {
  switch (kind) {
    case 'transition':
      return key ? { kind, transitionKey: key } : null;
    case 'function':
      return key ? { kind, functionKey: key } : null;
    case 'queryRoles':
      return { kind: 'queryRoles' };
    case 'ack':
      return { kind: 'ack' };
  }
}
```

- [ ] **Step 4: Implement `AuthorizePanel.tsx`**

```tsx
import { useState } from 'react';

import type { AuthorizeTarget } from '../types/quickrun.types';
import { buildAuthorizeTarget, verdictText, visibilityText, type AuthorizeVerdict } from '../utils/permissionChecks';

export interface AuthorizePanelProps {
  transitionKeys: readonly string[];
  functionKeys: readonly string[];
  defaultRole?: string;
  onRun: (request: { target: AuthorizeTarget; role?: string; version?: string }) => Promise<AuthorizeVerdict>;
  checksEnabled: boolean;
  onChecksEnabledChange: (enabled: boolean) => void;
  /** `queryRoles` verdict of the opt-in checks for the current role. */
  visibility?: AuthorizeVerdict;
}

const TARGETS: { value: AuthorizeTarget['kind']; label: string }[] = [
  { value: 'transition', label: 'Transition' },
  { value: 'function', label: 'Function' },
  { value: 'queryRoles', label: 'Instance visibility (queryRoles)' },
  { value: 'ack', label: 'Acknowledge (ack)' },
];

const INPUT =
  'rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)]';

function VerdictChip({ verdict }: { verdict: AuthorizeVerdict }) {
  const tone =
    verdict.kind === 'error'
      ? 'border-warning-border bg-warning-surface text-warning-text'
      : verdict.allowed
        ? 'border-success-border bg-success text-success-foreground'
        : 'border-destructive-border bg-destructive-muted text-destructive-text';
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{verdictText(verdict)}</span>;
}

/** Ask the runtime's `authorize` oracle about the active instance (spec D4). */
export function AuthorizePanel({
  transitionKeys,
  functionKeys,
  defaultRole,
  onRun,
  checksEnabled,
  onChecksEnabledChange,
  visibility,
}: AuthorizePanelProps) {
  const [kind, setKind] = useState<AuthorizeTarget['kind']>('transition');
  const [key, setKey] = useState('');
  const [role, setRole] = useState(defaultRole ?? '');
  const [version, setVersion] = useState('');
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<AuthorizeVerdict | null>(null);

  const options = kind === 'transition' ? transitionKeys : kind === 'function' ? functionKeys : [];
  const selectedKey = options.includes(key) ? key : (options[0] ?? '');
  const target = buildAuthorizeTarget(kind, selectedKey);

  const run = async () => {
    if (!target) return;
    setRunning(true);
    try {
      setVerdict(
        await onRun({
          target,
          ...(role.trim() ? { role: role.trim() } : {}),
          ...(version.trim() ? { version: version.trim() } : {}),
        }),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <details className="rounded border border-[var(--vscode-panel-border)] p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-muted-text">
        Authorization
        {checksEnabled && visibility && (
          <span className="text-[10px] font-normal normal-case text-[var(--vscode-descriptionForeground)]">
            · {visibilityText(visibility)}
          </span>
        )}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={checksEnabled}
            onChange={(e) => onChecksEnabledChange(e.target.checked)}
          />
          Check permissions for role{defaultRole ? ` “${defaultRole}”` : ''}
        </label>
        <div className="flex flex-wrap items-center gap-1">
          <select className={INPUT} aria-label="Target" value={kind} onChange={(e) => { setKind(e.target.value as AuthorizeTarget['kind']); setVerdict(null); }}>
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {(kind === 'transition' || kind === 'function') && (
            <select className={INPUT} aria-label="Key" value={selectedKey} onChange={(e) => { setKey(e.target.value); setVerdict(null); }}>
              {options.length === 0 && <option value="">(none available)</option>}
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
          <input className={`w-24 ${INPUT}`} aria-label="Role" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          <input className={`w-20 ${INPUT}`} aria-label="Version" placeholder="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
          <button
            type="button"
            className="rounded bg-[var(--vscode-button-background)] px-2 py-1 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
            onClick={() => void run()}
            disabled={!target || running}
          >
            {running ? 'Running…' : 'Run'}
          </button>
          {verdict && <VerdictChip verdict={verdict} />}
        </div>
      </div>
    </details>
  );
}
```

- [ ] **Step 5: Badges in AvailableTransitions**

In `AvailableTransitions.tsx`:
- Import `import { verdictText, type AuthorizeVerdict } from '../utils/permissionChecks';`.
- Props: `/** Opt-in authorize verdicts per transition key, for the current role. */ permissions?: Readonly<Record<string, AuthorizeVerdict>>;` and destructure `permissions,`.
- Replace the non-readOnly `<button … </button>` branch with:

```tsx
                  <span key={`${kind}-${info.name}`} className="inline-flex items-center gap-1">
                    <button
                      className={style.buttonClass}
                      onClick={() => onTransitionClick(info)}
                      disabled={locked}
                      title={style.description}
                    >
                      {style.glyph ? `${style.glyph} ` : ''}
                      {flowLabels?.transitions[info.name] ?? info.name}
                    </button>
                    {permissions?.[info.name] && <PermissionBadge verdict={permissions[info.name]} />}
                  </span>
```

- Append:

```tsx
function PermissionBadge({ verdict }: { verdict: AuthorizeVerdict }) {
  const text = verdictText(verdict);
  const [glyph, tone] =
    verdict.kind === 'error'
      ? ['?', 'text-warning-text']
      : verdict.allowed
        ? ['✓', 'text-[var(--vscode-charts-green)]']
        : ['✕', 'text-[var(--vscode-errorForeground)]'];
  return (
    <span className={`text-[11px] font-semibold ${tone}`} title={text} aria-label={text}>
      {glyph}
    </span>
  );
}
```

- [ ] **Step 6: Store slice**

In `quickRunStore.ts` add `import type { PermissionCheckResult } from '../utils/permissionChecks';`, the fields

```ts
  /** Opt-in "Check permissions for role" (B6). A user preference — survives instance switches. */
  permissionChecksEnabled: boolean;
  /** Last opt-in check, keyed by `permissionCacheKey`. Instance-scoped. */
  permissionChecks: PermissionCheckResult | null;
  setPermissionChecksEnabled: (enabled: boolean) => void;
  setPermissionChecks: (result: PermissionCheckResult | null) => void;
```

initial values `permissionChecksEnabled: false, permissionChecks: null,`, setters `setPermissionChecksEnabled: (permissionChecksEnabled) => set({ permissionChecksEnabled }), setPermissionChecks: (permissionChecks) => set({ permissionChecks }),`, and `permissionChecks: null,` inside `resetInstanceScopedCaches`.

Also replace the `activeStateError` doc comment with:

```ts
  /**
   * Surfacing slot for `getState` polling failures (runtime 4xx/5xx,
   * connection errors). The dashboard renders it with `RuntimeErrorBanner`
   * so users see *why* polling stopped. Cleared on every successful poll round.
   */
```

- [ ] **Step 7: Dashboard**

In `InstanceDashboard.tsx`:
- Imports: `import { AuthorizePanel } from './AuthorizePanel';`, `import { RuntimeErrorBanner } from './RuntimeErrorBanner';`, `import { currentRoleFromHeaders } from '../utils/currentRole';`, and

```ts
import {
  checkableTransitionKeys,
  permissionCacheKey,
  resolveVerdict,
  runPermissionChecks,
  type AuthorizeVerdict,
} from '../utils/permissionChecks';
import type { AuthorizeTarget } from '../types/quickrun.types';
```

- After the `const liveIncident = …` line (Task 7) add:

```ts
  const permissionChecksEnabled = useQuickRunStore((s) => s.permissionChecksEnabled);
  const permissionChecks = useQuickRunStore((s) => s.permissionChecks);
  const setPermissionChecksEnabled = useQuickRunStore((s) => s.setPermissionChecksEnabled);
  const currentRole = currentRoleFromHeaders(liveHeaders());
  const permissionKey =
    activeState && activeTabId ? permissionCacheKey(activeState.eTag, `${activeTabId}:${activeState.state}`, currentRole) : null;
  const currentChecks = permissionChecksEnabled && permissionChecks?.key === permissionKey ? permissionChecks : null;

  // Opt-in checks: one authorize call per transition + queryRoles, cached per
  // (eTag, role). Skipped while a poll round runs — every busy tick replaces
  // `activeState` and would otherwise restart the batch.
  useEffect(() => {
    if (!permissionChecksEnabled || !permissionKey || !activeState || !activeTabId || pollingInstanceId) return;
    if (!domain || !workflowKey) return;
    if (useQuickRunStore.getState().permissionChecks?.key === permissionKey) return;
    const instanceId = activeTabId;
    const headers = liveHeaders();
    let cancelled = false;
    void runPermissionChecks({
      key: permissionKey,
      role: currentRole,
      transitionKeys: checkableTransitionKeys(activeState.transitions ?? [], activeState.sharedTransitions ?? []),
      authorize: (target, role) =>
        QuickRunApi.authorize({ domain, workflowKey, instanceId, target, ...(role ? { role } : {}), headers, runtimeUrl: environmentUrl }),
    }).then((result) => {
      if (cancelled || useQuickRunStore.getState().activeTabId !== instanceId) return;
      useQuickRunStore.getState().setPermissionChecks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [permissionChecksEnabled, permissionKey, activeState, activeTabId, pollingInstanceId, domain, workflowKey, currentRole, liveHeaders, environmentUrl]);

  const runAuthorize = useCallback(
    (request: { target: AuthorizeTarget; role?: string; version?: string }): Promise<AuthorizeVerdict> => {
      if (!activeTabId || !domain || !workflowKey) {
        return Promise.resolve({ kind: 'error', message: 'No active instance.' });
      }
      return resolveVerdict(
        QuickRunApi.authorize({
          domain,
          workflowKey,
          instanceId: activeTabId,
          target: request.target,
          ...(request.role ? { role: request.role } : {}),
          ...(request.version ? { version: request.version } : {}),
          headers: liveHeaders(),
          runtimeUrl: environmentUrl,
        }),
      );
    },
    [activeTabId, domain, workflowKey, liveHeaders, environmentUrl],
  );
```

- On `<AvailableTransitions … />` add `permissions={currentChecks?.transitions}`.
- After the `{hasFunctions && ( <InstanceFunctions … /> )}` block add:

```tsx
      <AuthorizePanel
        key={activeTabId ?? ''}
        transitionKeys={checkableTransitionKeys(transitions, sharedTransitions)}
        functionKeys={(functionCatalog ?? []).map((f) => f.name)}
        defaultRole={currentRole}
        onRun={runAuthorize}
        checksEnabled={permissionChecksEnabled}
        onChecksEnabledChange={setPermissionChecksEnabled}
        visibility={currentChecks?.queryRoles}
      />
```

- Replace the polling-error block (the comment `{/* Polling error banner — surfaced when \`getState\` fails …*/}` and `{activeStateError && ( <PollingErrorBanner … /> )}`) with:

```tsx
      {/* Why polling stopped — runtime error body, status and trace id. */}
      {activeStateError && (
        <RuntimeErrorBanner title="Polling stopped" error={activeStateError} onDismiss={() => setActiveStateError(null)} />
      )}
```

- Delete `// ── Polling Error Banner ──…`, `interface PollingErrorBannerProps`, `function PollingErrorBanner`, `function pickString` and `function pickNumber` (the runtime no longer answers queryRoles with in-process 403s; `authorize` is the only place that question is answered).

- [ ] **Step 8: Run tests, stale-comment check, type-check**

Run: Step 2 command → PASS. Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run && pnpm --filter @vnext-forge-studio/designer-ui build` → PASS, exit 0.
Run: `grep -rn "110001\|PollingErrorBanner" packages/designer-ui/src/modules/quick-run` → no output.

- [ ] **Step 9: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): authorize panel and opt-in permission badges

Ask the runtime's authorize oracle about a transition, function, queryRoles or
ack; optionally badge every transition and show instance visibility for the
current role, cached per (eTag, role). Removes the stale queryRoles-403 banner.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Human Tasks tab beside the instance list

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/humanTasks.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/humanTasks.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/HumanTaskList.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/HumanTaskList.vitest.test.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/components/HumanTasksPanel.tsx`
- Create: `packages/designer-ui/src/modules/quick-run/components/QuickRunSidebar.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/QuickRunShell.tsx`

**Interfaces:**
- Consumes: `QuickRunApi.getHumanTasks`, `HumanTaskItem` (Task 3); `currentRoleFromHeaders`, `withRoleHeaders` (Task 3); `useOpenInstance`, `OpenInstanceTarget` (Task 8); `useWorkflowFileResolver` (`modules/vnext-workspace/resolveWorkflowFileByKey.ts`); `OpenSubFlowTarget` (existing).
- Produces: `humanTaskOpenAction(row, currentWorkflowKey): 'openInstance' | 'openWorkflow'`; `instanceTargetFromHumanTask(row, domain, workflowKey): OpenInstanceTarget`; `humanTaskLabel(row): string`; `HumanTaskList` props; `HumanTasksPanel({ onOpenSubFlowTarget? })`; `QuickRunSidebar({ onOpenSubFlowTarget? })`.

- [ ] **Step 1: Write the failing tests**

`utils/humanTasks.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { HumanTaskItem } from '../types/quickrun.types';
import { humanTaskLabel, humanTaskOpenAction, instanceTargetFromHumanTask } from './humanTasks';

const ROW: HumanTaskItem = {
  instanceId: 'APP-1',
  id: '11111111-2222-3333-4444-555555555555',
  workflow: 'ht-a',
  title: 'Approve application',
  description: null,
  createdAt: '2026-09-20T10:00:00Z',
};

describe('humanTaskOpenAction', () => {
  it('opens the instance when the row belongs to the current workflow', () => {
    expect(humanTaskOpenAction(ROW, 'ht-a')).toBe('openInstance');
    expect(humanTaskOpenAction({ ...ROW, workflow: null }, 'ht-a')).toBe('openInstance');
  });

  it('opens the other workflow otherwise', () => {
    expect(humanTaskOpenAction(ROW, 'ht-b')).toBe('openWorkflow');
  });
});

describe('instanceTargetFromHumanTask', () => {
  it('opens the ROOT by its own id, labelled by its business key', () => {
    expect(instanceTargetFromHumanTask(ROW, 'core', 'ht-a')).toEqual({
      id: ROW.id,
      key: 'APP-1',
      domain: 'core',
      workflowKey: 'ht-a',
      status: 'A',
      effectiveStatus: 'A',
      startedAt: '2026-09-20T10:00:00Z',
    });
  });
});

describe('humanTaskLabel', () => {
  it('prefers the title, then the business key, then the id', () => {
    expect(humanTaskLabel(ROW)).toBe('Approve application');
    expect(humanTaskLabel({ ...ROW, title: '  ' })).toBe('APP-1');
    expect(humanTaskLabel({ ...ROW, title: null, instanceId: null })).toBe(ROW.id);
  });
});
```

`components/HumanTaskList.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { HumanTaskItem } from '../types/quickrun.types';
import { HumanTaskList, type HumanTaskListProps } from './HumanTaskList';

const ROWS: HumanTaskItem[] = [
  { instanceId: 'APP-1', id: 'id-1', workflow: 'ht-a', title: 'Approve A', description: 'Level A', createdAt: '2026-09-20T10:00:00Z' },
  { instanceId: 'APP-2', id: 'id-2', workflow: 'ht-b', title: 'Approve B', description: null, createdAt: '2026-09-20T11:00:00Z' },
];

const render = (over: Partial<HumanTaskListProps> = {}) =>
  renderToStaticMarkup(
    createElement(HumanTaskList, {
      rows: ROWS,
      truncated: false,
      loading: false,
      error: null,
      currentWorkflowKey: 'ht-a',
      canOpenOtherWorkflows: true,
      onOpen: () => undefined,
      ...over,
    }),
  );

describe('HumanTaskList', () => {
  it('renders title, description, workflow and business key', () => {
    const html = render();
    for (const text of ['Approve A', 'Level A', 'ht-b', 'APP-2']) expect(html).toContain(text);
  });

  it('warns when the runtime truncated the list', () => {
    expect(render({ truncated: true })).toContain('The runtime truncated this list');
  });

  it('disables rows of other workflows when the host cannot open them', () => {
    const html = render({ canOpenOtherWorkflows: false });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Approve B/);
  });

  it('has an empty state', () => {
    expect(render({ rows: [] })).toContain('No human tasks for this role');
  });

  it('shows the runtime error', () => {
    expect(render({ error: { code: 'X', message: 'Runtime returned HTTP 500', details: { httpStatus: 500 } } })).toContain(
      'Human-task request failed',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/humanTasks.vitest.test.ts src/modules/quick-run/components/HumanTaskList.vitest.test.tsx`
Expected: FAIL — missing modules.

- [ ] **Step 3: Implement the helpers and list**

`utils/humanTasks.ts`:

```ts
import type { HumanTaskItem } from '../types/quickrun.types';
import type { OpenInstanceTarget } from './instanceTarget';

export type HumanTaskOpenAction = 'openInstance' | 'openWorkflow';

/** Same workflow → open the root instance here; another workflow → its Quick Runner. */
export function humanTaskOpenAction(row: HumanTaskItem, currentWorkflowKey: string): HumanTaskOpenAction {
  return !row.workflow || row.workflow === currentWorkflowKey ? 'openInstance' : 'openWorkflow';
}

/**
 * The row is the ROOT instance (its text comes from the leaf). `id` is the
 * root's own id — unique even for a SubProcess, whose `instanceId` is not.
 * The list only returns effectively Active instances; the first poll corrects
 * the placeholder statuses.
 */
export function instanceTargetFromHumanTask(row: HumanTaskItem, domain: string, workflowKey: string): OpenInstanceTarget {
  return {
    id: row.id,
    key: row.instanceId || row.id,
    domain,
    workflowKey: row.workflow || workflowKey,
    status: 'A',
    effectiveStatus: 'A',
    startedAt: row.createdAt,
  };
}

export function humanTaskLabel(row: HumanTaskItem): string {
  return row.title?.trim() || row.instanceId || row.id;
}
```

`components/HumanTaskList.tsx`:

```tsx
import type { HumanTaskItem } from '../types/quickrun.types';
import { humanTaskLabel, humanTaskOpenAction } from '../utils/humanTasks';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

export interface HumanTaskListProps {
  rows: readonly HumanTaskItem[];
  truncated: boolean;
  loading: boolean;
  error: RuntimeErrorLike | null;
  currentWorkflowKey: string;
  /** The host can open another workflow's Quick Runner. */
  canOpenOtherWorkflows: boolean;
  onOpen: (row: HumanTaskItem) => void;
}

export function HumanTaskList({
  rows,
  truncated,
  loading,
  error,
  currentWorkflowKey,
  canOpenOtherWorkflows,
  onOpen,
}: HumanTaskListProps) {
  return (
    <div className="flex flex-col">
      {error && <RuntimeErrorBanner title="Human-task request failed" error={error} />}
      {truncated && (
        <p role="status" className="mx-2 mt-2 rounded border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text">
          The runtime truncated this list. Refresh with the cache bypassed or narrow the role to see the rest.
        </p>
      )}
      {loading && rows.length === 0 && (
        <p className="py-4 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="py-6 text-center text-xs text-[var(--vscode-descriptionForeground)]">No human tasks for this role</p>
      )}
      <ul className="px-1 py-2">
        {rows.map((row) => {
          const other = humanTaskOpenAction(row, currentWorkflowKey) === 'openWorkflow';
          const blocked = other && !canOpenOtherWorkflows;
          return (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                onClick={() => onOpen(row)}
                disabled={blocked}
                title={
                  blocked
                    ? "Open this workflow's Quick Runner to act on this task"
                    : other
                      ? `Open the ${row.workflow} Quick Runner`
                      : 'Open the root instance'
                }
              >
                <span className="truncate font-medium">{humanTaskLabel(row)}</span>
                {row.description && (
                  <span className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">{row.description}</span>
                )}
                <span className="flex items-center gap-1 text-[9px] text-[var(--vscode-descriptionForeground)]">
                  {row.workflow && (
                    <span className="rounded bg-[var(--vscode-badge-background)] px-1 text-[var(--vscode-badge-foreground)]">
                      {row.workflow}
                    </span>
                  )}
                  <span className="truncate font-mono">{row.instanceId || row.id}</span>
                  <span className="ml-auto opacity-70">
                    {Number.isNaN(Date.parse(row.createdAt)) ? row.createdAt : new Date(row.createdAt).toLocaleString()}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: Step 2 command. Expected: PASS.

- [ ] **Step 5: Panel, sidebar and shell**

`components/HumanTasksPanel.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { useOpenInstance } from '../hooks/useOpenInstance';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import type { HumanTaskItem, OpenSubFlowTarget } from '../types/quickrun.types';
import { currentRoleFromHeaders, withRoleHeaders } from '../utils/currentRole';
import { humanTaskOpenAction, instanceTargetFromHumanTask } from '../utils/humanTasks';
import { HumanTaskList } from './HumanTaskList';
import type { RuntimeErrorLike } from './RuntimeErrorBanner';

const INPUT =
  'min-w-0 flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)]';

/** Which human tasks may this role act on in this domain (spec D5). */
export function HumanTasksPanel({ onOpenSubFlowTarget }: { onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void }) {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const toolWideHeaders = useQuickRunStore((s) => s.toolWideHeaders);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const openInstance = useOpenInstance();
  const resolveWorkflowFile = useWorkflowFileResolver();

  const baseHeaders = useMemo(() => ({ ...toolWideHeaders, ...globalHeaders }), [toolWideHeaders, globalHeaders]);
  const [role, setRole] = useState(() => currentRoleFromHeaders(baseHeaders) ?? '');
  const [cacheOverride, setCacheOverride] = useState(false);
  const [rows, setRows] = useState<HumanTaskItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RuntimeErrorLike | null>(null);

  const load = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    try {
      const res = await QuickRunApi.getHumanTasks({
        domain,
        cacheOverride,
        headers: withRoleHeaders(baseHeaders, role),
        runtimeUrl: environmentUrl,
      });
      if (res.success) {
        setRows(res.data.items);
        setTruncated(res.data.truncated);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError({ code: 'RUNTIME_CONNECTION_FAILED', message: err instanceof Error ? err.message : 'Could not reach the runtime.' });
    } finally {
      setLoading(false);
    }
  }, [domain, cacheOverride, baseHeaders, role, environmentUrl]);

  // Load once per domain/runtime; later refreshes are explicit (Refresh button).
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void loadRef.current();
  }, [domain, environmentUrl]);

  const handleOpen = useCallback(
    (row: HumanTaskItem) => {
      if (humanTaskOpenAction(row, workflowKey) === 'openInstance') {
        openInstance(instanceTargetFromHumanTask(row, domain, workflowKey));
        return;
      }
      const target = row.workflow;
      if (!onOpenSubFlowTarget || !target) return;
      void resolveWorkflowFile(target, domain).then((resolved) => {
        if (!resolved) return;
        onOpenSubFlowTarget({
          intent: 'quickrun',
          domain,
          workflowKey: target,
          workflowFilePath: resolved.path,
          ...(resolved.route ? { route: resolved.route } : {}),
        });
      });
    },
    [workflowKey, domain, openInstance, onOpenSubFlowTarget, resolveWorkflowFile],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1.5 border-b border-[var(--vscode-panel-border)] px-3 py-2">
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--vscode-descriptionForeground)]" htmlFor="quickrun-ht-role">
            Role
          </label>
          <input
            id="quickrun-ht-role"
            className={INPUT}
            value={role}
            placeholder="From headers"
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
          <input type="checkbox" checked={cacheOverride} onChange={(e) => setCacheOverride(e.target.checked)} />
          Bypass the runtime cache
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HumanTaskList
          rows={rows}
          truncated={truncated}
          loading={loading}
          error={error}
          currentWorkflowKey={workflowKey}
          canOpenOtherWorkflows={!!onOpenSubFlowTarget}
          onOpen={handleOpen}
        />
      </div>
    </div>
  );
}
```

`components/QuickRunSidebar.tsx`:

```tsx
import { useState } from 'react';

import type { OpenSubFlowTarget } from '../types/quickrun.types';
import { HumanTasksPanel } from './HumanTasksPanel';
import { InstanceListPanel } from './InstanceListPanel';

type SidebarTab = 'instances' | 'humanTasks';

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: 'instances', label: 'Instances' },
  { id: 'humanTasks', label: 'Human Tasks' },
];

/** Left pane: flow instances, or the human tasks waiting for the current role. */
export function QuickRunSidebar({ onOpenSubFlowTarget }: { onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void }) {
  const [tab, setTab] = useState<SidebarTab>('instances');
  return (
    <div className="flex h-full flex-col bg-[var(--vscode-sideBar-background)]">
      <div className="flex border-b border-[var(--vscode-panel-border)]" role="tablist" aria-label="Quick Run sidebar">
        {SIDEBAR_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium ${
              tab === t.id
                ? 'border-b-2 border-b-[var(--vscode-focusBorder)] text-[var(--vscode-foreground)]'
                : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'instances' ? (
          <InstanceListPanel />
        ) : (
          <HumanTasksPanel {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})} />
        )}
      </div>
    </div>
  );
}
```

`QuickRunShell.tsx`: replace `import { InstanceListPanel } from './components/InstanceListPanel';` with `import { QuickRunSidebar } from './components/QuickRunSidebar';` and `<InstanceListPanel />` with `<QuickRunSidebar {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})} />`.

- [ ] **Step 6: Type-check and run the quick-run suite**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run`
Expected: exit 0; PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): Human Tasks tab beside the instance list

Lists the domain's human tasks for a role (cache bypass, truncation warning);
a row opens its root instance, or the owning workflow's Quick Runner.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Tasks tab in the ContextPanel

**Files:**
- Create: `packages/designer-ui/src/modules/quick-run/utils/taskHistory.ts`
- Test: `packages/designer-ui/src/modules/quick-run/utils/taskHistory.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/quick-run/components/TasksTab.tsx`
- Test: `packages/designer-ui/src/modules/quick-run/components/TasksTab.vitest.test.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/types/quickrun.types.ts` (`ContextPanelTab`)
- Modify: `packages/designer-ui/src/modules/quick-run/store/quickRunStore.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/components/ContextPanel.tsx`

**Interfaces:**
- Consumes: `QuickRunApi.getTaskHistory`, `TaskHistoryItem` (Task 3); `formatCountdown` (Task 4); `RuntimeErrorBanner`.
- Produces: `TaskGroup { key; transitionKey; fromState; toState: string | null; items: TaskHistoryItem[] }`; `groupTasksByTransition(items)`; `formatDurationMs(ms)`; `taskStatusTone(status)`; `TasksTabContent({ items, loading, error })`; `ContextPanelTab` gains `'tasks'`; store `activeTaskHistory`, `activeTaskHistoryLoading`, `activeTaskHistoryError` + setters.

- [ ] **Step 1: Write the failing tests**

`utils/taskHistory.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs, groupTasksByTransition, taskStatusTone } from './taskHistory';

const item = (over: Partial<TaskHistoryItem>): TaskHistoryItem => ({
  id: 'x', taskKey: 't', transitionKey: 'approve', fromState: 'draft', toState: 'approved', triggerType: 'manual',
  status: 'completed', businessStatus: 'success', startedAt: '2026-09-20T10:00:00Z', ...over,
});

describe('groupTasksByTransition', () => {
  it('groups consecutive tasks of one transition and keeps repeats apart', () => {
    const groups = groupTasksByTransition([
      item({ id: '1' }),
      item({ id: '2' }),
      item({ id: '3', transitionKey: 'submit', fromState: 'approved', toState: null }),
      item({ id: '4' }),
    ]);
    expect(groups.map((g) => [g.transitionKey, g.toState, g.items.map((i) => i.id)])).toEqual([
      ['approve', 'approved', ['1', '2']],
      ['submit', null, ['3']],
      ['approve', 'approved', ['4']],
    ]);
    expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  });
});

describe('formatDurationMs', () => {
  it.each([
    [184.2, '184 ms'],
    [1_500, '1.5 s'],
    [61_000, '1m 1s'],
  ])('%d → %s', (ms, expected) => expect(formatDurationMs(ms)).toBe(expected));

  it('returns null without a duration', () => {
    expect(formatDurationMs(null)).toBeNull();
    expect(formatDurationMs(undefined)).toBeNull();
  });
});

describe('taskStatusTone', () => {
  it('maps platform and business statuses', () => {
    expect(taskStatusTone('completed')).toBe('success');
    expect(taskStatusTone('success')).toBe('success');
    expect(taskStatusTone('faulted')).toBe('danger');
    expect(taskStatusTone('failed')).toBe('danger');
    expect(taskStatusTone('busy')).toBe('busy');
    expect(taskStatusTone('waiting')).toBe('busy');
    expect(taskStatusTone('unknown')).toBe('neutral');
  });
});
```

`components/TasksTab.vitest.test.tsx`:

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { TaskHistoryItem } from '../types/quickrun.types';
import { TasksTabContent } from './TasksTab';

const FAULTED: TaskHistoryItem = {
  id: '1', taskKey: 'call-core', transitionKey: 'approve', fromState: 'draft', toState: null, triggerType: 'manual',
  status: 'faulted', businessStatus: 'failed', startedAt: '2026-09-20T10:00:00Z', durationMs: 1500, error: 'Upstream 503',
};

describe('TasksTabContent', () => {
  it('has an empty state', () => {
    expect(renderToStaticMarkup(createElement(TasksTabContent, { items: [], loading: false, error: null }))).toContain(
      'No tasks ran on this instance yet',
    );
  });

  it('groups by transition with status, business status, duration and the error', () => {
    const html = renderToStaticMarkup(createElement(TasksTabContent, { items: [FAULTED], loading: false, error: null }));
    for (const text of ['approve', 'draft', 'call-core', 'faulted', 'failed', '1.5 s', 'Upstream 503']) {
      expect(html).toContain(text);
    }
  });

  it('shows the runtime error', () => {
    const html = renderToStaticMarkup(
      createElement(TasksTabContent, { items: null, loading: false, error: { code: 'X', message: 'Runtime returned HTTP 403' } }),
    );
    expect(html).toContain('Task history request failed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/utils/taskHistory.vitest.test.ts src/modules/quick-run/components/TasksTab.vitest.test.tsx`
Expected: FAIL — missing modules.

- [ ] **Step 3: Implement**

`utils/taskHistory.ts`:

```ts
import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatCountdown } from './countdown';

export interface TaskGroup {
  key: string;
  transitionKey: string;
  fromState: string;
  toState: string | null;
  items: TaskHistoryItem[];
}

/**
 * Consecutive journal rows of the same transition (key + from/to state) form
 * one group. Rows arrive StartedAt ascending, so a transition fired twice
 * yields two groups.
 */
export function groupTasksByTransition(items: readonly TaskHistoryItem[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  for (const item of items) {
    const toState = item.toState ?? null;
    const last = groups[groups.length - 1];
    if (last && last.transitionKey === item.transitionKey && last.fromState === item.fromState && last.toState === toState) {
      last.items.push(item);
      continue;
    }
    groups.push({ key: `${groups.length}:${item.transitionKey}`, transitionKey: item.transitionKey, fromState: item.fromState, toState, items: [item] });
  }
  return groups;
}

export function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return formatCountdown(ms);
}

export type TaskTone = 'success' | 'danger' | 'busy' | 'neutral';

/** Tone for a platform status (waiting|busy|completed|faulted) or business status (unknown|success|failed). */
export function taskStatusTone(status: string): TaskTone {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'success';
    case 'faulted':
    case 'failed':
      return 'danger';
    case 'busy':
    case 'waiting':
      return 'busy';
    default:
      return 'neutral';
  }
}
```

`components/TasksTab.tsx`:

```tsx
import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs, groupTasksByTransition, taskStatusTone, type TaskTone } from '../utils/taskHistory';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

const TONE_CLASS: Record<TaskTone, string> = {
  success: 'border-success-border bg-success text-success-foreground',
  danger: 'border-destructive-border bg-destructive-muted text-destructive-text',
  busy: 'border-warning-border bg-warning text-warning-foreground',
  neutral: 'border-border bg-muted text-muted-text',
};

function StatusChip({ value, label }: { value: string; label: string }) {
  return (
    <span className={`rounded border px-1 py-0.5 text-[9px] font-medium ${TONE_CLASS[taskStatusTone(value)]}`} title={label}>
      {value}
    </span>
  );
}

/**
 * The instance's task journal (`…/functions/tasks`), grouped per transition.
 * Props-only so the SSR test harness can assert it.
 */
export function TasksTabContent({
  items,
  loading,
  error,
}: {
  items: readonly TaskHistoryItem[] | null;
  loading: boolean;
  error: RuntimeErrorLike | null;
}) {
  if (error) return <RuntimeErrorBanner title="Task history request failed" error={error} />;
  if (loading && !items) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  }
  if (!items || items.length === 0) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">No tasks ran on this instance yet</p>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {groupTasksByTransition(items).map((group) => (
        <section key={group.key} className="flex flex-col gap-1">
          <header className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
            <span className="font-semibold text-[var(--vscode-foreground)]">{group.transitionKey}</span>
            <span>
              {group.fromState} → {group.toState ?? 'in progress'}
            </span>
          </header>
          <ol className="flex flex-col gap-1 border-l border-[var(--vscode-panel-border)] pl-2">
            {group.items.map((task) => {
              const duration = formatDurationMs(task.durationMs);
              return (
                <li key={task.id} className="flex flex-col gap-0.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-mono">{task.taskKey}</span>
                    <StatusChip value={task.status} label="Platform status" />
                    <StatusChip value={task.businessStatus} label="Business status" />
                    {duration && <span className="ml-auto text-[10px] text-[var(--vscode-descriptionForeground)]">{duration}</span>}
                  </div>
                  {task.error && (
                    <details className="text-[10px]">
                      <summary className="cursor-pointer text-[var(--vscode-errorForeground)]">Error</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[var(--vscode-foreground)]">{task.error}</pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: Step 2 command. Expected: PASS.

- [ ] **Step 5: Store, tab and loading**

`quickrun.types.ts`: `export type ContextPanelTab = 'data' | 'history' | 'tasks' | 'correlations' | 'raw';`

`quickRunStore.ts`: import `TaskHistoryItem`; add

```ts
  /** `…/functions/tasks` of the active instance; loaded by the Tasks tab. */
  activeTaskHistory: TaskHistoryItem[] | null;
  activeTaskHistoryLoading: boolean;
  activeTaskHistoryError: { code: string; message: string; details?: Record<string, unknown> } | null;
  setActiveTaskHistory: (items: TaskHistoryItem[] | null) => void;
  setActiveTaskHistoryLoading: (loading: boolean) => void;
  setActiveTaskHistoryError: (error: { code: string; message: string; details?: Record<string, unknown> } | null) => void;
```

initial `activeTaskHistory: null, activeTaskHistoryLoading: false, activeTaskHistoryError: null,`; setters `setActiveTaskHistory: (activeTaskHistory) => set({ activeTaskHistory }), setActiveTaskHistoryLoading: (activeTaskHistoryLoading) => set({ activeTaskHistoryLoading }), setActiveTaskHistoryError: (activeTaskHistoryError) => set({ activeTaskHistoryError }),`; and in `resetInstanceScopedCaches` add `activeTaskHistory: null, activeTaskHistoryLoading: false, activeTaskHistoryError: null,`.

`ContextPanel.tsx`:
- Import `import { TasksTabContent } from './TasksTab';`.
- In `TABS` insert `{ id: 'tasks', label: 'Tasks' },` after the History row.
- After the `activeHistory…` selectors add:

```ts
  const activeTaskHistory = useQuickRunStore((s) => s.activeTaskHistory);
  const activeTaskHistoryLoading = useQuickRunStore((s) => s.activeTaskHistoryLoading);
  const activeTaskHistoryError = useQuickRunStore((s) => s.activeTaskHistoryError);
  const stateEtag = activeState?.eTag;
```

- After `loadHistory` add:

```ts
  const loadTasks = useCallback(async () => {
    if (!activeTabId || !domain || !workflowKey) return;
    const store = useQuickRunStore.getState();
    store.setActiveTaskHistoryLoading(true);
    try {
      const response = await QuickRunApi.getTaskHistory({ domain, workflowKey, instanceId: activeTabId, headers: globalHeaders, runtimeUrl: environmentUrl });
      if (useQuickRunStore.getState().activeTabId !== activeTabId) return;
      if (response.success) {
        store.setActiveTaskHistory(response.data.items);
        store.setActiveTaskHistoryError(null);
      } else {
        store.setActiveTaskHistoryError(response.error);
      }
    } catch (err) {
      store.setActiveTaskHistoryError({ code: 'THROWN', message: err instanceof Error ? err.message : String(err) });
    } finally {
      useQuickRunStore.getState().setActiveTaskHistoryLoading(false);
    }
  }, [activeTabId, domain, workflowKey, globalHeaders, environmentUrl]);

  // Tasks: load when the tab opens and whenever the state's eTag moves
  // (a new transition ran), but never during a poll round.
  useEffect(() => {
    if (contextPanelTab !== 'tasks' || !activeTabId || pollingInstanceId) return;
    void loadTasks();
  }, [contextPanelTab, activeTabId, pollingInstanceId, stateEtag, loadTasks]);
```

- In the tab content after the History branch add:

```tsx
        {contextPanelTab === 'tasks' && (
          <TasksTabContent items={activeTaskHistory} loading={activeTaskHistoryLoading} error={activeTaskHistoryError} />
        )}
```

- [ ] **Step 6: Type-check and run the quick-run suite**

Run: `pnpm --filter @vnext-forge-studio/designer-ui build && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run`
Expected: exit 0; PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run
git commit -m "feat(quick-run): Tasks tab with the instance's task journal

Per-transition timeline with platform and business status, duration and
fault reason; loads on tab open and refreshes when the state eTag moves.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Phase B gate

**Files:** none (verification only).

- [ ] **Step 1: Full builds**

Run: `pnpm build`
Expected: Turborepo finishes with every task successful (extension esbuild + web vite included).

- [ ] **Step 2: Test suites**

Run: `pnpm --filter @vnext-forge-studio/services-core test && pnpm --filter @vnext-forge-studio/app-contracts test && pnpm --filter @vnext-forge-studio/designer-ui test && pnpm --filter @vnext-forge-studio/server test`
Expected: PASS, no skipped new tests.

- [ ] **Step 3: Lint touched files**

Run: `git diff --name-only main...HEAD -- '*.ts' '*.tsx' | grep -v '/unreleased/' | xargs pnpm exec eslint`
Expected: no new errors in the files touched by Phase B (compare against the Phase A gate output for pre-existing ones).

- [ ] **Step 4: B9 — sync response extensions stay sourced from getData**

Run: `grep -rn "\.extensions" packages/designer-ui/src/modules/quick-run --include='*.ts' --include='*.tsx' | grep -v vitest | grep -v "activeData\|data\.extensions\|ctx\.extensions"`
Expected: no output (verified empty on the Phase A head) — every `extensions` read goes through `getData` (`activeData` / `data.extensions` / the URN-binding context); nothing reads it from `startInstance` / `fireTransition` results (both typed `{ id; key; status }` in `QuickRunApi.ts`).

- [ ] **Step 5: End-to-end check against a local runtime (web shell)**

With a local runtime and the vnext-example domain published, start the web shell with the preview tools (`.claude/launch.json`) and verify, taking a screenshot of each:
1. `timeout-lab`: the timeout chip counts down and turns to "Settling…"; scheduled entries are read-only with a countdown.
2. A workflow with `interaction.longPoll.terminate: true` (`subflow-override-lab`): after the triggering transition polling stops, the banner shows the countdown, "Acknowledge" resumes polling; with a refused role the "Acknowledge failed" banner appears; "Wait for fallback" resumes at the deadline.
3. `error-boundary-lab`: the dashboard incident alert expands and loads the active incident; "Past incidents" pages; the list and status bar show the incident badge.
4. `authorization-chain-lab`: the Authorization panel returns Allowed/Denied with the HTTP status; "Check permissions for role" badges the transitions.
5. `human-task-chain`: the Human Tasks tab lists rows for `ht-approver`; clicking opens the root instance (or the other workflow's Quick Runner).
6. Any instance with tasks: the Tasks tab groups the journal per transition.

If no local runtime is available, record "E2E not run" in the report — do not claim it.

- [ ] **Step 6: Report**

Summarize per task: tests added, commands run with their results, screenshots (or "E2E not run"). Do not claim completion without the command output.

---

## Self-Review

**Spec coverage**
- B0: Passive terminal → Task 4 (`stopsPolling`, `shouldFetchView`), Task 5 (poll loop). Raw vs effective status → Task 8 (`instanceTargetFromListItem`, `useOpenInstance`, store clears `effectiveStatus` on poll, badges use `displayStatus`). Details row effective status → Task 8. `InstanceType | null` → Task 3. `IncidentSection` move + drop `deps.inline` → Task 7. Scheduled `aria-disabled` → Task 6.
- B1: `getIncidents`, `getActiveIncident` (404 `Instance:100037` → null), `getTaskHistory` → Task 1; `authorize` (200/403 → verdict), `getHumanTasks` (truncated header, cache override), ack `role` + non-2xx surfaced → Task 2; wrappers → Task 3.
- B2: reducer `polling → awaitingAck → resuming → polling` → Task 4; stop polling, view, countdown, Acknowledge (current role) / Wait for fallback, resume after ack or expiry, transitions disabled with "Awaiting acknowledge", ack errors via `RuntimeErrorBanner` → Task 5.
- B3: timeout chip (countdown, "Settling…", annotations), scheduled rows (clock glyph, countdown, annotations) → Task 6.
- B4: alert strip → lazy `getActiveIncident` card (state/transition/task/message/errorCode/statusCode/boundary/traceId), "Past incidents" paging, list + status-bar badges → Task 7.
- B5: details `type` + `effectiveStatus`; `INSTANCE_FIELDS` `instanceType` (eq/ne/in/nin, Root/SubFlow/SubProcess) and `effectiveStatus` (status) → Task 8.
- B6: panel (transition/function/queryRoles/ack, role, version, verdict chip + HTTP status), opt-in "Check permissions for role" per transition + queryRoles, cached per (eTag, role), badges + visibility indicator, stale 403 comments/flows removed (`useQuickRunPolling` in Task 5, store + dashboard banner in Task 9) → Task 9.
- B7: tab beside the instance list, role picker from header role, cache override, truncated warning, rows, root instance / other workflow's Quick Runner → Task 10.
- B8: `tasks` tab, per-transition timeline, status + businessStatus, duration, expandable error, load on open + eTag refresh → Task 11.
- B9: verification grep → Task 12 Step 4.

**Type consistency** — checked names across tasks: `interactionReducer` / `INITIAL_INTERACTION` / `AwaitingAckPhase` / `remainingMs` (Task 4 → 5); `dispatchInteraction`, `acknowledgeInteraction`, `useInteractionDriver`, `useNow` (Task 5 → 6, 7); `scheduleCountdownLabel`, `formatCountdown` (Tasks 4/6 → 11); `IncidentLoaders`, `createIncidentLoaders`, `IncidentBadge` (Task 7); `OpenInstanceTarget`, `useOpenInstance` (Task 8 → 10); `AuthorizeVerdict`, `resolveVerdict`, `checkableTransitionKeys`, `permissionCacheKey` (Task 9); `liveHeaders` defined in Task 5 and reused in Tasks 7/9; `clockNow` defined in Task 6 before Task 7's insertion point; `AuthorizeTarget` / `AuthorizeResult` / `HumanTaskItem` / `TaskHistoryItem` defined in Task 3.
