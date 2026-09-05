import { useCallback } from 'react';

import { showNotification } from '../../notification/notification-port.js';
import { useProjectStore } from '../../store/useProjectStore.js';
import { useWorkflowFileResolver } from '../vnext-workspace/resolveWorkflowFileByKey.js';

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
  const resolveWorkflowFile = useWorkflowFileResolver();

  const onOpenSubFlow = useCallback(
    async (processKey: string, processDomain: string) => {
      if (!processKey) return;

      // Warnings for the unresolvable cases are raised by the resolver.
      const resolved = await resolveWorkflowFile(processKey, processDomain);
      if (!resolved) return;

      if (onOpenWorkflowFile) {
        onOpenWorkflowFile(resolved.path);
        return;
      }

      // `route` is relative to the resolved project; navigating by group/name
      // inside the *active* project would open the wrong file when the subflow
      // lives in a sibling solution (`vnext.<domain>.config.json`).
      const activeProjectId = useProjectStore.getState().activeProject?.id;
      if (activeProjectId && resolved.projectId !== activeProjectId) {
        showNotification({
          message: `This subflow belongs to domain '${resolved.domain}'. Open it from that domain's workspace files.`,
          kind: 'info',
        });
        return;
      }

      if (onNavigateToWorkflow && resolved.route) {
        onNavigateToWorkflow(resolved.route.group, resolved.route.name);
        return;
      }

      showNotification({
        message: 'Subflow workflow file not found in the workspace.',
        kind: 'warning',
      });
    },
    [resolveWorkflowFile, onNavigateToWorkflow, onOpenWorkflowFile],
  );

  return onOpenSubFlow;
}
