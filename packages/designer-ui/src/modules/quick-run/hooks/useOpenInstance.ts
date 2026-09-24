import { useCallback } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import type { OpenInstanceTarget } from '../utils/instanceTarget';
import { useQuickRunPolling } from './useQuickRunPolling';

/** Focus an open instance tab, or add it and start polling it. */
export function useOpenInstance(): (target: OpenInstanceTarget) => void {
  const instances = useQuickRunStore((s) => s.instances);
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);
  const { pollState } = useQuickRunPolling(pollingConfig);

  return useCallback(
    (target: OpenInstanceTarget) => {
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
        headers: globalHeaders,
        runtimeUrl: environmentUrl,
      });
    },
    [instances, setActiveTab, addInstance, addTab, environmentName, environmentUrl, globalHeaders, pollState],
  );
}
