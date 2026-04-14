import { create } from 'zustand';

import type { VnextComponentLayoutStatus } from '@modules/project-management/ProjectTypes';

export type TemplateSeedDialogReason = 'only_config' | 'incomplete_layout';

interface VnextWorkspaceUiState {
  vnextConfigWizardOpen: boolean;
  showMissingVnextConfigBar: boolean;
  /** Son başarılı layout okuması (status bar şablon teklifi için) */
  componentLayoutStatus: VnextComponentLayoutStatus | null;
  templateSeedDialogOpen: boolean;
  templateSeedDialogReason: TemplateSeedDialogReason | null;
  /** incomplete_layout için diyalog metninde kısa liste */
  templateSeedMissingPathsPreview: string[] | null;
  /** Kullanıcı şablon teklifini reddettiyse bu proje için otomatik tekrar gösterme */
  templatePromptDeclinedProjectId: string | null;

  setVnextConfigWizardOpen: (open: boolean) => void;
  setShowMissingVnextConfigBar: (show: boolean) => void;
  setComponentLayoutStatus: (status: VnextComponentLayoutStatus | null) => void;
  setTemplateSeedDialogOpen: (open: boolean) => void;
  openTemplateSeedDialog: (reason: TemplateSeedDialogReason, missingPaths?: string[]) => void;
  declineTemplatePromptForProject: (projectId: string) => void;
  clearTemplatePromptDecline: () => void;
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
      templateSeedMissingPathsPreview:
        reason === 'incomplete_layout' ? (missingPaths ?? []).slice(0, 14) : null,
    }),
  declineTemplatePromptForProject: (projectId) =>
    set({
      templatePromptDeclinedProjectId: projectId,
      templateSeedDialogOpen: false,
      templateSeedDialogReason: null,
      templateSeedMissingPathsPreview: null,
    }),
  clearTemplatePromptDecline: () => set({ templatePromptDeclinedProjectId: null }),
  resetVnextWorkspaceUi: () => set(initial),
}));
