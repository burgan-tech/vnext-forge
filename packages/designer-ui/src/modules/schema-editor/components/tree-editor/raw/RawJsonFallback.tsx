import { useEffect, useMemo, useState } from 'react';

import { Field } from '../../../../../ui/Field';
import { JsonCodeField } from '../../../../../ui/JsonCodeField';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';

interface RawJsonFallbackProps {
  pointer: JsonPointer;
  keyword: string;
  label?: string;
  hint?: string;
  height?: number;
}

/**
 * Monaco-backed editor for a single keyword's value on a node. Used as a
 * fallback for keywords the new editor does not yet render with first-class
 * UI (e.g. `if/then/else`, `$ref`, vendor `x-*` keywords we do not know).
 *
 * Invalid JSON is kept locally until it parses; the underlying schema is
 * only mutated on successful parse, so unknown content can never be lost
 * silently.
 */
export function RawJsonFallback({
  pointer,
  keyword,
  label,
  hint,
  height = 160,
}: RawJsonFallbackProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);

  const initialValue = useMemo(() => {
    const current = node?.[keyword];
    return current === undefined ? '' : JSON.stringify(current, null, 2);
  }, [node, keyword]);

  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialValue);
    setError(null);
  }, [initialValue]);

  return (
    <Field label={label ?? keyword} hint={hint} errorMsg={error}>
      <JsonCodeField
        value={draft}
        height={height}
        onChange={(value) => {
          setDraft(value);

          if (value.trim() === '') {
            setError(null);
            updateComponent(setKeyword(pointer, keyword, undefined));
            return;
          }

          try {
            const parsed: unknown = JSON.parse(value);
            setError(null);
            updateComponent(setKeyword(pointer, keyword, parsed));
          } catch {
            setError('Value must be valid JSON.');
          }
        }}
      />
    </Field>
  );
}
