import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { findTransition } from '../../canvas-interaction/readonly/normalize';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { pathSteps, pickLabel } from '../model/monitorPath';
import type { MonitorSelection } from '../types';

export interface PathTimelineProps {
  history: readonly HistoryTransition[];
  vm: WorkflowViewModel;
  selectedKey: string | null;
  onSelect: (selection: MonitorSelection) => void;
}

/** The path as chips, oldest first; a chip selects its transition on the canvas. */
export function PathTimeline({ history, vm, selectedKey, onSelect }: PathTimelineProps) {
  const [open, setOpen] = useState(true);
  const steps = pathSteps(history);
  return (
    <section className="border-t border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-[11px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1 text-[var(--vscode-descriptionForeground,#9d9d9d)]"
      >
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        Path · {steps.length} {steps.length === 1 ? 'transition' : 'transitions'}
      </button>
      {open && (
        <ol className="mt-1 flex max-h-20 flex-wrap items-center gap-1 overflow-y-auto">
          {steps.length === 0 ? (
            <li className="text-[var(--vscode-descriptionForeground,#9d9d9d)]">No transitions yet</li>
          ) : (
            steps.map((s) => {
              const label = pickLabel(findTransition(vm, s.transitionKey)?.labels, s.transitionKey);
              const selected = selectedKey === s.transitionKey;
              return (
                <li key={s.order}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect({ kind: 'transition', key: s.transitionKey })}
                    title={`${s.fromState} → ${s.toState} · ${new Date(s.startedAt).toLocaleTimeString()}`}
                    className={`flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 ${
                      selected
                        ? 'border-[var(--vscode-focusBorder,#007fd4)] bg-[var(--vscode-list-activeSelectionBackground,#04395e)]'
                        : 'border-[var(--vscode-panel-border,#3c3c3c)] hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]'
                    }`}
                  >
                    <span className="tabular-nums opacity-70">{s.order}</span>
                    <span>{label}</span>
                    <span className="text-[var(--vscode-descriptionForeground,#9d9d9d)]">→ {s.toState}</span>
                  </button>
                </li>
              );
            })
          )}
        </ol>
      )}
    </section>
  );
}
