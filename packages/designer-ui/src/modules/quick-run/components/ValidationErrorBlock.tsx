import { useState } from 'react';

import { CopyableJsonBlock } from './CopyableJsonBlock';

interface ValidationErrorBlockProps {
  message: string;
  details?: Record<string, unknown>;
}

export function ValidationErrorBlock({ message, details }: ValidationErrorBlockProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  const detail = typeof details?.detail === 'string' ? details.detail : null;
  const errors = details?.errors as Record<string, string[]> | undefined;
  const errorCode = typeof details?.errorCode === 'string' ? details.errorCode : null;
  const traceId = typeof details?.traceId === 'string' ? details.traceId : null;
  const hasFieldErrors = errors && Object.keys(errors).length > 0;

  return (
    <div className="mt-3 flex flex-col gap-2 rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-xs">
      <p className="font-medium text-[var(--vscode-errorForeground)]">
        {detail ?? message}
      </p>

      {hasFieldErrors && (
        <div className="flex flex-col gap-1">
          {Object.entries(errors).map(([field, msgs]) => (
            <div key={field} className="flex flex-col gap-0.5 pl-2 border-l-2 border-[var(--vscode-errorForeground)]">
              <span className="font-semibold text-[var(--vscode-foreground)]">{field}</span>
              {(Array.isArray(msgs) ? msgs : [String(msgs)]).map((m, i) => (
                <span key={i} className="text-[var(--vscode-errorForeground)]">{m}</span>
              ))}
            </div>
          ))}
        </div>
      )}

      {(errorCode || traceId || details) && (
        <details
          open={debugOpen}
          onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
            Debug Info
          </summary>
          <div className="mt-1 flex flex-col gap-1 text-[10px]">
            {errorCode && (
              <div className="flex gap-1">
                <span className="font-semibold text-[var(--vscode-descriptionForeground)]">Error Code:</span>
                <span className="font-mono">{errorCode}</span>
              </div>
            )}
            {traceId && (
              <div className="flex gap-1">
                <span className="font-semibold text-[var(--vscode-descriptionForeground)]">Trace ID:</span>
                <span className="font-mono break-all">{traceId}</span>
              </div>
            )}
            {details && (
              <CopyableJsonBlock value={details} />
            )}
          </div>
        </details>
      )}
    </div>
  );
}
