import { useEffect } from 'react';

import {
  TerminalPanel,
  useGlobalTerminalToggleShortcut,
  useProjectStore,
  useTerminalStore,
} from '@vnext-forge-studio/designer-ui';

import { config } from '../../shared/config/config';

/**
 * Web shell mount for the integrated terminal panel.
 *
 * Resolves the cwd from `useProjectStore.activeProject.path` so every new
 * tab starts in the project root by default. Forwards the SPA's `apiBaseUrl`
 * so the WebSocket builder can target the right host both in vite dev (a
 * different port) and Electron (same origin). Registers the global Ctrl+`
 * shortcut and the native-menu IPC bridge handler for `'toggle-terminal'`.
 *
 * The mount also auto-closes the panel when the active project goes away
 * (project list empty / user signed out / etc.) — leaving an open panel
 * around with no cwd to spawn into would just confuse the user.
 */
export function TerminalMount() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const isOpen = useTerminalStore((s) => s.isOpen);
  const close = useTerminalStore((s) => s.close);

  // Toggle via Ctrl+`; native menu (CmdOrCtrl+`) is handled by the desktop
  // menu shortcut bridge below.
  useGlobalTerminalToggleShortcut({ enabled: !!activeProject });

  // Hide the panel when no project is active — there's no cwd to spawn into.
  useEffect(() => {
    if (!activeProject && isOpen) close();
  }, [activeProject, isOpen, close]);

  // Note: the desktop menu IPC bridge is mounted exactly once by
  // QuickSwitcherMount. Mounting it here too would register a second
  // listener for the same channel, and both copies would call
  // `toggleTerminal()` on every menu event — net effect: panel never
  // toggles. Trust the single subscription.

  return (
    <TerminalPanel
      defaultCwd={activeProject?.path ?? null}
      apiBaseUrl={config.apiBaseUrl || undefined}
    />
  );
}
