import { useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { ErrorBoundary } from '@vnext-forge-studio/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import { ErrorBoundaryEditor } from '../tabs/shared/ErrorBoundaryEditor';
import { MetadataSection } from './MetadataSection';

export function WorkflowErrorBoundarySection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const errorBoundary: ErrorBoundary | undefined = attrs.errorBoundary;

  const handleChange = useCallback(
    (eb: ErrorBoundary | undefined) => {
      updateWorkflow((draft: any) => {
        if (!draft.attributes) draft.attributes = {};
        if (eb) {
          draft.attributes.errorBoundary = eb;
        } else {
          delete draft.attributes.errorBoundary;
        }
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection title="Error Boundary" icon={<ShieldAlert size={13} />}>
      <ErrorBoundaryEditor errorBoundary={errorBoundary} onChange={handleChange} />
    </MetadataSection>
  );
}
