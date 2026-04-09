import type { VnextConfig } from '../model/types';

export type FileRouteType =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'mapping'
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

export function resolveFileRoute(
  filePath: string,
  config: VnextConfig | null,
  projectId: string,
  projectPath: string,
): FileRoute {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedProjectPath = normalizePath(projectPath);

  const relativePath = normalizedFilePath.startsWith(normalizedProjectPath)
    ? normalizedFilePath.slice(normalizedProjectPath.length).replace(/^\/+/, '')
    : normalizedFilePath;

  if (relativePath === 'vnext.config.json') {
    return {
      type: 'config',
      group: '',
      name: 'vnext.config.json',
      editorTab: {
        filePath: normalizedFilePath,
        language: 'json',
        title: 'vnext.config.json',
      },
    };
  }

  if (!config) {
    return unknownFile(normalizedFilePath, relativePath);
  }

  const componentsRoot = normalizeConfigPath(config.paths?.componentsRoot);
  if (!componentsRoot) {
    return unknownFile(normalizedFilePath, relativePath);
  }

  if (!relativePath.startsWith(componentsRoot + '/')) {
    return unknownFile(normalizedFilePath, relativePath);
  }

  const componentRelative = relativePath.slice(componentsRoot.length + 1);

  const workflows = normalizeConfigPath(config.paths.workflows);
  const tasks = normalizeConfigPath(config.paths.tasks);
  const schemas = normalizeConfigPath(config.paths.schemas);
  const mappings = normalizeConfigPath(config.paths.mappings);
  const views = normalizeConfigPath(config.paths.views);
  const functions = normalizeConfigPath(config.paths.functions);
  const extensions = normalizeConfigPath(config.paths.extensions);

  if (workflows && componentRelative.startsWith(workflows + '/')) {
    const rest = componentRelative.slice(workflows.length + 1);
    if (rest.startsWith('.meta/') || rest.includes('/.meta/')) {
      return unknownFile(normalizedFilePath, relativePath);
    }
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'workflow',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/flow/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (tasks && componentRelative.startsWith(tasks + '/')) {
    const rest = componentRelative.slice(tasks.length + 1);
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'task',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/task/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (schemas && componentRelative.startsWith(schemas + '/')) {
    const rest = componentRelative.slice(schemas.length + 1);
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'schema',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/schema/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (views && componentRelative.startsWith(views + '/')) {
    const rest = componentRelative.slice(views.length + 1);
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'view',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/view/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (functions && componentRelative.startsWith(functions + '/')) {
    const rest = componentRelative.slice(functions.length + 1);
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'function',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/function/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (extensions && componentRelative.startsWith(extensions + '/')) {
    const rest = componentRelative.slice(extensions.length + 1);
    const parsed = parseGroupName(rest, '.json');
    if (parsed) {
      return {
        type: 'extension',
        group: parsed.group,
        name: parsed.name,
        navigateTo: `/project/${projectId}/extension/${parsed.group}/${parsed.name}`,
      };
    }
  }

  if (mappings && componentRelative.startsWith(mappings + '/')) {
    const rest = componentRelative.slice(mappings.length + 1);
    const parts = rest.split('/');
    const fileName = parts[parts.length - 1];
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    const group = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    return {
      type: 'mapping',
      group,
      name: nameWithoutExt,
      editorTab: {
        filePath: normalizedFilePath,
        language: fileName.endsWith('.csx') ? 'csharp' : detectLanguage(fileName),
        title: fileName,
      },
    };
  }

  return unknownFile(normalizedFilePath, relativePath);
}

function parseGroupName(rest: string, expectedExt: string): { group: string; name: string } | null {
  if (!rest.endsWith(expectedExt)) return null;
  const parts = rest.split('/');
  if (parts.length < 2) return null;
  const fileName = parts[parts.length - 1];
  const name = fileName.slice(0, -expectedExt.length);
  const group = parts.slice(0, -1).join('/');
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
    case 'json': return 'json';
    case 'csx':
    case 'cs': return 'csharp';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'xml': return 'xml';
    case 'yaml':
    case 'yml': return 'yaml';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'http': return 'http';
    case 'sql': return 'sql';
    case 'sh':
    case 'bash': return 'shell';
    case 'py': return 'python';
    case 'go': return 'go';
    case 'rs': return 'rust';
    default: return 'plaintext';
  }
}

function normalizePath(path?: string | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/');
}

function normalizeConfigPath(path?: string | null): string {
  return normalizePath(path).replace(/^\/+|\/+$/g, '');
}
