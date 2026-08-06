import { AlertTriangle, ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { Button } from '../../../ui/Button';

export interface FunctionRunInfoErrorProps {
  /** Already tailored to the failure kind by `readInfoExchange`. */
  message: string;
  /** True for a 401/403 on `/info` — see `readInfoExchange`'s discriminator. */
  isAuthorizationError: boolean;
  /** While true, Retry reads as in-flight and is disabled. */
  loading: boolean;
  /** False when the F/I scope ids are not both present — Retry would have nothing to send. */
  canRetry: boolean;
  onRetry: () => void;
  onOpenHeaders: () => void;
}

/**
 * Fix 1: a 403 on `/info` must be visibly recoverable.
 *
 * Rendered above the request tabs whenever `/info` failed (see
 * `FunctionRunShell`, 3e — this no longer replaces the request/response
 * grid, it sits above it, so a 403's own "Open Headers" shortcut has a
 * Headers tab to actually switch into). States the problem (`message`,
 * already worded by `readInfoExchange` to point at the fix for an
 * authorization failure) and puts an explicit Retry control right next to
 * it — the mechanism to recover already existed (headers are in the `/info`
 * effect's dependency array), but nothing on screen said so or gave the user
 * a way to act on it beyond guessing that saving a header would silently
 * refire the request.
 *
 * `isAuthorizationError` additionally surfaces an "Open Headers" shortcut:
 * useful for a 403 (the fix is to configure headers), not for a 404 or a
 * transient 500 (where opening Headers would not help). Driven by the
 * discriminator `readInfoExchange` reports, not by matching `message`'s
 * text — see that function's own doc comment.
 *
 * (3d) Wrapped in `ui/Alert` — previously bare text sitting directly above
 * `FunctionRunAuthzBanner`'s `Alert`-framed banner in the response pane, two
 * different visual languages for the same "something is wrong" message. The
 * variant follows `isAuthorizationError` the same way `FunctionRunAuthzBanner`
 * does (`warning` for a permissions problem), falling back to `destructive`
 * for everything else `/info` can fail with (404, 500, a transport error).
 */
export function FunctionRunInfoError({
  message,
  isAuthorizationError,
  loading,
  canRetry,
  onRetry,
  onOpenHeaders,
}: FunctionRunInfoErrorProps) {
  return (
    <Alert variant={isAuthorizationError ? 'warning' : 'destructive'} className="py-2">
      {isAuthorizationError ? <ShieldAlert aria-hidden /> : <AlertTriangle aria-hidden />}
      <AlertTitle>Could not load the function contract</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="secondary" size="sm" disabled={loading || !canRetry} onClick={onRetry}>
            {loading ? 'Retrying…' : 'Retry'}
          </Button>
          {isAuthorizationError ? (
            <Button variant="ghost" size="sm" onClick={onOpenHeaders}>
              Open Headers
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
