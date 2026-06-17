import { useQuery } from '@tanstack/react-query';
import { workflowGet, instanceGet } from '@monitoring/shared/api/monitoring-api';
import type { Instance, InstanceStatus } from '@monitoring/shared/types';
import type {
  InstanceDetailResponse,
  InstanceTimelineResponse,
  InstanceStateResponse,
  InstanceDataResponse,
  InstanceTasksResponse,
  InstanceFaultsResponse,
  InstancePermissionsResponse,
  HierarchyNode,
} from '@monitoring/shared/types/instance-api';

export type InstanceTimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';
export type InstanceSortOrder = 'desc' | 'asc';

export interface InstanceListParams {
  workflowId: string;
  status?: InstanceStatus | 'all';
  state?: string;
  search?: string;
  timeFilter?: InstanceTimeFilter;
  sort?: InstanceSortOrder;
  page?: number;
  pageSize?: number;
}

export interface InstanceListResult {
  items: Instance[];
  total: number;
  page: number;
  pageSize: number;
}

export function useInstanceList(params: InstanceListParams) {
  const query: Record<string, string> = {};
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.state) query.state = params.state;
  if (params.search) query.search = params.search;
  if (params.timeFilter && params.timeFilter !== 'all') query.timeFilter = params.timeFilter;
  if (params.sort) query.sort = params.sort;
  if (params.page) query.page = String(params.page);
  if (params.pageSize) query.pageSize = String(params.pageSize);

  return useQuery({
    queryKey: ['instances', params],
    queryFn: () => workflowGet<InstanceListResult>(params.workflowId, '/instances', query),
    enabled: Boolean(params.workflowId),
  });
}

// --- Instance Detail Hooks (API endpoints from docs/vnext-monitor-api-reference.md) ---

/** API 1.2 — Full instance detail + activeCorrelations */
export function useInstanceDetail(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'detail'],
    queryFn: () => instanceGet<InstanceDetailResponse>(workflow, instanceId),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.5 — Transition timeline. Pass includeTasks=true to embed task log per transition. */
export function useInstanceTimeline(
  workflow: string,
  instanceId: string,
  opts: { includeTasks?: boolean } = {},
) {
  const params: Record<string, string> = {};
  if (opts.includeTasks) params.includeTasks = 'true';

  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'timeline', opts],
    queryFn: () => instanceGet<InstanceTimelineResponse>(workflow, instanceId, '/timeline', params),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.6 — Current state + available transitions */
export function useInstanceState(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'state'],
    queryFn: () => instanceGet<InstanceStateResponse>(workflow, instanceId, '/state'),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.3 — Latest data + full version history */
export function useInstanceData(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'data'],
    queryFn: () => instanceGet<InstanceDataResponse>(workflow, instanceId, '/data'),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.11 — All tasks executed by this instance */
export function useInstanceTasks(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'tasks'],
    queryFn: () => instanceGet<InstanceTasksResponse>(workflow, instanceId, '/tasks'),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.7 — Fault root cause. Only meaningful when instance status = Faulted. */
export function useInstanceFaults(workflow: string, instanceId: string, enabled = true) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'faults'],
    queryFn: () => instanceGet<InstanceFaultsResponse>(workflow, instanceId, '/faults'),
    enabled: Boolean(workflow) && Boolean(instanceId) && enabled,
  });
}

/** API 4.2 — Instance-level permission view (current state's roles) */
export function useInstancePermissions(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'permissions'],
    queryFn: () => instanceGet<InstancePermissionsResponse>(workflow, instanceId, '/permissions'),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}

/** API 1.9 — Recursive sub-flow/sub-process tree */
export function useInstanceHierarchy(workflow: string, instanceId: string) {
  return useQuery({
    queryKey: ['instance', workflow, instanceId, 'hierarchy'],
    queryFn: () => instanceGet<HierarchyNode>(workflow, instanceId, '/hierarchy'),
    enabled: Boolean(workflow) && Boolean(instanceId),
  });
}
