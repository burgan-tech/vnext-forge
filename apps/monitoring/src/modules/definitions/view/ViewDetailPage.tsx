import { useState } from 'react';
import { ViewDetailCore } from '@vnext-forge-studio/designer-ui';
import { PseudoUiViewSurface } from '@vnext-forge-studio/designer-ui/quickrun';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { DetailPageSkeleton } from '@monitoring/shared/components/skeletons';
import { cn } from '@monitoring/shared/lib/utils';
import { buildViewResponse } from './buildViewResponse';

type Tab = 'designer' | 'definition';

const TABS: { id: Tab; label: string }[] = [
  { id: 'designer', label: 'Designer' },
  { id: 'definition', label: 'Definition' },
];

export function ViewDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('designer');
  const { data, isLoading } = useComponentDetail('view', id);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Not found
      </div>
    );
  }

  /**
   * The pseudo-ui renderer is injected into the shared read-only core, which
   * must not import quick-run itself. `content` comes from the core (it parses
   * the definition), the rest of the `ViewResponse` from the raw document.
   */
  const renderPseudoUiPreview = (content: Record<string, unknown>) => {
    const viewResponse = { ...buildViewResponse(data), content };
    return (
      <PseudoUiViewSurface
        viewResponse={viewResponse}
        mode="preview"
        ariaLabel={`View preview: ${viewResponse.key}`}
        fillHeight={false}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {String(data.key ?? id)}
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

      {activeTab === 'designer' && (
        <ViewDetailCore json={data} renderPseudoUiPreview={renderPseudoUiPreview} />
      )}
      {activeTab === 'definition' && <RawJsonViewer data={data} />}
    </div>
  );
}
