import { useCallback, useState } from 'react';

import { useProjectStore } from '@app/store/useProjectStore';
import { showNotification } from '@shared/notification/model/NotificationStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { syncVnextWorkspaceFromDisk } from '../syncVnextWorkspaceFromDisk';

const logger = createLogger('useVnextConfigStatusRecheck');

export function useVnextConfigStatusRecheck() {
  const [rechecking, setRechecking] = useState(false);

  const recheck = useCallback(async (explicitProjectId?: string) => {
    const fromParam = explicitProjectId?.trim();
    const projectId =
      fromParam && fromParam.length > 0
        ? fromParam
        : useProjectStore.getState().activeProject?.id;
    if (!projectId) {
      return;
    }

    setRechecking(true);
    try {
      const result = await syncVnextWorkspaceFromDisk(projectId, {
        openWizardOnMissing: true,
      });

      if (!result.ok) {
        showNotification({
          type: 'error',
          message: result.message,
          modalType: 'toast',
        });
      }
    } catch (error) {
      logger.error('vnext.config durumu yeniden okunamadı.', { error, projectId });
      showNotification({
        type: 'error',
        message: 'Yapılandırma durumu kontrol edilemedi.',
        modalType: 'toast',
      });
    } finally {
      setRechecking(false);
    }
  }, []);

  return { recheck, rechecking };
}
