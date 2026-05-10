/**
 * Type declaration for the Electron preload bridge exposed at
 * `window.vnextDesktop`. Mirrors `apps/desktop/src/preload.ts` —
 * keep both files in sync.
 *
 * Web SPA mode (`pnpm dev` against vite) does not have this object;
 * consumers must guard with `if (window.vnextDesktop) { ... }` so the
 * same code path works in both shells.
 */

declare global {
  type VnextDesktopMenuShortcutId =
    | 'quick-switcher'
    | 'find-in-files'
    | 'insert-snippet'
    | 'toggle-terminal'
    | 'generate-test-data';

  interface VnextDesktopBridge {
    /**
     * Subscribe to native-menu-driven shortcuts (Cmd+P "Go to Anything…",
     * Cmd+Shift+F "Find in Files…"). Returns an unsubscribe function — call
     * it from the effect's cleanup.
     */
    onMenuShortcut(handler: (id: VnextDesktopMenuShortcutId) => void): () => void;
  }

  interface Window {
    vnextDesktop?: VnextDesktopBridge;
  }
}

export {};
