import { Field } from './Field.js';
import { Textarea } from './Textarea.js';

/** A ScriptCode carrying an inline Dynamic Expresso expression. */
export interface DynamicExpressoValue {
  location: 'dynamicExpresso';
  code: string;
  encoding?: 'B64' | 'NAT' | 'REF';
}

interface DynamicExpressoFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  value: DynamicExpressoValue | undefined;
  onChange: (next: DynamicExpressoValue | undefined) => void;
}

/**
 * Edits a lightweight inline Dynamic Expresso expression stored as a ScriptCode
 * of shape { location: 'dynamicExpresso', code, encoding: 'NAT' }. An empty
 * expression collapses the whole value to undefined so it drops out of the JSON.
 */
export function DynamicExpressoField({
  label,
  hint,
  required,
  placeholder,
  value,
  onChange,
}: DynamicExpressoFieldProps) {
  return (
    <Field label={label} hint={hint} required={required}>
      <Textarea
        value={value?.code ?? ''}
        onChange={(e) => {
          const code = e.target.value;
          onChange(code ? { location: 'dynamicExpresso', code, encoding: 'NAT' } : undefined);
        }}
        placeholder={placeholder ?? 'e.g. "customer:" + context.Headers.customerId'}
        className="min-h-16 font-mono text-xs"
      />
    </Field>
  );
}
