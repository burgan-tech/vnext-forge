import { useEffect, useMemo, useState } from 'react';

import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import { CopyableJsonBlock } from '../../quick-run/components/CopyableJsonBlock';
import { RuntimeErrorBanner, type RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { attributeRows, compareOrder, previousRow, rowLabel } from '../model/dataAttribution';
import { diffJson } from '../model/jsonDiff';
import { DataDiffView } from './DataDiffView';

export interface DataTabProps {
  /** Latest data from `getData`; undefined while loading. */
  current?: unknown;
  currentFailed?: boolean;
  /** ETag of the current data. */
  currentETag?: string;
  history: readonly HistoryTransition[];
  rows: DataHistoryItem[];
  state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  hasNext: boolean;
  error: RuntimeErrorLike | null;
  onLoadMore: () => void;
  /** Display label of a transition key. */
  labelFor?: (transitionKey: string) => string;
  /** Called on mount so the shell starts loading history. */
  onOpen?: () => void;
}

const BUTTON =
  'cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-[11px] hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)] disabled:cursor-not-allowed disabled:opacity-50';
const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

const changeCount = (d: ReturnType<typeof diffJson>) => d.added.length + d.removed.length + d.changed.length;

/** Current data plus the version history (read-only). */
export function DataTab({ current, currentFailed, currentETag, history, rows, state, hasNext, error, onLoadMore, labelFor, onOpen }: DataTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState<[DataHistoryItem, DataHistoryItem] | null>(null);

  useEffect(() => {
    onOpen?.();
  }, [onOpen]);

  const owners = useMemo(() => {
    const byRow = new Map<string, HistoryTransition>();
    const hist = history as HistoryTransition[];
    for (const [firingId, list] of attributeRows(rows, hist)) {
      const firing = hist.find((h) => h.id === firingId);
      if (firing) for (const r of list) byRow.set(r.id, firing);
    }
    return byRow;
  }, [rows, history]);

  // Row diffs vs the previous row; null when the predecessor sits on a page that is not loaded yet.
  const diffs = useMemo(() => {
    const map = new Map<string, ReturnType<typeof diffJson> | null>();
    rows.forEach((row, i) => {
      const unloaded = i === rows.length - 1 && hasNext;
      map.set(row.id, unloaded ? null : diffJson(previousRow(rows, row)?.data, row.data));
    });
    return map;
  }, [rows, hasNext]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]));

  const runCompare = () => {
    const pair = picked.map((id) => rows.find((r) => r.id === id)).filter((r): r is DataHistoryItem => !!r);
    if (pair.length !== 2) return;
    // VersionNo restarts per version line, so order by time (list position breaks ties).
    setCompare(compareOrder(rows, pair[0], pair[1]));
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <section className="flex flex-col gap-1">
        <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Current</h3>
        {currentFailed ? (
          <p className={muted}>Current data could not be loaded.</p>
        ) : current === undefined ? (
          <p className={muted}>Loading…</p>
        ) : (
          <>
            {currentETag && <p className={muted}>ETag: {currentETag}</p>}
            <CopyableJsonBlock value={current} />
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Versions</h3>
        {state === 'unavailable' && <p className={muted}>Data history needs a newer runtime.</p>}
        {state === 'error' && error && <RuntimeErrorBanner title="Data history request failed" error={error} />}
        {(state === 'loading' || state === 'idle') && <p className={muted}>Loading…</p>}
        {state === 'ready' && rows.length === 0 && <p className={muted}>No data versions recorded.</p>}
        {state === 'ready' && rows.length > 0 && (
          <>
            <ul className="flex flex-col gap-1">
              {rows.map((row) => {
                const owner = owners.get(row.id);
                const diff = diffs.get(row.id) ?? null;
                const open = expanded === row.id;
                const initial = !hasNext && row.id === rows[rows.length - 1]?.id;
                return (
                  <li key={row.id} className="rounded border border-[var(--vscode-panel-border,#3c3c3c)]">
                    <div className="flex items-center gap-2 px-2 py-1">
                      <input
                        type="checkbox"
                        aria-label={`Select ${rowLabel(row)} to compare`}
                        checked={picked.includes(row.id)}
                        onChange={() => toggle(row.id)}
                        className="cursor-pointer"
                      />
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : row.id)}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
                      >
                        <span className="truncate">
                          <span className="font-semibold">{rowLabel(row)}</span> · {new Date(row.enteredAt).toLocaleString()} ·{' '}
                          {owner
                            ? `after ${labelFor ? labelFor(owner.transitionId) : owner.transitionId} (${owner.fromState} → ${owner.toState})`
                            : 'Other write'}
                        </span>
                        <span className={muted}>
                          {diff ? (initial ? 'Initial version' : `${changeCount(diff)} fields changed`) : 'Previous version not loaded'}
                        </span>
                      </button>
                    </div>
                    {open && (
                      <div className="border-t border-[var(--vscode-panel-border,#3c3c3c)] p-2">
                        {diff ? (
                          <DataDiffView diff={diff} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={muted}>Previous version not loaded.</span>
                            <button type="button" className={BUTTON} onClick={onLoadMore}>
                              Load more
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BUTTON} disabled={picked.length !== 2} onClick={runCompare}>
                Compare
              </button>
              {hasNext && (
                <button type="button" className={BUTTON} onClick={onLoadMore}>
                  Load more
                </button>
              )}
            </div>
            {state === 'ready' && error && <RuntimeErrorBanner title="Data history request failed" error={error} />}
            {compare && (
              <div className="flex flex-col gap-1">
                <p className={muted}>
                  {rowLabel(compare[0])} → {rowLabel(compare[1])}
                </p>
                <DataDiffView diff={diffJson(compare[0].data, compare[1].data)} />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
