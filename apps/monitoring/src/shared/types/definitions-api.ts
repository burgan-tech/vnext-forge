export interface DefinitionListItem {
  id: string;       // = API "key"
  name: string;     // = first English label or key
  version: string;
  domain: string;
  type?: string;    // workflow: 'F'|'C'|'S'|'P', functions/extensions/schemas/views: raw string
  // task-specific
  taskType?: string;
  deprecated?: boolean;
  // function-specific
  returnType?: string;
  parameterCount?: number;
  scope?: string;           // functions, extensions
  // view-specific
  display?: string;
  renderer?: string;
  labels?: ApiComponentLabel[];
  usedBy?: string[];
  // common metadata
  flowVersion?: string;
  createdAt?: string;   // ISO 8601 datetime
  modifiedAt?: string;  // ISO 8601 datetime
}

// API §2.1 list response shape
export interface ApiComponentLabel {
  language: string;
  label: string;
}

export interface ApiComponentListItem {
  key: string;
  version: string;
  domain: string;
  labels?: ApiComponentLabel[];
  type?: string | number | null; // workflow: 'F'|'C'|'S'|'P', task: 1-16 (number), others: string
  // component-specific fields (component type dependent)
  scope?: string;
  display?: string;
  renderer?: string;
  // metadata
  flowVersion?: string;
  createdAt?: string;   // ISO 8601 datetime
  modifiedAt?: string;  // ISO 8601 datetime
}

export interface ApiComponentListResponse {
  componentType?: string;
  items: ApiComponentListItem[];
  pagination?: {
    page: number;
    pageSize: number;
    hasNext: boolean;
  };
  // Legacy fields (if API ever returns them at top level)
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

// Task type mapping (§2.1 sys-tasks type field)
export const TASK_TYPE_MAP: Record<number, string> = {
  1: 'DaprHttpEndpoint',
  2: 'DaprBinding',
  3: 'DaprService',
  4: 'DaprPubSub',
  5: 'HumanTask',
  6: 'HttpTask',
  7: 'ScriptTask',
  8: 'ConditionTask',
  9: 'TimerTask',
  10: 'NotificationTask',
  11: 'StartFlowTask',
  12: 'TriggerTransitionTask',
  13: 'GetInstanceDataTask',
  14: 'SubProcessTask',
  15: 'GetInstancesTask',
  16: 'SoapTask',
};

// View type mapping (§2.1 sys-views type field)
export const VIEW_TYPE_MAP: Record<number, string> = {
  1: 'JSON',
  2: 'HTML',
  3: 'Markdown',
  4: 'Deeplink',
  5: 'Http',
  6: 'URN',
};

// Scope mapping (§2.1 sys-functions scope field)
export const SCOPE_MAP: Record<string, string> = {
  D: 'Domain',
  F: 'Flow',
  I: 'Instance',
};

// API §2.1 detail response (with key param)
export interface ApiComponentDetailResponse extends ApiComponentListItem {
  flow?: string;
  versions?: string[];
}

// API §2.2 full definition response
export interface ApiComponentDefinitionResponse {
  componentType: string;
  items: Record<string, unknown>[];
}

// --- Workflow definition JSON structure (§2.2 items[0] for sys-flows) ---

export interface WorkflowDefLabel {
  language: string;
  label: string;
}

export interface WorkflowDefState {
  key: string;
  type: number; // 1=Initial 2=Intermediate 3=Finish 4=SubFlow 5=Wizard
  labels?: WorkflowDefLabel[];
}

export interface WorkflowDefTransition {
  key: string;
  from: string;
  to: string;
  triggerType?: number; // 0=Manual 1=Automatic 2=Scheduled 3=Event
}

export interface WorkflowDefinitionItem {
  key: string;
  version: string;
  states?: WorkflowDefState[];
  transitions?: WorkflowDefTransition[];
  [key: string]: unknown;
}

// --- §3.1 Workflow instance counts ---

export interface WorkflowInstanceStats {
  active: number;
  busy: number;
  completed: number;
  faulted: number;
  passive: number;
  total: number;
}

// --- §3.3 State distribution ---

export interface WorkflowStateDistItem {
  stateKey: string;
  total: number;
  active: number;
  busy: number;
  faulted: number;
}

export interface WorkflowStateDistribution {
  states: WorkflowStateDistItem[];
  totalActiveInstances: number;
}

// --- §3.6 Duration stats ---

export interface WorkflowDurationStats {
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p95Ms: number | null;
}

// --- §3.4 Fault stats ---

export interface WorkflowFaultStats {
  totalFaulted: number;
  byState: { key: string; count: number }[];
  byTask: { key: string; count: number }[];
  trend: { last1h: number; last24h: number; last7d: number };
}

// --- §3.5 Task stats ---

export interface WorkflowTaskStatItem {
  taskKey: string;
  executionCount: number;
  successRate: number;
  failureRate: number;
}

export interface WorkflowTaskStats {
  byTask: WorkflowTaskStatItem[];
}

// --- §4.1 Workflow permissions matrix ---

export interface WorkflowPermRole {
  role: string;
  grant: 'allow' | 'deny';
}

export interface WorkflowPermState {
  key: string;
  queryRoles: WorkflowPermRole[];
}

export interface WorkflowPermTransition {
  key: string;
  from: string;
  target: string;
  roles: WorkflowPermRole[];
}

export interface WorkflowPermFunction {
  key: string;
  roles: WorkflowPermRole[];
}

export interface WorkflowPermissionsMatrix {
  workflowKey: string;
  version: string;
  queryRoles: WorkflowPermRole[];
  states: WorkflowPermState[];
  transitions: WorkflowPermTransition[];
  functions: WorkflowPermFunction[];
}

// --- §2.4 Workflow dependencies ---

export interface WorkflowDepItem {
  key: string;
  version: string;
  domain: string;
  referencedFrom?: string;
}

export interface WorkflowDependencies {
  workflow: { key: string; version: string; domain: string };
  dependencies: {
    tasks?: WorkflowDepItem[];
    schemas?: WorkflowDepItem[];
    views?: WorkflowDepItem[];
    functions?: WorkflowDepItem[];
    extensions?: WorkflowDepItem[];
    mappings?: WorkflowDepItem[];
  };
}
