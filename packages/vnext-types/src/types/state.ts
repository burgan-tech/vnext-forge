import { StateType, StateSubType } from '@constants/state-types';
import { TriggerType, TriggerKind } from '@constants/trigger-types';
import { ErrorBoundary } from '@vnext-types-internal/error-boundary';
import { Label } from '@vnext-types-internal/label';
import { MappingCode } from '@vnext-types-internal/mapping';

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
  view?: ResourceReference;
}

export interface SharedTransition extends Transition {
  availableIn: string[];
}

export interface SubFlowConfig {
  key: string;
  domain: string;
  version: string;
  flow: string;
  mapping?: MappingCode;
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
