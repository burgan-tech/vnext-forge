import type { ReactNode } from 'react';

import type { ComponentFolderType } from './componentFolderTypes.js';

interface ComponentFolderIconProps {
  type: ComponentFolderType;
  expanded: boolean;
  className?: string;
}

const CLOSED_FOLDER_D =
  'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

const OPEN_FOLDER_D =
  'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2';

interface BadgeConfig {
  color: string;
  render: (color: string) => ReactNode;
}

const BADGE_CONFIGS: Record<ComponentFolderType, BadgeConfig> = {
  workflows: {
    color: '#a78bfa',
    render: (c) => (
      <g transform="translate(9,8) scale(0.55)">
        <rect width="8" height="8" x="3" y="3" rx="2" stroke={c} strokeWidth="2.5" fill="none" />
        <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke={c} strokeWidth="2.5" fill="none" />
        <rect
          width="8"
          height="8"
          x="13"
          y="13"
          rx="2"
          stroke={c}
          strokeWidth="2.5"
          fill="none"
        />
      </g>
    ),
  },
  tasks: {
    color: '#f97316',
    render: (c) => (
      <g transform="translate(8.5,7) scale(0.6)">
        <path d="m18 16 4-4-4-4" stroke={c} strokeWidth="3.2" fill="none" />
        <path d="m6 8-4 4 4 4" stroke={c} strokeWidth="3.2" fill="none" />
      </g>
    ),
  },
  schemas: {
    color: '#06b6d4',
    render: (c) => (
      <g transform="translate(8.5,7.5) scale(0.58)">
        <path d="M21.801 10A10 10 0 1 1 17 3.335" stroke={c} strokeWidth="2.5" fill="none" />
        <path d="m9 11 3 3L22 4" stroke={c} strokeWidth="2.5" fill="none" />
      </g>
    ),
  },
  views: {
    color: '#22c55e',
    render: (c) => (
      <g transform="translate(8,8) scale(0.58)">
        <path
          d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
          stroke={c}
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2.5" fill="none" />
      </g>
    ),
  },
  functions: {
    color: '#3b82f6',
    render: (c) => (
      <g transform="translate(8.5,7) scale(0.6)">
        <path
          d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"
          stroke={c}
          strokeWidth="3.2"
          fill="none"
        />
        <path
          d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"
          stroke={c}
          strokeWidth="3.2"
          fill="none"
        />
      </g>
    ),
  },
  extensions: {
    color: '#f43f5e',
    render: (c) => (
      <g transform="translate(9,8) scale(0.55)">
        <rect width="7" height="7" x="14" y="3" rx="1" stroke={c} strokeWidth="2.5" fill="none" />
        <path
          d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"
          stroke={c}
          strokeWidth="2.5"
          fill="none"
        />
      </g>
    ),
  },
  components_root: {
    color: '#8b5cf6',
    render: (c) => (
      <g transform="translate(8.5,7) scale(0.55)">
        <path d="M12 3 2 7.5l10 4.5 10-4.5Z" stroke={c} strokeWidth="2.5" fill="none" />
        <path d="m2 17.5 10 4.5 10-4.5" stroke={c} strokeWidth="2.5" fill="none" />
        <path d="m2 12.5 10 4.5 10-4.5" stroke={c} strokeWidth="2.5" fill="none" />
      </g>
    ),
  },
};

/**
 * Inline SVG icon for a vNext component folder (workflows, tasks, schemas,
 * views, functions, extensions or the configurable components root).
 *
 * Lives in `designer-ui` so both the web file tree and any future shell
 * (extension webview, alternative editors) share one source of truth for
 * component-type iconography.
 */
export function ComponentFolderIcon({
  type,
  expanded,
  className = 'size-3.5 shrink-0',
}: ComponentFolderIconProps) {
  const badge = BADGE_CONFIGS[type];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}>
      <path d={expanded ? OPEN_FOLDER_D : CLOSED_FOLDER_D} />
      {badge.render(badge.color)}
    </svg>
  );
}
