export interface FlowLabelsMap {
  workflowLabel: string | null;
  states: Record<string, string>;
  transitions: Record<string, string>;
}

export type InstanceStatus = 'A' | 'B' | 'C' | 'F';

export interface QuickRunInstance {
  id: string;
  key: string;
  status: InstanceStatus;
  domain: string;
  workflowKey: string;
  environmentName?: string;
  currentState?: string;
  startedAt: string;
  transitions?: TransitionInfo[];
  sharedTransitions?: TransitionInfo[];
}

export interface TransitionInfo {
  name: string;
  view?: {
    hasView: boolean;
    loadData: boolean;
    href: string;
  };
  schema?: {
    hasSchema: boolean;
    href: string;
  };
  href: string;
  annotations?: Record<string, string>;
  /**
   * R21: engine-declared semantic of this transition. Drives grouping
   * + colour of the button in the Available Transitions section.
   * Older engine responses may omit this; consumers default to
   * `'stateTransition'` (when the transition is in `transitions[]`)
   * or `'sharedTransition'` (when in `sharedTransitions[]`).
   */
  kind?: TransitionKind;
}

/** R21: known transition kinds — see Workflow engine state model. */
export const TRANSITION_KINDS = [
  'stateTransition',
  'sharedTransition',
  'cancel',
  'exit',
  'update-parent-data',
  '$timeout',
] as const;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];

export interface CorrelationInfo {
  correlationId: string;
  parentState: string;
  subFlowInstanceId: string;
  subFlowType: string;
  subFlowDomain: string;
  subFlowName: string;
  subFlowVersion: string;
  isCompleted: boolean;
  href?: string;
}

/**
 * R21: engine lifecycle classification for the current state. Shown
 * as a small chip next to the state name so the user can tell at
 * a glance whether the workflow is starting (`initial`), running
 * (`intermediate`), terminating (`finish`), delegating to a child
 * flow (`subflow` / `subFlow`), or guided by a multi-page wizard.
 */
export const STATE_TYPES = [
  'initial',
  'intermediate',
  'finish',
  'subflow',
  'subFlow',
  'wizard',
] as const;
export type StateType = (typeof STATE_TYPES)[number];

export interface StateResponse {
  state: string;
  status: InstanceStatus;
  /** R21: optional engine-declared classification of the current state. */
  stateType?: string;
  transitions?: TransitionInfo[];
  sharedTransitions?: TransitionInfo[];
  activeCorrelations?: CorrelationInfo[];
  view?: {
    hasView: boolean;
    loadData: boolean;
    href: string;
  };
  data?: {
    href: string;
  };
  eTag?: string;
  entityEtag?: string;
  responseHeaders?: Record<string, string>;
}

export interface ViewResponse {
  key: string;
  content: string | Record<string, unknown>;
  type: string;
  display?: string;
  label?: string;
  renderer?: string;
}

export interface DataResponse {
  data: Record<string, unknown>;
  eTag?: string;
  entityEtag?: string;
  extensions?: Record<string, unknown>;
}

export interface SchemaResponse {
  key: string;
  type: string;
  schema: Record<string, unknown>;
}

export interface HistoryTransition {
  id: string;
  transitionId: string;
  fromState: string;
  toState: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  triggerType: string;
  body?: Record<string, unknown>;
  header?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
  createdByBehalfOf?: string;
}

export interface HistoryResponse {
  transitions: HistoryTransition[];
}

export interface InstanceListItem {
  id: string;
  key: string;
  flow: string;
  domain: string;
  flowVersion?: string;
  tags?: string[];
  metadata: {
    currentState: string;
    effectiveState: string;
    status: InstanceStatus;
    effectiveStateType?: string;
    effectiveStateSubType?: string;
    completedAt?: string;
    duration?: number;
    createdAt: string;
  };
}

export interface InstanceListResponse {
  links: {
    self: string;
    first?: string;
    next?: string;
    prev?: string;
  };
  items: InstanceListItem[];
}

export type QuickRunTab = {
  instanceId: string;
  domain: string;
  workflowKey: string;
  environmentName?: string;
  label: string;
};

export type ContextPanelTab = 'data' | 'history' | 'correlations';

export function safeViewContent(content: string | Record<string, unknown> | unknown): string {
  if (typeof content === 'string') return content;
  if (content != null && typeof content === 'object') {
    try { return JSON.stringify(content, null, 2); } catch { return String(content); }
  }
  return '';
}
