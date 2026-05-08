import { Info } from 'lucide-react';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

export function ScriptTaskForm(_props: Props) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
      <div className="space-y-1 text-xs">
        <p className="font-medium text-blue-700 dark:text-blue-400">
          Script tasks are defined as metadata only
        </p>
        <p className="text-muted-foreground leading-relaxed">
          This task does not require configuration here. Mapping scripts are
          written where the task is used within a workflow state (onEntry /
          onExit).
        </p>
      </div>
    </div>
  );
}
