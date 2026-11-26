import type { ScriptsConfig } from '@vnext-forge-studio/vnext-types';
import { TaskExecutionList } from '../../../modules/save-component/components/TaskExecutionList';
import { CsxEditorField, type ScriptCode } from '../../save-component/components/CsxEditorField';
import { MappingScriptsSection } from '../../save-component/components/MappingScriptsSection';
import { FunctionTaskKeyCollisions } from './FunctionTaskKeyCollisions';
import { useMemo } from 'react';
import {
  outputMappingContent,
  type MappingBindingLike,
} from '../../save-component/declarative-mapping/declarativeMapping';
import { resultSlotsOf } from '../../save-component/declarative-mapping/declarativeMappingCompletions';
import { TaskBindingMappingField } from '../../save-component/declarative-mapping/TaskBindingMappingField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';

interface FunctionMultipleTasksSectionProps {
  tasks: any[];
  /** `attributes.output`: a C# script or a declarative block (runtime vnext#1227). */
  output: ScriptCode | Record<string, unknown> | null | undefined;
  /** `attributes.rawResponse`: without it a block's `statusCode` / `headers` targets are ignored (a warning). */
  rawResponse?: boolean;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
  functionKey: string;
  onBeforeOpenModal?: () => void;
}

export function FunctionMultipleTasksSection({
  tasks,
  output: storedOutput,
  rawResponse = false,
  onChange,
  functionKey,
  onBeforeOpenModal,
}: FunctionMultipleTasksSectionProps) {
  const content = outputMappingContent(storedOutput);
  // The script editor only sees a script-shaped output; a block is edited by the declarative editor.
  const output =
    content === 'script' || content === 'both' ? (storedOutput as ScriptCode) : null;
  const outputOwner = useMemo<MappingBindingLike>(
    () => (storedOutput != null ? { output: storedOutput } : {}),
    [storedOutput],
  );
  const completionContext = useMemo(() => ({ resultSlots: resultSlotsOf(tasks) }), [tasks]);
  const blockOptions = useMemo(() => ({ rawResponse }), [rawResponse]);

  function handleUpdateOutputOwner(updater: (attributes: MappingBindingLike) => void) {
    onChange((draft) => {
      const attrs = (draft.attributes ?? {}) as MappingBindingLike;
      updater(attrs);
      draft.attributes = attrs;
    });
  }

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
      />

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-sm">Output Mapping</CardTitle>
          <CardDescription className="text-xs">
            Shapes the response after all tasks complete: a declarative block over the task results or a
            C# script.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <TaskBindingMappingField
            binding={outputOwner}
            onUpdate={handleUpdateOutputOwner}
            owner="functionOutput"
            blockOptions={blockOptions}
            completionContext={completionContext}
            renderScript={() => (
              <>
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
              </>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
