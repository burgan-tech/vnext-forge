import {
  componentTabKindFromSpaRoute,
  formatHyphenatedTabTitle,
  getVnextComponentEditorTabDisplayTitle,
  type SpaComponentEditorTabRouteKind,
} from '@vnext-forge-studio/vnext-types';

import type { ComponentEditorKind } from './EditorStore.js';
import type { EditorTab } from './EditorStore.js';
import type { VnextComponentType } from '../../shared/projectTypes.js';

export {
  componentTabKindFromSpaRoute,
  formatHyphenatedTabTitle,
  getVnextComponentEditorTabDisplayTitle,
  type SpaComponentEditorTabRouteKind,
  type VnextComponentTabKind,
} from '@vnext-forge-studio/vnext-types';

/**
 * URL / sekme kimliğinde kullanılan `flow` ile dosya ikonlarındaki `workflow`
 * eşlemesi.
 */
export function componentEditorKindToVnextComponentType(
  kind: ComponentEditorKind,
): VnextComponentType {
  return componentTabKindFromSpaRoute(kind as SpaComponentEditorTabRouteKind) as VnextComponentType;
}

/**
 * Sekme başlığında gösterilecek metin. vNext component editör sekmelerinde
 * `.json` soneki gösterilmez; mümkünse `name` (uzantısız) kullanılır.
 */
export function getEditorTabDisplayTitle(tab: EditorTab): string {
  if (tab.kind === 'component') {
    return getVnextComponentEditorTabDisplayTitle(tab.name ?? '', {
      storedTitleWithJson: tab.title,
    });
  }
  if (tab.kind === 'workspace-config') {
    return 'vNext Config';
  }
  if (tab.kind === 'quickrun') {
    return tab.title;
  }
  return formatHyphenatedTabTitle(tab.title);
}
