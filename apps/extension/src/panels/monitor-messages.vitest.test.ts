import { describe, expect, it } from 'vitest';

import { isOpenQuickRunFromMonitorMessage, parseOpenMonitorMessage } from './monitor-messages';

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
