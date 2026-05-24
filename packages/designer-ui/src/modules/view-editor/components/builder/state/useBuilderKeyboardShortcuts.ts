/**
 * R13: global keyboard shortcuts for the builder.
 *
 * Mounted by the `PseudoUiBuilder` shell so the handlers are alive
 * whenever the Builder tab is the active view-editor tab and the
 * shell is in the DOM.
 *
 * Shortcuts (mod = Cmd on macOS, Ctrl elsewhere):
 *   Delete / Backspace  → delete selected node
 *   mod + D             → duplicate selected node
 *   mod + Z             → undo
 *   mod + Shift + Z     → redo
 *   mod + Y             → redo (Windows-ish alternative)
 *   Escape              → clear selection
 *
 * The handler bails out when the focus is inside an editable element
 * (Input / Textarea / Select / contenteditable), including elements
 * inside the canvas shadow DOM. We use `composedPath()` to walk both
 * the light DOM and the open shadow tree so typing in the Inspector or
 * a future inline-edit field never triggers a destructive shortcut.
 */

import { useEffect } from 'react';

import { type BuilderStore } from './builderStore';

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function eventOriginatesFromEditable(e: KeyboardEvent): boolean {
  if (isEditableElement(e.target)) return true;
  // Walk composedPath so shadow-DOM inputs (canvas form fields) also count.
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  for (const node of path) {
    if (isEditableElement(node as EventTarget)) return true;
  }
  return false;
}

export function useBuilderKeyboardShortcuts(store: BuilderStore, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent): void => {
      if (eventOriginatesFromEditable(e)) return;

      const mod = e.metaKey || e.ctrlKey;
      const state = store.getState();
      const sel = state.selectedPath;
      const hasSelection = sel != null && sel.length > 0;

      const key = e.key;
      const lowerKey = key.toLowerCase();

      // Undo / Redo
      if (mod && lowerKey === 'z') {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && lowerKey === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      // Duplicate
      if (mod && lowerKey === 'd' && hasSelection) {
        e.preventDefault();
        state.duplicateNode(sel!);
        return;
      }

      // Delete
      if ((key === 'Delete' || key === 'Backspace') && hasSelection) {
        e.preventDefault();
        state.deleteNode(sel!);
        return;
      }

      // Clear selection
      if (key === 'Escape' && sel != null) {
        e.preventDefault();
        state.selectNode(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, enabled]);
}
