export type InstanceStatus =
  | 'Active'
  | 'Busy'
  | 'Completed'
  | 'Faulted'
  | 'Suspended'
  | 'Terminated';

export interface Instance {
  id: string;
  key: string;
  workflow: string;
  workflowName: string;
  workflowVersion: string;
  domain: string;
  status: InstanceStatus;
  state: string;
  createdAt: string;
  updatedAt: string;
  etag: string;
  tags: string[];
  err?: string;
}

export type TriggerType = 'Automatic' | 'Manual' | 'Event' | 'Scheduled';

export interface Transition {
  name: string;
  from: string;
  to: string;
  trigger: TriggerType;
  at: string;
  by: string;
  note?: string;
  tasks: string[];
}

export interface TaskLogEntry {
  id: string;
  execId?: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  code: number;
  ms: number;
  transition: string;
  at: string;
  ok: boolean;
  error?: string;
  output?: object;
}

export interface DiffEntry {
  op: '+' | '-' | '~';
  path: string;
  value: unknown;
  oldValue?: unknown;
}

export interface DataVersion {
  ver: number;
  at: string;
  transition: string;
  diff: DiffEntry[];
  data: object;
}

export interface Correlation {
  key: string;
  instanceId: string;
  corrType: 'SubFlow' | 'SubProcess';
  workflow: string;
  status: InstanceStatus;
  startedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'initial' | 'state' | 'subflow' | 'finish';
  status?: 'completed' | 'current' | 'pending';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  triggerType: TriggerType;
}

export interface CurrentPermissions {
  state: string;
  transitions: { name: string; roles: string[] }[];
  functions: { name: string; roles: string[] }[];
}

export interface InstanceDetail extends Instance {
  currentPermissions: CurrentPermissions;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  transitions: Transition[];
  taskLog: TaskLogEntry[];
  dataVersions: DataVersion[];
  correlations: Correlation[];
}
