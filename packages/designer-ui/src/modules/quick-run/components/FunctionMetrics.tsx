import { useState } from 'react';

import type { FunctionMetricsResponse } from '../types/quickrun.types';
import { formatDurationMs } from '../utils/taskHistory';

export type FunctionMetricsLoader = (
  functionKey: string,
) => Promise<{ success: true; data: FunctionMetricsResponse } | { success: false; error: { message: string } }>;

/**
 * A function's execution journal (runtime 0.0.99). The runtime records only
 * functions declaring `attributes.executionLog: "E"`, so an empty list
 * usually means the function is not opted in.
 */
export function FunctionMetricsView({ metrics }: { metrics: FunctionMetricsResponse }) {
  const s = metrics.summary;
  return (
    <div className="flex flex-col gap-1 text-[10px]">
      {s && (
        <div className="flex flex-wrap gap-2 text-[var(--vscode-descriptionForeground)]">
          <span>Calls: {s.count}</span>
          {s.p50Ms != null && <span>p50: {formatDurationMs(s.p50Ms)}</span>}
          {s.p95Ms != null && <span>p95: {formatDurationMs(s.p95Ms)}</span>}
          {s.failureRate != null && <span>Failure rate: {(s.failureRate * 100).toFixed(1)}%</span>}
        </div>
      )}
      {metrics.items.length === 0 ? (
        <p className="text-[var(--vscode-descriptionForeground)]">
          No executions recorded. The runtime journals a function only when it declares executionLog: E.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {metrics.items.map((i) => (
            <li key={i.executionId} className="flex flex-wrap items-center gap-1.5">
              <span className={i.succeeded ? '' : 'text-[var(--vscode-errorForeground)]'}>{i.status ?? (i.succeeded ? 'completed' : 'faulted')}</span>
              {i.statusCode != null && <span>{i.statusCode}</span>}
              {i.fromCache && <span className="rounded border border-[var(--vscode-panel-border)] px-1 text-[9px]">cache</span>}
              <span className="text-[var(--vscode-descriptionForeground)]">{new Date(i.invokedAt).toLocaleString()}</span>
              {i.invokedBy && <span className="text-[var(--vscode-descriptionForeground)]">by {i.invokedBy}</span>}
              <span className="ml-auto">{formatDurationMs(i.durationMs) ?? ''}</span>
              {i.error && <span className="w-full text-[var(--vscode-errorForeground)]">{i.error}</span>}
            </li>
          ))}
        </ul>
      )}
      {metrics.hasNext && <p className="text-[var(--vscode-descriptionForeground)]">Showing the latest page only.</p>}
    </div>
  );
}

export function FunctionMetricsToggle({ functionKey, load }: { functionKey: string; load: FunctionMetricsLoader }) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<FunctionMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = () => {
    setLoading(true);
    setError(null);
    void load(functionKey)
      .then((res) => (res.success ? setMetrics(res.data) : setError(res.error.message)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next && !metrics && !loading) fetchMetrics();
          }}
          className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          {open ? '▾' : '▸'} Execution metrics
        </button>
        {open && (
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={loading}
            className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>
      {open &&
        (loading ? (
          <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">Loading…</p>
        ) : error ? (
          <p className="text-[10px] text-[var(--vscode-errorForeground)]">{error}</p>
        ) : metrics ? (
          <FunctionMetricsView metrics={metrics} />
        ) : null)}
    </div>
  );
}
