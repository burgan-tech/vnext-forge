import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { Checkbox } from '../../../ui/Checkbox';
import { BodyJsonField } from './shared';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

function toPairs(v: unknown) {
  const map = v as Record<string, string> | undefined;
  return map ? Object.entries(map).map(([key, value]) => ({ key, value: String(value) })) : [];
}

export function DaprConversationTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Component Name" required hint="Configured LLM provider, e.g. openai.">
          <Input type="text" value={String(config.componentName || '')}
            onChange={(e) => onChange((d: any) => { d.componentName = e.target.value || undefined; })}
            placeholder="openai" size="sm" inputClassName="font-mono text-xs" />
        </Field>
        <Field label="Context ID" hint="Optional, continues a stateful conversation.">
          <Input type="text" value={String(config.contextId || '')}
            onChange={(e) => onChange((d: any) => { d.contextId = e.target.value || undefined; })}
            size="sm" inputClassName="font-mono text-xs" />
        </Field>
      </div>

      <BodyJsonField
        label="Inputs (JSON)"
        value={config.inputs}
        configKey="inputs"
        onChange={onChange}
      />

      <Field label="Parameters" hint="Provider-specific string parameters (model, maxTokens, …).">
        <KVEditor pairs={toPairs(config.parameters)}
          onChange={(pairs) => onChange((d: any) => {
            d.parameters = pairs.length > 0 ? Object.fromEntries(pairs.map((p) => [p.key, p.value])) : undefined;
          })} />
      </Field>

      <Field label="Metadata" hint="Dapr component metadata.">
        <KVEditor pairs={toPairs(config.metadata)}
          onChange={(pairs) => onChange((d: any) => {
            d.metadata = pairs.length > 0 ? Object.fromEntries(pairs.map((p) => [p.key, p.value])) : undefined;
          })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature" hint="Optional sampling temperature.">
          <Input type="number" step="0.1"
            value={config.temperature == null ? '' : Number(config.temperature)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.temperature = e.target.value !== '' && Number.isFinite(n) ? n : undefined; });
            }}
            size="sm" inputClassName="text-xs" />
        </Field>
        <Field label="Timeout (seconds)">
          <Input type="number" min={1} value={Number(config.timeoutSeconds ?? 30)}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange((d: any) => { d.timeoutSeconds = Number.isFinite(n) ? n : undefined; });
            }}
            size="sm" inputClassName="text-xs" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={config.scrubPII === true}
          onCheckedChange={(v) => onChange((d: any) => { d.scrubPII = v === true ? true : undefined; })}
        />
        Scrub PII from prompts and responses
      </label>
    </div>
  );
}
