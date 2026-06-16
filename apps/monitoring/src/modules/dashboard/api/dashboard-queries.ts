import { useQuery } from '@tanstack/react-query';

import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { ComponentCounts, Instance, InstanceStats, StatsTimePoint } from '@monitoring/shared/types';

export type StatsTimeRange = '24h' | '7d' | '30d';

export function useInstanceStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => domainGet<InstanceStats>('/stats'),
  });
}

export function useStatsTimeSeries(range: StatsTimeRange) {
  return useQuery({
    queryKey: ['dashboard', 'stats', 'timeseries', range],
    queryFn: () => domainGet<StatsTimePoint[]>(`/stats/hourly`, { range }),
  });
}

export function useRecentFaults() {
  return useQuery({
    queryKey: ['dashboard', 'recent-faults'],
    queryFn: () =>
      domainGet<Instance[]>('/instances', {
        status: 'Faulted',
        limit: '5',
        sort: 'desc',
      }),
  });
}

export function useComponentCounts() {
  return useQuery({
    queryKey: ['dashboard', 'component-counts'],
    queryFn: () => domainGet<ComponentCounts>('/components/counts'),
  });
}
