/**
 * Pure color math — RGB ↔ HSL conversion, hex parse, and HSL delta
 * application. Local copy of the SDK's color utilities until they ship
 * as part of `@burgan-tech/pseudo-ui`'s public API; once exported, this
 * file becomes a thin re-export shim.
 *
 * Pure functions, no side effects, no DOM dependency.
 */

export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

/**
 * Parse a CSS hex color (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) to RGB.
 * Returns null for unparseable input.
 */
export function parseHex(css: string): RGB | null {
  const trimmed = css.trim();
  if (!trimmed.startsWith('#')) return null;
  const hex = trimmed.slice(1);
  let r: number, g: number, b: number;

  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    return null;
  }

  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
}

/** Format RGB back to uppercase hex string. */
export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Convert RGB to HSL. h ∈ [0, 360), s/l ∈ [0, 100]. */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      case bN:
        h = (rN - gN) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/** Convert HSL back to RGB. */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let rN = 0;
  let gN = 0;
  let bN = 0;
  if (h < 60) {
    [rN, gN, bN] = [c, x, 0];
  } else if (h < 120) {
    [rN, gN, bN] = [x, c, 0];
  } else if (h < 180) {
    [rN, gN, bN] = [0, c, x];
  } else if (h < 240) {
    [rN, gN, bN] = [0, x, c];
  } else if (h < 300) {
    [rN, gN, bN] = [x, 0, c];
  } else {
    [rN, gN, bN] = [c, 0, x];
  }
  return {
    r: (rN + m) * 255,
    g: (gN + m) * 255,
    b: (bN + m) * 255,
  };
}

/**
 * Apply an HSL delta to a base color.
 *   - hue wraps modulo 360
 *   - saturation / lightness clamp to [0, 100]
 *
 * The shape mdcRoleMap.json carries for each shade.
 */
export function applyHslDelta(
  base: HSL,
  delta: { hDelta: number; sDelta: number; lDelta: number },
): HSL {
  const h = ((base.h + delta.hDelta) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, base.s + delta.sDelta));
  const l = Math.max(0, Math.min(100, base.l + delta.lDelta));
  return { h, s, l };
}
