import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import { transitionDetailTabs } from '../../quick-run/components/HistoryTab';
import { DetailsBody } from '../../quick-run/components/panel-kit';
import type { HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { previousRow } from '../model/dataAttribution';
import { diffJson } from '../model/jsonDiff';
import { DataDiffView } from './DataDiffView';

const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

/** Every firing of a transition, each expandable into Quick Run's history detail tabs (Overview / Executions / Tasks / Request). */
export function TransitionExecution({
  firings,
  tasks,
  loadMetrics,
  dataRowsByFiring,
  allRows,
}: {
  firings: readonly HistoryTransition[];
  tasks: readonly TaskHistoryItem[];
  loadMetrics?: ElementMetricsLoader;
  /** Data rows (newest first) attributed to each firing id. */
  dataRowsByFiring?: Map<string, DataHistoryItem[]>;
  /** Every loaded data row, newest first. */
  allRows?: DataHistoryItem[];
}) {
  const [open, setOpen] = useState<string | null>(firings.length === 1 ? (firings[0]?.id ?? null) : null);
  return (
    <section className="flex flex-col gap-1 border-t border-[var(--vscode-panel-border,#3c3c3c)] p-3 text-[11px]">
      <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Execution</h3>
      {firings.length === 0 && <p className={muted}>This transition has not fired on this instance.</p>}
      {firings.map((f, i) => {
        const expanded = open === f.id;
        return (
          <div key={f.id} className="rounded border border-[var(--vscode-panel-border,#3c3c3c)]">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : f.id)}
              className="flex w-full cursor-pointer items-center gap-1 px-2 py-1 text-left hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]"
            >
              {expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
              <span className="font-medium">Firing {i + 1} of {firings.length}</span>
              <span className={`ml-auto ${muted}`}>{new Date(f.startedAt).toLocaleTimeString()}</span>
            </button>
            {expanded && (
              <div className="border-t border-[var(--vscode-panel-border,#3c3c3c)] p-2">
                <DetailsBody tabs={[...transitionDetailTabs(f, { ...(loadMetrics ? { loadMetrics } : {}), tasks }), ...dataChangeTab(f.id, dataRowsByFiring, allRows)]} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function dataChangeTab(firingId: string, byFiring?: Map<string, DataHistoryItem[]>, allRows?: DataHistoryItem[]) {
  const rows = byFiring?.get(firingId);
  if (!rows || rows.length === 0) return [];
  const newest = rows[0];
  const oldest = rows[rows.length - 1];
  const before = allRows ? previousRow(allRows, oldest) : null;
  return [{ id: 'data-change', label: 'Data change', render: () => <DataDiffView diff={diffJson(before?.data, newest.data)} /> }];
}
