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

interface TransitionLike {
  key?: string;
  target?: string;
  triggerType?: number;
  labels?: { language?: string; label?: string }[];
  schema?: ResourceLikeRef | null;
  _comment?: string;
}

interface WorkflowLike {
  key?: string;
  domain?: string;
  flow?: string;
  version?: string;
  attributes?: {
    labels?: { language?: string; label?: string }[];
    startTransition?: TransitionLike;
    states?: { key?: string; transitions?: TransitionLike[] }[];
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

// ── helpers ──────────────────────────────────────────────────────────────────

function firstLabel(labels: { language?: string; label?: string }[] | undefined, fallback: string): string {
  if (!labels?.length) return fallback;
  const en = labels.find((l) => l.language === 'en') ?? labels[0];
  return en?.label ?? fallback;
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

export function buildWorkflowOpenApi(workflowJson: unknown, resolveSchema: SchemaResolver): OpenApiDocument {
  const wf = (workflowJson ?? {}) as WorkflowLike;
  const attrs = wf.attributes ?? {};
  const domain = wf.domain ?? '{domain}';
  const wfKey = wf.key ?? '{workflow}';
  const wfVersion = wf.version ?? '1.0.0';
  const title = firstLabel(attrs.labels, wfKey);
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

  // PATCH .../instances/{instance}/transitions/<transitionKey> (one per transition)
  for (const t of collectExternalTransitions(wf)) {
    const key = t.key as string;
    paths[`${base}/instances/{instance}/transitions/${key}`] = {
      patch: {
        tags: ['Instance'],
        operationId: `transition_${key}`,
        summary: `Trigger transition "${firstLabel(t.labels, key)}"`,
        description: t._comment,
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

  // Function endpoints (domain-scoped + instance-scoped). Method/payload
  // refinement from function/task config is a future enhancement; documented
  // generically here for each referenced function.
  for (const fn of attrs.functions ?? []) {
    const fnKey = fn?.key;
    if (!fnKey) continue;
    const fnVerbs = (parameters: unknown[]): Record<string, unknown> => {
      const op = (method: string) => ({
        tags: ['Function'],
        operationId: `${method}_function_${fnKey}`,
        summary: `${method.toUpperCase()} function "${fnKey}"`,
        parameters,
        responses: { '200': { description: 'Function result', content: jsonContent({ type: 'object', additionalProperties: true }) }, '404': problemResponse },
      });
      return { get: op('get'), post: op('post'), patch: op('patch'), delete: op('delete') };
    };
    paths[`/api/v1/${domain}/functions/${fnKey}`] = fnVerbs([refParam('Version')]);
    paths[`${base}/instances/{instance}/functions/${fnKey}`] = fnVerbs([
      instancePathParam, refParam('Version'), refParam('Extensions'), refParam('IfNoneMatch'),
    ]);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${title} API`,
      version: wfVersion,
      description: `OpenAPI specification for the "${wfKey}" workflow (domain "${domain}"). Generated by vNext Forge.`,
    },
    servers: [{ url: '/', description: 'vNext runtime' }],
    paths,
    components,
  };
}
