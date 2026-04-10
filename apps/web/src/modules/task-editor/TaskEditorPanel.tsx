import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { TaskMetadataForm } from './TaskMetadataForm';
import { taskFormMap } from './forms';

interface TaskEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

export function TaskEditorPanel({ json, onChange }: TaskEditorPanelProps) {
  const attrs = json.attributes as Record<string, unknown> | undefined;
  const taskType = String(attrs?.type || '0');
  const config = (attrs?.config || {}) as Record<string, unknown>;

  const FormComponent = taskFormMap[taskType];

  function onConfigChange(updater: (draft: any) => void) {
    onChange((draft) => {
      if (!draft.attributes) draft.attributes = {};
      const attrs = draft.attributes as Record<string, unknown>;
      if (!attrs.config) attrs.config = {};
      updater(attrs.config);
    });
  }

  return (
    <div className="space-y-4 p-4">
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Task Metadata</CardTitle>
          <CardDescription className="text-xs">Identity and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <TaskMetadataForm json={json} onChange={onChange} />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Task Configuration</CardTitle>
          <CardDescription className="text-xs">
            {getTaskTypeName(taskType)} task settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {FormComponent ? (
            <FormComponent config={config} onChange={onConfigChange} />
          ) : (
            <div className="text-xs text-muted-foreground">
              No form available for task type &quot;{taskType}&quot;. Edit as JSON.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getTaskTypeName(type: string): string {
  const names: Record<string, string> = {
    '3': 'Dapr Service',
    '4': 'Dapr PubSub',
    '5': 'Script',
    '6': 'HTTP',
    '7': 'Dapr Binding',
    '11': 'Start',
    '12': 'Direct Trigger',
    '13': 'Get Instance Data',
    '14': 'SubProcess',
    '15': 'Get Instances',
  };
  return names[type] || `Unknown (${type})`;
}
