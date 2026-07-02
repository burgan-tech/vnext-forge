import { useResolvedColorTheme } from '@vnext-forge-studio/designer-ui/hooks';
import {
  workflowIcon,
  taskIcon,
  functionIcon,
  extensionIcon,
  schemaIcon,
  viewIcon,
  VNEXT_FOLDER_PALETTE,
} from '@vnext-forge-studio/designer-ui/component-icons';

const BADGE_SVG: Record<string, string> = {
  workflow: workflowIcon,
  task: taskIcon,
  function: functionIcon,
  extension: extensionIcon,
  schema: schemaIcon,
  view: viewIcon,
  mapping: functionIcon,
};

const TYPE_TO_FOLDER: Record<string, keyof typeof VNEXT_FOLDER_PALETTE> = {
  workflow: 'workflows',
  task: 'tasks',
  function: 'functions',
  extension: 'extensions',
  schema: 'schemas',
  view: 'views',
  mapping: 'mappings',
};

interface ComponentBadgeIconProps {
  type: string;
  className?: string;
  /** Pass false to suppress the palette color and let CSS (e.g. text-muted-foreground) control the color. */
  colored?: boolean;
}

export function ComponentBadgeIcon({ type, className = 'h-5 w-5', colored = true }: ComponentBadgeIconProps) {
  const svg = BADGE_SVG[type];
  const theme = useResolvedColorTheme();
  const folderKey = TYPE_TO_FOLDER[type];
  const color =
    colored && folderKey
      ? VNEXT_FOLDER_PALETTE[folderKey][theme === 'dark' ? 'dark' : 'light'].fill
      : undefined;

  if (!svg) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      style={color ? { color } : undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden
    />
  );
}
