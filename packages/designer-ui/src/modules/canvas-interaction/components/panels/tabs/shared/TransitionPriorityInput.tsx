import { DEFAULT_AUTO_TRANSITION_PRIORITY } from '@vnext-forge-studio/vnext-types';

import { SCHEMA_0_0_58, SchemaFeatureHint } from '../../../../../role-grants/SchemaFeatureHint';
import { useSchemaFeature } from '../../../../../role-grants/useSchemaFeature';

interface TransitionPriorityInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
}

/**
 * Automatic transition `priority` (runtime 0.0.102 / vnext-schema 0.0.58).
 * Lower runs first; empty means the runtime default, which is never written
 * into the JSON.
 */
export function TransitionPriorityInput({ value, onChange, className }: TransitionPriorityInputProps) {
  const { supported, schemaVersion } = useSchemaFeature('workflow', 'definitions.transition.priority');
  // On an older project schema the field stays visible but locked; a value
  // already in the file can still be cleared.
  const locked = !supported && value === undefined;
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block" htmlFor="transition-priority">
        Priority
      </label>
      <input
        id="transition-priority"
        type="number"
        min={1}
        step={1}
        placeholder={`${DEFAULT_AUTO_TRANSITION_PRIORITY} (default)`}
        value={value ?? ''}
        disabled={locked}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const n = Math.trunc(Number(raw));
          onChange(Number.isFinite(n) && n >= 1 ? n : undefined);
        }}
        className={className}
        aria-label="Priority"
      />
      {!supported && <SchemaFeatureHint feature="Automatic transition priority" schemaVersion={schemaVersion} minimum={SCHEMA_0_0_58} />}
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
        Lower values are evaluated first; equal values keep declaration order. The default transition always runs last.
      </p>
    </div>
  );
}
