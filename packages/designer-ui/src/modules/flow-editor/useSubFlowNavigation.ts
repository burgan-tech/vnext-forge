import { useCallback } from 'react';

import { useProjectStore } from '../../store/useProjectStore.js';
import { showNotification } from '../../notification/notification-port.js';
import { discoverVnextComponentsByCategory } from '../vnext-workspace/vnextComponentDiscovery.js';

export interface SubFlowNavigationDeps {
  onNavigateToWorkflow?: (group: string, name: string) => void;
  onOpenWorkflowFile?: (absolutePath: string) => void;
}

/**
 * Resolves a subflow process reference (key + domain) to a workflow file and
 * triggers navigation. Shows a warning notification when the referenced
 * workflow belongs to a different domain or cannot be found on disk.
 */
export function useSubFlowNavigation({ onNavigateToWorkflow, onOpenWorkflowFile }: SubFlowNavigationDeps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);

  const onOpenSubFlow = useCallback(
    async (processKey: string, processDomain: string) => {
      if (!processKey) return;

      const currentDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

      if (processDomain && processDomain !== currentDomain) {
        showNotification({
          message: 'This subflow belongs to a different domain. Please open the target workspace manually.',
          kind: 'warning',
        });
        return;
      }

      if (!activeProject) {
        showNotification({
          message: 'No active project. Cannot resolve subflow workflow.',
          kind: 'warning',
        });
        return;
      }

      try {
        const workflows = await discoverVnextComponentsByCategory(activeProject.id, 'workflows');
        const match = workflows.find((w) => w.key === processKey);

        if (!match) {
          showNotification({
            message: 'Subflow workflow file not found in the workspace.',
            kind: 'warning',
          });
          return;
        }

        if (onOpenWorkflowFile) {
          onOpenWorkflowFile(match.path);
          return;
        }

        if (onNavigateToWorkflow && vnextConfig?.paths) {
          const route = resolveWorkflowRoute(match.path, activeProject.path, vnextConfig.paths);
          if (route) {
            onNavigateToWorkflow(route.group, route.name);
            return;
          }
        }

        showNotification({
          message: 'Subflow workflow file not found in the workspace.',
          kind: 'warning',
        });
      } catch {
        showNotification({
          message: 'Failed to resolve subflow workflow file.',
          kind: 'warning',
        });
      }
    },
    [activeProject, vnextConfig, onNavigateToWorkflow, onOpenWorkflowFile],
  );

  return onOpenSubFlow;
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

function resolveWorkflowRoute(
  absoluteFilePath: string,
  projectRoot: string,
  paths: { componentsRoot: string; workflows: string },
): { group: string; name: string } | null {
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
  const last = parts[parts.length - 1]!;
  if (!/\.json$/i.test(last)) return null;
  const name = last.replace(/\.json$/i, '');
  if (!name) return null;
  if (parts.length === 1) {
    return { group: '', name };
  }
  const group = parts.slice(0, -1).join('/');
  return { group, name };
}
