import { apiClient, callApi } from '@shared/api/client';
import type { ApiResponse } from '@vnext-forge/app-contracts';

import type { FileTreeNode, ProjectInfo, VnextConfig } from './project-types';

export function listProjects() {
  return callApi<ProjectInfo[]>(apiClient.api.projects.$get());
}

export function createProject(input: { domain: string; targetPath?: string }) {
  return callApi<ProjectInfo>(
    apiClient.api.projects.$post({
      json: input,
    }),
  );
}

export function deleteProject(projectId: string) {
  return callApi(
    apiClient.api.projects[':id'].$delete({
      param: { id: projectId },
    }),
  );
}

export function importProject(path: string) {
  return callApi<ProjectInfo>(
    apiClient.api.projects.import.$post({
      json: { path },
    }),
  );
}

export function getProject(projectId: string) {
  return callApi<ProjectInfo>(
    apiClient.api.projects[':id'].$get({
      param: { id: projectId },
    }),
  );
}

export async function getProjectTree(projectId: string): Promise<ApiResponse<FileTreeNode>> {
  const res = await callApi<{ root: FileTreeNode }>(
    apiClient.api.projects[':id'].tree.$get({
      param: { id: projectId },
    }),
  );
  if (!res.success) return res;
  return { success: true, data: res.data.root, error: null };
}

export function getProjectConfig(projectId: string) {
  return callApi<VnextConfig>(
    apiClient.api.projects[':id'].config.$get({
      param: { id: projectId },
    }),
  );
}
