export type PanelLayoutState = Record<string, { size: number; open: boolean }>;

export function clampSize(size: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, size));
}

export function resizeBy(
  state: PanelLayoutState,
  panel: string,
  delta: number,
  bounds: { min: number; max: number },
): PanelLayoutState {
  const current = state[panel];
  if (!current) return state;
  return {
    ...state,
    [panel]: { ...current, size: clampSize(current.size + delta, bounds.min, bounds.max) },
  };
}

/** Parses a persisted layout; only panels present in `defaults` are honoured, bad fields fall back. */
export function parseStoredLayout(raw: string | null, defaults: PanelLayoutState): PanelLayoutState {
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return defaults;
  const stored = parsed as Record<string, unknown>;
  const out: PanelLayoutState = {};
  for (const [panel, fallback] of Object.entries(defaults)) {
    const entry = stored[panel];
    if (typeof entry !== 'object' || entry === null) {
      out[panel] = fallback;
      continue;
    }
    const { size, open } = entry as Record<string, unknown>;
    out[panel] = {
      size: typeof size === 'number' && Number.isFinite(size) ? size : fallback.size,
      open: typeof open === 'boolean' ? open : fallback.open,
    };
  }
  return out;
}
