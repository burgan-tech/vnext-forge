import { useQuery } from '@tanstack/react-query';
import { monitorGet } from '@monitoring/shared/api/monitoring-api';
import type { RuntimeConfigResponse, HealthDetailResponse } from '@monitoring/shared/types/jobs-api';

/** §7.1 — Monitor host runtime config (no domain scope) */
export function useDomainConfig() {
  return useQuery({
    queryKey: ['config', 'runtime'],
    queryFn: () => monitorGet<RuntimeConfigResponse>('config'),
  });
}

/** §8.1 — Detailed health check for all registered components */
export function useHealthDetail() {
  return useQuery({
    queryKey: ['health', 'detail'],
    queryFn: () => monitorGet<HealthDetailResponse>('monitor/health/detail'),
    refetchInterval: 30_000,
  });
}
