import { useCallback, useState } from 'react';

import { createLogger, showNotification, useProjectStore } from '@vnext-forge/designer-ui';

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
          kind: 'error',
          message: result.message,
        });
      }
    } catch (error) {
      logger.error('vnext.config durumu yeniden okunamadı.', { error, projectId });
      showNotification({
        kind: 'error',
        message: 'Configuration status could not be checked.',
      });
    } finally {
      setRechecking(false);
    }
  }, []);

  return { recheck, rechecking };
}
