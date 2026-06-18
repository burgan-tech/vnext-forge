import { useNavigate } from 'react-router-dom';
import { useResolvedColorTheme } from '@vnext-forge-studio/designer-ui/hooks';
import { VNEXT_FOLDER_PALETTE } from '@vnext-forge-studio/designer-ui/component-icons';
import type { ComponentCounts } from '@monitoring/shared/types';
import { ComponentBadgeIcon } from '@monitoring/shared/components/ComponentBadgeIcon';
import { KpiCard } from './KpiCard';

type FolderKey = keyof typeof VNEXT_FOLDER_PALETTE;

const TYPE_TO_FOLDER: Record<string, FolderKey> = {
  workflow: 'workflows',
  task: 'tasks',
  function: 'functions',
  view: 'views',
  extension: 'extensions',
  schema: 'schemas',
  mapping: 'mappings',
};

interface ComponentCountsSectionProps {
  data: ComponentCounts | undefined;
  isLoading: boolean;
}

const COMPONENT_CARDS = [
  { key: 'flows' as const, label: 'Workflows', type: 'workflow' },
  { key: 'tasks' as const, label: 'Tasks', type: 'task' },
  { key: 'functions' as const, label: 'Functions', type: 'function' },
  { key: 'views' as const, label: 'Views', type: 'view' },
  { key: 'extensions' as const, label: 'Extensions', type: 'extension' },
  { key: 'schemas' as const, label: 'Schemas', type: 'schema' },
  { key: 'mappings' as const, label: 'Mappings', type: 'mapping' },
];

export function ComponentCountsSection({ data, isLoading }: ComponentCountsSectionProps) {
  const navigate = useNavigate();
  const theme = useResolvedColorTheme();
  const themeKey = theme === 'dark' ? 'dark' : 'light';

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Registered Components
      </h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {COMPONENT_CARDS.map(({ key, label, type }) => {
          const folderKey = TYPE_TO_FOLDER[type];
          const borderColor = VNEXT_FOLDER_PALETTE[folderKey][themeKey].fill;
          return (
            <KpiCard
              key={key}
              label={label}
              value={isLoading ? '—' : (data?.[key] ?? 0)}
              icon={<ComponentBadgeIcon type={type} className="h-7 w-7" />}
              onClick={() => { void navigate(`/definitions/${type}`); }}
              style={{ borderColor }}
            />
          );
        })}
      </div>
    </section>
  );
}
