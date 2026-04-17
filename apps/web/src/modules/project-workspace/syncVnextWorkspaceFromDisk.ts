import { createLogger } from '@vnext-forge/designer-ui';

import { useComponentFileTypesStore } from '../../app/store/useComponentFileTypesStore';
import { useVnextWorkspaceUiStore } from '../../app/store/useVnextWorkspaceUiStore';
import {
  getComponentFileTypes,
  getProjectConfigStatus,
  getVnextComponentLayoutStatus,
  getValidateScriptStatus,
} from '../project-management/ProjectApi';

import { applyProjectConfigStatus } from './applyProjectConfigStatus';

const logger = createLogger('syncVnextWorkspaceFromDisk');

export type SyncVnextWorkspaceFromDiskResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Şablon klasör yapısı (`getVnextComponentLayoutStatus`) ve kök `validate.js` varlığını diskten yeniler.
 * Dosya ağacı yenilendiğinde ve tam `syncVnextWorkspaceFromDisk` içinde kullanılır.
 * Component file types taraması burada YAPILMAZ — bu pahalı tarama sadece
 * `loadComponentFileTypes` aracılığıyla proje açılışında ve yapısal değişikliklerde tetiklenir.
 */
export async function refreshWorkspaceLayoutAndValidateScript(projectId: string): Promise<void> {
  const { setComponentLayoutStatus, setValidateScriptMissing } =
    useVnextWorkspaceUiStore.getState();

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

  try {
    const validateRes = await getValidateScriptStatus(projectId);
    if (validateRes.success) {
      setValidateScriptMissing(!validateRes.data.exists);
    } else {
      setValidateScriptMissing(false);
    }
  } catch (error) {
    logger.warn('validate.js durumu okunamadı.', { error, projectId });
    setValidateScriptMissing(false);
  }
}

/**
 * Server'dan componentsRoot altındaki tüm .json dosyalarının flow tiplerini okur.
 * Pahalı bir işlem: sadece proje ilk açıldığında ve yapısal değişikliklerde (dosya oluşturma/silme) çağrılır.
 * Dosya kaydetme (save) sırasında client-side detection kullanılır, bu fonksiyon çağrılmaz.
 */
export async function loadComponentFileTypes(projectId: string): Promise<void> {
  try {
    const fileTypesRes = await getComponentFileTypes(projectId);
    if (fileTypesRes.success) {
      useComponentFileTypesStore.getState().setFileTypes(fileTypesRes.data);
    } else {
      useComponentFileTypesStore.getState().clearFileTypes();
    }
  } catch (error) {
    logger.warn('Component file types could not be loaded.', { error, projectId });
    useComponentFileTypesStore.getState().clearFileTypes();
  }
}

/**
 * Çalışma kökünü sunucuda yeniden analiz eder: `vnext.config.json` durumu, ardından layout + `validate.js` sinyalleri.
 * `vnext.config` kaydı, sihirbaz tamamlanması ve manuel yeniden kontrol akışlarında kullanılır.
 */
export async function syncVnextWorkspaceFromDisk(
  projectId: string,
  options: { openWizardOnMissing?: boolean } = {},
): Promise<SyncVnextWorkspaceFromDiskResult> {
  const { openWizardOnMissing = true } = options;
  const { setComponentLayoutStatus, setValidateScriptMissing } =
    useVnextWorkspaceUiStore.getState();
  const response = await getProjectConfigStatus(projectId);
  applyProjectConfigStatus(response, { openWizardOnMissing });

  if (!response.success) {
    setComponentLayoutStatus(null);
    setValidateScriptMissing(false);
    useComponentFileTypesStore.getState().clearFileTypes();
    return { ok: false, message: response.error.message };
  }

  if (response.data.status === 'invalid') {
    setComponentLayoutStatus(null);
    setValidateScriptMissing(false);
    useComponentFileTypesStore.getState().clearFileTypes();
    return { ok: false, message: response.data.message };
  }

  if (response.data.status !== 'ok') {
    setComponentLayoutStatus(null);
    setValidateScriptMissing(false);
    useComponentFileTypesStore.getState().clearFileTypes();
    return { ok: true };
  }

  await refreshWorkspaceLayoutAndValidateScript(projectId);

  return { ok: true };
}
