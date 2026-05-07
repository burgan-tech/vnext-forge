import type { ApiResponse } from '@vnext-forge-studio/app-contracts';
import type { FileTreeNode } from '@vnext-forge-studio/designer-ui';

import { callApi, unwrapApi } from '@shared/api';
import type {
  ProjectConfigStatus,
  ProjectInfo,
  ProjectWorkspaceBootstrap,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatus,
  VnextWorkspaceConfig,
  WriteProjectConfigPayload,
} from '../modules/project-management/ProjectTypes';

import { v1 } from './v1';

export async function list(): Promise<ApiResponse<ProjectInfo[]>> {
  return callApi(v1.projects.list.$get());
}

export async function create(input: {
  domain: string;
  targetPath?: string;
}): Promise<ApiResponse<ProjectInfo>> {
  return callApi(v1.projects.create.$post({ json: input }));
}

export async function remove(projectId: string): Promise<ApiResponse<void>> {
  return callApi(v1.projects.remove.$delete({ query: { id: projectId } }));
}

export async function importProject(path: string): Promise<ApiResponse<ProjectInfo>> {
  return callApi(v1.projects.import.$post({ json: { path } }));
}

export async function exportProject(payload: unknown): Promise<ApiResponse<unknown>> {
  return callApi(v1.projects.export.$post({ json: payload }));
}

export async function getTree(projectId: string): Promise<ApiResponse<{ root: FileTreeNode }>> {
  return callApi(v1.projects.getTree.$get({ query: { id: projectId } }));
}

export async function getById(projectId: string): Promise<ApiResponse<ProjectInfo>> {
  return callApi(v1.projects.getById.$get({ query: { id: projectId } }));
}

export async function getConfig(projectId: string): Promise<ApiResponse<VnextWorkspaceConfig>> {
  return callApi(v1.projects.getConfig.$get({ query: { id: projectId } }));
}

export async function getConfigStatus(
  projectId: string,
): Promise<ApiResponse<ProjectConfigStatus>> {
  return callApi(v1.projects.getConfigStatus.$get({ query: { id: projectId } }));
}

export async function getVnextComponentLayoutStatus(
  projectId: string,
): Promise<ApiResponse<VnextComponentLayoutStatus>> {
  return callApi(
    v1.projects.getVnextComponentLayoutStatus.$get({ query: { id: projectId } }),
  );
}

export async function writeConfig(
  projectId: string,
  body: WriteProjectConfigPayload,
): Promise<ApiResponse<ProjectInfo>> {
  return callApi(
    v1.projects.writeConfig.$put({ json: { id: projectId, config: body } }),
  );
}

export async function seedVnextComponentLayout(
  projectId: string,
): Promise<SeedVnextComponentLayoutResult> {
  return unwrapApi<SeedVnextComponentLayoutResult>(
    v1.projects.seedVnextComponentLayout.$put({ json: { id: projectId } }),
  );
}

export async function getValidateScriptStatus(
  projectId: string,
): Promise<ApiResponse<{ exists: boolean }>> {
  return callApi(v1.projects.getValidateScriptStatus.$get({ query: { id: projectId } }));
}

export async function getComponentFileTypes(
  projectId: string,
): Promise<ApiResponse<Record<string, string>>> {
  return callApi(v1.projects.getComponentFileTypes.$get({ query: { id: projectId } }));
}

export async function getWorkspaceBootstrap(
  projectId: string,
): Promise<ApiResponse<ProjectWorkspaceBootstrap>> {
  return callApi(v1.projects.getWorkspaceBootstrap.$get({ query: { id: projectId } }));
}
