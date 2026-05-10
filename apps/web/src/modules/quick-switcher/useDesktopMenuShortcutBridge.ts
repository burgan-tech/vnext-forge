import { useEffect } from 'react';

import {
  useProjectStore,
  useQuickSwitcherStore,
  useSnippetsStore,
  useTerminalStore,
  useTestDataStore,
} from '@vnext-forge-studio/designer-ui';

import { useWebShellStore } from '../../app/store/useWebShellStore';

/**
 * Subscribes to the Electron preload bridge (`window.vnextDesktop`) so native
 * menu accelerators dispatch into the same store actions that the in-renderer
 * keyboard listeners use. No-op when the bridge isn't present (vite dev,
 * VS Code webview, etc.) — those shells already have working keyboard paths.
 *
 * The native menu route is the only reliable path for shortcuts that
 * Chromium / DevTools would otherwise consume (notably Cmd+Shift+F → DevTools
 * "Search across sources"). Cmd+P also rides the same channel for
 * consistency / discoverability in the menu.
 */
export function useDesktopMenuShortcutBridge(): void {
  const activeProject = useProjectStore((s) => s.activeProject);
  const requestSearchFocus = useWebShellStore((s) => s.requestSearchFocus);
  const openQuickSwitcher = useQuickSwitcherStore((s) => s.open);
  const openSnippetPicker = useSnippetsStore((s) => s.openPicker);
  const toggleTerminal = useTerminalStore((s) => s.toggle);
  const toggleTestData = useTestDataStore((s) => s.toggle);

  useEffect(() => {
    const api = window.vnextDesktop;
    if (!api) return;

    return api.onMenuShortcut((id) => {
      if (id === 'quick-switcher') {
        if (!activeProject?.id) return;
        openQuickSwitcher(activeProject.id);
      } else if (id === 'find-in-files') {
        if (!activeProject) return;
        requestSearchFocus();
      } else if (id === 'insert-snippet') {
        // Snippets are useful even without an active project (personal scope),
        // so we always open the picker.
        openSnippetPicker({ mode: 'insert' });
      } else if (id === 'toggle-terminal') {
        // The TerminalMount handles "no active project" by closing on its
        // own; toggling is still the right native-menu response so the
        // accelerator stays predictable.
        toggleTerminal();
      } else if (id === 'generate-test-data') {
        // Test-data picker needs a project (it lists project schemas);
        // toggle is no-op without one.
        if (!activeProject?.id) return;
        toggleTestData(activeProject.id);
      }
    });
  }, [
    activeProject,
    openQuickSwitcher,
    requestSearchFocus,
    openSnippetPicker,
    toggleTerminal,
    toggleTestData,
  ]);
}
