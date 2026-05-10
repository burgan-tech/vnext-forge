import { useEffect } from 'react';

import { useProjectStore } from '@vnext-forge-studio/designer-ui';

import { useWebShellStore } from '../../app/store/useWebShellStore';

/**
 * Global Cmd+Shift+F (macOS) / Ctrl+Shift+F (Win/Linux) shortcut.
 *
 * Opens the sidebar Search panel, switches to it, and asks the panel's input
 * to grab focus and select its current contents. No-op while no project is
 * active — there is nothing to search.
 *
 * Mounted alongside Cmd+P (`useGlobalQuickSwitcherShortcut`). The combo is
 * captured in the capture phase so it wins over input-level handlers.
 */
export function useGlobalContentSearchShortcut(): void {
  const activeProject = useProjectStore((s) => s.activeProject);
  const requestSearchFocus = useWebShellStore((s) => s.requestSearchFocus);

  useEffect(() => {
    if (!activeProject) return;

    function handler(e: KeyboardEvent) {
      const isComboKey = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
      if (!isComboKey) return;
      if (e.key !== 'f' && e.key !== 'F') return;
      e.preventDefault();
      e.stopPropagation();
      requestSearchFocus();
    }

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [activeProject, requestSearchFocus]);
}
