import { describe, expect, it } from 'vitest';

import type { StateResponse } from '../types/quickrun.types';
import { resolveStateViewSource } from './resolveStateViewSource';

type MinimalState = Pick<StateResponse, 'stateType' | 'view' | 'transitions'>;

describe('resolveStateViewSource', () => {
  it('returns {} when the state has its own view', () => {
    const state: MinimalState = {
      stateType: 'intermediate',
      view: { hasView: true, loadData: false, href: '' },
    };
    expect(resolveStateViewSource(state)).toEqual({});
  });

  it('wizard, no own view: returns the first stateTransition with a view, ignoring an earlier non-matching entry and a sharedTransition-with-view', () => {
    const state: MinimalState = {
      stateType: 'wizard',
      view: { hasView: false, loadData: false, href: '' },
      transitions: [
        { name: 'no-view-transition', kind: 'stateTransition', href: '' },
        {
          name: 'shared-with-view',
          kind: 'sharedTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
        {
          name: 'first-match',
          kind: 'stateTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
        {
          name: 'second-match',
          kind: 'stateTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
      ],
    };
    expect(resolveStateViewSource(state)).toEqual({ transitionKey: 'first-match' });
  });

  it('wizard, no own view, no matching transition: returns null', () => {
    const state: MinimalState = {
      stateType: 'wizard',
      view: { hasView: false, loadData: false, href: '' },
      transitions: [
        { name: 'no-view-transition', kind: 'stateTransition', href: '' },
        {
          name: 'shared-with-view',
          kind: 'sharedTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
      ],
    };
    expect(resolveStateViewSource(state)).toBeNull();
  });

  it('non-wizard, no own view: returns null even with a stateTransition-with-view present (fallback is wizard-only)', () => {
    const state: MinimalState = {
      stateType: 'intermediate',
      view: { hasView: false, loadData: false, href: '' },
      transitions: [
        {
          name: 'first-match',
          kind: 'stateTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
      ],
    };
    expect(resolveStateViewSource(state)).toBeNull();
  });

  it('own view wins even when the state is a wizard', () => {
    const state: MinimalState = {
      stateType: 'wizard',
      view: { hasView: true, loadData: false, href: '' },
      transitions: [
        {
          name: 'first-match',
          kind: 'stateTransition',
          view: { hasView: true, loadData: false, href: '' },
          href: '',
        },
      ],
    };
    expect(resolveStateViewSource(state)).toEqual({});
  });
});
