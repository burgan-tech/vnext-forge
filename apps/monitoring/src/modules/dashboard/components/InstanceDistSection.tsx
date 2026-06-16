import { useNavigate } from 'react-router-dom';

import type { InstanceStats } from '@monitoring/shared/types';
import { KpiCard } from './KpiCard';

interface InstanceDistSectionProps {
  data: InstanceStats | undefined;
  isLoading: boolean;
}

export function InstanceDistSection({ data, isLoading }: InstanceDistSectionProps) {
  const navigate = useNavigate();
  const v = (n: number | undefined) => (isLoading ? '—' : (n ?? 0));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instance Distribution
        </h2>
        <span className="text-xs text-muted-foreground">last 7 days</span>
      </div>
      <div className="grid grid-cols-7 gap-3">
        <KpiCard label="Total" value={v(data?.total)} />
        <KpiCard label="Active" value={v(data?.active)} />
        <KpiCard label="Busy" value={v(data?.busy)} variant="warning" />
        <KpiCard label="Completed" value={v(data?.completed)} />
        <KpiCard
          label="Faulted"
          value={v(data?.faulted)}
          variant="danger"
          onClick={() => navigate('/faults')}
        />
        <KpiCard label="Suspended" value={v(data?.suspended)} />
        <KpiCard label="Terminated" value={v(data?.terminated)} />
      </div>
    </section>
  );
}
