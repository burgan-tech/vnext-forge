import { Plus } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { type ArrayCompositionKeyword } from '../../../model/compositionKeywords';
import { appendPointer, parsePointer, type JsonPointer } from '../../../model/jsonPointer';
import {
  addCompositionItem,
  moveCompositionItem,
  removeCompositionItem,
} from '../../../model/mutators';
import { type SchemaNode } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { SubschemaCard } from './SubschemaCard';

interface CompositionListProps {
  /** Pointer of the parent node that holds the array keyword. */
  pointer: JsonPointer;
  /** Which composition keyword this list edits. */
  keyword: ArrayCompositionKeyword;
}

/**
 * Editor for an array-valued composition keyword (`allOf`, `anyOf`, `oneOf`).
 * Items are reorderable and removable; clicking an item opens it in the
 * detail panel via push-to-pane navigation. Removing the last item deletes
 * the keyword entirely (handled by the mutator), keeping the saved JSON
 * minimal.
 */
export function CompositionList({ pointer, keyword }: CompositionListProps) {
  const { node, mutate } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const stored = node?.[keyword];
  const items: unknown[] = Array.isArray(stored) ? stored : [];

  function addItem() {
    mutate(addCompositionItem(pointer, keyword, {}));
  }

  function removeItem(index: number) {
    mutate(removeCompositionItem(pointer, keyword, index));
  }

  function move(index: number, delta: number) {
    mutate(moveCompositionItem(pointer, keyword, index, delta));
  }

  function cloneItem(index: number) {
    updateComponent((draft) => {
      const parentNode = descendSchemaDraft(draft, pointer);

      if (!parentNode) {
        return;
      }

      const arr = parentNode[keyword];

      if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
        return;
      }

      const source: unknown = arr[index];
      // structuredClone keeps nested keys (including x-* extensions) intact.
      arr.splice(index + 1, 0, structuredClone(source));
    });
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-primary-border/60 bg-primary-muted/30 px-3 py-2 text-[10px] text-primary-text/55">
          No {keyword} subschemas yet.
        </p>
      ) : (
        items.map((_, index) => {
          const itemPointer = appendPointer(pointer, keyword, index);

          return (
            <SubschemaCard
              key={`${keyword}-${index}`}
              pointer={itemPointer}
              label={`${keyword}[${index}]`}
              canMove
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onClone={() => cloneItem(index)}
              onRemove={() => removeItem(index)}
            />
          );
        })
      )}

      <Button
        type="button"
        variant="success"
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={addItem}>
        <Plus size={10} />
        Add {keyword} subschema
      </Button>
    </div>
  );
}

/**
 * Descend the schema sub-tree of `draft` to `pointer`. Inline helper used by
 * `cloneItem` so the mutator can run a structuredClone in-place without
 * exposing the private `descendDraft` from `mutators.ts`.
 */
function descendSchemaDraft(
  draft: Record<string, unknown>,
  pointer: JsonPointer,
): SchemaNode | null {
  const attributes = draft.attributes;

  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return null;
  }

  const schema = (attributes as Record<string, unknown>).schema;

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return null;
  }

  let current: unknown = schema;
  const segments = parsePointer(pointer);

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return null;
  }

  return current && typeof current === 'object' && !Array.isArray(current)
    ? (current as SchemaNode)
    : null;
}
