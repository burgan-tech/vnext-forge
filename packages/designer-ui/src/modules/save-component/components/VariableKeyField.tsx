import { toVariableName, variableKeyError } from '../taskSlots';

interface VariableKeyFieldProps {
  value: string | undefined;
  /** The entry's task key — its camelCase form is the default slot. */
  taskKey: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
}

/**
 * `variableKey` of a task entry (runtime 0.0.99 / vnext-schema 0.0.55): the
 * response slot the task writes to. Needed when one task runs twice at the
 * same order (those run in parallel).
 */
export function VariableKeyField({ value, taskKey, onChange, className }: VariableKeyFieldProps) {
  const error = value ? variableKeyError(value) : null;
  const fallback = taskKey ? toVariableName(taskKey) : '';
  return (
    <div className={className}>
      <label className="text-muted-foreground text-[10px] font-semibold mb-0.5 block">Response variable</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={fallback ? `${fallback} (default)` : 'variableKey'}
        aria-label="Response variable (variableKey)"
        aria-invalid={error ? true : undefined}
        className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-lg bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:bg-surface transition-all placeholder:text-subtle ${
          error ? 'border-destructive-border' : 'border-border focus:border-primary-border'
        }`}
      />
      {error ? (
        <p className="mt-0.5 text-[10px] text-destructive-text">{error}</p>
      ) : (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Slot this task's response is stored under. Set it when the same task runs twice at one order.
        </p>
      )}
    </div>
  );
}
