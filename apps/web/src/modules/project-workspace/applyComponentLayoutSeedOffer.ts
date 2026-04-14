import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';

import type { VnextComponentLayoutStatus } from '@modules/project-management/ProjectTypes';

export interface ApplyComponentLayoutSeedOfferOptions {
  activeProjectId: string | null | undefined;
  /** true: StatusBar yeniden kontrolünde reddi yok say */
  ignoreTemplateDecline?: boolean;
}

/**
 * Geçerli `vnext.config.json` varken: yalnızca config dosyası veya eksik bileşen klasörleri → şablon diyalog.
 */
export function applyComponentLayoutSeedOffer(
  layout: VnextComponentLayoutStatus,
  options: ApplyComponentLayoutSeedOfferOptions,
): void {
  const { activeProjectId, ignoreTemplateDecline = false } = options;
  if (!activeProjectId) {
    return;
  }

  const { templatePromptDeclinedProjectId, openTemplateSeedDialog } =
    useVnextWorkspaceUiStore.getState();
  const allow =
    ignoreTemplateDecline || templatePromptDeclinedProjectId !== activeProjectId;
  if (!allow) {
    return;
  }

  if (layout.projectContainsOnlyConfigFile) {
    openTemplateSeedDialog('only_config');
    return;
  }

  if (!layout.layoutComplete) {
    openTemplateSeedDialog('incomplete_layout', layout.missingLayoutPaths);
  }
}
