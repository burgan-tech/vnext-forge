import type { InstanceStatus } from './instance';

export type WorkflowType = 'F' | 'S' | 'P';

export interface RelatedComponent {
  compType: 'SubFlow' | 'Task' | 'Function' | 'Extension' | 'View' | 'Schema' | 'Mapping';
  id: string;
  name: string;
}

export interface StatePermission {
  state: string;
  stateType: 'State' | 'SubFlow';
  transitions: { name: string; roles: string[] }[];
  functions: { name: string; roles: string[] }[];
}

export interface WorkflowStats {
  active: number;
  busy: number;
  faulted: number;
  suspended: number;
  completed: number;
  stateDistribution: { state: string; count: number }[];
  duration: { avg: string; min: string; max: string; p95: string };
}

export interface WorkflowDefinition {
  [key: string]: unknown;
}

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  domain: string;
  version: string;
  versions: string[];
  author: string;
  updatedAt: string;
  tags: string[];
  warn?: string;
  stats: WorkflowStats;
  relatedComponents: RelatedComponent[];
  permissions: StatePermission[];
  definition: WorkflowDefinition;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  type: WorkflowType;
  version: string;
}

export interface WorkflowInstancesResult {
  items: import('./instance').Instance[];
  total: number;
  page: number;
  pageSize: number;
}

export type InstanceSortDirection = 'desc' | 'asc';
export type InstanceTimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';

export interface WorkflowInstancesQuery {
  status?: InstanceStatus | 'all';
  state?: string;
  search?: string;
  sort?: InstanceSortDirection;
  page?: number;
  pageSize?: number;
  timeFilter?: InstanceTimeFilter;
}
