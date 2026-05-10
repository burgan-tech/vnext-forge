import { useEffect } from 'react';

import { useTestDataStore } from './TestDataStore.js';

export interface TestDataPickerShortcutOptions {
  /** Active projectId; the picker is no-op without one. */
  projectId: string | null;
}

/**
 * Global shortcut for the test-data picker. Two reachable bindings:
 *
 *  - `(Cmd|Ctrl)+Shift+G` — primary, plain letter key (works on every
 *    keyboard layout). Mnemonic: **G**enerate.
 *
 * Capture-phase listener so the shortcut wins against editor-local
 * handlers. No-op when `projectId` is null.
 */
export function useGlobalTestDataPickerShortcut(
  options: TestDataPickerShortcutOptions,
): void {
  const { projectId } = options;
  const toggle = useTestDataStore((s) => s.toggle);

  useEffect(() => {
    if (!projectId) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key === 'g' || e.key === 'G')
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggle(projectId);
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [projectId, toggle]);
}
