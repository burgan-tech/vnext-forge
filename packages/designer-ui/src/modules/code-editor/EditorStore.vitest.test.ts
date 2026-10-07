import { describe, expect, it } from 'vitest';

import { monitorTabId, monitorTabIdFromPath } from './EditorStore.js';

describe('monitorTabIdFromPath', () => {
  it('maps a monitor route to its tab id', () => {
    expect(monitorTabIdFromPath('p1', '/project/p1/monitor/loan/loan-flow/abc-123')).toBe(
      monitorTabId('p1', 'abc-123'),
    );
  });

  it('ignores other projects and other routes', () => {
    expect(monitorTabIdFromPath('p1', '/project/p2/monitor/loan/loan-flow/abc-123')).toBeNull();
    expect(monitorTabIdFromPath('p1', '/project/p1/flow/loan/loan-flow')).toBeNull();
    expect(monitorTabIdFromPath('p1', '/project/p1/monitor/loan/loan-flow')).toBeNull();
  });
});
