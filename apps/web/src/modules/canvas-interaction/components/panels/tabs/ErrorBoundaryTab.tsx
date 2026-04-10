import { getErrorActionLabel, getErrorActionColor } from './PropertyPanelHelpers';
import { Badge, InfoRow } from './PropertyPanelShared';

export function ErrorBoundaryTab({ state }: { state: any }) {
  const eb = state.errorBoundary;
  if (!eb) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-[10px] text-muted-foreground">No error boundary configured</div>
      </div>
    );
  }

  const handlers = eb.handlers || [];

  return (
    <div className="space-y-2">
      {handlers.map((h: any, i: number) => (
        <div key={i} className="border border-border rounded-lg p-2.5 bg-surface space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={getErrorActionColor(h.action)}>{getErrorActionLabel(h.action)}</Badge>
            {h.errorTypes && h.errorTypes.length > 0 && (
              <span className="text-[9px] text-muted-foreground">
                Types: {h.errorTypes.join(', ')}
              </span>
            )}
            {h.errorCodes && h.errorCodes.length > 0 && (
              <span className="text-[9px] text-muted-foreground">
                Codes: {h.errorCodes.join(', ')}
              </span>
            )}
          </div>

          {h.retryPolicy && (
            <div className="bg-muted-surface rounded-md p-2 space-y-0.5">
              <div className="text-[10px] font-medium text-muted-foreground mb-1">Retry Policy</div>
              <InfoRow label="Max Retries" value={String(h.retryPolicy.maxRetries ?? '—')} />
              <InfoRow label="Init. Delay" value={h.retryPolicy.initialDelay || '—'} mono />
              <InfoRow label="Backoff" value={h.retryPolicy.backoffType || '—'} />
              {h.retryPolicy.backoffMultiplier && (
                <InfoRow label="Multiplier" value={String(h.retryPolicy.backoffMultiplier)} />
              )}
              {h.retryPolicy.maxDelay && (
                <InfoRow label="Max Delay" value={h.retryPolicy.maxDelay} mono />
              )}
              {h.retryPolicy.useJitter !== undefined && (
                <InfoRow label="Jitter" value={h.retryPolicy.useJitter ? 'Yes' : 'No'} />
              )}
            </div>
          )}
        </div>
      ))}

      {handlers.length === 0 && (
        <div className="text-[10px] text-muted-foreground py-2">No handlers defined</div>
      )}
    </div>
  );
}
