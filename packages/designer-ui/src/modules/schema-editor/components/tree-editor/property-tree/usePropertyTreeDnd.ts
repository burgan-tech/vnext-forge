import { useState, type DragEvent } from 'react';

import { type JsonPointer } from '../../../model/jsonPointer';
import { movePropToIndex } from '../../../model/mutators';
import { getNodeAt, getPropertyKeys } from '../../../model/schemaNode';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';

const MIME = 'application/x-vnext-schema-property';

interface DragPayload {
  parentPointer: JsonPointer;
  propertyKey: string;
}

interface UsePropertyTreeDndArgs {
  parentPointer: JsonPointer;
  propertyKey: string;
}

interface UsePropertyTreeDndResult {
  dragProps: {
    draggable: true;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  dropProps: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  /** True while this specific row is the active drop target. */
  isDropTarget: boolean;
}

/**
 * Native HTML5 drag-and-drop for reordering siblings inside the same
 * `properties` map. Cross-parent moves are intentionally not supported
 * in v1 — the drop is rejected when source and target parents differ.
 */
export function usePropertyTreeDnd({
  parentPointer,
  propertyKey,
}: UsePropertyTreeDndArgs): UsePropertyTreeDndResult {
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const [isDropTarget, setIsDropTarget] = useState(false);

  function onDragStart(event: DragEvent<HTMLElement>) {
    const payload: DragPayload = { parentPointer, propertyKey };
    event.dataTransfer.setData(MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setIsDropTarget(false);
  }

  function readPayload(event: DragEvent<HTMLElement>): DragPayload | null {
    const raw = event.dataTransfer.getData(MIME);

    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).parentPointer === 'string' &&
        typeof (parsed as Record<string, unknown>).propertyKey === 'string'
      ) {
        return parsed as DragPayload;
      }
    } catch {
      // ignore
    }

    return null;
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    // dataTransfer.types is read-only and case-insensitive across browsers.
    if (!event.dataTransfer.types.includes(MIME)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  }

  function onDragLeave() {
    setIsDropTarget(false);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    setIsDropTarget(false);

    const payload = readPayload(event);

    if (payload?.parentPointer !== parentPointer) {
      return;
    }

    if (payload.propertyKey === propertyKey) {
      return;
    }

    event.preventDefault();

    const componentJson = useSchemaEditorStore.getState().componentJson;
    const parent = getNodeAt(componentJson, parentPointer);
    const keys = getPropertyKeys(parent);
    const fromIndex = keys.indexOf(payload.propertyKey);
    const targetIndex = keys.indexOf(propertyKey);

    if (fromIndex < 0 || targetIndex < 0) {
      return;
    }

    // Insert "before" semantics: moving down means landing at targetIndex-1
    // (because the source is removed first). Moving up keeps targetIndex.
    const toIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;

    updateComponent(movePropToIndex(parentPointer, payload.propertyKey, toIndex));
  }

  return {
    dragProps: { draggable: true, onDragStart, onDragEnd },
    dropProps: { onDragOver, onDragLeave, onDrop },
    isDropTarget,
  };
}
