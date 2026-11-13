import { describe, expect, it } from 'vitest';

import { transitionRoute, transitionRouteSpoken } from './transitionRoute';

describe('transitionRoute', () => {
  it('formats a completed transition', () => {
    expect(transitionRoute('rl-idle', 'rl-holding')).toBe('rl-idle → rl-holding');
    expect(transitionRouteSpoken('rl-idle', 'rl-holding')).toBe('rl-idle to rl-holding');
  });

  it('says "not completed" when the runtime recorded no target state', () => {
    expect(transitionRoute('rl-idle', undefined)).toBe('rl-idle · not completed');
    expect(transitionRouteSpoken('rl-idle', null)).toBe('rl-idle, not completed');
  });
});
