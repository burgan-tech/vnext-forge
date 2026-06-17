import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'test' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'test', label: 'Test' },
  { id: 'related', label: 'Related' },
];

export function SchemaDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const { data, isLoading } = useComponentDetail('schema', id);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading schema…</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Schema not found</div>;

  const related = Array.isArray(data.relatedComponents) ? data.relatedComponents as RelatedComponent[] : [];

  function handleValidate() {
    try {
      JSON.parse(testInput);
      setTestResult({ valid: true, message: '✓ Valid JSON' });
    } catch (e) {
      setTestResult({ valid: false, message: `✗ Invalid JSON: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{String(data.name ?? id)}</h1>
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
          <p className="text-sm text-foreground">{String(data.description ?? 'No description.')}</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-xs">{String(data.version ?? '—')}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'test' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Enter JSON data to validate against this schema.</p>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="h-48 w-full rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            placeholder='{ "key": "value" }'
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleValidate} size="sm">Validate</Button>
            {testResult && (
              <span className={cn('text-sm font-medium', testResult.valid ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'related' && <RelatedComponentsList components={related} />}
    </div>
  );
}
