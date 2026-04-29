import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { KVEditor } from '../../../ui/KeyValueEditor';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { parseJsonEditorValue, toJsonEditorValue } from '../TaskEditorSchema';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprBindingTaskForm({ config, onChange }: Props) {
  const metadata = config.metadata as Record<string, string> | undefined;
  const metadataPairs = metadata
    ? Object.entries(metadata).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-3">
      <Field label="Binding Name" required>
        <Input type="text" value={String(config.bindingName || '')}
          onChange={(e) => onChange((d: any) => { d.bindingName = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Operation" required>
        <Input type="text" value={String(config.operation || '')}
          onChange={(e) => onChange((d: any) => { d.operation = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Data (JSON)">
        <JsonCodeField
          value={toJsonEditorValue(config.data)}
          onChange={(value) => onChange((draft: any) => { draft.data = parseJsonEditorValue(value); })}
        />
      </Field>
      <Field label="Metadata">
        <KVEditor
          pairs={metadataPairs}
          onChange={(pairs) => onChange((d: any) => {
            d.metadata = pairs.length > 0
              ? Object.fromEntries(pairs.map((p) => [p.key, p.value]))
              : undefined;
          })}
        />
      </Field>
    </div>
  );
}
