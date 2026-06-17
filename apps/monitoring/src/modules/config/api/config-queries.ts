import { useQuery } from '@tanstack/react-query';
import { monitorGet } from '@monitoring/shared/api/monitoring-api';
import type { RuntimeConfigResponse } from '@monitoring/shared/types/jobs-api';

/** §7.1 — Monitor host runtime config (no domain scope) */
export function useDomainConfig() {
  return useQuery({
    queryKey: ['config', 'runtime'],
    queryFn: () => monitorGet<RuntimeConfigResponse>('config'),
  });
}
