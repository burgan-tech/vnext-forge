import { useMemo } from 'react';

import { useMasterStorageFields } from '../hooks/useMasterStorageFields';
import { useQuickRunStore } from '../store/quickRunStore';
import { registerFileUploadField } from './FileUploadField';
import { markFileFields, stripFileFieldValues } from './markFileFields';

/**
 * The form schema with its file upload fields marked for the QuickRun file
 * widget (found through the workflow's master schema `x-storage` paths or the
 * upload shape). `hasFileFields` is true when at least one was marked.
 */
export function useFileFieldSchema<T>(schema: T): {
  schema: T;
  hasFileFields: boolean;
  /** Generated sample data without values in file fields (judged against `forSchema`, default the hook's schema). */
  withoutFileValues: (instance: unknown, forSchema?: unknown) => unknown;
} {
  registerFileUploadField();
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const { paths: masterPaths, transports } = useMasterStorageFields(workflowKey, domain || undefined);
  return useMemo(() => {
    const marked = markFileFields(schema, masterPaths, transports);
    return {
      schema: marked,
      hasFileFields: marked !== schema,
      withoutFileValues: (instance: unknown, forSchema?: unknown) =>
        stripFileFieldValues(instance, forSchema === undefined ? marked : markFileFields(forSchema, masterPaths, transports)),
    };
  }, [schema, masterPaths, transports]);
}
