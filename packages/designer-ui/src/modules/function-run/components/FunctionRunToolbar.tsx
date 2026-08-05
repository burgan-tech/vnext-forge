import type { FunctionScope, FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';

export interface FunctionRunToolbarProps {
  verbs: readonly FunctionVerb[];
  verb: FunctionVerb | null;
  onVerbChange: (verb: FunctionVerb) => void;
  canInvoke: boolean;
  /** Shown next to a disabled Invoke; null when it is enabled. */
  invokeDisabledReason: string | null;
  invoking: boolean;
  onInvoke: () => void;
  onOpenHeaders: () => void;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
  onScopeIdsChange: (next: { workflowKey: string; instanceId: string }) => void;
  /** Free-text query string, e.g. `a=1&b=2`. Available for every verb. */
  queryString: string;
  onQueryStringChange: (next: string) => void;
}

/**
 * Verb selector, Invoke, Headers, the query-string input, and — for
 * F/I-scoped functions — the workflow/instance identifiers the invoke path
 * needs to build its route.
 *
 * Presentational only: it holds no state and owns no dialog. `onOpenHeaders`
 * is a signal to the shell, which owns `HeadersConfigDialog`. The runner
 * owns Invoke, not any input view rendered alongside it, so this toolbar is
 * where the action always lives regardless of which input mode is active.
 *
 * The query-string field lives here, not in the input pane: it applies to
 * the request itself regardless of mode or verb (a POST can legitimately
 * carry both a body and query parameters), so it belongs with the other
 * request-level controls rather than with the payload.
 */
export function FunctionRunToolbar({
  verbs,
  verb,
  onVerbChange,
  canInvoke,
  invokeDisabledReason,
  invoking,
  onInvoke,
  onOpenHeaders,
  scope,
  workflowKey,
  instanceId,
  onScopeIdsChange,
  queryString,
  onQueryStringChange,
}: FunctionRunToolbarProps) {
  const invokeDisabled = !canInvoke || invoking;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={verb ?? ''}
          onChange={(e) => onVerbChange(e.target.value as FunctionVerb)}
          aria-label="HTTP verb"
          className="w-24 text-xs">
          {verbs.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>

        <Button variant="secondary" size="sm" disabled={invokeDisabled} onClick={onInvoke}>
          {invoking ? 'Invoking…' : 'Invoke'}
        </Button>

        {/* Never a silently disabled control — say why right next to it. */}
        {!canInvoke && invokeDisabledReason ? (
          <span className="text-muted-foreground text-[10px]">{invokeDisabledReason}</span>
        ) : null}

        <Button variant="default" size="sm" onClick={onOpenHeaders}>
          Headers
        </Button>
      </div>

      <Field label="Query string" className="min-w-40">
        <Input
          size="sm"
          placeholder="a=1&b=2"
          aria-label="Query string"
          value={queryString}
          onChange={(e) => onQueryStringChange(e.target.value)}
        />
      </Field>

      {scope !== 'D' ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Workflow key" className="min-w-40 flex-1">
            <Input
              size="sm"
              value={workflowKey}
              onChange={(e) => onScopeIdsChange({ workflowKey: e.target.value, instanceId })}
            />
          </Field>
          <Field label="Instance id" className="min-w-40 flex-1">
            <Input
              size="sm"
              value={instanceId}
              onChange={(e) => onScopeIdsChange({ workflowKey, instanceId: e.target.value })}
            />
          </Field>
          <span className="text-muted-foreground w-full text-[10px]">
            A {scope}-scoped function runs against a workflow instance.
          </span>
        </div>
      ) : null}
    </div>
  );
}
