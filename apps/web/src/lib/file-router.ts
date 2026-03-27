import type { VnextConfig } from '../stores/project-store';

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
  /** Route path for react-router navigation */
  navigateTo?: string;
  /** For code editor tab opening */
  editorTab?: {
    filePath: string;
    language: string;
    title: string;
  };
}

/**
 * Resolve a file path to a route destination.
 *
 * Given an absolute file path and the vnext config, determines:
 * - Which editor to open (flow canvas, task editor, code editor, etc.)
 * - The group and name for sub-routes
 * - Or a code editor tab config for raw file editing
 */
export function resolveFileRoute(
  filePath: string,
  config: VnextConfig | null,
  projectId: string,
  projectPath: string,
): FileRoute {
  // Compute relative path from project root
  const relativePath = filePath.startsWith(projectPath)
    ? filePath.slice(projectPath.length).replace(/^\//, '')
    : filePath;

  // Check if it's vnext.config.json
  if (relativePath === 'vnext.config.json') {
    return {
      type: 'config',
      group: '',
      name: 'vnext.config.json',
      editorTab: {
        filePath,
        language: 'json',
        title: 'vnext.config.json',
      },
    };
  }

  if (!config) {
    return unknownFile(filePath, relativePath);
  }

  const componentsRoot = config.paths.componentsRoot;
  // Check if file is under componentsRoot
  if (!relativePath.startsWith(componentsRoot + '/')) {
    return unknownFile(filePath, relativePath);
  }

  // Strip componentsRoot prefix: "vnext-messaging-gateway/Workflows/otp/otp-sms.json" → "Workflows/otp/otp-sms.json"
  const componentRelative = relativePath.slice(componentsRoot.length + 1);

  // Try to match each component type
  const { workflows, tasks, schemas, mappings, views, functions, extensions } = config.paths;

  // Workflows: {workflows}/{group}/{name}.json
  if (componentRelative.startsWith(workflows + '/')) {
    const rest = componentRelative.slice(workflows.length + 1);
    // Skip .meta directories and non-json files for workflow routing
    if (rest.startsWith('.meta/') || rest.includes('/.meta/')) {
      return unknownFile(filePath, relativePath);
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

  // Tasks: {tasks}/{group}/{name}.json
  if (componentRelative.startsWith(tasks + '/')) {
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

  // Schemas: {schemas}/{group}/{name}.json
  if (componentRelative.startsWith(schemas + '/')) {
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

  // Views: {views}/{group}/{name}.json
  if (componentRelative.startsWith(views + '/')) {
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

  // Functions: {functions}/{group}/{name}.json
  if (componentRelative.startsWith(functions + '/')) {
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

  // Extensions: {extensions}/{group}/{name}.json
  if (componentRelative.startsWith(extensions + '/')) {
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

  // Mappings: {mappings}/**/*.csx → code editor
  if (componentRelative.startsWith(mappings + '/')) {
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
        filePath,
        language: fileName.endsWith('.csx') ? 'csharp' : detectLanguage(fileName),
        title: fileName,
      },
    };
  }

  return unknownFile(filePath, relativePath);
}

/** Parse "group/name.ext" from a relative path. Handles nested groups. */
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
    case 'sh': case 'bash': return 'shell';
    case 'py': return 'python';
    case 'go': return 'go';
    case 'rs': return 'rust';
    default: return 'plaintext';
  }
}
