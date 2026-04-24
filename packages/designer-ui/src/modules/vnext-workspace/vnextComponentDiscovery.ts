import type { VnextWorkspacePaths } from '@vnext-forge/app-contracts';
import { isFailure } from '@vnext-forge/app-contracts';

import type { FileTreeNode } from '../../shared/projectTypes.js';
import type { ComponentFolderType } from '../component-icons/componentFolderTypes.js';
import { buildComponentFolderRelPaths } from '../project-workspace/componentFolderPathUtils.js';
import { getProjectTree, readFile } from '../project-workspace/WorkspaceApi.js';

/** `exports` alanındaki kategori anahtarları ile birebir uyumlu. */
export type VnextExportCategory = Exclude<ComponentFolderType, 'components_root'>;

const FOLDER_MATCH_ORDER: VnextExportCategory[] = [
  'workflows',
  'tasks',
  'schemas',
  'views',
  'functions',
  'extensions',
];

/** vNext JSON `flow` → vnext.config `exports` kategorisi. */
export const VNEXT_FLOW_TO_EXPORT_CATEGORY: Record<string, VnextExportCategory> = {
  'sys-flows': 'workflows',
  'sys-tasks': 'tasks',
  'sys-schemas': 'schemas',
  'sys-views': 'views',
  'sys-functions': 'functions',
  'sys-extensions': 'extensions',
};

export interface DiscoveredVnextComponent {
  key: string;
  path: string;
  flow: string;
  version?: string;
}

export type VnextComponentsByCategory = Record<VnextExportCategory, DiscoveredVnextComponent[]>;

export interface VnextComponentsDiscoveryResult {
  components: VnextComponentsByCategory;
}

function emptyBuckets(): VnextComponentsByCategory {
  return {
    workflows: [],
    tasks: [],
    schemas: [],
    views: [],
    functions: [],
    extensions: [],
  };
}

function normPosixRel(s: string): string {
  return s
    .replace(/\\/g, '/')
    .replace(/^\/*/, '')
    .replace(/\/*$/, '');
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
 * Ağaçta `paths` ile eşleşen kök altındaki `.json` dosyalarını kategori ile döndürür.
 */
export function collectJsonCandidatesUnderPathRoots(
  tree: FileTreeNode,
  projectRoot: string,
  relPaths: Partial<Record<ComponentFolderType, string>>,
): { path: string; category: VnextExportCategory }[] {
  const out: { path: string; category: VnextExportCategory }[] = [];

  const visit = (node: FileTreeNode) => {
    if (node.type === 'file' && /\.json$/i.test(node.name)) {
      const rel = projectRelativePosix(node.path, projectRoot);
      if (rel == null) return;
      const relLower = rel.toLowerCase();

      for (const type of FOLDER_MATCH_ORDER) {
        const expected = relPaths[type];
        if (!expected) continue;
        const exp = normPosixRel(expected).toLowerCase();
        if (!exp) continue;
        if (relLower === exp || relLower.startsWith(`${exp}/`)) {
          out.push({ path: node.path, category: type });
          return;
        }
      }
    }
    if (node.children) {
      for (const c of node.children) visit(c);
    }
  };

  visit(tree);
  return out;
}

/**
 * Ham JSON metninden `key` / `flow` (ve varsa `version`) okur; geçersizse `null`.
 */
export function parseVnextComponentJson(content: string): {
  key: string;
  flow: string;
  version?: string;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  const key = rec.key;
  const flow = rec.flow;
  if (typeof key !== 'string' || !key.trim()) return null;
  if (typeof flow !== 'string' || !flow.trim()) return null;
  const version = rec.version;
  return {
    key: key.trim(),
    flow: flow.trim(),
    ...(typeof version === 'string' && version.trim() ? { version: version.trim() } : {}),
  };
}

export function flowToExportCategory(flow: string): VnextExportCategory | null {
  return VNEXT_FLOW_TO_EXPORT_CATEGORY[flow] ?? null;
}

const READ_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function dedupeByKey(items: DiscoveredVnextComponent[]): DiscoveredVnextComponent[] {
  const seen = new Set<string>();
  const out: DiscoveredVnextComponent[] = [];
  for (const item of items) {
    const k = item.key.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Projede `vnext.config.json` `paths` altındaki klasörlerdeki vNext bileşen JSON dosyalarını tarar.
 * Klasör yolu + JSON içindeki `flow` uyumu zorunludur.
 */
export async function discoverAllVnextComponents(
  projectId: string,
  projectPath: string,
  paths: VnextWorkspacePaths,
): Promise<VnextComponentsDiscoveryResult> {
  const buckets = emptyBuckets();
  const relPaths = buildComponentFolderRelPaths(paths);
  if (!relPaths) {
    return { components: buckets };
  }

  const treeRes = await getProjectTree(projectId);
  if (isFailure(treeRes)) {
    return { components: buckets };
  }

  const candidates = collectJsonCandidatesUnderPathRoots(treeRes.data, projectPath, relPaths);
  if (candidates.length === 0) {
    return { components: buckets };
  }

  const parsedList = await mapWithConcurrency(candidates, READ_CONCURRENCY, async ({ path, category }) => {
    try {
      const { content } = await readFile(path);
      const meta = parseVnextComponentJson(content);
      if (!meta) return null;
      const flowCat = flowToExportCategory(meta.flow);
      if (flowCat !== category) return null;
      const row: DiscoveredVnextComponent = {
        key: meta.key,
        path,
        flow: meta.flow,
        ...(meta.version ? { version: meta.version } : {}),
      };
      return row;
    } catch {
      return null;
    }
  });

  for (const row of parsedList) {
    if (!row) continue;
    const cat = flowToExportCategory(row.flow);
    if (!cat) continue;
    buckets[cat].push(row);
  }

  for (const k of FOLDER_MATCH_ORDER) {
    buckets[k] = dedupeByKey(buckets[k]).sort((a, b) => a.key.localeCompare(b.key));
  }

  return { components: buckets };
}

export async function discoverVnextComponentsByCategory(
  projectId: string,
  projectPath: string,
  paths: VnextWorkspacePaths,
  category: VnextExportCategory,
): Promise<DiscoveredVnextComponent[]> {
  const { components } = await discoverAllVnextComponents(projectId, projectPath, paths);
  return components[category];
}
