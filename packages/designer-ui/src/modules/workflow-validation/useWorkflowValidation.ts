import { useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useValidationStore } from '../../store/useValidationStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { useSchemaCapabilities } from '../schema-capabilities/useSchemaCapabilities';
import { validateWorkflowDefinition } from './WorkflowValidationApi';

export function useWorkflowValidation() {
  const workflowJson = useWorkflowStore((state) => state.workflowJson);
  const setIssues = useValidationStore((state) => state.setIssues);
  const clearIssues = useValidationStore((state) => state.clearIssues);
  const issues = useValidationStore((state) => state.issues);
  // Project's `vnext.config.json#schemaVersion`, threaded through so the
  // server validates against the matching `@burgan-tech/vnext-schema`
  // version (downloaded + cached on first use) rather than always using
  // whatever the desktop app shipped with.
  const schemaVersion = useProjectStore((state) => state.vnextConfig?.schemaVersion);
  const capabilities = useSchemaCapabilities('workflow');

  const { execute, loading, error, reset } = useAsync(validateWorkflowDefinition, {
    showNotificationOnError: false,
    errorMessage: 'Workflow could not be validated.',
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setIssues(result.data.issues);
    },
    onError: async () => {
      clearIssues();
    },
  });

  // `useAsync` drops a call made while one is in flight. The re-run that
  // matters most — after the project's schema capabilities load — usually
  // lands exactly then, which left capability-gated local rules evaluated
  // against ALL_ENABLED until the next edit. Remember a dropped run and
  // replay it with the latest document once the current one settles.
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const run = useCallback(
    async (document: unknown, version: string | undefined): Promise<void> => {
      if (inFlightRef.current) {
        rerunRef.current = true;
        return;
      }
      inFlightRef.current = true;
      try {
        await execute(document, version);
      } finally {
        inFlightRef.current = false;
      }
      if (rerunRef.current) {
        rerunRef.current = false;
        const latest = useWorkflowStore.getState().workflowJson;
        if (latest) void run(latest, useProjectStore.getState().vnextConfig?.schemaVersion);
      }
    },
    [execute],
  );

  useEffect(() => {
    if (!workflowJson) {
      rerunRef.current = false;
      reset();
      clearIssues();
      return;
    }

    void run(workflowJson, schemaVersion);
  }, [clearIssues, run, reset, schemaVersion, workflowJson, capabilities]);

  return {
    issues,
    error,
    isValidating: loading,
  };
}
