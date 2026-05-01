import { X, Info } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { WorkflowBasicFieldsSection } from './sections/WorkflowBasicFieldsSection';
import { WorkflowSchemaSection } from './sections/WorkflowSchemaSection';
import { WorkflowUpdateDataSection } from './sections/WorkflowUpdateDataSection';
import { WorkflowQueryRolesSection } from './sections/WorkflowQueryRolesSection';
import { WorkflowSharedTransitionsSection } from './sections/WorkflowSharedTransitionsSection';
import { WorkflowCancelSection } from './sections/WorkflowCancelSection';
import { WorkflowTimeoutSection } from './sections/WorkflowTimeoutSection';
import { WorkflowErrorBoundarySection } from './sections/WorkflowErrorBoundarySection';
import { WorkflowFunctionsSection } from './sections/WorkflowFunctionsSection';
import { WorkflowExtensionsSection } from './sections/WorkflowExtensionsSection';

interface WorkflowMetadataPanelProps {
  onClose: () => void;
}

export function WorkflowMetadataPanel({ onClose }: WorkflowMetadataPanelProps) {
  const { workflowJson } = useWorkflowStore();
  if (!workflowJson) return null;

  return (
    <div className="border-border bg-surface/80 flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="border-border-subtle bg-surface flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <div className="bg-secondary-muted flex size-7 items-center justify-center rounded-lg">
          <Info size={14} className="text-secondary-icon" />
        </div>
        <span className="text-foreground flex-1 text-[13px] font-bold tracking-tight">
          Workflow Settings
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-primary-icon hover:bg-muted cursor-pointer rounded-xl p-1.5 transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 pb-3">
          <WorkflowBasicFieldsSection />
          <WorkflowSchemaSection />
          <WorkflowUpdateDataSection />
          <WorkflowQueryRolesSection />
          <WorkflowSharedTransitionsSection />
          <WorkflowCancelSection />
          <WorkflowTimeoutSection />
          <WorkflowErrorBoundarySection />
          <WorkflowFunctionsSection />
          <WorkflowExtensionsSection />
        </div>
      </div>
    </div>
  );
}
