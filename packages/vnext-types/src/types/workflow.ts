import { Label } from './label';
import { State, SharedTransition, ResourceReference } from './state';
import { ErrorBoundary } from './error-boundary';
import { MappingCode } from './mapping';

export type WorkflowType = 'F' | 'S' | 'P' | 'C';

export interface StartTransition {
  key: string;
  target: string;
  triggerType?: number;
  versionStrategy?: string;
  schema?: ResourceReference;
  labels?: Label[];
  mapping?: MappingCode;
}

export interface TimeoutTransition {
  key: string;
  target: string;
  timer?: MappingCode;
}

export interface CancelTransition {
  key: string;
  target: string;
  cascadeCancel?: boolean;
}

export interface WorkflowAttributes {
  type: WorkflowType;
  labels?: Label[];
  startTransition: StartTransition;
  states: State[];
  sharedTransitions?: SharedTransition[];
  timeout?: TimeoutTransition;
  cancel?: CancelTransition;
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
