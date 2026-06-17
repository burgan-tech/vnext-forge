import { useSearchParams, useNavigate } from 'react-router-dom';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { useInstanceTasks } from '@monitoring/modules/instances/api/instances-queries';

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function statusVariant(status: string): 'success' | 'destructive' | 'info' | 'warning' | 'secondary' {
  const s = status.toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'faulted' || s === 'failed') return 'destructive';
  if (s === 'running' || s === 'busy') return 'info';
  if (s === 'pending') return 'warning';
  return 'secondary';
}

export function TaskExecutionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const workflow = searchParams.get('workflow') ?? '';
  const instanceId = searchParams.get('instance') ?? '';

  const { data, isLoading, isError } = useInstanceTasks(workflow, instanceId);
  const items = data?.items ?? [];

  if (!workflow || !instanceId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-muted-foreground text-sm">
          No instance context. Navigate here from an Instance Detail page.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Required query params: <code>?workflow=&lt;key&gt;&amp;instance=&lt;id&gt;</code>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Task Executions</h1>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Workflow: <span className="font-mono text-foreground">{workflow}</span></span>
          <span>Instance: <span className="font-mono text-foreground">{instanceId}</span></span>
          {!isLoading && <span>{items.length} task{items.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {['Task Key', 'Status', 'Business Status', 'Started At', 'Duration'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-destructive">Failed to load tasks.</td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No tasks found for this instance.</td>
              </tr>
            )}
            {!isLoading && !isError && items.map((task) => (
              <tr
                key={task.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() =>
                  navigate(`/task-executions/${task.id}?workflow=${workflow}&instance=${instanceId}`)
                }
              >
                <td className="px-4 py-3">
                  <span className={cn(
                    'font-mono text-xs text-blue-600 dark:text-blue-400',
                  )}>
                    {task.taskDefinitionKey}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(task.status)} className="text-xs">
                    {task.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{task.businessStatus || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(task.startedAt)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {task.durationMs != null ? formatDurationMs(task.durationMs) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
