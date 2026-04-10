import { TaskExecutionList } from '@modules/save-component/components/TaskExecutionList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { FunctionMetadataForm } from './FunctionMetadataForm';

interface FunctionEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function FunctionEditorPanel({ json, onChange }: FunctionEditorPanelProps) {
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];

  return (
    <div className="space-y-4 p-4">
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Function Metadata</CardTitle>
          <CardDescription className="text-xs">Identity, scope and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <FunctionMetadataForm json={json} onChange={onChange} />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Task Execution</CardTitle>
          <CardDescription className="text-xs">
            Manage task step behavior and order.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <TaskExecutionList
            tasks={tasks}
            onChange={(updater) => {
              onChange((draft) => {
                if (!Array.isArray(draft.tasks)) draft.tasks = [];
                updater(draft.tasks as any[]);
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
