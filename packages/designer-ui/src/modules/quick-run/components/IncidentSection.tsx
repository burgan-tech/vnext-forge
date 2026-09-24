import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import type { IncidentEntry, IncidentPage } from '../QuickRunApi';
import type { NormalizedIncident } from '../utils/incident';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { RuntimeErrorBanner, type RuntimeErrorLike } from './RuntimeErrorBanner';

type LoadResult<T> = { success: true; data: T } | { success: false; error: RuntimeErrorLike };

export const INCIDENT_PAGE_SIZE = 20;

/** Lazy loaders for the incident endpoints; paths are rebuilt host-side. */
export interface IncidentLoaders {
  loadActive: () => Promise<LoadResult<{ incident: IncidentEntry | null }>>;
  loadHistory: (page: number) => Promise<LoadResult<IncidentPage>>;
}

export function createIncidentLoaders(ctx: {
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}): IncidentLoaders {
  return {
    loadActive: () => QuickRunApi.getActiveIncident(ctx),
    loadHistory: (page) => QuickRunApi.getIncidents({ ...ctx, page, pageSize: INCIDENT_PAGE_SIZE }),
  };
}

export interface IncidentHistoryState {
  items: IncidentEntry[];
  /** Last loaded page; 0 before the first load. */
  page: number;
  hasNext: boolean;
}

export const EMPTY_INCIDENT_HISTORY: IncidentHistoryState = { items: [], page: 0, hasNext: false };

export function appendIncidentPage(prev: IncidentHistoryState, next: IncidentPage): IncidentHistoryState {
  const seen = new Set(prev.items.map((i) => i.id));
  return {
    items: [...prev.items, ...next.items.filter((i) => !seen.has(i.id))],
    page: next.page,
    hasNext: next.hasNext,
  };
}

function thrown(err: unknown): RuntimeErrorLike {
  return { code: 'THROWN', message: err instanceof Error ? err.message : String(err) };
}

export interface IncidentSectionProps {
  incident: NormalizedIncident;
  raw: unknown;
  /** Absent → link-shape incidents show the flag only. */
  loaders?: IncidentLoaders;
}

const LINK_BUTTON =
  'self-start rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50';

export function IncidentSection({ incident, raw, loaders }: IncidentSectionProps) {
  const [active, setActive] = useState<{ status: 'idle' | 'loading' | 'loaded'; entry: IncidentEntry | null }>({
    status: 'idle',
    entry: null,
  });
  const [activeError, setActiveError] = useState<RuntimeErrorLike | null>(null);
  const [history, setHistory] = useState<IncidentHistoryState>(EMPTY_INCIDENT_HISTORY);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<RuntimeErrorLike | null>(null);

  const loadActive = useCallback(async () => {
    if (!loaders) return;
    setActive({ status: 'loading', entry: null });
    setActiveError(null);
    try {
      const res = await loaders.loadActive();
      if (res.success) {
        setActive({ status: 'loaded', entry: res.data.incident });
      } else {
        setActive({ status: 'idle', entry: null });
        setActiveError(res.error);
      }
    } catch (err) {
      setActive({ status: 'idle', entry: null });
      setActiveError(thrown(err));
    }
  }, [loaders]);

  const loadHistoryPage = useCallback(
    async (page: number) => {
      if (!loaders) return;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await loaders.loadHistory(page);
        if (res.success) setHistory((prev) => appendIncidentPage(page === 1 ? EMPTY_INCIDENT_HISTORY : prev, res.data));
        else setHistoryError(res.error);
      } catch (err) {
        setHistoryError(thrown(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    [loaders],
  );

  // F2: auto-load the active incident once on mount while idle, instead of
  // requiring a "Show active incident" click. Guarded by a ref (not by
  // `active.status`) so a failed attempt doesn't retry in a loop on every
  // render. This effect never runs during SSR, so the button below still
  // renders in the SSR-only test harness.
  const attemptedAutoLoad = useRef(false);
  useEffect(() => {
    if (attemptedAutoLoad.current) return;
    if (loaders && incident.hasActiveIncident && !incident.active) {
      attemptedAutoLoad.current = true;
      void loadActive();
    }
  }, [loaders, incident.hasActiveIncident, incident.active, loadActive]);

  let activeBlock: ReactNode = null;
  if (incident.active) {
    activeBlock = <IncidentEntryCard entry={incident.active} heading="Current incident" />;
  } else if (incident.hasActiveIncident) {
    if (active.status === 'loaded') {
      activeBlock = active.entry ? (
        <IncidentEntryCard entry={active.entry} heading="Current incident" />
      ) : (
        <p className="text-xs text-[var(--vscode-foreground)]">
          No open incident any more — a retry may have resolved it. Refresh the state to see the latest.
        </p>
      );
    } else if (loaders) {
      activeBlock = (
        <button type="button" className={LINK_BUTTON} onClick={() => void loadActive()} disabled={active.status === 'loading'}>
          {active.status === 'loading' ? 'Loading incident…' : 'Show active incident'}
        </button>
      );
    } else {
      activeBlock = <p className="text-xs text-[var(--vscode-foreground)]">This instance has an active incident.</p>;
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--vscode-panel-border)] pt-4">
      <p className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">Incident</p>
      {activeBlock}
      {activeError && <RuntimeErrorBanner title="Could not load the active incident" error={activeError} />}

      {incident.history.length > 0 ? (
        <IncidentHistoryList entries={incident.history} />
      ) : (
        loaders && (
          <div className="flex flex-col gap-2">
            {history.page === 0 ? (
              <button type="button" className={LINK_BUTTON} onClick={() => void loadHistoryPage(1)} disabled={historyLoading}>
                {historyLoading ? 'Loading…' : 'Past incidents'}
              </button>
            ) : (
              <>
                <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">Past incidents</p>
                {history.items.length === 0 ? (
                  <p className="text-xs text-[var(--vscode-descriptionForeground)]">No past incidents.</p>
                ) : (
                  <IncidentHistoryList entries={history.items} />
                )}
                {history.hasNext && (
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    onClick={() => void loadHistoryPage(history.page + 1)}
                    disabled={historyLoading}
                  >
                    {historyLoading ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        )
      )}
      {historyError && <RuntimeErrorBanner title="Could not load past incidents" error={historyError} />}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
          Raw JSON
        </summary>
        <div className="mt-2">
          <CopyableJsonBlock value={raw} />
        </div>
      </details>
    </section>
  );
}

const WARN_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0" aria-hidden="true">
    <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28 2.28 13h11.44L8 2.28zM8.5 12v-1h-1v1h1zm0-2V6h-1v4h1z" />
  </svg>
);

/** Instance Details dialog header strip. */
export function IncidentAlertStrip() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-inputValidation-warningBackground)] px-4 py-2 text-[11px] text-[var(--vscode-inputValidation-warningForeground,var(--vscode-foreground))]"
    >
      {WARN_ICON}
      <span>This instance has an active incident.</span>
    </div>
  );
}

/** Dashboard alert: the flag from the state response; details load on expand. */
export function IncidentAlert({ incident, raw, loaders }: IncidentSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded border border-warning-border">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-[var(--vscode-inputValidation-warningBackground)] px-3 py-2 text-[11px] text-[var(--vscode-inputValidation-warningForeground,var(--vscode-foreground))]"
      >
        {WARN_ICON}
        <span>This instance has an active incident.</span>
        <button
          type="button"
          className="ml-auto text-[var(--vscode-textLink-foreground)] hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <IncidentSection incident={incident} raw={raw} loaders={loaders} />
        </div>
      )}
    </section>
  );
}

export function IncidentBadge({ label = '!' }: { label?: string }) {
  return (
    <span
      title="Active incident"
      aria-label="Active incident"
      className="rounded border border-warning-border bg-warning-surface px-1 text-[9px] font-semibold text-warning-text"
    >
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{label}</span>
      <span className="text-[var(--vscode-foreground)]">{children}</span>
    </div>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v);

export function IncidentEntryCard({ entry, heading }: { entry: IncidentEntry; heading?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {heading && <p className="text-[10px] font-medium text-[var(--vscode-descriptionForeground)]">{heading}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Row label="State">{entry.state}</Row>
        <Row label="Transition">{entry.transition}</Row>
        <Row label="Task">{dash(entry.task)}</Row>
        <Row label="Error Code"><code className="break-all text-[10px]">{dash(entry.errorCode)}</code></Row>
        <Row label="Status Code">{dash(entry.statusCode)}</Row>
        <Row label="Layer">{dash(entry.errorLayer)}</Row>
        <Row label="Boundary">{entry.boundaryAction ? `${entry.boundaryAction} · ${dash(entry.boundaryLevel)}` : '—'}</Row>
        <Row label="Retry Count">{entry.retryCount}</Row>
        <Row label="Created At">{formatDateTime(entry.createdAt)}</Row>
        <Row label="Status">
          <span className={entry.isResolved ? 'text-[var(--vscode-charts-green)]' : 'text-[var(--vscode-charts-orange)]'}>
            {entry.isResolved ? `Resolved ${formatDateTime(entry.resolvedAt)}` : 'Open'}
          </span>
        </Row>
        <Row label="Trace ID">
          {entry.traceId ? (
            <span className="flex items-center gap-1">
              <code className="break-all text-[10px] text-[var(--vscode-textLink-foreground)]">{entry.traceId}</code>
              <button
                type="button"
                className="inline-flex shrink-0 rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                onClick={() => {
                  void navigator.clipboard.writeText(entry.traceId ?? '').then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                title={copied ? 'Copied!' : 'Copy Trace ID'}
                aria-label="Copy Trace ID"
              >
                {copied ? '✓' : '⧉'}
              </button>
            </span>
          ) : (
            '—'
          )}
        </Row>
      </div>
      <div className="max-h-48 overflow-y-auto rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-textCodeBlock-background)] p-2">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--vscode-foreground)]">{entry.message}</pre>
      </div>
    </div>
  );
}

function IncidentHistoryList({ entries }: { entries: readonly IncidentEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <details key={entry.id} className="rounded border border-[var(--vscode-panel-border)]">
          <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]">
            <span className="text-[var(--vscode-descriptionForeground)]">{formatDateTime(entry.createdAt)}</span>
            <code className="text-[var(--vscode-foreground)]">{dash(entry.errorCode)}</code>
            <span className="text-[var(--vscode-descriptionForeground)]">@ {entry.state}</span>
            <span className={`ml-auto text-[9px] ${entry.isResolved ? 'text-[var(--vscode-charts-green)]' : 'text-[var(--vscode-charts-orange)]'}`}>
              {entry.isResolved ? 'Resolved' : 'Open'}
            </span>
          </summary>
          <div className="border-t border-[var(--vscode-panel-border)] p-2">
            <IncidentEntryCard entry={entry} />
          </div>
        </details>
      ))}
    </div>
  );
}
