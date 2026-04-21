import vnextConfigFileSvg from '../../assets/icons/vnext-config/file.svg?raw';
import { cn } from '../../lib/utils/cn.js';
import { svgRootWithClass } from './svgRootWithClass.js';

interface VnextConfigFileIconProps {
  className?: string;
}

/** Icon for `vnext.config.json` (file outline + gear glyph). */
export function VnextConfigFileIcon({
  className = 'size-4 shrink-0',
}: VnextConfigFileIconProps) {
  return (
    <span
      className={cn('inline-flex', className)}
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: svgRootWithClass(vnextConfigFileSvg, 'block h-full w-full'),
      }}
    />
  );
}
