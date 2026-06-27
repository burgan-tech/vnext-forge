import { useQuery } from '@tanstack/react-query';

import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { ComponentCounts, Instance, InstanceStats, StatsTimePoint } from '@monitoring/shared/types';

export type StatsTimeRange = '24h' | '7d' | '30d';

export function useInstanceStats(filter?: string) {
  return useQuery({
    queryKey: ['dashboard', 'stats', filter],
    queryFn: () =>
      domainGet<InstanceStats>('/stats/instances', filter ? { filter } : {}),
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useStatsTimeSeries(_range: StatsTimeRange) {
  // No hourly time-series endpoint in the monitoring API — return empty data
  return useQuery({
    queryKey: ['dashboard', 'stats', 'timeseries', 'disabled'],
    queryFn: (): Promise<StatsTimePoint[]> => Promise.resolve([]),
    enabled: false,
  });
}

export function useRecentFaults() {
  // No domain-wide faulted instances list endpoint in the monitoring API — disabled
  return useQuery({
    queryKey: ['dashboard', 'recent-faults', 'disabled'],
    queryFn: (): Promise<Instance[]> => Promise.resolve([]),
    enabled: false,
  });
}

export function useComponentCounts() {
  return useQuery({
    queryKey: ['dashboard', 'component-counts'],
    queryFn: () => domainGet<ComponentCounts>('/stats/components'),
  });
}
