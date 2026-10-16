import type { HistoryMode } from '@vnext-forge-studio/vnext-types';

import { SchemaFeatureHint, SCHEMA_0_0_56 } from '../../../../../role-grants/SchemaFeatureHint';
import { useSchemaFeature } from '../../../../../role-grants/useSchemaFeature';

interface HistoryModeSelectProps {
  value: HistoryMode | undefined;
  /** `undefined` removes the attribute (`full` is the default). */
  onChange: (value: HistoryMode | undefined) => void;
  className?: string;
}

/**
 * Workflow `attributes.history` (runtime 0.0.100 / vnext-schema 0.0.56).
 * `none` makes a one-shot flow: no transition or task history, instance data
 * written once at Finish, a SubFlow handoff or a fault.
 */
export function HistoryModeSelect({ value, onChange, className }: HistoryModeSelectProps) {
  const { supported, schemaVersion } = useSchemaFeature('workflow', 'attributes.history');
  const locked = !supported && value === undefined;
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">History</label>
      <select
        value={value ?? 'full'}
        onChange={(e) => onChange(e.target.value === 'none' ? 'none' : undefined)}
        className={className}
        disabled={locked}
        aria-label="History">
        <option value="full">Full (default)</option>
        <option value="none">None — one-shot flow</option>
      </select>
      {!supported && (
        <SchemaFeatureHint feature="History mode (history)" schemaVersion={schemaVersion} minimum={SCHEMA_0_0_56} />
      )}
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
        {value === 'none'
          ? 'No transition or task history is recorded and instance data is written once (at Finish, a SubFlow handoff or a fault). The flow must be all-automatic and always finish.'
          : 'Every transition, task and data version is recorded.'}
      </p>
    </div>
  );
}
