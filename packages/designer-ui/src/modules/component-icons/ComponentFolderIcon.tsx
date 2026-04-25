import folderClosedSvg from '../../assets/icons/folder-glyphs/closed.svg?raw';
import folderOpenSvg from '../../assets/icons/folder-glyphs/open.svg?raw';
import badgeComponentsRoot from '../../assets/icons/component-folder-badges/components-root.svg?raw';
import badgeExtension from '../../assets/icons/component-folder-badges/extension.svg?raw';
import badgeFunction from '../../assets/icons/component-folder-badges/function.svg?raw';
import badgeSchema from '../../assets/icons/component-folder-badges/schema.svg?raw';
import badgeTask from '../../assets/icons/component-folder-badges/task.svg?raw';
import badgeView from '../../assets/icons/component-folder-badges/view.svg?raw';
import badgeWorkflow from '../../assets/icons/component-folder-badges/workflow.svg?raw';
import { useResolvedColorTheme } from '../../hooks/useResolvedColorTheme.js';
import { cn } from '../../lib/utils/cn.js';
import type { ComponentFolderType } from './componentFolderTypes.js';
import { folderStyleVars, VNEXT_FOLDER_PALETTE } from './folderIconTheme.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FOLDER_LAYER_CLASS = 'block h-full w-full';

const FOLDER_BADGE_SVG: Record<ComponentFolderType, string> = {
  workflows: badgeWorkflow,
  tasks: badgeTask,
  schemas: badgeSchema,
  views: badgeView,
  functions: badgeFunction,
  extensions: badgeExtension,
  components_root: badgeComponentsRoot,
};

interface ComponentFolderIconProps {
  type: ComponentFolderType;
  expanded: boolean;
  className?: string;
}

/**
 * vNext bileşen klasörü: türe özel renk + tema (light/dark) + sağ altta yüksek kontrast rozet.
 */
export function ComponentFolderIcon({
  type,
  expanded,
  className = 'size-3.5 shrink-0',
}: ComponentFolderIconProps) {
  const theme = useResolvedColorTheme();
  const pal = VNEXT_FOLDER_PALETTE[type][theme];
  const base = expanded ? folderOpenSvg : folderClosedSvg;
  const badge = FOLDER_BADGE_SVG[type];

  return (
    <span
      className={cn('relative inline-block', className)}
      style={folderStyleVars(pal)}
      aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(base, FOLDER_LAYER_CLASS) }}
      />
      <span
        className="pointer-events-none absolute bottom-[6%] right-[6%] flex h-[58%] w-[58%] items-end justify-end [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ color: pal.badge }}
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badge, FOLDER_LAYER_CLASS) }}
      />
    </span>
  );
}
