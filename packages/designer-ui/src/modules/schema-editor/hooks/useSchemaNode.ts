import { useCallback } from 'react';

import { type JsonPointer } from '../model/jsonPointer';
import { getNodeAt, type SchemaNode } from '../model/schemaNode';
import { type SchemaUpdater } from '../model/mutators';
import { useSchemaEditorStore } from '../useSchemaEditorStore';

/**
 * Read the schema node at `pointer`, plus a `mutate` callback that funnels
 * any `SchemaUpdater` through the editor store (so undo/redo + dirty
 * tracking work uniformly).
 */
export function useSchemaNode(pointer: JsonPointer): {
  node: SchemaNode | null;
  mutate: (updater: SchemaUpdater) => void;
} {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);

  const node = getNodeAt(componentJson, pointer);

  const mutate = useCallback(
    (updater: SchemaUpdater) => {
      updateComponent(updater);
    },
    [updateComponent],
  );

  return { node, mutate };
}
