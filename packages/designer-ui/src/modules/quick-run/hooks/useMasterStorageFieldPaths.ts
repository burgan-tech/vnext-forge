import { useEffect, useState } from 'react';

import { defaultSchemaComponentLoaderDeps } from '../../vnext-workspace/loadSchemaComponent';
import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { loadWorkflowStorageFieldPaths } from '../utils/workflowMasterSchema';

const EMPTY: string[] = [];

/**
 * `x-storage` file field paths of the workflow's local master schema
 * (`doc`, `files[]`, …). Transition schemas carry no `x-storage`, so QuickRun
 * finds upload fields through these paths. Empty while loading or unknown.
 */
export function useMasterStorageFieldPaths(workflowKey: string, workflowDomain?: string): string[] {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [paths, setPaths] = useState<string[]>(EMPTY);

  useEffect(() => {
    setPaths(EMPTY);
    if (!workflowKey) return;
    let cancelled = false;
    void loadWorkflowStorageFieldPaths(workflowKey, {
      ...defaultSchemaComponentLoaderDeps,
      resolveWorkflowFile: async (key) => {
        const resolved = await resolveWorkflowFile(key, workflowDomain, { quiet: true });
        return resolved ? { path: resolved.path, projectId: resolved.projectId } : null;
      },
    }).then((next) => {
      if (!cancelled) setPaths(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowKey, workflowDomain, resolveWorkflowFile]);

  return paths;
}
