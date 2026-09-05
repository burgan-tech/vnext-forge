/**
 * Surfaces a runtime (vNext engine) failure that reached the webview as an
 * `ApiFailure`. `QuickRunService.parseJsonResponse` merges the runtime's
 * non-2xx body into `error.details` next to `httpStatus`, so a 400 from the
 * fail-closed instance query validator arrives with its machine-readable
 * sub-codes (`filter.unknownOperator`, `sort.invalidJson`, …) and correction
 * hints. This banner renders those instead of a bare "Runtime returned HTTP 400".
 *
 * Tolerant of the two body shapes the engine emits: the `Error` record
 * (`code`, `message`, `errors[]`) and RFC 7807 problem details (`title`,
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

interface DetailLine {
  code?: string;
  message: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return undefined;
}

/** Normalise `errors` from either an array of objects/strings or an RFC 7807 dictionary. */
export function extractRuntimeErrorLines(details: Record<string, unknown> | undefined): DetailLine[] {
  const raw = details?.errors;
  if (!raw) return [];
  const out: DetailLine[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') out.push({ message: item });
      else if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const message = firstString(rec.message, rec.errorMessage, rec.detail, rec.description);
        const code = firstString(rec.code, rec.errorCode, rec.target);
        if (message) out.push({ code, message });
        else if (code) out.push({ message: code });
      }
    }
    return out;
  }
  if (typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const messages = Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : [str(value)].filter(Boolean) as string[];
      for (const message of messages) out.push({ code: key, message });
    }
  }
  return out;
}

export function RuntimeErrorBanner({ title, error, onDismiss }: RuntimeErrorBannerProps) {
  const details = error.details ?? {};
  const httpStatus = typeof details.httpStatus === 'number' ? details.httpStatus : typeof details.status === 'number' ? details.status : undefined;
  const runtimeCode = firstString(details.code, details.errorCode, details.type);
  const summary = firstString(details.message, details.detail, details.title) ?? error.message;
  const lines = extractRuntimeErrorLines(details);
  const traceId = firstString(details.traceId, error.traceId);

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
