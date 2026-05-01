import { ErrorBoundary } from './error-boundary';
import { Label } from './label';
import { MappingCode } from './mapping';
import { RoleGrant } from './role';
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
}

export interface WorkflowTimerConfig {
  reset?: string;
  duration?: string;
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
