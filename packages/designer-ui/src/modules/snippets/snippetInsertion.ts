import { showNotification } from '../../notification/notification-port.js';

import type { Snippet } from './SnippetTypes.js';

/**
 * Shared "insert this snippet" action used by the picker and the sidebar
 * panel. MVP behaviour: copy the body to the system clipboard and surface a
 * toast telling the user to paste with Cmd/Ctrl+V. A future iteration will
 * register the active Monaco editor in a registry and call its native
 * `editor.action.insertSnippet` instead, but the clipboard fallback covers
 * every editor surface (Monaco, raw <textarea>, external apps) for free.
 */
export async function insertSnippetViaClipboard(snippet: Snippet): Promise<void> {
  const text = snippet.body.join('\n');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for environments without the async Clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showNotification({
      kind: 'success',
      message: `Snippet "${snippet.name}" copied. Paste with ${
        navigator.platform.toLowerCase().includes('mac') ? '⌘V' : 'Ctrl+V'
      }.`,
      durationMs: 4000,
    });
  } catch (err) {
    showNotification({
      kind: 'error',
      message: `Could not copy snippet: ${
        err instanceof Error ? err.message : String(err)
      }`,
      durationMs: 6000,
    });
  }
}
