import { useEffect, useMemo, useRef } from 'react';
import { Database } from 'lucide-react';

import { formatDurationMs } from '../../quick-run/utils/taskHistory';
import { railSummary, type PathRailStep, type PathRailTrigger } from '../model/pathRail';
import type { MonitorSelection } from '../types';

export type PathRailFilter = 'all' | 'failed';

export interface PathRailProps {
  steps: readonly PathRailStep[];
  currentState: string | null;
  selectedKey: string | null;
  onSelect: (selection: MonitorSelection) => void;
  filter: PathRailFilter;
  onFilterChange: (filter: PathRailFilter) => void;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
}

/** Same palette as Quick Run's history dots. */
const TRIGGER_FILL: Record<PathRailTrigger, string> = {
  manual: 'var(--vscode-charts-blue,#3794ff)',
  automatic: 'var(--vscode-descriptionForeground,#9d9d9d)',
  scheduled: 'var(--vscode-charts-orange,#d18616)',
  event: 'var(--vscode-charts-purple,#b180d7)',
  other: 'var(--vscode-foreground,#cccccc)',
};

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';
const NODE = 22;
const COLUMN = 148;
const LINE_TOP = NODE / 2 - 1;

function scrollOptions(): ScrollIntoViewOptions {
  let reduced = false;
  try {
    reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* default motion */
  }
  return { inline: 'nearest', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' };
}

function timeOf(startedAt: string): string {
  const d = new Date(startedAt);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
}

/** The instance's path as a horizontal rail: one numbered node per transition, ending in the current state. */
export function PathRail({ steps, currentState, selectedKey, onSelect, filter, onFilterChange, follow, onFollowChange }: PathRailProps) {
  const summary = useMemo(() => railSummary(steps), [steps]);
  const visible = filter === 'failed' ? steps.filter((s) => s.failedTasks > 0) : steps;
  const duration = formatDurationMs(summary.totalMs);
  const itemRefs = useRef(new Map<number, HTMLElement>());
  const seen = useRef(0);

  useEffect(() => {
    if (!selectedKey) return;
    const match = [...visible].reverse().find((s) => s.transitionKey === selectedKey);
    itemRefs.current.get(match?.order ?? -1)?.scrollIntoView?.(scrollOptions());
    // Only a changed selection scrolls; a refresh must not yank the rail around.
  }, [selectedKey]);

  useEffect(() => {
    const grew = steps.length > seen.current;
    seen.current = steps.length;
    if (!follow || !grew || visible.length === 0) return;
    itemRefs.current.get(visible[visible.length - 1].order)?.scrollIntoView?.(scrollOptions());
  }, [steps.length, follow]);

  const segment = (value: PathRailFilter, label: string, disabled: boolean) => (
    <button
      type="button"
      aria-pressed={filter === value}
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={() => onFilterChange(value)}
      className={`cursor-pointer px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
        filter === value
          ? 'bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)]'
          : 'hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col text-[11px]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--vscode-panel-border,#3c3c3c)] bg-[var(--vscode-sideBarSectionHeader-background,transparent)] px-1">
        <span className="-mb-px border-b-2 border-[var(--vscode-panelTitle-activeBorder,var(--vscode-focusBorder,#007fd4))] px-2 py-1">Path</span>
        <span className={`tabular-nums ${muted}`}>
          {summary.count} {summary.count === 1 ? 'step' : 'steps'}
          {duration ? ` · ${duration}` : ''}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span role="group" aria-label="Filter steps" className="inline-flex overflow-hidden rounded border border-[var(--vscode-panel-border,#3c3c3c)]">
            {segment('all', 'All', false)}
            {segment('failed', 'Show failed only', summary.failedSteps === 0)}
          </span>
          <label className="flex cursor-pointer items-center gap-1" title="Follow latest">
            <input type="checkbox" checked={follow} onChange={(e) => onFollowChange(e.target.checked)} className="cursor-pointer" aria-label="Follow latest" />
            Follow latest
          </label>
        </span>
      </div>

      {steps.length === 0 ? (
        <p className={`px-3 py-3 ${muted}`}>No transitions yet — the path appears here as the instance moves.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          <ol className="m-0 flex w-max list-none items-start p-0">
            {visible.map((s, i) => {
              const selected = selectedKey === s.transitionKey;
              const time = timeOf(s.startedAt);
              const dur = formatDurationMs(s.durationMs);
              const meta = [time, dur].filter(Boolean).join(' · ');
              const route = `${s.fromState} → ${s.toState}`;
              return (
                <li key={s.order} style={{ width: COLUMN }} className="relative shrink-0">
                  <span
                    aria-hidden
                    style={{ top: LINE_TOP, left: i === 0 ? NODE / 2 : 0 }}
                    className="absolute right-0 h-0.5 bg-[var(--vscode-panel-border,#3c3c3c)]"
                  />
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) itemRefs.current.set(s.order, el);
                      else itemRefs.current.delete(s.order);
                    }}
                    aria-pressed={selected}
                    aria-label={`Step ${s.order}: ${s.label}, ${s.fromState} to ${s.toState}`}
                    title={`${s.label}\n${route}${meta ? `\n${meta}` : ''}${s.failedTasks > 0 ? `\n${s.failedTasks} failed ${s.failedTasks === 1 ? 'task' : 'tasks'}` : ''}${s.wroteData ? '\nWrote instance data' : ''}`}
                    onClick={() => onSelect({ kind: 'transition', key: s.transitionKey })}
                    className="relative flex w-full cursor-pointer flex-col items-start gap-1 rounded text-left outline-offset-2"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        style={{
                          width: NODE,
                          height: NODE,
                          background: TRIGGER_FILL[s.trigger],
                          boxShadow: selected ? '0 0 0 2px var(--vscode-panel-background,#1e1e1e), 0 0 0 4px var(--vscode-focusBorder,#007fd4)' : undefined,
                        }}
                        className="relative z-[1] inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums text-[var(--vscode-editor-background,#1e1e1e)]"
                      >
                        {s.order}
                      </span>
                      {s.failedTasks > 0 && (
                        <span className="relative z-[1] tabular-nums text-[var(--vscode-errorForeground,#f48771)]" aria-label={`${s.failedTasks} failed ${s.failedTasks === 1 ? 'task' : 'tasks'}`}>
                          ⚠ {s.failedTasks}
                        </span>
                      )}
                      {s.wroteData && (
                        <Database size={11} aria-label="Wrote instance data" className={`relative z-[1] ${muted}`} />
                      )}
                    </span>
                    <span className="block w-full truncate pr-2 font-medium">{s.label}</span>
                    <span className={`block w-full truncate pr-2 tabular-nums ${muted}`}>
                      {route}
                      {meta ? ` · ${meta}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
            <li style={{ width: COLUMN }} className="relative shrink-0">
              <span aria-hidden style={{ top: LINE_TOP, width: NODE / 2 }} className="absolute left-0 h-0.5 bg-[var(--vscode-panel-border,#3c3c3c)]" />
              <span className="flex flex-col items-start gap-1" title={currentState ? `Now in ${currentState}` : 'Current state unknown'}>
                <span
                  aria-hidden
                  style={{ width: 16, height: 16, margin: 3, transform: 'rotate(45deg)' }}
                  className="relative z-[1] shrink-0 border-2 border-[var(--vscode-focusBorder,#007fd4)] bg-[var(--vscode-panel-background,#1e1e1e)]"
                />
                <span className="block w-full truncate pr-2 font-medium">{currentState ? `Now in ${currentState}` : 'Current state unknown'}</span>
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
