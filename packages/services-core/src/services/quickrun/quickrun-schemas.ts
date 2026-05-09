import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────────────

const workflowIdentifier = {
  domain: z.string().min(1),
  workflowKey: z.string().min(1),
}

const headersSchema = z.record(z.string(), z.string()).optional()

const instanceStatusSchema = z.enum(['A', 'B', 'C', 'F'])

// ── Start Instance ───────────────────────────────────────────────────────────

export const quickrunStartInstanceParams = z.object({
  ...workflowIdentifier,
  sync: z.boolean().optional().default(true),
  version: z.string().optional(),
  key: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunStartInstanceResult = z.object({
  id: z.string(),
  key: z.string(),
  status: instanceStatusSchema,
})

// ── Fire Transition ──────────────────────────────────────────────────────────

export const quickrunFireTransitionParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  transitionKey: z.string().min(1),
  sync: z.boolean().optional().default(true),
  key: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunFireTransitionResult = z.object({
  id: z.string(),
  key: z.string(),
  status: instanceStatusSchema,
})

// ── Get State ────────────────────────────────────────────────────────────────

export const quickrunGetStateParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
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
})

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
})

export const quickrunGetStateResult = z.object({
  state: z.string(),
  status: instanceStatusSchema,
  transitions: z.array(transitionInfoSchema).optional(),
  sharedTransitions: z.array(transitionInfoSchema).optional(),
  activeCorrelations: z.array(correlationSchema).optional(),
  view: z.object({
    hasView: z.boolean(),
    loadData: z.boolean(),
    href: z.string(),
  }).optional(),
  data: z.object({
    href: z.string(),
  }).optional(),
  eTag: z.string().optional(),
  entityEtag: z.string().optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
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
  display: z.string().optional(),
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
  data: z.record(z.string(), z.unknown()),
  eTag: z.string().optional(),
  entityEtag: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
})

// ── Get Schema ───────────────────────────────────────────────────────────────

export const quickrunGetSchemaParams = z.object({
  ...workflowIdentifier,
  instanceId: z.string().min(1),
  transitionKey: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})

export const quickrunGetSchemaResult = z.object({
  key: z.string(),
  type: z.string(),
  schema: z.record(z.string(), z.unknown()),
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
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(20),
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
  effectiveStateType: z.string().optional(),
  effectiveStateSubType: z.string().optional(),
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
