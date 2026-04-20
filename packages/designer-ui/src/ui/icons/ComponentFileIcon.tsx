import type { ReactNode } from 'react';

import type { VnextComponentType } from '../../shared/projectTypes.js';

interface ComponentFileIconProps {
  type: VnextComponentType;
  className?: string;
}

const FILE_OUTLINE_TOP =
  'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z';
const FILE_OUTLINE_FOLD = 'M14 2v4a1 1 0 0 0 1 1h4';

interface BadgeConfig {
  color: string;
  render: (color: string) => ReactNode;
}

const BADGE_CONFIGS: Record<VnextComponentType, BadgeConfig> = {
  workflow: {
    color: '#a78bfa',
    render: (c) => (
      <g transform="translate(9,10) scale(0.5)">
        <rect width="8" height="8" x="3" y="3" rx="2" stroke={c} strokeWidth="2.8" fill="none" />
        <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke={c} strokeWidth="2.8" fill="none" />
        <rect
          width="8"
          height="8"
          x="13"
          y="13"
          rx="2"
          stroke={c}
          strokeWidth="2.8"
          fill="none"
        />
      </g>
    ),
  },
  task: {
    color: '#f97316',
    render: (c) => (
      <g transform="translate(8.5,9.5) scale(0.55)">
        <path d="m18 16 4-4-4-4" stroke={c} strokeWidth="3.2" fill="none" />
        <path d="m6 8-4 4 4 4" stroke={c} strokeWidth="3.2" fill="none" />
      </g>
    ),
  },
  schema: {
    color: '#06b6d4',
    render: (c) => (
      <g transform="translate(8,10) scale(0.52)">
        <path d="M21.801 10A10 10 0 1 1 17 3.335" stroke={c} strokeWidth="2.8" fill="none" />
        <path d="m9 11 3 3L22 4" stroke={c} strokeWidth="2.8" fill="none" />
      </g>
    ),
  },
  view: {
    color: '#22c55e',
    render: (c) => (
      <g transform="translate(7.5,10) scale(0.52)">
        <path
          d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
          stroke={c}
          strokeWidth="2.8"
          fill="none"
        />
        <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2.8" fill="none" />
      </g>
    ),
  },
  function: {
    color: '#3b82f6',
    render: (c) => (
      <g transform="translate(8.5,9.5) scale(0.55)">
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
  extension: {
    color: '#f43f5e',
    render: (c) => (
      <g transform="translate(9,10) scale(0.5)">
        <rect width="7" height="7" x="14" y="3" rx="1" stroke={c} strokeWidth="2.8" fill="none" />
        <path
          d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"
          stroke={c}
          strokeWidth="2.8"
          fill="none"
        />
      </g>
    ),
  },
};

/**
 * Inline SVG icon for a single vNext component file (workflow, task, schema,
 * view, function or extension JSON). Replaces the legacy `<img src=".svg">`
 * approach so the icon ships with the bundle and works offline / inside the
 * VS Code webview where /folder_icons/* is not served.
 */
export function ComponentFileIcon({
  type,
  className = 'size-4 shrink-0',
}: ComponentFileIconProps) {
  const badge = BADGE_CONFIGS[type];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}>
      <path d={FILE_OUTLINE_TOP} />
      <path d={FILE_OUTLINE_FOLD} />
      {badge.render(badge.color)}
    </svg>
  );
}
