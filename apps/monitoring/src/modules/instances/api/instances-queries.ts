import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { Instance, InstanceStatus } from '@monitoring/shared/types';

export type InstanceTimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';
export type InstanceSortOrder = 'desc' | 'asc';

export interface InstanceListParams {
  workflowId?: string;
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
  if (params.workflowId) query.workflow = params.workflowId;
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.state) query.state = params.state;
  if (params.search) query.search = params.search;
  if (params.timeFilter && params.timeFilter !== 'all') query.timeFilter = params.timeFilter;
  if (params.sort) query.sort = params.sort;
  if (params.page) query.page = String(params.page);
  if (params.pageSize) query.pageSize = String(params.pageSize);

  return useQuery({
    queryKey: ['instances', params],
    queryFn: () => domainGet<InstanceListResult>('/instances', query),
  });
}
