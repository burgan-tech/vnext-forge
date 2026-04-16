import { apiClient, callApi, unwrapApi } from '@shared/api/client';

import type {
  ProjectConfigStatus,
  ProjectInfo,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatus,
  VnextWorkspaceConfig,
  WriteProjectConfigPayload,
} from './ProjectTypes';

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

export function getProjectConfig(projectId: string) {
  return callApi<VnextWorkspaceConfig>(
    apiClient.api.projects[':id'].config.$get({
      param: { id: projectId },
    }),
  );
}

export function getProjectConfigStatus(projectId: string) {
  return callApi<ProjectConfigStatus>(
    apiClient.api.projects[':id'].vnextConfigStatus.$get({
      param: { id: projectId },
    }),
  );
}

export function getVnextComponentLayoutStatus(projectId: string) {
  return callApi<VnextComponentLayoutStatus>(
    apiClient.api.projects[':id'].vnextComponentLayoutStatus.$get({
      param: { id: projectId },
    }),
  );
}

export function writeProjectConfig(projectId: string, body: WriteProjectConfigPayload) {
  return callApi<ProjectInfo>(
    apiClient.api.projects[':id'].vnextConfig.$post({
      param: { id: projectId },
      json: body,
    } as never),
  );
}

export function seedVnextComponentLayout(projectId: string) {
  return unwrapApi<SeedVnextComponentLayoutResult>(
    apiClient.api.projects[':id'].vnextComponentLayout.$post({
      param: { id: projectId },
    }),
  );
}

export function getValidateScriptStatus(projectId: string) {
  return callApi<{ exists: boolean }>(
    apiClient.api.projects[':id'].validateScriptStatus.$get({
      param: { id: projectId },
    }),
  );
}

export function getComponentFileTypes(projectId: string) {
  return callApi<Record<string, string>>(
    apiClient.api.projects[':id'].componentFileTypes.$get({
      param: { id: projectId },
    }),
  );
}
