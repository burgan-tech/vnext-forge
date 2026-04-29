import { Label } from './label';

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
  /** Default: 30 */
  timeoutSeconds?: number;
  /** Default: true */
  validateSsl?: boolean;
  /** Status codes treated as successful, e.g. "403", "4xx" */
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
