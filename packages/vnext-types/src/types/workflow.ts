import { ErrorBoundary } from './error-boundary';
import type { Event } from './event';
import { Label } from './label';
import { MappingCode } from './mapping';
import { RoleGrant } from './role';
import { ScriptsConfig } from './scripts';
import { State, SharedTransition, ResourceReference, TaskExecution } from './state';
import { TriggerType } from '../constants/trigger-types';
import type { ViewBinding } from './view-binding';

export type WorkflowType = 'F' | 'S' | 'P' | 'C';

export interface StartTransition {
  key: string;
  target: string;
  triggerType?: number;
  versionStrategy?: string;
  schema?: ResourceReference;
  labels?: Label[];
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  annotations?: Record<string, string>;
}

export interface WorkflowTimerConfig {
  reset?: string;
  duration?: string;
}

/**
 * Cache TTL configuration for the workflow's built-in instance functions
 * (data, view, schema). Author-controlled; absent → host default.
 */
export interface FunctionCacheDefinition {
  ttlSeconds?: number;
}

/**
 * Flow-level configuration container for the workflow. Currently only
 * carries `functionCache`, but is a dedicated object so future flow-level
 * settings can be added without new top-level `attributes` keys.
 */
export interface WorkflowConfig {
  functionCache?: FunctionCacheDefinition;
}

export interface TimeoutTransition {
  key: string;
  target: string;
  versionStrategy?: string;
  timer?: WorkflowTimerConfig;
  mapping?: MappingCode;
}

export interface CancelTransition {
  key: string;
  target: string;
  triggerType?: TriggerType;
  versionStrategy?: string;
  labels?: Label[];
  schema?: ResourceReference;
  view?: ViewBinding;
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  availableIn?: string[];
  from?: string;
  _comment?: string;
  annotations?: Record<string, string>;
}

export interface ExitTransition {
  key: string;
  target: string;
  triggerType?: TriggerType;
  versionStrategy?: string;
  labels?: Label[];
  schema?: ResourceReference;
  view?: ViewBinding;
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  availableIn?: string[];
  from?: string;
  _comment?: string;
  annotations?: Record<string, string>;
}

export interface UpdateDataTransition {
  key: string;
  target: string;
  triggerType?: TriggerType;
  versionStrategy?: string;
  labels?: Label[];
  schema?: ResourceReference;
  view?: ViewBinding;
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  availableIn?: string[];
  from?: string;
  _comment?: string;
  annotations?: Record<string, string>;
}

export interface WorkflowAttributes {
  type: WorkflowType;
  labels?: Label[];
  startTransition: StartTransition;
  states: State[];
  sharedTransitions?: SharedTransition[];
  timeout?: TimeoutTransition;
  cancel?: CancelTransition;
  exit?: ExitTransition;
  updateData?: UpdateDataTransition;
  functions?: ResourceReference[];
  extensions?: ResourceReference[];
  schema?: ResourceReference;
  queryRoles?: RoleGrant[];
  errorBoundary?: ErrorBoundary;
  /**
   * Workflow-level CSX helper + assembly imports. Mirrors the
   * `scripts` sub-object on individual mapping / rule / timer slots
   * but applies once to the whole workflow runtime.
   */
  scripts?: ScriptsConfig;
  /**
   * Optional output mapping for the workflow. Shapes the data returned
   * when the workflow completes. Based on the schema's ScriptCode
   * definition (same shape as mapping slots).
   */
  output?: MappingCode;
  /**
   * Declares how an inbound external event is mapped before it starts the
   * workflow. Present when the workflow is startable via an external event.
   */
  event?: Event;
  /**
   * Flow-level config container. Currently exposes `functionCache.ttlSeconds`,
   * the author-controlled TTL for the built-in instance functions (data, view,
   * schema); absent → host default.
   */
  config?: WorkflowConfig;
}

export interface VnextWorkflow {
  _comment?: string;
  key: string;
  flow: string;
  domain: string;
  version: string;
  tags?: string[];
  attributes: WorkflowAttributes;
}
