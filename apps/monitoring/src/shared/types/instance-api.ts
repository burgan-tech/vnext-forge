// API-shaped response types matching docs/vnext-monitor-api-reference.md

// --- 1.2 Instance Detail ---

export interface InstanceMetadata {
  currentState: string;
  effectiveState: string;
  status: string;
  effectiveStateType: string;
  effectiveStateSubType: string | null;
  completedAt: string | null;
  duration: number | null;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  createdByBehalfOf: string | null;
  modifiedBy: string | null;
  modifiedByBehalfOf: string | null;
}

export interface ActiveCorrelation {
  id: string;
  parentState: string;
  subFlowInstanceId: string;
  subFlowDomain: string;
  subFlowName: string;
  subFlowVersion: string;
  subFlowType: 'S' | 'P';
  subFlowCurrentState: string;
}

export interface InstanceDetailResponse {
  id: string;
  key: string;
  flow: string;
  flowVersion: string;
  domain: string;
  tags: string[];
  metadata: InstanceMetadata;
  activeCorrelations: ActiveCorrelation[];
}

// --- 1.5 Instance Timeline ---

export interface TimelineTask {
  id: string;
  transitionId: string;
  taskId: string;
  status: string;
  businessStatus: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
}

export interface TimelineTransition {
  id: string;
  transitionId: string;
  fromState: string;
  toState: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  triggerType: string;
  createdBy: string;
  createdByBehalfOf: string | null;
  tasks: TimelineTask[] | null;
}

export interface InstanceTimelineResponse {
  transitions: TimelineTransition[];
  task: TimelineTask | null;
}

// --- 1.6 Instance State ---

export interface AvailableTransition {
  key: string;
  target: string;
  triggerType: string;
  roles: string[];
}

export interface InstanceStateResponse {
  currentState: string;
  stateType: string;
  stateSubType: string | null;
  status: string;
  effectiveState: string;
  availableTransitions: AvailableTransition[];
  activeCorrelations: ActiveCorrelation[];
}

// --- 1.3 Instance Data ---

export interface DataVersionEntry {
  version: string;
  enteredAt: string;
  data: Record<string, unknown>;
}

export interface InstanceDataResponse {
  data: Record<string, unknown> | null;
  latestData: Record<string, unknown> | null;
  versionHistory: DataVersionEntry[] | null;
}

// --- 1.11 Instance Tasks ---

export interface InstanceTaskItem {
  id: string;
  taskDefinitionKey: string;
  status: string;
  businessStatus: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface InstanceTasksResponse {
  items: InstanceTaskItem[];
  total: number;
}

// --- 1.7 Instance Faults ---

export interface FaultedTransition {
  id: string;
  transitionId: string;
  fromState: string;
  toState: string | null;
  startedAt: string;
  triggerType: string;
}

export interface FaultedTask {
  id: string;
  transitionId: string;
  taskId: string;
  status: string;
  businessStatus: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
}

export interface InstanceFaultsResponse {
  lastKnownState: string;
  effectiveState: string;
  status: string;
  faultedTransition: FaultedTransition | null;
  faultedTasks: FaultedTask[];
}

// --- 4.2 Instance Permissions ---

export interface RoleGrant {
  role: string;
  grant: 'allow' | 'deny';
}

export interface PermissionState {
  key: string;
  queryRoles: RoleGrant[];
}

export interface PermissionTransition {
  key: string;
  from: string;
  target: string;
  roles: RoleGrant[];
}

export interface PermissionFunction {
  key: string;
  roles: RoleGrant[];
}

export interface InstancePermissionsResponse {
  workflowKey: string;
  version: string;
  queryRoles: RoleGrant[];
  state: PermissionState | null;
  transitions: PermissionTransition[];
  functions: PermissionFunction[];
}

// --- 1.12 Instance Task Detail ---

export interface InstanceTaskDetailResponse {
  id: string;
  taskDefinitionKey: string;
  status: string;
  businessStatus: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  error: string | null;
  triggerContext: {
    transitionId: string;
    fromState: string;
    toState: string;
    triggerType: string;
  } | null;
}

// --- 1.8 Instance Data Diff ---

export interface DiffFieldAdded {
  path: string;
  value: string;
}

export interface DiffFieldRemoved {
  path: string;
  value: string;
}

export interface DiffFieldChanged {
  path: string;
  oldValue: string;
  newValue: string;
}

export interface InstanceDataDiffResponse {
  fromVersion: string;
  toVersion: string;
  added: DiffFieldAdded[];
  removed: DiffFieldRemoved[];
  changed: DiffFieldChanged[];
  unchangedCount: number;
}

// --- 1.10 Instance Parent ---

export interface InstanceParentInfo {
  parentInstanceId: string;
  key: string;
  flow: string;
  domain: string;
  parentState: string;
  correlationType: 'S' | 'P';
}

export interface InstanceParentResponse {
  parent: InstanceParentInfo | null;
}

// --- 1.9 Instance Hierarchy ---

export interface HierarchyNode {
  instanceId: string;
  key: string;
  flow: string;
  domain: string;
  flowVersion: string;
  currentState: string;
  status: string;
  subFlowType: 'S' | 'P' | null;
  parentState: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  children: HierarchyNode[];
}
