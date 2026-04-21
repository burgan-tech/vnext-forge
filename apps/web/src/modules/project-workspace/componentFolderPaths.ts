import type { VnextWorkspacePaths } from '@vnext-forge/app-contracts';
import type { ComponentFolderType } from '@vnext-forge/designer-ui';

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
 * `vnext.config.json` `paths` değerlerinden, proje köküne göre beklenen klasör göreli yollarını üretir
 * (`packages/services-core` içindeki `joinPosix(projectRoot, componentsRoot, segment)` ile uyumlu).
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
 * Yalnızca `paths` altında tanımlı tam klasör yollarına (bileşen kökü + doğrudan layout segmentleri)
 * özel ikon atanır; alt klasörler eşleşmez.
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
