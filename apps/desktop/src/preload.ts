/**
 * Electron preload script.
 *
 * Runs in the renderer context with Node.js access but before the page loads.
 * contextIsolation is enabled — every API exposed to the renderer goes
 * through `contextBridge.exposeInMainWorld(...)`.
 *
 * Public surface today (`window.vnextDesktop`):
 *   - `onMenuShortcut(handler)` — subscribe to native-menu-driven shortcut
 *     events (e.g. Cmd+P / Cmd+Shift+F). Returns an unsubscribe function.
 *
 * Why a native-menu round-trip instead of a renderer keyboard listener?
 * Some shortcuts (Cmd+Shift+F, Cmd+R, etc.) are intercepted by Electron's
 * embedded DevTools or Chromium itself before reaching the renderer. Driving
 * them from the OS-level menu accelerator wins consistently and surfaces
 * them in the application menu for discoverability.
 */

import { contextBridge, ipcRenderer } from 'electron';

export type DesktopMenuShortcutId =
  | 'quick-switcher'
  | 'find-in-files'
  | 'insert-snippet'
  | 'toggle-terminal'
  | 'generate-test-data';

const MENU_SHORTCUT_CHANNEL = 'vnext:menu-shortcut';

contextBridge.exposeInMainWorld('vnextDesktop', {
  /**
   * Subscribe to menu-driven shortcuts. The returned function unsubscribes;
   * always call it from your effect's cleanup.
   */
  onMenuShortcut(handler: (id: DesktopMenuShortcutId) => void): () => void {
    const listener = (_event: unknown, id: DesktopMenuShortcutId) => handler(id);
    ipcRenderer.on(MENU_SHORTCUT_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(MENU_SHORTCUT_CHANNEL, listener);
    };
  },
});
