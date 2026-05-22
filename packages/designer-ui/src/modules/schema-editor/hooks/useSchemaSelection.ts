import { useCallback } from 'react';
import { create } from 'zustand';

import { resolveOrAncestor, ROOT_POINTER, type JsonPointer } from '../model/jsonPointer';
import { getSchemaRoot } from '../model/schemaNode';
import { useSchemaEditorStore } from '../useSchemaEditorStore';

/**
 * Path-based selection for the new schema tree editor. Holds a single
 * schema-relative JSON Pointer (e.g. `/properties/status/allOf/0`). Selection
 * is not persisted to disk.
 */
interface SchemaSelectionState {
  pointer: JsonPointer;
  setPointer: (pointer: JsonPointer) => void;
  reset: () => void;
}

export const useSchemaSelectionStore = create<SchemaSelectionState>((set) => ({
  pointer: ROOT_POINTER,
  setPointer: (pointer) => set({ pointer }),
  reset: () => set({ pointer: ROOT_POINTER }),
}));

/**
 * Resolved selection: returns the stored pointer when it still addresses a
 * value in the current schema, otherwise the closest resolvable ancestor.
 */
export function useResolvedSelection(): JsonPointer {
  const stored = useSchemaSelectionStore((s) => s.pointer);
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const root = getSchemaRoot(componentJson);

  if (!root) {
    return ROOT_POINTER;
  }

  return resolveOrAncestor(root, stored);
}

export function useSetSelection(): (pointer: JsonPointer) => void {
  const setPointer = useSchemaSelectionStore((s) => s.setPointer);
  return useCallback((pointer: JsonPointer) => setPointer(pointer), [setPointer]);
}
