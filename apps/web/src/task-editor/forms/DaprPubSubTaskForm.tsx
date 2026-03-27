import { Field } from '../../components/Field';
import { JsonCodeField } from '../../components/JsonCodeField';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprPubSubTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="PubSub Name">
        <input type="text" value={String(config.pubSubName || '')}
          onChange={(e) => onChange((d: any) => { d.pubSubName = e.target.value; })}
          placeholder="pubsub"
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Topic">
        <input type="text" value={String(config.topic || '')}
          onChange={(e) => onChange((d: any) => { d.topic = e.target.value; })}
          placeholder="my-topic"
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" />
      </Field>
      <Field label="Data (JSON)">
        <JsonCodeField
          value={typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {}, null, 2)}
          onChange={(v) => onChange((d: any) => { try { d.data = JSON.parse(v); } catch { d.data = v; } })}
        />
      </Field>
    </div>
  );
}
