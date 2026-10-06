import { useEffect, useState } from 'react';

import type { ElementMetricsResponse, MetricsTask } from '../types/quickrun.types';
import { formatDurationMs } from '../utils/taskHistory';
import { StatusIcon, resolveTaskOutcome } from './panel-kit';

export type ElementMetricsKind = 'transition' | 'state';

export type ElementMetricsLoader = (
  kind: ElementMetricsKind,
  key: string,
) => Promise<{ success: true; data: ElementMetricsResponse } | { success: false; error: { message: string } }>;

/** Loads one transition's or state's metrics once, when the tab that needs it mounts. */
export function useElementMetrics(load: ElementMetricsLoader, kind: ElementMetricsKind, key: string) {
  const [state, setState] = useState<{ data: ElementMetricsResponse | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    load(kind, key)
      .then((res) => {
        if (cancelled) return;
        setState(res.success ? { data: res.data, error: null, loading: false } : { data: null, error: res.error.message, loading: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ data: null, error: err instanceof Error ? err.message : String(err), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [load, kind, key]);
  return state;
}

function MetricsTaskRow({ task }: { task: MetricsTask }) {
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <StatusIcon outcome={resolveTaskOutcome(task.status, task.businessStatus)} size={12} />
      <div className="min-w-0 flex-1">
        <span className="font-mono">{task.taskKey}</span>
        {task.error && <div className="text-[10px] text-[var(--vscode-errorForeground,#f48771)]">{task.error}</div>}
      </div>
      <span className="shrink-0 tabular-nums text-[var(--vscode-descriptionForeground)]">
        {formatDurationMs(task.durationMs) ?? ''}
      </span>
    </div>
  );
}

/** Tasks of one execution grouped by when they ran relative to the transition. */
function PhasedTasks({
  tasks,
  phases,
}: {
  tasks: readonly MetricsTask[];
  phases: Array<{ hook: string; label: string }>;
}) {
  if (tasks.length === 0) {
    return <p className="text-[var(--vscode-descriptionForeground)]">No tasks ran.</p>;
  }
  const known = new Set(phases.map((p) => p.hook));
  const buckets = [
    ...phases.map((p) => ({ label: p.label, items: tasks.filter((t) => t.hook === p.hook) })),
    { label: 'Other', items: tasks.filter((t) => !t.hook || !known.has(t.hook)) },
  ].filter((b) => b.items.length > 0);
  return (
    <div className="flex flex-col gap-1">
      {buckets.map((b) => (
        <div key={b.label}>
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">{b.label}</div>
          <div className="ml-1 border-l border-[var(--vscode-panel-border)] pl-1.5">
            {b.items.map((t) => (
              <MetricsTaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttemptCard({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] p-2">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-[10px] text-[var(--vscode-descriptionForeground)]">{meta}</span>
      </div>
      {children}
    </section>
  );
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString() : null);

/**
 * Every firing of one transition (runtime 0.0.99 transition metrics), each
 * with its tasks split into before / during / after the transition.
 */
export function TransitionExecutionsView({
  metrics,
  fromState,
  toState,
}: {
  metrics: ElementMetricsResponse;
  fromState: string;
  toState: string;
}) {
  if (metrics.attempts.length === 0) {
    return <p className="text-[var(--vscode-descriptionForeground)]">No executions recorded.</p>;
  }
  const phases = [
    { hook: 'onExit', label: `Before · on exit of ${fromState}` },
    { hook: 'onExecute', label: 'During the transition' },
    { hook: 'onEntry', label: `After · on entry of ${toState}` },
  ];
  return (
    <div className="flex flex-col gap-2">
      {metrics.attempts.map((a) => (
        <AttemptCard
          key={a.seq}
          title={metrics.attempts.length > 1 ? `Execution ${a.seq} of ${metrics.attempts.length}` : 'Execution'}
          meta={[
            a.triggerType,
            a.triggeredBy && `by ${a.triggeredBy}`,
            time(a.startedAt),
            formatDurationMs(a.durationMs),
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <PhasedTasks tasks={a.tasks} phases={phases} />
        </AttemptCard>
      ))}
    </div>
  );
}

/** Every stay in one state (runtime 0.0.99 state metrics): when, how long, and its entry / exit tasks. */
export function StateVisitsView({ metrics, stateKey }: { metrics: ElementMetricsResponse; stateKey: string }) {
  if (metrics.attempts.length === 0) {
    return <p className="text-[var(--vscode-descriptionForeground)]">No visits recorded.</p>;
  }
  const phases = [
    { hook: 'onEntry', label: `On entry of ${stateKey}` },
    { hook: 'onExit', label: `On exit of ${stateKey}` },
  ];
  return (
    <div className="flex flex-col gap-2">
      {metrics.attempts.map((a) => (
        <AttemptCard
          key={a.seq}
          title={metrics.attempts.length > 1 ? `Visit ${a.seq} of ${metrics.attempts.length}` : 'Visit'}
          meta={[
            time(a.startedAt) && `entered ${time(a.startedAt)}`,
            a.durationMs != null ? `stayed ${formatDurationMs(a.durationMs)}` : 'still here',
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <PhasedTasks tasks={a.tasks} phases={phases} />
        </AttemptCard>
      ))}
    </div>
  );
}

/** Loading / error wrapper for a lazily loaded metrics tab. */
export function MetricsTab({
  load,
  kind,
  elementKey,
  children,
}: {
  load: ElementMetricsLoader;
  kind: ElementMetricsKind;
  elementKey: string;
  children: (metrics: ElementMetricsResponse) => React.ReactNode;
}) {
  const { data, error, loading } = useElementMetrics(load, kind, elementKey);
  if (loading) return <p className="text-[var(--vscode-descriptionForeground)]">Loading…</p>;
  if (error) return <p className="text-[var(--vscode-errorForeground,#f48771)]">{error}</p>;
  return data ? <>{children(data)}</> : null;
}
