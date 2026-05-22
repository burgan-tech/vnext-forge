import { useCallback } from 'react';

import { type JsonPointer } from '../model/jsonPointer';
import { toggleVNextKey } from '../model/mutators';
import { getNodeAt } from '../model/schemaNode';
import { useSchemaEditorStore } from '../useSchemaEditorStore';

/**
 * Enable/disable a vNext (`x-*`) keyword on the node at `pointer`. Disabling
 * deletes the key; enabling installs `defaultValue()` as the seed value.
 */
export function useVNextEnabled(
  pointer: JsonPointer,
  xKey: string,
  defaultValue: () => unknown,
): { enabled: boolean; toggle: () => void } {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);

  const node = getNodeAt(componentJson, pointer);
  const enabled = !!node && node[xKey] !== undefined;

  const toggle = useCallback(() => {
    updateComponent(toggleVNextKey(pointer, xKey, defaultValue));
  }, [updateComponent, pointer, xKey, defaultValue]);

  return { enabled, toggle };
}
