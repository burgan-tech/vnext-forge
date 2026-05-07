import { describe, expect, it, vi } from 'vitest';
import { failureFromCode, success, ERROR_CODES } from '@vnext-forge-studio/app-contracts';

import { emitFsChangeOnSuccess } from './emitFsChangeOnSuccess.js';
import { resetWorkspaceFsChangeListeners, subscribeWorkspaceFsChange } from './workspace-fs-events.js';

describe('emitFsChangeOnSuccess', () => {
  it('emits only when ApiResponse is success', async () => {
    resetWorkspaceFsChangeListeners();
    const fn = vi.fn();
    subscribeWorkspaceFsChange(fn);

    const ok = await emitFsChangeOnSuccess(Promise.resolve(success(undefined)), () => ({
      kind: 'write',
      paths: ['/f'],
    }));
    expect(ok.success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);

    const bad = await emitFsChangeOnSuccess(
      Promise.resolve(failureFromCode(ERROR_CODES.FILE_WRITE_ERROR, 'x')),
      () => ({ kind: 'delete', paths: ['/y'] }),
    );
    expect(bad.success).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
