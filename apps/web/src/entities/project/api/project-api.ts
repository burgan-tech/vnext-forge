import type { ProjectInfo } from '@entities/project/model/types';
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
