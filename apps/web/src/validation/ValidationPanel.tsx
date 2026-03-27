import { useValidationStore } from '../stores/validation-store';
import { useWorkflowStore } from '../stores/workflow-store';
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
      <div className="p-4 text-sm text-muted-foreground text-center">
        No validation issues
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1 overflow-y-auto h-full">
      <div className="text-xs text-muted-foreground px-1 mb-2">
        {errors.length} errors, {warnings.length} warnings, {infos.length} info
      </div>
      {issues.map((issue) => (
        <div
          key={issue.id}
          className={`flex items-start gap-2 p-2 rounded text-xs ${
            issue.severity === 'error'
              ? 'bg-destructive/10 text-destructive'
              : issue.severity === 'warning'
              ? 'bg-yellow-500/10 text-yellow-600'
              : 'bg-indigo-500/10 text-indigo-600'
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <div>
            <div>{issue.message}</div>
            {issue.nodeId && (
              <div className="text-[10px] opacity-70 mt-0.5">
                Node: {issue.nodeId} | Rule: {issue.rule}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
