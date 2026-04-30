import { TaskExecutionList } from '../../../modules/save-component/components/TaskExecutionList';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';

interface FunctionMultipleTasksSectionProps {
  tasks: any[];
  output: ScriptCode | null | undefined;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  functionKey: string;
  onBeforeOpenModal?: () => void;
}

export function FunctionMultipleTasksSection({
  tasks,
  output,
  onChange,
  functionKey,
  onBeforeOpenModal,
}: FunctionMultipleTasksSectionProps) {
  function handleUpdateOutput(value: ScriptCode) {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
      attrs.output = value;
      draft.attributes = attrs;
    });
  }

  function handleRemoveOutput() {
    onChange((draft) => {
      const attrs = draft.attributes as Record<string, unknown> | undefined;
      if (attrs) {
        delete attrs.output;
      }
    });
  }

  return (
    <div className="space-y-4">
      <TaskExecutionList
        tasks={tasks}
        onChange={(updater) => {
          onChange((draft) => {
            const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
            if (!Array.isArray(attrs.onExecutionTasks)) attrs.onExecutionTasks = [];
            updater(attrs.onExecutionTasks as any[]);
            draft.attributes = attrs;
          });
        }}
        stateKey={functionKey}
        listField="onExecutionTasks"
        onBeforeOpenModal={onBeforeOpenModal}
        hideErrorBoundary
      />

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-sm">Output Mapping</CardTitle>
          <CardDescription className="text-xs">
            Mapping applied after all tasks complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <CsxEditorField
            value={output}
            onChange={handleUpdateOutput}
            onRemove={handleRemoveOutput}
            templateType="mapping"
            contextName={`${functionKey}-fn-output`}
            label="Output"
            stateKey={functionKey}
            listField="functionOutputMapping"
            index={0}
            scriptField="mapping"
          />
        </CardContent>
      </Card>
    </div>
  );
}
