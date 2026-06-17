import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { JobsResponse } from '@monitoring/shared/types/jobs-api';

/** §6.2 — Domain-wide active jobs */
export function useDomainJobs() {
  return useQuery({
    queryKey: ['jobs', 'domain'],
    queryFn: () => domainGet<JobsResponse>('/jobs'),
  });
}
