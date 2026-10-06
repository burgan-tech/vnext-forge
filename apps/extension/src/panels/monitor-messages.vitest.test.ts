import { describe, expect, it } from 'vitest';

import { isOpenQuickRunFromMonitorMessage, parseInstanceChangedMessage, parseOpenMonitorMessage } from './monitor-messages';

describe('parseOpenMonitorMessage', () => {
  it('accepts an instance id and an optional key', () => {
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: 'a1', instanceKey: 'order-1' })).toEqual({ instanceId: 'a1', instanceKey: 'order-1' });
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: 'a1' })).toEqual({ instanceId: 'a1' });
  });
  it('rejects other messages and bad ids', () => {
    expect(parseOpenMonitorMessage({ type: 'other', instanceId: 'a1' })).toBeNull();
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: '' })).toBeNull();
    expect(parseOpenMonitorMessage({ type: 'quickrun:open-monitor', instanceId: '../x' })).toBeNull();
    expect(parseOpenMonitorMessage(null)).toBeNull();
  });
});

describe('isOpenQuickRunFromMonitorMessage', () => {
  it('recognises the message', () => {
    expect(isOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun' })).toBe(true);
    expect(isOpenQuickRunFromMonitorMessage({ type: 'quickrun:open-monitor' })).toBe(false);
  });
});

describe('parseInstanceChangedMessage', () => {
  it('accepts a quickrun:instance-changed event', () => {
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', domain: 'core', instanceId: 'a1', status: 'A', state: 'review' }))
      .toEqual({ domain: 'core', instanceId: 'a1', status: 'A', state: 'review' });
  });
  it('rejects bad ids, missing domain and other types', () => {
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', domain: 'core', instanceId: '../x' })).toBeNull();
    expect(parseInstanceChangedMessage({ type: 'quickrun:instance-changed', instanceId: 'a1' })).toBeNull();
    expect(parseInstanceChangedMessage({ type: 'other', domain: 'core', instanceId: 'a1' })).toBeNull();
  });
});
