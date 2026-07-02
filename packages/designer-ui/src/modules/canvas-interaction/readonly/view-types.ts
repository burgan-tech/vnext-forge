// Read-only view-model types for the shared canvas inspectors.
// These are derived from a workflow definition JSON by `normalize.ts`.
// They are intentionally lean and presentation-oriented — only what the
// inspectors render, not the full vNext domain model.

/** Reference to another vNext component (task / view / schema / function / extension). */
export interface ComponentRef {
  key: string;
  domain?: string;
  version?: string;
  flow?: string;
}

export interface LabelView {
  language: string;
  label: string;
}

export interface RoleGrantView {
  role: string;
  grant?: string; // 'allow' | 'deny' | raw
}

/** Inline-or-referenced code (csx mapping / rule / timer). `code` may be base64. */
export interface CodeView {
  code?: string;
  location?: string;
}

export interface TaskRefView {
  order?: number;
  ref: ComponentRef;
  comment?: string;
  mapping?: CodeView | null;
  hasErrorBoundary?: boolean;
}

export interface ViewBindingView {
  view: ComponentRef;
  loadData?: boolean;
  extensions?: string[];
}

export interface TransitionView {
  key: string;
  from: string; // source state key; '' / '__start__' for the start transition
  target: string; // resolved target / to
  triggerType?: number;
  triggerKind?: number;
  comment?: string;
  labels?: LabelView[];
  roles?: RoleGrantView[];
  tasks?: TaskRefView[]; // onExecutionTasks
  schema?: ComponentRef | null;
  mapping?: CodeView | null;
  rule?: CodeView | null;
  timer?: CodeView | null;
  view?: ViewBindingView | null;
  views?: ViewBindingView[];
  availableIn?: string[];
  annotations?: Record<string, string>;
  isStart?: boolean;
}

export interface ErrorHandlerView {
  target?: string;
  comment?: string;
}

export interface StateView {
  key: string;
  stateType: number; // 1 Initial 2 Intermediate 3 Finish 4 SubFlow 5 Wizard
  subType?: number;
  labels?: LabelView[];
  comment?: string;
  versionStrategy?: string;
  queryRoles?: RoleGrantView[];
  view?: ViewBindingView | null;
  views?: ViewBindingView[];
  onEntries?: TaskRefView[];
  onExits?: TaskRefView[];
  transitions: TransitionView[];
  errorHandlers?: ErrorHandlerView[];
  subFlowProcess?: ComponentRef | null;
  subFlowMapping?: CodeView | null;
}

export interface WorkflowMetaView {
  key: string;
  domain?: string;
  version?: string;
  flow?: string;
  type?: string; // F / C / S / P
  tags?: string[];
  comment?: string;
  labels?: LabelView[];
  schema?: ComponentRef | null;
  functions?: ComponentRef[];
  extensions?: ComponentRef[];
  queryRoles?: RoleGrantView[];
  cancel?: TransitionView | null;
  exit?: TransitionView | null;
  timeout?: TransitionView | null;
  updateData?: TransitionView | null;
  sharedTransitions?: TransitionView[];
}

export interface WorkflowViewModel {
  /** Shape consumed by `FlowCanvas` (same as the legacy `toFlowCanvasJson` output). */
  workflowJson: Record<string, unknown>;
  workflow: WorkflowMetaView;
  states: StateView[];
}
