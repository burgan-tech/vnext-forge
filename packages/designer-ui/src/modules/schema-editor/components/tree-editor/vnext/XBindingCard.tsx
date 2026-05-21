import { Field } from '../../../../../ui/Field';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

const BINDING_OPTIONS = ['', 'required', 'optional'] as const;
const DEFAULT_VALUE = (): string => 'required';

interface XBindingCardProps {
  pointer: JsonPointer;
}

/**
 * `x-binding` controls whether a nested component (referenced via the
 * schema) requires the parent to bind a value. Persisted values:
 * `"required"`, `"optional"`, or `""` (unset on intent).
 */
export function XBindingCard({ pointer }: XBindingCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-binding', DEFAULT_VALUE);
  const current = typeof node?.['x-binding'] === 'string' ? node['x-binding'] : '';

  return (
    <VNextCardShell
      xKey="x-binding"
      title="Parent binding"
      purpose="When this node represents a nested component, declare whether the parent must bind a value."
      enabled={enabled}
      onToggle={toggle}>
      <Field label="Binding requirement">
        <Select
          className="h-8 text-xs"
          value={current}
          onChange={(event) => {
            updateComponent(setKeyword(pointer, 'x-binding', event.target.value));
          }}>
          {BINDING_OPTIONS.map((option) => (
            <option key={option || 'unset'} value={option}>
              {option === '' ? '(unset)' : option}
            </option>
          ))}
        </Select>
      </Field>
    </VNextCardShell>
  );
}
