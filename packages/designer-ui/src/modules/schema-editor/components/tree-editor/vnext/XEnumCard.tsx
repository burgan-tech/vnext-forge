import { LocalizedTextMapEditor, type LocalizedTextMap } from '../../../../../ui/LocalizedTextMapEditor';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

interface XEnumCardProps {
  pointer: JsonPointer;
}

type EnumLabelMap = Record<string, LocalizedTextMap>;

const DEFAULT_VALUE = (): EnumLabelMap => ({});

function enumValuesOf(node: Record<string, unknown> | null): string[] {
  if (!node || !Array.isArray(node.enum)) {
    return [];
  }

  return node.enum.map((entry): string => {
    if (typeof entry === 'string') {
      return entry;
    }

    try {
      return JSON.stringify(entry);
    } catch {
      return String(entry);
    }
  });
}

function toEnumLabelMap(value: unknown): EnumLabelMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: EnumLabelMap = {};

  for (const [enumValue, labels] of Object.entries(value)) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
      continue;
    }

    const map: LocalizedTextMap = {};

    for (const [lang, text] of Object.entries(labels as Record<string, unknown>)) {
      if (typeof text === 'string') {
        map[lang] = text;
      }
    }

    out[enumValue] = map;
  }

  return out;
}

/**
 * `x-enum` maps each enum value to per-language labels rendered in
 * dropdowns and radio groups. Only enabled when the node's `enum`
 * keyword is set; the shell's toggle is disabled otherwise to prevent
 * orphan labels.
 */
export function XEnumCard({ pointer }: XEnumCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-enum', DEFAULT_VALUE);

  const enumValues = enumValuesOf(node);
  const hasEnum = enumValues.length > 0;
  const map = toEnumLabelMap(node?.['x-enum']);

  function updateLabelsFor(value: string, next: LocalizedTextMap) {
    const newMap = { ...map };

    if (Object.keys(next).length === 0) {
      delete newMap[value];
    } else {
      newMap[value] = next;
    }

    updateComponent(setKeyword(pointer, 'x-enum', newMap));
  }

  return (
    <VNextCardShell
      xKey="x-enum"
      title="Enum value labels"
      purpose="Per-language display text for each enum value."
      enabled={enabled}
      onToggle={toggle}
      toggleDisabled={!hasEnum && !enabled}
      toggleDisabledReason="Add enum values in the General tab first.">
      {hasEnum ? (
        <div className="space-y-3">
          {enumValues.map((value) => (
            <div key={value} className="rounded-md border border-primary-border/60 bg-primary-muted/40 p-2">
              <p className="mb-1.5 font-mono text-[11px] font-semibold">{value}</p>
              <LocalizedTextMapEditor
                label="Labels"
                value={map[value] ?? {}}
                onChange={(next) => updateLabelsFor(value, next)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-primary-text/55">
          Add enum values to this node (General tab → Enum values) to label them.
        </p>
      )}
    </VNextCardShell>
  );
}
