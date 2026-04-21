import badgeSettings from '../../assets/icons/component-badges/settings.svg?raw';
import fileOutlineSvg from '../../assets/icons/component-file/outline.svg?raw';
import { cn } from '../../lib/utils/cn.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FILE_LAYER_CLASS = 'block h-full w-full';

interface VnextConfigFileIconProps {
  className?: string;
}

/** Icon for `vnext.config.json`: shared file outline + settings badge (same layering as component file icons). */
export function VnextConfigFileIcon({
  className = 'size-4 shrink-0',
}: VnextConfigFileIconProps) {
  return (
    <span className={cn('relative inline-block', className)} aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(fileOutlineSvg, FILE_LAYER_CLASS) }}
      />
      <span
        className="pointer-events-none absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badgeSettings, FILE_LAYER_CLASS) }}
      />
    </span>
  );
}
