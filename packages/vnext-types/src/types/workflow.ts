import { ErrorBoundary } from '@vnext-types-internal/error-boundary';
import { Label } from '@vnext-types-internal/label';
import { MappingCode } from '@vnext-types-internal/mapping';
import { State, SharedTransition, ResourceReference } from '@vnext-types-internal/state';

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
