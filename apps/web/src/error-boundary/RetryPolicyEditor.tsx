import { Field } from '../components/Field';

interface RetryPolicyEditorProps {
  policy: any;
  onChange: (updater: (draft: any) => void) => void;
}

export function RetryPolicyEditor({ policy, onChange }: RetryPolicyEditorProps) {
  return (
    <div className="border border-border rounded p-2 space-y-2 bg-muted/20">
      <div className="text-[10px] font-medium text-muted-foreground">Retry Policy</div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Max Retries">
          <input
            type="number"
            value={Number(policy.maxRetries || 3)}
            onChange={(e) => onChange((d) => { d.maxRetries = Number(e.target.value); })}
            min={1}
            max={100}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Initial Delay (ms)">
          <input
            type="number"
            value={Number(policy.initialDelay || 1000)}
            onChange={(e) => onChange((d) => { d.initialDelay = Number(e.target.value); })}
            min={100}
            step={100}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Backoff Type">
          <select
            value={String(policy.backoffType || 'exponential')}
            onChange={(e) => onChange((d) => { d.backoffType = e.target.value; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          >
            <option value="fixed">Fixed</option>
            <option value="linear">Linear</option>
            <option value="exponential">Exponential</option>
          </select>
        </Field>
        <Field label="Backoff Multiplier">
          <input
            type="number"
            value={Number(policy.backoffMultiplier || 2)}
            onChange={(e) => onChange((d) => { d.backoffMultiplier = Number(e.target.value); })}
            min={1}
            step={0.5}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Max Delay (ms)">
          <input
            type="number"
            value={Number(policy.maxDelay || 30000)}
            onChange={(e) => onChange((d) => { d.maxDelay = Number(e.target.value); })}
            min={1000}
            step={1000}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          />
        </Field>
        <Field label="Use Jitter">
          <select
            value={policy.useJitter === false ? 'false' : 'true'}
            onChange={(e) => onChange((d) => { d.useJitter = e.target.value === 'true'; })}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
