import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { TaskExecutionList } from '../../../modules/save-component/components/TaskExecutionList';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../save-component/components/MappingScriptsSection';
import { FunctionTaskKeyCollisions } from './FunctionTaskKeyCollisions';
import { hasFeature } from '../../schema-capabilities/SchemaCapabilities';
import { useSchemaCapabilities } from '../../schema-capabilities/useSchemaCapabilities';
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
  // The function schema inlines its task entries, so the workflow schema's
  // shared definition (same vnext-schema release, 0.0.55) stands in.
  const variableKeySupported = hasFeature(useSchemaCapabilities('workflow'), 'definitions.onExecuteTask.variableKey');

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

  const outputScripts = (output as { scripts?: ScriptsConfig } | undefined | null)?.scripts;
  function handleUpdateOutputScripts(next: ScriptsConfig | undefined) {
    onChange((draft) => {
      const attrs = draft.attributes as Record<string, unknown> | undefined;
      const out = attrs?.output as Record<string, unknown> | undefined;
      if (!out) return;
      if (next === undefined) {
        delete out.scripts;
      } else {
        out.scripts = next;
      }
    });
  }

  return (
    <div className="space-y-4">
      <FunctionTaskKeyCollisions tasks={tasks} />
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
        showVariableKey={variableKeySupported}
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
          {output && (
            <MappingScriptsSection
              value={outputScripts}
              onChange={handleUpdateOutputScripts}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
