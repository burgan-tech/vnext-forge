import { describe, expect, it, vi } from 'vitest';

import {
  emitWorkspaceFsChange,
  resetWorkspaceFsChangeListeners,
  subscribeWorkspaceFsChange,
} from './workspace-fs-events.js';

describe('workspace-fs-events', () => {
  it('notifies subscribers on emit', () => {
    resetWorkspaceFsChangeListeners();
    const fn = vi.fn();
    subscribeWorkspaceFsChange(fn);
    emitWorkspaceFsChange({ kind: 'write', paths: ['/a/b.csx'] });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ kind: 'write', paths: ['/a/b.csx'] });
  });

  it('unsubscribe stops notifications', () => {
    resetWorkspaceFsChangeListeners();
    const fn = vi.fn();
    const unsub = subscribeWorkspaceFsChange(fn);
    unsub();
    emitWorkspaceFsChange({ kind: 'delete', paths: ['/x'] });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not block other listeners when one throws', () => {
    resetWorkspaceFsChangeListeners();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    subscribeWorkspaceFsChange(bad);
    subscribeWorkspaceFsChange(good);
    emitWorkspaceFsChange({ kind: 'mkdir', paths: ['/d'] });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
