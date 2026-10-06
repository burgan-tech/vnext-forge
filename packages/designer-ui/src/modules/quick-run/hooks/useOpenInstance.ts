import { useCallback } from 'react';

import { quickRunHeadersFromState } from '../pseudo-ui/mergeQuickRunHeaders';
import { useQuickRunStore } from '../store/quickRunStore';
import type { OpenInstanceTarget } from '../utils/instanceTarget';
import { useQuickRunPolling } from './useQuickRunPolling';

/** Focus an open instance tab, or add it and start polling it. */
export function useOpenInstance(): (target: OpenInstanceTarget) => void {
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);
  const { pollState } = useQuickRunPolling(pollingConfig);

  return useCallback(
    (target: OpenInstanceTarget) => {
      // Read live: a caller may hold this callback across a store reset
      // (`setWorkflowContext` clears instances), so closed-over values go stale.
      const { instances, environmentName, environmentUrl } = useQuickRunStore.getState();
      if (instances.has(target.id)) {
        setActiveTab(target.id);
        return;
      }
      addInstance({
        id: target.id,
        key: target.key,
        status: target.status,
        ...(target.effectiveStatus ? { effectiveStatus: target.effectiveStatus } : {}),
        domain: target.domain,
        workflowKey: target.workflowKey,
        environmentName,
        currentState: target.currentState,
        startedAt: target.startedAt,
      });
      addTab({
        instanceId: target.id,
        domain: target.domain,
        workflowKey: target.workflowKey,
        environmentName,
        label: target.key || target.id.slice(0, 8),
      });
      void pollState({
        domain: target.domain,
        workflowKey: target.workflowKey,
        instanceId: target.id,
        // The shared Quick Run header rule, read live (tool-wide < global < session).
        headers: quickRunHeadersFromState(useQuickRunStore.getState()),
        runtimeUrl: environmentUrl,
      });
    },
    [setActiveTab, addInstance, addTab, pollState],
  );
}
