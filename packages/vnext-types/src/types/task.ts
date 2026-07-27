import { Label } from './label';
import type { MappingCodeRef } from './mapping';

export interface TaskDefinition {
  key: string;
  version: string;
  domain: string;
  flow: string;
  flowVersion?: string;
  tags?: string[];
  attributes: {
    type: string;
    config: Record<string, unknown>;
    labels?: Label[];
  };
}

export interface HttpTaskConfig {
  /** HTTP method (required) */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request URL (required) */
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Content-Type header for the request body (e.g. "application/json"). Optional. */
  contentType?: string;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Default: true */
  validateSsl?: boolean;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface NotificationTaskConfig {
  channels?: string[];
  /** Default: true */
  includeStateChannel?: boolean;
}

export interface SoapTaskConfig {
  /** SOAP endpoint URL (required) */
  url: string;
  /** SOAPAction value */
  soapAction?: string;
  /** Default: "1.1" */
  soapVersion?: '1.1' | '1.2';
  /** Raw XML SOAP envelope template */
  body?: string | null;
  headers?: Record<string, string> | null;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Default: true */
  validateSsl?: boolean;
  /** Status codes treated as successful, e.g. "500", "5xx", "50x" */
  acceptedStatusCodes?: string[];
}

export interface DaprServiceTaskConfig {
  /** Dapr App ID (required) */
  appId: string;
  /** Method name to invoke (required) */
  methodName: string;
  /** HTTP verb (required). Default: "POST" */
  httpVerb: string;
  body?: unknown;
  headers?: Record<string, string>;
  queryString?: string;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface DaprPubSubTaskConfig {
  /** PubSub name (required) */
  pubSubName: string;
  /** Topic name (required) */
  topic: string;
  data?: unknown;
  metadata?: Record<string, string>;
}

export interface DaprBindingTaskConfig {
  /** Binding name (required) */
  bindingName: string;
  /** Operation name (required) */
  operation: string;
  data?: unknown;
  metadata?: Record<string, string>;
}

export interface StartTaskConfig {
  /** Domain of the target workflow (required) */
  triggerDomain: string;
  /** Flow name of the target workflow (required) */
  triggerFlow: string;
  body?: unknown;
  /** Default: true */
  triggerSync?: boolean;
  triggerVersion?: string;
  triggerKey?: string;
  triggerTags?: string[];
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface DirectTriggerTaskConfig {
  /** Transition name to execute (required) */
  transitionName: string;
  /** Domain of the target workflow (required) */
  triggerDomain: string;
  /** Flow name of the target workflow (required) */
  triggerFlow: string;
  triggerKey?: string;
  triggerInstanceId?: string;
  /** Default: true */
  triggerSync?: boolean;
  triggerTags?: string[];
  body?: unknown;
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface SubProcessTaskConfig {
  /** Domain of the target workflow (required) */
  triggerDomain: string;
  /** Flow name of the target workflow (required) */
  triggerFlow: string;
  triggerKey?: string;
  triggerVersion?: string;
  /** Default: false */
  triggerSync?: boolean;
  body?: unknown;
  triggerTags?: string[];
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface GetInstancesTaskConfig {
  /** Domain of the target workflow (required) */
  triggerDomain: string;
  /** Flow name of the target workflow (required) */
  triggerFlow: string;
  /** Default: 1 */
  page?: number;
  /** Default: 10 */
  pageSize?: number;
  sort?: string;
  filter?: string;
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface StateStoreTaskConfig {
  /** Command to execute (required) */
  command: 'get' | 'set' | 'delete';
  /** Dapr state store component name. Empty → runtime DAPR_STATE_STORE_NAME */
  storeName?: string;
  /** Cache key targeted by get, set and single-key delete */
  key?: string;
  /** Keys for bulk delete */
  keys?: string[];
  /** Dapr state Query API filter (JSON) for tag/pattern based delete */
  query?: Record<string, unknown>;
  /** Value written by set (any JSON value) */
  value?: unknown;
  /** Time-to-live in seconds applied on set */
  ttlInSeconds?: number;
  /** ETag for optimistic concurrency on read/write */
  etag?: string;
  concurrency?: 'FirstWrite' | 'LastWrite';
  consistency?: 'Eventual' | 'Strong';
  /** Additional metadata passed to the Dapr state store operation */
  metadata?: Record<string, unknown>;
}

export interface TaskReference {
  key: string;
  domain: string;
  /** Defaults to "sys-tasks" when omitted */
  flow?: 'sys-tasks';
  version: string;
}

/** ScriptCode shape as authored inline in task configs. */
export interface TaskScriptCode {
  /** 'G' = Global, 'L' = Local */
  type?: 'G' | 'L';
  location?: string;
  /** Inline script code; a sys-mappings reference object when encoding is REF. */
  code?: string | MappingCodeRef;
  encoding?: 'B64' | 'NAT' | 'REF';
}

export interface CacheAsideTaskConfig {
  /** Static cache key (optional; may be derived via keyExpression) */
  key?: string;
  /** Dapr state store name. Empty → runtime DAPR_STATE_STORE_NAME */
  storeName?: string;
  /** TTL seconds; absent or 0 → no expiry */
  ttlInSeconds?: number;
  consistency?: 'Eventual' | 'Strong';
  /** Task executed on a cache miss (required) */
  sourceTask: TaskReference;
  /** Mapping applied to the raw source result before caching/returning */
  sourceMapping?: TaskScriptCode;
  /** Dynamic Expresso expression overriding the cache key at runtime */
  keyExpression?: TaskScriptCode;
  /** Default: true */
  bypassOnCacheError?: boolean;
  /** Default: false */
  forceRefresh?: boolean;
}

export interface GetInstanceTaskConfig {
  /** Target workflow domain (required) */
  domain: string;
  /** Target workflow name (required) */
  flow: string;
  key?: string;
  /** GUID */
  instanceId?: string;
  extensions?: string[];
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}

export interface DaprConversationTaskConfig {
  /** Dapr conversation component name, e.g. "openai" (required) */
  componentName: string;
  /** Conversation inputs — JSON array of role/content messages */
  inputs?: unknown[];
  /** Provider-specific string parameters (model, maxTokens, …) */
  parameters?: Record<string, string>;
  /** Dapr component metadata */
  metadata?: Record<string, string>;
  contextId?: string;
  temperature?: number;
  scrubPII?: boolean;
  /** Default: 30 */
  timeoutSeconds?: number;
}

export interface GetInstanceDataTaskConfig {
  /** Domain of the target workflow (required) */
  triggerDomain: string;
  /** Flow name of the target workflow (required) */
  triggerFlow: string;
  /** Flow key (required when triggerInstanceId is absent) */
  triggerKey?: string;
  /** Instance ID (required when triggerKey is absent) */
  triggerInstanceId?: string;
  extensions?: string[];
  /** Default: false */
  useDapr?: boolean;
  /** Default: true */
  validateSsl?: boolean;
  headers?: Record<string, string>;
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Status codes treated as successful, e.g. "403", "4xx" */
  acceptedStatusCodes?: string[];
}
