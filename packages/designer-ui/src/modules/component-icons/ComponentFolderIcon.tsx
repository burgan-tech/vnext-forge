import badgeComponentsRoot from '../../assets/icons/component-badges/components-root.svg?raw';
import badgeExtension from '../../assets/icons/component-badges/extension.svg?raw';
import badgeFunction from '../../assets/icons/component-badges/function.svg?raw';
import badgeSchema from '../../assets/icons/component-badges/schema.svg?raw';
import badgeTask from '../../assets/icons/component-badges/task.svg?raw';
import badgeView from '../../assets/icons/component-badges/view.svg?raw';
import badgeWorkflow from '../../assets/icons/component-badges/workflow.svg?raw';
import folderClosedSvg from '../../assets/icons/component-folder/closed.svg?raw';
import folderOpenSvg from '../../assets/icons/component-folder/open.svg?raw';
import { cn } from '../../lib/utils/cn.js';
import type { ComponentFolderType } from './componentFolderTypes.js';
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
 * Icon for a vNext component folder (workflows, tasks, schemas, views,
 * functions, extensions or the configurable components root).
 *
 * Folder glyphs live under `src/assets/icons/component-folder/`; type badges are shared
 * with file icons under `src/assets/icons/component-badges/`.
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
