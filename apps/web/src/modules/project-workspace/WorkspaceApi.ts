import {
  isFailure,
  success,
  failureFromError,
  ERROR_CODES,
  type ApiResponse,
  VnextForgeError,
} from '@vnext-forge/app-contracts';
import type { WorkspaceFolder } from '@shared/ui/FolderBrowser';
import { apiClient, callApi, unwrapApi } from '@shared/api/Client';
import { createLogger } from '@shared/lib/logger/CreateLogger';
import { toVnextError } from '@shared/lib/error/VnextErrorHelpers';

import { normalizeWorkspaceName, createWorkflowNameSchema } from './ProjectWorkspaceSchema';

const logger = createLogger('WorkspaceApi');

interface WorkspaceBrowseResult {
  path: string;
  folders: WorkspaceFolder[];
}

export function browseWorkspace(path?: string) {
  return callApi<WorkspaceBrowseResult>(
    apiClient.api.files.browse.$get({
      query: path ? { path } : {},
    }),
  );
}

export function readFile(path: string) {
  return unwrapApi<{ content: string }>(
    apiClient.api.files.$get({
      query: { path },
    }),
    'Failed to read file',
  );
}

export function writeFile(path: string, content: string) {
  return callApi<void>(
    apiClient.api.files.$put({
      json: { path, content },
    }),
  );
}

export function deleteFile(path: string) {
  return callApi<void>(
    apiClient.api.files.$delete({
      query: { path },
    }),
  );
}

export function createDirectory(path: string) {
  return callApi<void>(
    apiClient.api.files.mkdir.$post({
      json: { path },
    }),
  );
}

export function renameFile(oldPath: string, newPath: string) {
  return callApi<void>(
    apiClient.api.files.rename.$post({
      json: { oldPath, newPath },
    }),
  );
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
    workflowName = normalizeWorkspaceName(
      createWorkflowNameSchema.parse(params.name),
      'workflow',
    );
  } catch (value) {
    return failureFromError(toVnextError(value, 'Workflow name is invalid.'));
  }

  if (!parentPath.trim()) {
    return failureFromError(
      new VnextForgeError(
        ERROR_CODES.FILE_INVALID_PATH,
        'Parent path is required.',
        {
          source: 'WorkspaceApi.scaffoldWorkflow',
          layer: 'feature',
        },
      ),
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
