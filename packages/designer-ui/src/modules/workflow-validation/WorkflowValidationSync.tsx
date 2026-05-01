import { useWorkflowValidation } from './useWorkflowValidation';

/**
 * Side-effect component that drives the workflow validation engine. When
 * mounted, it subscribes to `useWorkflowStore.workflowJson` and triggers
 * validation, populating `useValidationStore.issues`.
 *
 * Mount this inside `FlowEditorView` (or any workflow-editing context) so
 * that the validation store is kept up to date. Renders `null`.
 */
export function WorkflowValidationSync() {
  useWorkflowValidation();
  return null;
}
