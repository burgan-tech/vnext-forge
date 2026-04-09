import type { FileTreeNode, ProjectInfo, VnextConfig } from '@entities/project/model/types';
import { apiClient, callApi } from '@shared/api/client';

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

export function getProjectTree(projectId: string) {
  return callApi<FileTreeNode>(
    apiClient.api.projects[':id'].tree.$get({
      param: { id: projectId },
    }),
  );
}

export function getProjectConfig(projectId: string) {
  return callApi<VnextConfig>(
    apiClient.api.projects[':id'].config.$get({
      param: { id: projectId },
    }),
  );
}
