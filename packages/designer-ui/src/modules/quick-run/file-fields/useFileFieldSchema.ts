import { useMemo } from 'react';

import { useMasterStorageFieldPaths } from '../hooks/useMasterStorageFieldPaths';
import { useQuickRunStore } from '../store/quickRunStore';
import { registerFileUploadField } from './FileUploadField';
import { markFileFields } from './markFileFields';

/**
 * The form schema with its file upload fields marked for the QuickRun file
 * widget (found through the workflow's master schema `x-storage` paths or the
 * upload shape). `hasFileFields` is true when at least one was marked.
 */
export function useFileFieldSchema<T>(schema: T): { schema: T; hasFileFields: boolean } {
  registerFileUploadField();
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const masterPaths = useMasterStorageFieldPaths(workflowKey, domain || undefined);
  return useMemo(() => {
    const marked = markFileFields(schema, masterPaths);
    return { schema: marked, hasFileFields: marked !== schema };
  }, [schema, masterPaths]);
}
