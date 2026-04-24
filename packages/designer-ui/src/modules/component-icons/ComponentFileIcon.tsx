import badgeExtension from '../../assets/icons/component-badges/extension.svg?raw';
import badgeFunction from '../../assets/icons/component-badges/function.svg?raw';
import badgeSchema from '../../assets/icons/component-badges/schema.svg?raw';
import badgeTask from '../../assets/icons/component-badges/task.svg?raw';
import badgeView from '../../assets/icons/component-badges/view.svg?raw';
import badgeWorkflow from '../../assets/icons/component-badges/workflow.svg?raw';
import fileOutlineSvg from '../../assets/icons/component-file/outline.svg?raw';
import { useResolvedColorTheme } from '../../hooks/useResolvedColorTheme.js';
import type { VnextComponentType } from '../../shared/projectTypes.js';
import { cn } from '../../lib/utils/cn.js';
import { fileStyleVars, getFileColors } from './folderIconTheme.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FILE_LAYER_CLASS = 'block h-full w-full';

const FILE_BADGE_SVG: Record<VnextComponentType, string> = {
  workflow: badgeWorkflow,
  task: badgeTask,
  schema: badgeSchema,
  view: badgeView,
  function: badgeFunction,
  extension: badgeExtension,
};

interface ComponentFileIconProps {
  type: VnextComponentType;
  className?: string;
}

/**
 * vNext bileşen JSON dosyası ikonu — dolgulu sayfa silüeti, ilgili klasör türünün rengiyle eşleşir;
 * üzerindeki rozet aynı paletin "açık" tonu (badge).
 */
export function ComponentFileIcon({
  type,
  className = 'size-4 shrink-0',
}: ComponentFileIconProps) {
  const theme = useResolvedColorTheme();
  const colors = getFileColors(type, theme);
  const badge = FILE_BADGE_SVG[type];

  return (
    <span
      className={cn('relative inline-block', className)}
      style={fileStyleVars(colors)}
      aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(fileOutlineSvg, FILE_LAYER_CLASS) }}
      />
      <span
        className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ color: colors.badge }}
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badge, FILE_LAYER_CLASS) }}
      />
    </span>
  );
}
