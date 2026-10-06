import { describe, expect, it } from 'vitest';

import { definitionSignature, stableDefinition } from './stableDefinition';

const make = (extra: Record<string, unknown> = {}, nodePos: Record<string, unknown> = { a: { x: 1, y: 2 } }) =>
  ({
    source: 'local',
    localVersion: '1.0.0',
    vm: { workflowJson: { key: 'wf', states: [{ key: 'a' }], ...extra } },
    diagram: { nodePos },
  }) as never;

describe('stableDefinition', () => {
  it('returns the previous object when the content is equal', () => {
    const prev = make();
    const next = make();
    expect(next).not.toBe(prev);
    expect(stableDefinition(prev, next)).toBe(prev);
  });
  it('returns the new object when the workflow or diagram changed', () => {
    const prev = make();
    const changedWf = make({ version: '2' });
    const changedDiagram = make({}, { a: { x: 9, y: 9 } });
    expect(stableDefinition(prev, changedWf)).toBe(changedWf);
    expect(stableDefinition(prev, changedDiagram)).toBe(changedDiagram);
  });
  it('returns the new object without a previous one', () => {
    const next = make();
    expect(stableDefinition(undefined, next)).toBe(next);
  });
  it('signs equal content equally and different content differently', () => {
    expect(definitionSignature(make())).toBe(definitionSignature(make()));
    expect(definitionSignature(make())).not.toBe(definitionSignature(make({ version: '2' })));
  });
});
