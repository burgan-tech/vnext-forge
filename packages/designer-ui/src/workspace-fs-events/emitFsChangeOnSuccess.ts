import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { emitWorkspaceFsChange, type WorkspaceFsChangeEvent } from './workspace-fs-events.js';

export async function emitFsChangeOnSuccess<T extends ApiResponse<unknown>>(
  promise: Promise<T>,
  buildEvent: () => WorkspaceFsChangeEvent,
): Promise<T> {
  const res = await promise;
  if (res.success) {
    emitWorkspaceFsChange(buildEvent());
  }
  return res;
}
