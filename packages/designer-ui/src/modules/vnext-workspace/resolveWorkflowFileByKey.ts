import { useCallback } from 'react';

import { showNotification } from '../../notification/notification-port.js';
import { useProjectStore } from '../../store/useProjectStore.js';
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
}

/**
 * Resolves a workflow reference (component key + domain) to the file backing
 * it, warning the user when the reference cannot be followed.
 *
 * Shared by the flow editor's subflow node navigation and Quick Run's
 * correlation actions: both hold a `key`, both need the file, and both must
 * refuse cross-domain references the same way.
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

      const currentDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

      if (workflowDomain && workflowDomain !== currentDomain) {
        showNotification({
          message: 'This subflow belongs to a different domain. Please open the target workspace manually.',
          kind: 'warning',
        });
        return null;
      }

      if (!activeProject) {
        showNotification({
          message: 'No active project. Cannot resolve subflow workflow.',
          kind: 'warning',
        });
        return null;
      }

      try {
        const workflows = await discoverVnextComponentsByCategory(activeProject.id, 'workflows');
        const match = workflows.find((w) => w.key === workflowKey);

        if (!match) {
          showNotification({
            message: 'Subflow workflow file not found in the workspace.',
            kind: 'warning',
          });
          return null;
        }

        const route = vnextConfig?.paths
          ? resolveWorkflowRoute(match.path, activeProject.path, vnextConfig.paths)
          : null;

        return { path: match.path, ...(route ? { route } : {}) };
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
