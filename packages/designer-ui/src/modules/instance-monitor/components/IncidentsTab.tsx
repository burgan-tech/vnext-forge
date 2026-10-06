import { useState } from 'react';

import type { IncidentEntry } from '../../quick-run/QuickRunApi';
import {
  appendIncidentPage,
  EMPTY_INCIDENT_HISTORY,
  excludeCurrentIncident,
  IncidentEntryCard,
  type IncidentHistoryState,
  type IncidentLoaders,
} from '../../quick-run/components/IncidentSection';
import { DetailsDialog, PanelRow, StatusIcon } from '../../quick-run/components/panel-kit';
import { RuntimeErrorBanner, type RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';

export interface IncidentsTabProps {
  active: IncidentEntry | null;
  loaders?: IncidentLoaders;
  onShowOnCanvas: (entry: IncidentEntry) => void;
  /** Navigates to Quick Run; the monitor never retries anything itself. */
  onOpenQuickRun?: () => void;
}

const BUTTON =
  'cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 text-[11px] hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)] disabled:cursor-wait disabled:opacity-50';
const muted = 'text-[var(--vscode-descriptionForeground,#9d9d9d)]';

const time = (iso: string) => new Date(iso).toLocaleString();

/** Active incident plus an on-demand, paged history. Read-only. */
export function IncidentsTab({ active, loaders, onShowOnCanvas, onOpenQuickRun }: IncidentsTabProps) {
  const [history, setHistory] = useState<IncidentHistoryState>(EMPTY_INCIDENT_HISTORY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RuntimeErrorLike | null>(null);
  const [selected, setSelected] = useState<IncidentEntry | null>(null);

  const load = async (page: number) => {
    if (!loaders) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loaders.loadHistory(page);
      if (result.success) setHistory((prev) => appendIncidentPage(prev, result.data));
      else setError(result.error);
    } catch (err) {
      setError({ code: 'THROWN', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const rows = excludeCurrentIncident(history.items, active?.id);

  return (
    <div className="flex flex-col gap-4 p-2">
      <section className="flex flex-col gap-2">
        <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>Active incident</h3>
        {active ? (
          <>
            <p className="font-semibold">{active.message}</p>
            <IncidentEntryCard entry={active} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BUTTON} onClick={() => onShowOnCanvas(active)}>
                Show on canvas
              </button>
              {onOpenQuickRun && (
                <button type="button" className={BUTTON} onClick={onOpenQuickRun}>
                  Retry from Quick Run
                </button>
              )}
            </div>
          </>
        ) : (
          <p className={muted}>No open incident.</p>
        )}
      </section>

      {loaders && (
        <section className="flex flex-col gap-2">
          <h3 className={`text-[10px] font-semibold uppercase ${muted}`}>History</h3>
          {error && <RuntimeErrorBanner title="Incident history request failed" error={error} onDismiss={() => setError(null)} />}
          {history.page === 0 ? (
            <button type="button" className={`${BUTTON} self-start`} disabled={loading} onClick={() => void load(1)}>
              {loading ? 'Loading…' : 'Load incident history'}
            </button>
          ) : (
            <>
              {rows.length === 0 && <p className={muted}>No past incidents.</p>}
              {rows.map((e) => (
                <PanelRow
                  key={e.id}
                  leading={<StatusIcon outcome={e.isResolved ? 'ok' : 'failed'} title={e.isResolved ? 'Resolved' : 'Open'} />}
                  title={e.message}
                  subtitle={`${e.state} · ${e.transition}`}
                  trailing={<span className={`text-[10px] ${muted}`}>{time(e.createdAt)}</span>}
                  ariaLabel={`Incident: ${e.message}`}
                  onActivate={() => setSelected(e)}
                />
              ))}
              {history.hasNext && (
                <button type="button" className={`${BUTTON} self-start`} disabled={loading} onClick={() => void load(history.page + 1)}>
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {selected && (
        <DetailsDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={selected.message}
          description={`${selected.state} · ${selected.transition}`}
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              render: () => (
                <div className="flex flex-col gap-2">
                  <IncidentEntryCard entry={selected} />
                  <button
                    type="button"
                    className={`${BUTTON} self-start`}
                    onClick={() => {
                      onShowOnCanvas(selected);
                      setSelected(null);
                    }}
                  >
                    Show on canvas
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
