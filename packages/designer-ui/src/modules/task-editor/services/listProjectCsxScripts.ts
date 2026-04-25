import { isFailure, success, type ApiResponse } from '@vnext-forge/app-contracts';

import type { FileTreeNode } from '../../../shared/projectTypes.js';
import { getProjectTree } from '../../project-workspace/WorkspaceApi.js';
import { normalizePosixPath, toProjectRelativePath } from '../scriptTaskPaths.js';

export interface ListedCsxScript {
  absolutePath: string;
  projectRelative: string;
}

function walkTree(
  node: FileTreeNode,
  acc: { path: string; name: string; type: 'file' | 'directory' }[],
): void {
  if (node.type === 'file') {
    acc.push({ path: node.path, name: node.name, type: node.type });
    return;
  }
  if (node.children) {
    for (const child of node.children) {
      walkTree(child, acc);
    }
  }
}

/** Pure helper: build list after `getProjectTree` (shared with tests). */
export function collectListedCsxFromTree(
  root: FileTreeNode,
  projectPath: string,
): ListedCsxScript[] {
  const flat: { path: string; name: string; type: 'file' | 'directory' }[] = [];
  walkTree(root, flat);

  const rootNorm = normalizePosixPath(projectPath).replace(/\/$/, '');
  const csxFiles = flat.filter(
    (f) => f.type === 'file' && f.name.toLowerCase().endsWith('.csx'),
  );

  const listed: ListedCsxScript[] = csxFiles.map((f) => {
    const absolutePath = normalizePosixPath(f.path);
    return {
      absolutePath,
      projectRelative: toProjectRelativePath(rootNorm, absolutePath),
    };
  });

  listed.sort((a, b) => a.projectRelative.localeCompare(b.projectRelative, undefined, { sensitivity: 'base' }));

  return listed;
}

export async function listProjectCsxScripts(
  projectId: string,
  projectPath: string,
): Promise<ApiResponse<ListedCsxScript[]>> {
  const treeRes = await getProjectTree(projectId);
  if (isFailure(treeRes)) return treeRes;
  return success(collectListedCsxFromTree(treeRes.data, projectPath));
}
