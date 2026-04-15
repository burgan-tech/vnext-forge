import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import {
  getProjectConfigStatus,
  getVnextComponentLayoutStatus,
} from '@modules/project-management/ProjectApi';
import { createLogger } from '@shared/lib/logger/createLogger';

import { applyProjectConfigStatus } from './applyProjectConfigStatus';

const logger = createLogger('syncVnextWorkspaceFromDisk');

export type SyncVnextWorkspaceFromDiskResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Çalışma kökünü sunucuda yeniden analiz eder: `vnext.config.json` durumu, bileşen layout; ileride ek doğrulamalar buraya eklenebilir.
 * Kod editörü kaydı, StatusBar yenilemesi, proje listesinden seçim ve benzeri akışlar bu giriş noktasını kullanır.
 */
export async function syncVnextWorkspaceFromDisk(
  projectId: string,
  options: { openWizardOnMissing?: boolean } = {},
): Promise<SyncVnextWorkspaceFromDiskResult> {
  const { openWizardOnMissing = true } = options;
  const { setComponentLayoutStatus } = useVnextWorkspaceUiStore.getState();

  const response = await getProjectConfigStatus(projectId);
  applyProjectConfigStatus(response, { openWizardOnMissing });

  if (!response.success) {
    setComponentLayoutStatus(null);
    return { ok: false, message: response.error.message };
  }

  if (response.data.status === 'invalid') {
    setComponentLayoutStatus(null);
    return { ok: false, message: response.data.message };
  }

  if (response.data.status !== 'ok') {
    setComponentLayoutStatus(null);
    return { ok: true };
  }

  try {
    const layoutRes = await getVnextComponentLayoutStatus(projectId);
    if (layoutRes.success) {
      setComponentLayoutStatus(layoutRes.data);
    } else {
      setComponentLayoutStatus(null);
    }
  } catch (error) {
    logger.warn('Bileşen layout durumu okunamadı.', { error, projectId });
    setComponentLayoutStatus(null);
  }

  return { ok: true };
}
