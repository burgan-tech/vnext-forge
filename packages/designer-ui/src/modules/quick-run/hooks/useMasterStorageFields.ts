import { useEffect, useState } from 'react';

import { defaultSchemaComponentLoaderDeps } from '../../vnext-workspace/loadSchemaComponent';
import { useWorkflowFileResolver } from '../../vnext-workspace/resolveWorkflowFileByKey';
import { loadWorkflowStorageFields, type WorkflowStorageFields } from '../utils/workflowMasterSchema';

const EMPTY: WorkflowStorageFields = { paths: [], transports: {} };

/**
 * `x-storage` file fields of the workflow's local master schema (`doc`,
 * `files[]`, …) and their non-inline transports. Transition schemas carry no
 * `x-storage`, so QuickRun finds upload fields through these paths. Empty
 * while loading or unknown.
 */
export function useMasterStorageFields(workflowKey: string, workflowDomain?: string): WorkflowStorageFields {
  const resolveWorkflowFile = useWorkflowFileResolver();
  const [fields, setFields] = useState<WorkflowStorageFields>(EMPTY);

  useEffect(() => {
    setFields(EMPTY);
    if (!workflowKey) return;
    let cancelled = false;
    void loadWorkflowStorageFields(workflowKey, {
      ...defaultSchemaComponentLoaderDeps,
      resolveWorkflowFile: async (key) => {
        const resolved = await resolveWorkflowFile(key, workflowDomain, { quiet: true });
        return resolved ? { path: resolved.path, projectId: resolved.projectId } : null;
      },
    }).then((next) => {
      if (!cancelled) setFields(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowKey, workflowDomain, resolveWorkflowFile]);

  return fields;
}
