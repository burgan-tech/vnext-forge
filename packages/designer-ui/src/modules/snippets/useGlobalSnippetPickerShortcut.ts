import { useEffect } from 'react';

import { useSnippetsStore } from './SnippetsStore.js';

export interface SnippetPickerShortcutOptions {
  /** Optional language hint passed to the picker (filters by `language`). */
  languageHint?: string | null;
  /** Default true; pass false to disable in modes where shortcuts conflict. */
  enabled?: boolean;
}

/**
 * Cmd+Shift+S (mac) / Ctrl+Shift+S (win/linux) → open the snippet picker in
 * insert mode. Capture phase so it wins over input-level shift-S handlers.
 *
 * Pairs with the native menu accelerator (`apps/desktop/src/menu.ts` →
 * "Insert Snippet…") for the desktop shell. The keydown path is the fallback
 * for the vite dev SPA and the VS Code webview.
 */
export function useGlobalSnippetPickerShortcut(
  options: SnippetPickerShortcutOptions = {},
): void {
  const { languageHint = null, enabled = true } = options;
  const openPicker = useSnippetsStore((s) => s.openPicker);
  const closePicker = useSnippetsStore((s) => s.closePicker);
  const isOpen = useSnippetsStore((s) => s.pickerOpen);

  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      const isCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey;
      if (!isCombo) return;
      if (e.key !== 's' && e.key !== 'S') return;
      e.preventDefault();
      e.stopPropagation();
      if (isOpen) {
        closePicker();
      } else {
        openPicker({ mode: 'insert', languageHint });
      }
    }
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled, languageHint, openPicker, closePicker, isOpen]);
}
