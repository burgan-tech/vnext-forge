import { useState } from 'react';

import { CopyableJsonBlock } from '../../quick-run/components/CopyableJsonBlock';
import { PseudoUiOrJsonBlock } from '../../quick-run/pseudo-ui/PseudoUiOrJsonBlock';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';
import { classifyStatus, isAuthorizationFailure, type StatusClass } from '../functionRunStatus';
import type { FunctionExchange } from '../types/functionRun.types';
import { FunctionRunAuthzBanner } from './FunctionRunAuthzBanner';

export interface FunctionRunResponsePaneProps {
  response: FunctionExchange | null;
  durationMs: number | null;
  /**
   * Adapted via `toViewResponse` from the output-contract exchange, when the
   * function declares an output view and following its href returned
   * content right now. `null`/absent falls back to rendering the raw body.
   */
  outputView?: ViewResponse | null;
}

const STATUS_CLASS_STYLES: Record<StatusClass, string> = {
  informational: 'border-muted-border bg-muted text-muted-foreground',
  success: 'border-success-border bg-success text-success-foreground',
  redirect: 'border-info-border bg-info text-info-foreground',
  'client-error': 'border-warning-border bg-warning text-warning-foreground',
  'server-error': 'border-destructive-border bg-destructive-muted text-destructive-text',
};

/** Same prominent set as `InstanceDashboard`'s `ResponseHeadersSection`, minus `x-trace-id` which gets its own pinned row. */
const PROMINENT_HEADERS = ['x-span-id', 'x-request-id', 'traceparent', 'x-app-version', 'server', 'etag'] as const;

/**
 * Reads the value to display for a response body, honouring the documented
 * contract on `FunctionExchange.json`: a legitimate JSON body can decode to
 * `null`, `0`, `false`, or `''` — all falsy, and `null` on top of that is
 * indistinguishable from "field absent" under `??`. Presence
 * (`'json' in exchange`), not truthiness, is what actually tells "parsing
 * succeeded" apart from "no json field was ever set" (non-JSON content type,
 * or a parse failure — see `jsonParseError`).
 */
function responseBodyValue(response: FunctionExchange): unknown {
  return 'json' in response ? response.json : response.body;
}

function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
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

function ResponseBody({
  response,
  outputView,
}: {
  response: FunctionExchange;
  outputView: ViewResponse | null | undefined;
}) {
  // A declared output view wins: `PseudoUiOrJsonBlock` already carries its own
  // rendered/JSON toggle (see its internal `ViewModeToggle`), so this is not
  // duplicated here — handing it the view is what the toggle in the plan's
  // spec refers to.
  if (outputView) {
    const bodyValue = responseBodyValue(response);
    // `instanceData` is what `PseudoUiViewSurface` actually feeds `<PseudoView>`
    // as its data binding (see the workflow runner's `InstanceDashboard`) —
    // without it a pseudo-ui output view renders as an empty shell instead of
    // showing the function's own output, which is the entire point of
    // declaring one. Only handed over when the parsed body is a plain object;
    // an array or primitive JSON body isn't a valid instance-data shape.
    const instanceData =
      typeof bodyValue === 'object' && bodyValue !== null && !Array.isArray(bodyValue)
        ? (bodyValue as Record<string, unknown>)
        : undefined;
    return (
      <PseudoUiOrJsonBlock
        view={outputView}
        jsonValue={bodyValue}
        displayContent={response.body}
        ariaLabel="Function output"
        integrationMode="preview"
        instanceData={instanceData}
      />
    );
  }

  const isJson = response.contentType.toLowerCase().includes('json');

  // The engine said JSON but the body did not parse — `jsonParseError` exists
  // precisely so this is distinguishable from "no view, plain text response".
  // Say so plainly rather than silently falling back to a raw block that
  // looks identical to an intentional text/plain reply.
  if (isJson && response.jsonParseError) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-warning-text text-[10px]">
          The response declared a JSON content type but the body did not parse (
          {response.jsonParseError}) — showing the raw text.
        </p>
        <pre className="bg-muted overflow-auto rounded p-2 text-[11px] whitespace-pre-wrap">
          {response.body}
        </pre>
      </div>
    );
  }

  if (isJson) {
    return <CopyableJsonBlock value={responseBodyValue(response)} />;
  }

  return (
    <pre className="bg-muted overflow-auto rounded p-2 text-[11px] whitespace-pre-wrap">
      {response.body}
    </pre>
  );
}

/**
 * Status, headers, and body for the most recent `functions/*` exchange.
 *
 * Every response renders here, including 4xx/5xx — a function under
 * development legitimately answers with an error status, which is the whole
 * reason the backend never throws on non-2xx (see `classifyStatus`).
 * 401/403 additionally surface `FunctionRunAuthzBanner` above everything
 * else, because the runtime shares one access policy between discovery and
 * execution: that status means "you may not run this", not "your function is
 * broken" (see `isAuthorizationFailure` — 404 does not qualify, it means "no
 * sys-functions component for this key").
 */
export function FunctionRunResponsePane({ response, durationMs, outputView }: FunctionRunResponsePaneProps) {
  if (!response) return null;

  const statusClass = classifyStatus(response.status);

  return (
    <div className="flex flex-col gap-2">
      {isAuthorizationFailure(response.status) ? <FunctionRunAuthzBanner status={response.status} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CLASS_STYLES[statusClass]}`}
          role="status"
          aria-label={`Response status ${response.status}`}>
          {response.status}
        </span>
        {durationMs !== null ? (
          <span className="text-muted-foreground text-[10px]">{durationMs} ms</span>
        ) : null}
        <span className="text-muted-foreground text-[10px]">{response.contentType}</span>
      </div>

      <ResponseHeaders headers={response.responseHeaders} />

      <ResponseBody response={response} outputView={outputView} />
    </div>
  );
}
