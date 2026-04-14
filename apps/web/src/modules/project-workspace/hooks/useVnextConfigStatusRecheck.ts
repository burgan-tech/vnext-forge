import { useCallback, useState } from 'react';

import { useProjectStore } from '@app/store/useProjectStore';
import {
  getProjectConfigStatus,
  getVnextComponentLayoutStatus,
} from '@modules/project-management/ProjectApi';
import { showNotification } from '@shared/notification/model/NotificationStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { applyComponentLayoutSeedOffer } from '../applyComponentLayoutSeedOffer';
import { applyProjectConfigStatus } from '../applyProjectConfigStatus';

const logger = createLogger('useVnextConfigStatusRecheck');

export function useVnextConfigStatusRecheck() {
  const [rechecking, setRechecking] = useState(false);

  const recheck = useCallback(async () => {
    const projectId = useProjectStore.getState().activeProject?.id;
    if (!projectId) {
      return;
    }

    setRechecking(true);
    try {
      const response = await getProjectConfigStatus(projectId);
      applyProjectConfigStatus(response, {
        openWizardOnMissing: true,
      });

      if (response.success && response.data.status === 'ok') {
        try {
          const layoutRes = await getVnextComponentLayoutStatus(projectId);
          if (layoutRes.success) {
            applyComponentLayoutSeedOffer(layoutRes.data, {
              activeProjectId: projectId,
              ignoreTemplateDecline: true,
            });
          }
        } catch (error) {
          logger.warn('Layout teklifi atlandı; config durumu güncellendi.', { error, projectId });
        }
      }

      if (!response.success) {
        showNotification({
          type: 'error',
          message: response.error.message,
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
