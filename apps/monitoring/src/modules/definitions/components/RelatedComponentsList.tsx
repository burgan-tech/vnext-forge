import { useNavigate } from 'react-router-dom';
import type { RelatedComponent } from '@monitoring/shared/types';
import { ComponentBadgeIcon } from '@monitoring/shared/components/ComponentBadgeIcon';

const COMP_ROUTE: Record<string, string> = {
  SubFlow: 'workflow',
  Task: 'task',
  Function: 'function',
  Extension: 'extension',
  View: 'view',
  Schema: 'schema',
  Mapping: 'mapping',
};

const COMP_TYPE_MAPPING: Record<string, string> = {
  SubFlow: 'workflow',
  Task: 'task',
  Function: 'function',
  Extension: 'extension',
  View: 'view',
  Schema: 'schema',
  Mapping: 'mapping',
};

interface RelatedComponentsListProps {
  components: RelatedComponent[];
}

export function RelatedComponentsList({ components }: RelatedComponentsListProps) {
  const navigate = useNavigate();

  if (!components.length) {
    return <p className="text-sm text-muted-foreground">No related components.</p>;
  }

  const grouped = components.reduce<Record<string, RelatedComponent[]>>((acc, c) => {
    (acc[c.compType] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(grouped).map(([compType, items]) => {
        const iconType = COMP_TYPE_MAPPING[compType];
        return (
          <div key={compType}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {compType}s
            </h3>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/definitions/${COMP_ROUTE[compType] ?? 'workflow'}/${item.id}`)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                >
                  <ComponentBadgeIcon type={iconType} className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{item.id}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
