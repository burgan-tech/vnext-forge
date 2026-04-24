import badgeSettings from '../../assets/icons/component-badges/settings.svg?raw';
import fileOutlineSvg from '../../assets/icons/component-file/outline.svg?raw';
import { useResolvedColorTheme } from '../../hooks/useResolvedColorTheme.js';
import { cn } from '../../lib/utils/cn.js';
import { fileStyleVars, getFileColors } from './folderIconTheme.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const FILE_LAYER_CLASS = 'block h-full w-full';

interface VnextConfigFileIconProps {
  className?: string;
}

/**
 * `vnext.config.json` — `components_root` (mor) klasör paletiyle hizalı dolgulu dosya + ayar rozeti.
 */
export function VnextConfigFileIcon({
  className = 'size-4 shrink-0',
}: VnextConfigFileIconProps) {
  const theme = useResolvedColorTheme();
  const colors = getFileColors('config', theme);
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
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(badgeSettings, FILE_LAYER_CLASS) }}
      />
    </span>
  );
}
