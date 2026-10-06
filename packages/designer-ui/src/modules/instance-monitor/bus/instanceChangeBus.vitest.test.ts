import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishInstanceChange, registerInstanceChangeRelay, subscribeInstanceChanges } from './instanceChangeBus';

afterEach(() => registerInstanceChangeRelay(null));

describe('instanceChangeBus', () => {
  it('delivers to local subscribers until they unsubscribe', () => {
    const fn = vi.fn();
    const off = subscribeInstanceChanges(fn);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    off();
    publishInstanceChange({ domain: 'core', instanceId: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ domain: 'core', instanceId: 'a' });
  });
  it('relays unless told not to', () => {
    const relay = vi.fn();
    registerInstanceChangeRelay(relay);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    publishInstanceChange({ domain: 'core', instanceId: 'b' }, { relay: false });
    expect(relay).toHaveBeenCalledTimes(1);
  });
  it('keeps delivering when a listener throws', () => {
    const good = vi.fn();
    const offBad = subscribeInstanceChanges(() => {
      throw new Error('x');
    });
    const offGood = subscribeInstanceChanges(good);
    publishInstanceChange({ domain: 'core', instanceId: 'a' });
    expect(good).toHaveBeenCalled();
    offBad();
    offGood();
  });
  it('delivers once even when a BroadcastChannel exists', async () => {
    const fn = vi.fn();
    const off = subscribeInstanceChanges(fn);
    publishInstanceChange({ domain: 'core', instanceId: 'once' });
    await new Promise((r) => setTimeout(r, 20));
    off();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
