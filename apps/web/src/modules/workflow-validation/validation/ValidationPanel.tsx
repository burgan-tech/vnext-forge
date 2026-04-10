import { useValidationStore } from '@modules/workflow-validation/ValidationStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';
import { validateWorkflow } from './ValidationEngine';
import { useEffect } from 'react';

export function ValidationPanel() {
  const { issues, setIssues, setValidating } = useValidationStore();
  const { workflowJson } = useWorkflowStore();

  useEffect(() => {
    if (!workflowJson) {
      setIssues([]);
      return;
    }
    setValidating(true);
    const results = validateWorkflow(workflowJson as any);
    setIssues(results);
    setValidating(false);
  }, [workflowJson]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  if (issues.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">No validation issues</div>
    );
  }

  return (
    <div className="h-full space-y-1 overflow-y-auto p-2">
      <div className="text-muted-foreground mb-2 px-1 text-xs">
        {errors.length} errors, {warnings.length} warnings, {infos.length} info
      </div>
      {issues.map((issue) => (
        <div
          key={issue.id}
          className={`flex items-start gap-2 rounded p-2 text-xs ${
            issue.severity === 'error'
              ? 'bg-destructive/10 text-destructive'
              : issue.severity === 'warning'
                ? 'bg-yellow-500/10 text-yellow-600'
                : 'bg-indigo-500/10 text-indigo-600'
          }`}>
          <span className="mt-0.5 shrink-0">
            {issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <div>
            <div>{issue.message}</div>
            {issue.nodeId && (
              <div className="mt-0.5 text-[10px] opacity-70">
                Node: {issue.nodeId} | Rule: {issue.rule}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
