import { useEffect, useState } from 'react';

import { defaultSchemaComponentLoaderDeps } from '../../vnext-workspace/loadSchemaComponent';
import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { loadWorkflowMasterSchema, type MasterSchemaLoad } from '../utils/workflowMasterSchema';

const NONE: MasterSchemaLoad = { status: 'none' };

/**
 * The workflow's local master schema as filter fields; quiet when it cannot be
 * found. `workflowDomain` is forwarded to the workflow file resolver so a
 * multi-domain solution's sibling workflow is followed (see
 * `useWorkflowFileResolver`).
 */
export function useWorkflowMasterSchema(workflowKey: string, workflowDomain?: string): MasterSchemaLoad {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [load, setLoad] = useState<MasterSchemaLoad>(NONE);

  useEffect(() => {
    // Reset first so a stale master schema from the *previous* workflow key
    // is never shown while the new one is still resolving (or when there is
    // no new one) — the QuickRunner filter panel reads this synchronously.
    setLoad(NONE);
    if (!workflowKey) {
      return;
    }
    let cancelled = false;
    void loadWorkflowMasterSchema(workflowKey, {
      ...defaultSchemaComponentLoaderDeps,
      resolveWorkflowFile: async (key) => {
        const resolved = await resolveWorkflowFile(key, workflowDomain, { quiet: true });
        return resolved ? { path: resolved.path, projectId: resolved.projectId } : null;
      },
    }).then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowKey, workflowDomain, resolveWorkflowFile]);

  return load;
}
