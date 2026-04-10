import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useProjectStore } from '@app/store/useProjectStore';
import { useRuntimeStore } from '@app/store/useRuntimeStore';
import { useValidationStore } from '@app/store/useValidationStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';

export function StatusBar() {
  const { activeProject } = useProjectStore();
  const { connected, healthStatus } = useRuntimeStore();
  const { isDirty } = useWorkflowStore();
  const { issues } = useValidationStore();

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const runtimeTone = connected ? 'success' : healthStatus === 'unhealthy' ? 'warning' : 'muted';
  const runtimeIndicatorClass = connected
    ? 'bg-brand-surface-dot-success'
    : healthStatus === 'unhealthy'
      ? 'bg-brand-surface-dot-warning'
      : 'bg-brand-surface-dot-idle';
  const runtimeLabel = connected
    ? 'Runtime Connected'
    : healthStatus === 'unhealthy'
      ? 'Runtime Offline'
      : 'Standalone Mode';
  const modifiedPillClass =
    'border-brand-surface-status-warning-border bg-brand-surface-status-warning text-brand-surface-status-warning-foreground';
  const errorPillClass =
    'border-brand-surface-status-danger-border bg-brand-surface-status-danger text-brand-surface-status-danger-foreground';
  const warningPillClass =
    'border-brand-surface-status-warning-border bg-brand-surface-status-warning text-brand-surface-status-warning-foreground';
  const validatedPillClass =
    'border-brand-surface-status-success-border bg-brand-surface-status-success text-brand-surface-status-success-foreground';
  const runtimePillClass =
    runtimeTone === 'success'
      ? 'border-brand-surface-status-success-border bg-brand-surface-status-success text-brand-surface-status-success-foreground'
      : runtimeTone === 'warning'
        ? 'border-brand-surface-status-warning-border bg-brand-surface-status-warning text-brand-surface-status-warning-foreground'
        : 'border-brand-surface-status-muted-border bg-brand-surface-status-muted text-brand-surface-status-muted-foreground';

  return (
    <div className="bg-brand-surface text-brand-surface-foreground flex h-7 shrink-0 items-center gap-3 px-4 text-[11px] select-none">
      <span className="text-brand-surface-strong font-semibold">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${modifiedPillClass}`}
        >
          <span className="bg-brand-surface-dot-warning h-1.5 w-1.5 animate-pulse rounded-full" />
          Modified
        </span>
      )}

      {errors > 0 && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${errorPillClass}`}
        >
          <AlertCircle size={12} />
          {errors} {errors === 1 ? 'Error' : 'Errors'}
        </span>
      )}

      {warnings > 0 && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${warningPillClass}`}
        >
          <AlertTriangle size={12} />
          {warnings} {warnings === 1 ? 'Warning' : 'Warnings'}
        </span>
      )}

      {errors === 0 && warnings === 0 && activeProject && (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${validatedPillClass}`}
        >
          <CheckCircle2 size={12} />
          Validated
        </span>
      )}

      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${runtimePillClass}`}
      >
        <span className={`h-2 w-2 rounded-full ${runtimeIndicatorClass}`} />
        <span>{runtimeLabel}</span>
      </span>
    </div>
  );
}
