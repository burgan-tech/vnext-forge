import { useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useValidationStore } from '../../store/useValidationStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
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

  useEffect(() => {
    if (!workflowJson) {
      reset();
      clearIssues();
      return;
    }

    void execute(workflowJson, schemaVersion);
  }, [clearIssues, execute, reset, schemaVersion, workflowJson]);

  return {
    issues,
    error,
    isValidating: loading,
  };
}
