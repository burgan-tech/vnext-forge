import { useState } from 'react';

/**
 * Headers worth surfacing without an extra click, once the trace id (handled
 * separately, see below) is set aside.
 *
 * One real discrepancy from the file this was ported from, worth naming
 * explicitly: quick-run's own `InstanceDashboard.ResponseHeadersSection`
 * keeps `x-trace-id` *in* its `PROMINENT_HEADERS` list and then filters it
 * back out of both buckets at the point it builds its two entry arrays. This
 * file's list simply never lists it in the first place — a leaner way to
 * reach the identical outcome (trace id pinned above, never duplicated into
 * the collapsed list below), with no per-render filter needed to undo
 * something the list didn't need to claim to begin with. Kept as the one,
 * internally consistent rule for this file; quick-run's copy is left exactly
 * as it is — unifying the two would drag `--vscode-*` into this module (see
 * the plan).
 */
const PROMINENT_HEADERS = ['x-span-id', 'x-request-id', 'traceparent', 'x-app-version', 'server', 'etag'] as const;

export interface FunctionRunResponseHeadersProps {
  headers: Record<string, string>;
}

/**
 * The response's header list, rendered inside the response pane's Headers
 * tab (3b/3c).
 *
 * Ported from `InstanceDashboard`'s `ResponseHeadersSection` (quick-run) to
 * semantic Tailwind tokens instead of `--vscode-*`, and pulled into its own
 * file (out of `FunctionRunResponsePane`) so it can be unit-tested on its
 * own — the same reasoning already applied to every other
 * pure/presentational piece in this module. Deliberately **not** unified
 * with quick-run's copy into one shared component; see this file's own
 * `PROMINENT_HEADERS` comment and the plan's note on why that unification is
 * out of scope here.
 *
 * `x-trace-id` gets a pinned, always-visible row of its own — unlike every
 * other header, which sits behind the "Show N more headers" toggle below —
 * because it is the one value most people actually need (correlating a
 * response with backend logs). `FunctionRunResponsePane`'s summary row pins
 * it a *second* time, outside this component entirely and visible whichever
 * response tab (Body/Headers) is active: switching to Body must not hide the
 * one header most people came here for. Seeing it here too, alongside every
 * other header, is not redundant so much as expected — someone who did
 * switch to this tab to look at headers should still find it without having
 * to remember it lives in the summary row instead.
 */
export function FunctionRunResponseHeaders({ headers }: FunctionRunResponseHeadersProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const traceEntry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-trace-id');
  const rest = Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'x-trace-id');
  const prominent = rest.filter(([k]) =>
    PROMINENT_HEADERS.includes(k.toLowerCase() as (typeof PROMINENT_HEADERS)[number]),
  );
  const other = rest.filter(
    ([k]) => !PROMINENT_HEADERS.includes(k.toLowerCase() as (typeof PROMINENT_HEADERS)[number]),
  );
  const moreCount = prominent.length + other.length;

  function copyValue(key: string, value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }

  return (
    <section className="border-border flex flex-col gap-1.5 rounded border p-2" aria-label="Response headers">
      {traceEntry ? (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground font-medium">x-trace-id</span>
          <code className="font-mono">{traceEntry[1]}</code>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => copyValue(traceEntry[0], traceEntry[1])}
            title={copiedKey === traceEntry[0] ? 'Copied!' : 'Copy'}
            aria-label="Copy x-trace-id">
            {copiedKey === traceEntry[0] ? '✓' : '⧉'}
          </button>
        </div>
      ) : null}

      {moreCount > 0 ? (
        <div>
          <button
            type="button"
            className="text-primary-text text-[10px] hover:underline"
            onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? `Show ${moreCount} more headers ▸` : 'Hide headers ▾'}
          </button>
          {!collapsed ? (
            <div className="mt-1.5 flex flex-col gap-1">
              {prominent.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground w-32 shrink-0 font-medium">{k}</span>
                  <span className="truncate">{v}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => copyValue(k, v)}
                    title={copiedKey === k ? 'Copied!' : 'Copy'}
                    aria-label={`Copy ${k}`}>
                    {copiedKey === k ? '✓' : '⧉'}
                  </button>
                </div>
              ))}
              {other.map(([k, v]) => (
                <div key={k} className="text-muted-foreground flex items-center gap-2 text-[10px]">
                  <span className="w-32 shrink-0">{k}</span>
                  <span className="truncate">{v}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
