import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { CopyableJsonBlock } from '../../quick-run/components/CopyableJsonBlock';
import { PseudoUiOrJsonBlock } from '../../quick-run/pseudo-ui/PseudoUiOrJsonBlock';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';
import { findTraceId } from '../functionRunHeaders';
import { computeResponseByteSize, formatResponseSize } from '../functionRunResponseSize';
import { classifyStatus, isAuthorizationFailure, type StatusClass } from '../functionRunStatus';
import type { FunctionExchange } from '../types/functionRun.types';
import { FunctionRunAuthzBanner } from './FunctionRunAuthzBanner';
import { FunctionRunResponseHeaders } from './FunctionRunResponseHeaders';

export type ResponseTabId = 'body' | 'headers';

export interface FunctionRunResponsePaneProps {
  response: FunctionExchange | null;
  durationMs: number | null;
  /**
   * Adapted via `toViewResponse` from the output-contract exchange, when the
   * function declares an output view and following its href returned
   * content right now. `null`/absent falls back to rendering the raw body.
   */
  outputView?: ViewResponse | null;
  /**
   * The response tab actually shown — `'body'` or `'headers'` — controlled
   * by the caller, the same idiom `FunctionRunRequestTabs` uses on the
   * request side. Kept out of the zustand store, mirroring the request
   * panel's own ephemeral `paramsView`: losing this preference on a remount
   * is a minor cosmetic reset, not a loss of anything the user typed.
   */
  activeTab: ResponseTabId;
  onTabChange: (tab: ResponseTabId) => void;
}

const STATUS_CLASS_STYLES: Record<StatusClass, string> = {
  informational: 'border-muted-border bg-muted text-muted-foreground',
  success: 'border-success-border bg-success text-success-foreground',
  redirect: 'border-info-border bg-info text-info-foreground',
  'client-error': 'border-warning-border bg-warning text-warning-foreground',
  'server-error': 'border-destructive-border bg-destructive-muted text-destructive-text',
};

const TAB_TRIGGER_CLASS = 'rounded px-2.5 py-1 text-[10px] font-semibold';

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
 * Status, size, duration, and content type for the most recent `functions/*`
 * exchange, followed by a `Body | Headers` tab strip (3a/3b).
 *
 * Every response renders here, including 4xx/5xx — a function under
 * development legitimately answers with an error status, which is the whole
 * reason the backend never throws on non-2xx (see `classifyStatus`).
 * 401/403 additionally surface `FunctionRunAuthzBanner` above everything
 * else, because the runtime shares one access policy between discovery and
 * execution: that status means "you may not run this", not "your function is
 * broken" (see `isAuthorizationFailure` — 404 does not qualify, it means "no
 * sys-functions component for this key").
 *
 * **Tab-unmount decision (3b):** built on `ui/Tabs`, the same component
 * `FunctionRunRequestTabs` uses — Radix does not render an inactive
 * `TabsContent`'s children at all, so switching from Body to Headers and
 * back unmounts and remounts whichever output view is declared. That could
 * matter for a pseudo-ui output view with meaningful local state (an
 * expanded section, a selection). This pane accepts that cost rather than
 * fighting it (Radix's `forceMount` plus manual visibility CSS) because (a)
 * the request side already made the identical trade-off for the input view
 * one panel over, so a different answer here would just be an inconsistency
 * with no clear benefit, and (b) the output view is a read-only rendering of
 * the *last* response, not a form the user is actively filling in — losing
 * "which section was expanded" on a glance at Headers is a minor, recoverable
 * cost next to the complexity of keeping it mounted off-screen.
 *
 * **Trace id stays visible across both tabs:** the plan's own worry was that
 * tabbing the response body away from its headers could bury the one header
 * people actually reach for — `x-trace-id`, needed to correlate a response
 * with backend logs. Rather than accept that regression, `findTraceId` pins
 * it into the summary row below, *outside* both tabs — switching to Body
 * does not hide it. It still also appears inside `FunctionRunResponseHeaders`
 * itself (see that file's own comment) for anyone who lands on the Headers
 * tab looking for it there.
 */
export function FunctionRunResponsePane({
  response,
  durationMs,
  outputView,
  activeTab,
  onTabChange,
}: FunctionRunResponsePaneProps) {
  if (!response) return null;

  const statusClass = classifyStatus(response.status);
  const byteSize = computeResponseByteSize(response.body);
  const traceId = findTraceId(response.responseHeaders);

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
        <span className="text-muted-foreground text-[10px]">{formatResponseSize(byteSize)}</span>
        <span className="text-muted-foreground text-[10px]">{response.contentType}</span>
        {traceId !== null ? (
          <span className="text-muted-foreground ml-auto flex items-center gap-1 text-[10px]">
            <span className="font-medium">trace</span>
            <code className="font-mono">{traceId}</code>
          </span>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as ResponseTabId)}>
        <TabsList variant="default" noBorder aria-label="Response section" className="h-7 w-fit gap-1 rounded-md p-0.5">
          <TabsTrigger value="body" variant="default" noBorder className={TAB_TRIGGER_CLASS}>
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" variant="default" noBorder className={TAB_TRIGGER_CLASS}>
            Headers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body">
          <ResponseBody response={response} outputView={outputView} />
        </TabsContent>
        <TabsContent value="headers">
          <FunctionRunResponseHeaders headers={response.responseHeaders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
