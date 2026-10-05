import { useState } from 'react';

import type { ElementMetricsResponse } from '../types/quickrun.types';
import { formatDurationMs } from '../utils/taskHistory';

export type ElementMetricsKind = 'transition' | 'state';

export type ElementMetricsLoader = (
  kind: ElementMetricsKind,
  key: string,
) => Promise<{ success: true; data: ElementMetricsResponse } | { success: false; error: { message: string } }>;

/**
 * Attempts of one transition (each firing) or state (each visit), runtime
 * 0.0.99. Props-only so the SSR harness can assert it.
 */
export function ElementMetricsView({ metrics }: { metrics: ElementMetricsResponse }) {
  if (metrics.attempts.length === 0) {
    return <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">No attempts recorded</p>;
  }
  const durationLabel = metrics.element.kind === 'state' ? 'dwell' : 'execution';
  return (
    <ol className="flex flex-col gap-1">
      {metrics.attempts.map((a) => (
        <li key={a.seq} className="rounded border border-[var(--vscode-panel-border)] p-1.5 text-[10px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">#{a.seq}</span>
            {a.triggerType && <span>{a.triggerType}</span>}
            {a.triggeredBy && <span className="text-[var(--vscode-descriptionForeground)]">by {a.triggeredBy}</span>}
            <span className="ml-auto text-[var(--vscode-descriptionForeground)]" title={`${durationLabel} time`}>
              {formatDurationMs(a.durationMs) ?? (metrics.element.kind === 'state' ? 'still here' : '')}
            </span>
          </div>
          {a.tasks.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 border-l border-[var(--vscode-panel-border)] pl-1.5">
              {a.tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-1">
                  {t.order != null && <span className="text-[var(--vscode-descriptionForeground)]">#{t.order}</span>}
                  <span className="font-mono">{t.taskKey}</span>
                  {t.hook && <span className="rounded border border-[var(--vscode-panel-border)] px-1 text-[9px]">{t.hook}</span>}
                  <span>{t.status}</span>
                  {t.businessStatus && <span className="text-[var(--vscode-descriptionForeground)]">{t.businessStatus}</span>}
                  <span className="ml-auto text-[var(--vscode-descriptionForeground)]">{formatDurationMs(t.durationMs) ?? ''}</span>
                  {t.error && <span className="w-full text-[var(--vscode-errorForeground)]">{t.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/** A "Metrics" toggle that loads on first open. */
export function ElementMetricsToggle({
  kind,
  elementKey,
  load,
  label,
}: {
  kind: ElementMetricsKind;
  elementKey: string;
  load: ElementMetricsLoader;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<ElementMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !metrics && !loading) {
      setLoading(true);
      setError(null);
      void load(kind, elementKey)
        .then((res) => (res.success ? setMetrics(res.data) : setError(res.error.message)))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="self-start rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open &&
        (loading ? (
          <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">Loading…</p>
        ) : error ? (
          <p className="text-[10px] text-[var(--vscode-errorForeground)]">{error}</p>
        ) : metrics ? (
          <ElementMetricsView metrics={metrics} />
        ) : null)}
    </div>
  );
}
