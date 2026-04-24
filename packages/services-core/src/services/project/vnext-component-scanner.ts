import type {
  DiscoveredVnextComponent,
  VnextComponentsByCategory,
  VnextComponentsDiscoveryResult,
  VnextExportCategory,
} from '@vnext-forge/app-contracts';
import { VNEXT_FLOW_TO_EXPORT_CATEGORY } from '@vnext-forge/app-contracts';
import type { VnextWorkspacePaths } from '../workspace/types.js';

import type { FileSystemAdapter } from '../../adapters/file-system.js';
import { joinPosix, toPosix } from '../../internal/paths.js';

import type { ComponentFolderType } from './vnext-component-folder-paths.js';
import { buildComponentFolderRelPaths } from './vnext-component-folder-paths.js';

const FOLDER_MATCH_ORDER: VnextExportCategory[] = [
  'workflows',
  'tasks',
  'schemas',
  'views',
  'functions',
  'extensions',
];

const READ_CONCURRENCY = 8;

export function emptyVnextComponentBuckets(): VnextComponentsByCategory {
  return {
    workflows: [],
    tasks: [],
    schemas: [],
    views: [],
    functions: [],
    extensions: [],
  }
}

/** Ham JSON metninden `key` / `flow` (ve varsa `version`) okur; geçersizse `null`. */
export function parseVnextComponentJson(content: string): {
  key: string
  flow: string
  version?: string
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
  }
}

export function flowToExportCategory(flow: string): VnextExportCategory | null {
  return VNEXT_FLOW_TO_EXPORT_CATEGORY[flow] ?? null
}

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

async function walkCollectJsonFiles(
  fs: FileSystemAdapter,
  dirPath: string,
  out: string[],
): Promise<void> {
  if (!(await fs.exists(dirPath))) return;
  let entries;
  try {
    entries = await fs.readDir(dirPath);
  } catch {
    return;
  }
  for (const e of entries) {
    const full = joinPosix(toPosix(dirPath), e.name);
    if (e.isDirectory) {
      await walkCollectJsonFiles(fs, full, out);
    } else if (e.isFile && /\.json$/i.test(e.name)) {
      out.push(full);
    }
  }
}

/**
 * Her export kategorisi kökü altındaki tüm `.json` yollarını toplar (ağaç yürüyüşü).
 */
export async function collectJsonCandidatesFromDisk(
  fs: FileSystemAdapter,
  projectRoot: string,
  relPaths: Partial<Record<ComponentFolderType, string>>,
  onlyCategory?: VnextExportCategory,
): Promise<{ path: string; category: VnextExportCategory }[]> {
  const out: { path: string; category: VnextExportCategory }[] = [];
  const root = toPosix(projectRoot).replace(/\/+$/, '');

  const types = onlyCategory ? [onlyCategory] : FOLDER_MATCH_ORDER;

  for (const type of types) {
    const rel = relPaths[type];
    if (!rel) continue;
    const abs = joinPosix(root, rel.replace(/\\/g, '/'));
    const jsonFiles: string[] = [];
    await walkCollectJsonFiles(fs, abs, jsonFiles);
    for (const p of jsonFiles) {
      out.push({ path: p, category: type });
    }
  }
  return out;
}

export interface ScanVnextComponentsOptions {
  onlyCategory?: VnextExportCategory
}

/**
 * Disk üzerinden vNext bileşen JSON'larını tarar; `paths` ile klasör eşlemesi + JSON içi `flow` eşlemesi zorunlu.
 */
export async function scanVnextComponents(
  fs: FileSystemAdapter,
  projectRoot: string,
  paths: VnextWorkspacePaths,
  opts?: ScanVnextComponentsOptions,
): Promise<VnextComponentsDiscoveryResult> {
  const buckets = emptyVnextComponentBuckets();
  const relPaths = buildComponentFolderRelPaths(paths);
  if (!relPaths) {
    return { components: buckets };
  }

  const onlyCategory = opts?.onlyCategory;
  const candidates = await collectJsonCandidatesFromDisk(fs, projectRoot, relPaths, onlyCategory);
  if (candidates.length === 0) {
    return { components: buckets };
  }

  const parsedList = await mapWithConcurrency(candidates, READ_CONCURRENCY, async ({ path, category }) => {
    try {
      const content = await fs.readFile(path);
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

  return { components: buckets }
}
