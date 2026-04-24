import type { VnextWorkspacePaths } from '../workspace/types.js';

import type { VnextExportCategory } from '@vnext-forge/app-contracts';

/**
 * designer-ui `componentFolderPathUtils.buildComponentFolderRelPaths` ile aynı mantık:
 * vnext.config `paths` → proje köküne göre POSIX rel yollar.
 */
export type ComponentFolderType = 'components_root' | VnextExportCategory;

const LAYOUT_DEFAULTS: Record<VnextExportCategory, string> = {
  workflows: 'Workflows',
  tasks: 'Tasks',
  schemas: 'Schemas',
  views: 'Views',
  functions: 'Functions',
  extensions: 'Extensions',
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

  for (const key of Object.keys(LAYOUT_DEFAULTS) as VnextExportCategory[]) {
    const raw = paths[key];
    const segment =
      raw != null && String(raw).trim() !== '' ? normPosixRel(String(raw)) : LAYOUT_DEFAULTS[key];
    if (!segment) continue;
    out[key] = joinUnderComponentsRoot(root, segment);
  }

  return out;
}
