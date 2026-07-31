import { Field } from '../../../ui/Field.js';
import { Input } from '../../../ui/Input.js';
import { toDisplayText } from './readonlyText.js';

interface ReadOnlyValueFieldProps {
  label: string;
  value: unknown;
  mono?: boolean;
  placeholder?: string;
}

/**
 * Field+Input in quiet read-only (FormReadOnlyContext supplies readOnly).
 * Must be rendered inside `<FormReadOnlyProvider>`; otherwise the controls
 * appear editable.
 */
export function ReadOnlyValueField({ label, value, mono, placeholder }: ReadOnlyValueFieldProps) {
  const text = toDisplayText(value);
  return (
    <Field label={label}>
      <Input
        value={text}
        onChange={() => undefined}
        placeholder={placeholder ?? '—'}
        size="sm"
        className={mono ? 'font-mono' : undefined}
      />
    </Field>
  );
}
