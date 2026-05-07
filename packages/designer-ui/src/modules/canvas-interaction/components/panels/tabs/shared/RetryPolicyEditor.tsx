import type { RetryPolicy, BackoffType } from '@vnext-forge-studio/vnext-types';
import { EditableInput, SelectField } from '../PropertyPanelShared';

interface RetryPolicyEditorProps {
  policy: RetryPolicy;
  onChange: (policy: RetryPolicy) => void;
}

const BACKOFF_OPTIONS = [
  { value: 0, label: 'Fixed' },
  { value: 1, label: 'Exponential' },
] as const;

export function RetryPolicyEditor({ policy, onChange }: RetryPolicyEditorProps) {
  const update = <K extends keyof RetryPolicy>(field: K, value: RetryPolicy[K]) => {
    onChange({ ...policy, [field]: value });
  };

  return (
    <div className="bg-muted-surface rounded-lg border border-border p-2.5 space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground tracking-wide">
        Retry Policy
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
            Max retries
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={policy.maxRetries}
            onChange={(e) => update('maxRetries', Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 tabular-nums"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
            Backoff type
          </label>
          <SelectField
            value={policy.backoffType}
            onChange={(v) => update('backoffType', Number(v) as BackoffType)}
            options={[...BACKOFF_OPTIONS]}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
          Initial delay (ISO 8601)
        </label>
        <EditableInput
          value={policy.initialDelay}
          onChange={(v) => update('initialDelay', v)}
          mono
          placeholder="e.g. PT5S"
        />
      </div>

      {policy.backoffType === 1 && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
            Backoff multiplier
          </label>
          <input
            type="number"
            min={1}
            step={0.5}
            value={policy.backoffMultiplier ?? 2.0}
            onChange={(e) => update('backoffMultiplier', Number(e.target.value) || 2.0)}
            className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 tabular-nums font-mono"
          />
        </div>
      )}

      <div>
        <label className="text-[10px] font-medium text-muted-foreground mb-0.5 block">
          Max delay (ISO 8601)
        </label>
        <EditableInput
          value={policy.maxDelay ?? ''}
          onChange={(v) => update('maxDelay', v || undefined)}
          mono
          placeholder="e.g. PT1M"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={policy.useJitter ?? true}
          onChange={() => update('useJitter', !(policy.useJitter ?? true))}
          className="accent-primary size-3.5 cursor-pointer"
        />
        <span className="text-[10px] text-foreground font-medium">Use jitter</span>
      </label>
    </div>
  );
}
