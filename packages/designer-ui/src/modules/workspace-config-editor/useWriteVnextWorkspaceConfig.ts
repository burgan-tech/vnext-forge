import { useMemo } from 'react';

import { callApi } from '../../api/client.js';
import { useAsync, type UseAsyncOptions } from '../../hooks/useAsync.js';
import type {
  ProjectInfo,
  WriteProjectConfigPayload,
} from '../../shared/projectTypes.js';

/**
 * Shared `vnext.config.json` write hook. Both `apps/web` and the VS Code
 * extension webview use this — the underlying transport (HTTP vs.
 * `postMessage`) is resolved by `getApiTransport()` per host.
 *
 * `useAsync` owns success/error toasts by default; callers should not add
 * parallel `showNotification` for the same mutation (R-f16).
 */
export function useWriteVnextWorkspaceConfig(
  options?: Pick<
    UseAsyncOptions<ProjectInfo>,
    | 'onSuccess'
    | 'onError'
    | 'showNotificationOnError'
    | 'showNotificationOnSuccess'
    | 'successMessage'
    | 'errorMessage'
  >,
) {
  return useAsync(
    (projectId: string, payload: WriteProjectConfigPayload) =>
      callApi<ProjectInfo>({
        method: 'projects/writeConfig',
        params: { id: projectId, config: payload },
      }),
    useMemo(
      () => ({
        showNotificationOnError: true,
        errorMessage: 'Configuration could not be saved.',
        showNotificationOnSuccess: true,
        successMessage: 'vnext.config.json created.',
        ...options,
      }),
      [options],
    ),
  );
}
