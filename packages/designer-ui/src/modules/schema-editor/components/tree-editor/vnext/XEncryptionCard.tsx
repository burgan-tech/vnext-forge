import { Field } from '../../../../../ui/Field';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

const ENCRYPTION_TYPES = ['none', 'transport', 'persisted'] as const;
type EncryptionType = (typeof ENCRYPTION_TYPES)[number];

const DEFAULT_VALUE = (): { type: EncryptionType } => ({ type: 'transport' });

interface XEncryptionCardProps {
  pointer: JsonPointer;
}

/**
 * `x-encryption` documents how the value is protected on the wire and at
 * rest. Persisted shape: `{ type: 'none' | 'transport' | 'persisted' }`.
 */
export function XEncryptionCard({ pointer }: XEncryptionCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-encryption', DEFAULT_VALUE);

  const stored = node?.['x-encryption'];
  const current: EncryptionType =
    stored && typeof stored === 'object' && !Array.isArray(stored) &&
    typeof (stored as Record<string, unknown>).type === 'string' &&
    (ENCRYPTION_TYPES as readonly string[]).includes((stored as Record<string, unknown>).type as string)
      ? ((stored as Record<string, unknown>).type as EncryptionType)
      : 'none';

  return (
    <VNextCardShell
      xKey="x-encryption"
      title="Encryption"
      purpose="Flag this field's protection level so storage and transport pipelines can react."
      enabled={enabled}
      onToggle={toggle}>
      <Field label="Type">
        <Select
          className="h-8 text-xs"
          value={current}
          onChange={(event) => {
            const next = event.target.value as EncryptionType;
            updateComponent(setKeyword(pointer, 'x-encryption', { type: next }));
          }}>
          {ENCRYPTION_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    </VNextCardShell>
  );
}
