import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { useNavigate } from 'react-router-dom';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { cn } from '@monitoring/shared/lib/utils';

type Tab = 'overview' | 'definition' | 'executions';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'executions', label: 'Executions' },
];

interface OverviewContentProps {
  data: Record<string, unknown>;
}

function OverviewContent({ data }: OverviewContentProps) {
  const returnType = String(data.returnType ?? '—');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <span className="text-muted-foreground">Return Type</span>
        <span className="font-mono text-foreground">{returnType}</span>
        <span className="text-muted-foreground">Parameters</span>
        <span className="text-foreground">see definition</span>
      </div>
    </div>
  );
}

interface ExecutionsContentProps {
  navigate: ReturnType<typeof useNavigate>;
}

function ExecutionsContent({ navigate }: ExecutionsContentProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-sm text-muted-foreground">
      <p>Function execution history is available at Function Executions.</p>
      <Button variant="outline" onClick={() => navigate('/function-executions')}>
        Go to Function Executions
      </Button>
    </div>
  );
}

export function FunctionDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('function', id);
  const navigate = useNavigate();

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
      {activeTab === 'executions' && <ExecutionsContent navigate={navigate} />}
    </div>
  );
}
