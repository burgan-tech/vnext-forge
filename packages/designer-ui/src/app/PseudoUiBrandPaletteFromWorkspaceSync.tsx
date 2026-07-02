/**
 * Headless component that mounts `useBrandPaletteFromWorkspace`.
 *
 * The hook must run inside a real React mount so its effect cleanup runs
 * on unmount. Calling it directly inside `DesignerUiProvider` would tie
 * it to the provider's lifetime regardless of which shell consumes it;
 * wrapping it in a dedicated component keeps the concern isolated.
 */
import { useBrandPaletteFromWorkspace } from './useBrandPaletteFromWorkspace.js';

export function PseudoUiBrandPaletteFromWorkspaceSync() {
  useBrandPaletteFromWorkspace();
  return null;
}
