import { useCallback } from 'react';

import type { VnextWorkspaceConfig } from '@vnext-forge-studio/app-contracts';

import { callApi } from '../../api/client.js';
import { showNotification } from '../../notification/notification-port.js';
import { useProjectStore } from '../../store/useProjectStore.js';
import type { ProjectInfo } from '../../shared/projectTypes.js';
import { discoverVnextComponentsByCategory } from './vnextComponentDiscovery.js';

export interface WorkflowRoute {
  group: string;
  name: string;
}

export interface ResolvedWorkflowFile {
  /** Absolute path of the workflow JSON on disk. */
  path: string;
  /**
   * Route coordinates under `<componentsRoot>/<workflows>`. Only resolvable
   * when the workspace config is loaded — the extension's Quick Run webview
   * never populates `vnextConfig`, so hosts there work off `path` instead.
   */
  route?: WorkflowRoute;
  /**
   * Project the workflow belongs to. Equals the active project's id for
   * same-domain references; for a sibling solution in the same workspace root
   * (`vnext.<domain>.config.json`) it is that domain. Callers that navigate by
   * `route` must not do so when this differs from the active project.
   */
  projectId: string;
  /** Domain of the resolved workflow. */
  domain: string;
}

export interface SiblingSolutionProject {
  id: string;
  path: string;
  paths?: VnextWorkspaceConfig['paths'];
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * A different domain is reachable when it is a sibling solution file in the
 * same workspace root: the extension host / server link every solution as its
 * own project (id = domain), so `projects/getById` resolves it and its `path`
 * equals the active project's root.
 */
export async function resolveSiblingSolutionProject(
  domain: string,
  activeProject: ProjectInfo,
): Promise<SiblingSolutionProject | null> {
  const [siblingRes, currentRes] = await Promise.all([
    callApi<ProjectInfo>({ method: 'projects/getById', params: { id: domain } }),
    callApi<ProjectInfo>({ method: 'projects/getById', params: { id: activeProject.id } }),
  ]);
  if (!siblingRes.success || !currentRes.success) return null;
  const sibling = siblingRes.data;
  if (sibling.domain !== domain) return null;
  if (normalizePath(sibling.path) !== normalizePath(currentRes.data.path)) return null;

  const configRes = await callApi<VnextWorkspaceConfig>({
    method: 'projects/getConfig',
    params: { id: sibling.id },
  });
  return {
    id: sibling.id,
    path: sibling.path,
    ...(configRes.success && configRes.data?.paths ? { paths: configRes.data.paths } : {}),
  };
}

/**
 * Resolves a workflow reference (component key + domain) to the file backing
 * it, warning the user when the reference cannot be followed.
 *
 * Shared by the flow editor's subflow node navigation and Quick Run's
 * correlation actions: both hold a `key`, both need the file, and both must
 * treat cross-domain references the same way — a sibling solution in the same
 * workspace root is followed, anything else is refused.
 *
 * Note: component discovery de-dupes by key, so a workflow `version` cannot
 * select between sibling files — callers must treat version as display-only.
 */
export function useWorkflowFileResolver(): (
  workflowKey: string,
  workflowDomain?: string,
) => Promise<ResolvedWorkflowFile | null> {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);

  return useCallback(
    async (workflowKey: string, workflowDomain?: string) => {
      if (!workflowKey) return null;

      if (!activeProject) {
        showNotification({
          message: 'No active project. Cannot resolve subflow workflow.',
          kind: 'warning',
        });
        return null;
      }

      const currentDomain = vnextConfig?.domain ?? activeProject.domain ?? '';

      let target: SiblingSolutionProject = {
        id: activeProject.id,
        path: activeProject.path,
        ...(vnextConfig?.paths ? { paths: vnextConfig.paths } : {}),
      };
      let targetDomain = currentDomain;

      if (workflowDomain && workflowDomain !== currentDomain) {
        const sibling = await resolveSiblingSolutionProject(workflowDomain, activeProject).catch(
          () => null,
        );
        if (!sibling) {
          showNotification({
            message: `This subflow belongs to domain '${workflowDomain}', which is not a solution in this workspace. Open the target workspace manually.`,
            kind: 'warning',
          });
          return null;
        }
        target = sibling;
        targetDomain = workflowDomain;
      }

      try {
        const workflows = await discoverVnextComponentsByCategory(target.id, 'workflows');
        const match = workflows.find((w) => w.key === workflowKey);

        if (!match) {
          showNotification({
            message: 'Subflow workflow file not found in the workspace.',
            kind: 'warning',
          });
          return null;
        }

        const route = target.paths
          ? resolveWorkflowRoute(match.path, target.path, target.paths)
          : null;

        return {
          path: match.path,
          ...(route ? { route } : {}),
          projectId: target.id,
          domain: targetDomain,
        };
      } catch {
        showNotification({
          message: 'Failed to resolve subflow workflow file.',
          kind: 'warning',
        });
        return null;
      }
    },
    [activeProject, vnextConfig],
  );
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function resolveWorkflowRoute(
  absoluteFilePath: string,
  projectRoot: string,
  paths: { componentsRoot: string; workflows: string },
): WorkflowRoute | null {
  const abs = norm(absoluteFilePath);
  const componentsRoot = paths.componentsRoot || '';
  const workflows = paths.workflows || 'Workflows';
  const base = norm(`${norm(projectRoot)}/${componentsRoot}/${workflows}`);
  const prefix = `${base}/`;
  if (abs.length < prefix.length) return null;
  if (abs.toLowerCase().slice(0, prefix.length) !== prefix.toLowerCase()) return null;
  const rel = abs.slice(prefix.length);
  const parts = rel.split('/').filter(Boolean);
  if (parts.length < 1) return null;
  const last = parts[parts.length - 1];
  if (!/\.json$/i.test(last)) return null;
  const name = last.replace(/\.json$/i, '');
  if (!name) return null;
  if (parts.length === 1) {
    return { group: '', name };
  }
  const group = parts.slice(0, -1).join('/');
  return { group, name };
}
