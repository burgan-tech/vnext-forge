import { useMemo, useState } from 'react';

import type { HistoryTransition, TaskHistoryItem } from '../types/quickrun.types';
import { formatDurationMs } from '../utils/taskHistory';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import {
  MetricsTab,
  StateVisitsView,
  TransitionExecutionsView,
  type ElementMetricsLoader,
} from './ElementMetrics';
import { DetailsDialog, DetailsList, FilterChip, PanelRow, PanelSummary, StatusIcon, describeTaskPhase, resolveTaskOutcome, type DetailsTab } from './panel-kit';

type Order = 'newest' | 'oldest';

const TRIGGER_DOT: Record<string, string> = {
  manual: 'var(--vscode-charts-blue,#3794ff)',
  automatic: 'var(--vscode-descriptionForeground)',
  auto: 'var(--vscode-descriptionForeground)',
  scheduled: 'var(--vscode-charts-orange,#d18616)',
  timer: 'var(--vscode-charts-orange,#d18616)',
  event: 'var(--vscode-charts-purple,#b180d7)',
  signal: 'var(--vscode-charts-purple,#b180d7)',
  error: 'var(--vscode-errorForeground,#f48771)',
  subflow: 'var(--vscode-charts-green,#89d185)',
};

function triggerDot(triggerType: string): string {
  return TRIGGER_DOT[triggerType.trim().toLowerCase()] ?? 'var(--vscode-descriptionForeground)';
}

function durationText(t: HistoryTransition): string | null {
  return t.durationSeconds != null ? formatDurationMs(t.durationSeconds * 1000) : null;
}

export interface HistoryTabContentProps {
  history: { transitions: HistoryTransition[] } | null;
  loading: boolean;
  /** Runtime 0.0.99 transition / state metrics; omitted on older runtimes. */
  loadMetrics?: ElementMetricsLoader;
  /** Task journal of the instance — the dialog's Tasks tab when metrics are unavailable. */
  tasks?: readonly TaskHistoryItem[] | null;
  /** Display label of a transition; the key when omitted. */
  transitionLabel?: (transitionKey: string, fromState: string) => string;
}

/**
 * The instance's transitions as a timeline: one row each (label, from → to,
 * time, duration, a dot for the trigger), newest first by default. Executions,
 * time spent in the target state, tasks and the request open in a dialog.
 */
export function HistoryTabContent({ history, loading, loadMetrics, tasks, transitionLabel }: HistoryTabContentProps) {
  const [order, setOrder] = useState<Order>('newest');
  const [selected, setSelected] = useState<HistoryTransition | null>(null);

  const rows = useMemo(() => {
    const list = history?.transitions ?? [];
    const counts = new Map<string, number>();
    const withRun = list.map((t) => {
      const n = (counts.get(t.transitionId) ?? 0) + 1;
      counts.set(t.transitionId, n);
      return { t, run: n };
    });
    return withRun.map((r) => ({ ...r, runs: counts.get(r.t.transitionId) ?? 1 }));
  }, [history]);

  if (loading) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">No transition history yet</p>;
  }

  const ordered = order === 'newest' ? [...rows].reverse() : rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <PanelSummary>
        <span className="flex items-center gap-2">
          <span>
            {rows.length} {rows.length === 1 ? 'transition' : 'transitions'}
          </span>
          <span className="ml-auto flex gap-1">
            <FilterChip selected={order === 'newest'} onClick={() => setOrder('newest')}>
              Newest first
            </FilterChip>
            <FilterChip selected={order === 'oldest'} onClick={() => setOrder('oldest')}>
              Oldest first
            </FilterChip>
          </span>
        </span>
      </PanelSummary>

      <ol className="ml-2 flex min-h-0 flex-1 flex-col overflow-y-auto border-l border-[var(--vscode-panel-border)]">
        {ordered.map(({ t, run, runs }) => {
          const label = transitionLabel?.(t.transitionId, t.fromState) ?? t.transitionId;
          const trigger = t.triggerType.trim().toLowerCase();
          return (
            <li key={t.id} className="-ml-[5px]">
              <PanelRow
                leading={<span className="mt-[3px] h-2 w-2 rounded-full" style={{ background: triggerDot(t.triggerType) }} />}
                title={
                  <span title={t.transitionId}>
                    {label}
                    {trigger !== 'manual' && (
                      <span className="ml-1.5 rounded bg-[var(--vscode-badge-background)] px-1 text-[9px] text-[var(--vscode-badge-foreground)]">
                        {trigger}
                      </span>
                    )}
                    {runs > 1 && (
                      <span className="ml-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]">
                        run {run} of {runs}
                      </span>
                    )}
                  </span>
                }
                subtitle={`${t.fromState} → ${t.toState}`}
                trailing={
                  <>
                    <div>{new Date(t.startedAt).toLocaleTimeString()}</div>
                    <div>{durationText(t) ?? ''}</div>
                  </>
                }
                onActivate={() => setSelected(t)}
                ariaLabel={`${label}, ${t.fromState} to ${t.toState}. Show details`}
              />
            </li>
          );
        })}
      </ol>

      {selected && (
        <DetailsDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={transitionLabel?.(selected.transitionId, selected.fromState) ?? selected.transitionId}
          description={`${selected.fromState} → ${selected.toState}`}
          tabs={transitionDetailTabs(selected, { loadMetrics, tasks })}
        />
      )}
    </div>
  );
}

/** Dialog tabs for one history row (exported for the SSR tests). */
export function transitionDetailTabs(
  t: HistoryTransition,
  { loadMetrics, tasks }: { loadMetrics?: ElementMetricsLoader; tasks?: readonly TaskHistoryItem[] | null },
): DetailsTab[] {
  const tabs: DetailsTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      render: () => (
        <DetailsList
          rows={[
            { label: 'Transition', value: t.transitionId, mono: true },
            { label: 'From → to', value: `${t.fromState} → ${t.toState}` },
            { label: 'Trigger', value: t.triggerType },
            { label: 'Started', value: new Date(t.startedAt).toLocaleString() },
            !!t.finishedAt && { label: 'Finished', value: new Date(t.finishedAt).toLocaleString() },
            { label: 'Duration', value: durationText(t) ?? 'running' },
            !!t.createdBy && { label: 'By', value: t.createdBy },
            !!t.createdByBehalfOf && { label: 'On behalf of', value: t.createdByBehalfOf },
            { label: 'Record id', value: t.id, copy: t.id, mono: true },
          ]}
        />
      ),
    },
  ];

  if (loadMetrics) {
    tabs.push({
      id: 'executions',
      label: 'Executions',
      render: () => (
        <MetricsTab load={loadMetrics} kind="transition" elementKey={t.transitionId}>
          {(m) => <TransitionExecutionsView metrics={m} fromState={t.fromState} toState={t.toState} />}
        </MetricsTab>
      ),
    });
    tabs.push({
      id: 'state',
      label: `Time in ${t.toState}`,
      render: () => (
        <MetricsTab load={loadMetrics} kind="state" elementKey={t.toState}>
          {(m) => <StateVisitsView metrics={m} stateKey={t.toState} />}
        </MetricsTab>
      ),
    });
  } else {
    const own = (tasks ?? []).filter(
      (task) => task.transitionKey === t.transitionId && task.fromState === t.fromState && (task.toState ?? t.toState) === t.toState,
    );
    if (own.length > 0) {
      tabs.push({
        id: 'tasks',
        label: `Tasks (${own.length})`,
        render: () => (
          <div className="flex flex-col">
            {own.map((task) => (
              <PanelRow
                key={task.id}
                leading={<StatusIcon outcome={resolveTaskOutcome(task.status, task.businessStatus)} size={12} />}
                title={<span className="font-mono">{task.taskKey}</span>}
                subtitle={describeTaskPhase(task.hook, task.fromState, task.toState) ?? undefined}
                trailing={formatDurationMs(task.durationMs) ?? ''}
              />
            ))}
          </div>
        ),
      });
    }
  }

  const hasBody = !!t.body && Object.keys(t.body).length > 0;
  const hasHeader = !!t.header && Object.keys(t.header).length > 0;
  if (hasBody || hasHeader) {
    tabs.push({
      id: 'request',
      label: 'Request',
      render: () => (
        <div className="flex flex-col gap-2">
          {hasBody && (
            <div className="flex flex-col gap-1">
              <span className="text-[var(--vscode-descriptionForeground)]">Body</span>
              <CopyableJsonBlock value={t.body} />
            </div>
          )}
          {hasHeader && (
            <div className="flex flex-col gap-1">
              <span className="text-[var(--vscode-descriptionForeground)]">Headers</span>
              <CopyableJsonBlock value={t.header} />
            </div>
          )}
        </div>
      ),
    });
  }
  return tabs;
}
