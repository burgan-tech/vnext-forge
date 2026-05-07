import { useProjectStore } from '@vnext-forge-studio/designer-ui';

import { useVnextWorkspaceUiStore } from '../../app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '../../app/store/useWorkspaceDiagnosticsStore';

/**
 * Kod editöründen kaydedilen içerik sıkı doğrulamadan geçmediğinde: StatusBar + store ile uyumlu hata kaydı.
 */
export function applyVnextConfigStrictValidationFailure(userMessage: string): void {
  useWorkspaceDiagnosticsStore.getState().setConfigIssues([
    {
      id: 'workspace-config-invalid',
      severity: 'error',
      message: userMessage,
      rule: 'workspace.config',
    },
  ]);
  useProjectStore.getState().setVnextConfig(null);
  useVnextWorkspaceUiStore.getState().setComponentLayoutStatus(null);
  useVnextWorkspaceUiStore.getState().setShowMissingVnextConfigBar(false);
  useVnextWorkspaceUiStore.getState().setVnextConfigWizardOpen(false);
}
