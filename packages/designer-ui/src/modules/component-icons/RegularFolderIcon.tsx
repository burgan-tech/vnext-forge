import folderClosedSvg from '../../assets/icons/folder-glyphs/closed.svg?raw';
import folderOpenSvg from '../../assets/icons/folder-glyphs/open.svg?raw';
import { useResolvedColorTheme } from '../../hooks/useResolvedColorTheme.js';
import { cn } from '../../lib/utils/cn.js';
import { folderStyleVars, REGULAR_FOLDER_COLORS } from './folderIconTheme.js';
import { svgRootWithClass } from './svgRootWithClass.js';

const LAYER = 'block h-full w-full';

export interface RegularFolderIconProps {
  expanded: boolean;
  className?: string;
}

/**
 * Sıradan dizinler — tema duyarlı gri klasör (kapalı / iki katmanlı açık).
 */
export function RegularFolderIcon({
  expanded,
  className = 'size-3.5 shrink-0',
}: RegularFolderIconProps) {
  const theme = useResolvedColorTheme();
  const colors = REGULAR_FOLDER_COLORS[theme];
  const svg = expanded ? folderOpenSvg : folderClosedSvg;

  return (
    <span
      className={cn('relative inline-block', className)}
      style={folderStyleVars(colors)}
      aria-hidden>
      <span
        className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgRootWithClass(svg, LAYER) }}
      />
    </span>
  );
}
