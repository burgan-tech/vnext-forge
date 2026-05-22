import { useEffect, useState } from 'react';

import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaNode } from '../../../hooks/useSchemaNode';

interface NumberFieldInputProps {
  pointer: JsonPointer;
  keyword: string;
  label: string;
  hint?: string;
  min?: number;
  step?: number;
  integerOnly?: boolean;
  className?: string;
}

/**
 * Numeric scalar constraint editor. Empty input removes the keyword
 * entirely (lossless minimal output), non-empty input is parsed as a
 * float and written. NaN keeps the previous value.
 */
export function NumberFieldInput({
  pointer,
  keyword,
  label,
  hint,
  min,
  step,
  integerOnly = false,
  className,
}: NumberFieldInputProps) {
  const { node, mutate } = useSchemaNode(pointer);
  const stored = node?.[keyword];
  const initial = typeof stored === 'number' && Number.isFinite(stored) ? String(stored) : '';
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial);
    setError(null);
  }, [initial]);

  return (
    <Field className={className} label={label} hint={hint} errorMsg={error}>
      <Input
        type="number"
        value={draft}
        min={min}
        step={step ?? (integerOnly ? 1 : undefined)}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next === '') {
            setError(null);
            mutate(setKeyword(pointer, keyword, undefined));
            return;
          }

          const parsed = Number(next);

          if (!Number.isFinite(parsed)) {
            setError('Must be a finite number.');
            return;
          }

          if (integerOnly && !Number.isInteger(parsed)) {
            setError('Must be an integer.');
            return;
          }

          setError(null);
          mutate(setKeyword(pointer, keyword, parsed));
        }}
      />
    </Field>
  );
}
