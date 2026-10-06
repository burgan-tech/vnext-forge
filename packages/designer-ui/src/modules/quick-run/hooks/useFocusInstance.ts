import { useEffect } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import type { InstanceDetailResponse } from '../QuickRunApi';
import { quickRunHeadersFromState } from '../pseudo-ui/mergeQuickRunHeaders';
import { useQuickRunStore } from '../store/quickRunStore';
import type { OpenInstanceTarget } from '../utils/instanceTarget';
import { useOpenInstance } from './useOpenInstance';

export function targetFromInstanceDetail(detail: InstanceDetailResponse, domain: string, workflowKey: string): OpenInstanceTarget {
  return {
    id: detail.id,
    key: detail.key,
    domain,
    workflowKey,
    status: detail.metadata.status as OpenInstanceTarget['status'],
    ...(detail.metadata.effectiveStatus ? { effectiveStatus: detail.metadata.effectiveStatus } : {}),
    currentState: detail.metadata.currentState,
    startedAt: detail.metadata.createdAt,
  };
}

/**
 * Bring an instance into focus by id: switch to its tab, or fetch it and open one.
 * Runs once `domain` / `workflowKey` are set in the store (after the shell's
 * `setWorkflowContext`, which resets tabs), so a first-mount focus survives the reset.
 */
export function useFocusInstance(instanceId: string | undefined, runtimeUrl: string | undefined): void {
  const openInstance = useOpenInstance();
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  useEffect(() => {
    if (!instanceId || !domain || !workflowKey) return;
    const state = useQuickRunStore.getState();
    if (state.instances.has(instanceId)) {
      state.setActiveTab(instanceId);
      return;
    }
    let cancelled = false;
    void QuickRunApi.getInstance({
      domain,
      workflowKey,
      instanceId,
      // The shared Quick Run header rule, read live at focus time.
      headers: quickRunHeadersFromState(state),
      ...(runtimeUrl ? { runtimeUrl } : {}),
    }).then((res) => {
      if (!cancelled && res.success) openInstance(targetFromInstanceDetail(res.data, domain, workflowKey));
    });
    return () => {
      cancelled = true;
    };
    // `openInstance` changes identity with store state; re-running on it would refetch needlessly.
  }, [instanceId, domain, workflowKey, runtimeUrl]);
}
