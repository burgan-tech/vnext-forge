import type { ReactNode } from 'react';

import { isRecord, type Json } from '../agentDocument';
import { NumberField, SelectBox, TextField, ToggleField } from './agentFormPrimitives';

/**
 * Memory and policy editors shared by the `sys-agents` component editor and
 * the AI Agent state tab (where both only override / narrow the component).
 * Each edit reports the whole next object; blank members are dropped and an
 * empty object becomes `undefined`.
 */

function withMember(current: Json, key: string, value: unknown): Json | undefined {
  const next: Json = { ...current };
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function AgentMemoryFields({
  value,
  onChange,
  overrideOfComponent = false,
}: {
  value: unknown;
  onChange: (next: Json | undefined) => void;
  /** State tab: the fields override the component's memory. */
  overrideOfComponent?: boolean;
}) {
  const memory = isRecord(value) ? value : {};
  const set = (key: string, v: unknown) => onChange(withMember(memory, key, v));
  const mode = str(memory.mode);
  const resetOn = Array.isArray(memory.resetOn) ? (memory.resetOn as string[]) : [];
  const toggleReset = (item: string, on: boolean) =>
    set('resetOn', on ? [...resetOn.filter((r) => r !== item), item] : resetOn.filter((r) => r !== item));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <SelectBox
          label="Mode"
          value={mode}
          onChange={(v) => {
            // `key` is only valid with mode "key".
            const next = withMember(memory, 'mode', v) ?? {};
            if (v !== 'key') delete next.key;
            onChange(Object.keys(next).length > 0 ? next : undefined);
          }}
          emptyLabel={overrideOfComponent ? 'Inherit from agent' : 'Default'}
          options={[
            { value: 'none', label: 'None — every entry starts clean' },
            { value: 'state', label: 'State — per instance and state' },
            { value: 'flow', label: 'Flow — shared by the flow’s agent states' },
            { value: 'key', label: 'Key — across instances' },
          ]}
        />
        <SelectBox
          label="Storage"
          value={str(memory.storage)}
          onChange={(v) => set('storage', v)}
          emptyLabel="Default (local)"
          options={[
            { value: 'local', label: 'Local — runtime keeps the messages' },
            { value: 'provider', label: 'Provider — only the conversation id' },
          ]}
        />
      </div>
      {mode === 'key' && (
        <TextField
          label="Key template"
          hint="Required with mode Key. Same {{ … }} placeholders as the prompt template (data., body., instance.id, instance.key, state), e.g. {{ data.customerId }}."
          value={str(memory.key)}
          onChange={(v) => set('key', v)}
          mono
        />
      )}
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Max messages" value={num(memory.maxMessages)} onChange={(v) => set('maxMessages', v)} min={1} />
        <NumberField label="Retention days" value={num(memory.retentionDays)} onChange={(v) => set('retentionDays', v)} min={1} />
        <SelectBox
          label="Compaction"
          value={str(memory.compaction)}
          onChange={(v) => set('compaction', v)}
          emptyLabel="Default (trim)"
          options={[
            { value: 'trim', label: 'Trim oldest' },
            { value: 'summarize', label: 'Summarize oldest' },
          ]}
        />
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">Reset session on</div>
        <ToggleField
          label="Agent version change"
          checked={resetOn.includes('agentVersionChange')}
          onChange={(on) => toggleReset('agentVersionChange', on)}
        />
        <ToggleField
          label="Instructions change"
          checked={resetOn.includes('instructionsChange')}
          onChange={(on) => toggleReset('instructionsChange', on)}
        />
      </div>
    </div>
  );
}

const RETRY_ON = ['429', '5xx', 'timeout'] as const;

export function AgentPolicyFields({
  value,
  onChange,
  narrowing = false,
  footer,
}: {
  value: unknown;
  onChange: (next: Json | undefined) => void;
  /** State tab: a state may only lower the component's budgets. */
  narrowing?: boolean;
  footer?: ReactNode;
}) {
  const policy = isRecord(value) ? value : {};
  const set = (key: string, v: unknown) => onChange(withMember(policy, key, v));
  const retry = isRecord(policy.retry) ? policy.retry : {};
  const setRetry = (key: string, v: unknown) => set('retry', withMember(retry, key, v));
  const retryOn = Array.isArray(retry.on) ? (retry.on as string[]) : [];

  return (
    <div className="space-y-2">
      {narrowing && (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          A state can only lower the agent’s budgets; higher values are capped by the component and the environment.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Max iterations" value={num(policy.maxIterations)} onChange={(v) => set('maxIterations', v)} min={1} />
        <NumberField label="Max tool calls" value={num(policy.maxToolCalls)} onChange={(v) => set('maxToolCalls', v)} min={0} />
        <NumberField label="Max tokens" value={num(policy.maxTokens)} onChange={(v) => set('maxTokens', v)} min={1} />
        <NumberField label="Timeout (s)" value={num(policy.timeoutSeconds)} onChange={(v) => set('timeoutSeconds', v)} min={1} />
        <NumberField label="Tool timeout (s)" value={num(policy.toolTimeoutSeconds)} onChange={(v) => set('toolTimeoutSeconds', v)} min={1} />
        <NumberField label="Tool result chars" value={num(policy.resultMaxChars)} onChange={(v) => set('resultMaxChars', v)} min={1} />
        <NumberField
          label="Max entries"
          hint="State entries before decision.onExhausted is taken."
          value={num(policy.maxEntries)}
          onChange={(v) => set('maxEntries', v)}
          min={1}
        />
        <SelectBox
          label="On provider error"
          value={str(policy.onProviderError)}
          onChange={(v) => set('onProviderError', v)}
          emptyLabel="Default (fallback)"
          options={[
            { value: 'fallback', label: 'Take the fallback transition' },
            { value: 'fault', label: 'Fail the transition (error boundary)' },
          ]}
        />
      </div>
      <div className="border-border-subtle space-y-2 rounded-lg border p-2">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wide">Provider retry</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Max attempts" value={num(retry.maxAttempts)} onChange={(v) => setRetry('maxAttempts', v)} min={1} max={5} />
          <NumberField label="Backoff (ms)" value={num(retry.backoffMs)} onChange={(v) => setRetry('backoffMs', v)} min={0} />
        </div>
        <div className="flex flex-wrap gap-3">
          {RETRY_ON.map((item) => (
            <ToggleField
              key={item}
              label={`Retry on ${item}`}
              checked={retryOn.includes(item)}
              onChange={(on) =>
                setRetry('on', on ? [...retryOn.filter((r) => r !== item), item] : retryOn.filter((r) => r !== item))
              }
            />
          ))}
        </div>
      </div>
      {footer}
    </div>
  );
}
