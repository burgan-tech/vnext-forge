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
    <div className="h-7 bg-indigo-600 flex items-center px-4 text-[11px] gap-3 shrink-0 select-none text-indigo-100">
      <span className="font-semibold text-white">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <span className="flex items-center gap-1.5 text-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
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
          className={`w-2 h-2 rounded-full ${
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
