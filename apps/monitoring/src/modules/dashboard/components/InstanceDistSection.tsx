import { useNavigate } from 'react-router-dom';

import type { InstanceStats } from '@monitoring/shared/types';
import { KpiCard } from './KpiCard';

interface InstanceDistSectionProps {
  data: InstanceStats | undefined;
  isLoading: boolean;
  rangeLabel: string;
}

const CARDS = [
  { key: 'total'     as const, label: 'Total',     valueClassName: 'text-foreground' },
  { key: 'active'    as const, label: 'Active',    valueClassName: 'text-blue-600 dark:text-blue-400' },
  { key: 'busy'      as const, label: 'Busy',      valueClassName: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'completed' as const, label: 'Completed', valueClassName: 'text-green-600 dark:text-green-400' },
  { key: 'passive'   as const, label: 'Passive',   valueClassName: 'text-muted-foreground' },
];

export function InstanceDistSection({ data, isLoading, rangeLabel }: InstanceDistSectionProps) {
  const navigate = useNavigate();
  const v = (n: number | undefined) => (isLoading ? '—' : (n ?? 0));
  const hasFaults = !isLoading && (data?.faulted ?? 0) > 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instance Distribution
        </h2>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {CARDS.map(({ key, label, valueClassName }) => (
          <KpiCard key={key} label={label} value={v(data?.[key])} valueClassName={valueClassName} />
        ))}
        <KpiCard
          label="Faulted"
          value={v(data?.faulted)}
          onClick={() => { void navigate('/faults'); }}
          valueClassName="text-rose-600 dark:text-rose-400"
          className={hasFaults ? 'border-2 border-rose-400 dark:border-rose-600 shadow-sm shadow-rose-100 dark:shadow-rose-950' : undefined}
        />
      </div>
    </section>
  );
}
