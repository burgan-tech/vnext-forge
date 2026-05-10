import { useEffect } from 'react';

import { useQuickSwitcherStore } from './QuickSwitcherStore.js';

export interface QuickSwitcherShortcutOptions {
  /**
   * Active project id. The shortcut is a no-op while this is null/undefined
   * — the user has no project context to search inside.
   */
  projectId: string | null | undefined;
  /** Default true; pass false to disable (e.g. while another modal is open). */
  enabled?: boolean;
}

/**
 * Registers a single global Cmd+P (macOS) / Ctrl+P (Win/Linux) listener that
 * opens the Quick Switcher palette for the active project. Toggles open ↔
 * closed when pressed repeatedly.
 *
 * The default browser print dialog is suppressed (Cmd+P) since the designer
 * doesn't expect users to print workflow JSON. We do not capture in input
 * fields the way a context-sensitive shortcut would — instead we capture
 * unconditionally because Cmd+P is global navigation, not editing.
 */
export function useGlobalQuickSwitcherShortcut(options: QuickSwitcherShortcutOptions): void {
  const { projectId, enabled = true } = options;
  const open = useQuickSwitcherStore((s) => s.open);
  const close = useQuickSwitcherStore((s) => s.close);
  const isOpen = useQuickSwitcherStore((s) => s.isOpen);

  useEffect(() => {
    if (!enabled || !projectId) return;

    function handler(e: KeyboardEvent) {
      // The shortcut is Cmd+P on macOS, Ctrl+P elsewhere. We accept either
      // modifier without distinguishing platform — this matches VS Code.
      const isComboKey = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      if (!isComboKey) return;
      if (e.key !== 'p' && e.key !== 'P') return;
      e.preventDefault();
      e.stopPropagation();
      if (isOpen) {
        close();
      } else if (projectId) {
        open(projectId);
      }
    }

    // capture: true so we win over input handlers that might also listen to p
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled, projectId, open, close, isOpen]);
}
