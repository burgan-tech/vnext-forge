import { useState } from 'react';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { Copy, Check } from 'lucide-react';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'script' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'script', label: 'Script' },
  { id: 'related', label: 'Related' },
];

export function MappingDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useComponentDetail('mapping', id);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading mapping…</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Mapping not found</div>;

  const related = Array.isArray(data.relatedComponents) ? data.relatedComponents as RelatedComponent[] : [];
  const scriptContent = data.script ? String(data.script) : '// No script available';

  const comment = data._comment ? String(data._comment) : null;
  const key = String(data.key ?? '—');
  const flow = String(data.flow ?? '—');
  const flowVersion = String(data.flowVersion ?? '—');
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];

  function handleCopy() {
    navigator.clipboard.writeText(scriptContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {comment && <p className="text-sm text-muted-foreground">{comment}</p>}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <span className="text-muted-foreground">Key</span>
            <span className="font-mono text-foreground">{key}</span>
            <span className="text-muted-foreground">Flow</span>
            <span className="font-mono text-foreground">{flow}</span>
            <span className="text-muted-foreground">Flow Version</span>
            <span className="font-mono text-foreground">{flowVersion}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'script' && (
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="absolute right-2 top-2 h-7 w-7 z-10"
            aria-label="Copy script"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <pre className="max-h-[600px] overflow-auto rounded-lg border border-border bg-slate-950 p-4 text-xs leading-relaxed font-mono text-slate-100">
            {scriptContent}
          </pre>
        </div>
      )}

      {activeTab === 'related' && <RelatedComponentsList components={related} />}
    </div>
  );
}
