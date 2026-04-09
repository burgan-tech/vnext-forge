import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useProjectStore } from '../../../stores/project-store';
import { useRuntimeStore } from '../../../stores/runtime-store';
import { useValidationStore } from '../../../stores/validation-store';
import { useWorkflowStore } from '../../../stores/workflow-store';

export function StatusBar() {
  const { activeProject } = useProjectStore();
  const { connected, healthStatus } = useRuntimeStore();
  const { isDirty } = useWorkflowStore();
  const { issues } = useValidationStore();

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  return (
    <div className="flex h-7 shrink-0 select-none items-center gap-3 bg-brand-surface px-4 text-[11px] text-brand-surface-foreground">
      <span className="font-semibold text-brand-surface-strong">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <span className="flex items-center gap-1.5 text-brand-surface-warning">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-surface-dot-warning" />
          Modified
        </span>
      )}

      {errors > 0 && (
        <span className="flex items-center gap-1 text-brand-surface-error">
          <AlertCircle size={12} />
          {errors}
        </span>
      )}

      {warnings > 0 && (
        <span className="flex items-center gap-1 text-brand-surface-warning">
          <AlertTriangle size={12} />
          {warnings}
        </span>
      )}

      {errors === 0 && warnings === 0 && activeProject && (
        <span className="flex items-center gap-1 text-brand-surface-success">
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
