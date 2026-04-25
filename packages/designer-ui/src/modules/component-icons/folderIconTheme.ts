import type { CSSProperties } from 'react';

import type { VnextComponentType } from '../../shared/projectTypes.js';
import type { ComponentFolderType } from './componentFolderTypes.js';

/** Klasör gövdesi + kontur + sağ-alt rozet (yüksek kontrast). */
export interface FolderColorSet {
  fill: string;
  fillBack: string;
  stroke: string;
  badge: string;
}

/** Tek dosya: yüzey + kontur + üzerine binecek rozet (klasör paletinin "açığı"). */
export interface FileColorSet {
  fill: string;
  stroke: string;
  badge: string;
}

/** Sıradan dizinler — bilerek baya açık gri tonları (yumuşak, kontrastı düşük kontur). */
export const REGULAR_FOLDER_COLORS: Record<'light' | 'dark', FolderColorSet> = {
  light: {
    fill: '#C5CDD8',
    fillBack: '#AEB7C3',
    stroke: '#6B7682',
    badge: '',
  },
  dark: {
    fill: '#CFD7E1',
    fillBack: '#B8C2CE',
    stroke: '#7C8794',
    badge: '',
  },
};

/**
 * Her vNext klasör türü kendine özgü renk; rozet ilgili tonun çok açık yüzey rengi (okunabilirlik).
 */
export const VNEXT_FOLDER_PALETTE: Record<ComponentFolderType, Record<'light' | 'dark', FolderColorSet>> = {
  workflows: {
    light: {
      fill: '#7C3AED',
      fillBack: '#6D28D9',
      stroke: '#3B0764',
      badge: '#F5F3FF',
    },
    dark: {
      fill: '#8B5CF6',
      fillBack: '#7C3AED',
      stroke: '#EDE9FE',
      badge: '#FAF5FF',
    },
  },
  tasks: {
    light: {
      fill: '#EA580C',
      fillBack: '#C2410C',
      stroke: '#7C2D12',
      badge: '#FFEDD5',
    },
    dark: {
      fill: '#FB923C',
      fillBack: '#F97316',
      stroke: '#FFEDD5',
      badge: '#FFF7ED',
    },
  },
  schemas: {
    light: {
      fill: '#0E7490',
      fillBack: '#0F766E',
      stroke: '#134E4A',
      badge: '#ECFEFF',
    },
    dark: {
      fill: '#22D3EE',
      fillBack: '#06B6D4',
      stroke: '#CFFAFE',
      badge: '#F0FDFF',
    },
  },
  views: {
    light: {
      fill: '#16A34A',
      fillBack: '#15803D',
      stroke: '#14532D',
      badge: '#DCFCE7',
    },
    dark: {
      fill: '#4ADE80',
      fillBack: '#22C55E',
      stroke: '#DCFCE7',
      badge: '#F0FDF4',
    },
  },
  functions: {
    light: {
      fill: '#2563EB',
      fillBack: '#1D4ED8',
      stroke: '#1E3A8A',
      badge: '#DBEAFE',
    },
    dark: {
      fill: '#60A5FA',
      fillBack: '#3B82F6',
      stroke: '#DBEAFE',
      badge: '#EFF6FF',
    },
  },
  extensions: {
    light: {
      fill: '#E11D48',
      fillBack: '#BE123C',
      stroke: '#831843',
      badge: '#FFE4E6',
    },
    dark: {
      fill: '#FB7185',
      fillBack: '#F43F5E',
      stroke: '#FFE4E6',
      badge: '#FFF1F2',
    },
  },
  components_root: {
    light: {
      fill: '#9333EA',
      fillBack: '#7E22CE',
      stroke: '#581C87',
      badge: '#FAE8FF',
    },
    dark: {
      fill: '#C084FC',
      fillBack: '#A855F7',
      stroke: '#F3E8FF',
      badge: '#FAF5FF',
    },
  },
};

export function folderStyleVars(c: FolderColorSet): CSSProperties {
  return {
    ['--folder-fill' as string]: c.fill,
    ['--folder-fill-back' as string]: c.fillBack,
    ['--folder-stroke' as string]: c.stroke,
  };
}

/** Dosya türü -> klasör paleti (singular `VnextComponentType` + `vnext.config.json`). */
const FILE_TO_FOLDER: Record<VnextComponentType, ComponentFolderType> = {
  workflow: 'workflows',
  task: 'tasks',
  schema: 'schemas',
  view: 'views',
  function: 'functions',
  extension: 'extensions',
};

/** Dosya rengi klasör rengi ile birebir; rozet aynı tonun çok açık `badge` değeri. */
export function getFileColors(
  type: VnextComponentType | 'config',
  theme: 'light' | 'dark',
): FileColorSet {
  const folderType: ComponentFolderType =
    type === 'config' ? 'components_root' : FILE_TO_FOLDER[type];
  const pal = VNEXT_FOLDER_PALETTE[folderType][theme];
  return { fill: pal.fill, stroke: pal.stroke, badge: pal.badge };
}

export function fileStyleVars(c: FileColorSet): CSSProperties {
  return {
    ['--file-fill' as string]: c.fill,
    ['--file-stroke' as string]: c.stroke,
  };
}
