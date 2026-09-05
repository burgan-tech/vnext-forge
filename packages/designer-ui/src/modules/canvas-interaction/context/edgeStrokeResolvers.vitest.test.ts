import { describe, expect, it } from 'vitest';

import { resolveEdgeHoverStrokeWidth, resolveEdgeStrokeWidth } from './CanvasViewSettingsContext';

describe('resolveEdgeHoverStrokeWidth', () => {
  it.each(['sm', 'md', 'lg'] as const)('is visibly thicker than the %s base stroke', (step) => {
    const base = resolveEdgeStrokeWidth(step);
    const hover = resolveEdgeHoverStrokeWidth(base);
    expect(hover).toBeGreaterThanOrEqual(base + 1.25);
  });

  it('scales with the base so Thick stays thicker than Normal on hover', () => {
    expect(resolveEdgeHoverStrokeWidth(resolveEdgeStrokeWidth('lg'))).toBeGreaterThan(
      resolveEdgeHoverStrokeWidth(resolveEdgeStrokeWidth('md')),
    );
    expect(resolveEdgeHoverStrokeWidth(resolveEdgeStrokeWidth('md'))).toBeGreaterThan(
      resolveEdgeHoverStrokeWidth(resolveEdgeStrokeWidth('sm')),
    );
  });

  it('uses the 1.6x ratio once the base is wide enough for it to dominate the floor', () => {
    expect(resolveEdgeHoverStrokeWidth(2.75)).toBeCloseTo(4.4);
    expect(resolveEdgeHoverStrokeWidth(1.5)).toBeCloseTo(2.75); // floor wins: 1.5*1.6 = 2.4 < 2.75
  });

  it('also grows the selected (1.4x) stroke and the traversed floor', () => {
    expect(resolveEdgeHoverStrokeWidth(2 * 1.4)).toBeGreaterThan(2 * 1.4);
    expect(resolveEdgeHoverStrokeWidth(2.5)).toBeGreaterThan(2.5);
  });
});
