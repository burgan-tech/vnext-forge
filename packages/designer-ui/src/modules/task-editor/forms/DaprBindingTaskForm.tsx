import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { parseJsonEditorValue, toJsonEditorValue } from '../TaskEditorSchema';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DaprBindingTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Binding Name">
        <Input type="text" value={String(config.bindingName || '')}
          onChange={(e) => onChange((d: any) => { d.bindingName = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Operation">
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
    </div>
  );
}

