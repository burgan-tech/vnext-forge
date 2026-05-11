import { callApi } from '../../api/client';
import type {
  DataResponse,
  HistoryResponse,
  InstanceListResponse,
  SchemaResponse,
  StateResponse,
  ViewResponse,
} from './types/quickrun.types';

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } };

interface StartInstanceParams {
  domain: string;
  workflowKey: string;
  sync?: boolean;
  version?: string;
  key?: string;
  stage?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface FireTransitionParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  transitionKey: string;
  sync?: boolean;
  key?: string;
  stage?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface GetStateParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface GetViewParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  transitionKey?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface GetDataParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  extensions?: string;
  ifNoneMatch?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface GetSchemaParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  transitionKey?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface GetHistoryParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface RetryInstanceParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  key?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

interface ListInstancesParams {
  domain: string;
  workflowKey: string;
  page?: number;
  pageSize?: number;
  filter?: string;
  orderBy?: string;
  sort?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function startInstance(params: StartInstanceParams): Promise<ApiResponse<{ id: string; key: string; status: string }>> {
  return callApi({ method: 'quickrun/startInstance', params });
}

export async function fireTransition(params: FireTransitionParams): Promise<ApiResponse<{ id: string; key: string; status: string }>> {
  return callApi({ method: 'quickrun/fireTransition', params });
}

export async function getState(params: GetStateParams): Promise<ApiResponse<StateResponse>> {
  return callApi({ method: 'quickrun/getState', params });
}

export async function getView(params: GetViewParams): Promise<ApiResponse<ViewResponse>> {
  return callApi({ method: 'quickrun/getView', params });
}

export async function getData(params: GetDataParams): Promise<ApiResponse<DataResponse>> {
  return callApi({ method: 'quickrun/getData', params });
}

export async function getSchema(params: GetSchemaParams): Promise<ApiResponse<SchemaResponse>> {
  return callApi({ method: 'quickrun/getSchema', params });
}

export async function getHistory(params: GetHistoryParams): Promise<ApiResponse<HistoryResponse>> {
  return callApi({ method: 'quickrun/getHistory', params });
}

export async function retryInstance(params: RetryInstanceParams): Promise<ApiResponse<{ id: string; key: string; status: string }>> {
  return callApi({ method: 'quickrun/retryInstance', params });
}

export async function listInstances(params: ListInstancesParams): Promise<ApiResponse<InstanceListResponse>> {
  return callApi({ method: 'quickrun/listInstances', params });
}

interface GetInstanceParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export interface InstanceDetailResponse {
  id: string;
  key: string;
  flow: string;
  domain: string;
  flowVersion?: string;
  eTag?: string;
  entityEtag?: string;
  tags?: string[];
  metadata: {
    currentState: string;
    effectiveState: string;
    status: string;
    effectiveStateType?: string;
    effectiveStateSubType?: string;
    currentStateType?: string;
    currentStateSubType?: string;
    stage?: string;
    createdAt: string;
    modifiedAt?: string;
    createdBy?: string;
    createdByBehalfOf?: string;
    modifiedBy?: string;
    modifiedByBehalfOf?: string;
  };
}

export async function getInstance(params: GetInstanceParams): Promise<ApiResponse<InstanceDetailResponse>> {
  return callApi({ method: 'quickrun/getInstance', params });
}

// ── Workflow Config Persistence (direct postMessage, extension-host only) ─────

export interface TransitionBucketEntry {
  key: string;
  headers: Record<string, string>;
  queryStrings: Record<string, unknown>;
  body: {
    key?: string;
    stage?: string;
    tags?: string[];
    attributes: Record<string, unknown>;
  };
}

export interface WorkflowBucketConfig {
  key: string;
  globalHeaders: Record<string, string>;
  start: {
    headers: Record<string, string>;
    queryStrings: { sync?: boolean; version?: string };
    body: {
      key?: string;
      stage?: string;
      tags?: string[];
      attributes: Record<string, unknown>;
    };
  };
  transitions: TransitionBucketEntry[];
}

/** Web SPA / alternate persistence (e.g. localStorage); takes precedence when set. */
export interface DataBucketAdapter {
  save(domain: string, workflowKey: string, config: WorkflowBucketConfig): Promise<void>;
  load(domain: string, workflowKey: string): Promise<WorkflowBucketConfig | null>;
}

let _dataBucketAdapter: DataBucketAdapter | null = null;

export function setDataBucketAdapter(adapter: DataBucketAdapter | null): void {
  _dataBucketAdapter = adapter;
}

type PostMessageFn = (msg: unknown) => void;
let _postMessage: PostMessageFn | null = null;

export function setDataBucketPostMessage(fn: PostMessageFn): void {
  _postMessage = fn;
}

function postMessageRpc<T>(type: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!_postMessage) return Promise.resolve(null);

  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type?: string; requestId?: string };
      if (msg?.requestId === requestId && msg?.type === `${type}:response`) {
        window.removeEventListener('message', handler);
        resolve((event.data as { config?: T; success?: boolean }).config ?? null);
      }
    };
    window.addEventListener('message', handler);
    _postMessage!({ type, requestId, ...payload });
    setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 5_000);
  });
}

export async function saveWorkflowConfig(domain: string, workflowKey: string, config: WorkflowBucketConfig): Promise<void> {
  const adapter = _dataBucketAdapter;
  if (adapter) {
    await adapter.save(domain, workflowKey, config);
    return;
  }
  await postMessageRpc('databucket:saveConfig', { domain, workflowKey, config });
}

export async function loadWorkflowConfig(domain: string, workflowKey: string): Promise<WorkflowBucketConfig | null> {
  const adapter = _dataBucketAdapter;
  if (adapter) {
    return adapter.load(domain, workflowKey);
  }
  return postMessageRpc<WorkflowBucketConfig>('databucket:loadConfig', { domain, workflowKey });
}

export function createEmptyConfig(workflowKey: string): WorkflowBucketConfig {
  return {
    key: workflowKey,
    globalHeaders: {},
    start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
    transitions: [],
  };
}

// ── Test Data + Presets — companion API for NewRunDialog ──────────────────
// These helpers power the auto-fill / regenerate / preset save-load workflow
// inside the start-instance dialog. Test-data calls reach the same
// `test-data/*` registry the standalone Cmd+Shift+G overlay uses; presets
// are stored at `<userData>/quickrun-presets/<projectId>/<workflowKey>/`.

export interface SchemaReference {
  key: string;
  flow?: string;
  domain?: string;
  version: string;
}

export interface GenerateOptions {
  seed?: number | string;
  alwaysFakeOptionals?: boolean;
}

export interface GenerateForSchemaReferenceResult {
  instance: unknown;
  schema: Record<string, unknown>;
  schemaSourcePath: string;
  warnings: string[];
}

/**
 * Generate a faker-driven JSON instance against a workflow's
 * `startTransition.schema` reference. Backend resolves the reference to a
 * Schema component file under `Schemas/`, extracts `attributes.schema`,
 * runs json-schema-faker.
 */
export async function generateForSchemaReference(args: {
  projectId: string;
  schemaRef: SchemaReference;
  options?: GenerateOptions;
}): Promise<ApiResponse<GenerateForSchemaReferenceResult>> {
  return callApi<GenerateForSchemaReferenceResult>({
    method: 'test-data/generateForSchemaReference',
    params: {
      projectId: args.projectId,
      schemaRef: args.schemaRef,
      ...(args.options ? { options: args.options } : {}),
    },
  });
}

export interface GenerateForSchemaResult {
  /** Faker-driven instance — typically a JSON-serialisable plain object. */
  instance: unknown;
  /** Per-call diagnostic — populated when faker raised non-fatal warnings. */
  warnings: string[];
}

/**
 * Generate a faker-driven JSON instance from a raw JSON Schema. Use when
 * the caller already has the schema in hand and doesn't need backend
 * reference resolution (e.g. `TransitionDialog` already fetched the
 * transition's schema from the runtime).
 */
export async function generateForSchema(args: {
  schema: Record<string, unknown>;
  options?: GenerateOptions;
}): Promise<ApiResponse<GenerateForSchemaResult>> {
  return callApi<GenerateForSchemaResult>({
    method: 'test-data/generate',
    params: {
      schema: args.schema,
      ...(args.options ? { options: args.options } : {}),
    },
  });
}

export interface PresetEntry {
  id: string;
  name: string;
  description?: string;
  payload: unknown;
  createdAt: string;
  lastUsedAt?: string;
}

export async function listPresets(args: {
  projectId: string;
  workflowKey: string;
}): Promise<ApiResponse<{ presets: PresetEntry[] }>> {
  return callApi<{ presets: PresetEntry[] }>({
    method: 'quickrun-presets/list',
    params: { projectId: args.projectId, workflowKey: args.workflowKey },
  });
}

export async function getPreset(args: {
  projectId: string;
  workflowKey: string;
  presetId: string;
}): Promise<ApiResponse<{ preset: PresetEntry | null }>> {
  return callApi<{ preset: PresetEntry | null }>({
    method: 'quickrun-presets/get',
    params: args,
  });
}

export async function savePreset(args: {
  projectId: string;
  workflowKey: string;
  presetId?: string;
  data: { name: string; description?: string; payload: unknown };
}): Promise<ApiResponse<{ preset: PresetEntry; created: boolean }>> {
  return callApi<{ preset: PresetEntry; created: boolean }>({
    method: 'quickrun-presets/save',
    params: args,
  });
}

export async function deletePreset(args: {
  projectId: string;
  workflowKey: string;
  presetId: string;
}): Promise<ApiResponse<{ deleted: boolean }>> {
  return callApi<{ deleted: boolean }>({
    method: 'quickrun-presets/delete',
    params: args,
  });
}
