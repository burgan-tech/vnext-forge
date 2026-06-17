import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { cn } from '@monitoring/shared/lib/utils';
import { useInstanceTaskDetail } from '@monitoring/modules/instances/api/instances-queries';

type Tab = 'overview' | 'request' | 'response';

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function statusVariant(status: string): 'success' | 'destructive' | 'info' | 'warning' | 'secondary' {
  const s = status.toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'faulted' || s === 'failed') return 'destructive';
  if (s === 'running' || s === 'busy') return 'info';
  if (s === 'pending') return 'warning';
  return 'secondary';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function JsonBlock({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data) {
    return (
      <div className="rounded-md border border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="relative rounded-md border border-border bg-slate-950 dark:bg-slate-950">
      <div className="absolute right-2 top-2">
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-4 pt-8 text-xs text-slate-100 leading-relaxed">{text}</pre>
    </div>
  );
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'request', label: 'Request' },
  { key: 'response', label: 'Response' },
];

export function TaskExecutionDetailPage() {
  const { execId } = useParams<{ execId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const workflow = searchParams.get('workflow') ?? '';
  const instanceId = searchParams.get('instance') ?? '';

  const { data: task, isLoading, isError } = useInstanceTaskDetail(workflow, instanceId, execId ?? '');

  if (!workflow || !instanceId || !execId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-muted-foreground text-sm">Missing context. Required: workflow, instance, and task ID.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1 text-xs text-muted-foreground"
        onClick={() => navigate(`/task-executions?workflow=${workflow}&instance=${instanceId}`)}
      >
        <ChevronLeft size={14} />
        Back to tasks
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold font-mono">{task?.taskDefinitionKey ?? execId}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {task && (
            <Badge variant={statusVariant(task.status)} className="text-xs">{task.status}</Badge>
          )}
          <span>Workflow: <span className="font-mono text-foreground">{workflow}</span></span>
          <span>Instance: <span className="font-mono text-foreground">{instanceId}</span></span>
        </div>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-muted-foreground text-sm">Loading task detail…</div>
      )}
      {isError && (
        <div className="py-8 text-center text-destructive text-sm">Failed to load task detail.</div>
      )}

      {task && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === t.key
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Execution Info
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  {([
                    ['Task Key', task.taskDefinitionKey],
                    ['Status', <Badge variant={statusVariant(task.status)} className="text-xs">{task.status}</Badge>],
                    ['Business Status', task.businessStatus || '—'],
                    ['Started At', formatDateTime(task.startedAt)],
                    ['Finished At', formatDateTime(task.finishedAt)],
                    ['Duration', formatDurationMs(task.durationMs)],
                    ['Task ID', <span className="font-mono text-xs">{task.id}</span>],
                  ] as [string, React.ReactNode][]).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {task.triggerContext && (
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Trigger Context
                  </h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                    {[
                      ['Transition', task.triggerContext.transitionId],
                      ['From State', task.triggerContext.fromState],
                      ['To State', task.triggerContext.toState],
                      ['Trigger Type', task.triggerContext.triggerType],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 font-mono text-xs font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {task.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h2 className="mb-2 text-sm font-semibold text-destructive">Error</h2>
                  <pre className="whitespace-pre-wrap text-xs text-destructive/80">{task.error}</pre>
                </div>
              )}
            </div>
          )}

          {/* Tab: Request */}
          {activeTab === 'request' && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Request Payload</h2>
              <JsonBlock data={task.request} />
            </div>
          )}

          {/* Tab: Response */}
          {activeTab === 'response' && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Response Payload</h2>
              <JsonBlock data={task.response} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
