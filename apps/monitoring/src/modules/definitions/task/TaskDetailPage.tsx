import { useState } from 'react';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { cn } from '@monitoring/shared/lib/utils';

type Tab = 'overview' | 'definition';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
];

interface OverviewContentProps {
  data: Record<string, unknown>;
}

function OverviewContent({ data }: OverviewContentProps) {
  const taskType = String(data.taskType ?? 'Unknown');
  const isDeprecated = data.deprecated === true;
  const description = String(data.description ?? 'No description.');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{taskType}</Badge>
        {isDeprecated && <Badge variant="destructive">Deprecated</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function TaskDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('task', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {String(data.name ?? id)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {String(data.domain ?? '')} · {String(data.version ?? '')}
          </p>
        </div>
        <VersionPicker
          currentVersion={String(data.version ?? '')}
          versions={[String(data.version ?? '')]}
        />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && <OverviewContent data={data} />}
      {activeTab === 'definition' && <RawJsonViewer data={data} />}
    </div>
  );
}
