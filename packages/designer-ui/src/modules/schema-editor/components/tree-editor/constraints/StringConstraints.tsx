import { useEffect, useState } from 'react';

import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { NumberFieldInput } from './NumberFieldInput';

export const STRING_FORMATS = [
  '',
  'email',
  'uri',
  'url',
  'uuid',
  'hostname',
  'ipv4',
  'ipv6',
  'date',
  'date-time',
  'time',
  'phone',
  'iban',
] as const;

interface StringConstraintsProps {
  pointer: JsonPointer;
}

/**
 * Constraint editors that apply to `type: "string"` (and absent-type strings):
 * minLength, maxLength, pattern, format.
 */
export function StringConstraints({ pointer }: StringConstraintsProps) {
  const { node, mutate } = useSchemaNode(pointer);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberFieldInput
        pointer={pointer}
        keyword="minLength"
        label="minLength"
        hint="Minimum number of characters."
        min={0}
      />
      <NumberFieldInput
        pointer={pointer}
        keyword="maxLength"
        label="maxLength"
        hint="Maximum number of characters."
        min={0}
      />

      <Field
        className="sm:col-span-2"
        label="pattern"
        hint="ECMA-262 regular expression source (no slashes).">
        <PatternInput
          value={typeof node?.pattern === 'string' ? node.pattern : ''}
          onChange={(next) => {
            mutate(setKeyword(pointer, 'pattern', next === '' ? undefined : next));
          }}
        />
      </Field>

      <Field
        className="sm:col-span-2"
        label="format"
        hint="Standard JSON Schema format hint.">
        <Select
          className="h-8 text-xs"
          value={typeof node?.format === 'string' ? node.format : ''}
          onChange={(event) => {
            const value = event.target.value;
            mutate(setKeyword(pointer, 'format', value === '' ? undefined : value));
          }}>
          {STRING_FORMATS.map((format) => (
            <option key={format || 'none'} value={format}>
              {format || '(none)'}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

interface PatternInputProps {
  value: string;
  onChange: (next: string) => void;
}

function PatternInput({ value, onChange }: PatternInputProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <>
      <Input
        type="text"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next === '') {
            setError(null);
          } else {
            try {
              new RegExp(next);
              setError(null);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Invalid regular expression.');
            }
          }

          onChange(next);
        }}
        placeholder="^[a-z]+$"
        inputClassName="font-mono text-sm"
      />
      {error ? <span className="mt-1 block text-[10px] text-destructive-text">{error}</span> : null}
    </>
  );
}
