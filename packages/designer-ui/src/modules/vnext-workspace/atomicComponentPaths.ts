import type { VnextWorkspacePaths } from '@vnext-forge/app-contracts';

/** When JSON sits directly under the category folder, editor `group` is this sentinel (path has no subfolder). */
export const VNEXT_ATOMIC_FLAT_GROUP = '__flat__' as const;

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

type AtomicCategoryFolder = 'tasks' | 'schemas' | 'views' | 'functions' | 'extensions';

/** Build absolute `.json` path for an atomic component (`group` may be VNEXT_ATOMIC_FLAT_GROUP). */
export function buildAtomicComponentJsonPath(
  projectRoot: string,
  paths: VnextWorkspacePaths,
  category: AtomicCategoryFolder,
  group: string,
  name: string,
): string {
  const root = norm(projectRoot).replace(/\/$/, '');
  const cr = norm(String(paths.componentsRoot || ''));
  const sub = norm(String(paths[category] || ''));
  const base = norm(`${root}/${cr}/${sub}`);
  if (group === VNEXT_ATOMIC_FLAT_GROUP) {
    return `${base}/${name}.json`;
  }
  return `${base}/${group}/${name}.json`;
}
