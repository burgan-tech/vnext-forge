import { MetricsTab, StateVisitsView, type ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import { PanelRow, StatusIcon, describeTaskPhase, resolveTaskOutcome } from '../../quick-run/components/panel-kit';
import type { TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { formatDurationMs } from '../../quick-run/utils/taskHistory';

/** Tasks that belong to a state: its entry tasks (arriving) and exit tasks (leaving). */
export function tasksForState(tasks: readonly TaskHistoryItem[], stateKey: string): TaskHistoryItem[] {
  return tasks.filter((t) =>
    t.hook === 'onExit' ? t.fromState === stateKey : t.hook === 'onEntry' ? t.toState === stateKey : t.toState === stateKey,
  );
}

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Execution of one state: per-visit metrics on runtime ≥ 0.0.99, else the task journal rows. */
export function StateExecution({ stateKey, tasks, loadMetrics }: { stateKey: string; tasks: readonly TaskHistoryItem[]; loadMetrics?: ElementMetricsLoader }) {
  return (
    <section className="flex flex-col gap-1 border-t border-[var(--vscode-panel-border,#3c3c3c)] p-3 text-[11px]">
      <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Execution</h3>
      {loadMetrics ? (
        <MetricsTab load={loadMetrics} kind="state" elementKey={stateKey}>
          {(m) => <StateVisitsView metrics={m} stateKey={stateKey} />}
        </MetricsTab>
      ) : (
        <TaskRows tasks={tasksForState(tasks, stateKey)} empty="No tasks ran in this state." />
      )}
    </section>
  );
}

export function TaskRows({ tasks, empty }: { tasks: readonly TaskHistoryItem[]; empty: string }) {
  if (tasks.length === 0) return <p className={muted}>{empty}</p>;
  return (
    <div className="flex flex-col">
      {tasks.map((t) => (
        <PanelRow
          key={t.id}
          leading={<StatusIcon outcome={resolveTaskOutcome(t.status, t.businessStatus)} size={12} />}
          title={<span className="font-mono">{t.taskKey}</span>}
          subtitle={describeTaskPhase(t.hook, t.fromState, t.toState) ?? undefined}
          trailing={formatDurationMs(t.durationMs) ?? ''}
        >
          {t.error && <div className="truncate text-[10px] text-[var(--vscode-errorForeground,#f48771)]" title={t.error}>{t.error.split('\n')[0]}</div>}
        </PanelRow>
      ))}
    </div>
  );
}
