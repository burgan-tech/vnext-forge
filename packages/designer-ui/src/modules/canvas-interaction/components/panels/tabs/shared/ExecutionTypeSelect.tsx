import type { ExecutionType } from '@vnext-forge-studio/vnext-types';

import { SchemaFeatureHint } from '../../../../../role-grants/SchemaFeatureHint';
import { useSchemaFeature } from '../../../../../role-grants/useSchemaFeature';

const OPTIONS: Array<{ value: '' | ExecutionType; label: string }> = [
  { value: '', label: 'Inherit (caller ?sync=)' },
  { value: 'S', label: 'Sync (S)' },
  { value: 'A', label: 'Async (A)' },
];

interface ExecutionTypeSelectProps {
  value: ExecutionType | undefined;
  onChange: (value: ExecutionType | undefined) => void;
  /** 'flow' explains the flow-level default; 'transition' the per-transition override. */
  scope: 'flow' | 'transition';
  /** Workflow-schema capability path, e.g. `definitions.transition.executionType`. */
  featurePath: string;
  className?: string;
}

/**
 * `executionType` (runtime 0.0.99 / vnext-schema 0.0.55): S blocks and returns
 * the full instance, A runs in the background. Overrides the caller's
 * `?sync=`; a transition's value wins over the flow's.
 */
export function ExecutionTypeSelect({ value, onChange, scope, featurePath, className }: ExecutionTypeSelectProps) {
  const { supported, schemaVersion } = useSchemaFeature('workflow', featurePath);
  // On an older project schema the field stays visible but locked; a value
  // already in the file can still be cleared.
  const locked = !supported && value === undefined;
  const options =
    scope === 'transition' ? OPTIONS.map((o) => (o.value === '' ? { ...o, label: 'Inherit (flow, else ?sync=)' } : o)) : OPTIONS;
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">Execution mode</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as ExecutionType | undefined)}
        className={className}
        disabled={locked}
        aria-label="Execution mode">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {!supported && <SchemaFeatureHint feature="Execution mode (executionType)" schemaVersion={schemaVersion} />}
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
        {scope === 'flow'
          ? 'Default for every transition of this flow; a transition may override it. Overrides the caller’s ?sync=.'
          : 'Overrides the flow default and the caller’s ?sync=. Ignored for automatic transitions.'}
      </p>
    </div>
  );
}
