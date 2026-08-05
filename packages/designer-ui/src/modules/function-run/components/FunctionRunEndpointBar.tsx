import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../ui/Button';
import { Select } from '../../../ui/Select';

export interface FunctionRunEndpointBarProps {
  verbs: readonly FunctionVerb[];
  verb: FunctionVerb | null;
  onVerbChange: (verb: FunctionVerb) => void;
  /** The resolved (or best-effort fallback) request path — see `buildEndpointPreview`. */
  endpoint: string;
  canInvoke: boolean;
  /** Shown next to a disabled Send; null when it is enabled. */
  invokeDisabledReason: string | null;
  invoking: boolean;
  onInvoke: () => void;
  onOpenHeaders: () => void;
}

/**
 * The runner's single most API-client-like element: verb, the resolved
 * endpoint, and the action that fires the request — one horizontal bar,
 * always visible, never empty.
 *
 * Replaces `FunctionRunToolbar`'s former first row. Send is the primary
 * action (`variant="default"`, this package's actual "solid/primary" look —
 * there is no `variant="primary"` in `ui/Button`); Headers is intentionally
 * quieter (`variant="ghost"`) now that it is no longer the loudest control on
 * the bar. `FunctionRunToolbar` keeps the scope-id fields and the
 * query-string input for now (a later task moves them into request tabs).
 */
export function FunctionRunEndpointBar({
  verbs,
  verb,
  onVerbChange,
  endpoint,
  canInvoke,
  invokeDisabledReason,
  invoking,
  onInvoke,
  onOpenHeaders,
}: FunctionRunEndpointBarProps) {
  const invokeDisabled = !canInvoke || invoking;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={verb ?? ''}
        onChange={(e) => onVerbChange(e.target.value as FunctionVerb)}
        aria-label="HTTP verb"
        className="w-24 shrink-0 text-xs">
        {verbs.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>

      <span
        className="border-border bg-muted text-foreground min-w-0 flex-1 truncate rounded border px-2 py-1 font-mono text-[11px]"
        title={endpoint}>
        {endpoint}
      </span>

      <Button variant="ghost" size="sm" onClick={onOpenHeaders}>
        Headers
      </Button>

      <Button variant="default" size="sm" disabled={invokeDisabled} onClick={onInvoke}>
        {invoking ? 'Invoking…' : 'Send'}
      </Button>

      {/* Never a silently disabled control — say why right next to it. */}
      {!canInvoke && invokeDisabledReason ? (
        <span className="text-muted-foreground w-full text-[10px]">{invokeDisabledReason}</span>
      ) : null}
    </div>
  );
}
