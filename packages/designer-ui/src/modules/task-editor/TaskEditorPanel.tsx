import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { ScriptTaskChromeProvider } from './ScriptTaskChromeContext.js';
import { TaskMetadataForm } from './TaskMetadataForm';
import { taskFormMap } from './forms';

interface TaskEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

/**
 * The panel uses the same simple block layout for ALL task types: the parent
 * `ComponentEditorLayout` body owns vertical scroll. We deliberately do NOT
 * branch on `taskType === '5'` here — earlier we tried a `flex h-full
 * min-h-0 flex-col` chain so the script editor could "fill" a flex-1
 * Configuration card, but in the VS Code webview the Metadata card
 * (key/version/domain/flow grid + task-type picker + tag editor) is ~400px
 * tall and the body is ~600px. A `shrink-0` Metadata then ate the full
 * height and squeezed the Configuration card to ~140px, leaving < 40px
 * for ScriptEditorPanel after Card chrome and Monaco's own header /
 * toolbar / status bar — so the editor area collapsed to 0. Stable
 * Monaco height is ScriptTaskForm's responsibility (clamp on the edit
 * phase wrapper), not the panel's.
 */
export function TaskEditorPanel({ json, onChange, onOpenScriptFileInHost }: TaskEditorPanelProps) {
  const attrs = json.attributes as Record<string, unknown> | undefined;
  const taskType = String(attrs?.type || '0');
  const config = (attrs?.config || {}) as Record<string, unknown>;

  const FormComponent = taskFormMap[taskType];
  const isScriptTask = taskType === '5';

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
          <CardDescription className="text-xs">Identity, type and flow bindings.</CardDescription>
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
            isScriptTask ? (
              <ScriptTaskChromeProvider onOpenScriptFileInHost={onOpenScriptFileInHost}>
                <FormComponent config={config} onChange={onConfigChange} />
              </ScriptTaskChromeProvider>
            ) : (
              <FormComponent config={config} onChange={onConfigChange} />
            )
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
