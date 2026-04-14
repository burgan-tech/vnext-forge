import type { ApiResponse } from '@vnext-forge/app-contracts';

import { useProjectStore } from '@app/store/useProjectStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '@app/store/useWorkspaceDiagnosticsStore';

import type { ProjectConfigStatus } from '@modules/project-management/ProjectTypes';

export interface ApplyProjectConfigStatusOptions {
  /** `missing` durumunda sihirbazı aç */
  openWizardOnMissing?: boolean;
}

/**
 * `getProjectConfigStatus` yanıtını proje + diagnostik + vNext UI store'larına uygular.
 */
export function applyProjectConfigStatus(
  status: ApiResponse<ProjectConfigStatus>,
  options: ApplyProjectConfigStatusOptions = {},
): void {
  const { openWizardOnMissing = true } = options;

  const { setVnextConfig } = useProjectStore.getState();
  const { setConfigIssues, clearConfigIssues } = useWorkspaceDiagnosticsStore.getState();
  const { setVnextConfigWizardOpen, setShowMissingVnextConfigBar, setComponentLayoutStatus } =
    useVnextWorkspaceUiStore.getState();

  if (!status.success) {
    setComponentLayoutStatus(null);
    setVnextConfig(null);
    setConfigIssues([
      {
        id: 'workspace-config-fetch',
        severity: 'error',
        message: status.error.message,
        rule: 'workspace.config',
      },
    ]);
    setVnextConfigWizardOpen(false);
    setShowMissingVnextConfigBar(false);
    return;
  }

  if (status.data.status === 'ok') {
    clearConfigIssues();
    setVnextConfig(status.data.config);
    /* layout: syncVnextWorkspaceFromDisk veya offerLayoutSeedIfNeeded günceller */
    setVnextConfigWizardOpen(false);
    setShowMissingVnextConfigBar(false);
    return;
  }

  setVnextConfig(null);
  setComponentLayoutStatus(null);

  if (status.data.status === 'invalid') {
    setConfigIssues([
      {
        id: 'workspace-config-invalid',
        severity: 'error',
        message: status.data.message,
        rule: 'workspace.config',
      },
    ]);
    setVnextConfigWizardOpen(false);
    setShowMissingVnextConfigBar(false);
    return;
  }

  clearConfigIssues();
  setShowMissingVnextConfigBar(false);
  if (openWizardOnMissing) {
    setVnextConfigWizardOpen(true);
  } else {
    setVnextConfigWizardOpen(false);
  }
}
