import type { DiscoveredVnextComponent, VnextWorkspacePaths } from '@vnext-forge-studio/app-contracts';
import { normalizePosixPath } from './scriptTaskPaths.js';
import type { ListedCsxScript } from './services/listProjectCsxScripts.js';

export interface CsxPickerGroupedItem {
  item: ListedCsxScript;
  /** Remaining path after category/subgroup (display). */
  displayPath: string;
}

export interface CsxPickerGroupRow {
  category: string;
  subgroup: string;
  items: CsxPickerGroupedItem[];
}

/** Strip `componentsRoot/` prefix from project-relative path (case-insensitive). */
export function stripComponentsRootFromProjectRelative(
  projectRelative: string,
  componentsRoot: string,
): string {
  const rel = normalizePosixPath(projectRelative).replace(/^\/+/, '');
  const root = normalizePosixPath(componentsRoot).replace(/\/$/, '');
  const prefix = `${root}/`;
  if (rel.length >= prefix.length && rel.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()) {
    return rel.slice(prefix.length);
  }
  return rel;
}

function segmentMatchesPathFolder(segment: string, folder: string): boolean {
  if (!folder) return false;
  return segment.localeCompare(folder, undefined, { sensitivity: 'accent' }) === 0;
}

/** Split path (after componentsRoot) into category, subgroup, and file line. */
export function classifyCsxPathAfterRoot(
  strippedPath: string,
  paths: VnextWorkspacePaths,
): { category: string; subgroup: string; fileLine: string } {
  const parts = strippedPath.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { category: 'Other', subgroup: '', fileLine: '' };
  }

  const folderEntries: { folder: string; label: string }[] = [
    { folder: paths.tasks, label: paths.tasks },
    { folder: paths.workflows, label: paths.workflows },
    { folder: paths.views, label: paths.views },
    { folder: paths.schemas, label: paths.schemas },
    { folder: paths.functions, label: paths.functions },
    { folder: paths.extensions, label: paths.extensions },
  ];

  const first = parts[0] ?? '';
  let matchedLabel: string | null = null;
  for (const e of folderEntries) {
    if (segmentMatchesPathFolder(first, e.folder)) {
      matchedLabel = e.label;
      break;
    }
  }

  if (!matchedLabel) {
    return {
      category: 'Other',
      subgroup: first,
      fileLine: parts.slice(1).join('/'),
    };
  }

  if (parts.length === 1) {
    return { category: matchedLabel, subgroup: '', fileLine: '' };
  }
  if (parts.length === 2) {
    return { category: matchedLabel, subgroup: '', fileLine: parts[1] ?? '' };
  }

  return {
    category: matchedLabel,
    subgroup: parts[1] ?? '',
    fileLine: parts.slice(2).join('/'),
  };
}

function categorySortRank(category: string, paths: VnextWorkspacePaths): number {
  const order = [
    paths.tasks,
    paths.workflows,
    paths.views,
    paths.schemas,
    paths.functions,
    paths.extensions,
    'Other',
  ];
  const i = order.indexOf(category);
  return i === -1 ? 999 : i;
}

/** Proje köküne göre dosya yolu → proje-göreli (posix). Eşleşmezse orijinali döner. */
function absolutePathToProjectRelative(filePath: string, projectRoot: string): string {
  const n = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const r = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  if (n.length < r.length) return filePath;
  if (n.toLowerCase() === r.toLowerCase()) return '';
  if (!n.toLowerCase().startsWith(`${r.toLowerCase()}/`)) return filePath;
  return n.slice(r.length + 1);
}

export interface TaskPickerGroupedItem {
  task: DiscoveredVnextComponent;
  displayPath: string;
}

export interface TaskPickerGroupRow {
  category: string;
  subgroup: string;
  items: TaskPickerGroupedItem[];
}

/**
 * `discoverVnextComponentsByCategory` çıktısını, `groupCsxScriptsForTaskPicker` ile aynı
 * klasör hiyerarşisiyle gruplar (tasks alt klasörleri → başlık satırları).
 */
export function groupDiscoveredTasksForPicker(
  items: DiscoveredVnextComponent[],
  projectPath: string,
  paths: VnextWorkspacePaths | null,
): TaskPickerGroupRow[] {
  if (!paths) {
    return [
      {
        category: '',
        subgroup: '',
        items: items.map((task) => ({ task, displayPath: task.key })),
      },
    ];
  }

  const bucket = new Map<string, Map<string, TaskPickerGroupedItem[]>>();

  for (const task of items) {
    const rel = absolutePathToProjectRelative(task.path, projectPath);
    const useRel = rel !== task.path ? rel : task.path;
    const stripped = stripComponentsRootFromProjectRelative(useRel, paths.componentsRoot);
    const { category, subgroup, fileLine } = classifyCsxPathAfterRoot(stripped, paths);
    const displayPath = fileLine || task.key;

    let subMap = bucket.get(category);
    if (!subMap) {
      subMap = new Map();
      bucket.set(category, subMap);
    }
    const subKey = subgroup || '\0root';
    const arr = subMap.get(subKey) ?? [];
    arr.push({ task, displayPath });
    subMap.set(subKey, arr);
  }

  const sortedCategories = [...bucket.keys()].sort((a, b) => {
    const d = categorySortRank(a, paths) - categorySortRank(b, paths);
    if (d !== 0) return d;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const result: TaskPickerGroupRow[] = [];
  for (const cat of sortedCategories) {
    const subMap = bucket.get(cat)!;
    const sortedSubs = [...subMap.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const sub of sortedSubs) {
      const rowItems = subMap.get(sub)!;
      rowItems.sort((a, b) => a.task.key.localeCompare(b.task.key, undefined, { sensitivity: 'base' }));
      result.push({
        category: cat,
        subgroup: sub === '\0root' ? '' : sub,
        items: rowItems,
      });
    }
  }

  return result;
}

/**
 * Group .csx paths by vNext `paths` (category + subgroup).
 * If `paths` is null, returns a single flat group (full path as displayPath).
 */
export function groupCsxScriptsForTaskPicker(
  items: ListedCsxScript[],
  paths: VnextWorkspacePaths | null,
): CsxPickerGroupRow[] {
  if (!paths) {
    return [
      {
        category: '',
        subgroup: '',
        items: items.map((item) => ({ item, displayPath: item.projectRelative })),
      },
    ];
  }

  const bucket = new Map<string, Map<string, CsxPickerGroupedItem[]>>();

  for (const item of items) {
    const stripped = stripComponentsRootFromProjectRelative(item.projectRelative, paths.componentsRoot);
    const { category, subgroup, fileLine } = classifyCsxPathAfterRoot(stripped, paths);
    const displayPath = fileLine || stripped;

    let subMap = bucket.get(category);
    if (!subMap) {
      subMap = new Map();
      bucket.set(category, subMap);
    }
    const subKey = subgroup || '\0root';
    const arr = subMap.get(subKey) ?? [];
    arr.push({ item, displayPath });
    subMap.set(subKey, arr);
  }

  const sortedCategories = [...bucket.keys()].sort((a, b) => {
    const d = categorySortRank(a, paths) - categorySortRank(b, paths);
    if (d !== 0) return d;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const result: CsxPickerGroupRow[] = [];
  for (const cat of sortedCategories) {
    const subMap = bucket.get(cat)!;
    const sortedSubs = [...subMap.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const sub of sortedSubs) {
      const rowItems = subMap.get(sub)!;
      rowItems.sort((a, b) =>
        a.item.projectRelative.localeCompare(b.item.projectRelative, undefined, { sensitivity: 'base' }),
      );
      result.push({
        category: cat,
        subgroup: sub === '\0root' ? '' : sub,
        items: rowItems,
      });
    }
  }

  return result;
}
