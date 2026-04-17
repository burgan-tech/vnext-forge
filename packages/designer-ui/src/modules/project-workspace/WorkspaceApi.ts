import {
  isFailure,
  success,
  failureFromError,
  ERROR_CODES,
  type ApiResponse,
  VnextForgeError,
} from '@vnext-forge/app-contracts';
import type { FileTreeNode } from '../../shared/projectTypes';
import type { WorkspaceFolder } from '../../ui/FolderBrowser';
import { callApi, unwrapApi } from '../../api/client';
import { createLogger } from '../../lib/logger/createLogger';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';

import { normalizeWorkspaceName, createWorkflowNameSchema } from './ProjectWorkspaceSchema';

const logger = createLogger('WorkspaceApi');

interface WorkspaceBrowseResult {
  path: string;
  folders: WorkspaceFolder[];
}

export function browseWorkspace(path?: string) {
  return callApi<WorkspaceBrowseResult>({
    method: 'files.browse',
    params: path ? { path } : {},
  });
}

/** Project file tree from the extension host `projects.getTree`. */
export async function getProjectTree(projectId: string): Promise<ApiResponse<FileTreeNode>> {
  const res = await callApi<{ root: FileTreeNode }>({
    method: 'projects.getTree',
    params: { id: projectId },
  });
  if (!res.success) return res;
  return { success: true, data: res.data.root, error: null };
}

export function readFile(path: string) {
  return unwrapApi<{ content: string }>(
    { method: 'files.read', params: { path: normalizeFilePath(path) } },
    'Failed to read file',
  );
}

export async function readOptionalFile(path: string): Promise<{ content: string } | null> {
  try {
    return await readFile(path);
  } catch (value) {
    const error = toVnextError(value);
    if (error.code === ERROR_CODES.FILE_NOT_FOUND) {
      return null;
    }

    throw error;
  }
}

export function writeFile(path: string, content: string) {
  return callApi<void>({
    method: 'files.write',
    params: { path: normalizeFilePath(path), content },
  });
}

export function deleteFile(path: string) {
  return callApi<void>({
    method: 'files.delete',
    params: { path: normalizeFilePath(path) },
  });
}

export function createDirectory(path: string) {
  return callApi<void>({
    method: 'files.mkdir',
    params: { path: normalizeFilePath(path) },
  });
}

export function renameFile(oldPath: string, newPath: string) {
  return callApi<void>({
    method: 'files.rename',
    params: { oldPath: normalizeFilePath(oldPath), newPath: normalizeFilePath(newPath) },
  });
}

export interface FileSearchOptions {
  query: string;
  projectPath: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
  useRegex?: boolean;
  include?: string;
  exclude?: string;
}

export interface FileSearchResult {
  path: string;
  line: number;
  text: string;
}

export function searchFiles(opts: FileSearchOptions) {
  return callApi<FileSearchResult[]>({
    method: 'files.search',
    params: {
      q: opts.query,
      project: opts.projectPath,
      ...(opts.matchCase !== undefined && { matchCase: opts.matchCase }),
      ...(opts.matchWholeWord !== undefined && { matchWholeWord: opts.matchWholeWord }),
      ...(opts.useRegex !== undefined && { useRegex: opts.useRegex }),
      ...(opts.include ? { include: opts.include } : {}),
      ...(opts.exclude ? { exclude: opts.exclude } : {}),
    },
  });
}

export interface WorkflowScaffoldParams {
  parentPath: string;
  name: string;
  projectPath: string;
  componentsRoot: string;
  workflowsRelDir: string;
  domain: string;
}

export interface WorkflowScaffoldResult {
  groupName: string;
  workflowName: string;
}

export async function scaffoldWorkflow(
  params: WorkflowScaffoldParams,
): Promise<ApiResponse<WorkflowScaffoldResult>> {
  const { parentPath, projectPath, componentsRoot, workflowsRelDir, domain } = params;

  let workflowName: string;

  try {
    workflowName = normalizeWorkspaceName(createWorkflowNameSchema.parse(params.name), 'workflow');
  } catch (value) {
    return failureFromError(toVnextError(value, 'Workflow name is invalid.'));
  }

  if (!parentPath.trim()) {
    return failureFromError(
      new VnextForgeError(ERROR_CODES.FILE_INVALID_PATH, 'Parent path is required.', {
        source: 'WorkspaceApi.scaffoldWorkflow',
        layer: 'feature',
      }),
    );
  }

  const workflowsFullPath = `${projectPath}/${componentsRoot}/${workflowsRelDir}`;
  const isWorkflowsRoot =
    parentPath === workflowsFullPath || parentPath.endsWith(`/${workflowsRelDir}`);
  const groupPath = isWorkflowsRoot ? `${parentPath}/${workflowName}` : parentPath;
  const groupName = groupPath.split('/').pop() || workflowName;

  logger.info('Scaffolding workflow', { groupName, groupPath, workflowName });

  // Directory creation is best-effort; failures are non-fatal
  await createDirectory(groupPath);
  await createDirectory(`${groupPath}/.meta`);

  const workflowTemplate = {
    $type: 'workflow',
    key: workflowName,
    domain,
    version: '1.0.0',
    flow: 'sys-flows',
    tags: [],
    attributes: {
      type: 'F',
      labels: [{ label: workflowName, language: 'en' }],
      startTransition: {
        key: 'start',
        target: '',
        versionStrategy: 'Minor',
        labels: [{ label: 'Start', language: 'en' }],
      },
      states: [],
      functions: [],
      features: [],
      extensions: [],
    },
  };

  const writeResult = await writeFile(
    `${groupPath}/${workflowName}.json`,
    JSON.stringify(workflowTemplate, null, 2),
  );
  if (isFailure(writeResult)) return writeResult;

  // Diagram write is best-effort; failure is non-fatal
  await writeFile(
    `${groupPath}/.meta/${workflowName}.diagram.json`,
    JSON.stringify({ nodePos: {} }, null, 2),
  );

  return success({ groupName, workflowName });
}

function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}
