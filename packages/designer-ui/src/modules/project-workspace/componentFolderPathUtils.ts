import type { VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';

import type { ComponentFolderType } from '../component-icons/componentFolderTypes.js';
import type { VnextComponentType } from '../../shared/projectTypes.js';

const LAYOUT_DEFAULTS: Record<Exclude<ComponentFolderType, 'components_root'>, string> = {
  workflows: 'Workflows',
  tasks: 'Tasks',
  schemas: 'Schemas',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
};

const MATCH_ORDER: ComponentFolderType[] = [
  'workflows',
  'tasks',
  'schemas',
  'views',
  'functions',
  'extensions',
  'components_root',
];

const FOLDER_TYPE_TO_VNEXT: Record<Exclude<ComponentFolderType, 'components_root'>, VnextComponentType> = {
  workflows: 'workflow',
  tasks: 'task',
  schemas: 'schema',
  views: 'view',
  functions: 'function',
  extensions: 'extension',
};

export type ComponentTreeClassification = {
  folderType: Exclude<ComponentFolderType, 'components_root'>;
  componentKind: VnextComponentType;
  /** True when `nodePath` is exactly the configured component-type root (e.g. `…/Tasks`). */
  isComponentTypeRoot: boolean;
};

function normPosixRel(s: string): string {
  return s
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .replace(/\/*$/, '');
}

function joinUnderComponentsRoot(componentsRootRel: string, segment: string): string {
  const root = normPosixRel(componentsRootRel);
  const seg = normPosixRel(segment);
  return seg ? `${root}/${seg}` : root;
}

/**
 * vnext.config.json paths → expected folder paths relative to project root.
 */
export function buildComponentFolderRelPaths(
  paths: VnextWorkspacePaths | undefined | null,
): Partial<Record<ComponentFolderType, string>> | undefined {
  if (!paths) return undefined;
  const rootRaw = paths.componentsRoot;
  if (rootRaw == null || !String(rootRaw).trim()) return undefined;
  const root = normPosixRel(String(rootRaw));
  if (!root) return undefined;

  const out: Partial<Record<ComponentFolderType, string>> = {
    components_root: root,
  };

  for (const key of Object.keys(LAYOUT_DEFAULTS) as (keyof typeof LAYOUT_DEFAULTS)[]) {
    const raw = paths[key];
    const segment =
      raw != null && String(raw).trim() !== ''
        ? normPosixRel(String(raw))
        : LAYOUT_DEFAULTS[key];
    if (!segment) continue;
    out[key] = joinUnderComponentsRoot(root, segment);
  }

  return out;
}

function projectRelativePosix(nodePath: string, projectRoot: string): string | null {
  const n = nodePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const r = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  if (n.length < r.length) return null;
  if (n.toLowerCase() === r.toLowerCase()) return '';
  if (!n.toLowerCase().startsWith(`${r.toLowerCase()}/`)) return null;
  return n.slice(r.length + 1);
}

/**
 * Only exact path matches (component-type roots) — used for file-tree icons.
 */
export function matchComponentFolderType(
  nodePath: string,
  projectRoot: string | undefined,
  relPaths: Partial<Record<ComponentFolderType, string>> | undefined,
): ComponentFolderType | undefined {
  if (!projectRoot || !relPaths) return undefined;
  const rel = projectRelativePosix(nodePath, projectRoot);
  if (rel == null) return undefined;

  const lower = rel.toLowerCase();
  for (const type of MATCH_ORDER) {
    const expected = relPaths[type];
    if (!expected) continue;
    if (lower === expected.toLowerCase()) return type;
  }
  return undefined;
}

/**
 * Bileşen türü kökü veya o ağaçtaki herhangi bir alt yol.
 * Kök: `isComponentTypeRoot: true` — vNext tür-bazlı “create” yalnızca alt klasörde gösterilir.
 */
export function classifyComponentTreePath(
  nodePath: string,
  projectRoot: string,
  relPaths: Partial<Record<ComponentFolderType, string>> | undefined,
): ComponentTreeClassification | null {
  if (!relPaths) return null;
  const rel = projectRelativePosix(nodePath, projectRoot);
  if (rel === null) return null;
  const lower = rel.toLowerCase();

  for (const type of MATCH_ORDER) {
    if (type === 'components_root') continue;
    const expected = relPaths[type];
    if (!expected) continue;
    const exp = expected.toLowerCase();
    if (lower === exp) {
      return {
        folderType: type,
        componentKind: FOLDER_TYPE_TO_VNEXT[type],
        isComponentTypeRoot: true,
      };
    }
    if (lower.startsWith(`${exp}/`)) {
      return {
        folderType: type,
        componentKind: FOLDER_TYPE_TO_VNEXT[type],
        isComponentTypeRoot: false,
      };
    }
  }
  return null;
}

/**
 * vNext "…Create" sadece **domain** klasöründe: bileşen türü kökünün hemen altındaki
 * tek path segmenti (`…/Extensions/account-opening`). `…/Extensions/account-opening/src` → null.
 */
export function matchVnextDomainComponentFolder(
  nodePath: string,
  projectRoot: string,
  relPaths: Partial<Record<ComponentFolderType, string>> | undefined,
): ComponentTreeClassification | null {
  if (!relPaths) return null;
  const rel = projectRelativePosix(nodePath, projectRoot);
  if (rel === null) return null;
  const lower = rel.toLowerCase();

  for (const type of MATCH_ORDER) {
    if (type === 'components_root') continue;
    const expected = relPaths[type];
    if (!expected) continue;
    const exp = expected.toLowerCase();
    if (!lower.startsWith(`${exp}/`)) continue;
    const after = lower.slice(exp.length + 1);
    if (after.length === 0) continue;
    if (after.includes('/')) continue;
    return {
      folderType: type,
      componentKind: FOLDER_TYPE_TO_VNEXT[type],
      isComponentTypeRoot: false,
    };
  }
  return null;
}
