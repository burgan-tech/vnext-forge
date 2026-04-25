import type { VnextExportCategory, VnextWorkspacePaths } from '@vnext-forge/app-contracts';

import type { ComponentFolderType } from '../component-icons/componentFolderTypes.js';
import { buildComponentFolderRelPaths } from '../project-workspace/componentFolderPathUtils.js';
import { VNEXT_ATOMIC_FLAT_GROUP } from './atomicComponentPaths.js';
import { discoverVnextComponentsByCategory, flowToExportCategory } from './vnextComponentDiscovery.js';

/** Target kind for atomic component editor routes. */
export type ComponentEditorTargetKind = 'task' | 'schema' | 'view' | 'function' | 'extension';

const EXPORT_CATEGORY_TO_KIND: Record<VnextExportCategory, ComponentEditorTargetKind | null> = {
  workflows: null,
  tasks: 'task',
  schemas: 'schema',
  views: 'view',
  functions: 'function',
  extensions: 'extension',
};

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Map discovered `.json` path to editor `group` + `name` (supports flat files under category root). */
export function componentPathToEditorRoute(
  absoluteFilePath: string,
  projectRoot: string,
  paths: VnextWorkspacePaths,
  category: VnextExportCategory,
): { group: string; name: string } | null {
  if (category === 'workflows') return null;
  const relPaths = buildComponentFolderRelPaths(paths);
  if (!relPaths) return null;
  const folderType = category as Exclude<ComponentFolderType, 'components_root'>;
  const folderRel = relPaths[folderType];
  if (!folderRel) return null;
  const abs = norm(absoluteFilePath);
  const base = norm(`${norm(projectRoot)}/${folderRel}`);
  if (abs.length < base.length + 2) return null;
  const prefix = `${base}/`;
  if (abs.length < prefix.length) return null;
  if (abs.toLowerCase().slice(0, prefix.length) !== prefix.toLowerCase()) return null;
  const rel = abs.slice(prefix.length);
  const parts = rel.split('/').filter(Boolean);
  if (parts.length < 1) return null;
  const last = parts[parts.length - 1]!;
  if (!/\.json$/i.test(last)) return null;
  const name = last.replace(/\.json$/i, '');
  if (!name) return null;
  /* Single file directly under category root → `group` = VNEXT_ATOMIC_FLAT_GROUP */
  if (parts.length === 1) {
    return { group: VNEXT_ATOMIC_FLAT_GROUP, name };
  }
  const group = parts.slice(0, -1).join('/');
  if (!group) return null;
  return { group, name };
}

export interface ResolveComponentTargetResult {
  kind: ComponentEditorTargetKind;
  group: string;
  name: string;
}

export type KeyFlowResolveFailure = 'not_found' | 'unmappable_path';

export type KeyFlowResolveOutcome =
  | { ok: true; target: ResolveComponentTargetResult }
  | { ok: false; failure: KeyFlowResolveFailure };

/** Resolve `key` + `flow` to editor route via workspace discovery. */
export async function resolveComponentEditorTargetByKeyFlowResult(
  projectId: string,
  projectRoot: string,
  paths: VnextWorkspacePaths,
  key: string,
  flow: string,
): Promise<KeyFlowResolveOutcome> {
  const category = flowToExportCategory(flow);
  if (!category || category === 'workflows') {
    return { ok: false, failure: 'not_found' };
  }
  const kind = EXPORT_CATEGORY_TO_KIND[category];
  if (!kind) {
    return { ok: false, failure: 'not_found' };
  }

  const items = await discoverVnextComponentsByCategory(projectId, category);
  const k = key.trim();
  const f = flow.trim();
  const match =
    items.find((i) => i.key === k && i.flow === f) ??
    items.find((i) => i.key === k) ??
    null;
  if (!match) {
    return { ok: false, failure: 'not_found' };
  }

  const route = componentPathToEditorRoute(match.path, projectRoot, paths, category);
  if (!route) {
    return { ok: false, failure: 'unmappable_path' };
  }
  return { ok: true, target: { kind, group: route.group, name: route.name } };
}

/** Convenience wrapper: returns `null` on failure. */
export async function resolveComponentEditorTargetByKeyFlow(
  projectId: string,
  projectRoot: string,
  paths: VnextWorkspacePaths,
  key: string,
  flow: string,
): Promise<ResolveComponentTargetResult | null> {
  const r = await resolveComponentEditorTargetByKeyFlowResult(
    projectId,
    projectRoot,
    paths,
    key,
    flow,
  );
  return r.ok ? r.target : null;
}
