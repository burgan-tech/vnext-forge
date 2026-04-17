import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { parseJsonEditorValue, toJsonEditorValue } from '../TaskEditorSchema';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprPubSubTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="PubSub Name">
        <Input type="text" value={String(config.pubSubName || '')}
          onChange={(e) => onChange((d: any) => { d.pubSubName = e.target.value; })}
          placeholder="pubsub"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Topic">
        <Input type="text" value={String(config.topic || '')}
          onChange={(e) => onChange((d: any) => { d.topic = e.target.value; })}
          placeholder="my-topic"
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Data (JSON)">
        <JsonCodeField
          value={toJsonEditorValue(config.data)}
          onChange={(value) => onChange((draft: any) => { draft.data = parseJsonEditorValue(value); })}
        />
      </Field>
    </div>
  );
}

