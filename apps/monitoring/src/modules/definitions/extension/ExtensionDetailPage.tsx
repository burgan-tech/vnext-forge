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

const SCOPE_LABELS: Record<string, string> = {
  D: 'Domain',
  F: 'Flow',
  I: 'Instance',
};

interface OverviewContentProps {
  data: Record<string, unknown>;
}

function OverviewContent({ data }: OverviewContentProps) {
  const type = data.type != null ? String(data.type) : null;
  const scope = data.scope ? String(data.scope) : null;
  const scopeLabel = scope ? (SCOPE_LABELS[scope] ?? scope) : null;
  const comment = data._comment ? String(data._comment) : null;
  const key = String(data.key ?? '—');
  const flow = String(data.flow ?? '—');
  const flowVersion = String(data.flowVersion ?? '—');
  type LabelItem = { label: string; language?: string } | string;
  const rawLabels = Array.isArray(data.labels) ? (data.labels as LabelItem[]) : [];
  const labels = rawLabels.map((l) => (typeof l === 'string' ? l : l.label));
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];

  return (
    <div className="flex flex-col gap-4">
      {(type || scopeLabel) && (
        <div className="flex items-center gap-2 flex-wrap">
          {type && <Badge variant="secondary">{type}</Badge>}
          {scopeLabel && <Badge variant="outline">{scopeLabel}</Badge>}
        </div>
      )}
      {comment && <p className="text-sm text-muted-foreground">{comment}</p>}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <span className="text-muted-foreground">Key</span>
        <span className="font-mono text-foreground">{key}</span>
        <span className="text-muted-foreground">Flow</span>
        <span className="font-mono text-foreground">{flow}</span>
        <span className="text-muted-foreground">Flow Version</span>
        <span className="font-mono text-foreground">{flowVersion}</span>
      </div>
      {labels.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Labels</span>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExtensionDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('extension', id);

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

      {activeTab === 'overview' && <OverviewContent data={data} />}
      {activeTab === 'definition' && <RawJsonViewer data={data} />}
    </div>
  );
}
