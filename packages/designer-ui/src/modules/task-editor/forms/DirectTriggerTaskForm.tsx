import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { parseJsonEditorValue, toJsonEditorValue } from '../TaskEditorSchema';

interface Props { config: Record<string, unknown>; onChange: (updater: (draft: any) => void) => void; }

export function DirectTriggerTaskForm({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Field label="Domain">
        <Input type="text" value={String(config.domain || '')}
          onChange={(e) => onChange((d: any) => { d.domain = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Flow">
        <Input type="text" value={String(config.flow || '')}
          onChange={(e) => onChange((d: any) => { d.flow = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Transition Name">
        <Input type="text" value={String(config.transitionName || '')}
          onChange={(e) => onChange((d: any) => { d.transitionName = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Instance ID">
        <Input type="text" value={String(config.instanceId || '')}
          onChange={(e) => onChange((d: any) => { d.instanceId = e.target.value; })}
          size="sm"
          inputClassName="font-mono text-xs" />
      </Field>
      <Field label="Body (JSON)">
        <JsonCodeField
          value={toJsonEditorValue(config.body)}
          onChange={(value) => onChange((draft: any) => { draft.body = parseJsonEditorValue(value); })}
        />
      </Field>
    </div>
  );
}

