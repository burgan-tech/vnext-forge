import { useValidationStore } from '../../store/useValidationStore';
import { useComponentStore } from '../../store/useComponentStore';
import type { ValidationIssue } from '../workflow-validation/WorkflowValidationTypes';

const SEVERITY_ICON: Record<string, string> = {
  error: 'x',
  warning: '!',
  info: 'i',
};

const SEVERITY_CLASSES: Record<string, string> = {
  error: 'text-destructive-icon',
  warning: 'text-warning-icon',
  info: 'text-info-icon',
};

const ROW_CLASSES: Record<string, string> = {
  error: 'border-destructive-border/30 bg-destructive-surface/50',
  warning: 'border-warning-border/30 bg-warning-surface/50',
  info: 'border-info-border/30 bg-info-surface/50',
};

interface DiagnosticGroup {
  label: string;
  items: Array<{
    id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    detail?: string;
  }>;
}

export interface ProblemsSidebarPanelProps {
  configIssues?: ValidationIssue[];
}

export function ProblemsSidebarPanel({ configIssues = [] }: ProblemsSidebarPanelProps) {
  const workflowIssues = useValidationStore((s) => s.issues);
  const componentErrors = useComponentStore((s) => s.validationErrors);
  const componentType = useComponentStore((s) => s.componentType);

  const groups: DiagnosticGroup[] = [];

  if (workflowIssues.length > 0) {
    groups.push({
      label: 'Workflow Validation',
      items: workflowIssues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        message: issue.message,
        detail: [issue.nodeId ? `Node: ${issue.nodeId}` : '', issue.rule ? `Rule: ${issue.rule}` : '']
          .filter(Boolean)
          .join(' | ') || undefined,
      })),
    });
  }

  if (componentErrors.length > 0) {
    groups.push({
      label: componentType
        ? `${componentType.charAt(0).toUpperCase()}${componentType.slice(1)} Validation`
        : 'Component Validation',
      items: componentErrors.map((err, i) => ({
        id: `comp-${i}-${err.path}`,
        severity: 'error',
        message: err.message,
        detail: err.path || undefined,
      })),
    });
  }

  if (configIssues.length > 0) {
    groups.push({
      label: 'Workspace Config',
      items: configIssues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        message: issue.message,
        detail: issue.path || undefined,
      })),
    });
  }

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (totalCount === 0) {
    return (
      <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
        No problems detected
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" role="region" aria-label="Problems">
      <div className="text-muted-foreground px-3 py-2 text-[10px]" aria-live="polite" aria-atomic="true">
        {totalCount} problem{totalCount > 1 ? 's' : ''}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-muted-foreground mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider">
              {group.label}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-1.5 rounded-md border p-2 text-xs ${ROW_CLASSES[item.severity] ?? ''}`}
                >
                  <span className={`mt-px shrink-0 text-[10px] font-bold ${SEVERITY_CLASSES[item.severity] ?? ''}`}>
                    {SEVERITY_ICON[item.severity] ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-foreground">{item.message}</div>
                    {item.detail && (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={item.detail}>
                        {item.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
