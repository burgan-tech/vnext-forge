/**
 * Derive a "MDC hex → brand hex" replacement map from a PseudoColorPalette.
 *
 * Reads `mdcRoleMap.json` (the decoded PrimeReact MDC theme structure)
 * and applies each shade's HSL delta to the brand's anchor for that
 * role. Result: a flat record mapping every MDC hex to the
 * brand-equivalent hex.
 *
 * This lets a brand JSON repaint PrimeReact's static MDC theme without
 * any hardcoded color in the codebase. Every output flows from the
 * brand JSON anchors.
 */

import type { PseudoColorPalette } from '@burgan-tech/pseudo-ui';

import { parseHex, rgbToHsl, hslToRgb, rgbToHex, applyHslDelta, type HSL } from './colorMath.js';
import mdcRoleMap from './mdcRoleMap.json';

type Role =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  | 'surface'
  | 'onSurface';

interface ShadeEntry {
  hex: string;
  hDelta: number;
  sDelta: number;
  lDelta: number;
}

interface RoleEntry {
  anchor: string;
  anchorHsl: [number, number, number];
  shades: ShadeEntry[];
}

interface RoleMap {
  $description?: string;
  $version?: string;
  roles: Record<Role, RoleEntry>;
}

const ROLE_MAP = mdcRoleMap as unknown as RoleMap;

/**
 * Pluck the right anchor color from the palette for a given role.
 * Status colors (success/warning/info) default to the palette's own
 * defaults (Material baselines) when the brand JSON doesn't override.
 */
function getBrandAnchor(palette: PseudoColorPalette, role: Role): string {
  switch (role) {
    case 'primary':
      return palette.primary;
    case 'secondary':
      return palette.secondary;
    case 'error':
      return palette.error;
    case 'success':
      return palette.success;
    case 'warning':
      return palette.warning;
    case 'info':
      return palette.info;
    case 'surface':
      return palette.surface;
    case 'onSurface':
      return palette.onSurface;
  }
}

/**
 * Convert a hex string to HSL. Returns null if unparseable so callers
 * can skip gracefully instead of throwing.
 */
function hexToHsl(hex: string): HSL | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb);
}

/**
 * Build the replacement map. Keys are MDC hex strings (lowercase +
 * uppercase variants both included), values are brand-equivalent hex
 * strings.
 *
 * Lowercase + uppercase: MDC theme CSS contains both `#3F51B5` and
 * `#3f51b5`. Including both in the map lets the consumer do a plain
 * substring replace without regex flags.
 */
export function derivePrimeReactReplacements(
  palette: PseudoColorPalette,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const roleName of Object.keys(ROLE_MAP.roles) as Role[]) {
    const role = ROLE_MAP.roles[roleName];
    const brandHex = getBrandAnchor(palette, roleName);
    const brandHsl = hexToHsl(brandHex);
    if (!brandHsl) continue;

    // 1) Anchor itself: MDC anchor → brand anchor (both cases)
    const mdcAnchorLc = role.anchor.toLowerCase();
    const mdcAnchorUc = role.anchor.toUpperCase();
    const brandAnchorUc = brandHex.toUpperCase();
    out[mdcAnchorLc] = brandAnchorUc;
    out[mdcAnchorUc] = brandAnchorUc;

    // 2) Each shade: apply the HSL delta from the brand anchor
    for (const shade of role.shades) {
      const targetHsl = applyHslDelta(brandHsl, shade);
      const targetRgb = hslToRgb(targetHsl);
      const targetHex = rgbToHex(targetRgb);
      const shadeLc = shade.hex.toLowerCase();
      const shadeUc = shade.hex.toUpperCase();
      out[shadeLc] = targetHex;
      out[shadeUc] = targetHex;
    }
  }

  return out;
}
