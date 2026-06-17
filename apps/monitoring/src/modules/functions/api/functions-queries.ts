import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { DomainFunctionsResponse } from '@monitoring/shared/types/jobs-api';

/** §5.1 — Domain-scope function definitions */
export function useDomainFunctions() {
  return useQuery({
    queryKey: ['functions', 'domain'],
    queryFn: () => domainGet<DomainFunctionsResponse>('/functions/scope'),
  });
}
