import { useEffect, useState } from 'react';

import { readFile } from '../../../../../project-workspace/WorkspaceApi';
import { useWorkflowFileResolver } from '../../../../../vnext-workspace/resolveWorkflowFileByKey';
import { summarizeChildWorkflow, type ChildWorkflowLoad } from './childWorkflowSummary';

const IDLE: ChildWorkflowLoad = { status: 'idle', summary: null };
const UNAVAILABLE: ChildWorkflowLoad = { status: 'unavailable', summary: null };

/**
 * Loads the subflow's child definition with the same resolution the canvas
 * uses to open a subflow (sibling-solution aware), but quietly: a child that
 * cannot be found only turns the override pickers into free-text inputs.
 */
export function useChildWorkflowSummary(processKey: string, processDomain: string): ChildWorkflowLoad {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [load, setLoad] = useState<ChildWorkflowLoad>(IDLE);

  useEffect(() => {
    if (!processKey) {
      setLoad(IDLE);
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading', summary: null });
    void (async () => {
      try {
        const resolved = await resolveWorkflowFile(processKey, processDomain || undefined, { quiet: true });
        if (!resolved) {
          if (!cancelled) setLoad(UNAVAILABLE);
          return;
        }
        const file = await readFile(resolved.path);
        const summary = summarizeChildWorkflow(JSON.parse(file.content));
        if (!cancelled) setLoad(summary ? { status: 'ready', summary } : UNAVAILABLE);
      } catch {
        if (!cancelled) setLoad(UNAVAILABLE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [processKey, processDomain, resolveWorkflowFile]);

  return load;
}
