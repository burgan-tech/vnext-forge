/**
 * Builds an OpenAPI 3.1 document describing the vNext runtime HTTP surface for a
 * single workflow: instance lifecycle endpoints (start / transition / retry /
 * get / get-data) and the workflow's function endpoints.
 *
 * Request/response payloads are typed from the workflow's Schema references:
 *  - each externally-triggerable transition's `schema` ref defines the
 *    `attributes` payload accepted by that transition endpoint;
 *  - the workflow master schema (`attributes.schema`) types the instance data
 *    returned by Get Instance (`attributes`) and Get Instance Data (`data`).
 *
 * OpenAPI 3.1 is used deliberately: it embeds JSON Schema draft 2020-12 — the
 * exact dialect vNext Schema components use — so resolved schemas are inlined
 * verbatim without any down-conversion.
 *
 * This module is pure and IO-free. Callers resolve Schema components into a
 * {@link SchemaResolver} (see {@link createSchemaResolver}) and pass it in.
 */

// Trigger types that a workflow consumer can invoke over HTTP. Mirrors
// `TriggerType` in @vnext-forge-studio/vnext-types (Manual = 0, Event = 3).
// Automatic (1) and Scheduled (2) are engine-internal and are not exposed.
const EXTERNAL_TRIGGER_TYPES = new Set<number>([0, 3]);

/** Minimal reference shape ({ key, domain, version, flow }). */
export interface ResourceLikeRef {
  key?: string;
  domain?: string;
  version?: string;
  flow?: string;
  ref?: string;
}

/** A resolved JSON Schema object (draft 2020-12). */
export type JsonSchemaObject = Record<string, unknown>;

/** Resolves a Schema component reference to its JSON Schema content. */
export type SchemaResolver = (ref: ResourceLikeRef | null | undefined) => JsonSchemaObject | undefined;

/** Resolves any component reference to its raw component JSON (used for functions/tasks). */
export type ComponentResolver = (ref: ResourceLikeRef | null | undefined) => Record<string, unknown> | undefined;

/** Resolvers passed to {@link buildWorkflowOpenApi}. */
export interface OpenApiResolvers {
  /** Resolves transition/master schema refs to JSON Schema content. */
  resolveSchema: SchemaResolver;
  /** Resolves Function/Task component refs to raw JSON (enables real function HTTP methods). */
  resolveComponent?: ComponentResolver;
}

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, JsonSchemaObject>;
    parameters: Record<string, unknown>;
  };
}

interface RoleGrant { role: string; grant: 'allow' | 'deny' }

interface TransitionLike {
  key?: string;
  target?: string;
  triggerType?: number;
  labels?: { language?: string; label?: string }[];
  schema?: ResourceLikeRef | null;
  _comment?: string;
  roles?: RoleGrant[];
}

interface WorkflowLike {
  key?: string;
  domain?: string;
  flow?: string;
  version?: string;
  _comment?: string;
  attributes?: {
    labels?: { language?: string; label?: string }[];
    startTransition?: TransitionLike;
    states?: {
      key?: string;
      transitions?: TransitionLike[];
      subFlow?: { process?: ResourceLikeRef } | null;
    }[];
    sharedTransitions?: TransitionLike[];
    cancel?: TransitionLike | null;
    exit?: TransitionLike | null;
    updateData?: TransitionLike | null;
    functions?: ResourceLikeRef[];
    schema?: ResourceLikeRef | null;
  };
}

// ── Schema resolution ───────────────────────────────────────────────────────

/**
 * Builds a {@link SchemaResolver} from raw Schema-component JSON objects. The
 * lookup is keyed most-specific-first (`flow:domain:key` → `domain:key` →
 * `key`) so a reference resolves even when it omits `flow`/`domain`.
 */
export function createSchemaResolver(schemaComponents: unknown[]): SchemaResolver {
  const byKey = new Map<string, JsonSchemaObject>();

  for (const raw of schemaComponents) {
    const comp = raw as { key?: string; domain?: string; flow?: string; attributes?: { schema?: unknown } } | null;
    const schema = comp?.attributes?.schema;
    if (!comp?.key || !schema || typeof schema !== 'object') continue;
    const content = schema as JsonSchemaObject;
    const { key, domain, flow } = comp;
    if (flow && domain) byKey.set(`${flow}:${domain}:${key}`, content);
    if (domain) byKey.set(`${domain}:${key}`, content);
    if (!byKey.has(key)) byKey.set(key, content);
  }

  return (ref) => {
    if (!ref?.key) return undefined;
    const { key, domain, flow } = ref;
    return (
      (flow && domain ? byKey.get(`${flow}:${domain}:${key}`) : undefined) ??
      (domain ? byKey.get(`${domain}:${key}`) : undefined) ??
      byKey.get(key)
    );
  };
}

/**
 * Builds a {@link ComponentResolver} returning the raw component JSON for any
 * reference — used to resolve workflow functions and the tasks they wrap. Same
 * most-specific-first keying as {@link createSchemaResolver}.
 */
export function createComponentResolver(components: unknown[]): ComponentResolver {
  const byKey = new Map<string, Record<string, unknown>>();

  for (const raw of components) {
    const comp = raw as { key?: string; domain?: string; flow?: string } | null;
    if (!comp?.key || typeof comp !== 'object') continue;
    const content = comp as Record<string, unknown>;
    const { key, domain, flow } = comp;
    if (flow && domain) byKey.set(`${flow}:${domain}:${key}`, content);
    if (domain) byKey.set(`${domain}:${key}`, content);
    if (!byKey.has(key)) byKey.set(key, content);
  }

  return (ref) => {
    if (!ref?.key) return undefined;
    const { key, domain, flow } = ref;
    return (
      (flow && domain ? byKey.get(`${flow}:${domain}:${key}`) : undefined) ??
      (domain ? byKey.get(`${domain}:${key}`) : undefined) ??
      byKey.get(key)
    );
  };
}

// ── function HTTP-method derivation ──────────────────────────────────────────

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Derives the consumer-facing HTTP method for a Task component from its
 * `attributes.type` + `attributes.config`. Returns null for task types with no
 * HTTP semantics (Script, Timer, …) so the caller can fall through to the next
 * task or a default.
 *
 * Task type discriminators (string in JSON) mirror `TaskType` in vnext-types:
 * 6=Http, 16=Soap, 1=DaprHttpEndpoint, 3=DaprService.
 */
function deriveTaskHttpMethod(taskJson: Record<string, unknown> | undefined): string | null {
  const attrs = (taskJson?.attributes ?? taskJson) as Record<string, unknown> | undefined;
  const type = String(attrs?.type ?? '');
  const cfg = (attrs?.config ?? {}) as Record<string, unknown>;
  const up = (v: unknown): string | null => {
    const m = typeof v === 'string' ? v.toUpperCase() : '';
    return HTTP_METHODS.has(m) ? m : null;
  };
  switch (type) {
    case '6': // Http
      return up(cfg.method) ?? 'POST';
    case '16': // Soap
      return 'POST';
    case '1': // DaprHttpEndpoint
    case '3': // DaprService
      return up(cfg.httpVerb) ?? up(cfg.method) ?? 'POST';
    default:
      return null;
  }
}

/** Task refs a function wraps, supporting both `attributes.task` (single) and `attributes.tasks[]`. */
function functionTaskRefs(functionJson: Record<string, unknown> | undefined): ResourceLikeRef[] {
  const attrs = (functionJson?.attributes ?? functionJson) as Record<string, unknown> | undefined;
  if (!attrs) return [];
  const multi = attrs.tasks;
  if (Array.isArray(multi)) {
    return multi
      .map((t) => (t as { task?: ResourceLikeRef })?.task)
      .filter((r): r is ResourceLikeRef => Boolean(r?.key));
  }
  const single = attrs.task as ResourceLikeRef | undefined;
  return single?.key ? [single] : [];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function firstLabel(
  labels: { language?: string; label?: string }[] | undefined,
  fallback: string,
  language = 'en',
): string {
  if (!labels?.length) return fallback;
  const preferred = labels.find(
    (l) => l.language === language || (l.language ?? '').startsWith(language + '-') || language.startsWith((l.language ?? '') + '-'),
  ) ?? labels[0];
  return preferred?.label ?? fallback;
}

function isVisibleToAudience(
  roles: RoleGrant[] | undefined,
  audienceRoles: string[],
): boolean {
  if (audienceRoles.length === 0) return true;
  if (!roles?.length) return true;
  const matched = roles.filter((r) => audienceRoles.includes(r.role));
  if (matched.some((r) => r.grant === 'deny')) return false;
  if (matched.some((r) => r.grant === 'allow')) return true;
  return false;
}

export interface OpenApiOptions {
  /** When set, only transitions visible to at least one of these roles are emitted. */
  audienceRoles?: string[];
  /** Preferred language code for label/summary resolution (e.g. 'en', 'tr'). Default: 'en'. */
  language?: string;
}

/** PascalCase component-schema name derived from a transition/schema key. */
function schemaComponentName(key: string, suffix: string): string {
  const pascal = key
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return `${pascal || 'Unnamed'}${suffix}`;
}

function collectExternalTransitions(wf: WorkflowLike): TransitionLike[] {
  const seen = new Map<string, TransitionLike>();
  const consider = (t: TransitionLike | null | undefined) => {
    if (!t?.key) return;
    const tt = t.triggerType;
    // Default (undefined) is Manual (0) and therefore externally triggerable.
    if (tt !== undefined && !EXTERNAL_TRIGGER_TYPES.has(tt)) return;
    if (!seen.has(t.key)) seen.set(t.key, t);
  };
  for (const state of wf.attributes?.states ?? []) {
    for (const t of state.transitions ?? []) consider(t);
  }
  for (const t of wf.attributes?.sharedTransitions ?? []) consider(t);
  // Special transitions are also consumer-invokable when present.
  consider(wf.attributes?.cancel ?? undefined);
  consider(wf.attributes?.exit ?? undefined);
  consider(wf.attributes?.updateData ?? undefined);
  return [...seen.values()];
}

// ── builder ───────────────────────────────────────────────────────────────────

export function buildWorkflowOpenApi(
  workflowJson: unknown,
  resolvers: OpenApiResolvers,
  options?: OpenApiOptions,
): OpenApiDocument {
  const { resolveSchema, resolveComponent } = resolvers;
  const audienceRoles = options?.audienceRoles ?? [];
  const language = options?.language ?? 'en';
  const wf = (workflowJson ?? {}) as WorkflowLike;
  const attrs = wf.attributes ?? {};
  const domain = wf.domain ?? '{domain}';
  const wfKey = wf.key ?? '{workflow}';
  const wfVersion = wf.version ?? '1.0.0';
  const title = firstLabel(attrs.labels, wfKey, language);
  const base = `/api/v1/${domain}/workflows/${wfKey}`;

  const schemas: Record<string, JsonSchemaObject> = {};
  const paths: Record<string, Record<string, unknown>> = {};

  // Register a resolved schema under a stable component name; return its $ref,
  // or a permissive object schema when the reference is unresolved.
  const registerSchema = (ref: ResourceLikeRef | null | undefined, suffix: string): JsonSchemaObject => {
    const resolved = resolveSchema(ref);
    if (!resolved || !ref?.key) return { type: 'object', additionalProperties: true };
    const name = schemaComponentName(ref.key, suffix);
    schemas[name] = resolved;
    return { $ref: `#/components/schemas/${name}` };
  };

  // Shared component schemas.
  schemas.RequestEnvelopeBase = {
    type: 'object',
    description: 'Common instance request envelope. `attributes` carries the transition payload.',
    properties: {
      key: { type: 'string', description: 'Business-unique key; one active instance per key (optional).' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Instance labels (optional).' },
      stage: { type: 'string', description: 'Business stage indicator (optional).' },
    },
  };
  schemas.ProblemDetails = {
    type: 'object',
    properties: {
      type: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'integer' },
      detail: { type: 'string' },
      instance: { type: 'string' },
    },
  };

  const masterAttributes = registerSchema(attrs.schema, 'Data');
  schemas.InstanceResponse = {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      key: { type: 'string' },
      flow: { type: 'string' },
      domain: { type: 'string' },
      flowVersion: { type: 'string' },
      eTag: { type: 'string' },
      entityEtag: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      metadata: { type: 'object', additionalProperties: true },
      attributes: masterAttributes,
      extensions: { type: 'object', additionalProperties: true },
    },
  };
  schemas.InstanceDataResponse = {
    type: 'object',
    properties: {
      data: masterAttributes,
      etag: { type: 'string' },
      entityEtag: { type: 'string' },
      extensions: { type: 'object', additionalProperties: true },
    },
  };

  // Shared parameters.
  const components = {
    schemas,
    parameters: {
      Sync: {
        name: 'sync', in: 'query', required: false,
        schema: { type: 'boolean' },
        description: 'Execute synchronously and wait for the result.',
      },
      Version: {
        name: 'version', in: 'query', required: false,
        schema: { type: 'string', example: '1.0.0' },
        description: 'Target workflow version.',
      },
      Extensions: {
        name: 'extensions', in: 'query', required: false,
        schema: { type: 'array', items: { type: 'string' } },
        style: 'form', explode: true,
        description: 'Extension keys to apply.',
      },
      IfNoneMatch: {
        name: 'If-None-Match', in: 'header', required: false,
        schema: { type: 'string' },
        description: 'Conditional read; returns 304 when the ETag matches.',
      },
    },
  };

  const refParam = (name: string) => ({ $ref: `#/components/parameters/${name}` });
  const jsonContent = (schema: JsonSchemaObject) => ({ 'application/json': { schema } });
  const problemResponse = { description: 'Problem', content: jsonContent({ $ref: '#/components/schemas/ProblemDetails' }) };
  const instanceResponse = { description: 'Instance', content: jsonContent({ $ref: '#/components/schemas/InstanceResponse' }) };
  const instancePathParam = {
    name: 'instance', in: 'path', required: true,
    schema: { type: 'string' },
    description: 'Instance id.',
  };

  const envelopeBody = (attributes: JsonSchemaObject) => ({
    required: true,
    content: jsonContent({
      allOf: [
        { $ref: '#/components/schemas/RequestEnvelopeBase' },
        { type: 'object', properties: { attributes } },
      ],
    }),
  });

  // POST .../instances/start
  paths[`${base}/instances/start`] = {
    post: {
      tags: ['Instance'],
      operationId: 'startInstance',
      summary: 'Start a new workflow instance',
      parameters: [refParam('Sync'), refParam('Version'), refParam('Extensions')],
      requestBody: envelopeBody(registerSchema(attrs.startTransition?.schema, 'Payload')),
      responses: { '200': instanceResponse, '404': problemResponse },
    },
  };

  // PATCH .../instances/{instance}/transitions/<transitionKey> (one per transition).
  // Sub-flow transitions are consumed through the SAME parent-instance endpoint;
  // only the transitionKey comes from the sub-flow. Each entry tracks whether it
  // originates from a sub-flow so it can be labelled accordingly.
  interface TransitionEntry {
    t: TransitionLike;
    subFlowKey?: string;
    fromState?: string;
  }
  const txEntries: TransitionEntry[] = collectExternalTransitions(wf)
    .filter((t) => isVisibleToAudience(t.roles, audienceRoles))
    .map((t) => ({ t }));

  // Same-workspace sub-flows: when a state delegates to a `process` workflow in
  // the same domain, fold that sub-flow's externally-triggerable transitions in.
  if (resolveComponent) {
    for (const state of attrs.states ?? []) {
      const proc = state.subFlow?.process;
      if (!proc?.key) continue;
      // "same domain ⇒ same workspace": skip cross-domain references.
      if (proc.domain && domain !== '{domain}' && proc.domain !== domain) continue;
      const subWf = resolveComponent(proc);
      if (!subWf) continue;
      const subFlowKey = String(subWf.key ?? proc.key);
      for (const t of collectExternalTransitions(subWf as unknown as WorkflowLike)) {
        if (!isVisibleToAudience(t.roles, audienceRoles)) continue;
        txEntries.push({ t, subFlowKey, fromState: state.key });
      }
    }
  }

  const emittedTransitionKeys = new Set<string>();
  for (const { t, subFlowKey, fromState } of txEntries) {
    const key = t.key;
    if (!key || emittedTransitionKeys.has(key)) continue; // parent transitions win on collision
    emittedTransitionKeys.add(key);
    paths[`${base}/instances/{instance}/transitions/${key}`] = {
      patch: {
        tags: subFlowKey ? ['Instance', 'Sub-flow'] : ['Instance'],
        operationId: `transition_${key}`,
        summary: `Trigger transition "${firstLabel(t.labels, key, language)}"`,
        description: subFlowKey
          ? `Sub-flow transition — belongs to sub-flow "${subFlowKey}"${fromState ? ` entered from state "${fromState}"` : ''}. Consumed through the parent workflow instance.`
          : t._comment,
        parameters: [instancePathParam, refParam('Sync'), refParam('Version'), refParam('Extensions')],
        requestBody: envelopeBody(registerSchema(t.schema, 'Payload')),
        responses: { '200': instanceResponse, '404': problemResponse },
      },
    };
  }

  // POST .../instances/{instance}/retry
  paths[`${base}/instances/{instance}/retry`] = {
    post: {
      tags: ['Instance'],
      operationId: 'retryInstance',
      summary: 'Retry the instance after an incident',
      parameters: [instancePathParam, refParam('Sync')],
      requestBody: envelopeBody({ type: 'object', additionalProperties: true }),
      responses: { '200': instanceResponse, '404': problemResponse },
    },
  };

  // GET .../instances/{instance}
  paths[`${base}/instances/{instance}`] = {
    get: {
      tags: ['Instance'],
      operationId: 'getInstance',
      summary: 'Get instance state and data',
      parameters: [instancePathParam, refParam('Version'), refParam('Extensions'), refParam('IfNoneMatch')],
      responses: { '200': instanceResponse, '304': { description: 'Not Modified' }, '404': problemResponse },
    },
  };

  // GET .../instances/{instance}/functions/data
  paths[`${base}/instances/{instance}/functions/data`] = {
    get: {
      tags: ['Instance'],
      operationId: 'getInstanceData',
      summary: 'Get instance data (typed by the workflow master schema)',
      parameters: [instancePathParam, refParam('IfNoneMatch')],
      responses: {
        '200': { description: 'Instance data', content: jsonContent({ $ref: '#/components/schemas/InstanceDataResponse' }) },
        '304': { description: 'Not Modified' },
        '404': problemResponse,
      },
    },
  };

  // Function endpoints (domain-scoped + instance-scoped). When the Function
  // (and the Task it wraps) can be resolved, emit the real HTTP method derived
  // from the task config; otherwise fall back to POST.
  for (const fn of attrs.functions ?? []) {
    const fnKey = fn?.key;
    if (!fnKey) continue;

    // Resolve function -> first wrapped task with HTTP semantics -> method + contentType.
    let method = 'POST';
    let contentType = 'application/json';
    let resolvedFromConfig = false;
    const fnComponent = resolveComponent?.(fn);
    if (fnComponent) {
      for (const taskRef of functionTaskRefs(fnComponent)) {
        const taskJson = resolveComponent?.(taskRef);
        const derived = deriveTaskHttpMethod(taskJson);
        if (derived) {
          method = derived;
          const cfg = ((taskJson?.attributes ?? taskJson) as Record<string, unknown>)?.config as
            | Record<string, unknown>
            | undefined;
          if (typeof cfg?.contentType === 'string' && cfg.contentType) contentType = cfg.contentType;
          resolvedFromConfig = true;
          break;
        }
      }
    }

    const verb = method.toLowerCase();
    const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
    // `scope` keeps operationIds unique between the domain-scoped and
    // instance-scoped paths for the same function (OpenAPI requires unique ids).
    const fnOp = (scope: 'domain' | 'instance', parameters: unknown[]): Record<string, unknown> => {
      const op: Record<string, unknown> = {
        tags: ['Function'],
        operationId: `${verb}_${scope}_function_${fnKey}`,
        summary: `${method} function "${fnKey}" (${scope}-scoped)`,
        description: resolvedFromConfig
          ? `HTTP method derived from the function's task configuration.`
          : `Function method could not be resolved from config; defaulted to ${method}.`,
        parameters,
        responses: {
          '200': { description: 'Function result', content: jsonContent({ type: 'object', additionalProperties: true }) },
          '404': problemResponse,
        },
      };
      if (hasBody) {
        op.requestBody = {
          required: false,
          content: { [contentType]: { schema: { type: 'object', additionalProperties: true } } },
        };
      }
      return { [verb]: op };
    };

    paths[`/api/v1/${domain}/functions/${fnKey}`] = fnOp('domain', [refParam('Version')]);
    paths[`${base}/instances/{instance}/functions/${fnKey}`] = fnOp('instance', [
      instancePathParam, refParam('Version'), refParam('Extensions'), refParam('IfNoneMatch'),
    ]);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${title} API`,
      version: wfVersion,
      description: [
        `OpenAPI specification for the "${wfKey}" workflow (domain "${domain}"). Generated by vNext Forge.`,
        wf._comment ? `\n\n${wf._comment}` : '',
        audienceRoles.length ? `\n\n**Audience:** ${audienceRoles.join(', ')}` : '',
      ].join(''),
    },
    servers: [{ url: '/', description: 'vNext runtime' }],
    paths,
    components,
  };
}
