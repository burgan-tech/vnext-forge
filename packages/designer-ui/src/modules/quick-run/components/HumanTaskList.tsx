import type { HumanTaskItem } from '../types/quickrun.types';
import { humanTaskLabel, humanTaskOpenAction } from '../utils/humanTasks';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

export interface HumanTaskListProps {
  rows: readonly HumanTaskItem[];
  truncated: boolean;
  loading: boolean;
  error: RuntimeErrorLike | null;
  currentWorkflowKey: string;
  /** The host can open another workflow's Quick Runner. */
  canOpenOtherWorkflows: boolean;
  onOpen: (row: HumanTaskItem) => void;
}

export function HumanTaskList({
  rows,
  truncated,
  loading,
  error,
  currentWorkflowKey,
  canOpenOtherWorkflows,
  onOpen,
}: HumanTaskListProps) {
  return (
    <div className="flex flex-col">
      {error && <RuntimeErrorBanner title="Human-task request failed" error={error} />}
      {truncated && (
        <p role="status" className="mx-2 mt-2 rounded border border-warning-border bg-warning-surface px-2 py-1 text-[10px] text-warning-text">
          The runtime truncated this list. Refresh with the cache bypassed or narrow the role to see the rest.
        </p>
      )}
      {loading && rows.length === 0 && (
        <p className="py-4 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="py-6 text-center text-xs text-[var(--vscode-descriptionForeground)]">No human tasks for this role</p>
      )}
      <ul className="px-1 py-2">
        {rows.map((row) => {
          const other = humanTaskOpenAction(row, currentWorkflowKey) === 'openWorkflow';
          const blocked = other && !canOpenOtherWorkflows;
          return (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                onClick={() => onOpen(row)}
                disabled={blocked}
                title={
                  blocked
                    ? "Open this workflow's Quick Runner to act on this task"
                    : other
                      ? `Open the ${row.workflow} Quick Runner`
                      : 'Open the root instance'
                }
              >
                <span className="truncate font-medium">{humanTaskLabel(row)}</span>
                {row.description && (
                  <span className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">{row.description}</span>
                )}
                <span className="flex items-center gap-1 text-[9px] text-[var(--vscode-descriptionForeground)]">
                  {row.workflow && (
                    <span className="rounded bg-[var(--vscode-badge-background)] px-1 text-[var(--vscode-badge-foreground)]">
                      {row.workflow}
                    </span>
                  )}
                  <span className="truncate font-mono">{row.instanceId ?? row.id}</span>
                  <span className="ml-auto opacity-70">
                    {Number.isNaN(Date.parse(row.createdAt)) ? row.createdAt : new Date(row.createdAt).toLocaleString()}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
