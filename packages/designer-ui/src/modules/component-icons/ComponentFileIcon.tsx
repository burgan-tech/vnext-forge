import fileBadgeExtension from '../../assets/icons/component-file/badges/extension.svg?raw';
import fileBadgeFunction from '../../assets/icons/component-file/badges/function.svg?raw';
import fileBadgeSchema from '../../assets/icons/component-file/badges/schema.svg?raw';
import fileBadgeTask from '../../assets/icons/component-file/badges/task.svg?raw';
import fileBadgeView from '../../assets/icons/component-file/badges/view.svg?raw';
import fileBadgeWorkflow from '../../assets/icons/component-file/badges/workflow.svg?raw';
import fileOutlineSvg from '../../assets/icons/component-file/outline.svg?raw';
import type { VnextComponentType } from '../../shared/projectTypes.js';
import { cn } from '../../lib/utils/cn.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FILE_LAYER_CLASS = 'block h-full w-full';

const FILE_BADGE_SVG: Record<VnextComponentType, string> = {
  workflow: fileBadgeWorkflow,
  task: fileBadgeTask,
  schema: fileBadgeSchema,
  view: fileBadgeView,
  function: fileBadgeFunction,
  extension: fileBadgeExtension,
};

interface ComponentFileIconProps {
  type: VnextComponentType;
  className?: string;
}

/**
 * Icon for a vNext component JSON file (workflow, task, schema, view,
 * function or extension). SVG assets ship with the bundle (no host `/folder_icons` path).
 */
export function ComponentFileIcon({
  type,
  className = 'size-4 shrink-0',
}: ComponentFileIconProps) {
  const badge = FILE_BADGE_SVG[type];

  return (
    <span className={cn('relative inline-block', className)} aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(fileOutlineSvg, FILE_LAYER_CLASS) }}
      />
      <span
        className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badge, FILE_LAYER_CLASS) }}
      />
    </span>
  );
}
