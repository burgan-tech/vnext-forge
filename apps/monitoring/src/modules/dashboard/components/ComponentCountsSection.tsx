import { useNavigate } from 'react-router-dom';
import { CheckSquare, Eye, Puzzle, Workflow, Zap } from 'lucide-react';

import type { ComponentCounts } from '@monitoring/shared/types';
import { KpiCard } from './KpiCard';

interface ComponentCountsSectionProps {
  data: ComponentCounts | undefined;
  isLoading: boolean;
}

const COMPONENT_CARDS = [
  { key: 'workflows' as const, label: 'Workflows', icon: Workflow, type: 'workflow' },
  { key: 'tasks' as const, label: 'Tasks', icon: CheckSquare, type: 'task' },
  { key: 'functions' as const, label: 'Functions', icon: Zap, type: 'function' },
  { key: 'views' as const, label: 'Views', icon: Eye, type: 'view' },
  { key: 'extensions' as const, label: 'Extensions', icon: Puzzle, type: 'extension' },
];

export function ComponentCountsSection({ data, isLoading }: ComponentCountsSectionProps) {
  const navigate = useNavigate();

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Registered Components
      </h2>
      <div className="grid grid-cols-5 gap-3">
        {COMPONENT_CARDS.map(({ key, label, icon: Icon, type }) => (
          <KpiCard
            key={key}
            label={label}
            value={isLoading ? '—' : (data?.[key] ?? 0)}
            icon={<Icon className="h-4 w-4" />}
            onClick={() => navigate(`/definitions/${type}`)}
          />
        ))}
      </div>
    </section>
  );
}
