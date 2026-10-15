import { readHistoryMode } from '@vnext-forge-studio/vnext-types';

import { useWorkflowStore } from '../../../store/useWorkflowStore';

/** True when the open workflow is a `history: none` (one-shot) flow. */
export function useHistoryNone(): boolean {
  return useWorkflowStore((s) => readHistoryMode(s.workflowJson) === 'none');
}

/** Reason shown on controls a `history: none` flow does not allow. */
export const HISTORY_NONE_REASON = 'Not available in a history: none (one-shot) flow.';
