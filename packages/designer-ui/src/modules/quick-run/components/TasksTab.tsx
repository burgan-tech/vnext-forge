import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs, groupTasksByTransition, type TaskGroup } from '../utils/taskHistory';
import {
  DetailsDialog,
  DetailsList,
  PanelRow,
  PanelSummary,
  StatusIcon,
  TASK_OUTCOME_TEXT,
  describeTaskPhase,
  resolveTaskOutcome,
  type TaskOutcome,
} from './panel-kit';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

type TaskFilter = 'all' | 'problems';

/** A run of tasks that share one `order` value: parallel when more than one. */
interface OrderSegment {
  order: number | null;
  items: TaskHistoryItem[];
}

/** Splits a group into order segments, keeping first-seen order. */
export function segmentByOrder(items: readonly TaskHistoryItem[]): OrderSegment[] {
  const segments: OrderSegment[] = [];
  for (const item of items) {
    const order = item.order ?? null;
    const existing = order !== null ? segments.find((s) => s.order === order) : undefined;
    if (existing) existing.items.push(item);
    else segments.push({ order, items: [item] });
  }
  return segments;
}

const isProblem = (outcome: TaskOutcome) => outcome === 'failed' || outcome === 'warning';

function totalDuration(items: readonly TaskHistoryItem[]): number {
  return items.reduce((sum, t) => sum + (typeof t.durationMs === 'number' ? t.durationMs : 0), 0);
}

/**
 * The instance's task journal (`…/functions/tasks`), one step per transition.
 * Each task is one row — status icon, task key, the state it ran for and its
 * duration — with the details behind a click. Props-only so the SSR test
 * harness can assert it.
 */
export function TasksTabContent({
  items,
  loading,
  error,
  transitionLabel,
}: {
  items: readonly TaskHistoryItem[] | null;
  loading: boolean;
  error: RuntimeErrorLike | null;
  /** Display label of a transition (runtime / local definition); the key when omitted. */
  transitionLabel?: (transitionKey: string, fromState: string) => string;
}) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<TaskHistoryItem | null>(null);

  const groups = useMemo(() => groupTasksByTransition(items ?? []), [items]);
  const problems = useMemo(
    () => (items ?? []).filter((t) => isProblem(resolveTaskOutcome(t.status, t.businessStatus))).length,
    [items],
  );

  if (error) return <RuntimeErrorBanner title="Task history request failed" error={error} />;
  if (loading && !items) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  }
  if (!items || items.length === 0) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">No tasks ran on this instance yet</p>;
  }

  const visibleGroups: TaskGroup[] =
    filter === 'problems'
      ? groups
          .map((g) => ({ ...g, items: g.items.filter((t) => isProblem(resolveTaskOutcome(t.status, t.businessStatus))) }))
          .filter((g) => g.items.length > 0)
      : groups;
  const total = formatDurationMs(totalDuration(items));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <PanelSummary
        filters={problems > 0 ? [{ value: 'all', label: 'All' }, { value: 'problems', label: `Failed (${problems})` }] : undefined}
        value={filter}
        onChange={setFilter}
      >
        {items.length} {items.length === 1 ? 'task' : 'tasks'}
        {problems > 0 && <span className="text-[var(--vscode-errorForeground)]"> · {problems} failed</span>}
        {total && <span> · {total}</span>}
      </PanelSummary>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visibleGroups.map((group) => {
          const groupProblems = group.items.some((t) => isProblem(resolveTaskOutcome(t.status, t.businessStatus)));
          const isCollapsed = collapsed[group.key] ?? false;
          const label = transitionLabel?.(group.transitionKey, group.fromState) ?? group.transitionKey;
          return (
            <section key={group.key} className="flex flex-col">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
                className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-[var(--vscode-list-hoverBackground)]"
                title={`Transition ${group.transitionKey}`}
              >
                {isCollapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                <span className="truncate font-medium">{label}</span>
                <span className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">
                  {group.fromState} → {group.toState ?? 'in progress'}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-[var(--vscode-descriptionForeground)]">
                  {groupProblems && <StatusIcon outcome="failed" size={11} title="Has failed tasks" />}
                  {!groupProblems && group.items.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="ml-2 flex flex-col border-l border-[var(--vscode-panel-border)] pl-1.5">
                  {segmentByOrder(group.items).map((segment, i) =>
                    segment.items.length > 1 ? (
                      <div key={`p${i}`} className="my-0.5 flex flex-col">
                        <span className="px-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
                          Parallel · {segment.items.length} tasks
                        </span>
                        <div className="ml-1 border-l-2 border-[var(--vscode-panel-border)] pl-0.5">
                          {segment.items.map((task) => (
                            <TaskRow key={task.id} task={task} onOpen={setSelected} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <TaskRow key={segment.items[0].id} task={segment.items[0]} onOpen={setSelected} />
                    ),
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <TaskDetailsDialog task={selected} onClose={() => setSelected(null)} transitionLabel={transitionLabel} />
      )}
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: TaskHistoryItem; onOpen: (task: TaskHistoryItem) => void }) {
  const outcome = resolveTaskOutcome(task.status, task.businessStatus);
  const phase = describeTaskPhase(task.hook, task.fromState, task.toState);
  return (
    <PanelRow
      leading={<StatusIcon outcome={outcome} />}
      title={<span className="font-mono">{task.taskKey}</span>}
      subtitle={phase ?? undefined}
      trailing={formatDurationMs(task.durationMs) ?? ''}
      onActivate={() => onOpen(task)}
      ariaLabel={`${task.taskKey}: ${TASK_OUTCOME_TEXT[outcome]}. Show details`}
    >
      {task.error && (
        <div className="truncate text-[10px] text-[var(--vscode-errorForeground)]" title={task.error}>
          {task.error.split('\n')[0]}
        </div>
      )}
    </PanelRow>
  );
}

/** Body of the task details dialog (exported for the SSR tests). */
export function TaskDetailsList({
  task,
  transitionLabel,
}: {
  task: TaskHistoryItem;
  transitionLabel?: (transitionKey: string, fromState: string) => string;
}) {
  const outcome = resolveTaskOutcome(task.status, task.businessStatus);
  const label = transitionLabel?.(task.transitionKey, task.fromState);
  return (
    <DetailsList
      rows={[
        { label: 'Outcome', value: TASK_OUTCOME_TEXT[outcome] },
        { label: 'Platform status', value: task.status },
        { label: 'Business status', value: task.businessStatus },
        { label: 'Ran', value: describeTaskPhase(task.hook, task.fromState, task.toState) ?? 'unknown phase' },
        task.order != null && { label: 'Order', value: String(task.order) },
        {
          label: 'Transition',
          value: label && label !== task.transitionKey ? `${label} (${task.transitionKey})` : task.transitionKey,
        },
        { label: 'From → to', value: `${task.fromState} → ${task.toState ?? 'in progress'}` },
        { label: 'Trigger', value: task.triggerType },
        { label: 'Started', value: new Date(task.startedAt).toLocaleString() },
        !!task.finishedAt && { label: 'Finished', value: new Date(task.finishedAt).toLocaleString() },
        { label: 'Duration', value: formatDurationMs(task.durationMs) ?? 'still running' },
        { label: 'Task run id', value: task.id, copy: task.id, mono: true },
      ]}
    />
  );
}

function TaskDetailsDialog({
  task,
  onClose,
  transitionLabel,
}: {
  task: TaskHistoryItem;
  onClose: () => void;
  transitionLabel?: (transitionKey: string, fromState: string) => string;
}) {
  const outcome = resolveTaskOutcome(task.status, task.businessStatus);
  return (
    <DetailsDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <StatusIcon outcome={outcome} />
          <span className="font-mono">{task.taskKey}</span>
        </span>
      }
      description={TASK_OUTCOME_TEXT[outcome]}
      tabs={[
        { id: 'overview', label: 'Overview', render: () => <TaskDetailsList task={task} transitionLabel={transitionLabel} /> },
        ...(task.error
          ? [
              {
                id: 'error',
                label: 'Error',
                render: () => (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[10px] text-[var(--vscode-errorForeground)]">
                    {task.error}
                  </pre>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
