import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs, groupTasksByTransition, taskStatusTone, type TaskTone } from '../utils/taskHistory';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

const TONE_CLASS: Record<TaskTone, string> = {
  success: 'border-success-border bg-success text-success-foreground',
  danger: 'border-destructive-border bg-destructive-muted text-destructive-text',
  busy: 'border-warning-border bg-warning text-warning-foreground',
  neutral: 'border-border bg-muted text-muted-text',
};

function StatusChip({ value, label }: { value: string; label: string }) {
  return (
    <span className={`rounded border px-1 py-0.5 text-[9px] font-medium ${TONE_CLASS[taskStatusTone(value)]}`} title={label}>
      {value}
    </span>
  );
}

/**
 * The instance's task journal (`…/functions/tasks`), grouped per transition.
 * Props-only so the SSR test harness can assert it.
 */
export function TasksTabContent({
  items,
  loading,
  error,
}: {
  items: readonly TaskHistoryItem[] | null;
  loading: boolean;
  error: RuntimeErrorLike | null;
}) {
  if (error) return <RuntimeErrorBanner title="Task history request failed" error={error} />;
  if (loading && !items) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  }
  if (!items || items.length === 0) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">No tasks ran on this instance yet</p>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {groupTasksByTransition(items).map((group) => (
        <section key={group.key} className="flex flex-col gap-1">
          <header className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
            <span className="font-semibold text-[var(--vscode-foreground)]">{group.transitionKey}</span>
            <span>
              {group.fromState} → {group.toState ?? 'in progress'}
            </span>
          </header>
          <ol className="flex flex-col gap-1 border-l border-[var(--vscode-panel-border)] pl-2">
            {group.items.map((task) => {
              const duration = formatDurationMs(task.durationMs);
              return (
                <li key={task.id} className="flex flex-col gap-0.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1">
                    {task.order != null && (
                      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]" title="Order — equal order runs in parallel">
                        #{task.order}
                      </span>
                    )}
                    <span className="font-mono">{task.taskKey}</span>
                    {task.hook && (
                      <span className="rounded border border-[var(--vscode-panel-border)] px-1 text-[9px]" title="Hook">
                        {task.hook}
                      </span>
                    )}
                    <StatusChip value={task.status} label="Platform status" />
                    <StatusChip value={task.businessStatus} label="Business status" />
                    {duration && <span className="ml-auto text-[10px] text-[var(--vscode-descriptionForeground)]">{duration}</span>}
                  </div>
                  {task.error && (
                    <details className="text-[10px]">
                      <summary className="cursor-pointer text-[var(--vscode-errorForeground)]">Error</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[var(--vscode-foreground)]">{task.error}</pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
