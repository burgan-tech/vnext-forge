import { useProjectStore } from '../stores/project-store';
import { useRuntimeStore } from '../stores/runtime-store';
import { useWorkflowStore } from '../stores/workflow-store';
import { useValidationStore } from '../stores/validation-store';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export function StatusBar() {
  const { activeProject } = useProjectStore();
  const { connected, healthStatus } = useRuntimeStore();
  const { isDirty } = useWorkflowStore();
  const { issues } = useValidationStore();

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 bg-indigo-600 px-4 text-[11px] text-indigo-100 select-none">
      <span className="font-semibold text-white">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <span className="flex items-center gap-1.5 text-amber-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
          Modified
        </span>
      )}

      {errors > 0 && (
        <span className="flex items-center gap-1 text-rose-200">
          <AlertCircle size={12} />
          {errors}
        </span>
      )}

      {warnings > 0 && (
        <span className="flex items-center gap-1 text-amber-200">
          <AlertTriangle size={12} />
          {warnings}
        </span>
      )}

      {errors === 0 && warnings === 0 && activeProject && (
        <span className="flex items-center gap-1 text-emerald-200">
          <CheckCircle2 size={12} />
        </span>
      )}

      <span className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            connected
              ? healthStatus === 'healthy'
                ? 'bg-emerald-300'
                : 'bg-amber-300'
              : 'bg-indigo-300/50'
          }`}
        />
        <span className="text-indigo-100/80">{connected ? 'Connected' : 'Standalone'}</span>
      </span>
    </div>
  );
}
