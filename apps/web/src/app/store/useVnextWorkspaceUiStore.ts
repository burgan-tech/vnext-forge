import { create } from 'zustand';

export type TemplateSeedDialogReason = 'only_config' | 'incomplete_layout';

interface VnextWorkspaceUiState {
  vnextConfigWizardOpen: boolean;
  showMissingVnextConfigBar: boolean;
  templateSeedDialogOpen: boolean;
  templateSeedDialogReason: TemplateSeedDialogReason | null;
  /** incomplete_layout için diyalog metninde kısa liste */
  templateSeedMissingPathsPreview: string[] | null;
  /** Kullanıcı şablon teklifini reddettiyse bu proje için otomatik tekrar gösterme */
  templatePromptDeclinedProjectId: string | null;

  setVnextConfigWizardOpen: (open: boolean) => void;
  setShowMissingVnextConfigBar: (show: boolean) => void;
  setTemplateSeedDialogOpen: (open: boolean) => void;
  openTemplateSeedDialog: (reason: TemplateSeedDialogReason, missingPaths?: string[]) => void;
  declineTemplatePromptForProject: (projectId: string) => void;
  resetVnextWorkspaceUi: () => void;
}

const initial = {
  vnextConfigWizardOpen: false,
  showMissingVnextConfigBar: false,
  templateSeedDialogOpen: false,
  templateSeedDialogReason: null as TemplateSeedDialogReason | null,
  templateSeedMissingPathsPreview: null as string[] | null,
  templatePromptDeclinedProjectId: null as string | null,
};

export const useVnextWorkspaceUiStore = create<VnextWorkspaceUiState>((set) => ({
  ...initial,

  setVnextConfigWizardOpen: (vnextConfigWizardOpen) => set({ vnextConfigWizardOpen }),
  setShowMissingVnextConfigBar: (showMissingVnextConfigBar) => set({ showMissingVnextConfigBar }),
  setTemplateSeedDialogOpen: (templateSeedDialogOpen) =>
    set((s) =>
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
  resetVnextWorkspaceUi: () => set(initial),
}));
