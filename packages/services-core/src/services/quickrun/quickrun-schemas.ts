import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────────────

const workflowIdentifier = {
  domain: z.string().min(1),
  workflowKey: z.string().min(1),
}

const headersSchema = z.record(z.string(), z.string()).optional()

const instanceStatusSchema = z.enum(['A', 'B', 'C', 'F', 'P'])
const instanceTypeSchema = z.enum(['R', 'S', 'P'])

/** Incident block: link shape (runtime >= 2026-09-07) or legacy embedded content. */
const incidentBlockSchema = z
  .object({ hasActiveIncident: z.boolean() })
  .passthrough()

// ── Start Instance ───────────────────────────────────────────────────────────

export const quickrunStartInstanceParams = z.object({
  ...workflowIdentifier,
  sync: z.boolean().optional().default(false),
  version: z.string().optional(),
  key: z.string().optional(),
  stage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

// 200 (sync) returns the full instance, 202 (async) only `{ id, status }`.
// Which one arrives follows the effective mode — the definition's
// executionType overrides ?sync= on runtime 0.0.99+ — so `key` is optional.
export const quickrunStartInstanceResult = z.object({
  id: z.string(),
  key: z.string().optional(),
  status: instanceStatusSchema,
})

// ── Fire Transition ──────────────────────────────────────────────────────────

export const quickrunFireTransitionParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  transitionKey: z.string().min(1),
  sync: z.boolean().optional().default(false),
  key: z.string().optional(),
  stage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunFireTransitionResult = z.object({
  id: z.string(),
  key: z.string().optional(),
  status: instanceStatusSchema,
})

// ── Get State ────────────────────────────────────────────────────────────────

export const quickrunGetStateParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  /** Conditional-request support: sent as `If-None-Match` when present. A
   *  304 response (see `quickrunGetStateResult.notModified`) means the
   *  caller's cached state is still current. */
  ifNoneMatch: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

const runtimeLabelSchema = z.object({ language: z.string(), label: z.string() })

/** Target state description (runtime 0.0.99); only `key` when it does not resolve. */
const transitionTargetSchema = z.object({
  key: z.string(),
  stateType: z.string().optional(),
  stateSubType: z.string().optional(),
  labels: z.array(runtimeLabelSchema).optional(),
  subFlow: z.string().optional(),
})

const transitionInfoSchema = z.object({
  name: z.string(),
  view: z.object({
    hasView: z.boolean(),
    loadData: z.boolean(),
    href: z.string(),
  }).optional(),
  schema: z.object({
    hasSchema: z.boolean(),
    href: z.string(),
  }).optional(),
  href: z.string(),
  kind: z.string().optional(),
  executeAtUtc: z.string().optional(),
  annotations: z.record(z.string(), z.string()).nullable().optional(),
  labels: z.array(runtimeLabelSchema).optional(),
  target: transitionTargetSchema.optional(),
})

/** The trailing fields are sent by newer engines on `correlations` only. */
const correlationSchema = z.object({
  correlationId: z.string(),
  parentState: z.string(),
  subFlowInstanceId: z.string(),
  subFlowType: z.string(),
  subFlowDomain: z.string(),
  subFlowName: z.string(),
  subFlowVersion: z.string(),
  isCompleted: z.boolean(),
  href: z.string().optional(),
  currentState: z.string().optional(),
  terminalOutcome: z.string().optional(),
  createdAt: z.string().optional(),
  completedAt: z.string().optional(),
  stateChangedAt: z.string().optional(),
})

export const quickrunGetStateResult = z.object({
  // Optional so a 304 (`notModified: true`, no JSON body) still validates —
  // the fields below are only guaranteed present when `notModified` is falsy.
  state: z.string().optional(),
  status: instanceStatusSchema.optional(),
  stateType: z.string().optional(),
  /** Runtime 0.0.99: sub type / labels of the displayed state. */
  stateSubType: z.string().optional(),
  stateLabels: z.array(runtimeLabelSchema).optional(),
  transitions: z.array(transitionInfoSchema).optional(),
  sharedTransitions: z.array(transitionInfoSchema).optional(),
  activeCorrelations: z.array(correlationSchema).optional(),
  /** Open *and* closed correlations, with lifecycle detail. Newer engines only. */
  correlations: z.array(correlationSchema).optional(),
  view: z.object({
    hasView: z.boolean(),
    loadData: z.boolean(),
    href: z.string(),
  }).optional(),
  data: z.object({
    href: z.string(),
  }).optional(),
  /** Functions reachable on this instance; `href` points at the catalog.
   *  See `quickrunGetFunctionCatalogParams` for why the href is not followed. */
  functions: z.object({
    hasFunctions: z.boolean(),
    href: z.string(),
  }).optional(),
  interaction: z.object({
    terminateLongPoll: z.boolean().optional(),
    fallbackTimeoutSeconds: z.number().int().optional(),
    ack: z.object({ href: z.string() }).optional(),
  }).optional(),
  timeout: z.object({
    key: z.string(),
    /** String up to runtime 0.0.98, a target object from 0.0.99. */
    target: z.union([z.string(), transitionTargetSchema]),
    executeAtUtc: z.string(),
    annotations: z.record(z.string(), z.string()).nullable().optional(),
  }).optional(),
  incident: incidentBlockSchema.optional(),
  eTag: z.string().optional(),
  entityEtag: z.string().optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  /** `true` when the upstream returned HTTP 304 Not Modified in response
   *  to `ifNoneMatch` — no JSON body was parsed; all other fields above
   *  are absent. */
  notModified: z.boolean().optional(),
})

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

// ── Get Function Catalog ──────────────────────────────────────────────────────
//
// Lists the functions reachable on one instance, so the Quick Runner can
// hand a developer straight to the Function Quick Runner bound to that
// instance. Fetched only when the state response declares
// `functions.hasFunctions`.
//
// The state response also carries `functions.href`, but — exactly as with
// `interaction.ack.href` above — the path is rebuilt here from the workflow
// identifiers rather than followed, so no engine-supplied string ever
// reaches the proxy:
//   GET /api/v1/<domain>/workflows/<flow>/instances/<instanceId>/functions/catalog

export const quickrunGetFunctionCatalogParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetFunctionCatalogResult = z.object({
  functions: z.array(
    z.object({
      /** The `sys-functions` component key. */
      name: z.string(),
      version: z.string().optional(),
      /** `'D' | 'F' | 'I'`, left as a string so an unknown engine value
       *  passes through instead of failing the whole catalog. */
      scope: z.string().optional(),
      href: z.string().optional(),
      /** The function's `attributes.labels` (runtime 0.0.99). */
      labels: z.array(runtimeLabelSchema).optional(),
    }),
  ),
})

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
  /** Runtime 0.0.99: onExecute | onEntry | onExit; null on pre-migration rows. */
  hook: z.string().nullable().optional(),
  /** Runtime 0.0.99: equal order ⇒ parallel group; null on pre-migration rows. */
  order: z.number().nullable().optional(),
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

// ── Get View ─────────────────────────────────────────────────────────────────

export const quickrunGetViewParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  transitionKey: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetViewResult = z.object({
  key: z.string(),
  content: z.string(),
  type: z.string(),
  // Stays a string on purpose. The runtime resolves a view authored with the
  // per-mode object form down to its SDI value for this field and reports both
  // modes separately in `modes`, so widening this would misdescribe the wire.
  display: z.string().optional(),
  modes: z
    .object({
      sdi: z.string().optional(),
      mdi: z.string().optional(),
    })
    .nullish(),
  label: z.string().optional(),
})

// ── Get Data ─────────────────────────────────────────────────────────────────

export const quickrunGetDataParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  extensions: z.string().optional(),
  ifNoneMatch: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetDataResult = z.object({
  // Optional so a 304 (`notModified: true`, no JSON body) still validates.
  data: z.record(z.string(), z.unknown()).optional(),
  eTag: z.string().optional(),
  entityEtag: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  /** `true` when the upstream returned HTTP 304 Not Modified in response
   *  to `ifNoneMatch` — no JSON body was parsed; `data` is absent. */
  notModified: z.boolean().optional(),
})

// ── Get Schema ───────────────────────────────────────────────────────────────

export const quickrunGetSchemaParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  transitionKey: z.string().optional(),
  /** Conditional-request support: sent as `If-None-Match` when present. A
   *  304 response (see `quickrunGetSchemaResult.notModified`) means the
   *  caller's cached schema is still current. */
  ifNoneMatch: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetSchemaResult = z.object({
  // Optional so a 304 (`notModified: true`, no JSON body) still validates.
  key: z.string().optional(),
  type: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  eTag: z.string().optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  /** `true` when the upstream returned HTTP 304 Not Modified in response
   *  to `ifNoneMatch` — no JSON body was parsed; the fields above are
   *  absent. */
  notModified: z.boolean().optional(),
})

// ── Get History ──────────────────────────────────────────────────────────────

export const quickrunGetHistoryParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

const historyTransitionSchema = z.object({
  id: z.string(),
  transitionId: z.string(),
  fromState: z.string(),
  toState: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationSeconds: z.number().optional(),
  triggerType: z.string(),
  body: z.record(z.string(), z.unknown()).optional(),
  header: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  createdBy: z.string().optional(),
  createdByBehalfOf: z.string().optional(),
})

export const quickrunGetHistoryResult = z.object({
  transitions: z.array(historyTransitionSchema),
})

// ── Retry Instance ──────────────────────────────────────────────────────────

export const quickrunRetryInstanceParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  key: z.string().optional(),
  stage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunRetryInstanceResult = z.object({
  id: z.string(),
  key: z.string(),
  status: instanceStatusSchema,
})

// ── Get Instance ─────────────────────────────────────────────────────────────

export const quickrunGetInstanceParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

const getInstanceMetadataSchema = z.object({
  currentState: z.string(),
  effectiveState: z.string(),
  status: instanceStatusSchema,
  effectiveStatus: instanceStatusSchema.optional(),
  type: instanceTypeSchema.nullable().optional(),
  incident: incidentBlockSchema.optional(),
  effectiveStateType: z.string().optional(),
  effectiveStateSubType: z.string().optional(),
  currentStateType: z.string().optional(),
  currentStateSubType: z.string().optional(),
  stage: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
  createdBy: z.string().optional(),
  createdByBehalfOf: z.string().optional(),
  modifiedBy: z.string().optional(),
  modifiedByBehalfOf: z.string().optional(),
})

export const quickrunGetInstanceResult = z.object({
  id: z.string(),
  key: z.string(),
  flow: z.string(),
  domain: z.string(),
  flowVersion: z.string().optional(),
  eTag: z.string().optional(),
  entityEtag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: getInstanceMetadataSchema,
})

// ── List Instances ───────────────────────────────────────────────────────────

export const quickrunListInstancesParams = z.object({
  ...workflowIdentifier,
  // Runtime bounds: page 1..1000, pageSize 1..100 (`GetInstanceListInput`).
  page: z.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  version: z.string().optional(),
  orderBy: z.string().optional(),
  sort: z.string().optional(),
  extensions: z.string().optional(),
  filter: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

const instanceMetadataSchema = z.object({
  currentState: z.string(),
  effectiveState: z.string(),
  status: instanceStatusSchema,
  effectiveStatus: instanceStatusSchema.optional(),
  type: instanceTypeSchema.nullable().optional(),
  incident: incidentBlockSchema.optional(),
  effectiveStateType: z.string().optional(),
  effectiveStateSubType: z.string().optional(),
  currentStateType: z.string().optional(),
  currentStateSubType: z.string().optional(),
  stage: z.string().optional(),
  completedAt: z.string().optional(),
  duration: z.number().optional(),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
  createdBy: z.string().optional(),
  createdByBehalfOf: z.string().optional(),
  modifiedBy: z.string().optional(),
  modifiedByBehalfOf: z.string().optional(),
})

const instanceItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  flow: z.string(),
  domain: z.string(),
  flowVersion: z.string().optional(),
  entityEtag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: instanceMetadataSchema,
  attributes: z.record(z.string(), z.unknown()).optional(),
})

export const quickrunListInstancesResult = z.object({
  links: z.object({
    self: z.string(),
    first: z.string().optional(),
    next: z.string().optional(),
    prev: z.string().optional(),
  }),
  items: z.array(instanceItemSchema),
})

// ── Execute Function (R25.B-1) ──────────────────────────────────────────────
//
// Used by the Quick Runner pseudo-ui delegate to satisfy SDK
// `requestData` (x-lov / x-lookup) calls and `dispatch + func URN`
// actions. The URN is parsed by Forge before this method is called;
// `functionUrn` is the full `urn:amorphie:func:<domain>:<key>` form so
// the engine receives the same opaque identifier the view JSON used.
// `params` carries the SDK-resolved filter values (or descriptor
// `params`) as a flat string map.
//
// The result is a passthrough object (`Record<string, unknown>`) — the
// SDK runs JsonPath on it via `dataClient.extractByPath` to project
// `valueField` / `displayField` into LovItem[]; the host doesn't pre-
// shape it.

export const quickrunExecuteFunctionParams = z.object({
  ...workflowIdentifier,
  /** Current workflow instance id, supplied as a fallback for the
   *  domain-scoped URN form. The workflow-scoped form always carries
   *  its own instance segment which wins over this value. */
  instanceId: z.string().min(1),
  /** Full vNext function URN. Two scopes are recognised; the service
   *  inspects the URN to pick the engine path:
   *    `urn:vnext:fn[:<verb>]:<domain>:<function>`
   *      → <verb> /api/v1/<domain>/functions/<function>          (domain scope)
   *    `urn:vnext:fn[:<verb>]:<domain>:<flow>:<instance>:<function>`
   *      → <verb> /api/v1/<domain>/workflows/<flow>/instances/<instance>/functions/<function>
   *  `verb` defaults to `get` when omitted from the URN. The optional
   *  `method` param below overrides whatever the URN encoded. */
  functionUrn: z.string().min(1),
  /** Optional verb override. Falls back to the URN-embedded verb, then
   *  to `get`. */
  method: z.enum(['get', 'post', 'patch', 'delete']).optional(),
  /** SDK-resolved filter / descriptor params. Sent as query string for
   *  GET/DELETE and as a JSON body for POST/PATCH. */
  params: z.record(z.string(), z.string()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunExecuteFunctionResult = z.record(z.string(), z.unknown())

// ── Correlation tree ─────────────────────────────────────────────────────────
//
// Runtime 0.0.99: GET …/instances/<id>/functions/instance-correlation — the
// whole SubFlow/SubProcess tree under an instance. ≤ 0.0.98:
// GET …/functions/hierarchy, also a tree but without ownState / resolved /
// correlation detail. The service picks by `runtimeVersion` (≥ 0.0.99 → new,
// older → old, unknown → new then old on 404) and normalizes the old shape.

export const quickrunGetCorrelationTreeParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  /** Version the caller learned from `health/check`; omitted when unknown. */
  runtimeVersion: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export interface CorrelationTreeNode {
  id: string
  key?: string | null
  flow: string
  domain: string
  flowVersion?: string | null
  currentState?: string | null
  ownState?: string | null
  status?: string | null
  subFlowType?: string | null
  isCompleted?: boolean
  completedAt?: string | null
  terminalOutcome?: string | null
  parentState?: string | null
  correlationId?: string | null
  createdAt?: string | null
  stateChangedAt?: string | null
  href?: string | null
  resolved: boolean
  unresolvedReason?: string | null
  children: CorrelationTreeNode[]
}

export const correlationTreeNodeSchema: z.ZodType<CorrelationTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    key: z.string().nullable().optional(),
    flow: z.string(),
    domain: z.string(),
    flowVersion: z.string().nullable().optional(),
    currentState: z.string().nullable().optional(),
    ownState: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    subFlowType: z.string().nullable().optional(),
    isCompleted: z.boolean().optional(),
    completedAt: z.string().nullable().optional(),
    /** completed | faulted | canceled */
    terminalOutcome: z.string().nullable().optional(),
    parentState: z.string().nullable().optional(),
    correlationId: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    stateChangedAt: z.string().nullable().optional(),
    href: z.string().nullable().optional(),
    resolved: z.boolean(),
    /** depth-exceeded | hop-failed | instance-missing */
    unresolvedReason: z.string().nullable().optional(),
    children: z.array(correlationTreeNodeSchema),
  }),
)

export const quickrunGetCorrelationTreeResult = z.object({
  root: correlationTreeNodeSchema,
  /** Which runtime surface answered. */
  source: z.enum(['instance-correlation', 'hierarchy']),
})

// ── Transition / state metrics ───────────────────────────────────────────────
//
// Runtime 0.0.99:
//   GET …/instances/<id>/transitions/<transitionKey>/metrics
//   GET …/instances/<id>/states/<stateKey>/metrics
// One grammar for both: one attempt per firing (transition) or visit (state).

const metricsTaskSchema = z.object({
  id: z.string(),
  taskKey: z.string(),
  hook: z.string().nullable().optional(),
  order: z.number().nullable().optional(),
  status: z.string(),
  businessStatus: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  faultedTaskRef: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
})

const metricsAttemptSchema = z.object({
  seq: z.number(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  triggerType: z.string().nullable().optional(),
  triggeredBy: z.string().nullable().optional(),
  tasks: z.array(metricsTaskSchema),
})

export const quickrunGetElementMetricsParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  /** Transition key or state key, per method. */
  key: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetElementMetricsResult = z.object({
  element: z.object({ kind: z.enum(['transition', 'state']), key: z.string() }),
  count: z.number(),
  attempts: z.array(metricsAttemptSchema),
})

// ── Function metrics ─────────────────────────────────────────────────────────
//
// Runtime 0.0.99, only for functions with `attributes.executionLog: "E"`:
//   GET /api/v1/<domain>/functions/<fn>/metrics?page&pageSize&from&to&succeeded
//   GET /api/v1/<domain>/workflows/<wf>/functions/<fn>/metrics?…   (flow-scoped)

export const quickrunGetFunctionMetricsParams = z.object({
  domain: z.string().min(1),
  functionKey: z.string().min(1),
  /** Flow-scoped sibling when set. */
  workflowKey: z.string().min(1).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  succeeded: z.boolean().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetFunctionMetricsResult = z.object({
  items: z.array(
    z.object({
      executionId: z.string(),
      functionVersion: z.string().nullable().optional(),
      invokedAt: z.string(),
      durationMs: z.number().nullable().optional(),
      scope: z.string().nullable().optional(),
      workflow: z.string().nullable().optional(),
      instanceId: z.string().nullable().optional(),
      succeeded: z.boolean(),
      status: z.string().nullable().optional(),
      statusCode: z.number().nullable().optional(),
      error: z.string().nullable().optional(),
      fromCache: z.boolean().optional(),
      traceId: z.string().nullable().optional(),
      invokedBy: z.string().nullable().optional(),
      invokedByBehalfOf: z.string().nullable().optional(),
    }),
  ),
  summary: z
    .object({
      count: z.number(),
      p50Ms: z.number().nullable().optional(),
      p95Ms: z.number().nullable().optional(),
      failureRate: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  hasNext: z.boolean(),
})
