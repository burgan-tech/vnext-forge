import type { WriteProjectConfigPayload } from './ProjectTypes';
import * as projectsService from '../../services/projects.service';

export type { ProjectWorkspaceBootstrap } from './ProjectTypes';

export function listProjects() {
  return projectsService.list();
}

export function createProject(input: { domain: string; targetPath?: string }) {
  return projectsService.create(input);
}

export function deleteProject(projectId: string) {
  return projectsService.remove(projectId);
}

export function importProject(path: string) {
  return projectsService.importProject(path);
}

export function getProject(projectId: string) {
  return projectsService.getById(projectId);
}

export function getProjectConfig(projectId: string) {
  return projectsService.getConfig(projectId);
}

export function getProjectConfigStatus(projectId: string) {
  return projectsService.getConfigStatus(projectId);
}

export function getVnextComponentLayoutStatus(projectId: string) {
  return projectsService.getVnextComponentLayoutStatus(projectId);
}

export function writeProjectConfig(projectId: string, body: WriteProjectConfigPayload) {
  return projectsService.writeConfig(projectId, body);
}

export function seedVnextComponentLayout(projectId: string) {
  return projectsService.seedVnextComponentLayout(projectId);
}

export function getValidateScriptStatus(projectId: string) {
  return projectsService.getValidateScriptStatus(projectId);
}

export function getComponentFileTypes(projectId: string) {
  return projectsService.getComponentFileTypes(projectId);
}

export function getWorkspaceBootstrap(projectId: string) {
  return projectsService.getWorkspaceBootstrap(projectId);
}
