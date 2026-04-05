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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutSeconds?: number;
  validateSsl?: boolean;
}

export interface DaprPubSubTaskConfig {
  pubSubName: string;
  topic: string;
  data?: unknown;
  metadata?: Record<string, string>;
}

export interface DaprServiceTaskConfig {
  appId: string;
  methodName: string;
  httpMethod?: string;
  body?: unknown;
}

export interface DaprBindingTaskConfig {
  bindingName: string;
  operation: string;
  data?: unknown;
  metadata?: Record<string, string>;
}

export interface GetInstancesTaskConfig {
  domain: string;
  flow: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: string[];
  useDapr?: boolean;
}

export interface StartTaskConfig {
  domain: string;
  flow: string;
  body?: unknown;
}

export interface DirectTriggerTaskConfig {
  domain: string;
  flow: string;
  transitionName: string;
  instanceId?: string;
  body?: unknown;
}

export interface GetInstanceDataTaskConfig {
  domain: string;
  flow: string;
  instanceId: string;
  extensions?: string;
}

export interface SubProcessTaskConfig {
  domain: string;
  key: string;
  version?: string;
  body?: unknown;
}
