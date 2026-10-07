import { describe, expect, it } from 'vitest';

import { parseInstanceChangedMessage, parseOpenInstanceFromMonitorMessage, parseOpenQuickRunFromMonitorMessage, parseOpenMonitorMessage } from './monitor-messages';

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

describe('parseOpenInstanceFromMonitorMessage', () => {
  const roots = ['/ws'];
  const base = { type: 'monitor:open-instance', domain: 'core', workflowKey: 'kyc', instanceId: 'a1-b2' };
  it('accepts a minimal request', () => {
    expect(parseOpenInstanceFromMonitorMessage(base, roots)).toEqual({ domain: 'core', workflowKey: 'kyc', instanceId: 'a1-b2' });
  });
  it('keeps a workspace-contained .json path and an instance key', () => {
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowFilePath: '/ws/Workflows/kyc.json', instanceKey: 'order-1' }, roots)).toEqual({
      domain: 'core', workflowKey: 'kyc', instanceId: 'a1-b2', workflowFilePath: '/ws/Workflows/kyc.json', instanceKey: 'order-1',
    });
  });
  it('rejects other messages, bad ids and bad identity fields', () => {
    expect(parseOpenInstanceFromMonitorMessage({ ...base, type: 'x' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, instanceId: '../x' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, domain: '' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowKey: 'k'.repeat(201) }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage(null, roots)).toBeNull();
  });
  it('rejects a path outside the workspace or that is not json', () => {
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowFilePath: '/etc/passwd.json' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowFilePath: '/ws/../etc/x.json' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowFilePath: '/ws/a.txt' }, roots)).toBeNull();
    expect(parseOpenInstanceFromMonitorMessage({ ...base, workflowFilePath: 5 }, roots)).toBeNull();
  });
  it('drops an over-long or empty instance key', () => {
    expect(parseOpenInstanceFromMonitorMessage({ ...base, instanceKey: 'k'.repeat(201) }, roots)).toEqual({ domain: 'core', workflowKey: 'kyc', instanceId: 'a1-b2' });
  });
});
