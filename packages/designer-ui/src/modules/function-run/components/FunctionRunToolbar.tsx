import type { FunctionScope } from '@vnext-forge-studio/vnext-types';

import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

export interface FunctionRunToolbarProps {
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
  onScopeIdsChange: (next: { workflowKey: string; instanceId: string }) => void;
  /** Free-text query string, e.g. `a=1&b=2`. Available for every verb. */
  queryString: string;
  onQueryStringChange: (next: string) => void;
}

/**
 * The query-string input and — for F/I-scoped functions — the
 * workflow/instance identifiers the invoke path needs to build its route.
 *
 * The verb select, Send, and Headers moved to `FunctionRunEndpointBar`
 * (this toolbar's former first row — see that component's doc comment).
 * What remains here is request-shaping input that a later task (request
 * tabs) will relocate again; this toolbar is not being deleted in the
 * meantime, just narrowed to what it now owns.
 *
 * The query-string field lives here, not in the input pane: it applies to
 * the request itself regardless of mode or verb (a POST can legitimately
 * carry both a body and query parameters), so it belongs with the other
 * request-level controls rather than with the payload.
 */
export function FunctionRunToolbar({
  scope,
  workflowKey,
  instanceId,
  onScopeIdsChange,
  queryString,
  onQueryStringChange,
}: FunctionRunToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
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
