import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useProjectStore } from '@app/store/useProjectStore';
import { useRuntimeStore } from '@modules/workflow-execution/RuntimeStore';
import { useValidationStore } from '@modules/workflow-validation/ValidationStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';

export function StatusBar() {
  const { activeProject } = useProjectStore();
  const { connected, healthStatus } = useRuntimeStore();
  const { isDirty } = useWorkflowStore();
  const { issues } = useValidationStore();

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  return (
    <div className="bg-brand-surface text-brand-surface-foreground flex h-7 shrink-0 items-center gap-3 px-4 text-[11px] select-none">
      <span className="text-brand-surface-strong font-semibold">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <span className="text-brand-surface-warning flex items-center gap-1.5">
          <span className="bg-brand-surface-dot-warning h-1.5 w-1.5 animate-pulse rounded-full" />
          Modified
        </span>
      )}

      {errors > 0 && (
        <span className="text-brand-surface-error flex items-center gap-1">
          <AlertCircle size={12} />
          {errors}
        </span>
      )}

      {warnings > 0 && (
        <span className="text-brand-surface-warning flex items-center gap-1">
          <AlertTriangle size={12} />
          {warnings}
        </span>
      )}

      {errors === 0 && warnings === 0 && activeProject && (
        <span className="text-brand-surface-success flex items-center gap-1">
          <CheckCircle2 size={12} />
        </span>
      )}

      <span className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            connected
              ? healthStatus === 'healthy'
                ? 'bg-brand-surface-dot-success'
                : 'bg-brand-surface-dot-warning'
              : 'bg-brand-surface-dot-idle'
          }`}
        />
        <span className="text-brand-surface-muted">{connected ? 'Connected' : 'Standalone'}</span>
      </span>
    </div>
  );
}
