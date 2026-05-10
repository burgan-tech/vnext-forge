/**
 * Subscription helper for native-menu-driven shortcuts exposed by the
 * Electron preload bridge (see `apps/desktop/src/preload.ts`).
 *
 * In the web SPA running in a normal browser tab, `window.vnextDesktop` is
 * undefined and `subscribeDesktopMenuShortcut` returns a no-op cleanup.
 *
 * In the Electron desktop shell, the preload script populates the global so
 * the renderer can react to OS-level menu accelerators (Cmd+P, Cmd+Shift+F,
 * …) that would otherwise be swallowed by DevTools or Chromium itself.
 */

export type DesktopMenuShortcutId = 'quick-switcher' | 'find-in-files';

interface DesktopBridge {
  onMenuShortcut(handler: (id: DesktopMenuShortcutId) => void): () => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    vnextDesktop?: DesktopBridge;
  }
}

export function subscribeDesktopMenuShortcut(
  handler: (id: DesktopMenuShortcutId) => void,
): () => void {
  const bridge = typeof window !== 'undefined' ? window.vnextDesktop : undefined;
  if (!bridge) return () => undefined;
  return bridge.onMenuShortcut(handler);
}
