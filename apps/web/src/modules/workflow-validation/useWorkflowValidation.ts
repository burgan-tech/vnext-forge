import { useEffect } from 'react';
import { useValidationStore } from '@app/store/useValidationStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';
import { useAsync } from '@shared/hooks/UseAsync';
import { validateWorkflowDefinition } from './WorkflowValidationApi';

export function useWorkflowValidation() {
  const workflowJson = useWorkflowStore((state) => state.workflowJson);
  const setIssues = useValidationStore((state) => state.setIssues);
  const clearIssues = useValidationStore((state) => state.clearIssues);
  const issues = useValidationStore((state) => state.issues);

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

    void execute(workflowJson);
  }, [clearIssues, execute, reset, workflowJson]);

  return {
    issues,
    error,
    isValidating: loading,
  };
}
