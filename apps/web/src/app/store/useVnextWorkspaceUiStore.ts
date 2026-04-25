import { create } from 'zustand';

import type { VnextComponentLayoutStatus } from '@vnext-forge/designer-ui';

export type TemplateSeedDialogReason = 'only_config' | 'incomplete_layout';

/**
 * Web-only workspace chrome state: the vnext.config wizard, the "missing
 * config" status-bar banner, and the template-seed dialog. The VS Code
 * extension webview never mounts these UIs — VS Code's own command palette,
 * Explorer and status bar replace them — so this store lives in `apps/web`.
 */
interface VnextWorkspaceUiState {
  vnextConfigWizardOpen: boolean;
  showMissingVnextConfigBar: boolean;
  /** Last successful component-layout read (feeds the template-seed prompt). */
  componentLayoutStatus: VnextComponentLayoutStatus | null;
  templateSeedDialogOpen: boolean;
  templateSeedDialogReason: TemplateSeedDialogReason | null;
  /** Short list of missing paths used in the `incomplete_layout` copy. */
  templateSeedMissingPathsPreview: string[] | null;
  /** If the user declined the seed prompt for a project, we remember it here. */
  templatePromptDeclinedProjectId: string | null;
  /** Whether the project's `validate.js` script is missing on disk. */
  validateScriptMissing: boolean;

  setVnextConfigWizardOpen: (open: boolean) => void;
  setShowMissingVnextConfigBar: (show: boolean) => void;
  setComponentLayoutStatus: (status: VnextComponentLayoutStatus | null) => void;
  setTemplateSeedDialogOpen: (open: boolean) => void;
  openTemplateSeedDialog: (reason: TemplateSeedDialogReason, missingPaths?: string[]) => void;
  declineTemplatePromptForProject: (projectId: string) => void;
  clearTemplatePromptDecline: () => void;
  setValidateScriptMissing: (missing: boolean) => void;
  resetVnextWorkspaceUi: () => void;
}

const initial = {
  vnextConfigWizardOpen: false,
  showMissingVnextConfigBar: false,
  componentLayoutStatus: null as VnextComponentLayoutStatus | null,
  templateSeedDialogOpen: false,
  templateSeedDialogReason: null as TemplateSeedDialogReason | null,
  templateSeedMissingPathsPreview: null as string[] | null,
  templatePromptDeclinedProjectId: null as string | null,
  validateScriptMissing: false,
};

export const useVnextWorkspaceUiStore = create<VnextWorkspaceUiState>((set) => ({
  ...initial,

  setVnextConfigWizardOpen: (vnextConfigWizardOpen) => set({ vnextConfigWizardOpen }),
  setShowMissingVnextConfigBar: (showMissingVnextConfigBar) => set({ showMissingVnextConfigBar }),
  setComponentLayoutStatus: (componentLayoutStatus) => set({ componentLayoutStatus }),
  setTemplateSeedDialogOpen: (templateSeedDialogOpen) =>
    set(() =>
      templateSeedDialogOpen
        ? { templateSeedDialogOpen: true }
        : {
            templateSeedDialogOpen: false,
            templateSeedDialogReason: null,
            templateSeedMissingPathsPreview: null,
          },
    ),
  openTemplateSeedDialog: (reason, missingPaths) =>
    set({
      templateSeedDialogOpen: true,
      templateSeedDialogReason: reason,
      templateSeedMissingPathsPreview: missingPaths ?? null,
    }),
  declineTemplatePromptForProject: (projectId) =>
    set({
      templatePromptDeclinedProjectId: projectId,
      templateSeedDialogOpen: false,
      templateSeedDialogReason: null,
      templateSeedMissingPathsPreview: null,
    }),
  clearTemplatePromptDecline: () => set({ templatePromptDeclinedProjectId: null }),
  setValidateScriptMissing: (validateScriptMissing) => set({ validateScriptMissing }),
  resetVnextWorkspaceUi: () => set(initial),
}));
