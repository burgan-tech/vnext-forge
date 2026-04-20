import { useMemo } from 'react';

import {
  useAsync,
  type ProjectInfo,
  type UseAsyncOptions,
  type WriteProjectConfigPayload,
} from '@vnext-forge/designer-ui';

import { writeProjectConfig } from '../../project-management/ProjectApi';

/**
 * vnext.config.json yazımı — transport `ProjectApi` içinde; async yaşam döngüsü burada.
 * `useAsync` owns success/error toasts by default; callers should not add parallel
 * `showNotification` for the same mutation (R-f16).
 */
export function useWriteVnextWorkspaceConfig(
  options?: Pick<
    UseAsyncOptions<ProjectInfo>,
    'onSuccess' | 'onError' | 'showNotificationOnError' | 'showNotificationOnSuccess' | 'successMessage' | 'errorMessage'
  >,
) {
  return useAsync(
    (projectId: string, payload: WriteProjectConfigPayload) => writeProjectConfig(projectId, payload),
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
