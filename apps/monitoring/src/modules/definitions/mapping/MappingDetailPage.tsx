import { useState } from 'react';
import { MappingDetailCore } from '@vnext-forge-studio/designer-ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { DetailPageSkeleton } from '@monitoring/shared/components/skeletons';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'designer' | 'definition' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'designer', label: 'Designer' },
  { id: 'definition', label: 'Definition' },
  { id: 'related', label: 'Related' },
];

export function MappingDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('designer');
  const { data, isLoading } = useComponentDetail('mapping', id);

  if (isLoading) return <DetailPageSkeleton />;
  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Mapping not found</div>;

  const related = Array.isArray(data.relatedComponents) ? data.relatedComponents as RelatedComponent[] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{String(data.key ?? id)}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{String(data.domain ?? '')} · {String(data.version ?? '')}</p>
        </div>
        <VersionPicker currentVersion={String(data.version ?? '')} versions={[String(data.version ?? '')]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'designer' && <MappingDetailCore json={data} />}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'related' && <RelatedComponentsList components={related} />}
    </div>
  );
}
