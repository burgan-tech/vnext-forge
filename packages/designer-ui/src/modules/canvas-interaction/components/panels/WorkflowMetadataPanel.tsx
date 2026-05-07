import { useEffect, useRef } from 'react';
import { X, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/Tooltip';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { WorkflowBasicFieldsSection } from './sections/WorkflowBasicFieldsSection';
import { WorkflowSchemaSection } from './sections/WorkflowSchemaSection';
import { WorkflowUpdateDataSection } from './sections/WorkflowUpdateDataSection';
import { WorkflowQueryRolesSection } from './sections/WorkflowQueryRolesSection';
import { WorkflowSharedTransitionsSection } from './sections/WorkflowSharedTransitionsSection';
import { WorkflowCancelSection } from './sections/WorkflowCancelSection';
import { WorkflowExitSection } from './sections/WorkflowExitSection';
import { WorkflowTimeoutSection } from './sections/WorkflowTimeoutSection';
import { WorkflowErrorBoundarySection } from './sections/WorkflowErrorBoundarySection';
import { WorkflowFunctionsSection } from './sections/WorkflowFunctionsSection';
import { WorkflowExtensionsSection } from './sections/WorkflowExtensionsSection';

interface WorkflowMetadataPanelProps {
  onClose: () => void;
  scrollToSection?: string | null;
  onScrollComplete?: () => void;
}

export function WorkflowMetadataPanel({ onClose, scrollToSection, onScrollComplete }: WorkflowMetadataPanelProps) {
  const { workflowJson } = useWorkflowStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollToSection) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`wf-section-${scrollToSection}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      onScrollComplete?.();
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollToSection, onScrollComplete]);

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
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-primary-icon hover:bg-muted cursor-pointer rounded-xl p-1.5 transition-all"
                aria-label="Close">
                <X size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Close
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4 pb-3">
          <WorkflowBasicFieldsSection />
          <WorkflowSchemaSection />
          <div id="wf-section-updateData"><WorkflowUpdateDataSection /></div>
          <WorkflowQueryRolesSection />
          <div id="wf-section-sharedTransitions"><WorkflowSharedTransitionsSection /></div>
          <div id="wf-section-cancel"><WorkflowCancelSection /></div>
          <div id="wf-section-exit"><WorkflowExitSection /></div>
          <div id="wf-section-timeout"><WorkflowTimeoutSection /></div>
          <WorkflowErrorBoundarySection />
          <WorkflowFunctionsSection />
          <WorkflowExtensionsSection />
        </div>
      </div>
    </div>
  );
}
