import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

// ISO-8601 with timezone is the most common starting point for date /
// timestamp fields. Authors can replace it with any other format
// string supported by their UI layer.
const DEFAULT_VALUE = (): string => "yyyy-MM-dd'T'HH:mm:ssXXX";

interface XDisplayFormatCardProps {
  pointer: JsonPointer;
}

/**
 * `x-displayFormat` is a UI format hint (e.g.
 * `yyyy-MM-dd'T'HH:mm:ssXXX`). Persisted shape: non-empty string.
 * Vocab `minLength: 1` is the only constraint; the format string
 * itself is consumed by the rendering layer (no parsing in Forge).
 */
export function XDisplayFormatCard({ pointer }: XDisplayFormatCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-displayFormat', DEFAULT_VALUE);

  const raw = node?.['x-displayFormat'];
  const value = typeof raw === 'string' ? raw : '';

  return (
    <VNextCardShell
      xKey="x-displayFormat"
      title="Display format"
      purpose="UI-facing format hint. Keep non-empty; toggle the card off to remove the annotation."
      enabled={enabled}
      onToggle={toggle}>
      <Field label="Format">
        <Input
          type="text"
          value={value}
          onChange={(event) => {
            updateComponent(setKeyword(pointer, 'x-displayFormat', event.target.value));
          }}
          placeholder="e.g. yyyy-MM-dd'T'HH:mm:ssXXX"
          inputClassName="font-mono text-xs"
        />
      </Field>
    </VNextCardShell>
  );
}
