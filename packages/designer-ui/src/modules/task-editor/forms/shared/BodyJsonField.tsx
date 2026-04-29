import { Field } from '../../../../ui/Field';
import { JsonCodeField } from '../../../../ui/JsonCodeField';
import { parseJsonEditorValue, toJsonEditorValue } from '../../TaskEditorSchema';

interface BodyJsonFieldProps {
  label?: string;
  value: unknown;
  configKey?: string;
  onChange: (updater: (draft: any) => void) => void;
}

export function BodyJsonField({ label = 'Body (JSON)', value, configKey = 'body', onChange }: BodyJsonFieldProps) {
  return (
    <Field label={label}>
      <JsonCodeField
        value={toJsonEditorValue(value)}
        onChange={(v) => onChange((draft: any) => { draft[configKey] = parseJsonEditorValue(v); })}
      />
    </Field>
  );
}
