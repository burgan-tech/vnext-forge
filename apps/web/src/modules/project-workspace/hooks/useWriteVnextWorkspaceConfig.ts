import { useMemo } from 'react';

import type { UseAsyncOptions } from '@shared/hooks/UseAsync';
import { useAsync } from '@shared/hooks/UseAsync';

import { writeProjectConfig } from '@modules/project-management/ProjectApi';
import type { ProjectInfo, WriteProjectConfigPayload } from '@modules/project-management/ProjectTypes';

/**
 * vnext.config.json yazımı — transport `ProjectApi` içinde; async yaşam döngüsü burada.
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
        errorMessage: 'Yapılandırma kaydedilemedi.',
        showNotificationOnSuccess: true,
        successMessage: 'vnext.config.json oluşturuldu.',
        ...options,
      }),
      [options],
    ),
  );
}
