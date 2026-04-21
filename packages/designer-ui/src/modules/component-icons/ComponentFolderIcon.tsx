import folderBadgeComponentsRoot from '../../assets/icons/component-folder/badges/components-root.svg?raw';
import folderBadgeExtensions from '../../assets/icons/component-folder/badges/extensions.svg?raw';
import folderBadgeFunctions from '../../assets/icons/component-folder/badges/functions.svg?raw';
import folderBadgeSchemas from '../../assets/icons/component-folder/badges/schemas.svg?raw';
import folderBadgeTasks from '../../assets/icons/component-folder/badges/tasks.svg?raw';
import folderBadgeViews from '../../assets/icons/component-folder/badges/views.svg?raw';
import folderBadgeWorkflows from '../../assets/icons/component-folder/badges/workflows.svg?raw';
import folderClosedSvg from '../../assets/icons/component-folder/closed.svg?raw';
import folderOpenSvg from '../../assets/icons/component-folder/open.svg?raw';
import { cn } from '../../lib/utils/cn.js';
import type { ComponentFolderType } from './componentFolderTypes.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FOLDER_LAYER_CLASS = 'block h-full w-full';

const FOLDER_BADGE_SVG: Record<ComponentFolderType, string> = {
  workflows: folderBadgeWorkflows,
  tasks: folderBadgeTasks,
  schemas: folderBadgeSchemas,
  views: folderBadgeViews,
  functions: folderBadgeFunctions,
  extensions: folderBadgeExtensions,
  components_root: folderBadgeComponentsRoot,
};

interface ComponentFolderIconProps {
  type: ComponentFolderType;
  expanded: boolean;
  className?: string;
}

/**
 * Icon for a vNext component folder (workflows, tasks, schemas, views,
 * functions, extensions or the configurable components root).
 *
 * SVG shapes live under `src/assets/icons/component-folder/`; this component composes
 * the folder glyph and type badge for `currentColor` on the folder stroke.
 */
export function ComponentFolderIcon({
  type,
  expanded,
  className = 'size-3.5 shrink-0',
}: ComponentFolderIconProps) {
  const base = expanded ? folderOpenSvg : folderClosedSvg;
  const badge = FOLDER_BADGE_SVG[type];

  return (
    <span className={cn('relative inline-block', className)} aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        // Local SVG assets only (bundled via Vite `?raw`).
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(base, FOLDER_LAYER_CLASS) }}
      />
      <span
        className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badge, FOLDER_LAYER_CLASS) }}
      />
    </span>
  );
}
