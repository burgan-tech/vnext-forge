import { useEffect } from 'react';

import { useTerminalStore } from './TerminalStore.js';

export interface TerminalToggleShortcutOptions {
  /** Disable the listener while no project is active (no cwd to spawn from). */
  enabled?: boolean;
}

/**
 * Global "toggle integrated terminal" shortcut. Two bindings to maximize
 * reach across keyboard layouts and platforms:
 *
 *  - `Ctrl + \`` — VS Code's canonical "Toggle Terminal" everywhere. Works
 *    on US layouts; harder to reach on Turkish Q / AZERTY where the
 *    backtick is a dead key behind AltGr.
 *  - `(Cmd|Ctrl) + J` — VS Code's "Toggle Panel". Plain letter key, always
 *    reachable regardless of layout.
 *
 * Capture-phase listener so the shortcut wins against editor-local handlers.
 * No-op when `enabled` is false (host shell decides — typically when no
 * project is active).
 */
export function useGlobalTerminalToggleShortcut(
  options: TerminalToggleShortcutOptions = {},
): void {
  const { enabled = true } = options;
  const toggle = useTerminalStore((s) => s.toggle);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent): void {
      // Ctrl+` (no Meta/Alt/Shift) — primary binding.
      const isCtrlBacktick =
        e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === '`';
      // (Cmd|Ctrl)+J — letter-key fallback. We accept either modifier so
      // macOS users who hit Cmd+J and Linux/Win users who hit Ctrl+J both
      // work without a per-platform branch in product code.
      const isModJ =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === 'j' || e.key === 'J');
      if (isCtrlBacktick || isModJ) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled, toggle]);
}
