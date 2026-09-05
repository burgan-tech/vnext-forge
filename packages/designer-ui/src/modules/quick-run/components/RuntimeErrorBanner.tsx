/**
 * Surfaces a runtime (vNext engine) failure that reached the webview as an
 * `ApiFailure`. `QuickRunService.parseJsonResponse` merges the runtime's
 * non-2xx body into `error.details` next to `httpStatus`, so a 400 from the
 * fail-closed instance query validator arrives with its machine-readable
 * sub-codes (`filter.unknownOperator`, `sort.invalidJson`, …) and correction
 * hints. This banner renders those instead of a bare "Runtime returned HTTP 400".
 *
 * Tolerant of the body shapes the engine emits: the Aether error envelope
 * (`{ error: { prefix, code, message, target, validationErrors[] } }`), a flat
 * `code`/`message`/`errors[]` record, and RFC 7807 problem details (`title`,
 * `detail`, `status`, `errors{}`).
 */

export interface RuntimeErrorLike {
  code: string;
  message: string;
  traceId?: string;
  details?: Record<string, unknown>;
}

interface RuntimeErrorBannerProps {
  /** Short lead-in, e.g. "Instance list request failed". */
  title: string;
  error: RuntimeErrorLike;
  onDismiss?: () => void;
}

export interface RuntimeErrorLine {
  code?: string;
  message: string;
}

export interface RuntimeErrorSummary {
  httpStatus?: number;
  /** Engine error code, e.g. `Validation:900011`. */
  code?: string;
  /** Human-readable headline from the body, falling back to the ApiFailure message. */
  summary: string;
  /** Individual rejection reasons (`filter.unknownOperator`, `sort.invalidJson`, …). */
  lines: RuntimeErrorLine[];
  traceId?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function rec(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return undefined;
}

/**
 * Normalise the per-error list from any of the shapes the engine emits:
 * - Aether `error.validationErrors[]` → `{ message, members[] }`
 * - `errors[]` of objects (`code`/`message`/`target`) or plain strings
 * - RFC 7807 `errors{}` dictionary → `{ field: [messages] }`
 */
export function extractRuntimeErrorLines(body: Record<string, unknown> | undefined): RuntimeErrorLine[] {
  if (!body) return [];
  const out: RuntimeErrorLine[] = [];

  const validationErrors = body.validationErrors;
  if (Array.isArray(validationErrors)) {
    for (const item of validationErrors) {
      const v = rec(item);
      if (!v) continue;
      const message = firstString(v.message, v.errorMessage);
      if (!message) continue;
      const members = Array.isArray(v.members) ? v.members : Array.isArray(v.memberNames) ? v.memberNames : [];
      const code = members.filter((m): m is string => typeof m === 'string').join(', ') || undefined;
      out.push({ code, message });
    }
  }

  const raw = body.errors;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') out.push({ message: item });
      else {
        const r = rec(item);
        if (!r) continue;
        const message = firstString(r.message, r.errorMessage, r.detail, r.description);
        const code = firstString(r.code, r.errorCode, r.target);
        if (message) out.push({ code, message });
        else if (code) out.push({ message: code });
      }
    }
  } else {
    const dict = rec(raw);
    if (dict) {
      for (const [key, value] of Object.entries(dict)) {
        const messages = Array.isArray(value)
          ? value.filter((m): m is string => typeof m === 'string')
          : str(value) ? [value as string] : [];
        for (const message of messages) out.push({ code: key, message });
      }
    }
  }
  return out;
}

/**
 * Pull the useful parts out of an `ApiFailure` whose `details` carry the
 * runtime's response body (merged there by `QuickRunService.parseJsonResponse`
 * next to `httpStatus`). The engine wraps its payload as `{ "error": { … } }`
 * (Aether error format); older / problem-details shapes put the fields at the
 * top level, so both are read.
 */
export function summarizeRuntimeError(error: RuntimeErrorLike): RuntimeErrorSummary {
  const details = error.details ?? {};
  const body = rec(details.error) ?? details;
  const httpStatus =
    typeof details.httpStatus === 'number' ? details.httpStatus
    : typeof body.status === 'number' ? body.status
    : undefined;
  const codeCore = firstString(body.code, body.errorCode, body.type);
  const prefix = str(body.prefix);
  const code = codeCore && prefix && !codeCore.startsWith(`${prefix}:`) ? `${prefix}:${codeCore}` : codeCore;
  const summary = firstString(body.message, body.detail, body.title) ?? error.message;
  return {
    httpStatus,
    code,
    summary,
    lines: extractRuntimeErrorLines(body),
    traceId: firstString(details.traceId, body.traceId, error.traceId),
  };
}

export function RuntimeErrorBanner({ title, error, onDismiss }: RuntimeErrorBannerProps) {
  const { httpStatus, code: runtimeCode, summary, lines, traceId } = summarizeRuntimeError(error);

  return (
    <section
      role="alert"
      aria-live="polite"
      className="mx-2 mt-2 rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-2.5 py-2 text-[11px] text-[var(--vscode-errorForeground)]">
      <div className="flex items-start gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="mt-0.5 shrink-0" aria-hidden="true">
          <path d="M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28 2.28 13h11.44L8 2.28zM8.5 12v-1h-1v1h1zm0-2V6h-1v4h1z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--vscode-foreground)]">
            {title}
            {httpStatus ? ` (HTTP ${httpStatus})` : ''}
            {runtimeCode ? ` · ${runtimeCode}` : ''}
          </p>
          <p className="mt-0.5 break-words text-[var(--vscode-foreground)]">{summary}</p>
          {lines.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[10px] text-[var(--vscode-foreground)]">
              {lines.map((line, i) => (
                <li key={i} className="break-words">
                  {line.code && <code className="mr-1 rounded bg-[var(--vscode-badge-background)] px-1 text-[var(--vscode-badge-foreground)]">{line.code}</code>}
                  {line.message}
                </li>
              ))}
            </ul>
          )}
          {traceId && (
            <p className="mt-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
              traceId: <code className="break-all">{traceId}</code>
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
            aria-label="Dismiss error">
            ✕
          </button>
        )}
      </div>
    </section>
  );
}
