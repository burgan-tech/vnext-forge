import { useWorkflowValidation } from './useWorkflowValidation';

const issueToneClassNames = {
  error: 'border-destructive-border bg-destructive-surface text-destructive-text',
  warning: 'border-warning-border bg-warning-surface text-warning-text',
  info: 'border-info-border bg-info-surface text-info-text',
} as const;

const issueIconClassNames = {
  error: 'text-destructive-icon',
  warning: 'text-warning-icon',
  info: 'text-info-icon',
} as const;

export function ValidationPanel() {
  const { issues, error, isValidating } = useWorkflowValidation();

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const infos = issues.filter((issue) => issue.severity === 'info');

  if (error) {
    return (
      <div className="space-y-2 p-4 text-sm">
        <div className="rounded-md border border-destructive-border bg-destructive-surface p-3 text-destructive-text">
          {error.toUserMessage().message}
        </div>
        {isValidating && (
          <div className="text-muted-foreground text-center text-xs">Validating workflow...</div>
        )}
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        {isValidating ? 'Validating workflow...' : 'No validation issues'}
      </div>
    );
  }

  return (
    <div className="h-full space-y-1 overflow-y-auto p-2">
      <div className="text-muted-foreground mb-2 px-1 text-xs">
        {errors.length} errors, {warnings.length} warnings, {infos.length} info messages
      </div>
      {issues.map((issue) => (
        <div
          key={issue.id}
          className={`flex items-start gap-2 rounded-md border p-2 text-xs ${issueToneClassNames[issue.severity]}`}
        >
          <span className={`mt-0.5 shrink-0 ${issueIconClassNames[issue.severity]}`}>
            {issue.severity === 'error' ? 'x' : issue.severity === 'warning' ? '!' : 'i'}
          </span>
          <div>
            <div>{issue.message}</div>
            {issue.nodeId && (
              <div className="mt-0.5 text-[10px] text-current/70">
                Node: {issue.nodeId} | Rule: {issue.rule}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
