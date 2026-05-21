import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

const DEFAULT_VALUE = (): LocalizedTextMap => ({ en: '' });

interface XLabelsCardProps {
  pointer: JsonPointer;
}

function toLocalizedTextMap(value: unknown): LocalizedTextMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: LocalizedTextMap = {};

  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') {
      out[key] = val;
    }
  }

  return out;
}

/**
 * `x-labels` provides per-language labels for the field. Renderers swap
 * the property name for the matching label entry. Persisted shape:
 * `{ [langCode]: string }`.
 */
export function XLabelsCard({ pointer }: XLabelsCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-labels', DEFAULT_VALUE);
  const value = toLocalizedTextMap(node?.['x-labels']);

  return (
    <VNextCardShell
      xKey="x-labels"
      title="Field labels"
      purpose="Per-language labels rendered instead of the raw property key."
      enabled={enabled}
      onToggle={toggle}>
      <LocalizedTextMapEditor
        label="Labels"
        value={value}
        onChange={(next) => {
          updateComponent(setKeyword(pointer, 'x-labels', next));
        }}
      />
    </VNextCardShell>
  );
}
