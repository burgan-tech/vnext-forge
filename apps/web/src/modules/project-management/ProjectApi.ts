import { callApi, unwrapApi } from '@vnext-forge/designer-ui/api';

import type {
  FileTreeNode,
  ProjectConfigStatus,
  ProjectInfo,
  SeedVnextComponentLayoutResult,
  VnextComponentLayoutStatus,
  VnextWorkspaceConfig,
  WriteProjectConfigPayload,
} from './ProjectTypes';

/**
 * Single round-trip payload for opening a project workspace. Mirrors the
 * server-side `projects.getWorkspaceBootstrap` aggregation: cheap fields are
 * always populated; the expensive triple (`layoutStatus`,
 * `validateScriptStatus`, `componentFileTypes`) is only set when
 * `configStatus.status === 'ok'`.
 */
export interface ProjectWorkspaceBootstrap {
  project: ProjectInfo;
  tree: { root: FileTreeNode };
  configStatus: ProjectConfigStatus;
  layoutStatus: VnextComponentLayoutStatus | null;
  validateScriptStatus: { exists: boolean } | null;
  componentFileTypes: Record<string, string> | null;
}

export function listProjects() {
  return callApi<ProjectInfo[]>({ method: 'projects.list' });
}

export function createProject(input: { domain: string; targetPath?: string }) {
  return callApi<ProjectInfo>({
    method: 'projects.create',
    params: input,
  });
}

export function deleteProject(projectId: string) {
  return callApi({ method: 'projects.remove', params: { id: projectId } });
}

export function importProject(path: string) {
  return callApi<ProjectInfo>({ method: 'projects.import', params: { path } });
}

export function getProject(projectId: string) {
  return callApi<ProjectInfo>({ method: 'projects.getById', params: { id: projectId } });
}

export function getProjectConfig(projectId: string) {
  return callApi<VnextWorkspaceConfig>({ method: 'projects.getConfig', params: { id: projectId } });
}

export function getProjectConfigStatus(projectId: string) {
  return callApi<ProjectConfigStatus>({
    method: 'projects.getConfigStatus',
    params: { id: projectId },
  });
}

export function getVnextComponentLayoutStatus(projectId: string) {
  return callApi<VnextComponentLayoutStatus>({
    method: 'projects.getVnextComponentLayoutStatus',
    params: { id: projectId },
  });
}

export function writeProjectConfig(projectId: string, body: WriteProjectConfigPayload) {
  return callApi<ProjectInfo>({
    method: 'projects.writeConfig',
    params: { id: projectId, config: body },
  });
}

export function seedVnextComponentLayout(projectId: string) {
  return unwrapApi<SeedVnextComponentLayoutResult>({
    method: 'projects.seedVnextComponentLayout',
    params: { id: projectId },
  });
}

export function getValidateScriptStatus(projectId: string) {
  return callApi<{ exists: boolean }>({
    method: 'projects.getValidateScriptStatus',
    params: { id: projectId },
  });
}

export function getComponentFileTypes(projectId: string) {
  return callApi<Record<string, string>>({
    method: 'projects.getComponentFileTypes',
    params: { id: projectId },
  });
}

export function getWorkspaceBootstrap(projectId: string) {
  return callApi<ProjectWorkspaceBootstrap>({
    method: 'projects.getWorkspaceBootstrap',
    params: { id: projectId },
  });
}
