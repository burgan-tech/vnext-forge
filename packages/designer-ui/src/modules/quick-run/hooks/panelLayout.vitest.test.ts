import { describe, expect, it } from 'vitest';

import { clampSize, parseStoredLayout, resizeBy, type PanelLayoutState } from './panelLayout';

const defaults: PanelLayoutState = {
  right: { size: 320, open: true },
  bottom: { size: 200, open: false },
};

describe('panelLayout', () => {
  it('clamps sizes into [min, max]', () => {
    expect(clampSize(50, 100, 400)).toBe(100);
    expect(clampSize(900, 100, 400)).toBe(400);
    expect(clampSize(250, 100, 400)).toBe(250);
  });

  it('resizeBy stays within bounds and leaves other panels alone', () => {
    const grown = resizeBy(defaults, 'right', 500, { min: 200, max: 480 });
    expect(grown.right.size).toBe(480);
    expect(grown.bottom).toEqual(defaults.bottom);
    expect(resizeBy(defaults, 'right', -500, { min: 200, max: 480 }).right.size).toBe(200);
    expect(resizeBy(defaults, 'right', 16, { min: 200, max: 480 }).right.size).toBe(336);
  });

  it('resizeBy ignores unknown panels', () => {
    expect(resizeBy(defaults, 'nope', 10, { min: 0, max: 100 })).toEqual(defaults);
  });

  it('falls back to defaults for null or malformed JSON', () => {
    expect(parseStoredLayout(null, defaults)).toEqual(defaults);
    expect(parseStoredLayout('{not json', defaults)).toEqual(defaults);
    expect(parseStoredLayout('[1,2]', defaults)).toEqual(defaults);
    expect(parseStoredLayout('"x"', defaults)).toEqual(defaults);
  });

  it('applies valid stored values and ignores unknown panels', () => {
    const raw = JSON.stringify({ right: { size: 410, open: false }, ghost: { size: 1, open: true } });
    const out = parseStoredLayout(raw, defaults);
    expect(out.right).toEqual({ size: 410, open: false });
    expect(out.bottom).toEqual(defaults.bottom);
    expect('ghost' in out).toBe(false);
  });

  it('validates field types per panel', () => {
    const raw = JSON.stringify({
      right: { size: 'wide', open: false },
      bottom: { size: 260, open: 'yes' },
    });
    const out = parseStoredLayout(raw, defaults);
    expect(out.right).toEqual({ size: 320, open: false });
    expect(out.bottom).toEqual({ size: 260, open: false });
  });

  it('rejects non-finite sizes', () => {
    const out = parseStoredLayout('{"right":{"size":null,"open":true}}', defaults);
    expect(out.right.size).toBe(320);
  });
});
