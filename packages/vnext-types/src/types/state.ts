import { StateType, StateSubType } from '../constants/state-types';
import { TriggerType, TriggerKind } from '../constants/trigger-types';
import { ErrorBoundary } from './error-boundary';
import { Label } from './label';
import { MappingCode } from './mapping';
import type { RoleGrant } from './role';
import type { ViewBinding } from './view-binding';

export interface ResourceReference {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

export interface TaskExecution {
  order: number;
  task: ResourceReference;
  mapping?: MappingCode;
  errorBoundary?: ErrorBoundary;
}

export interface Transition {
  key: string;
  target: string;
  triggerType: TriggerType;
  triggerKind?: TriggerKind;
  versionStrategy?: string;
  labels?: Label[];
  rule?: MappingCode;
  timer?: MappingCode;
  schema?: ResourceReference;
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  view?: ViewBinding;
  views?: ViewBinding[];
}

export interface SharedTransition extends Transition {
  availableIn: string[];
}

export interface SubFlowTimerConfig {
  reset?: string;
  duration?: string;
}

export interface SubFlowTimeoutOverride {
  key: string;
  target: string;
  versionStrategy?: string;
  timer?: SubFlowTimerConfig;
}

export interface SubFlowOverrides {
  timeout?: SubFlowTimeoutOverride;
  transitions?: Record<string, { roles?: RoleGrant[] }>;
  states?: Record<string, { queryRoles?: RoleGrant[] }>;
}

export interface SubFlowConfig {
  type?: string;
  process: ResourceReference;
  mapping?: MappingCode;
  overrides?: SubFlowOverrides;
}

export interface State {
  key: string;
  stateType: StateType;
  subType?: StateSubType;
  versionStrategy?: string;
  labels?: Label[];
  onEntries?: TaskExecution[];
  onExits?: TaskExecution[];
  transitions?: Transition[];
  errorBoundary?: ErrorBoundary;
  view?: ResourceReference;
  subFlow?: SubFlowConfig;
}
