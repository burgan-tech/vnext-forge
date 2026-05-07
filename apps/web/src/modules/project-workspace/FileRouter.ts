import { createLogger, type VnextWorkspaceConfig } from '@vnext-forge-studio/designer-ui';

export type FileRouteType =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'config'
  | 'unknown';

export interface FileRoute {
  type: FileRouteType;
  group: string;
  name: string;
  navigateTo?: string;
  editorTab?: {
    filePath: string;
    language: string;
    title: string;
  };
}

const logger = createLogger('FileRouter');
export function resolveFileRoute(
  filePath: string,
  config: VnextWorkspaceConfig | null,
  projectId: string,
  projectPath: string,
): FileRoute {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedProjectPath = normalizePath(projectPath);

  const relativePath = stripPrefix(normalizedFilePath, normalizedProjectPath) ?? normalizedFilePath;

  if (relativePath.toLowerCase() === 'vnext.config.json') {
    return {
      type: 'config',
      group: '',
      name: 'vnext.config.json',
      navigateTo: `/project/${projectId}/workspace-config`,
    };
  }

  if (!config) {
    return unknownFile(normalizedFilePath, relativePath);
  }

  const componentsRoot = normalizeConfigPath(config.paths?.componentsRoot);
  if (!componentsRoot) {
    return unknownFile(normalizedFilePath, relativePath);
  }

  const componentRelative = stripPrefix(relativePath, componentsRoot) ?? relativePath;
  logger.info('Resolving file route', {
    filePath,
    normalizedFilePath,
    relativePath,
    componentRelative,
  });

  const workflows = normalizeConfigPath(config.paths.workflows);
  const tasks = normalizeConfigPath(config.paths.tasks);
  const schemas = normalizeConfigPath(config.paths.schemas);
  const views = normalizeConfigPath(config.paths.views);
  const functions = normalizeConfigPath(config.paths.functions);
  const extensions = normalizeConfigPath(config.paths.extensions);

  const restWorkflows = workflows ? extractResourceRest(relativePath, componentsRoot, workflows) : null;
  if (restWorkflows !== null) {
    const rest = restWorkflows;
    if (rest.startsWith('.meta/') || rest.includes('/.meta/')) {
      return unknownFile(normalizedFilePath, relativePath);
    }
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'workflow',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/flow/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  const restTasks = tasks ? extractResourceRest(relativePath, componentsRoot, tasks) : null;
  if (restTasks !== null) {
    const rest = restTasks;
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'task',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/task/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  const restSchemas = schemas ? extractResourceRest(relativePath, componentsRoot, schemas) : null;
  if (restSchemas !== null) {
    const rest = restSchemas;
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'schema',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/schema/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  const restViews = views ? extractResourceRest(relativePath, componentsRoot, views) : null;
  if (restViews !== null) {
    const rest = restViews;
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'view',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/view/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  const restFunctions = functions ? extractResourceRest(relativePath, componentsRoot, functions) : null;
  if (restFunctions !== null) {
    const rest = restFunctions;
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'function',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/function/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  const restExtensions = extensions ? extractResourceRest(relativePath, componentsRoot, extensions) : null;
  if (restExtensions !== null) {
    const rest = restExtensions;
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'extension',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/extension/${encodeURIComponent(parsed.group)}/${encodeURIComponent(parsed.name)}`,
      };
    }
  }

  return unknownFile(normalizedFilePath, relativePath);
}

function parseGroupName(rest: string, expectedExt: string): { group: string; name: string } | null {
  const parts = rest.split('/');
  if (parts.length === 0) return null;
  const fileName = parts[parts.length - 1];
  const ext = expectedExt.toLowerCase();
  if (!fileName.toLowerCase().endsWith(ext)) return null;
  const name = fileName.slice(0, fileName.length - ext.length);
  if (!name) return null;
  const group = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  return { group, name };
}

function unknownFile(filePath: string, relativePath: string): FileRoute {
  const parts = relativePath.split('/');
  const fileName = parts[parts.length - 1];
  return {
    type: 'unknown',
    group: '',
    name: fileName,
    editorTab: {
      filePath,
      language: detectLanguage(fileName),
      title: fileName,
    },
  };
}

function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'json';
    case 'csx':
    case 'cs':
      return 'csharp';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'http':
      return 'http';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    default:
      return 'plaintext';
  }
}

function normalizePath(path?: string | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/');
}

function normalizeConfigPath(path?: string | null): string {
  return normalizePath(path).replace(/^\/+|\/+$/g, '');
}

function stripPrefix(path: string, prefix: string): string | null {
  const normalizedPath = normalizeConfigPath(path);
  const normalizedPrefix = normalizeConfigPath(prefix);

  if (!normalizedPrefix) {
    return normalizedPath;
  }

  if (normalizedPath.toLowerCase() === normalizedPrefix.toLowerCase()) {
    return '';
  }

  if (normalizedPath.toLowerCase().startsWith(`${normalizedPrefix.toLowerCase()}/`)) {
    return normalizedPath.slice(normalizedPrefix.length + 1);
  }

  return null;
}

/** Windows / farklı FS: `Tasks` vs `tasks` — config segmenti ile disk yolu büyük/küçük harf duyarsız eşlensin. */
function sliceAfterConfigSegment(componentRelative: string, segment: string): string | null {
  const rel = normalizeConfigPath(componentRelative);
  const seg = normalizeConfigPath(segment);
  if (!seg) {
    return null;
  }
  const relL = rel.toLowerCase();
  const segL = seg.toLowerCase();
  if (relL === segL) {
    return '';
  }
  if (!relL.startsWith(`${segL}/`)) {
    return null;
  }
  return rel.slice(seg.length + 1);
}

/**
 * Önce `componentsRoot` sonrası yolda segment aranır; yoksa proje göreli tam yolda `.../Views/...` gibi
 * gömülü eşleşme (config `componentsRoot` ile disk klasörü uyuşmazsa, örn. `core` vs `domain`).
 */
function sliceAfterEmbeddedSegment(fullPath: string, segment: string): string | null {
  const f = normalizeConfigPath(fullPath);
  const seg = normalizeConfigPath(segment);
  if (!seg) {
    return null;
  }
  const fL = f.toLowerCase();
  const segL = seg.toLowerCase();
  if (fL === segL) {
    return '';
  }
  if (fL.startsWith(`${segL}/`)) {
    return f.slice(seg.length + 1);
  }
  const needle = `/${segL}/`;
  const idx = fL.indexOf(needle);
  if (idx === -1) {
    return null;
  }
  return f.slice(idx + needle.length);
}

function extractResourceRest(
  relativePath: string,
  componentsRoot: string,
  segment: string,
): string | null {
  const seg = normalizeConfigPath(segment);
  if (!seg) {
    return null;
  }
  const rel = normalizeConfigPath(relativePath);
  const afterRoot = stripPrefix(rel, componentsRoot) ?? rel;
  const direct = sliceAfterConfigSegment(afterRoot, seg);
  if (direct !== null) {
    return direct;
  }
  return sliceAfterEmbeddedSegment(rel, seg);
}
