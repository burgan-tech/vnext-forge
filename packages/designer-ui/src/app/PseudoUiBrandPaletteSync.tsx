/**
 * Brand JSON → tenant tokens bridge.
 *
 * Reads the raw brand JSON string from `useSettingsStore.pseudoUiBrandPalette`,
 * runs it through the SDK's `JsonPalette.fromJson()` → `paletteToCssVars()`
 * chain, and feeds the resulting `--p-*` CSS variable map into the tenant
 * tokens slot of the store. Shadow DOM injection in `PseudoUiPseudoViewFrame`
 * picks them up via cascade Layer 3.
 *
 * Backwards compatible: when brand palette is `null` the tenant tokens are
 * left untouched and the URL/local-file tenant CSS path keeps working.
 *
 * Error handling: a malformed JSON or palette-conversion failure clears
 * tenant tokens (baseline fallback) and is reported via `console.warn`.
 * The component never throws — render stays alive.
 */
import { useEffect } from 'react';

import { JsonPalette, paletteToCssVars } from '@burgan-tech/pseudo-ui';

import { useSettingsStore } from '../store/useSettingsStore.js';

/**
 * Mount-and-forget component. Renders nothing — applies side effects on the
 * settings store. Mount under `DesignerUiProvider`.
 */
export function PseudoUiBrandPaletteSync() {
  const brandPalette = useSettingsStore((s) => s.pseudoUiBrandPalette);
  const setTenantTokens = useSettingsStore((s) => s.setPseudoUiTenantTokens);

  useEffect(() => {
    if (!brandPalette) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(brandPalette);
    } catch (err) {
      console.warn('[BrandPaletteSync] Invalid JSON, falling back:', err);
      setTenantTokens(null);
      return;
    }

    try {
      const palette = JsonPalette.fromJson(parsed);
      const cssVars = paletteToCssVars(palette);
      setTenantTokens(cssVars);
    } catch (err) {
      console.warn('[BrandPaletteSync] Palette conversion failed:', err);
      setTenantTokens(null);
    }
  }, [brandPalette, setTenantTokens]);

  return null;
}
