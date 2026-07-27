import { describe, expect, it } from 'vitest';

import type { StateResponse } from '../types/quickrun.types';
import { shouldFetchView } from './shouldFetchView';

type MinimalState = Pick<StateResponse, 'stateType' | 'view' | 'transitions' | 'status'>;

const withView: MinimalState = {
  stateType: 'intermediate',
  view: { hasView: true, loadData: false, href: '' },
  status: 'B',
};

const withoutView: MinimalState = {
  stateType: 'intermediate',
  view: { hasView: false, loadData: false, href: '' },
  status: 'A',
};

describe('shouldFetchView', () => {
  it('returns false when resolveStateViewSource has nothing to render, regardless of gate mode', () => {
    expect(shouldFetchView(withoutView, { applyStatusGate: true })).toBe(false);
    expect(shouldFetchView(withoutView, { applyStatusGate: false })).toBe(false);
  });

  it('applyStatusGate: false always fetches once a view source exists, even while busy (status B)', () => {
    expect(shouldFetchView(withView, { applyStatusGate: false })).toBe(true);
  });

  it('applyStatusGate: true rejects a busy (B) status with no terminate flag', () => {
    expect(shouldFetchView(withView, { applyStatusGate: true })).toBe(false);
  });

  it('applyStatusGate: true accepts a busy (B) status when terminate is true', () => {
    expect(shouldFetchView(withView, { applyStatusGate: true, terminate: true })).toBe(true);
  });

  it('applyStatusGate: true accepts status A or C without needing terminate', () => {
    const stateA: MinimalState = { ...withView, status: 'A' };
    const stateC: MinimalState = { ...withView, status: 'C' };
    expect(shouldFetchView(stateA, { applyStatusGate: true })).toBe(true);
    expect(shouldFetchView(stateC, { applyStatusGate: true })).toBe(true);
  });
});
