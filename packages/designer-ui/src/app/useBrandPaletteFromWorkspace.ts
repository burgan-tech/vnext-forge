/**
 * Workspace-disk source of truth for the brand JSON.
 *
 * VS Code renders each panel in its own webview iframe — separate JS runtime,
 * separate `localStorage`, separate Zustand store. A `setPseudoUiBrandPalette`
 * call in one panel never reaches another. The shared resource across panels
 * is the extension host (Node), reachable through `files/read`/`files/write`.
 * Storing the brand on disk and letting every webview read it (and listen
 * for fs-events) keeps panels in sync without any cross-webview messaging.
 *
 * Per-webview flow:
 *   1. Mount → if an active project exists, read
 *      `<project>/.vnext-forge/brand.json` and push it into
 *      `useSettingsStore.pseudoUiBrandPalette`.
 *   2. `subscribeWorkspaceFsChange` listener re-reads on writes/deletes
 *      that touch the brand file.
 *
 * Idempotent: assumes one active project and one brand file. Falls back to
 * `null` (legacy tenant CSS) when the file is missing or unreadable.
 */
import { useEffect } from 'react';

import { readOptionalFile } from '../modules/project-workspace/WorkspaceApi.js';
import { useProjectStore } from '../store/useProjectStore.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { subscribeWorkspaceFsChange } from '../workspace-fs-events/index.js';

/** Brand JSON path, workspace-relative. */
export const BRAND_PALETTE_FILE_RELATIVE = '.vnext-forge/brand.json';

/** Build the absolute brand file path for a given workspace folder. */
export function buildBrandPaletteFilePath(projectPath: string): string {
  const trimmed = projectPath.replace(/[\\/]+$/, '');
  return `${trimmed}/${BRAND_PALETTE_FILE_RELATIVE}`;
}

/**
 * Returns true when the fs-event paths touch the brand file or one of its
 * ancestors (so `mkdir .vnext-forge` triggers a re-read too).
 */
function eventTouchesBrandFile(eventPaths: readonly string[], brandFilePath: string): boolean {
  const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const target = normalize(brandFilePath);
  for (const raw of eventPaths) {
    const p = normalize(raw);
    if (p === target) return true;
    if (target.startsWith(`${p}/`)) return true;
  }
  return false;
}

/**
 * Mount-and-forget hook. Auto re-reads on active-project changes and on
 * relevant fs-events.
 */
export function useBrandPaletteFromWorkspace(): void {
  const activeProjectPath = useProjectStore((s) => s.activeProject?.path ?? null);
  const setBrandPalette = useSettingsStore((s) => s.setPseudoUiBrandPalette);

  useEffect(() => {
    if (!activeProjectPath) {
      setBrandPalette(null);
      return;
    }

    const brandFilePath = buildBrandPaletteFilePath(activeProjectPath);
    let cancelled = false;

    async function reload() {
      try {
        const result = await readOptionalFile(brandFilePath);
        if (cancelled) return;
        if (!result) {
          setBrandPalette(null);
          return;
        }
        const trimmed = result.content.trim();
        setBrandPalette(trimmed.length === 0 ? null : trimmed);
      } catch (err) {
        if (cancelled) return;
        console.warn('[BrandPaletteFromWorkspace] read failed:', err);
        setBrandPalette(null);
      }
    }

    void reload();

    const unsubscribe = subscribeWorkspaceFsChange((event) => {
      if (!eventTouchesBrandFile(event.paths, brandFilePath)) return;
      void reload();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectPath, setBrandPalette]);
}
