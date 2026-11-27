import { Field } from './Field.js';
import { ExpressionTextarea } from './ExpressionInput.js';
import type { SlotSurface } from '../modules/expressions/expressionCatalog.js';

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
  /** Expression surface for highlighting and suggestions; defaults to `'key'` (cache and lock keys). */
  surface?: SlotSurface;
  /** Workflow master schema, when the caller already holds it, for `data.` member suggestions. */
  schemaRoot?: unknown;
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
  surface = 'key',
  schemaRoot,
}: DynamicExpressoFieldProps) {
  return (
    <Field label={label} hint={hint} required={required}>
      <ExpressionTextarea
        mode="expression"
        surface={surface}
        schemaRoot={schemaRoot}
        value={value?.code ?? ''}
        onChange={(code) => onChange(code ? { location: 'dynamicExpresso', code, encoding: 'NAT' } : undefined)}
        placeholder={placeholder ?? 'e.g. "customer:" + context.Headers.customerId'}
        ariaLabel={label}
        minRows={3}
        className="min-h-16 font-mono text-xs"
      />
    </Field>
  );
}
