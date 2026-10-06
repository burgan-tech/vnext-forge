import { describe, expect, it } from 'vitest';

import { parseInstanceChangedMessage, parseOpenQuickRunFromMonitorMessage, parseOpenMonitorMessage } from './monitor-messages';

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

describe('parseOpenQuickRunFromMonitorMessage', () => {
  it('returns the id when valid', () => {
    expect(parseOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun', instanceId: 'a1' })).toEqual({ instanceId: 'a1' });
  });
  it('still reveals the panel without an id or with a bad id', () => {
    expect(parseOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun' })).toEqual({});
    expect(parseOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun', instanceId: '../x' })).toEqual({});
    expect(parseOpenQuickRunFromMonitorMessage({ type: 'monitor:open-quickrun', instanceId: 5 })).toEqual({});
  });
  it('returns null for other messages', () => {
    expect(parseOpenQuickRunFromMonitorMessage({ type: 'quickrun:open-monitor' })).toBeNull();
    expect(parseOpenQuickRunFromMonitorMessage(null)).toBeNull();
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
