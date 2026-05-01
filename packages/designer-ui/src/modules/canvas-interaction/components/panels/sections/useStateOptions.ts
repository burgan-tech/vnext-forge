import { useMemo } from 'react';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import type { StateOption } from '../tabs/shared/AvailableInMultiSelect';

export function useStateOptions(): StateOption[] {
  const workflowJson = useWorkflowStore((s) => s.workflowJson);

  return useMemo(() => {
    const attrs = (workflowJson as any)?.attributes;
    const states: Array<{ key: string; labels?: Array<{ label: string; language: string }> }> =
      attrs?.states || [];
    return states.map((s) => ({
      key: s.key,
      label: s.labels?.[0]?.label,
    }));
  }, [workflowJson]);
}
