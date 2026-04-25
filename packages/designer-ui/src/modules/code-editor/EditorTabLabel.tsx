import type { ReactNode } from 'react';

import { ComponentFileIcon } from '../component-icons/ComponentFileIcon.js';
import { VnextConfigFileIcon } from '../component-icons/VnextConfigFileIcon.js';

import { componentEditorKindToVnextComponentType, getEditorTabDisplayTitle } from './editorTabPresentation.js';
import type { EditorTab } from './EditorStore.js';

export interface EditorTabLabelProps {
  tab: EditorTab;
  /** `kind === 'file'` sekmeleri için (dil bazlı ikon). */
  renderFileLeading?: (language: string) => ReactNode;
  /** Görünen başlık `<span>` öğesi için sınıf (ör. `truncate`). */
  titleClassName?: string;
}

/**
 * Proje editörü sekme çubuğunda başlık + sol ikon mantığını tek yerde toplar:
 * - vNext component: `outline.svg` + tür rozeti (`ComponentFileIcon`)
 * - dosya: host’un verdiği `renderFileLeading` (örn. dil etiketi)
 */
export function EditorTabLabel({ tab, renderFileLeading, titleClassName }: EditorTabLabelProps) {
  const title = getEditorTabDisplayTitle(tab);

  let leading: ReactNode = null;
  if (tab.kind === 'file' && tab.language && renderFileLeading) {
    leading = renderFileLeading(tab.language);
  } else if (tab.kind === 'component' && tab.componentKind) {
    leading = (
      <ComponentFileIcon
        type={componentEditorKindToVnextComponentType(tab.componentKind)}
        className="size-4 shrink-0"
      />
    );
  } else if (tab.kind === 'workspace-config') {
    leading = <VnextConfigFileIcon className="size-4 shrink-0" />;
  }

  return (
    <>
      {leading}
      <span className={titleClassName}>{title}</span>
    </>
  );
}
